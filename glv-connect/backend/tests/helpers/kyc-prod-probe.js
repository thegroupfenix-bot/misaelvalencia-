/**
 * Subprocess helper: starts the server with the environment provided by the
 * spawner, makes ONE POST /clients/kyc request, writes the result as JSON
 * to stdout, and exits.
 *
 * The spawner must set:
 *   NODE_ENV=production  DB_PATH=:memory:  JWT_SECRET=<32+chars>
 *   PII_ENCRYPTION_KEY=<value under test>
 *
 * stdout → JSON: { status: <http status code>, body: <parsed response> }
 * exit 0  → request completed (check stdout for status)
 * exit 1  → server refused to start (FATAL guard triggered — expected for some tests)
 * exit 2  → unexpected error
 */

"use strict";

const http = require("http");
const path = require("path");

let app;
try {
  app = require(path.join(__dirname, "../../server"));
} catch (err) {
  process.stderr.write("[probe] server require failed: " + err.message + "\n");
  process.exit(2);
}

const server = http.createServer(app);
server.listen(0, "127.0.0.1", () => {
  const port = server.address().port;
  const payload = JSON.stringify({
    glv_code: "GLV-PROBE-PROD-001",
    empresa:  "Probe Corp SA",
    email:    "probe@probetest.invalid",
    submission_type: "CLIENT",
  });
  const req = http.request({
    hostname: "127.0.0.1",
    port,
    path:   "/clients/kyc",
    method: "POST",
    headers: {
      "Content-Type":   "application/json",
      "Content-Length": Buffer.byteLength(payload),
    },
  }, (res) => {
    let body = "";
    res.on("data", (c) => { body += c; });
    res.on("end", () => {
      let parsed;
      try { parsed = JSON.parse(body); } catch { parsed = body; }
      process.stdout.write(JSON.stringify({ status: res.statusCode, body: parsed }));
      server.close(() => process.exit(0));
    });
  });
  req.on("error", (err) => {
    process.stderr.write("[probe] request error: " + err.message + "\n");
    server.close(() => process.exit(2));
  });
  req.write(payload);
  req.end();
});
server.on("error", (err) => {
  process.stderr.write("[probe] server error: " + err.message + "\n");
  process.exit(2);
});
