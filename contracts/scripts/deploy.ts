import { ethers } from "hardhat";

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Deploying with:", deployer.address);
  console.log("Balance:", ethers.formatEther(await ethers.provider.getBalance(deployer.address)), "ETH");

  // 1. Deploy test tokens
  console.log("\n--- Deploying tokens ---");
  const Token = await ethers.getContractFactory("TestToken");

  const tokenA = await Token.deploy("Shield ETH", "shETH");
  await tokenA.waitForDeployment();
  console.log("TokenA (shETH):", await tokenA.getAddress());

  const tokenB = await Token.deploy("Shield USDC", "shUSDC");
  await tokenB.waitForDeployment();
  console.log("TokenB (shUSDC):", await tokenB.getAddress());

  // 2. Deploy BatchAuction (60 second batches)
  console.log("\n--- Deploying BatchAuction ---");
  const BatchAuction = await ethers.getContractFactory("BatchAuction");
  const auction = await BatchAuction.deploy(
    await tokenA.getAddress(),
    await tokenB.getAddress(),
    60 // 60 second batch duration
  );
  await auction.waitForDeployment();
  console.log("BatchAuction:", await auction.getAddress());

  // 3. Mint tokens to deployer for testing
  console.log("\n--- Minting test tokens ---");
  const mintAmount = ethers.parseEther("100000");
  await (await tokenA.mint(deployer.address, mintAmount)).wait();
  await (await tokenB.mint(deployer.address, mintAmount)).wait();
  console.log("Minted 100,000 shETH + 100,000 shUSDC to", deployer.address);

  // 4. Print env vars for frontend
  console.log("\n--- Frontend .env ---");
  console.log(`NEXT_PUBLIC_AUCTION_ADDRESS=${await auction.getAddress()}`);
  console.log(`NEXT_PUBLIC_TOKEN_A_ADDRESS=${await tokenA.getAddress()}`);
  console.log(`NEXT_PUBLIC_TOKEN_B_ADDRESS=${await tokenB.getAddress()}`);
  console.log(`NEXT_PUBLIC_RPC_URL=https://sepolia-rollup.arbitrum.io/rpc`);
  console.log(`NEXT_PUBLIC_CHAIN_ID=421614`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
