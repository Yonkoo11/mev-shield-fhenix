# MEV Shield Fhenix - Project Memory

## Hackathon
- **Name:** Private By Design dApp Buildathon
- **Sponsor:** Fhenix (FHE protocol)
- **URL:** https://app.akindo.io/wave-hacks/Nm2qjzEBgCqJD90W
- **Grant Pool:** 50,000 USDC on Arbitrum
- **Wave 1 Deadline:** ~March 30, 2026 (submitted)
- **Wave 2 Start:** April 4, 2026
- **Waves:** 5 total (March 20 - June 5)
- **Track:** Confidential DeFi (sealed-bid auctions, MEV-protected execution)
- **Judging:** Privacy Architecture, Innovation & Originality, UX, Technical Execution, Market Potential
- **Submit:** Protocol concept + milestones on AKINDO
- **26 Wave 1 submissions** (PrivaBid, PrivateFills, fhe-agent-shield, Shadowlancer, SCAN, etc.)

## Architecture Decisions
- **Algorithm:** Price-tick accumulation (NOT sorting network). Fixed K price ticks, accumulate encrypted demand/supply at each, scan for crossing point.
- **Why not sorting networks:** Simpler, more parallelizable, discrete ticks are standard for exchanges.
- **Why not "running maximum" (PoC pattern):** Running max finds single best bid. We need clearing price across multiple orders on both sides.
- **FHE ops per settlement (4+4 orders, 8 ticks):** ~208 operations. Parallel depth ~40.
- **Decryption:** Only clearing tick is publicly decrypted. Individual orders NEVER decrypted publicly.

## Tech Stack
- **Contracts:** Hardhat + cofhe-hardhat-plugin 0.3.1, Solidity 0.8.25
- **SDK:** cofhejs 0.3.1 (NOT @cofhe/sdk - different API)
- **Frontend:** Next.js 14 + wagmi v2 + viem v2 (port from MEV Shield Initia)
- **Chains:** Arbitrum Sepolia (primary), Base Sepolia (secondary)
- **Tokens:** FHERC20 (shield/unshield model from sealed-bid PoC)
- **Pinned versions:** hardhat 2.22.19, ethers 6.13.5 (newer versions break mock ZkVerifier)

## Key FHE Patterns (from Fhenix PoC)
- Every new ciphertext needs `FHE.allowThis()` for persistent access
- Cross-contract calls need `FHE.allow(value, targetContract)`
- Decryption is async: `FHE.decrypt()` in tx1, `FHE.getDecryptResultSafe()` in tx2
- Mock decryption has 1-10s delay - use `time.increase(15)` in tests
- Client encrypt: `cofhejs.encrypt([Encryptable.uint64(val)])` returns `InEuint64`
- Client unseal: `cofhejs.unseal(ctHash, FheTypes.Uint64)` for private read

## Competitive Edge
- PrivaBid: single-item sealed-bid auction (just Fhenix PoC pattern). We do multi-party batch settlement.
- PrivateFills: dark-pool with trusted operator model. We're trustless (FHE, no operator sees orders).
- FHE Dark Pools (failed EthCC 6 project): tried off-chain solving, FHE comparisons return ciphertext so solver can't read results. Our approach: ALL computation on-chain, no off-chain solving needed.

## Research Base
See ~/Projects/real-problems-and-products.md - Problem #1 (MEV), Tier 2 for L2s.
$600M/year MEV extraction. CoW Protocol proved batch auctions work ($36B volume on ETH).

## What's Proven
- Benchmark contract compiles and passes all 4 tests with FHE mocks
- Price-tick accumulation correctly finds clearing tick for 2+2 and 1+1 order scenarios
- Compare-swap (gt + select) works correctly on encrypted values
- Full contract with all 8 bug fixes: 13 tests passing (verified 2026-03-31)
- Settler bot ran live on Arb Sepolia: opened batches, handled 0-order case, graceful shutdown
- Frontend builds cleanly (`next build` + `tsc --noEmit` = 0 errors)
- Deployed to Arb Sepolia at 0x5200B4fD4aD39b8b8f0A3cD127746F83d94E2140

## What's NOT Proven
- End-to-end with real wallet: submit encrypted order -> settle -> claim (FHE decrypt on testnet)
- cofhejs client-side encryption has never been tested live in the frontend
- Gas costs on real testnet with 200+ FHE ops (mock gas is inflated)
