"use client";

import { useState, useEffect } from "react";
import { useAccount } from "wagmi";
import { parseUnits, formatUnits } from "viem";
import {
  useDeposit,
  useWithdraw,
  useApproveToken,
  useTokenAllowance,
  useWalletTokenBalance,
} from "../hooks/useBatchAuction";
import {
  BATCH_AUCTION_ADDRESS,
  TOKEN_DECIMALS,
  TOKEN_A_ADDRESS,
  TOKEN_B_ADDRESS,
  TOKEN_A_DISPLAY,
  TOKEN_B_DISPLAY,
} from "../lib/contract";
import { parseContractError } from "../lib/errors";
import { useToast } from "./Toast";

type Mode = "deposit" | "withdraw";
type ApprovalStep = "idle" | "approveA" | "approveB" | "depositing";

export function DepositPanel() {
  const { isConnected } = useAccount();
  const toast = useToast();
  const [mode, setMode] = useState<Mode>("deposit");
  const [amountA, setAmountA] = useState("");
  const [amountB, setAmountB] = useState("");
  const [approvalStep, setApprovalStep] = useState<ApprovalStep>("idle");

  const { deposit, isPending: depositPending, isSuccess: depositSuccess, isError: depositError, error: depositErr, reset: resetDeposit } = useDeposit();
  const { withdraw, isPending: withdrawPending, isSuccess: withdrawSuccess, isError: withdrawError, error: withdrawErr, reset: resetWithdraw } = useWithdraw();

  const { approve: approveA, isPending: approveAPending, isSuccess: approveASuccess, reset: resetApproveA } = useApproveToken(TOKEN_A_ADDRESS);
  const { approve: approveB, isPending: approveBPending, isSuccess: approveBSuccess, reset: resetApproveB } = useApproveToken(TOKEN_B_ADDRESS);

  const { allowance: allowanceA } = useTokenAllowance(TOKEN_A_ADDRESS, BATCH_AUCTION_ADDRESS);
  const { allowance: allowanceB } = useTokenAllowance(TOKEN_B_ADDRESS, BATCH_AUCTION_ADDRESS);

  const { balance: walletBalA } = useWalletTokenBalance(TOKEN_A_ADDRESS);
  const { balance: walletBalB } = useWalletTokenBalance(TOKEN_B_ADDRESS);

  const isPending = depositPending || withdrawPending || approveAPending || approveBPending;
  const fmt = (val: bigint) => parseFloat(formatUnits(val, TOKEN_DECIMALS)).toFixed(2);

  const parsedA = amountA ? parseUnits(amountA, TOKEN_DECIMALS) : 0n;
  const parsedB = amountB ? parseUnits(amountB, TOKEN_DECIMALS) : 0n;

  const aExceedsBalance = mode === "deposit" && parsedA > 0n && parsedA > walletBalA;
  const bExceedsBalance = mode === "deposit" && parsedB > 0n && parsedB > walletBalB;
  const hasValidationError = aExceedsBalance || bExceedsBalance;

  useEffect(() => {
    if (depositSuccess) { toast.success("Deposit successful!"); setAmountA(""); setAmountB(""); setApprovalStep("idle"); resetDeposit(); }
    if (withdrawSuccess) { toast.success("Withdrawal successful!"); setAmountA(""); setAmountB(""); resetWithdraw(); }
    if (depositError) { toast.error(parseContractError(depositErr)); setApprovalStep("idle"); resetDeposit(); }
    if (withdrawError) { toast.error(parseContractError(withdrawErr)); resetWithdraw(); }
  }, [depositSuccess, withdrawSuccess, depositError, withdrawError, depositErr, withdrawErr, resetDeposit, resetWithdraw, toast]);

  useEffect(() => {
    if (approveASuccess && approvalStep === "approveA") {
      resetApproveA();
      const needB = parsedB > 0n && allowanceB !== undefined && allowanceB < parsedB;
      if (needB) { setApprovalStep("approveB"); approveB(BATCH_AUCTION_ADDRESS, parsedB); }
      else { setApprovalStep("depositing"); deposit(parsedA, parsedB); }
    }
  }, [approveASuccess, approvalStep, parsedA, parsedB, allowanceB, resetApproveA, approveB, deposit]);

  useEffect(() => {
    if (approveBSuccess && approvalStep === "approveB") {
      resetApproveB();
      setApprovalStep("depositing");
      deposit(parsedA, parsedB);
    }
  }, [approveBSuccess, approvalStep, parsedA, parsedB, resetApproveB, deposit]);

  const handleSubmit = () => {
    if (parsedA === 0n && parsedB === 0n || hasValidationError) return;
    if (mode === "deposit") {
      const needA = parsedA > 0n && (allowanceA === undefined || allowanceA < parsedA);
      const needB = parsedB > 0n && (allowanceB === undefined || allowanceB < parsedB);
      if (needA) { setApprovalStep("approveA"); approveA(BATCH_AUCTION_ADDRESS, parsedA); return; }
      if (needB) { setApprovalStep("approveB"); approveB(BATCH_AUCTION_ADDRESS, parsedB); return; }
      setApprovalStep("depositing"); deposit(parsedA, parsedB);
    } else { withdraw(parsedA, parsedB); }
  };

  if (!isConnected) return null;

  return (
    <div className="bg-shield-card card-glow rounded p-5">
      <div className="flex gap-1 bg-shield-bg rounded p-1 mb-4">
        <button
          onClick={() => { setMode("deposit"); setApprovalStep("idle"); }}
          className={`flex-1 py-2 rounded font-mono text-xs tracking-wider uppercase transition-colors ${
            mode === "deposit" ? "bg-shield-accent/15 text-shield-accent" : "text-shield-muted hover:text-shield-text"
          }`}
        >
          Deposit
        </button>
        <button
          onClick={() => { setMode("withdraw"); setApprovalStep("idle"); }}
          className={`flex-1 py-2 rounded font-mono text-xs tracking-wider uppercase transition-colors ${
            mode === "withdraw" ? "bg-shield-pink/15 text-shield-pink" : "text-shield-muted hover:text-shield-text"
          }`}
        >
          Withdraw
        </button>
      </div>
      <div className="space-y-3">
        <div>
          <div className="flex items-center justify-between">
            <label className="font-mono text-[10px] tracking-wider uppercase text-shield-muted">
              {TOKEN_A_DISPLAY} Amount
            </label>
            {mode === "deposit" && (
              <button
                onClick={() => setAmountA(parseFloat(formatUnits(walletBalA, TOKEN_DECIMALS)).toString())}
                className="font-mono text-[10px] text-shield-accent hover:text-shield-accent/80 tracking-wider uppercase"
              >
                Max: {fmt(walletBalA)}
              </button>
            )}
          </div>
          <input
            type="number"
            value={amountA}
            onChange={(e) => setAmountA(e.target.value)}
            placeholder="0.00"
            className="w-full mt-1.5 bg-shield-bg border border-shield-border rounded px-3 py-2.5 text-base font-mono tabular-nums focus:outline-none focus:border-shield-accent/50 text-shield-text placeholder:text-shield-static"
          />
          {aExceedsBalance && (
            <p className="font-mono text-[10px] text-shield-pink mt-1 uppercase tracking-wider">Exceeds wallet balance</p>
          )}
        </div>
        <div>
          <div className="flex items-center justify-between">
            <label className="font-mono text-[10px] tracking-wider uppercase text-shield-muted">
              {TOKEN_B_DISPLAY} Amount
            </label>
            {mode === "deposit" && (
              <button
                onClick={() => setAmountB(parseFloat(formatUnits(walletBalB, TOKEN_DECIMALS)).toString())}
                className="font-mono text-[10px] text-shield-accent hover:text-shield-accent/80 tracking-wider uppercase"
              >
                Max: {fmt(walletBalB)}
              </button>
            )}
          </div>
          <input
            type="number"
            value={amountB}
            onChange={(e) => setAmountB(e.target.value)}
            placeholder="0.00"
            className="w-full mt-1.5 bg-shield-bg border border-shield-border rounded px-3 py-2.5 text-base font-mono tabular-nums focus:outline-none focus:border-shield-accent/50 text-shield-text placeholder:text-shield-static"
          />
          {bExceedsBalance && (
            <p className="font-mono text-[10px] text-shield-pink mt-1 uppercase tracking-wider">Exceeds wallet balance</p>
          )}
        </div>
        <button
          onClick={handleSubmit}
          disabled={isPending || (!amountA && !amountB) || hasValidationError}
          className={`w-full py-3 rounded font-mono text-sm tracking-wider uppercase font-bold transition-colors disabled:opacity-40 ${
            mode === "deposit"
              ? "bg-shield-accent/10 text-shield-accent border border-shield-accent/30 hover:bg-shield-accent/20"
              : "bg-shield-pink/10 text-shield-pink border border-shield-pink/30 hover:bg-shield-pink/20"
          }`}
        >
          {isPending
            ? (approvalStep === "approveA" ? `Approving ${TOKEN_A_DISPLAY}...`
              : approvalStep === "approveB" ? `Approving ${TOKEN_B_DISPLAY}...`
              : "Processing...")
            : mode === "deposit" ? "Deposit" : "Withdraw"}
        </button>
      </div>
    </div>
  );
}
