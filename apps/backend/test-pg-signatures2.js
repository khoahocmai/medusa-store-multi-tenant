
const { Client, Query } = require("pg");

async function main() {
  const client = new Client({ connectionString: "postgres://postgres:postgres@localhost:5432/postgres" });
  await client.connect();

  const queryObj = new Query("SELECT 2");
  const q2 = client.query(queryObj);
  console.log("Query object returned:", q2 === queryObj);

  await client.end();
}
main().catch(console.error);

