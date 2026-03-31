import { defineChain } from "viem";
import BatchAuctionABI from "./BatchAuctionABI.json";

// -- Chain Configuration --
// Arbitrum Sepolia (Fhenix CoFHE supported)
export const arbSepolia = defineChain({
  id: 421614,
  name: "Arbitrum Sepolia",
  nativeCurrency: { name: "ETH", symbol: "ETH", decimals: 18 },
  rpcUrls: {
    default: {
      http: [
        process.env.NEXT_PUBLIC_RPC_URL ||
          "https://sepolia-rollup.arbitrum.io/rpc",
      ],
    },
  },
  blockExplorers: {
    default: { name: "Arbiscan", url: "https://sepolia.arbiscan.io" },
  },
  testnet: true,
});

// -- Deployed Contract Addresses --
export const BATCH_AUCTION_ADDRESS = (process.env.NEXT_PUBLIC_AUCTION_ADDRESS ||
  "0x5200B4fD4aD39b8b8f0A3cD127746F83d94E2140") as `0x${string}`;

export const TOKEN_A_ADDRESS = (process.env.NEXT_PUBLIC_TOKEN_A_ADDRESS ||
  "0x66E176721862A4c41Fc8c6d8d31cE6E1284b4fb8") as `0x${string}`;

export const TOKEN_B_ADDRESS = (process.env.NEXT_PUBLIC_TOKEN_B_ADDRESS ||
  "0xA0A564D5C2D8c8E01191Cb70E39322E85B1045EF") as `0x${string}`;

// -- Constants matching the Solidity contract --
export const PRICE_SCALE = 1_000_000n;
export const NUM_TICKS = 8;
export const MAX_ORDERS_PER_SIDE = 4;
export const TOKEN_DECIMALS = 18;

// Display names (shielded test tokens, not real ETH/USDC)
export const TOKEN_A_DISPLAY = "shETH";
export const TOKEN_B_DISPLAY = "shUSDC";

// -- ABI --
export const BATCH_AUCTION_ABI = BatchAuctionABI as readonly Record<
  string,
  unknown
>[];

// -- Standard ERC20 ABI --
export const ERC20_ABI = [
  {
    type: "function",
    name: "approve",
    stateMutability: "nonpayable",
    inputs: [
      { name: "spender", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [{ name: "", type: "bool" }],
  },
  {
    type: "function",
    name: "allowance",
    stateMutability: "view",
    inputs: [
      { name: "owner", type: "address" },
      { name: "spender", type: "address" },
    ],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    type: "function",
    name: "balanceOf",
    stateMutability: "view",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    type: "function",
    name: "decimals",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint8" }],
  },
  {
    type: "function",
    name: "symbol",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "string" }],
  },
  {
    type: "function",
    name: "mint",
    stateMutability: "nonpayable",
    inputs: [
      { name: "to", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [],
  },
] as const;

// -- Helper: convert tick index to actual price --
export function tickToPrice(
  tick: number,
  refPrice: bigint,
  tickSpacing: bigint
): bigint {
  return (
    refPrice -
    tickSpacing * BigInt(NUM_TICKS / 2) +
    tickSpacing * BigInt(tick)
  );
}

// -- Helper: format price for display --
export function formatPrice(price: bigint): string {
  const whole = price / PRICE_SCALE;
  const frac = price % PRICE_SCALE;
  const fracStr = frac.toString().padStart(6, "0").replace(/0+$/, "");
  return fracStr ? `${whole}.${fracStr}` : `${whole}`;
}
