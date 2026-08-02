
const { Client } = require("pg");

const originalQuery = Client.prototype.query;
const clientLocks = new WeakMap();

Client.prototype.query = function patchedQuery(configOrText, ...rest) {
  let callback;
  let values;
  
  if (typeof rest[rest.length - 1] === "function") {
    callback = rest.pop();
  }
  if (rest.length > 0) {
    values = rest[0];
  }
  if (typeof configOrText === "function") {
    callback = configOrText;
    configOrText = undefined;
  }
  
  const targetTenantId = "tenant_A"; // Mock context
  const targetIsPlatform = "false";

  let lock = clientLocks.get(this) || Promise.resolve();
  
  const executeGuardedQuery = async () => {
    // 1. set config
    await new Promise((resolve, reject) => {
      originalQuery.call(
        this,
        {
          text: "SELECT set_config($1, $2, false), set_config($3, $4, false)",
          values: ["app.current_tenant_id", targetTenantId, "app.is_platform_admin", targetIsPlatform],
        },
        (err, res) => (err ? reject(err) : resolve(res))
      );
    });

    // 2. execute business query
    let businessResult;
    let businessError;
    try {
      businessResult = await new Promise((resolve, reject) => {
        const args = [];
        if (configOrText !== undefined) args.push(configOrText);
        if (values !== undefined) args.push(values);
        args.push((err, res) => (err ? reject(err) : resolve(res)));
        originalQuery.apply(this, args);
      });
    } catch (e) {
      businessError = e;
    }

    // 3. reset config
    try {
      await new Promise((resolve, reject) => {
        originalQuery.call(
          this,
          {
            text: "SELECT set_config('app.current_tenant_id', '', false), set_config('app.is_platform_admin', 'false', false)",
          },
          (err, res) => (err ? reject(err) : resolve(res))
        );
      });
    } catch (e) {
      const fatalErr = new Error("FATAL: Failed to reset tenant context. Terminating client to prevent leakage. Original error: " + e.message);
      this.emit("error", fatalErr);
      if (businessError) throw businessError;
      throw fatalErr;
    }

    if (businessError) throw businessError;
    return businessResult;
  };
  
  const taskPromise = lock.catch(() => {}).then(() => executeGuardedQuery());
  clientLocks.set(this, taskPromise);
  
  if (callback) {
    taskPromise.then(
      res => callback(null, res),
      err => callback(err)
    );
    return;
  }
  
  return taskPromise;
};

async function test() {
  const client = new Client({ connectionString: "postgres://postgres:postgres@localhost:5432/postgres" });
  await client.connect();
  
  try {
    const res = await client.query("SELECT current_setting('app.current_tenant_id', true) as tenant");
    console.log("Business query executed. Tenant inside:", res.rows[0].tenant);
    
    // Check state AFTER query resolves
    // We must use originalQuery to bypass the hook to see the real connection state!
    const leakCheck = await new Promise((resolve, reject) => {
      originalQuery.call(client, "SELECT current_setting('app.current_tenant_id', true) as tenant", (err, res) => err ? reject(err) : resolve(res));
    });
    console.log("Leak check after query:", leakCheck.rows[0].tenant || "NULL");

    // Callback version
    await new Promise(resolve => {
        client.query("SELECT current_setting('app.current_tenant_id', true) as tenant", (err, res) => {
            console.log("Callback query executed. Tenant inside:", res.rows[0].tenant);
            resolve();
        });
    });

  } finally {
    await client.end();
  }
}
test().catch(console.error);

