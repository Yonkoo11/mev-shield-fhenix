# MEV Shield Fhenix

FHE batch auction protocol. MEV-protected trading where orders are encrypted end-to-end using Fhenix CoFHE. No one can see individual orders before, during, or after settlement. Only the clearing price is publicly revealed.

## Buildathon
- Private By Design dApp Buildathon (Fhenix)
- 5 waves: March 20 - June 5, 2026
- 50,000 USDC grant pool
- Track: Confidential DeFi

## Architecture
- Price-tick accumulation for clearing price discovery over encrypted orders
- Max 4+4 orders per batch (Wave 1), 8 price ticks
- Only clearing tick decrypted publicly. Individual orders never revealed.
- FHERC20 for confidential token locking

## Stack
- Contracts: Hardhat + cofhe-hardhat-plugin 0.3.1, Solidity 0.8.25
- Frontend: Next.js 14 + wagmi v2 + cofhejs 0.3.1 (ported from MEV Shield Initia)
- Chains: Arbitrum Sepolia, Base Sepolia
- PINNED: hardhat 2.22.19, ethers 6.13.5 (newer breaks FHE mocks)

## Commands
```bash
cd contracts && pnpm test          # Run tests with FHE mocks
cd contracts && pnpm compile       # Compile Solidity
```

## Key FHE Patterns
- `FHE.allowThis(val)` after EVERY new ciphertext
- `FHE.allow(val, contract)` before cross-contract calls
- Decrypt is async: `FHE.decrypt()` then poll `FHE.getDecryptResultSafe()`
- Mock decrypt needs `time.increase(15)` in tests
- Client: `cofhejs.encrypt([Encryptable.uint64(val)])` for input
- Client: `cofhejs.unseal(ctHash, FheTypes.Uint64)` for private read

## Research
See ~/Projects/real-problems-and-products.md for competitive landscape.
See ai/memory.md for architecture decisions.
