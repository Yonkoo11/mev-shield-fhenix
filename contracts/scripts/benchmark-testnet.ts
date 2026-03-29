import { ethers } from "hardhat";
import { cofhejs, Encryptable, FheTypes } from "cofhejs/node";
import hre from "hardhat";

const BENCHMARK_ADDRESS = "0xf9e5a9E147856D9B26aB04202D79C2c3dA4a326B";

async function main() {
  const [signer] = await ethers.getSigners();
  console.log("Signer:", signer.address);

  // Initialize cofhejs for testnet
  console.log("Initializing cofhejs...");
  const initStart = Date.now();

  // On testnet, we need to use the real cofhejs init (not mock)
  const provider = signer.provider!;
  const result = await cofhejs.initializeWithEthers({
    ethersProvider: provider,
    ethersSigner: signer,
    environment: "TESTNET",
  });

  if (!result.success) {
    console.log("cofhejs init failed:", result.error);
    console.log("Trying without cofhejs - just testing contract calls...");

    // Fall back: just test that the contract is callable
    const bench = await ethers.getContractAt("Benchmark", BENCHMARK_ADDRESS);
    console.log("Contract connected. NUM_TICKS:", await bench.NUM_TICKS());
    console.log("MAX_ORDERS:", await bench.MAX_ORDERS());
    return;
  }

  console.log("cofhejs initialized in", Date.now() - initStart, "ms");

  const bench = await ethers.getContractAt("Benchmark", BENCHMARK_ADDRESS);

  // Test 1: Compare-Swap (3 FHE ops)
  console.log("\n=== Test 1: Compare-Swap ===");
  const [encA] = (await cofhejs.encrypt([Encryptable.uint64(50n)] as const)).data!;
  const [encB] = (await cofhejs.encrypt([Encryptable.uint64(100n)] as const)).data!;

  const t1 = Date.now();
  const tx1 = await bench.benchCompareSwap(encA, encB);
  const receipt1 = await tx1.wait();
  console.log("Compare-Swap tx:", Date.now() - t1, "ms");
  console.log("Gas used:", receipt1?.gasUsed.toString());

  // Request decrypt
  const t1d = Date.now();
  const txd1 = await bench.requestDecrypt();
  await txd1.wait();
  console.log("Decrypt request tx:", Date.now() - t1d, "ms");

  // Poll for result
  const t1p = Date.now();
  let ready = false;
  while (!ready) {
    const [a, b, r] = await bench.getResults();
    ready = r;
    if (ready) {
      console.log("Results ready:", a.toString(), b.toString());
      console.log("Decrypt poll time:", Date.now() - t1p, "ms");
    } else {
      await new Promise(resolve => setTimeout(resolve, 2000));
      console.log("Polling...", Date.now() - t1p, "ms elapsed");
    }
    if (Date.now() - t1p > 120000) {
      console.log("TIMEOUT: decryption took >120s");
      break;
    }
  }

  // Test 2: Batch settlement (4 orders, 8 ticks, ~200 FHE ops)
  console.log("\n=== Test 2: Price-Tick Settlement ===");

  // Reset batch
  const txReset = await bench.resetBatch();
  await txReset.wait();
  console.log("Batch reset");

  // Submit 2 buy + 2 sell orders
  const orders = [
    { type: "buy", tick: 5n, amount: 100n },
    { type: "buy", tick: 3n, amount: 100n },
    { type: "sell", tick: 2n, amount: 100n },
    { type: "sell", tick: 4n, amount: 100n },
  ];

  for (const order of orders) {
    const [encTick] = (await cofhejs.encrypt([Encryptable.uint8(order.tick)] as const)).data!;
    const [encAmt] = (await cofhejs.encrypt([Encryptable.uint64(order.amount)] as const)).data!;

    if (order.type === "buy") {
      const tx = await bench.submitBuyOrder(encTick, encAmt);
      await tx.wait();
    } else {
      const tx = await bench.submitSellOrder(encTick, encAmt);
      await tx.wait();
    }
    console.log(`Submitted ${order.type} at tick ${order.tick}`);
  }

  // Settle - THE CRITICAL MEASUREMENT
  console.log("\nSettling (this is the FHE computation)...");
  const t2 = Date.now();
  const tx2 = await bench.settle({ gasLimit: 30_000_000 });
  const receipt2 = await tx2.wait();
  console.log("Settle tx:", Date.now() - t2, "ms");
  console.log("Settle gas:", receipt2?.gasUsed.toString());

  // Poll for clearing tick decryption
  const t2p = Date.now();
  let cleared = false;
  while (!cleared) {
    const [tick, r] = await bench.getClearingTick();
    cleared = r;
    if (cleared) {
      console.log("Clearing tick:", tick.toString());
      console.log("Decrypt poll time:", Date.now() - t2p, "ms");
      console.log("\nTOTAL settlement time:", Date.now() - t2, "ms");
    } else {
      await new Promise(resolve => setTimeout(resolve, 3000));
      console.log("Polling...", Date.now() - t2p, "ms elapsed");
    }
    if (Date.now() - t2p > 300000) {
      console.log("TIMEOUT: settlement decryption took >5min");
      break;
    }
  }

  const balEnd = await ethers.provider.getBalance(signer.address);
  console.log("\nRemaining balance:", ethers.formatEther(balEnd), "ETH");
}

main().catch(console.error);
