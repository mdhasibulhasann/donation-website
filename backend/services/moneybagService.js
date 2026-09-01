// services/moneybagService.js
//
// All direct communication with the Moneybag API lives here, and ONLY here.
// The merchant API key is read from process.env and never leaves this
// process — it is never sent to the frontend, never logged, and never
// included in error responses returned to the browser.
//
// Reference (verified against Moneybag's public developer docs,
// https://developers.moneybag.com.bd/docs, "Public OpenAPI 2.0.0", Aug 2026):
//   POST {MONEYBAG_BASE_URL}/payments/checkout
//   GET  {MONEYBAG_BASE_URL}/payments/verify/{transaction_id}
// Auth header: X-Merchant-API-Key
//
// If Moneybag's live documentation ever differs from what's implemented
// here, treat their current docs as the source of truth and update this
// file accordingly — do not guess at undocumented fields.

const axios = require("axios");
const crypto = require("crypto");

const MONEYBAG_BASE_URL = process.env.MONEYBAG_BASE_URL;
const MONEYBAG_MERCHANT_API_KEY = process.env.MONEYBAG_MERCHANT_API_KEY;
const MONEYBAG_WEBHOOK_SECRET = process.env.MONEYBAG_WEBHOOK_SECRET;

if (!MONEYBAG_BASE_URL || !MONEYBAG_MERCHANT_API_KEY) {
  // Fail closed and loud at startup rather than silently making
  // unauthenticated/broken requests later.
  // eslint-disable-next-line no-console
  console.error(
    "[moneybagService] MONEYBAG_BASE_URL and MONEYBAG_MERCHANT_API_KEY must be set in .env. See backend/.env.example."
  );
}

const moneybagClient = axios.create({
  baseURL: MONEYBAG_BASE_URL,
  timeout: 15000,
  headers: {
    "Content-Type": "application/json",
    "X-Merchant-API-Key": MONEYBAG_MERCHANT_API_KEY,
  },
});

/**
 * Creates a hosted checkout session with Moneybag.
 *
 * @param {Object} params
 * @param {string} params.orderId - Unique order ID (10–36 chars).
 * @param {string} params.orderAmount - Decimal string, e.g. "50.00".
 * @param {string} params.orderDescription
 * @param {Object} params.customer - { name, email, phone, address, city, postcode, country }
 * @param {string} params.successUrl
 * @param {string} params.cancelUrl
 * @param {string} params.failUrl
 * @param {string} [params.ipnUrl]
 * @returns {Promise<{checkoutUrl: string, sessionId: string, expiresAt: string}>}
 */
async function createCheckout({
  orderId,
  orderAmount,
  orderDescription,
  customer,
  successUrl,
  cancelUrl,
  failUrl,
  ipnUrl,
}) {
  const payload = {
    order_id: orderId,
    order_amount: orderAmount,
    currency: "BDT",
    order_description: orderDescription,
    success_url: successUrl,
    cancel_url: cancelUrl,
    fail_url: failUrl,
    customer: {
  name: customer.name,
  email: customer.email,
  phone: customer.phone,
  city: customer.city,
  country: customer.country || "Bangladesh",
},
  };

  if (ipnUrl) {
    payload.ipn_url = ipnUrl;
  }

  const response = await moneybagClient.post("/payments/checkout", payload);

  // Moneybag wraps responses as { success, data, message, meta }.
  const body = response.data;
  const data = body && body.data;

  if (!body || !body.success || !data || !data.checkout_url) {
    const err = new Error("Moneybag did not return a valid checkout session.");
    err.moneybagResponse = body;
    throw err;
  }

  return {
    checkoutUrl: data.checkout_url,
    sessionId: data.session_id,
    expiresAt: data.expires_at,
  };
}

/**
 * Verifies a transaction's authoritative state with Moneybag.
 * This is the ONLY source of truth for whether a donation succeeded —
 * redirect query parameters from the browser are never trusted alone.
 *
 * @param {string} transactionId
 * @returns {Promise<Object>} Normalized verification result.
 */
async function verifyPayment(transactionId) {
  const response = await moneybagClient.get(
    `/payments/verify/${encodeURIComponent(transactionId)}`
  );

  const body = response.data;
  const data = body && body.data;

  if (!body || !body.success || !data) {
    const err = new Error("Moneybag could not verify this transaction.");
    err.moneybagResponse = body;
    throw err;
  }

  return {
    verified: Boolean(data.verified),
    status: data.status, // e.g. "SUCCESS" / "FAILED" / "PENDING" (see Moneybag docs for exact values)
    transactionId: data.transaction_id,
    orderId: data.order_id,
    amount: data.amount,
    currency: data.currency,
    paymentMethod: data.payment_method,
    paymentReferenceId: data.payment_reference_id,
    customer: data.customer,
  };
}

/**
 * Verifies the HMAC-SHA256 signature Moneybag attaches to webhook/IPN
 * deliveries.
 *
 * Per Moneybag's docs (https://developers.moneybag.com.bd/docs/webhooks):
 *   - Signed message = `${timestamp}.${rawBody}`
 *   - Header "X-Webhook-Signature": "sha256=<hex digest>"
 *   - Header "X-Webhook-Timestamp": unix timestamp
 * Verification MUST run against the raw, unmodified request body — not the
 * parsed/re-serialized JSON, since re-serialization can change byte-for-byte
 * content (key order, spacing) and break the signature check.
 *
 * @param {Buffer|string} rawBody - The exact raw request body Moneybag sent.
 * @param {string} timestampHeader - Value of "X-Webhook-Timestamp".
 * @param {string} signatureHeader - Value of "X-Webhook-Signature", e.g. "sha256=abcd...".
 * @returns {boolean}
 */
function verifyWebhookSignature(rawBody, timestampHeader, signatureHeader) {
  if (!MONEYBAG_WEBHOOK_SECRET) {
    // eslint-disable-next-line no-console
    console.error(
      "[moneybagService] MONEYBAG_WEBHOOK_SECRET is not configured — refusing to accept webhook."
    );
    return false;
  }
  if (!timestampHeader || !signatureHeader) return false;

  const receivedSignature = signatureHeader.startsWith("sha256=")
    ? signatureHeader.slice("sha256=".length)
    : signatureHeader;

  const bodyString = Buffer.isBuffer(rawBody) ? rawBody.toString("utf8") : rawBody;
  const signedMessage = `${timestampHeader}.${bodyString}`;

  const expectedSignature = crypto
    .createHmac("sha256", MONEYBAG_WEBHOOK_SECRET)
    .update(signedMessage)
    .digest("hex");

  const expectedBuf = Buffer.from(expectedSignature, "utf8");
  const receivedBuf = Buffer.from(receivedSignature, "utf8");

  // Constant-time comparison to avoid leaking timing information.
  if (expectedBuf.length !== receivedBuf.length) return false;
  return crypto.timingSafeEqual(expectedBuf, receivedBuf);
}

module.exports = {
  createCheckout,
  verifyPayment,
  verifyWebhookSignature,
};
