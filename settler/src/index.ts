import { ethers } from "ethers";
import * as dotenv from "dotenv";
dotenv.config();

// -- Config --
const RPC_URL = process.env.RPC_URL || "https://sepolia-rollup.arbitrum.io/rpc";
const PRIVATE_KEY = process.env.PRIVATE_KEY || "";
const AUCTION_ADDRESS = process.env.AUCTION_ADDRESS || "";
const REF_PRICE = BigInt(process.env.REF_PRICE || "1000000"); // 1.0 in PRICE_SCALE
const TICK_SPACING = BigInt(process.env.TICK_SPACING || "100000"); // 0.1 in PRICE_SCALE
const RETRY_DELAY_MS = 3000;
const MAX_RETRIES = 3;
const SETTLE_GAS_LIMIT = 7_200_000n; // 7.2M proven on testnet
const DECRYPT_POLL_INTERVAL_MS = 5000;
const DECRYPT_TIMEOUT_MS = 120_000;

// Fhenix BatchAuction ABI (3-step settlement: openBatch, settle, finalize)
const BATCH_AUCTION_ABI = [
  "function openBatch(uint256 refPrice, uint256 tickSpacing) external",
  "function settle(uint256 batchId) external",
  "function finalize(uint256 batchId) external",
  "function currentBatchId() view returns (uint256)",
  "function batchDuration() view returns (uint256)",
  "function getBatch(uint256) view returns (uint256 openedAt, uint256 closesAt, uint8 status, uint8 buyCount, uint8 sellCount, uint256 clearingTick, bool clearingReady, uint256 refPrice, uint256 tickSpacing)",
  "function getClearingPrice(uint256) view returns (uint256)",
  "event BatchOpened(uint256 indexed batchId, uint256 closesAt, uint256 refPrice, uint256 tickSpacing)",
  "event SettlementTriggered(uint256 indexed batchId, uint8 numBuys, uint8 numSells)",
  "event BatchSettled(uint256 indexed batchId, uint256 clearingTick, uint256 clearingPrice)",
];

// -- Structured logging --
function log(level: "INFO" | "WARN" | "ERROR", msg: string) {
  const ts = new Date().toISOString();
  console.log(`[${ts}] [${level}] ${msg}`);
}

// -- Retry wrapper --
async function withRetry<T>(fn: () => Promise<T>, label: string): Promise<T> {
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      return await fn();
    } catch (err: any) {
      const msg = err.shortMessage || err.message || String(err);
      if (attempt === MAX_RETRIES) throw err;
      log("WARN", `${label} attempt ${attempt}/${MAX_RETRIES} failed: ${msg}`);
      await sleep(RETRY_DELAY_MS * attempt);
    }
  }
  throw new Error("unreachable");
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

// -- Startup health checks --
async function healthCheck(
  provider: ethers.JsonRpcProvider,
  wallet: ethers.Wallet,
  auction: ethers.Contract
) {
  const blockNum = await withRetry(() => provider.getBlockNumber(), "RPC connection");
  log("INFO", `RPC connected, block #${blockNum}`);

  const balance = await provider.getBalance(wallet.address);
  if (balance === 0n) {
    log("WARN", "Wallet has zero gas balance");
  } else {
    log("INFO", `Wallet gas: ${ethers.formatEther(balance)} ETH`);
  }

  const code = await provider.getCode(AUCTION_ADDRESS);
  if (code === "0x") {
    log("ERROR", `No contract at ${AUCTION_ADDRESS}`);
    process.exit(1);
  }
  log("INFO", `Contract verified at ${AUCTION_ADDRESS}`);

  const duration = await auction.batchDuration();
  log("INFO", `Batch duration: ${duration}s`);
}

// -- Wait for batch to close --
async function waitForBatchClose(
  provider: ethers.JsonRpcProvider,
  closeAt: bigint,
  batchDuration: number
) {
  const closeTime = Number(closeAt);
  const wallDeadline = Date.now() + (batchDuration + 2) * 1000;

  while (true) {
    if (Date.now() >= wallDeadline) {
      log("INFO", "Wall-clock deadline reached, proceeding to settle");
      return;
    }

    const block = await provider.getBlock("latest");
    if (block && block.timestamp >= closeTime) {
      log("INFO", "On-chain time past closeAt, proceeding to settle");
      return;
    }

    const wallRemaining = Math.ceil((wallDeadline - Date.now()) / 1000);
    log("INFO", `Waiting ~${wallRemaining}s for batch close`);
    await sleep(5000);
  }
}

// -- Poll for decryption readiness --
async function waitForDecryption(
  auction: ethers.Contract,
  batchId: bigint
): Promise<boolean> {
  const start = Date.now();
  while (Date.now() - start < DECRYPT_TIMEOUT_MS) {
    const batch = await auction.getBatch(batchId);
    if (batch.clearingReady) {
      return true;
    }
    log("INFO", `Waiting for decryption (${Math.round((Date.now() - start) / 1000)}s elapsed)...`);
    await sleep(DECRYPT_POLL_INTERVAL_MS);
  }
  return false;
}

// -- Main loop --
let shuttingDown = false;

async function main() {
  if (!PRIVATE_KEY || !AUCTION_ADDRESS) {
    log("ERROR", "Set PRIVATE_KEY and AUCTION_ADDRESS in .env");
    process.exit(1);
  }

  const provider = new ethers.JsonRpcProvider(RPC_URL);
  const wallet = new ethers.Wallet(PRIVATE_KEY, provider);
  const auction = new ethers.Contract(AUCTION_ADDRESS, BATCH_AUCTION_ABI, wallet);

  log("INFO", `Settler starting: ${wallet.address}`);
  log("INFO", `Auction: ${AUCTION_ADDRESS}`);
  log("INFO", `RPC: ${RPC_URL}`);
  log("INFO", `RefPrice: ${REF_PRICE}, TickSpacing: ${TICK_SPACING}`);

  await healthCheck(provider, wallet, auction);

  // Graceful shutdown
  const shutdown = () => {
    log("INFO", "Shutdown signal received, finishing current cycle...");
    shuttingDown = true;
  };
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);

  while (!shuttingDown) {
    try {
      // Step 1: Open a new batch
      log("INFO", "Opening new batch...");
      const tx1 = await withRetry(
        () => auction.openBatch(REF_PRICE, TICK_SPACING),
        "openBatch"
      );
      const receipt1 = await tx1.wait();

      const batchId = await auction.currentBatchId();
      log("INFO", `Batch #${batchId} opened (tx: ${receipt1.hash})`);

      // Step 2: Wait for batch to close
      const batch = await auction.getBatch(batchId);
      const closeAt = batch.closesAt;
      const duration = Number(await auction.batchDuration());
      await waitForBatchClose(provider, closeAt, duration);

      // Re-read batch to check orders
      const freshBatch = await auction.getBatch(batchId);
      const buyCount = Number(freshBatch.buyCount);
      const sellCount = Number(freshBatch.sellCount);

      if (buyCount === 0 || sellCount === 0) {
        log("INFO", `Batch #${batchId}: need orders both sides (buys=${buyCount}, sells=${sellCount}), skipping`);
        continue;
      }

      log("INFO", `Batch #${batchId}: ${buyCount} buys, ${sellCount} sells, settling...`);

      // Step 3: Settle (triggers FHE computation + decrypt request)
      const tx2 = await withRetry(
        () => auction.settle(batchId, { gasLimit: SETTLE_GAS_LIMIT }),
        "settle"
      );
      const receipt2 = await tx2.wait();
      log("INFO", `Batch #${batchId} settle tx: ${receipt2.hash}, gas used: ${receipt2.gasUsed}`);

      // Step 4: Poll for decryption readiness
      log("INFO", `Waiting for FHE decryption (polling every ${DECRYPT_POLL_INTERVAL_MS / 1000}s, timeout ${DECRYPT_TIMEOUT_MS / 1000}s)...`);
      const ready = await waitForDecryption(auction, batchId);

      if (!ready) {
        log("ERROR", `Batch #${batchId}: decryption timed out after ${DECRYPT_TIMEOUT_MS / 1000}s`);
        continue;
      }

      // Step 5: Finalize (distributes tokens)
      const tx3 = await withRetry(
        () => auction.finalize(batchId),
        "finalize"
      );
      const receipt3 = await tx3.wait();

      // Read clearing price
      const clearingPrice = await auction.getClearingPrice(batchId);
      const settledBatch = await auction.getBatch(batchId);

      log("INFO", `Batch #${batchId} finalized! Clearing tick=${settledBatch.clearingTick}, price=${clearingPrice} (tx: ${receipt3.hash})`);
    } catch (err: any) {
      const msg = err.shortMessage || err.message || String(err);
      if (msg.includes("NeedOrdersBothSides")) {
        log("INFO", "No orders on both sides, continuing...");
      } else if (msg.includes("BatchAlreadyOpen")) {
        log("WARN", "Batch already open, waiting...");
        await sleep(10000);
      } else {
        log("ERROR", `Settler error: ${msg}`);
      }
      await sleep(5000);
    }
  }

  log("INFO", "Settler stopped gracefully");
  process.exit(0);
}

main().catch((err) => {
  log("ERROR", `Fatal: ${err.message || err}`);
  process.exit(1);
});
