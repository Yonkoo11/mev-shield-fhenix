# MEV Shield

**Trade without MEV.** FHE-encrypted batch auctions where orders are sealed with homomorphic encryption. Not even the contract can see your intent.

Built on [Fhenix CoFHE](https://www.fhenix.io/) for the Private By Design dApp Buildathon.

## How It Works

1. **Deposit** tokens into the auction contract
2. **Encrypt** your order (price tick + amount) client-side with cofhejs
3. **Batch closes** after the timer expires
4. **FHE settlement** computes the clearing price over ciphertext using price-tick accumulation
5. **Claim** your fill - only you can see your individual fill amount

The clearing price is the only value ever decrypted publicly. Individual orders remain private forever.

## Architecture

```
app/          Next.js 14 frontend (wagmi v2 + cofhejs 0.3.1)
contracts/    Solidity 0.8.25 (Hardhat + cofhe-hardhat-plugin)
settler/      Settlement bot (ethers v6)
```

### Price-Tick Accumulation

The contract uses 8 price ticks around a reference price. For each tick, it accumulates encrypted buy volume (orders willing to pay >= that price) and sell volume (orders willing to sell <= that price). The clearing tick is the highest tick where buy volume >= sell volume. All arithmetic happens on ciphertext via FHE operations.

### Security Features

- **Token locking**: funds locked while orders are active, preventing withdrawal front-running
- **Double-claim prevention**: each order can only be claimed once
- **No-crossing detection**: if buy/sell curves don't cross, batch settles with zero fills (no wasted gas on fill computation)
- **Arithmetic guards**: reference price validated against tick range to prevent underflow
- **Idempotent decrypt**: multiple decrypt requests are safely deduplicated

## Deployed (Arbitrum Sepolia)

| Contract | Address |
|----------|---------|
| BatchAuction | `0x5200B4fD4aD39b8b8f0A3cD127746F83d94E2140` |
| TokenA (shETH) | `0x66E176721862A4c41Fc8c6d8d31cE6E1284b4fb8` |
| TokenB (shUSDC) | `0xA0A564D5C2D8c8E01191Cb70E39322E85B1045EF` |

## Quick Start

### Contracts
```bash
cd contracts
pnpm install
pnpm test        # 13 tests, ~1 min (FHE mocks)
pnpm compile
```

### Frontend
```bash
cd app
bun install
bun next dev     # http://localhost:3000
bun next build   # static export to out/
```

### Settler Bot
```bash
cd settler
npm install
cp .env.example .env   # fill in PRIVATE_KEY and AUCTION_ADDRESS
npx tsx src/index.ts
```

The settler opens batches, waits for orders, triggers FHE settlement, polls for decryption, and finalizes. It handles empty batches, retries, and graceful shutdown.

## Stack

- **Contracts**: Hardhat 2.22.19, Solidity 0.8.25, cofhe-hardhat-plugin 0.3.1, OpenZeppelin 5.x
- **Frontend**: Next.js 14, wagmi v2, viem, cofhejs 0.3.1, Tailwind CSS
- **Settler**: ethers v6, TypeScript
- **Chain**: Arbitrum Sepolia (Fhenix CoFHE supported)

## Testing

```bash
cd contracts && pnpm test
```

Tests cover: deposit/withdraw, batch lifecycle, order submission, FHE settlement, token locking, double-claim prevention, expired batch handling, arithmetic guards, and end-to-end fill claiming with balance verification.
