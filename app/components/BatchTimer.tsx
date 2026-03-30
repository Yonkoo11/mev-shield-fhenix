"use client";

import { useEffect, useState } from "react";
import { useAccount } from "wagmi";
import { useCurrentBatchId, useBatch } from "../hooks/useBatchAuction";
import { MAX_ORDERS_PER_SIDE } from "../lib/contract";

// Status: 0=None, 1=Open, 2=Settling, 3=Settled

interface BatchTimerProps {
  onBatchUpdate?: (batchId: bigint | null, status: string, refPrice?: bigint, tickSpacing?: bigint) => void;
}

export function BatchTimer({ onBatchUpdate }: BatchTimerProps) {
  const { isConnected } = useAccount();
  const { currentBatchId } = useCurrentBatchId();
  const [timeLeft, setTimeLeft] = useState<number | null>(null);
  const [displayStatus, setDisplayStatus] = useState<string>("loading");

  const { batch, refetch: refetchBatch } = useBatch(
    currentBatchId !== undefined && currentBatchId > 0n ? currentBatchId : undefined
  );

  useEffect(() => {
    if (!batch || currentBatchId === undefined || currentBatchId === 0n) {
      setDisplayStatus("no_batch");
      onBatchUpdate?.(null, "no_batch");
      return;
    }

    const status = batch.status;

    if (status === 1) {
      const now = Math.floor(Date.now() / 1000);
      const closesAt = Number(batch.closesAt);
      const remaining = Math.max(0, closesAt - now);
      setTimeLeft(remaining);
      setDisplayStatus("open");
      onBatchUpdate?.(currentBatchId, "open", batch.refPrice, batch.tickSpacing);
    } else if (status === 2) {
      setDisplayStatus("settling");
      setTimeLeft(0);
      onBatchUpdate?.(currentBatchId, "settling");
    } else if (status === 3) {
      setDisplayStatus("settled");
      setTimeLeft(0);
      onBatchUpdate?.(currentBatchId, "settled");
    } else {
      setDisplayStatus("no_batch");
      onBatchUpdate?.(null, "no_batch");
    }
  }, [batch, currentBatchId, onBatchUpdate]);

  // Countdown
  useEffect(() => {
    if (displayStatus !== "open" || timeLeft === null) return;
    const interval = setInterval(() => {
      setTimeLeft((t) => (t !== null && t > 0 ? t - 1 : 0));
    }, 1000);
    return () => clearInterval(interval);
  }, [displayStatus, timeLeft]);

  // Poll while settling or when timer hits 0
  useEffect(() => {
    if (displayStatus !== "open" || timeLeft !== 0) {
      if (displayStatus === "settling") {
        const poll = setInterval(() => refetchBatch(), 2000);
        return () => clearInterval(poll);
      }
      return;
    }
    setDisplayStatus("settling");
    onBatchUpdate?.(currentBatchId ?? null, "settling");
    const poll = setInterval(() => refetchBatch(), 2000);
    return () => clearInterval(poll);
  }, [timeLeft, displayStatus, currentBatchId, onBatchUpdate, refetchBatch]);

  const openedAt = batch ? Number(batch.openedAt) : 0;
  const closesAt = batch ? Number(batch.closesAt) : 0;
  const totalDuration = closesAt - openedAt;
  const progress = timeLeft !== null && totalDuration > 0
    ? ((totalDuration - timeLeft) / totalDuration) * 100
    : 0;

  const isUrgent = timeLeft !== null && timeLeft <= 5 && timeLeft > 0;
  const orderCount = batch ? batch.buyCount + batch.sellCount : 0;
  const maxOrders = MAX_ORDERS_PER_SIDE * 2;

  if (!isConnected) return null;

  return (
    <div className="bg-shield-card card-glow rounded p-5">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-mono text-xs tracking-wider uppercase text-shield-muted">
          {currentBatchId && currentBatchId > 0n ? `Batch #${currentBatchId.toString()}` : "No Active Batch"}
        </h3>
        <span className="font-mono text-[10px] text-shield-muted tracking-wide">{orderCount}/{maxOrders} orders</span>
      </div>

      {displayStatus === "open" && timeLeft !== null && timeLeft > 0 ? (
        <>
          <div className="w-full h-1.5 bg-shield-bg rounded-full overflow-hidden mb-3">
            <div
              className={`h-full rounded-full transition-[width] duration-1000 ease-out ${isUrgent ? "bg-shield-pink" : "bg-shield-accent"}`}
              style={{ width: `${Math.min(progress, 100)}%` }}
            />
          </div>
          <div className="flex items-center justify-between">
            <span className="text-xs text-shield-muted">
              {isUrgent ? (
                <span className="text-shield-pink font-mono uppercase tracking-wider text-[10px]">Closing soon</span>
              ) : (
                "Accepting encrypted orders"
              )}
            </span>
            <span className={`text-2xl font-mono font-bold tabular-nums ${isUrgent ? "text-shield-pink" : "text-shield-text"}`}>
              {timeLeft}s
            </span>
          </div>
        </>
      ) : displayStatus === "settling" ? (
        <div className="text-center py-3 space-y-2">
          <div className="flex items-center justify-center gap-2">
            <div className="w-2 h-2 rounded-full bg-shield-yellow animate-pulse" />
            <span className="text-shield-yellow text-sm font-mono">Computing clearing price...</span>
          </div>
          <p className="font-mono text-[10px] text-shield-muted tracking-wide uppercase">
            FHE settlement in progress
          </p>
        </div>
      ) : displayStatus === "settled" ? (
        <div className="text-center py-2">
          <span className="text-shield-accent text-sm font-mono">Batch settled</span>
        </div>
      ) : (
        <div className="text-center py-2">
          <span className="text-shield-muted text-sm font-mono">Waiting for next batch...</span>
        </div>
      )}
    </div>
  );
}
