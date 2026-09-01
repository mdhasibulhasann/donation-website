// server.js
//
// Entry point for the donation website backend.

require("dotenv").config();

const express = require("express");
const cors = require("cors");
const paymentRoutes = require("./routes/paymentRoutes");

// Fail fast if critical secrets are missing, rather than starting a server
// that will silently misbehave.
const REQUIRED_ENV_VARS = [
  "MONEYBAG_BASE_URL",
  "MONEYBAG_MERCHANT_API_KEY",
  "FRONTEND_URL",
  "BACKEND_PUBLIC_URL",
];
const missing = REQUIRED_ENV_VARS.filter((key) => !process.env[key]);
if (missing.length > 0) {
  // eslint-disable-next-line no-console
  console.error(
    `Missing required environment variables: ${missing.join(", ")}\n` +
      "Copy backend/.env.example to backend/.env and fill in real values before starting the server."
  );
  process.exit(1);
}

const app = express();
const PORT = process.env.PORT || 5000;

// -----------------------------------------------------------------------
// CORS — only allow the configured frontend origin, not "*". A donation
// form submits sensitive personal + payment intent data, so we don't want
// arbitrary origins calling this API from a browser.
// -----------------------------------------------------------------------
app.use(
  cors({
    origin: new URL(process.env.FRONTEND_URL).origin,
    methods: ["GET", "POST"],
  })
);

// -----------------------------------------------------------------------
// Body parsing. For the webhook route we also need the RAW request body to
// verify Moneybag's HMAC signature, so we capture it via `verify` before
// JSON parsing discards the original bytes.
// -----------------------------------------------------------------------
app.use(
  express.json({
    limit: "100kb",
    verify: (req, _res, buf) => {
      req.rawBody = buf.toString("utf8");
    },
  })
);

// -----------------------------------------------------------------------
// Routes
// -----------------------------------------------------------------------
app.get("/health", (_req, res) => {
  res.status(200).json({ status: "ok" });
});

app.use("/api", paymentRoutes);

// 404 handler
app.use((req, res) => {
  res.status(404).json({ success: false, error: "Not found." });
});

// Generic error handler — never leak internal error details to clients.
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, _next) => {
  // eslint-disable-next-line no-console
  console.error("[server] Unhandled error:", err);
  res.status(500).json({ success: false, error: "Internal server error." });
});

app.listen(PORT, () => {
  // eslint-disable-next-line no-console
  console.log(`Donation backend listening on http://localhost:${PORT}`);
  // eslint-disable-next-line no-console
  console.log(`Moneybag base URL: ${process.env.MONEYBAG_BASE_URL}`);
});
