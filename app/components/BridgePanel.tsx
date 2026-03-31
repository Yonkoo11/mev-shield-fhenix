"use client";

import { useEffect } from "react";
import { useAccount, useWriteContract } from "wagmi";
import { parseUnits } from "viem";
import {
  ERC20_ABI,
  TOKEN_A_ADDRESS,
  TOKEN_B_ADDRESS,
  TOKEN_DECIMALS,
  TOKEN_A_DISPLAY,
  TOKEN_B_DISPLAY,
} from "../lib/contract";
import { useToast } from "./Toast";

const MINT_AMOUNT = parseUnits("1000", TOKEN_DECIMALS);

function useMintToken(tokenAddress: `0x${string}`) {
  const { writeContract, isPending, isSuccess, isError, reset } = useWriteContract();
  const mint = (to: `0x${string}`) => {
    writeContract({
      address: tokenAddress,
      abi: ERC20_ABI,
      functionName: "mint",
      args: [to, MINT_AMOUNT],
    });
  };
  return { mint, isPending, isSuccess, isError, reset };
}

export function FaucetPanel() {
  const { isConnected, address } = useAccount();
  const toast = useToast();

  const mintA = useMintToken(TOKEN_A_ADDRESS);
  const mintB = useMintToken(TOKEN_B_ADDRESS);

  useEffect(() => {
    if (mintA.isSuccess) { toast.success(`Minted 1,000 ${TOKEN_A_DISPLAY}`); mintA.reset(); }
    if (mintA.isError) { toast.error(`Failed to mint ${TOKEN_A_DISPLAY}`); mintA.reset(); }
  }, [mintA.isSuccess, mintA.isError, mintA, toast]);

  useEffect(() => {
    if (mintB.isSuccess) { toast.success(`Minted 1,000 ${TOKEN_B_DISPLAY}`); mintB.reset(); }
    if (mintB.isError) { toast.error(`Failed to mint ${TOKEN_B_DISPLAY}`); mintB.reset(); }
  }, [mintB.isSuccess, mintB.isError, mintB, toast]);

  if (!isConnected || !address) return null;

  const anyPending = mintA.isPending || mintB.isPending;

  const handleMintBoth = () => {
    mintA.mint(address);
    mintB.mint(address);
  };

  return (
    <div className="bg-shield-card card-glow rounded p-5 space-y-3">
      <h3 className="font-mono text-xs tracking-wider uppercase text-shield-muted">
        Test Token Faucet
      </h3>

      <button
        onClick={handleMintBoth}
        disabled={anyPending}
        className="w-full py-3 rounded font-mono text-sm tracking-wider uppercase font-bold bg-shield-accent/10 text-shield-accent border border-shield-accent/30 hover:bg-shield-accent/20 transition-colors disabled:opacity-40"
      >
        {anyPending ? "Minting..." : `Mint 1,000 ${TOKEN_A_DISPLAY} + 1,000 ${TOKEN_B_DISPLAY}`}
      </button>

      <p className="font-mono text-[10px] text-shield-muted tracking-wide">
        Free test tokens. Mint as many times as you need.
      </p>

      <a
        href="https://www.alchemy.com/faucets/arbitrum-sepolia"
        target="_blank"
        rel="noopener noreferrer"
        className="flex items-center gap-2 pt-2 border-t border-shield-border/30 text-shield-muted hover:text-shield-accent transition-colors"
      >
        <span className="font-mono text-[10px] tracking-wider uppercase">
          Need test ETH for gas?
        </span>
        <svg className="w-3 h-3 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
        </svg>
      </a>
    </div>
  );
}
