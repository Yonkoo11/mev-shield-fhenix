// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import "@fhenixprotocol/cofhe-contracts/FHE.sol";

/// @title FHE Operation Benchmark
/// @notice Measures feasibility of batch auction FHE operations.
///         Deploy on testnet, call functions, measure wall-clock time.
contract Benchmark {
    // --- Single operation benchmarks ---

    euint64 public resultA;
    euint64 public resultB;
    ebool public resultBool;

    /// @notice 1 comparison + 2 selects (one compare-swap unit)
    function benchCompareSwap(InEuint64 calldata a, InEuint64 calldata b) external {
        euint64 ea = FHE.asEuint64(a);
        euint64 eb = FHE.asEuint64(b);
        FHE.allowThis(ea);
        FHE.allowThis(eb);

        ebool isGt = FHE.gt(ea, eb);
        resultA = FHE.select(isGt, ea, eb);
        resultB = FHE.select(isGt, eb, ea);

        FHE.allowThis(resultA);
        FHE.allowThis(resultB);
        FHE.allowSender(resultA);
        FHE.allowSender(resultB);
    }

    /// @notice Decrypt results (call after benchCompareSwap, poll with getResults)
    function requestDecrypt() external {
        FHE.decrypt(resultA);
        FHE.decrypt(resultB);
    }

    function getResults() external view returns (uint256 a, uint256 b, bool ready) {
        (uint256 va, bool ra) = FHE.getDecryptResultSafe(resultA);
        (uint256 vb, bool rb) = FHE.getDecryptResultSafe(resultB);
        return (va, vb, ra && rb);
    }

    // --- Price-tick accumulation benchmark ---
    // This is the core algorithm for the batch auction.
    // Tests: can CoFHE handle N orders * K ticks of FHE operations?

    uint8 public constant NUM_TICKS = 8;
    uint8 public constant MAX_ORDERS = 4;

    struct EncryptedOrder {
        euint8 priceTick;  // 0-7
        euint64 amount;
        bool isBuy;
        bool exists;
    }

    EncryptedOrder[MAX_ORDERS] public buyOrders;
    EncryptedOrder[MAX_ORDERS] public sellOrders;
    uint8 public buyCount;
    uint8 public sellCount;

    euint64[NUM_TICKS] public buyVolume;
    euint64[NUM_TICKS] public sellVolume;
    euint8 public clearingTick;

    bool public settlementRequested;

    event OrderSubmitted(address indexed user, bool isBuy, uint8 orderIndex);
    event SettlementTriggered(uint8 numBuys, uint8 numSells);

    function resetBatch() external {
        buyCount = 0;
        sellCount = 0;
        settlementRequested = false;

        for (uint8 i = 0; i < NUM_TICKS; i++) {
            buyVolume[i] = FHE.asEuint64(0);
            sellVolume[i] = FHE.asEuint64(0);
            FHE.allowThis(buyVolume[i]);
            FHE.allowThis(sellVolume[i]);
        }

        clearingTick = FHE.asEuint8(0);
        FHE.allowThis(clearingTick);
    }

    function submitBuyOrder(InEuint8 calldata priceTick, InEuint64 calldata amount) external {
        require(buyCount < MAX_ORDERS, "Buy side full");
        uint8 idx = buyCount;
        buyOrders[idx].priceTick = FHE.asEuint8(priceTick);
        buyOrders[idx].amount = FHE.asEuint64(amount);
        buyOrders[idx].isBuy = true;
        buyOrders[idx].exists = true;
        FHE.allowThis(buyOrders[idx].priceTick);
        FHE.allowThis(buyOrders[idx].amount);
        FHE.allow(buyOrders[idx].priceTick, msg.sender);
        FHE.allow(buyOrders[idx].amount, msg.sender);
        buyCount++;
        emit OrderSubmitted(msg.sender, true, idx);
    }

    function submitSellOrder(InEuint8 calldata priceTick, InEuint64 calldata amount) external {
        require(sellCount < MAX_ORDERS, "Sell side full");
        uint8 idx = sellCount;
        sellOrders[idx].priceTick = FHE.asEuint8(priceTick);
        sellOrders[idx].amount = FHE.asEuint64(amount);
        sellOrders[idx].isBuy = false;
        sellOrders[idx].exists = true;
        FHE.allowThis(sellOrders[idx].priceTick);
        FHE.allowThis(sellOrders[idx].amount);
        FHE.allow(sellOrders[idx].priceTick, msg.sender);
        FHE.allow(sellOrders[idx].amount, msg.sender);
        sellCount++;
        emit OrderSubmitted(msg.sender, false, idx);
    }

    /// @notice The core algorithm: price-tick accumulation + clearing price discovery.
    ///         For 4 buys + 4 sells with 8 ticks:
    ///         - 4 orders * 8 ticks * 3 ops (gte + select + add) = 96 buy-side ops
    ///         - 4 orders * 8 ticks * 3 ops = 96 sell-side ops
    ///         - 8 ticks * 2 ops (gte + select) = 16 clearing scan ops
    ///         Total: ~208 FHE operations
    function settle() external {
        require(!settlementRequested, "Already settling");
        require(buyCount > 0 && sellCount > 0, "Need orders on both sides");

        euint64 zero64 = FHE.asEuint64(0);
        FHE.allowThis(zero64);

        // Accumulate buy volume at each tick.
        // Buy volume at tick t = sum of amounts where order.priceTick >= t
        for (uint8 t = 0; t < NUM_TICKS; t++) {
            euint8 tickVal = FHE.asEuint8(t);
            FHE.allowThis(tickVal);

            for (uint8 i = 0; i < buyCount; i++) {
                // Would this buy order trade at tick t?
                ebool wouldBuy = FHE.gte(buyOrders[i].priceTick, tickVal);
                FHE.allowThis(wouldBuy);

                // If yes, add its amount; if no, add 0
                euint64 contribution = FHE.select(wouldBuy, buyOrders[i].amount, zero64);
                FHE.allowThis(contribution);

                buyVolume[t] = FHE.add(buyVolume[t], contribution);
                FHE.allowThis(buyVolume[t]);
            }
        }

        // Accumulate sell volume at each tick.
        // Sell volume at tick t = sum of amounts where order.priceTick <= t
        for (uint8 t = 0; t < NUM_TICKS; t++) {
            euint8 tickVal = FHE.asEuint8(t);
            FHE.allowThis(tickVal);

            for (uint8 i = 0; i < sellCount; i++) {
                ebool wouldSell = FHE.lte(sellOrders[i].priceTick, tickVal);
                FHE.allowThis(wouldSell);

                euint64 contribution = FHE.select(wouldSell, sellOrders[i].amount, zero64);
                FHE.allowThis(contribution);

                sellVolume[t] = FHE.add(sellVolume[t], contribution);
                FHE.allowThis(sellVolume[t]);
            }
        }

        // Find clearing tick: highest tick where buyVolume >= sellVolume
        for (uint8 t = 0; t < NUM_TICKS; t++) {
            ebool crossed = FHE.gte(buyVolume[t], sellVolume[t]);
            FHE.allowThis(crossed);

            clearingTick = FHE.select(crossed, FHE.asEuint8(t), clearingTick);
            FHE.allowThis(clearingTick);
        }

        // Request decryption of clearing tick
        FHE.decrypt(clearingTick);
        settlementRequested = true;

        emit SettlementTriggered(buyCount, sellCount);
    }

    function getClearingTick() external view returns (uint256 tick, bool ready) {
        (uint256 val, bool decrypted) = FHE.getDecryptResultSafe(clearingTick);
        return (val, decrypted);
    }
}
