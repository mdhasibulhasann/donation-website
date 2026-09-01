// ===============================
// DONATION WEBSITE - script.js
// ===============================

const API_BASE_URL = "https://donation-website-7qgp.onrender.com";

const form = document.getElementById("donationForm");

const amountButtons = document.querySelectorAll(".amount-btn");
const amountPreview = document.getElementById("amountPreview");
const amountPreviewValue = document.getElementById("amountPreviewValue");

const customAmountWrap = document.getElementById("customAmountWrap");
const customAmountInput = document.getElementById("customAmount");

const amountError = document.getElementById("amountError");

const submitBtn = document.getElementById("submitBtn");
const formStatus = document.getElementById("formStatus");

let currentAmount = 0;
let selectedAmountType = null;


// ===============================
// SELECT AMOUNT
// ===============================

amountButtons.forEach((button) => {
  button.addEventListener("click", () => {
    clearAmountError();

    amountButtons.forEach((btn) => {
      btn.classList.remove("is-selected");
      btn.setAttribute("aria-checked", "false");
    });

    button.classList.add("is-selected");
    button.setAttribute("aria-checked", "true");

    const amountValue = button.dataset.amount;

    if (amountValue === "custom") {
      selectedAmountType = "custom";

      currentAmount = 0;

      customAmountWrap.hidden = false;
      amountPreview.hidden = true;

      customAmountInput.focus();

      return;
    }

    selectedAmountType = "preset";

    customAmountWrap.hidden = true;

    customAmountInput.value = "";

    currentAmount = Number(amountValue);

    updateAmountPreview();
  });
});


// ===============================
// CUSTOM AMOUNT
// ===============================

customAmountInput.addEventListener("input", () => {
  clearAmountError();

  const value = Number(customAmountInput.value);

  if (!value || value <= 0) {
    currentAmount = 0;
    amountPreview.hidden = true;
    return;
  }

  currentAmount = value;

  updateAmountPreview();
});


// ===============================
// AMOUNT PREVIEW
// ===============================

function updateAmountPreview() {
  if (!currentAmount || currentAmount <= 0) {
    amountPreview.hidden = true;
    return;
  }

  amountPreviewValue.textContent = `৳${formatAmount(currentAmount)}`;

  amountPreview.hidden = false;
}


function formatAmount(amount) {
  return new Intl.NumberFormat("en-BD", {
    maximumFractionDigits: 2,
  }).format(amount);
}


// ===============================
// FIELD HELPERS
// ===============================

function getField(id) {
  return document.getElementById(id);
}


function getErrorElement(fieldName) {
  return document.querySelector(
    `[data-error-for="${fieldName}"]`
  );
}


function setFieldError(fieldName, message) {
  const field = getField(fieldName);
  const error = getErrorElement(fieldName);

  if (field) {
    field.setAttribute("aria-invalid", "true");
  }

  if (error) {
    error.textContent = message;
    error.hidden = false;
  }
}


function clearFieldError(fieldName) {
  const field = getField(fieldName);
  const error = getErrorElement(fieldName);

  if (field) {
    field.removeAttribute("aria-invalid");
  }

  if (error) {
    error.textContent = "";
    error.hidden = true;
  }
}


function clearAllFieldErrors() {
  [
    "fullName",
    "email",
    "phone",
    "city",
  ].forEach(clearFieldError);
}


// ===============================
// AMOUNT ERROR
// ===============================

function setAmountError(message) {
  amountError.textContent = message;
  amountError.hidden = false;
}


function clearAmountError() {
  amountError.textContent = "";
  amountError.hidden = true;
}


// ===============================
// VALIDATION
// ===============================

function validateForm() {
  let isValid = true;

  clearAllFieldErrors();
  clearAmountError();
  clearFormStatus();

  // Amount
  if (!currentAmount || currentAmount < 10) {
    setAmountError(
      "Please select a donation amount of at least ৳10."
    );

    isValid = false;
  }

  // Full name
  const fullName = getField("fullName").value.trim();

  if (!fullName) {
    setFieldError(
      "fullName",
      "Please enter your full name."
    );

    isValid = false;
  } else if (fullName.length < 2) {
    setFieldError(
      "fullName",
      "Please enter a valid name."
    );

    isValid = false;
  }

  // Email
  const email = getField("email").value.trim();

  const emailPattern =
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  if (!email) {
    setFieldError(
      "email",
      "Please enter your email."
    );

    isValid = false;
  } else if (!emailPattern.test(email)) {
    setFieldError(
      "email",
      "Please enter a valid email address."
    );

    isValid = false;
  }

  // Phone
  const phone = getField("phone").value.trim();

  const cleanedPhone =
    phone.replace(/[\s\-()+]/g, "");

  const bangladeshPhonePattern =
    /^(?:88)?01[3-9]\d{8}$/;

  if (!phone) {
    setFieldError(
      "phone",
      "Please enter your phone number."
    );

    isValid = false;
  } else if (
    !bangladeshPhonePattern.test(cleanedPhone)
  ) {
    setFieldError(
      "phone",
      "Enter a valid Bangladesh mobile number."
    );

    isValid = false;
  }

  // City
  const city = getField("city").value.trim();

  if (!city) {
    setFieldError(
      "city",
      "Please enter your city."
    );

    isValid = false;
  }

  return isValid;
}


// ===============================
// REMOVE ERROR WHILE TYPING
// ===============================

[
  "fullName",
  "email",
  "phone",
  "city",
].forEach((fieldName) => {
  const field = getField(fieldName);

  field.addEventListener("input", () => {
    clearFieldError(fieldName);
    clearFormStatus();
  });
});


// ===============================
// FORM STATUS
// ===============================

function showFormStatus(message, type = "error") {
  formStatus.textContent = message;

  formStatus.dataset.tone = type;

  formStatus.hidden = false;
}


function clearFormStatus() {
  formStatus.textContent = "";

  formStatus.removeAttribute("data-tone");

  formStatus.hidden = true;
}


// ===============================
// LOADING BUTTON
// ===============================

function setLoading(isLoading) {
  submitBtn.disabled = isLoading;

  if (isLoading) {
    submitBtn.classList.add("is-loading");

    const label =
      submitBtn.querySelector(
        ".submit-btn__label"
      );

    if (label) {
      label.textContent =
        "Connecting to Moneybag...";
    }

    return;
  }

  submitBtn.classList.remove("is-loading");

  const label =
    submitBtn.querySelector(
      ".submit-btn__label"
    );

  if (label) {
    label.textContent =
      "Proceed to Payment";
  }
}


// ===============================
// SUBMIT DONATION
// ===============================

form.addEventListener("submit", async (event) => {
  event.preventDefault();

  if (!validateForm()) {
    showFormStatus(
      "Please check the information above.",
      "error"
    );

    return;
  }

  const payload = {
    amount: Number(currentAmount),

    name:
      getField("fullName").value.trim(),

    email:
      getField("email").value.trim(),

    phone:
      getField("phone").value.trim(),

    city:
      getField("city").value.trim(),

    country:
      getField("country").value.trim(),
  };

  setLoading(true);
  clearFormStatus();

  try {
    const response = await fetch(
      `${API_BASE_URL}/api/create-payment`,
      {
        method: "POST",

        headers: {
          "Content-Type": "application/json",
        },

        body: JSON.stringify(payload),
      }
    );


    let data;

    try {
      data = await response.json();
    } catch {
      throw new Error(
        "The server returned an invalid response."
      );
    }


    if (!response.ok || !data.success) {
      const errorMessage =
        data?.error ||
        "Unable to start payment. Please try again.";

      showFormStatus(
        errorMessage,
        "error"
      );

      setLoading(false);

      return;
    }


    if (!data.checkoutUrl) {
      showFormStatus(
        "Moneybag checkout URL was not received.",
        "error"
      );

      setLoading(false);

      return;
    }


    if (data.orderId) {
      sessionStorage.setItem(
        "donation_order_id",
        data.orderId
      );
    }


    showFormStatus(
      "Redirecting to secure payment...",
      "success"
    );


    window.location.href =
      data.checkoutUrl;

  } catch (error) {
    console.error(
      "Payment request error:",
      error
    );

    showFormStatus(
      "Could not connect to the payment server. Please try again.",
      "error"
    );

    setLoading(false);
  }
});
