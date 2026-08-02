
const { Client } = require("pg");
async function run() {
  const c = new Client("postgres://postgres:postgres@localhost:5432/postgres");
  await c.connect();
  try {
    await c.query("SELECT pg_terminate_backend(pg_backend_pid())");
  } catch(e) {
    console.log("Business error:", e.message);
  }
  try {
    await c.query("SELECT 1");
  } catch (e) {
    console.log("Reset error:", e.message);
  }
}
run();

