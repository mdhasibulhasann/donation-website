// script.js
//
// Handles the donation form: amount selection, client-side validation
// (a convenience for the donor — the backend re-validates everything),
// and submitting to OUR OWN backend, never to Moneybag directly.

// -----------------------------------------------------------------------
// Configuration
// -----------------------------------------------------------------------
// Point this at your backend. In local development that's
// http://localhost:5000; after deployment, change it to your deployed
// backend's public HTTPS URL (see README "Deployment").
const API_BASE_URL = "https://donation-website-7qgp.onrender.com";

const MIN_AMOUNT = 10;
const MAX_AMOUNT = 1000000;
const BD_PHONE_REGEX = /^(?:\+?88)?01[3-9]\d{8}$/;

// -----------------------------------------------------------------------
// Elements
// -----------------------------------------------------------------------
const form = document.getElementById("donationForm");
const amountGrid = document.getElementById("amountGrid");
const amountButtons = Array.from(amountGrid.querySelectorAll(".amount-btn"));
const customAmountWrap = document.getElementById("customAmountWrap");
const customAmountInput = document.getElementById("customAmount");
const amountError = document.getElementById("amountError");
const amountPreview = document.getElementById("amountPreview");
const amountPreviewValue = document.getElementById("amountPreviewValue");
const formStatus = document.getElementById("formStatus");
const submitBtn = document.getElementById("submitBtn");

let selectedAmountOption = null; // "10" | "20" | "50" | "custom"
let currentAmount = null; // resolved numeric amount

// -----------------------------------------------------------------------
// Amount selection
// -----------------------------------------------------------------------
amountButtons.forEach((btn) => {
  btn.addEventListener("click", () => {
    selectAmountOption(btn.dataset.amount);
  });
});

function selectAmountOption(option) {
  selectedAmountOption = option;

  amountButtons.forEach((btn) => {
    const isSelected = btn.dataset.amount === option;
    btn.classList.toggle("is-selected", isSelected);
    btn.setAttribute("aria-checked", String(isSelected));
  });

  if (option === "custom") {
    customAmountWrap.hidden = false;
    customAmountInput.focus();
    currentAmount = parseAmount(customAmountInput.value);
  } else {
    customAmountWrap.hidden = true;
    currentAmount = Number(option);
  }

  hideAmountError();
  updateAmountPreview();
}

customAmountInput.addEventListener("input", () => {
  currentAmount = parseAmount(customAmountInput.value);
  hideAmountError();
  updateAmountPreview();
});

function parseAmount(rawValue) {
  if (rawValue === "" || rawValue === null || rawValue === undefined) return null;
  const num = Number(rawValue);
  return Number.isFinite(num) ? num : null;
}

function updateAmountPreview() {
  if (currentAmount && currentAmount > 0) {
    amountPreview.hidden = false;
    amountPreviewValue.textContent = `৳${formatAmount(currentAmount)}`;
  } else {
    amountPreview.hidden = true;
  }
}

function formatAmount(amount) {
  return Number(amount).toLocaleString("en-US", {
    maximumFractionDigits: 2,
  });
}

function showAmountError(message) {
  amountError.textContent = message;
  amountError.hidden = false;
}

function hideAmountError() {
  amountError.hidden = true;
  amountError.textContent = "";
}

function validateAmountSelection() {
  if (!selectedAmountOption) {
    showAmountError("Please choose a donation amount.");
    return false;
  }

  if (currentAmount === null || Number.isNaN(currentAmount)) {
    showAmountError("Please enter a valid amount.");
    return false;
  }

  if (currentAmount <= 0) {
    showAmountError("Donation amount must be greater than zero.");
    return false;
  }

  if (currentAmount < MIN_AMOUNT) {
    showAmountError(`Minimum donation amount is ৳${MIN_AMOUNT}.`);
    return false;
  }

  if (currentAmount > MAX_AMOUNT) {
    showAmountError(`Maximum donation amount is ৳${formatAmount(MAX_AMOUNT)}.`);
    return false;
  }

  hideAmountError();
  return true;
}

// -----------------------------------------------------------------------
// Donor field validation
// -----------------------------------------------------------------------
const fieldValidators = {
  fullName: (value) => (value.trim().length > 0 ? null : "Full name is required."),
  email: (value) =>
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim()) ? null : "Enter a valid email address.",
  phone: (value) =>
    BD_PHONE_REGEX.test(value.trim())
      ? null
      : "Enter a valid Bangladeshi number, e.g. 017XXXXXXXX or +88017XXXXXXXX.",
  address: (value) => (value.trim().length > 0 ? null : "Address is required."),
  city: (value) => (value.trim().length > 0 ? null : "City is required."),
  postcode: (value) => (value.trim().length > 0 ? null : "Postcode is required."),
};

function validateDonorFields() {
  let allValid = true;

  Object.keys(fieldValidators).forEach((fieldName) => {
    const input = document.getElementById(fieldName);
    const errorEl = form.querySelector(`[data-error-for="${fieldName}"]`);
    const message = fieldValidators[fieldName](input.value);

    if (message) {
      allValid = false;
      input.setAttribute("aria-invalid", "true");
      if (errorEl) {
        errorEl.textContent = message;
        errorEl.hidden = false;
      }
    } else {
      input.removeAttribute("aria-invalid");
      if (errorEl) {
        errorEl.hidden = true;
        errorEl.textContent = "";
      }
    }
  });

  return allValid;
}

// Clear a field's error as soon as the donor starts fixing it
Object.keys(fieldValidators).forEach((fieldName) => {
  const input = document.getElementById(fieldName);
  input.addEventListener("input", () => {
    const message = fieldValidators[fieldName](input.value);
    const errorEl = form.querySelector(`[data-error-for="${fieldName}"]`);
    if (!message) {
      input.removeAttribute("aria-invalid");
      if (errorEl) errorEl.hidden = true;
    }
  });
});

// -----------------------------------------------------------------------
// Form status helper
// -----------------------------------------------------------------------
function setFormStatus(message, tone) {
  if (!message) {
    formStatus.hidden = true;
    formStatus.removeAttribute("data-tone");
    return;
  }
  formStatus.textContent = message;
  formStatus.dataset.tone = tone || "info";
  formStatus.hidden = false;
}

function setLoading(isLoading) {
  submitBtn.disabled = isLoading;
  submitBtn.classList.toggle("is-loading", isLoading);
  submitBtn.querySelector(".submit-btn__label").textContent = isLoading
    ? "Preparing secure payment…"
    : "Proceed to Payment";
}

// -----------------------------------------------------------------------
// Submission
// -----------------------------------------------------------------------
form.addEventListener("submit", async (event) => {
  event.preventDefault();
  setFormStatus(null);

  const amountValid = validateAmountSelection();
  const donorValid = validateDonorFields();

  if (!amountValid) {
    amountGrid.scrollIntoView({ behavior: "smooth", block: "center" });
    return;
  }
  if (!donorValid) {
    setFormStatus("Please fix the highlighted fields before continuing.", "error");
    return;
  }

  const payload = {
    amount: currentAmount,
    name: document.getElementById("fullName").value.trim(),
    email: document.getElementById("email").value.trim(),
    phone: document.getElementById("phone").value.trim(),
    address: document.getElementById("address").value.trim(),
    city: document.getElementById("city").value.trim(),
    postcode: document.getElementById("postcode").value.trim(),
  };

  setLoading(true);

  
try {
  const response = await fetch(`${API_BASE_URL}/api/create-payment`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  const data = await response.json();

  if (!response.ok || !data.success) {
    const message =
      data.error ||
      (data.errors && Object.values(data.errors)[0]) ||
      "Something went wrong starting your payment. Please try again.";

    setFormStatus(message, "error");
    setLoading(false);
    return;
  }

  sessionStorage.setItem("donation_order_id", data.orderId);

  window.location.href = data.checkoutUrl;
} catch (error) {
  console.error("Payment request failed:", error);
  setFormStatus(
    "Network error. Please check your connection and try again.",
    "error"
  );
  setLoading(false);
}
});
