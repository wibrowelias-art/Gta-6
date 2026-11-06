import "dotenv/config";
const { ensureBootstrap } = await import("../src/server/bootstrap");
const { closeDb } = await import("../src/server/db/client");
const res = await ensureBootstrap();
console.log(res.created ? "Developer account created from DEV_BOOTSTRAP_EMAIL." : `No developer created (${res.reason}).`);
await closeDb();
