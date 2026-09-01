// utils/generateOrderId.js
//
// Generates a unique order ID for each donation.
//
// Moneybag's checkout API requires `order_id` to be a string between 10 and
// 36 characters (see docs: https://developers.moneybag.com.bd/docs/payments/checkout).
// The format below ("DONATE-<timestamp>-<random>") comfortably fits that
// range and is unique enough for a low-volume donation page. For very high
// traffic you may want to back this with a database sequence instead.

const crypto = require("crypto");

function generateOrderId() {
  const timestamp = Date.now().toString(); // 13 digits today
  const random = crypto.randomBytes(4).toString("hex"); // 8 hex chars
  const orderId = `DONATE-${timestamp}-${random}`;

  // Defensive check against Moneybag's documented length constraint
  // (minLength 10, maxLength 36) — should never trigger with this format,
  // but fail loudly rather than send an invalid order_id.
  if (orderId.length < 10 || orderId.length > 36) {
    throw new Error(
      `Generated order_id "${orderId}" (${orderId.length} chars) is outside Moneybag's required 10–36 character range.`
    );
  }

  return orderId;
}

module.exports = { generateOrderId };
