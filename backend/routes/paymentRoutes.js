// routes/paymentRoutes.js

const express = require("express");
const rateLimit = require("express-rate-limit");
const paymentController = require("../controllers/paymentController");

const router = express.Router();

// Basic rate limiting on the payment-creation endpoint to reduce abuse /
// accidental duplicate-submission storms. Tune for your real traffic.
const createPaymentLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 10, // 10 checkout attempts per IP per minute
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: "Too many payment attempts. Please wait a moment and try again." },
});

// Creates a Moneybag checkout session for a donation.
router.post("/create-payment", createPaymentLimiter, paymentController.createPayment);

// Verifies a transaction's real status directly with Moneybag.
// Called by success.html / failed.html after the donor is redirected back.
router.get("/payment/verify/:transactionId", paymentController.verifyTransaction);

// Moneybag server-to-server payment notification (IPN/webhook).
// Both paths point at the same handler so either naming convention works.
router.post("/payment/ipn", paymentController.handleWebhook);
router.post("/payment/webhook", paymentController.handleWebhook);

module.exports = router;
