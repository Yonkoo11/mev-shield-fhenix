"use client";

import { useState, useEffect } from "react";
import { useAccount } from "wagmi";
import { parseUnits } from "viem";
import { useSubmitBuyOrder, useSubmitSellOrder, useBalanceA, useBalanceB } from "../hooks/useBatchAuction";
import { useCofhe } from "../hooks/useCofhe";
import { TOKEN_DECIMALS, NUM_TICKS, TOKEN_A_DISPLAY, TOKEN_B_DISPLAY, tickToPrice, formatPrice, PRICE_SCALE } from "../lib/contract";
import { useToast } from "./Toast";

interface OrderFormProps {
  batchId: bigint | null;
  refPrice?: bigint;
  tickSpacing?: bigint;
}

export function OrderForm({ batchId, refPrice, tickSpacing }: OrderFormProps) {
  const { isConnected } = useAccount();
  const toast = useToast();
  const [side, setSide] = useState<"buy" | "sell">("buy");
  const [tick, setTick] = useState(Math.floor(NUM_TICKS / 2)); // default to middle tick
  const [amount, setAmount] = useState("");
  const [encrypting, setEncrypting] = useState(false);

  const { balance: balA } = useBalanceA();
  const { balance: balB } = useBalanceB();
  const { cofheState, encryptOrder } = useCofhe();

  const { submitBuyOrder, isPending: buyPending, isSuccess: buySuccess, isError: buyError, error: buyErr, reset: resetBuy } = useSubmitBuyOrder();
  const { submitSellOrder, isPending: sellPending, isSuccess: sellSuccess, isError: sellError, error: sellErr, reset: resetSell } = useSubmitSellOrder();

  useEffect(() => {
    if (buySuccess || sellSuccess) {
      toast.success(`Encrypted order submitted to batch #${batchId?.toString()}`);
      setAmount("");
      resetBuy();
      resetSell();
    }
    if (buyError) { toast.error("Order failed"); resetBuy(); }
    if (sellError) { toast.error("Order failed"); resetSell(); }
  }, [buySuccess, sellSuccess, buyError, sellError, buyErr, sellErr, batchId, resetBuy, resetSell, toast]);

  const currentPrice = refPrice && tickSpacing
    ? tickToPrice(tick, refPrice, tickSpacing)
    : 0n;

  const parsedAmount = amount ? parseFloat(amount) : 0;
  const amountInvalid = amount !== "" && parsedAmount <= 0;

  const handleSubmit = async () => {
    if (!amount || batchId === null || amountInvalid) return;
    if (cofheState !== "ready") {
      toast.error("FHE encryption not ready. Connect wallet and wait.");
      return;
    }

    try {
      setEncrypting(true);
      toast.info("Encrypting order with FHE...");

      const orderAmount = parseUnits(amount, TOKEN_DECIMALS);
      const { encryptedTick, encryptedAmount } = await encryptOrder(tick, orderAmount);

      if (side === "buy") {
        submitBuyOrder(batchId, encryptedTick, encryptedAmount);
      } else {
        submitSellOrder(batchId, encryptedTick, encryptedAmount);
      }
    } catch (err) {
      toast.error(`Encryption failed: ${err instanceof Error ? err.message : "unknown"}`);
    } finally {
      setEncrypting(false);
    }
  };

  const isPending = buyPending || sellPending || encrypting;

  if (!isConnected) return null;

  return (
    <div className="bg-shield-card border border-shield-border rounded-xl p-5">
      <h3 className="text-sm font-medium text-shield-muted mb-4">
        Submit Encrypted Order {batchId !== null ? `(Batch #${batchId.toString()})` : ""}
      </h3>

      {batchId === null ? (
        <p className="text-shield-muted text-sm">Waiting for an open batch...</p>
      ) : (
        <>
          {/* FHE status */}
          {cofheState !== "ready" && (
            <div className="mb-3 px-3 py-2 rounded-lg bg-shield-yellow/10 border border-shield-yellow/20 text-xs text-shield-yellow">
              {cofheState === "initializing" ? "Initializing FHE encryption..." : "Connect wallet to enable encryption"}
            </div>
          )}

          {/* Side toggle */}
          <div className="flex gap-1 bg-shield-bg rounded-lg p-1 mb-4">
            <button onClick={() => setSide("buy")} className={`flex-1 py-2 rounded-md text-sm font-medium transition-colors ${side === "buy" ? "bg-shield-accent/20 text-shield-accent" : "text-shield-muted hover:text-shield-text"}`}>
              Buy {TOKEN_A_DISPLAY}
            </button>
            <button onClick={() => setSide("sell")} className={`flex-1 py-2 rounded-md text-sm font-medium transition-colors ${side === "sell" ? "bg-shield-red/20 text-shield-red" : "text-shield-muted hover:text-shield-text"}`}>
              Sell {TOKEN_A_DISPLAY}
            </button>
          </div>

          <div className="space-y-3">
            {/* Price tick slider */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs text-shield-muted">Price Level (tick {tick})</label>
                <span className="text-xs font-mono text-shield-text">
                  {currentPrice > 0n ? `${formatPrice(currentPrice)} ${TOKEN_B_DISPLAY}/${TOKEN_A_DISPLAY}` : "..."}
                </span>
              </div>
              <input
                type="range"
                min={0}
                max={NUM_TICKS - 1}
                value={tick}
                onChange={(e) => setTick(Number(e.target.value))}
                className="w-full h-2 bg-shield-bg rounded-lg appearance-none cursor-pointer accent-shield-accent"
              />
              <div className="flex justify-between text-[10px] text-shield-muted mt-1">
                <span>Low</span>
                <span>High</span>
              </div>
            </div>

            {/* Amount */}
            <div>
              <label className="text-xs text-shield-muted">Amount ({TOKEN_A_DISPLAY})</label>
              <input
                type="number"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="100.00"
                min="0"
                step="0.01"
                className="w-full mt-1 bg-shield-bg border border-shield-border rounded-lg px-3 py-2 text-base font-mono focus:outline-none focus:border-shield-accent"
              />
              {amountInvalid && <p className="text-[10px] text-shield-red mt-1">Amount must be greater than 0</p>}
            </div>

            {/* Privacy notice */}
            <div className="bg-shield-bg rounded-lg p-3 text-xs text-shield-muted space-y-1">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-shield-accent" />
                <span>Order will be encrypted with FHE before submission</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-shield-accent" />
                <span>No one can see your price or amount until settlement</span>
              </div>
            </div>

            <button
              onClick={handleSubmit}
              disabled={isPending || !amount || amountInvalid || cofheState !== "ready"}
              className={`w-full py-3 rounded-lg text-sm font-medium transition-colors disabled:opacity-50 ${
                side === "buy"
                  ? "bg-shield-accent text-shield-bg hover:bg-shield-accent/90"
                  : "bg-shield-red text-white hover:bg-shield-red/90"
              }`}
            >
              {encrypting ? "Encrypting..." : isPending ? "Submitting..." : `${side === "buy" ? "Buy" : "Sell"} ${TOKEN_A_DISPLAY} (Encrypted)`}
            </button>
          </div>
        </>
      )}
    </div>
  );
}
