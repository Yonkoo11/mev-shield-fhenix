const ERROR_MESSAGES: Record<string, string> = {
  InsufficientBalance: "Insufficient deposited balance for this operation",
  BatchNotOpen: "No batch is currently open for orders",
  BatchNotClosed: "Batch hasn't closed yet",
  BatchNotSettling: "Batch is not in settling state",
  BatchNotSettled: "Batch hasn't been settled yet",
  BatchAlreadyOpen: "A batch is already open or settling",
  SideFull: "Order side is full (max 4 per side)",
  AlreadyHasOrder: "You already have an order in this batch",
  AlreadyClaimed: "You already claimed your fill for this batch",
  NeedOrdersBothSides: "Need orders on both buy and sell sides",
  DecryptionNotReady: "FHE decryption not yet complete. Try again in a few seconds.",
  FundsLocked: "Cannot withdraw while you have an active order",
  InvalidAmount: "Amount must be greater than zero",
  RefPriceTooLow: "Reference price is too low for the tick range",
  InvalidClearingTick: "Decrypted clearing tick is out of range",
};

export function parseContractError(error: any): string {
  if (!error) return "Transaction failed";

  const msg = error.message || error.shortMessage || String(error);

  // Check for known custom error selectors
  for (const [name, humanMsg] of Object.entries(ERROR_MESSAGES)) {
    if (msg.includes(name)) return humanMsg;
  }

  // MiniEVM specific
  if (msg.includes("account not found") || msg.includes("does not exist") || msg.includes("unknown address")) {
    return "Account not registered on chain. Send a small amount of GAS to this address first.";
  }

  if (msg.includes("insufficient funds")) {
    return "Insufficient gas for transaction";
  }

  if (msg.includes("user rejected") || msg.includes("User denied")) {
    return "Transaction rejected by user";
  }

  if (msg.includes("nonce")) {
    return "Transaction nonce error. Please try again.";
  }

  // Truncate long RPC errors
  const firstLine = msg.split("\n")[0];
  if (firstLine.length > 120) return firstLine.slice(0, 120) + "...";
  return firstLine;
}
