# MEV Shield Fhenix - Progress

## Status: 9 bugs fixed and deployed. Code is solid. Not end-to-end tested with real FHE wallet flow.

### Deployed Addresses (Arb Sepolia)
- BatchAuction: `0x5200B4fD4aD39b8b8f0A3cD127746F83d94E2140`
- TokenA (shETH): `0x66E176721862A4c41Fc8c6d8d31cE6E1284b4fb8`
- TokenB (shUSDC): `0xA0A564D5C2D8c8E01191Cb70E39322E85B1045EF`
- Deployer: `0xf9946775891a24462cD4ec885d0D4E2675C84355`

### Contract (BatchAuction.sol) - DONE, 13 tests passing
8 bug fixes: Expired enum, token locking, claimed mapping, no-crossing detection,
RefPriceTooLow guard, fillDecryptRequested idempotency, InvalidClearingTick, FHE return types.

### Settler Bot - DONE
3-step loop: openBatch -> settle -> finalize. Verified on live contract (prior session).

### Frontend - DEPLOYED to gh-pages (2026-03-31)
- **Live:** https://yonkoo11.github.io/mev-shield-fhenix/
- All 9 bugs fixed and deployed:
  1. useCofhe: FHE state resets on wallet disconnect/switch
  2. useCofhe: createPermit stale closure
  3. BridgePanel: unstable useEffect deps
  4. Token names: ETH/USDC -> shETH/shUSDC
  5. BatchTimer: status comment
  6. errors.ts: added missing contract errors
  7. OrderForm + DepositPanel: wired parseContractError
  8. BatchTimer: was faking "settling" when batch just expired with 0 orders
  9. NoiseAnimation: React hydration error #418/#423 (server/client mismatch)

### What's NOT been tested
- cofhejs client-side encryption (encrypt order -> submit -> get fill)
- Full e2e: two wallets submit orders -> settler settles -> users claim fills
- FHE decrypt latency and gas on real Arb Sepolia

### Dev Server Note
- Use `bun next dev`. First compile ~90s, subsequent ~4s.
- `next build` needs ~2GB RAM. Kill other processes if OOM.
- Re-run `bun install` if node_modules gets wiped on branch switch.
