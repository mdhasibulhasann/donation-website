const API_BASE_URL =
  "https://donation-website-7qgp.onrender.com/api";


const verificationBox =
  document.querySelector(".verification-box");

const verificationText =
  document.getElementById("verificationText");

const verificationDot =
  document.getElementById("verificationDot");

const loaderLine =
  document.getElementById("loaderLine");

const paymentStatus =
  document.getElementById("paymentStatus");

const paymentAmount =
  document.getElementById("paymentAmount");

const transactionIdElement =
  document.getElementById("transactionId");

const orderIdElement =
  document.getElementById("orderId");


function getUrlValue(names) {

  const params =
    new URLSearchParams(
      window.location.search
    );

  for (const name of names) {

    const value =
      params.get(name);

    if (value) {
      return value;
    }

  }

  return null;
}


const transactionId =
  getUrlValue([
    "transaction_id",
    "transactionId",
    "txn_id",
    "trx_id"
  ]);


const urlOrderId =
  getUrlValue([
    "order_id",
    "orderId"
  ]);


const storedOrderId =
  sessionStorage.getItem(
    "donation_order_id"
  );


const orderId =
  urlOrderId ||
  storedOrderId ||
  null;


/* SHOW BASIC IDs */

transactionIdElement.textContent =
  transactionId || "Not available";

orderIdElement.textContent =
  orderId || "Not available";


/* FORMAT AMOUNT */

function formatAmount(value) {

  const number =
    Number(value);

  if (!Number.isFinite(number)) {
    return "—";
  }

  return `৳${new Intl.NumberFormat(
    "en-BD",
    {
      maximumFractionDigits: 2
    }
  ).format(number)}`;
}


/* VERIFIED UI */

function showVerified(data) {

  verificationBox.classList.remove(
    "failed"
  );

  verificationBox.classList.add(
    "verified"
  );


  verificationText.textContent =
    "Payment verified successfully";


  paymentStatus.textContent =
    "Verified";


  loaderLine.hidden =
    true;


  const amount =
    data?.amount ??
    data?.orderAmount ??
    data?.payment?.amount ??
    data?.payment?.orderAmount;


  if (amount !== undefined) {

    paymentAmount.textContent =
      formatAmount(amount);

  }


  const returnedTransactionId =
    data?.transactionId ??
    data?.transaction_id ??
    data?.payment?.transactionId ??
    data?.payment?.transaction_id;


  if (returnedTransactionId) {

    transactionIdElement.textContent =
      returnedTransactionId;

  }


  const returnedOrderId =
    data?.orderId ??
    data?.order_id ??
    data?.payment?.orderId ??
    data?.payment?.order_id;


  if (returnedOrderId) {

    orderIdElement.textContent =
      returnedOrderId;

  }

}


/* FAILED UI */

function showVerificationError(message) {

  verificationBox.classList.remove(
    "verified"
  );

  verificationBox.classList.add(
    "failed"
  );


  verificationText.textContent =
    message;


  paymentStatus.textContent =
    "Unable to verify";


  loaderLine.hidden =
    true;
}


/* VERIFY PAYMENT */

async function verifyPayment() {

  if (!transactionId) {

    showVerificationError(
      "Transaction ID was not received."
    );

    return;
  }


  try {

    const url =
      `${API_BASE_URL}/payment/verify/` +
      encodeURIComponent(
        transactionId
      );


    const response =
      await fetch(url);


    let data;


    try {

      data =
        await response.json();

    } catch {

      throw new Error(
        "The verification server returned an invalid response."
      );

    }


    if (!response.ok) {

      throw new Error(
        data?.error ||
        data?.message ||
        "Payment verification failed."
      );

    }


    if (
      data?.success === false
    ) {

      throw new Error(
        data?.error ||
        data?.message ||
        "Payment could not be verified."
      );

    }


    showVerified(data);


    /*
      Clear stored order ID after
      successful verification.
    */

    sessionStorage.removeItem(
      "donation_order_id"
    );


  } catch (error) {

    console.error(
      "Verification error:",
      error
    );


    showVerificationError(
      error.message ||
      "We couldn't verify your payment."
    );

  }

}


verifyPayment();
