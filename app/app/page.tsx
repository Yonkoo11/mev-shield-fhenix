"use client";

import { useState } from "react";
import { useAccount, useConnect } from "wagmi";
import { Header } from "../components/Header";
import { ChainGuard } from "../components/ChainGuard";
import { DepositPanel } from "../components/DepositPanel";
import { OrderForm } from "../components/OrderForm";
import { BatchTimer } from "../components/BatchTimer";
import { BatchResult } from "../components/BatchResult";
import { BalanceDisplay } from "../components/BalanceDisplay";
import { PrivacyBadge } from "../components/PrivacyBadge";
import { FaucetPanel } from "../components/BridgePanel";

export default function Home() {
  const { isConnected } = useAccount();
  const { connectors, connect } = useConnect();

  const [activeBatchId, setActiveBatchId] = useState<bigint | null>(null);
  const [batchStatus, setBatchStatus] = useState<string>("loading");
  const [refPrice, setRefPrice] = useState<bigint | undefined>();
  const [tickSpacing, setTickSpacing] = useState<bigint | undefined>();

  const handleBatchUpdate = (batchId: bigint | null, status: string, rp?: bigint, ts?: bigint) => {
    setActiveBatchId(batchId);
    setBatchStatus(status);
    if (rp) setRefPrice(rp);
    if (ts) setTickSpacing(ts);
  };

  return (
    <main className="max-w-6xl mx-auto px-4 py-8">
      <Header />

      {!isConnected ? (
        <div className="mt-16 space-y-16">
          <div className="text-center space-y-6">
            <h1 className="text-5xl md:text-7xl font-bold tracking-tight leading-[1.1]">
              Trade without{" "}
              <span className="text-shield-accent">MEV</span>
            </h1>
            <p className="text-shield-muted text-lg max-w-md mx-auto">
              FHE-encrypted batch auctions. Orders sealed with homomorphic encryption.
              Not even the contract can see your intent.
            </p>
            <div className="flex gap-3 justify-center pt-2">
              {connectors.map((connector) => (
                <button
                  key={connector.uid}
                  onClick={() => connect({ connector })}
                  className="bg-shield-accent text-shield-bg font-semibold rounded-lg px-6 py-3 text-sm hover:bg-shield-accent/90 transition-colors"
                >
                  Connect Wallet
                </button>
              ))}
            </div>
          </div>

          {/* Features */}
          <div className="max-w-4xl mx-auto">
            <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
              <div className="md:col-span-3 bg-shield-card border border-shield-border rounded-lg p-6 md:p-8 flex flex-col justify-between min-h-[200px]">
                <div>
                  <div className="text-shield-accent mb-4">
                    <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                    </svg>
                  </div>
                  <h3 className="text-lg font-semibold mb-2">FHE-Encrypted Orders</h3>
                  <p className="text-sm text-shield-muted leading-relaxed max-w-sm">
                    Orders are encrypted with Fully Homomorphic Encryption.
                    The clearing price is computed over ciphertext. Individual
                    orders are never revealed to anyone.
                  </p>
                </div>
                <div className="flex gap-6 mt-6 pt-4 border-t border-shield-border text-xs text-shield-muted">
                  <span><span className="text-shield-accent font-mono font-bold text-base tabular-nums">8</span> max orders</span>
                  <span><span className="text-shield-accent font-mono font-bold text-base tabular-nums">$0</span> MEV extracted</span>
                  <span><span className="text-shield-accent font-mono font-bold text-base tabular-nums">FHE</span> privacy</span>
                </div>
              </div>
              <div className="md:col-span-2 flex flex-col gap-4">
                <div className="flex-1 bg-shield-card border border-shield-border rounded-lg p-5">
                  <div className="text-shield-accent mb-3">
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                    </svg>
                  </div>
                  <h3 className="font-semibold text-sm mb-1">Uniform Clearing</h3>
                  <p className="text-xs text-shield-muted leading-relaxed">
                    Every order fills at the same price. Frontrunning is impossible by design.
                  </p>
                </div>
                <div className="flex-1 bg-shield-card border border-shield-border rounded-lg p-5">
                  <div className="text-shield-accent mb-3">
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 10V3L4 14h7v7l9-11h-7z" />
                    </svg>
                  </div>
                  <h3 className="font-semibold text-sm mb-1">Trustless Privacy</h3>
                  <p className="text-xs text-shield-muted leading-relaxed">
                    No trusted operator. No private mempool. FHE eliminates the trust assumption entirely.
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Flow */}
          <div className="max-w-3xl mx-auto">
            <div className="flex items-center justify-between gap-2 text-xs text-shield-muted">
              {["Deposit", "Encrypt Order", "Batch Closes", "FHE Settlement", "Claim Fill"].map((step, i) => (
                <div key={i} className="flex items-center gap-2">
                  {i > 0 && <div className="w-8 h-px bg-shield-border hidden md:block" />}
                  <div className="flex items-center gap-1.5">
                    <span className="w-5 h-5 rounded-full bg-shield-accent/20 text-shield-accent font-mono text-[10px] flex items-center justify-center font-bold">{i + 1}</span>
                    <span className="hidden md:inline">{step}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <PrivacyBadge />
        </div>
      ) : (
        <ChainGuard>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mt-8">
            <div className="space-y-6 order-1 lg:order-2">
              <BatchTimer onBatchUpdate={handleBatchUpdate} />
              <OrderForm
                batchId={batchStatus === "open" ? activeBatchId : null}
                refPrice={refPrice}
                tickSpacing={tickSpacing}
              />
            </div>
            <div className="space-y-6 order-2 lg:order-1">
              <BalanceDisplay />
              <DepositPanel />
              <FaucetPanel />
            </div>
            <div className="space-y-6 order-3">
              <BatchResult />
              <PrivacyBadge />
            </div>
          </div>
        </ChainGuard>
      )}
    </main>
  );
}
