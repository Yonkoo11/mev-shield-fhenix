"use client";

import { useAccount, useChainId, useSwitchChain } from "wagmi";
import { arbSepolia } from "../lib/contract";

export function ChainGuard({ children }: { children: React.ReactNode }) {
  const { isConnected } = useAccount();
  const chainId = useChainId();
  const { switchChain, isPending } = useSwitchChain();

  if (!isConnected) return <>{children}</>;
  if (chainId === arbSepolia.id) return <>{children}</>;

  return (
    <div className="flex flex-col items-center justify-center mt-16 gap-6">
      <div className="bg-shield-card border border-shield-red/30 rounded-xl p-6 max-w-md text-center space-y-4">
        <div className="w-12 h-12 mx-auto rounded-full bg-shield-red/20 flex items-center justify-center">
          <svg className="w-6 h-6 text-shield-red" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.732-.833-2.5 0L4.27 16.5c-.77.833.192 2.5 1.732 2.5z" />
          </svg>
        </div>
        <h3 className="text-lg font-semibold">Wrong Network</h3>
        <p className="text-sm text-shield-muted">
          Please switch to Arbitrum Sepolia to use MEV Shield.
        </p>
        <button
          onClick={() => switchChain({ chainId: arbSepolia.id })}
          disabled={isPending}
          className="w-full py-2.5 bg-shield-accent/10 text-shield-accent border border-shield-accent/30 rounded-lg text-sm font-medium hover:bg-shield-accent/20 transition-colors disabled:opacity-50"
        >
          {isPending ? "Switching..." : "Switch to Arbitrum Sepolia"}
        </button>
      </div>
    </div>
  );
}
