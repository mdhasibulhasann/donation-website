const API_BASE_URL = "https://donation-website-7qgp.onrender.com";

const form = document.getElementById("donationForm");

const amountButtons = document.querySelectorAll(".amount-btn");
const customAmountWrap = document.getElementById("customAmountWrap");
const customAmountInput = document.getElementById("customAmount");
const amountError = document.getElementById("amountError");

const amountPreview = document.getElementById("amountPreview");
const amountPreviewValue = document.getElementById("amountPreviewValue");

const fullNameInput = document.getElementById("fullName");
const emailInput = document.getElementById("email");
const phoneInput = document.getElementById("phone");
const cityInput = document.getElementById("city");
const countryInput = document.getElementById("country");

const formStatus = document.getElementById("formStatus");
const submitBtn = document.getElementById("submitBtn");
const submitLabel = submitBtn.querySelector(".submit-btn__label");

let selectedAmount = 0;


/* -----------------------------
   AMOUNT SELECTION
----------------------------- */

amountButtons.forEach((button) => {
  button.addEventListener("click", () => {
    amountButtons.forEach((btn) => {
      btn.classList.remove("is-selected");
    });

    button.classList.add("is-selected");

    clearAmountError();
    clearStatus();

    const value = button.dataset.amount;

    if (value === "custom") {
      selectedAmount = 0;

      customAmountWrap.hidden = false;
      amountPreview.hidden = true;

      customAmountInput.value = "";
      customAmountInput.focus();

      return;
    }

    selectedAmount = Number(value);

    customAmountWrap.hidden = true;
    customAmountInput.value = "";

    showAmountPreview();
  });
});


/* -----------------------------
   CUSTOM AMOUNT
----------------------------- */

customAmountInput.addEventListener("input", () => {
  clearAmountError();
  clearStatus();

  const value = Number(customAmountInput.value);

  if (!value || value <= 0) {
    selectedAmount = 0;
    amountPreview.hidden = true;
    return;
  }

  selectedAmount = value;

  showAmountPreview();
});


/* -----------------------------
   AMOUNT PREVIEW
----------------------------- */

function showAmountPreview() {
  if (!selectedAmount || selectedAmount <= 0) {
    amountPreview.hidden = true;
    return;
  }

  amountPreviewValue.textContent =
    `৳${formatAmount(selectedAmount)}`;

  amountPreview.hidden = false;
}


function formatAmount(amount) {
  return new Intl.NumberFormat("en-BD", {
    maximumFractionDigits: 2
  }).format(amount);
}


/* -----------------------------
   ERROR HELPERS
----------------------------- */

function showAmountError(message) {
  amountError.textContent = message;
}


function clearAmountError() {
  amountError.textContent = "";
}


function showStatus(message, type = "error") {
  formStatus.textContent = message;

  if (type === "success") {
    formStatus.style.color = "#1976c9";
    formStatus.style.background = "#eef8ff";
  } else {
    formStatus.style.color = "#df3f4d";
    formStatus.style.background = "#fff3f4";
  }
}


function clearStatus() {
  formStatus.textContent = "";
  formStatus.removeAttribute("style");
}


/* -----------------------------
   VALIDATION
----------------------------- */

function validateForm() {
  clearAmountError();
  clearStatus();

  if (!selectedAmount || selectedAmount < 10) {
    showAmountError(
      "Please select a donation amount of at least ৳10."
    );

    return false;
  }


  const fullName = fullNameInput.value.trim();

  if (!fullName || fullName.length < 2) {
    showStatus("Please enter your full name.");
    fullNameInput.focus();

    return false;
  }


  const email = emailInput.value.trim();

  const emailPattern =
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  if (!emailPattern.test(email)) {
    showStatus("Please enter a valid email address.");
    emailInput.focus();

    return false;
  }


  const phone = phoneInput.value.trim();

  const cleanedPhone =
    phone.replace(/[\s\-()+]/g, "");

  const phonePattern =
    /^(?:88)?01[3-9]\d{8}$/;


  if (!phonePattern.test(cleanedPhone)) {
    showStatus(
      "Please enter a valid Bangladesh mobile number."
    );

    phoneInput.focus();

    return false;
  }


  const city = cityInput.value.trim();

  if (!city) {
    showStatus("Please enter your city.");
    cityInput.focus();

    return false;
  }


  if (!countryInput.value.trim()) {
    showStatus("Please enter your country.");
    countryInput.focus();

    return false;
  }


  return true;
}


/* -----------------------------
   CLEAR ERRORS WHILE TYPING
----------------------------- */

[
  fullNameInput,
  emailInput,
  phoneInput,
  cityInput,
  countryInput
].forEach((input) => {
  input.addEventListener("input", () => {
    clearStatus();
  });
});


/* -----------------------------
   LOADING BUTTON
----------------------------- */

function setLoading(loading) {
  submitBtn.disabled = loading;

  if (loading) {
    submitBtn.classList.add("is-loading");

    submitLabel.textContent =
      "Connecting to Moneybag...";
  } else {
    submitBtn.classList.remove("is-loading");

    submitLabel.textContent =
      "Proceed to Payment";
  }
}


/* -----------------------------
   CREATE PAYMENT
----------------------------- */

form.addEventListener("submit", async (event) => {
  event.preventDefault();


  if (!validateForm()) {
    return;
  }


  const payload = {

    amount: Number(selectedAmount),

    name: fullNameInput.value.trim(),

    email: emailInput.value.trim(),

    phone: phoneInput.value.trim(),

    city: cityInput.value.trim(),

    country: countryInput.value.trim()

  };


  setLoading(true);
  clearStatus();


  try {

    const response = await fetch(
      `${API_BASE_URL}/api/create-payment`,
      {
        method: "POST",

        headers: {
          "Content-Type": "application/json"
        },

        body: JSON.stringify(payload)
      }
    );


    let data;


    try {

      data = await response.json();

    } catch {

      throw new Error(
        "The payment server returned an invalid response."
      );

    }


    if (!response.ok || !data.success) {

      showStatus(
        data?.error ||
        "Unable to start payment. Please try again."
      );

      setLoading(false);

      return;
    }


    if (!data.checkoutUrl) {

      showStatus(
        "Moneybag checkout URL was not received."
      );

      setLoading(false);

      return;
    }


    /*
      Save order ID for success page verification
    */

    if (data.orderId) {

      sessionStorage.setItem(
        "donation_order_id",
        data.orderId
      );

    }


    showStatus(
      "Redirecting to secure payment...",
      "success"
    );


    /*
      Send donor to Moneybag
    */

    window.location.href =
      data.checkoutUrl;


  } catch (error) {

    console.error(
      "Payment request error:",
      error
    );


    showStatus(
      "Could not connect to the payment server. Please try again."
    );


    setLoading(false);

  }

});
