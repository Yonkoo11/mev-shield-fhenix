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
import { NoiseAnimation } from "../components/NoiseAnimation";

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
    <main className="max-w-[1200px] mx-auto px-6 md:px-8">
      <Header />

      {!isConnected ? (
        <div className="space-y-16 pb-20">
          {/* ── HERO ── */}
          <section className="scan-lines relative pt-12 md:pt-20">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
              {/* Left: headline */}
              <div className="animate-fade-up">
                <h1 className="font-mono text-4xl md:text-[56px] font-bold tracking-[0.04em] uppercase leading-[1.1] mb-6">
                  Your trades{" "}
                  <br className="hidden md:block" />
                  are{" "}
                  <span className="text-shield-pink">noise</span>
                </h1>
                <p className="text-shield-muted text-base md:text-lg leading-relaxed mb-2 max-w-md">
                  Until the clearing price emerges.
                </p>
                <p className="text-base md:text-lg leading-relaxed max-w-md mb-8">
                  FHE encryption makes your orders{" "}
                  <span className="text-shield-accent font-medium">indistinguishable from random</span>.
                  Only the fair price survives.
                </p>
                <button
                  onClick={() => connectors[0] && connect({ connector: connectors[0] })}
                  className="font-mono text-sm tracking-[0.08em] uppercase font-bold bg-shield-accent text-shield-bg rounded px-7 py-3.5 hover:bg-shield-accent/90 transition-colors"
                >
                  Connect Wallet
                </button>
              </div>

              {/* Right: noise animation */}
              <div className="animate-fade-up" style={{ animationDelay: "100ms" }}>
                <NoiseAnimation />
              </div>
            </div>
          </section>

          {/* ── STATS BANNER ── */}
          <section
            className="bg-shield-card border border-shield-border rounded px-6 py-4 animate-fade-in"
            style={{ animationDelay: "200ms" }}
          >
            <div className="flex flex-wrap items-center justify-between gap-4 font-mono text-xs tracking-wider uppercase">
              <div>
                <span className="text-shield-muted">Batch Duration: </span>
                <span className="text-shield-accent font-bold">60s</span>
              </div>
              <div className="hidden md:block w-px h-4 bg-shield-border" />
              <div>
                <span className="text-shield-muted">Max Orders: </span>
                <span className="text-shield-accent font-bold">8</span>
              </div>
              <div className="hidden md:block w-px h-4 bg-shield-border" />
              <div>
                <span className="text-shield-muted">MEV Extracted: </span>
                <span className="text-shield-pink font-bold">$0</span>
              </div>
              <div className="hidden md:block w-px h-4 bg-shield-border" />
              <div>
                <span className="text-shield-muted">Privacy: </span>
                <span className="text-shield-accent font-bold">FHE</span>
              </div>
            </div>
          </section>

          {/* ── FEATURES ── */}
          <section className="grid grid-cols-1 lg:grid-cols-5 gap-5 items-stretch">
            {/* Large feature: Encrypted Batch Auctions */}
            <div
              className="lg:col-span-3 bg-shield-card border-l-[3px] border-l-shield-accent border border-shield-border rounded p-6 md:p-8 animate-stagger-in"
              style={{ animationDelay: "300ms" }}
            >
              <div className="font-mono text-[10px] tracking-[0.15em] uppercase text-shield-accent mb-3">
                // Core Mechanism
              </div>
              <h3 className="font-mono text-lg font-bold uppercase tracking-wide mb-3">
                Encrypted Batch Auctions
              </h3>
              <p className="text-sm text-shield-muted leading-relaxed mb-5 max-w-md">
                Orders are encrypted client-side with Fhenix FHE before submission.
                No one can see your intent, your price, or your size. The contract
                processes sealed orders and computes a single clearing price homomorphically.
              </p>

              {/* Code block */}
              <div className="bg-shield-bg rounded p-4 font-mono text-xs leading-relaxed">
                <div className="text-shield-muted">
                  <span className="text-shield-accent">&gt;</span> submit_order --encrypted
                </div>
                <div className="mt-1 pl-4 space-y-0.5">
                  <div>
                    tick: {"  "}
                    <span className="bg-shield-static/40 text-shield-static px-1 rounded">0x████████</span>
                  </div>
                  <div>
                    amount:{" "}
                    <span className="bg-shield-static/40 text-shield-static px-1 rounded">0x████████</span>
                  </div>
                  <div>
                    status:{" "}
                    <span className="text-shield-accent font-bold">SEALED ✓</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Right stack */}
            <div className="lg:col-span-2 flex flex-col gap-5">
              <div
                className="flex-1 bg-shield-card border-l-[3px] border-l-shield-accent border border-shield-border rounded p-5 animate-stagger-in"
                style={{ animationDelay: "400ms" }}
              >
                <div className="font-mono text-[10px] tracking-[0.15em] uppercase text-shield-accent mb-2">
                  // Fair Pricing
                </div>
                <h3 className="font-mono text-sm font-bold uppercase tracking-wide mb-2">
                  Uniform Clearing
                </h3>
                <p className="text-xs text-shield-muted leading-relaxed">
                  Every order in the batch fills at the same price. No advantage to speed,
                  no advantage to information. The clearing price is computed over encrypted
                  orders. You get the same deal as everyone else.
                </p>
              </div>

              <div
                className="flex-1 bg-shield-card border-l-[3px] border-l-shield-pink border border-shield-border rounded p-5 animate-stagger-in"
                style={{ animationDelay: "500ms" }}
              >
                <div className="font-mono text-[10px] tracking-[0.15em] uppercase text-shield-pink mb-2">
                  // Protection
                </div>
                <h3 className="font-mono text-sm font-bold uppercase tracking-wide mb-2">
                  Zero MEV
                </h3>
                <p className="text-xs text-shield-muted leading-relaxed">
                  Frontrunning requires seeing orders. Sandwich attacks require knowing
                  direction. When orders are FHE-encrypted, extractors see nothing.
                  MEV extracted from your trades: zero.
                </p>
              </div>
            </div>
          </section>

          {/* ── HOW IT WORKS ── */}
          <section className="text-center">
            <h2 className="font-mono text-xl font-bold uppercase tracking-[0.08em] mb-8">
              How It Works
            </h2>
            <div className="max-w-2xl mx-auto bg-shield-card border border-shield-border rounded p-6 md:p-8">
              <div className="font-mono text-sm space-y-0">
                {[
                  { cmd: "deposit tokens", desc: "Fund your shielded balance" },
                  { cmd: "encrypt order", desc: "FHE-seal your trade intent" },
                  { cmd: "batch closes", desc: "Orders collect in a sealed batch" },
                  { cmd: "fhe settlement", desc: "Clearing price computed on ciphertext" },
                  { cmd: "claim fill", desc: "Withdraw filled tokens" },
                ].map((step, i) => (
                  <div
                    key={step.cmd}
                    className="flex items-center gap-3 py-2.5 border-b border-shield-border/30 last:border-0 animate-stagger-in"
                    style={{ animationDelay: `${600 + i * 100}ms` }}
                  >
                    <span className="font-mono text-[10px] w-5 h-5 rounded bg-shield-accent/10 text-shield-accent flex items-center justify-center font-bold shrink-0">
                      {i + 1}
                    </span>
                    <span className="text-shield-text text-left flex-1">{step.cmd}</span>
                    <span className="text-shield-muted text-xs text-right hidden md:block">{step.desc}</span>
                  </div>
                ))}
              </div>
            </div>
          </section>

          {/* ── FOOTER ── */}
          <footer className="border-t border-shield-border pt-6 pb-4">
            <div className="flex flex-wrap items-center justify-center gap-3 font-mono text-xs tracking-wider uppercase text-shield-muted">
              <span>MEVSHIELD</span>
              <span className="text-shield-border">·</span>
              <span>Fhenix</span>
              <span className="text-shield-border">·</span>
              <span>FHE-Encrypted Batch Auctions</span>
            </div>
          </footer>
        </div>
      ) : (
        <ChainGuard>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 mt-6 pb-12">
            {/* Center: timer + order form */}
            <div className="space-y-5 order-1 lg:order-2">
              <BatchTimer onBatchUpdate={handleBatchUpdate} />
              <OrderForm
                batchId={batchStatus === "open" ? activeBatchId : null}
                refPrice={refPrice}
                tickSpacing={tickSpacing}
              />
            </div>
            {/* Left: balances + deposit */}
            <div className="space-y-5 order-2 lg:order-1">
              <BalanceDisplay />
              <DepositPanel />
              <FaucetPanel />
            </div>
            {/* Right: results + privacy */}
            <div className="space-y-5 order-3">
              <BatchResult />
              <PrivacyBadge />
            </div>
          </div>
        </ChainGuard>
      )}
    </main>
  );
}
