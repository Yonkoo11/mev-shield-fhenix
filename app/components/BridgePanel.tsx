"use client";

import { useAccount } from "wagmi";

export function FaucetPanel() {
  const { isConnected } = useAccount();

  if (!isConnected) return null;

  return (
    <a
      href="https://www.alchemy.com/faucets/arbitrum-sepolia"
      target="_blank"
      rel="noopener noreferrer"
      className="block bg-shield-card border border-shield-border rounded-xl p-4 hover:border-shield-accent/30 transition-colors group"
    >
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 rounded-lg bg-shield-accent/10 flex items-center justify-center shrink-0">
          <svg className="w-4 h-4 text-shield-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-shield-text group-hover:text-shield-accent transition-colors">
            Get Test ETH
          </p>
          <p className="text-xs text-shield-muted">
            Arbitrum Sepolia faucet
          </p>
        </div>
        <svg className="w-4 h-4 text-shield-muted group-hover:text-shield-accent shrink-0 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
        </svg>
      </div>
    </a>
  );
}
