// utils/validators.js

const MIN_DONATION_BDT = 10;
const MAX_DONATION_BDT = 1000000;

const BD_PHONE_REGEX = /^(?:\+?88)?01[3-9]\d{8}$/;
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function validateAmount(rawAmount) {
  const amount = Number(rawAmount);

  if (
    rawAmount === undefined ||
    rawAmount === null ||
    rawAmount === ""
  ) {
    return {
      valid: false,
      error: "Donation amount is required.",
    };
  }

  if (!Number.isFinite(amount)) {
    return {
      valid: false,
      error: "Donation amount must be a valid number.",
    };
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

  return {
    valid: true,
    amount: amount.toFixed(2),
  };
}


function validateDonor(donor = {}) {
  const errors = {};

  const {
    name,
    email,
    phone,
    city,
    country,
  } = donor;


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
      "Enter a valid Bangladeshi phone number.";
  }


  if (!city || !city.trim()) {
    errors.city = "City is required.";
  }


  if (!country || !country.trim()) {
    errors.country = "Country is required.";
  }


  const valid = Object.keys(errors).length === 0;

  return {
    valid,
    errors,
  };
}


function sanitizeText(value, maxLength = 255) {
  if (typeof value !== "string") {
    return "";
  }

  return value
    .trim()
    .replace(/[<>]/g, "")
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
