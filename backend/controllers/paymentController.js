// controllers/paymentController.js
//
// Request handlers for the donation payment flow. Business logic only —
// Moneybag API calls live in services/moneybagService.js, storage lives in
// utils/orderStore.js.

const { generateOrderId } = require("../utils/generateOrderId");
const { validateAmount, validateDonor, sanitizeText } = require("../utils/validators");
const moneybagService = require("../services/moneybagService");
const orderStore = require("../utils/orderStore");

const FRONTEND_URL = process.env.FRONTEND_URL;
const BACKEND_PUBLIC_URL = process.env.BACKEND_PUBLIC_URL;

/**
 * POST /api/create-payment
 *
 * Receives the donation amount + donor details from the frontend,
 * re-validates everything server-side, creates a Moneybag checkout
 * session, and returns only the checkout_url the browser needs to
 * redirect to. The merchant API key never leaves this function.
 */
async function createPayment(req, res) {
  try {
    const {
  amount,
  name,
  email,
  phone,
  city,
  country,
} = req.body || {};

    // 1. Re-validate the amount. NEVER trust the amount just because the
    //    frontend sent it — a malicious client could send any number.
    const amountCheck = validateAmount(amount);
    if (!amountCheck.valid) {
      return res.status(400).json({ success: false, error: amountCheck.error });
    }

    // 2. Re-validate donor details.
    const donor = {
      name: sanitizeText(name, 120),
      email: sanitizeText(email, 254),
      phone: sanitizeText(phone, 20),
      address: sanitizeText(address, 255),
      city: sanitizeText(city, 100),
      postcode: sanitizeText(postcode, 20),
      country: "Bangladesh",
    };
    const donorCheck = validateDonor(donor);
    if (!donorCheck.valid) {
      return res.status(400).json({ success: false, errors: donorCheck.errors });
    }

    // 3. Generate our own unique order ID (never accept one from the client).
    const orderId = generateOrderId();

    // 4. Create the checkout session with Moneybag from the backend.
    const checkout = await moneybagService.createCheckout({
      orderId,
      orderAmount: amountCheck.amount, // normalized "50.00" style string
      orderDescription: "Website Donation",
      customer: donor,
      successUrl: `${FRONTEND_URL}/success.html`,
      cancelUrl: `${FRONTEND_URL}/cancelled.html`,
      failUrl: `${FRONTEND_URL}/failed.html`,
      ipnUrl: `${BACKEND_PUBLIC_URL}/api/payment/ipn`,
    });

    // 5. Persist the order locally BEFORE redirecting the donor, so that
    //    verification/webhook handling has something to match against.
    orderStore.createOrder({
      orderId,
      amount: amountCheck.amount,
      donor,
      sessionId: checkout.sessionId,
    });

    // 6. Return ONLY what the frontend needs — never the merchant key,
    //    never internal Moneybag response fields beyond the checkout URL.
    return res.status(200).json({
      success: true,
      checkoutUrl: checkout.checkoutUrl,
      orderId,
    });
  } catch (error) {
    return handleMoneybagError(res, error, "Unable to start the payment process.");
  }
}

/**
 * GET /api/payment/verify/:transactionId
 *
 * Called by the success/failed page after Moneybag redirects the donor
 * back. This is the ONLY place a donation is considered confirmed — never
 * the presence of a redirect query parameter alone. Idempotent: refreshing
 * the success page repeatedly will not double-fulfill the order.
 *
 * The frontend also sends the order_id it has in local state (set right
 * before redirecting to Moneybag), since Moneybag's redirect query
 * parameters are not fully documented publicly — this lets us look the
 * order up locally either way. See README "Confirming redirect parameters".
 */
async function verifyTransaction(req, res) {
  try {
    const { transactionId } = req.params;
    const orderIdHint = req.query.orderId;

    if (!transactionId) {
      return res.status(400).json({ success: false, error: "Missing transaction ID." });
    }

    // Ask Moneybag directly — this is the authoritative check.
    const result = await moneybagService.verifyPayment(transactionId);

    const orderId = result.orderId || orderIdHint;
    const localOrder = orderId ? orderStore.getOrder(orderId) : null;

    if (!localOrder) {
      // We have no record of this order at all — never confirm a donation
      // we didn't originate, even if Moneybag says it's verified.
      return res.status(404).json({
        success: false,
        error: "No matching donation record found for this transaction.",
      });
    }

    // Defense in depth: confirm the amount Moneybag verified matches what
    // we originally created the checkout for.
    const amountMatches =
      !result.amount || Number(result.amount) === Number(localOrder.amount);

    const verified = Boolean(result.verified) && amountMatches;

    const updatedOrder = orderStore.markVerifiedOnce(orderId, {
      transactionId: result.transactionId || transactionId,
      status: result.status,
      verified,
    });

    return res.status(200).json({
      success: true,
      verified: updatedOrder.status === "VERIFIED_SUCCESS",
      status: updatedOrder.status,
      transactionId: updatedOrder.transactionId,
      orderId: updatedOrder.orderId,
      amount: updatedOrder.amount,
    });
  } catch (error) {
    return handleMoneybagError(res, error, "Unable to verify this transaction.");
  }
}

/**
 * POST /api/payment/ipn  (also mounted as /api/payment/webhook)
 *
 * Moneybag's server-to-server notification. Never trusted blindly:
 *  1. Verify the HMAC signature against the RAW request body.
 *  2. Re-verify the transaction against Moneybag's verify endpoint rather
 *     than trusting the webhook payload's own "status" field.
 *  3. Apply fulfillment idempotently (markVerifiedOnce is a no-op if the
 *     order was already fulfilled by the success-page verification call,
 *     or by an earlier, duplicate webhook delivery).
 */
async function handleWebhook(req, res) {
  try {
    const signature = req.headers["x-webhook-signature"];
    const timestamp = req.headers["x-webhook-timestamp"];
    const eventId = req.headers["x-webhook-event-id"];

    // req.rawBody is captured by the express.json({ verify }) hook in
    // server.js specifically so we can check the signature against the
    // exact bytes Moneybag sent, not a re-serialized copy.
    const rawBody = req.rawBody || "";

    const signatureValid = moneybagService.verifyWebhookSignature(
      rawBody,
      timestamp,
      signature
    );

    if (!signatureValid) {
      // eslint-disable-next-line no-console
      console.warn(`[webhook] Rejected event ${eventId || "(no id)"} — invalid signature.`);
      return res.status(401).json({ success: false, error: "Invalid webhook signature." });
    }

    const event = req.body || {};
    const orderId = event.order_id || event.data?.order_id;
    const transactionId = event.transaction_id || event.data?.transaction_id;

    if (!orderId || !transactionId) {
      return res.status(400).json({ success: false, error: "Malformed webhook payload." });
    }

    // Do not trust event.status from the webhook body — re-verify with
    // Moneybag's own verify endpoint before applying any fulfillment.
    const result = await moneybagService.verifyPayment(transactionId);
    const localOrder = orderStore.getOrder(orderId);

    if (!localOrder) {
      // Unknown order — acknowledge receipt (so Moneybag doesn't retry
      // forever) but do nothing, since we have nothing to reconcile it
      // against.
      return res.status(200).json({ success: true, note: "Unknown order_id, ignored." });
    }

    orderStore.markVerifiedOnce(orderId, {
      transactionId: result.transactionId || transactionId,
      status: result.status,
      verified: Boolean(result.verified),
    });

    // Always acknowledge with 200 once we've safely processed (or safely
    // ignored) the event, so Moneybag does not treat it as failed delivery.
    return res.status(200).json({ success: true });
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error("[webhook] Error handling webhook:", error.message);
    return res.status(500).json({ success: false, error: "Webhook processing error." });
  }
}

/**
 * Shared error handler: logs full detail server-side, but only ever
 * returns a generic message to the client — never Moneybag's raw internal
 * error body, which could contain sensitive or overly detailed info.
 */
function handleMoneybagError(res, error, publicMessage) {
  const status = error.response?.status;
  // eslint-disable-next-line no-console
  console.error(
    "[paymentController]",
    publicMessage,
    "-",
    error.message,
    status ? `(Moneybag responded ${status})` : "",
    error.moneybagResponse ? JSON.stringify(error.moneybagResponse) : ""
  );

  if (status === 422) {
    return res.status(400).json({
      success: false,
      error: "Some payment details were rejected by the payment gateway. Please check your information and try again.",
    });
  }

  return res.status(502).json({ success: false, error: publicMessage });
}

module.exports = {
  createPayment,
  verifyTransaction,
  handleWebhook,
};
