"use client";

import { useEffect, useRef, useState, useCallback } from "react";

const NOISE_CHARS = "█▓▒░▀▄▐▌◈◆◇○●◎■□▪▫△▲▽▼►◄¤÷×±";
const HEX_CHARS = "0123456789abcdef";

function randomChar(set: string) {
  return set[Math.floor(Math.random() * set.length)];
}

interface ResolvedLine {
  label: string;
  value: string;
  redacted?: boolean;
}

const RESOLVED_LINES: ResolvedLine[] = [
  { label: "order_id:", value: "0xa3f9" },
  { label: "tick:", value: "0x████████", redacted: true },
  { label: "amount:", value: "0x████████", redacted: true },
  { label: "status:", value: "SEALED" },
];

type Phase = "noise" | "resolving" | "clear" | "fade";

export function NoiseAnimation() {
  const [phase, setPhase] = useState<Phase>("noise");
  const [noiseGrid, setNoiseGrid] = useState<string[][]>([]);
  const [mounted, setMounted] = useState(false);
  const phaseRef = useRef<Phase>("noise");

  useEffect(() => setMounted(true), []);

  const generateNoise = useCallback(() => {
    return RESOLVED_LINES.map(() => {
      const cols = 6 + Math.floor(Math.random() * 4);
      return Array.from({ length: cols }, () => randomChar(NOISE_CHARS));
    });
  }, []);

  // Fast noise tick
  useEffect(() => {
    const tick = () => {
      if (phaseRef.current === "noise" || phaseRef.current === "fade") {
        setNoiseGrid(generateNoise());
      }
    };
    const interval = setInterval(tick, 80);
    tick();
    return () => clearInterval(interval);
  }, [generateNoise]);

  // Phase cycle: noise(2.5s) -> resolving(1.3s) -> clear(2.4s) -> fade(0.6s)
  useEffect(() => {
    const cycle = () => {
      phaseRef.current = "noise";
      setPhase("noise");
      setTimeout(() => { phaseRef.current = "resolving"; setPhase("resolving"); }, 2500);
      setTimeout(() => { phaseRef.current = "clear"; setPhase("clear"); }, 3800);
      setTimeout(() => { phaseRef.current = "fade"; setPhase("fade"); }, 6200);
    };
    cycle();
    const loop = setInterval(cycle, 6800);
    return () => clearInterval(loop);
  }, []);

  const showResolved = phase === "resolving" || phase === "clear";
  const showPrice = phase === "clear";

  // Static placeholder matches server render exactly to avoid hydration mismatch
  if (!mounted) {
    return (
      <div className="relative bg-shield-card border border-shield-border rounded overflow-hidden">
        <div className="flex items-center gap-2 px-4 py-2.5 border-b border-shield-border bg-shield-bg/50">
          <div className="w-2 h-2 rounded-full bg-shield-muted" />
          <span className="font-mono text-[11px] tracking-[0.12em] uppercase text-shield-muted">
            FHE Batch Processor
          </span>
        </div>
        <div className="p-4 font-mono text-sm min-h-[180px]" />
      </div>
    );
  }

  return (
    <div className="relative bg-shield-card border border-shield-border rounded overflow-hidden">
      {/* Header bar */}
      <div className="flex items-center gap-2 px-4 py-2.5 border-b border-shield-border bg-shield-bg/50">
        <div className={`w-2 h-2 rounded-full transition-colors duration-300 ${
          phase === "clear" ? "bg-shield-accent shadow-[0_0_6px_rgba(0,255,163,0.5)]"
          : phase === "resolving" ? "bg-shield-yellow"
          : "bg-shield-muted"
        }`} />
        <span className="font-mono text-[11px] tracking-[0.12em] uppercase text-shield-muted">
          FHE Batch Processor
        </span>
        {phase === "noise" && (
          <span className="ml-auto font-mono text-[9px] tracking-wider text-shield-pink/60 uppercase animate-pulse">
            encrypting
          </span>
        )}
        {phase === "clear" && (
          <span className="ml-auto font-mono text-[9px] tracking-wider text-shield-accent/60 uppercase">
            resolved
          </span>
        )}
      </div>

      {/* Content */}
      <div className="p-4 font-mono text-sm min-h-[180px]">
        <div className="space-y-2">
          {RESOLVED_LINES.map((line, i) => (
            <div key={i} className="flex items-center gap-2 h-6">
              <span className={`text-xs transition-colors duration-300 ${
                showResolved ? "text-shield-accent" : "text-shield-pink/40"
              }`}>&gt;</span>

              {showResolved ? (
                <span className="transition-opacity duration-500">
                  <span className="text-shield-muted">{line.label}</span>{" "}
                  {line.redacted ? (
                    <span className="inline-flex items-center">
                      <span className="text-shield-muted/60">0x</span>
                      <span className="bg-shield-static/50 text-shield-static rounded px-1.5 py-0.5 text-xs ml-0.5">
                        ████████
                      </span>
                    </span>
                  ) : (
                    <span className={line.value === "SEALED" ? "text-shield-accent font-bold" : "text-shield-accent"}>
                      {line.value}
                    </span>
                  )}
                </span>
              ) : (
                <span className="text-shield-static/50 tracking-wider overflow-hidden">
                  {noiseGrid[i]?.map((char, j) => (
                    <span
                      key={j}
                      className="inline-block w-[1.1ch]"
                      style={{ opacity: 0.4 + (j % 3) * 0.2 }}
                    >
                      {char}
                    </span>
                  ))}
                  <span className="text-shield-muted/30 ml-2 text-xs">
                    0x{noiseGrid[i]?.[0] || ""}
                  </span>
                </span>
              )}
            </div>
          ))}
        </div>

        {/* Clearing price reveal */}
        <div className={`mt-4 pt-3 border-t border-shield-border transition-all duration-500 ${
          showPrice ? "opacity-100 translate-y-0" : "opacity-0 translate-y-2"
        }`}>
          <div className="flex items-center gap-2">
            <span className="text-shield-accent text-xs">&gt;</span>
            <span className={`font-bold tracking-wide transition-all duration-700 ${
              showPrice
                ? "text-shield-accent drop-shadow-[0_0_8px_rgba(0,255,163,0.3)]"
                : "text-shield-accent/0"
            }`}>
              CLEARING PRICE: 0.9000
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
