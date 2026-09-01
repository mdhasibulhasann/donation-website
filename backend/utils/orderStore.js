// utils/orderStore.js
//
// A minimal in-memory store for donation orders, keyed by our own order_id.
//
// IMPORTANT: This is intentionally simple so the project runs with zero
// external dependencies. It is NOT durable — restarting the server loses
// all records — and it is NOT safe for multiple server instances (e.g.
// behind a load balancer), since each instance would have its own memory.
//
// For production, replace this with a real database table (Postgres,
// MongoDB, etc.) keyed by order_id, with a unique constraint on order_id
// and on the Moneybag transaction_id once known. The rest of the codebase
// only calls the functions below, so swapping the storage backend means
// editing just this file.

const orders = new Map();

/**
 * Records a newly created order right after Moneybag confirms the
 * checkout session, BEFORE the donor is redirected to pay.
 */
function createOrder({ orderId, amount, donor, sessionId }) {
  orders.set(orderId, {
    orderId,
    amount,
    donor,
    sessionId,
    transactionId: null,
    status: "PENDING", // PENDING -> VERIFIED_SUCCESS | VERIFIED_FAILED
    fulfilled: false,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  });
  return orders.get(orderId);
}

function getOrder(orderId) {
  return orders.get(orderId) || null;
}

function findOrderByTransactionId(transactionId) {
  for (const order of orders.values()) {
    if (order.transactionId === transactionId) return order;
  }
  return null;
}

/**
 * Marks an order as verified and fulfilled, exactly once. Safe to call
 * repeatedly with the same result (idempotent) — used by both the
 * success-page verification call and the webhook/IPN handler, whichever
 * arrives first "wins" and later calls are no-ops that just return the
 * already-recorded state.
 */
function markVerifiedOnce(orderId, { transactionId, status, verified }) {
  const order = orders.get(orderId);
  if (!order) return null;

  if (order.fulfilled) {
    // Already processed — return existing record without repeating any
    // side effect (e.g. sending a receipt email, updating totals, etc.).
    return order;
  }

  order.transactionId = transactionId;
  order.status = verified ? "VERIFIED_SUCCESS" : "VERIFIED_FAILED";
  order.moneybagStatus = status;
  order.fulfilled = true;
  order.updatedAt = new Date().toISOString();

  // -----------------------------------------------------------------
  // This is the single place to add real fulfillment side effects, e.g.:
  //   - send a thank-you email / receipt
  //   - write a permanent record to your donations database
  //   - update a public "total raised" counter
  // Because this function only runs once per order (guarded by
  // `order.fulfilled`), it's safe to add side effects here without
  // worrying about duplicate donations from page refreshes or repeated
  // webhook deliveries.
  // -----------------------------------------------------------------

  return order;
}

module.exports = {
  createOrder,
  getOrder,
  findOrderByTransactionId,
  markVerifiedOnce,
};
