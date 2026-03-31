"use client";

import { useState, useCallback, useEffect } from "react";
import { usePublicClient, useWalletClient } from "wagmi";

// cofhejs types - imported dynamically to avoid SSR issues
type CofheState = "uninitialized" | "initializing" | "ready" | "error";

let cofheModule: typeof import("cofhejs/web") | null = null;

async function getCofhe() {
  if (!cofheModule) {
    cofheModule = await import("cofhejs/web");
  }
  return cofheModule;
}

export function useCofhe() {
  const [state, setState] = useState<CofheState>("uninitialized");
  const [error, setError] = useState<string | null>(null);
  const [initAddress, setInitAddress] = useState<string | null>(null);

  const publicClient = usePublicClient();
  const { data: walletClient } = useWalletClient();

  // Reset state when wallet changes (disconnect/reconnect/switch)
  useEffect(() => {
    const currentAddr = walletClient?.account?.address ?? null;
    if (initAddress && currentAddr !== initAddress) {
      setState("uninitialized");
      setError(null);
      setInitAddress(null);
    }
    if (!walletClient && state !== "uninitialized") {
      setState("uninitialized");
      setError(null);
      setInitAddress(null);
    }
  }, [walletClient, initAddress, state]);

  // Initialize cofhejs when wallet connects
  useEffect(() => {
    if (!walletClient || !publicClient || state !== "uninitialized") return;

    let cancelled = false;

    async function init() {
      setState("initializing");
      try {
        const { cofhejs } = await getCofhe();
        const result = await cofhejs.initializeWithViem({
          viemClient: publicClient,
          viemWalletClient: walletClient,
          environment: "TESTNET",
        });

        if (cancelled) return;

        if (result.success) {
          setState("ready");
          setInitAddress(walletClient!.account.address);
        } else {
          setState("error");
          setError(String(result.error) || "Failed to initialize cofhejs");
        }
      } catch (err) {
        if (cancelled) return;
        setState("error");
        setError(err instanceof Error ? err.message : "Unknown error");
      }
    }

    init();
    return () => {
      cancelled = true;
    };
  }, [walletClient, publicClient, state]);

  // Encrypt values for order submission
  const encryptOrder = useCallback(
    async (priceTick: number, amount: bigint) => {
      if (state !== "ready") {
        throw new Error("cofhejs not initialized");
      }

      const { cofhejs, Encryptable } = await getCofhe();

      const result = await cofhejs.encrypt([
        Encryptable.uint8(BigInt(priceTick)),
        Encryptable.uint64(amount),
      ] as const);

      if (!result.success || !result.data) {
        throw new Error(String(result.error) || "Encryption failed");
      }

      const [encryptedTick, encryptedAmount] = result.data;
      return { encryptedTick, encryptedAmount };
    },
    [state]
  );

  // Create a permit for unsealing encrypted values
  const createPermit = useCallback(async () => {
    if (state !== "ready" || !walletClient) {
      throw new Error("cofhejs not initialized");
    }

    const { cofhejs } = await getCofhe();
    const result = await cofhejs.createPermit({
      type: "self",
      issuer: walletClient.account.address,
    } as any);

    if (!result.success) {
      throw new Error(String(result.error) || "Failed to create permit");
    }

    return result.data;
  }, [state, walletClient]);

  // Unseal an encrypted value (view your own order/fill)
  const unseal = useCallback(
    async (ctHash: bigint, type: "uint8" | "uint64") => {
      if (state !== "ready") {
        throw new Error("cofhejs not initialized");
      }

      const { cofhejs, FheTypes } = await getCofhe();
      const fheType =
        type === "uint8" ? FheTypes.Uint8 : FheTypes.Uint64;

      const result = await cofhejs.unseal(ctHash, fheType);

      if (!result.success) {
        throw new Error(String(result.error) || "Unseal failed");
      }

      return result.data;
    },
    [state]
  );

  return {
    cofheState: state,
    cofheError: error,
    encryptOrder,
    createPermit,
    unseal,
  };
}
