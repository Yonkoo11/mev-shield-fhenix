# MEV Shield Fhenix - Progress

## Status: All planned work complete. Frontend deployed with faucet. Not end-to-end tested with real FHE.

### Deployed Addresses (Arb Sepolia)
- BatchAuction: `0x5200B4fD4aD39b8b8f0A3cD127746F83d94E2140`
- TokenA (shETH): `0x66E176721862A4c41Fc8c6d8d31cE6E1284b4fb8`
- TokenB (shUSDC): `0xA0A564D5C2D8c8E01191Cb70E39322E85B1045EF`
- Deployer: `0xf9946775891a24462cD4ec885d0D4E2675C84355`

### Contract Fixes (BatchAuction.sol) - DONE
1. `Expired` status (enum value 4)
2. Token locking: `lockedA/lockedB` mappings, `FundsLocked` error
3. `claimed` mapping, `AlreadyClaimed` error
4. No-crossing detection via `FHE.or()` on `encAnyCrossing`
5. `RefPriceTooLow` arithmetic guard
6. `fillDecryptRequested` idempotency
7. `InvalidClearingTick` range guard
8. Fixed FHE return types: `(uint8, bool)`, `(bool, bool)`, `(uint64, bool)`

### Tests - DONE (13 passing, 1m) - verified 2026-03-31
- 9 BatchAuction tests (deposit/withdraw, lifecycle, locking, double-claim, expired, refPrice, e2e)
- 4 Benchmark tests (compare-swap, price-tick accumulation)

### Settler Bot - DONE, verified on live contract (prior session)
- Opened batch #1 on Arb Sepolia, waited 60s, detected 0 orders, skipped correctly
- Opened batch #2, graceful shutdown on SIGTERM

### Frontend - DEPLOYED (2026-03-31)
- **Live:** https://yonkoo11.github.io/mev-shield-fhenix/
- **Design:** "Signal & Noise" monospace theme
- **New:** In-app test token faucet (mint shETH + shUSDC directly)
- **Build:** `next build` succeeds, `tsc --noEmit` = 0 errors (verified 2026-03-31)
- Connected-state components styled but NOT tested with a real wallet

### What's NOT been tested end-to-end
- cofhejs client-side encryption (encrypt order -> submit -> get fill)
- FHE decrypt latency on real Arb Sepolia for 200+ ops
- Actual gas costs for settle() with real FHE (7.2M limit set in settler)

### Dev Server Note
- Use `bun next dev`. `npx next dev` hangs due to Node module resolution on wagmi+walletconnect dep tree.
- First compile ~90s, subsequent loads ~4s.
- After `bun install`, node_modules sometimes gets wiped on branch switch. Re-run `bun install` if `next build` says "no such file".
