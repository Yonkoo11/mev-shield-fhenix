// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import {
    FHE,
    euint8,
    euint64,
    ebool,
    InEuint8,
    InEuint64
} from "@fhenixprotocol/cofhe-contracts/FHE.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

/// @title BatchAuction
/// @notice FHE batch auction with price-tick accumulation.
///         Orders are encrypted. Only the clearing price is revealed.
///         Individual orders are never publicly decrypted.
contract BatchAuction {
    using SafeERC20 for IERC20;

    // ============ Constants ============

    uint8 public constant NUM_TICKS = 8;
    uint8 public constant MAX_ORDERS_PER_SIDE = 4;

    // ============ Enums ============

    enum BatchStatus { None, Open, Settling, Settled, Expired }

    // ============ Structs ============

    struct Order {
        address trader;
        euint8 priceTick;    // 0 to NUM_TICKS-1
        euint64 amount;      // token amount
        euint64 fillAmount;  // computed during settlement
        bool exists;
    }

    struct Batch {
        uint256 openedAt;
        uint256 closesAt;
        BatchStatus status;
        uint8 buyCount;
        uint8 sellCount;
        // Clearing result (decrypted)
        uint256 clearingTick;
        bool clearingReady;
        // Encrypted clearing tick (before decryption)
        euint8 encClearingTick;
        // Price config: ticks map to [refPrice - range/2, refPrice + range/2]
        uint256 refPrice;      // reference price (scaled by PRICE_SCALE)
        uint256 tickSpacing;   // price per tick (scaled by PRICE_SCALE)
        // No-crossing detection
        ebool encAnyCrossing;
        bool anyCrossing;
    }

    // ============ State ============

    IERC20 public tokenA;  // base token (what buyers want)
    IERC20 public tokenB;  // quote token (what buyers pay)

    uint256 public batchDuration;
    uint256 public currentBatchId;
    uint256 public constant PRICE_SCALE = 1e6;

    mapping(uint256 => Batch) public batches;
    mapping(uint256 => Order[MAX_ORDERS_PER_SIDE]) public buyOrders;
    mapping(uint256 => Order[MAX_ORDERS_PER_SIDE]) public sellOrders;

    // Encrypted volume accumulators (per batch, per tick)
    mapping(uint256 => euint64[NUM_TICKS]) internal buyVolume;
    mapping(uint256 => euint64[NUM_TICKS]) internal sellVolume;

    // User balances (deposited into the contract)
    mapping(address => uint256) public balanceA;
    mapping(address => uint256) public balanceB;

    // Track if user has an order in a batch
    mapping(uint256 => mapping(address => bool)) public hasOrder;

    // Token locking: prevent withdraw while order is active
    mapping(uint256 => mapping(address => uint256)) public lockedA;
    mapping(uint256 => mapping(address => uint256)) public lockedB;

    // Double-claim prevention
    mapping(uint256 => mapping(address => bool)) public claimed;

    // Idempotent fill decrypt requests
    mapping(uint256 => mapping(address => bool)) public fillDecryptRequested;

    // ============ Events ============

    event BatchOpened(uint256 indexed batchId, uint256 closesAt, uint256 refPrice, uint256 tickSpacing);
    event OrderSubmitted(uint256 indexed batchId, address indexed trader, bool isBuy);
    event SettlementTriggered(uint256 indexed batchId, uint8 numBuys, uint8 numSells);
    event BatchSettled(uint256 indexed batchId, uint256 clearingTick, uint256 clearingPrice);
    event Deposit(address indexed user, address token, uint256 amount);
    event Withdraw(address indexed user, address token, uint256 amount);
    event FillClaimed(uint256 indexed batchId, address indexed trader, uint256 fillAmount, bool isBuy);

    // ============ Errors ============

    error BatchNotOpen();
    error BatchNotClosed();
    error BatchNotSettling();
    error BatchNotSettled();
    error BatchAlreadyOpen();
    error SideFull();
    error AlreadyHasOrder();
    error AlreadyClaimed();
    error NeedOrdersBothSides();
    error DecryptionNotReady();
    error InsufficientBalance();
    error FundsLocked();
    error InvalidAmount();
    error RefPriceTooLow();
    error InvalidClearingTick();

    // ============ Constructor ============

    constructor(address _tokenA, address _tokenB, uint256 _batchDuration) {
        tokenA = IERC20(_tokenA);
        tokenB = IERC20(_tokenB);
        batchDuration = _batchDuration;
    }

    // ============ Deposit / Withdraw ============

    function deposit(uint256 amountA, uint256 amountB) external {
        if (amountA > 0) {
            tokenA.safeTransferFrom(msg.sender, address(this), amountA);
            balanceA[msg.sender] += amountA;
            emit Deposit(msg.sender, address(tokenA), amountA);
        }
        if (amountB > 0) {
            tokenB.safeTransferFrom(msg.sender, address(this), amountB);
            balanceB[msg.sender] += amountB;
            emit Deposit(msg.sender, address(tokenB), amountB);
        }
    }

    function withdraw(uint256 amountA, uint256 amountB) external {
        if (amountA > 0) {
            if (balanceA[msg.sender] < amountA) revert InsufficientBalance();
            uint256 totalLockedA = _totalLockedA(msg.sender);
            if (balanceA[msg.sender] - totalLockedA < amountA) revert FundsLocked();
            balanceA[msg.sender] -= amountA;
            tokenA.safeTransfer(msg.sender, amountA);
            emit Withdraw(msg.sender, address(tokenA), amountA);
        }
        if (amountB > 0) {
            if (balanceB[msg.sender] < amountB) revert InsufficientBalance();
            uint256 totalLockedB = _totalLockedB(msg.sender);
            if (balanceB[msg.sender] - totalLockedB < amountB) revert FundsLocked();
            balanceB[msg.sender] -= amountB;
            tokenB.safeTransfer(msg.sender, amountB);
            emit Withdraw(msg.sender, address(tokenB), amountB);
        }
    }

    /// @dev Sum locked amounts across all open/settling batches for tokenA
    function _totalLockedA(address user) internal view returns (uint256 total) {
        for (uint256 i = 1; i <= currentBatchId; i++) {
            BatchStatus s = batches[i].status;
            if (s == BatchStatus.Open || s == BatchStatus.Settling) {
                total += lockedA[i][user];
            }
        }
    }

    /// @dev Sum locked amounts across all open/settling batches for tokenB
    function _totalLockedB(address user) internal view returns (uint256 total) {
        for (uint256 i = 1; i <= currentBatchId; i++) {
            BatchStatus s = batches[i].status;
            if (s == BatchStatus.Open || s == BatchStatus.Settling) {
                total += lockedB[i][user];
            }
        }
    }

    // ============ Batch Lifecycle ============

    /// @notice Open a new batch. Anyone can call this.
    /// @param refPrice Reference price for this batch (PRICE_SCALE units)
    /// @param tickSpacing Price difference per tick (PRICE_SCALE units)
    function openBatch(uint256 refPrice, uint256 tickSpacing) external {
        // Arithmetic guard: refPrice must be large enough to prevent underflow
        if (refPrice < tickSpacing * (NUM_TICKS / 2)) revert RefPriceTooLow();

        Batch storage prev = batches[currentBatchId];
        // Allow opening if previous batch expired (past closesAt) without settlement
        if (prev.status == BatchStatus.Open && block.timestamp >= prev.closesAt) {
            prev.status = BatchStatus.Expired;
        }
        if (prev.status == BatchStatus.Open || prev.status == BatchStatus.Settling) {
            revert BatchAlreadyOpen();
        }

        currentBatchId++;
        Batch storage batch = batches[currentBatchId];
        batch.openedAt = block.timestamp;
        batch.closesAt = block.timestamp + batchDuration;
        batch.status = BatchStatus.Open;
        batch.refPrice = refPrice;
        batch.tickSpacing = tickSpacing;

        // Initialize encrypted volume accumulators
        for (uint8 i = 0; i < NUM_TICKS; i++) {
            buyVolume[currentBatchId][i] = FHE.asEuint64(0);
            sellVolume[currentBatchId][i] = FHE.asEuint64(0);
            FHE.allowThis(buyVolume[currentBatchId][i]);
            FHE.allowThis(sellVolume[currentBatchId][i]);
        }

        emit BatchOpened(currentBatchId, batch.closesAt, refPrice, tickSpacing);
    }

    /// @notice Submit an encrypted buy order (wants tokenA, pays tokenB)
    /// @param batchId The batch to submit to
    /// @param priceTick Encrypted tick index (0 = lowest price, NUM_TICKS-1 = highest)
    /// @param amount Encrypted amount of tokenA to buy
    function submitBuyOrder(
        uint256 batchId,
        InEuint8 calldata priceTick,
        InEuint64 calldata amount
    ) external {
        Batch storage batch = batches[batchId];
        if (batch.status != BatchStatus.Open) revert BatchNotOpen();
        if (block.timestamp >= batch.closesAt) revert BatchNotOpen();
        if (hasOrder[batchId][msg.sender]) revert AlreadyHasOrder();
        if (batch.buyCount >= MAX_ORDERS_PER_SIDE) revert SideFull();

        // Lock entire tokenB balance (conservative: encrypted amount is unknown)
        uint256 userBalB = balanceB[msg.sender];
        if (userBalB == 0) revert InsufficientBalance();
        lockedB[batchId][msg.sender] = userBalB;

        uint8 idx = batch.buyCount;
        buyOrders[batchId][idx].trader = msg.sender;
        buyOrders[batchId][idx].priceTick = FHE.asEuint8(priceTick);
        buyOrders[batchId][idx].amount = FHE.asEuint64(amount);
        buyOrders[batchId][idx].exists = true;

        FHE.allowThis(buyOrders[batchId][idx].priceTick);
        FHE.allowThis(buyOrders[batchId][idx].amount);
        // Let the trader view their own order
        FHE.allow(buyOrders[batchId][idx].priceTick, msg.sender);
        FHE.allow(buyOrders[batchId][idx].amount, msg.sender);

        batch.buyCount++;
        hasOrder[batchId][msg.sender] = true;

        emit OrderSubmitted(batchId, msg.sender, true);
    }

    /// @notice Submit an encrypted sell order (has tokenA, wants tokenB)
    function submitSellOrder(
        uint256 batchId,
        InEuint8 calldata priceTick,
        InEuint64 calldata amount
    ) external {
        Batch storage batch = batches[batchId];
        if (batch.status != BatchStatus.Open) revert BatchNotOpen();
        if (block.timestamp >= batch.closesAt) revert BatchNotOpen();
        if (hasOrder[batchId][msg.sender]) revert AlreadyHasOrder();
        if (batch.sellCount >= MAX_ORDERS_PER_SIDE) revert SideFull();

        // Lock entire tokenA balance (conservative: encrypted amount is unknown)
        uint256 userBalA = balanceA[msg.sender];
        if (userBalA == 0) revert InsufficientBalance();
        lockedA[batchId][msg.sender] = userBalA;

        uint8 idx = batch.sellCount;
        sellOrders[batchId][idx].trader = msg.sender;
        sellOrders[batchId][idx].priceTick = FHE.asEuint8(priceTick);
        sellOrders[batchId][idx].amount = FHE.asEuint64(amount);
        sellOrders[batchId][idx].exists = true;

        FHE.allowThis(sellOrders[batchId][idx].priceTick);
        FHE.allowThis(sellOrders[batchId][idx].amount);
        FHE.allow(sellOrders[batchId][idx].priceTick, msg.sender);
        FHE.allow(sellOrders[batchId][idx].amount, msg.sender);

        batch.sellCount++;
        hasOrder[batchId][msg.sender] = true;

        emit OrderSubmitted(batchId, msg.sender, false);
    }

    // ============ Settlement ============

    /// @notice Trigger settlement. Anyone can call after batch closes.
    ///         Runs the price-tick accumulation algorithm over encrypted orders.
    ///         Requests decryption of the clearing tick.
    function settle(uint256 batchId) external {
        Batch storage batch = batches[batchId];
        if (batch.status != BatchStatus.Open) revert BatchNotOpen();
        if (block.timestamp < batch.closesAt) revert BatchNotClosed();
        if (batch.buyCount == 0 || batch.sellCount == 0) revert NeedOrdersBothSides();

        batch.status = BatchStatus.Settling;

        euint64 zero64 = FHE.asEuint64(0);
        FHE.allowThis(zero64);

        // --- Price-tick accumulation ---
        // Buy volume at tick t = sum of amounts where order.priceTick >= t
        for (uint8 t = 0; t < NUM_TICKS; t++) {
            euint8 tickVal = FHE.asEuint8(t);
            FHE.allowThis(tickVal);

            for (uint8 i = 0; i < batch.buyCount; i++) {
                ebool wouldBuy = FHE.gte(buyOrders[batchId][i].priceTick, tickVal);
                FHE.allowThis(wouldBuy);
                euint64 contribution = FHE.select(wouldBuy, buyOrders[batchId][i].amount, zero64);
                FHE.allowThis(contribution);
                buyVolume[batchId][t] = FHE.add(buyVolume[batchId][t], contribution);
                FHE.allowThis(buyVolume[batchId][t]);
            }
        }

        // Sell volume at tick t = sum of amounts where order.priceTick <= t
        for (uint8 t = 0; t < NUM_TICKS; t++) {
            euint8 tickVal = FHE.asEuint8(t);
            FHE.allowThis(tickVal);

            for (uint8 i = 0; i < batch.sellCount; i++) {
                ebool wouldSell = FHE.lte(sellOrders[batchId][i].priceTick, tickVal);
                FHE.allowThis(wouldSell);
                euint64 contribution = FHE.select(wouldSell, sellOrders[batchId][i].amount, zero64);
                FHE.allowThis(contribution);
                sellVolume[batchId][t] = FHE.add(sellVolume[batchId][t], contribution);
                FHE.allowThis(sellVolume[batchId][t]);
            }
        }

        // Find clearing tick: highest tick where buyVolume >= sellVolume
        euint8 clearing = FHE.asEuint8(0);
        FHE.allowThis(clearing);

        // Track if ANY tick has a crossing (buyVolume >= sellVolume)
        ebool anyCross = FHE.asEbool(false);
        FHE.allowThis(anyCross);

        for (uint8 t = 0; t < NUM_TICKS; t++) {
            ebool crossed = FHE.gte(buyVolume[batchId][t], sellVolume[batchId][t]);
            FHE.allowThis(crossed);
            clearing = FHE.select(crossed, FHE.asEuint8(t), clearing);
            FHE.allowThis(clearing);
            anyCross = FHE.or(anyCross, crossed);
            FHE.allowThis(anyCross);
        }

        batch.encClearingTick = clearing;
        FHE.allowThis(batch.encClearingTick);

        batch.encAnyCrossing = anyCross;
        FHE.allowThis(batch.encAnyCrossing);

        // Request async decryption of both
        FHE.decrypt(batch.encClearingTick);
        FHE.decrypt(batch.encAnyCrossing);

        emit SettlementTriggered(batchId, batch.buyCount, batch.sellCount);
    }

    /// @notice Finalize settlement after decryption completes.
    ///         Distributes tokens based on the clearing price.
    function finalize(uint256 batchId) external {
        Batch storage batch = batches[batchId];
        if (batch.status != BatchStatus.Settling) revert BatchNotSettling();

        (uint8 tick, bool tickReady) = FHE.getDecryptResultSafe(batch.encClearingTick);
        if (!tickReady) revert DecryptionNotReady();

        // Validate decrypted tick is in range
        if (tick >= NUM_TICKS) revert InvalidClearingTick();

        // Check crossing result
        (bool crossed, bool crossReady) = FHE.getDecryptResultSafe(batch.encAnyCrossing);
        if (!crossReady) revert DecryptionNotReady();
        batch.anyCrossing = crossed;

        batch.clearingTick = tick;
        batch.clearingReady = true;
        batch.status = BatchStatus.Settled;

        if (!batch.anyCrossing) {
            // No crossing: no fills, just unlock funds
            emit BatchSettled(batchId, 0, 0);
            return;
        }

        // Convert tick to actual price
        uint256 clearingPrice = batch.refPrice
            - (batch.tickSpacing * (NUM_TICKS / 2))
            + (batch.tickSpacing * tick);

        _computeFills(batchId, tick);

        emit BatchSettled(batchId, tick, clearingPrice);
    }

    /// @notice Compute encrypted fill amounts for each order.
    ///         Called internally during finalize.
    function _computeFills(uint256 batchId, uint256 clearingTick) internal {
        euint8 encClearing = FHE.asEuint8(uint8(clearingTick));
        FHE.allowThis(encClearing);
        euint64 zero64 = FHE.asEuint64(0);
        FHE.allowThis(zero64);

        Batch storage batch = batches[batchId];

        // Buy fills: order fills if priceTick >= clearingTick
        for (uint8 i = 0; i < batch.buyCount; i++) {
            ebool fills = FHE.gte(buyOrders[batchId][i].priceTick, encClearing);
            FHE.allowThis(fills);
            buyOrders[batchId][i].fillAmount = FHE.select(
                fills,
                buyOrders[batchId][i].amount,
                zero64
            );
            FHE.allowThis(buyOrders[batchId][i].fillAmount);
            FHE.allow(buyOrders[batchId][i].fillAmount, buyOrders[batchId][i].trader);
        }

        // Sell fills: order fills if priceTick <= clearingTick
        for (uint8 i = 0; i < batch.sellCount; i++) {
            ebool fills = FHE.lte(sellOrders[batchId][i].priceTick, encClearing);
            FHE.allowThis(fills);
            sellOrders[batchId][i].fillAmount = FHE.select(
                fills,
                sellOrders[batchId][i].amount,
                zero64
            );
            FHE.allowThis(sellOrders[batchId][i].fillAmount);
            FHE.allow(sellOrders[batchId][i].fillAmount, sellOrders[batchId][i].trader);
        }
    }

    // ============ Claims ============

    /// @notice Request decryption of your fill amount (idempotent)
    function requestFillDecrypt(uint256 batchId) external {
        Batch storage batch = batches[batchId];
        if (batch.status != BatchStatus.Settled) revert BatchNotSettled();

        // Idempotent: skip if already requested
        if (fillDecryptRequested[batchId][msg.sender]) return;
        fillDecryptRequested[batchId][msg.sender] = true;

        // Find the user's order
        for (uint8 i = 0; i < batch.buyCount; i++) {
            if (buyOrders[batchId][i].trader == msg.sender) {
                FHE.decrypt(buyOrders[batchId][i].fillAmount);
                return;
            }
        }
        for (uint8 i = 0; i < batch.sellCount; i++) {
            if (sellOrders[batchId][i].trader == msg.sender) {
                FHE.decrypt(sellOrders[batchId][i].fillAmount);
                return;
            }
        }
    }

    /// @notice Claim filled tokens after fill decryption completes.
    function claimFill(uint256 batchId) external {
        Batch storage batch = batches[batchId];
        if (batch.status != BatchStatus.Settled) revert BatchNotSettled();
        if (claimed[batchId][msg.sender]) revert AlreadyClaimed();

        uint256 clearingPrice = batch.refPrice
            - (batch.tickSpacing * (NUM_TICKS / 2))
            + (batch.tickSpacing * batch.clearingTick);

        // Check buy orders
        for (uint8 i = 0; i < batch.buyCount; i++) {
            if (buyOrders[batchId][i].trader == msg.sender) {
                (uint64 fillAmt, bool ready) = FHE.getDecryptResultSafe(
                    buyOrders[batchId][i].fillAmount
                );
                if (!ready) revert DecryptionNotReady();

                claimed[batchId][msg.sender] = true;

                // Unlock funds
                lockedB[batchId][msg.sender] = 0;

                if (fillAmt > 0) {
                    // Buyer gets tokenA, pays tokenB at clearing price
                    uint256 cost = (fillAmt * clearingPrice) / PRICE_SCALE;
                    if (balanceB[msg.sender] < cost) revert InsufficientBalance();
                    balanceB[msg.sender] -= cost;
                    balanceA[msg.sender] += fillAmt;
                    emit FillClaimed(batchId, msg.sender, fillAmt, true);
                }
                return;
            }
        }

        // Check sell orders
        for (uint8 i = 0; i < batch.sellCount; i++) {
            if (sellOrders[batchId][i].trader == msg.sender) {
                (uint64 fillAmt, bool ready) = FHE.getDecryptResultSafe(
                    sellOrders[batchId][i].fillAmount
                );
                if (!ready) revert DecryptionNotReady();

                claimed[batchId][msg.sender] = true;

                // Unlock funds
                lockedA[batchId][msg.sender] = 0;

                if (fillAmt > 0) {
                    // Seller gives tokenA, gets tokenB at clearing price
                    uint256 proceeds = (fillAmt * clearingPrice) / PRICE_SCALE;
                    if (balanceA[msg.sender] < fillAmt) revert InsufficientBalance();
                    balanceA[msg.sender] -= fillAmt;
                    balanceB[msg.sender] += proceeds;
                    emit FillClaimed(batchId, msg.sender, fillAmt, false);
                }
                return;
            }
        }
    }

    // ============ Views ============

    function getBatch(uint256 batchId) external view returns (
        uint256 openedAt,
        uint256 closesAt,
        BatchStatus status,
        uint8 buyCount,
        uint8 sellCount,
        uint256 clearingTick,
        bool clearingReady,
        uint256 refPrice,
        uint256 tickSpacing
    ) {
        Batch storage b = batches[batchId];
        return (
            b.openedAt, b.closesAt, b.status,
            b.buyCount, b.sellCount,
            b.clearingTick, b.clearingReady,
            b.refPrice, b.tickSpacing
        );
    }

    function getClearingPrice(uint256 batchId) external view returns (uint256) {
        Batch storage b = batches[batchId];
        if (!b.clearingReady) return 0;
        if (!b.anyCrossing) return 0;
        return b.refPrice
            - (b.tickSpacing * (NUM_TICKS / 2))
            + (b.tickSpacing * b.clearingTick);
    }
}
