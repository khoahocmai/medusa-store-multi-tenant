
const { Client } = require("pg");
async function run() {
  const c = new Client("postgres://postgres:postgres@localhost:5432/postgres");
  await c.connect();
  await c.query("BEGIN");
  await c.query("SELECT set_config('my.var', 'A', true)"); // local
  await c.query("SELECT set_config('my.var', 'B', false)"); // session
  const r = await c.query("SELECT current_setting('my.var') as v");
  console.log(r.rows[0].v);
  await c.query("COMMIT");
  await c.end();
}
run();

