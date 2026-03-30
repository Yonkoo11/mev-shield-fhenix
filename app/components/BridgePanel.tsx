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
      className="block bg-shield-card card-glow rounded p-4 hover:border-shield-accent/30 transition-colors group border border-shield-border"
    >
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 rounded bg-shield-accent/10 flex items-center justify-center shrink-0">
          <span className="font-mono text-shield-accent text-sm font-bold">$</span>
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-mono text-xs tracking-wider uppercase text-shield-text group-hover:text-shield-accent transition-colors">
            Get Test ETH
          </p>
          <p className="font-mono text-[10px] tracking-wider text-shield-muted">
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
