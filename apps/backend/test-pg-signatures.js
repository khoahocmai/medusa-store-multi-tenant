
const { Client, Query } = require("pg");

async function main() {
  const client = new Client({ connectionString: "postgres://postgres:postgres@localhost:5432/postgres" });
  await client.connect();

  const q1 = client.query("SELECT 1");
  console.log("Promise returned:", q1 instanceof Promise);

  const q2 = client.query("SELECT 2", (err, res) => {});
  console.log("Callback returned type:", typeof q2, q2.constructor.name);

  await client.end();
}
main().catch(console.error);

