import { createApp } from "./app.js";
import { config } from "./config.js";
import { pool } from "./db/index.js";

const { http, io } = createApp();
http.listen(config.port, "0.0.0.0", () => console.log(`Chatter is listening on http://localhost:${config.port}`));

for (const signal of ["SIGINT", "SIGTERM"]) {
  process.once(signal, () => {
    const timeout = setTimeout(() => process.exit(1), 10_000);
    timeout.unref();
    io.close(() => { void pool.end().then(() => process.exit(0)); });
  });
}
