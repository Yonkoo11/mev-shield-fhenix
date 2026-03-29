"use client";

import { useState, useEffect } from "react";
import { useAccount } from "wagmi";
import { useCurrentBatchId, useBatch, useClearingPrice, useHasOrder, useRequestFillDecrypt, useClaimFill } from "../hooks/useBatchAuction";
import { formatPrice } from "../lib/contract";

type ClaimState = "unclaimed" | "requesting" | "claiming" | "claimed";

function UserOrderResult({ batchId }: { batchId: bigint }) {
  const { hasOrder } = useHasOrder(batchId);
  const { requestFillDecrypt, isPending: decryptPending, isSuccess: decryptSuccess, reset: resetDecrypt } = useRequestFillDecrypt();
  const { claimFill, isPending: claimPending, isSuccess: claimSuccess, reset: resetClaim } = useClaimFill();
  const [claimState, setClaimState] = useState<ClaimState>("unclaimed");

  useEffect(() => {
    if (decryptSuccess && claimState === "requesting") {
      resetDecrypt();
      setClaimState("claiming");
      claimFill(batchId);
    }
  }, [decryptSuccess, claimState, batchId, resetDecrypt, claimFill]);

  useEffect(() => {
    if (claimSuccess && claimState === "claiming") {
      resetClaim();
      setClaimState("claimed");
    }
  }, [claimSuccess, claimState, resetClaim]);

  if (!hasOrder) return null;

  const handleClaim = () => {
    setClaimState("requesting");
    requestFillDecrypt(batchId);
  };

  const isPending = decryptPending || claimPending;

  return (
    <div className="mt-2 pt-2 border-t border-shield-border">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-xs">
          <div className="w-2 h-2 rounded-full bg-shield-accent" />
          <span className="text-shield-accent font-medium">You had an order in this batch</span>
        </div>
        {claimState === "unclaimed" && (
          <button
            onClick={handleClaim}
            disabled={isPending}
            className="text-xs px-3 py-1 rounded-md bg-shield-accent/10 text-shield-accent border border-shield-accent/30 hover:bg-shield-accent/20 transition-colors disabled:opacity-50"
          >
            Claim Fill
          </button>
        )}
        {claimState === "requesting" && (
          <span className="text-xs text-shield-muted">Decrypting fill...</span>
        )}
        {claimState === "claiming" && (
          <span className="text-xs text-shield-muted">Claiming...</span>
        )}
        {claimState === "claimed" && (
          <span className="text-xs text-green-400 font-medium">Claimed</span>
        )}
      </div>
    </div>
  );
}

export function BatchResult() {
  const { isConnected } = useAccount();
  const { currentBatchId } = useCurrentBatchId();

  // Show last 3 batches
  const id1 = currentBatchId !== undefined && currentBatchId > 0n ? currentBatchId : undefined;
  const id2 = currentBatchId !== undefined && currentBatchId > 1n ? currentBatchId - 1n : undefined;
  const id3 = currentBatchId !== undefined && currentBatchId > 2n ? currentBatchId - 2n : undefined;

  const { batch: b1 } = useBatch(id1);
  const { batch: b2 } = useBatch(id2);
  const { batch: b3 } = useBatch(id3);

  const { clearingPrice: cp1 } = useClearingPrice(id1);
  const { clearingPrice: cp2 } = useClearingPrice(id2);
  const { clearingPrice: cp3 } = useClearingPrice(id3);

  type SettledInfo = { batchId: bigint; clearingPrice: bigint; buyCount: number; sellCount: number };
  const settled: SettledInfo[] = [];

  const add = (b: typeof b1, id: bigint | undefined, cp: bigint | undefined) => {
    if (b && (b.status === 3 || b.status === 4) && id !== undefined) { // 3 = Settled, 4 = Expired
      settled.push({ batchId: id, clearingPrice: cp ?? 0n, buyCount: b.buyCount, sellCount: b.sellCount });
    }
  };

  add(b1, id1, cp1);
  add(b2, id2, cp2);
  add(b3, id3, cp3);

  if (!isConnected) return null;

  return (
    <div className="bg-shield-card border border-shield-border rounded-xl p-5">
      <h3 className="text-sm font-medium text-shield-muted mb-4">Settled Batches</h3>
      <div className="space-y-3">
        {settled.map((s) => (
          <div key={s.batchId.toString()} className="bg-shield-bg rounded-lg p-3 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs text-shield-muted">Batch #{s.batchId.toString()}</span>
              <span className="text-xs text-shield-muted">{s.buyCount + s.sellCount} orders</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-shield-muted">Clearing Price</span>
              <span className="text-lg font-mono font-bold text-shield-accent tabular-nums">
                {s.clearingPrice > 0n ? `$${formatPrice(s.clearingPrice)}` : "No cross"}
              </span>
            </div>
            <div className="flex justify-between text-xs text-shield-muted">
              <span>Buys: {s.buyCount}</span>
              <span>Sells: {s.sellCount}</span>
            </div>
            <UserOrderResult batchId={s.batchId} />
          </div>
        ))}
        {settled.length === 0 && (
          <p className="text-shield-muted text-sm text-center py-4">No settled batches yet</p>
        )}
      </div>
    </div>
  );
}
