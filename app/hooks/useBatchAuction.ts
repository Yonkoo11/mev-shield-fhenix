"use client";

import { useReadContract, useWriteContract, useAccount } from "wagmi";
import {
  BATCH_AUCTION_ABI,
  BATCH_AUCTION_ADDRESS,
  ERC20_ABI,
} from "../lib/contract";

// ============ Read Hooks ============

// -- Read: user balance (tokenA deposited) --
export function useBalanceA() {
  const { address } = useAccount();
  const { data, refetch, isLoading } = useReadContract({
    address: BATCH_AUCTION_ADDRESS,
    abi: BATCH_AUCTION_ABI,
    functionName: "balanceA",
    args: address ? [address] : undefined,
    query: { enabled: !!address, refetchInterval: 5000 },
  });
  return { balance: (data as bigint) ?? 0n, refetch, isLoading };
}

// -- Read: user balance (tokenB deposited) --
export function useBalanceB() {
  const { address } = useAccount();
  const { data, refetch, isLoading } = useReadContract({
    address: BATCH_AUCTION_ADDRESS,
    abi: BATCH_AUCTION_ABI,
    functionName: "balanceB",
    args: address ? [address] : undefined,
    query: { enabled: !!address, refetchInterval: 5000 },
  });
  return { balance: (data as bigint) ?? 0n, refetch, isLoading };
}

// -- Read: batch info --
export function useBatch(batchId: bigint | undefined) {
  const { data, refetch, isLoading } = useReadContract({
    address: BATCH_AUCTION_ADDRESS,
    abi: BATCH_AUCTION_ABI,
    functionName: "getBatch",
    args: batchId !== undefined ? [batchId] : undefined,
    query: { enabled: batchId !== undefined, refetchInterval: 3000 },
  });

  const arr = data as readonly unknown[] | undefined;
  return {
    batch: arr
      ? {
          openedAt: arr[0] as bigint,
          closesAt: arr[1] as bigint,
          status: Number(arr[2]),
          buyCount: Number(arr[3]),
          sellCount: Number(arr[4]),
          clearingTick: arr[5] as bigint,
          clearingReady: arr[6] as boolean,
          refPrice: arr[7] as bigint,
          tickSpacing: arr[8] as bigint,
        }
      : null,
    refetch,
    isLoading,
  };
}

// -- Read: current batch ID --
export function useCurrentBatchId() {
  const { data, refetch, isLoading } = useReadContract({
    address: BATCH_AUCTION_ADDRESS,
    abi: BATCH_AUCTION_ABI,
    functionName: "currentBatchId",
    query: { refetchInterval: 5000 },
  });
  return { currentBatchId: data as bigint | undefined, refetch, isLoading };
}

// -- Read: batch duration --
export function useBatchDuration() {
  const { data } = useReadContract({
    address: BATCH_AUCTION_ADDRESS,
    abi: BATCH_AUCTION_ABI,
    functionName: "batchDuration",
  });
  return { batchDuration: data as bigint | undefined };
}

// -- Read: clearing price --
export function useClearingPrice(batchId: bigint | undefined) {
  const { data, refetch } = useReadContract({
    address: BATCH_AUCTION_ADDRESS,
    abi: BATCH_AUCTION_ABI,
    functionName: "getClearingPrice",
    args: batchId !== undefined ? [batchId] : undefined,
    query: { enabled: batchId !== undefined, refetchInterval: 3000 },
  });
  return { clearingPrice: data as bigint | undefined, refetch };
}

// -- Read: hasOrder(batchId, user) --
export function useHasOrder(batchId: bigint | undefined) {
  const { address } = useAccount();
  const { data, refetch } = useReadContract({
    address: BATCH_AUCTION_ADDRESS,
    abi: BATCH_AUCTION_ABI,
    functionName: "hasOrder",
    args:
      batchId !== undefined && address ? [batchId, address] : undefined,
    query: {
      enabled: batchId !== undefined && !!address,
      refetchInterval: 5000,
    },
  });
  return { hasOrder: (data as boolean) ?? false, refetch };
}

// ============ Write Hooks ============

// -- Write: deposit --
export function useDeposit() {
  const { writeContract, isPending, isSuccess, isError, error, reset } =
    useWriteContract();

  const deposit = (amountA: bigint, amountB: bigint) => {
    writeContract({
      address: BATCH_AUCTION_ADDRESS,
      abi: BATCH_AUCTION_ABI,
      functionName: "deposit",
      args: [amountA, amountB],
    });
  };

  return { deposit, isPending, isSuccess, isError, error, reset };
}

// -- Write: withdraw --
export function useWithdraw() {
  const { writeContract, isPending, isSuccess, isError, error, reset } =
    useWriteContract();

  const withdraw = (amountA: bigint, amountB: bigint) => {
    writeContract({
      address: BATCH_AUCTION_ADDRESS,
      abi: BATCH_AUCTION_ABI,
      functionName: "withdraw",
      args: [amountA, amountB],
    });
  };

  return { withdraw, isPending, isSuccess, isError, error, reset };
}

// -- Write: open batch --
export function useOpenBatch() {
  const { writeContract, isPending, isSuccess, isError, error, reset } =
    useWriteContract();

  const openBatch = (refPrice: bigint, tickSpacing: bigint) => {
    writeContract({
      address: BATCH_AUCTION_ADDRESS,
      abi: BATCH_AUCTION_ABI,
      functionName: "openBatch",
      args: [refPrice, tickSpacing],
    });
  };

  return { openBatch, isPending, isSuccess, isError, error, reset };
}

// -- Write: submit buy order (encrypted args) --
// NOTE: priceTick and amount must be pre-encrypted via cofhejs.encrypt()
// The encrypted InEuint8/InEuint64 structs are passed directly
export function useSubmitBuyOrder() {
  const { writeContract, isPending, isSuccess, isError, error, reset } =
    useWriteContract();

  const submitBuyOrder = (
    batchId: bigint,
    encryptedPriceTick: unknown, // InEuint8 from cofhejs
    encryptedAmount: unknown // InEuint64 from cofhejs
  ) => {
    writeContract({
      address: BATCH_AUCTION_ADDRESS,
      abi: BATCH_AUCTION_ABI,
      functionName: "submitBuyOrder",
      args: [batchId, encryptedPriceTick, encryptedAmount],
    });
  };

  return { submitBuyOrder, isPending, isSuccess, isError, error, reset };
}

// -- Write: submit sell order (encrypted args) --
export function useSubmitSellOrder() {
  const { writeContract, isPending, isSuccess, isError, error, reset } =
    useWriteContract();

  const submitSellOrder = (
    batchId: bigint,
    encryptedPriceTick: unknown, // InEuint8 from cofhejs
    encryptedAmount: unknown // InEuint64 from cofhejs
  ) => {
    writeContract({
      address: BATCH_AUCTION_ADDRESS,
      abi: BATCH_AUCTION_ABI,
      functionName: "submitSellOrder",
      args: [batchId, encryptedPriceTick, encryptedAmount],
    });
  };

  return { submitSellOrder, isPending, isSuccess, isError, error, reset };
}

// -- Write: settle batch --
export function useSettle() {
  const { writeContract, isPending, isSuccess, isError, error, reset } =
    useWriteContract();

  const settle = (batchId: bigint) => {
    writeContract({
      address: BATCH_AUCTION_ADDRESS,
      abi: BATCH_AUCTION_ABI,
      functionName: "settle",
      args: [batchId],
    });
  };

  return { settle, isPending, isSuccess, isError, error, reset };
}

// -- Write: finalize batch (after decryption) --
export function useFinalize() {
  const { writeContract, isPending, isSuccess, isError, error, reset } =
    useWriteContract();

  const finalize = (batchId: bigint) => {
    writeContract({
      address: BATCH_AUCTION_ADDRESS,
      abi: BATCH_AUCTION_ABI,
      functionName: "finalize",
      args: [batchId],
    });
  };

  return { finalize, isPending, isSuccess, isError, error, reset };
}

// -- Write: request fill decrypt --
export function useRequestFillDecrypt() {
  const { writeContract, isPending, isSuccess, isError, error, reset } =
    useWriteContract();

  const requestFillDecrypt = (batchId: bigint) => {
    writeContract({
      address: BATCH_AUCTION_ADDRESS,
      abi: BATCH_AUCTION_ABI,
      functionName: "requestFillDecrypt",
      args: [batchId],
    });
  };

  return { requestFillDecrypt, isPending, isSuccess, isError, error, reset };
}

// -- Write: claim fill --
export function useClaimFill() {
  const { writeContract, isPending, isSuccess, isError, error, reset } =
    useWriteContract();

  const claimFill = (batchId: bigint) => {
    writeContract({
      address: BATCH_AUCTION_ADDRESS,
      abi: BATCH_AUCTION_ABI,
      functionName: "claimFill",
      args: [batchId],
    });
  };

  return { claimFill, isPending, isSuccess, isError, error, reset };
}

// ============ ERC20 Hooks (unchanged) ============

export function useApproveToken(tokenAddress: `0x${string}` | undefined) {
  const { writeContract, isPending, isSuccess, isError, error, reset } =
    useWriteContract();

  const approve = (spender: `0x${string}`, amount: bigint) => {
    if (!tokenAddress) return;
    writeContract({
      address: tokenAddress,
      abi: ERC20_ABI,
      functionName: "approve",
      args: [spender, amount],
    });
  };

  return { approve, isPending, isSuccess, isError, error, reset };
}

export function useTokenAllowance(
  tokenAddress: `0x${string}` | undefined,
  spender: `0x${string}`
) {
  const { address } = useAccount();
  const { data, refetch } = useReadContract({
    address: tokenAddress,
    abi: ERC20_ABI,
    functionName: "allowance",
    args: address ? [address, spender] : undefined,
    query: { enabled: !!tokenAddress && !!address, refetchInterval: 5000 },
  });
  return { allowance: data as bigint | undefined, refetch };
}

export function useWalletTokenBalance(
  tokenAddress: `0x${string}` | undefined
) {
  const { address } = useAccount();
  const { data, refetch, isLoading } = useReadContract({
    address: tokenAddress,
    abi: ERC20_ABI,
    functionName: "balanceOf",
    args: address ? [address] : undefined,
    query: { enabled: !!tokenAddress && !!address, refetchInterval: 5000 },
  });
  return { balance: (data as bigint) ?? 0n, refetch, isLoading };
}
