// utils/validators.js
//
// Server-side validation. The frontend also validates, but the backend must
// never trust the frontend — this is the real gate before we talk to
// Moneybag.

// Moneybag's checkout API documents order_amount as "between 10.00 and
// 1000000.00 BDT" (see docs: /docs/payments/checkout). Keep these in one
// place so the preset amounts and custom-amount validation always agree.
const MIN_DONATION_BDT = 10;
const MAX_DONATION_BDT = 1000000;

// Bangladeshi mobile numbers: 017XXXXXXXX / 013.../015.../016.../018.../019...
// (11 digits starting with 01), optionally written with a +88 country code.
const BD_PHONE_REGEX = /^(?:\+?88)?01[3-9]\d{8}$/;

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function validateAmount(rawAmount) {
  const amount = Number(rawAmount);

  if (rawAmount === undefined || rawAmount === null || rawAmount === "") {
    return { valid: false, error: "Donation amount is required." };
  }
  if (!Number.isFinite(amount)) {
    return { valid: false, error: "Donation amount must be a valid number." };
  }
  if (amount < MIN_DONATION_BDT) {
    return {
      valid: false,
      error: `Donation amount must be at least ৳${MIN_DONATION_BDT}.`,
    };
  }
  if (amount > MAX_DONATION_BDT) {
    return {
      valid: false,
      error: `Donation amount cannot exceed ৳${MAX_DONATION_BDT.toLocaleString(
        "en-US"
      )}.`,
    };
  }
  // Moneybag expects order_amount formatted as a decimal string like
  // "1280.00" — normalize to 2 decimal places here.
  return { valid: true, amount: amount.toFixed(2) };
}

function validateDonor(donor = {}) {
  const errors = {};
  const { name, email, phone, address, city, postcode } = donor;

  if (!name || !name.trim()) {
    errors.name = "Full name is required.";
  } else if (name.trim().length > 120) {
    errors.name = "Full name is too long.";
  }

  if (!email || !EMAIL_REGEX.test(email.trim())) {
    errors.email = "A valid email address is required.";
  }

  if (!phone || !BD_PHONE_REGEX.test(phone.trim())) {
    errors.phone =
      "Enter a valid Bangladeshi phone number (e.g. 017XXXXXXXX or +88017XXXXXXXX).";
  }

  if (!address || !address.trim()) {
    errors.address = "Address is required.";
  }

  if (!city || !city.trim()) {
    errors.city = "City is required.";
  }

  if (!postcode || !postcode.trim()) {
    errors.postcode = "Postcode is required.";
  }

  const valid = Object.keys(errors).length === 0;
  return { valid, errors };
}

// Basic string sanitization: trims whitespace and strips characters that
// have no business being in a name/address field, without being so
// aggressive that it mangles legitimate input (e.g. apostrophes in names).
function sanitizeText(value, maxLength = 255) {
  if (typeof value !== "string") return "";
  return value
    .trim()
    .replace(/[<>]/g, "") // strip angle brackets to reduce injection surface
    .slice(0, maxLength);
}

module.exports = {
  MIN_DONATION_BDT,
  MAX_DONATION_BDT,
  BD_PHONE_REGEX,
  EMAIL_REGEX,
  validateAmount,
  validateDonor,
  sanitizeText,
};
