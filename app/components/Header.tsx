"use client";

import { useState } from "react";
import { useAccount, useConnect, useDisconnect } from "wagmi";

export function Header() {
  const { address, isConnected } = useAccount();
  const { connectors, connect } = useConnect();
  const { disconnect } = useDisconnect();
  const [copied, setCopied] = useState(false);

  const truncateAddress = (addr: string) =>
    `${addr.slice(0, 6)}...${addr.slice(-4)}`;

  const copyAddress = () => {
    if (!address) return;
    navigator.clipboard.writeText(address);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <header className="flex items-center justify-between py-5 border-b border-shield-border/50">
      <div className="flex items-center gap-3">
        <span className="font-mono text-lg font-bold tracking-[0.08em] uppercase">
          MEV<span className="text-shield-accent">SHIELD</span>
        </span>
        {isConnected && (
          <span className="font-mono text-[10px] tracking-wider uppercase text-shield-accent/60 bg-shield-accent/8 border border-shield-accent/15 px-2 py-0.5 rounded flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-shield-accent animate-pulse-green" />
            Arb Sepolia
          </span>
        )}
      </div>

      <div className="flex items-center gap-2">
        {isConnected && address ? (
          <div className="flex items-center gap-2">
            <button
              onClick={copyAddress}
              className="flex items-center gap-2 bg-shield-card border border-shield-border rounded px-3 py-2 hover:border-shield-accent/30 transition-colors"
              title="Click to copy address"
            >
              <div className="w-1.5 h-1.5 rounded-full bg-shield-accent" />
              <span className="font-mono text-xs tracking-wide">
                {copied ? "COPIED" : truncateAddress(address)}
              </span>
            </button>
            <button
              onClick={() => disconnect()}
              className="bg-shield-card border border-shield-border rounded px-2.5 py-2 text-shield-muted hover:text-shield-pink hover:border-shield-pink/30 transition-colors"
              title="Disconnect"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
            </button>
          </div>
        ) : (
          <button
            onClick={() => connectors[0] && connect({ connector: connectors[0] })}
            className="font-mono text-xs tracking-[0.1em] uppercase text-shield-accent border border-shield-accent/40 rounded px-5 py-2.5 hover:bg-shield-accent hover:text-shield-bg transition-all"
          >
            Connect Wallet
          </button>
        )}
      </div>
    </header>
  );
}
