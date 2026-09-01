// success.js
//
// CRITICAL: arriving on this page does NOT mean the donation succeeded —
// Moneybag redirects here based on client-side navigation, which anyone
// could trigger manually. We only show a confirmed "Thank you" state after
// our OWN backend has verified the transaction directly with Moneybag.

const API_BASE_URL = "http://localhost:5000/api"; // keep in sync with script.js

const ICONS = {
  success: `<svg width="30" height="30" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M5 13l4 4L19 7" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
  error: `<svg width="30" height="30" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M6 6l12 12M18 6L6 18" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/></svg>`,
};

function getQueryParam(names) {
  const params = new URLSearchParams(window.location.search);
  for (const name of names) {
    const value = params.get(name);
    if (value) return value;
  }
  return null;
}

async function verifyAndRender() {
  const verifyingStatus = document.getElementById("verifyingStatus");
  const resultContent = document.getElementById("resultContent");
  const resultIcon = document.getElementById("resultIcon");
  const resultTitle = document.getElementById("resultTitle");
  const resultMessage = document.getElementById("resultMessage");
  const resultDetails = document.getElementById("resultDetails");
  const detailAmount = document.getElementById("detailAmount");
  const detailTransactionId = document.getElementById("detailTransactionId");
  const detailStatus = document.getElementById("detailStatus");

  function showResult({ ok, title, message, details }) {
    verifyingStatus.hidden = true;
    resultIcon.className = `result-icon ${ok ? "result-icon--success" : "result-icon--error"}`;
    resultIcon.innerHTML = ok ? ICONS.success : ICONS.error;
    resultTitle.textContent = title;
    resultMessage.textContent = message;

    if (details) {
      detailAmount.textContent = `৳${details.amount}`;
      detailTransactionId.textContent = details.transactionId || "—";
      detailStatus.textContent = details.status || (ok ? "Confirmed" : "Not confirmed");
      resultDetails.classList.add("is-visible");
    }

    resultContent.hidden = false;
    document.title = title;
  }

  // Moneybag's exact redirect query parameter names for the success_url
  // aren't published in the public docs we could confirm at build time.
  // We check the common possibilities here — if your sandbox redirects
  // use a different parameter name, add it to this list.
  const transactionId = getQueryParam(["transaction_id", "transactionId", "txn_id"]);
  const orderIdFromUrl = getQueryParam(["order_id", "orderId"]);
  const orderIdFromSession = sessionStorage.getItem("donation_order_id");
  const orderId = orderIdFromUrl || orderIdFromSession;

  if (!transactionId) {
    showResult({
      ok: false,
      title: "We couldn't confirm this payment",
      message:
        "No transaction reference was found in the returning link. If money was deducted, please contact support with your order details before donating again.",
    });
    return;
  }

  try {
    const url = new URL(`${API_BASE_URL}/payment/verify/${encodeURIComponent(transactionId)}`);
    if (orderId) url.searchParams.set("orderId", orderId);

    const response = await fetch(url.toString());
    const data = await response.json();

    if (response.ok && data.success && data.verified) {
      showResult({
        ok: true,
        title: "Thank you for your donation!",
        message: "Your payment has been verified and confirmed by Moneybag.",
        details: {
          amount: data.amount,
          transactionId: data.transactionId,
          status: data.status,
        },
      });
      sessionStorage.removeItem("donation_order_id");
    } else {
      showResult({
        ok: false,
        title: "Payment not confirmed",
        message:
          data.error ||
          "We could not verify this payment as successful. If you believe this is an error, please contact support with your transaction ID.",
        details: data.transactionId
          ? { amount: data.amount, transactionId: data.transactionId, status: data.status }
          : null,
      });
    }
  } catch (error) {
    showResult({
      ok: false,
      title: "Verification error",
      message: "We couldn't reach the server to verify your payment. Please contact support if money was deducted.",
    });
  }
}

verifyAndRender();
