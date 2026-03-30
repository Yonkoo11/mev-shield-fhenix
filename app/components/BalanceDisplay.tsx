"use client";

import { useAccount } from "wagmi";
import { formatUnits } from "viem";
import { useBalanceA, useBalanceB } from "../hooks/useBatchAuction";
import { TOKEN_DECIMALS, TOKEN_A_DISPLAY, TOKEN_B_DISPLAY } from "../lib/contract";

export function BalanceDisplay() {
  const { isConnected } = useAccount();
  const { balance: balA, isLoading: loadA } = useBalanceA();
  const { balance: balB, isLoading: loadB } = useBalanceB();

  const fmt = (val: bigint | number) => parseFloat(formatUnits(BigInt(val), TOKEN_DECIMALS)).toFixed(2);

  if (!isConnected) return null;

  return (
    <div className="bg-shield-card card-glow rounded p-5">
      <h3 className="font-mono text-xs tracking-wider uppercase text-shield-muted mb-4">
        Deposited Balance
      </h3>
      {loadA || loadB ? (
        <div className="space-y-3">
          <div className="h-6 bg-shield-bg rounded animate-pulse" />
          <div className="h-6 bg-shield-bg rounded animate-pulse" />
        </div>
      ) : (
        <div className="space-y-3">
          <div className="flex justify-between items-baseline">
            <span className="font-mono text-xs tracking-wider uppercase text-shield-muted">{TOKEN_A_DISPLAY}</span>
            <span className="text-xl font-mono font-bold tabular-nums">{fmt(balA)}</span>
          </div>
          <div className="flex justify-between items-baseline">
            <span className="font-mono text-xs tracking-wider uppercase text-shield-muted">{TOKEN_B_DISPLAY}</span>
            <span className="text-xl font-mono font-bold tabular-nums">{fmt(balB)}</span>
          </div>
        </div>
      )}
    </div>
  );
}
