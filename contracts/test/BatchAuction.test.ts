import { loadFixture, time } from '@nomicfoundation/hardhat-toolbox/network-helpers'
import { expect } from 'chai'
import hre from 'hardhat'
import { cofhejs, Encryptable } from 'cofhejs/node'

const PRICE_SCALE = 1_000_000n
const BATCH_DURATION = 60 // seconds

describe('BatchAuction', function () {
	async function deployFixture() {
		const [deployer, alice, bob, carol, dave] = await hre.ethers.getSigners()

		// Deploy test tokens
		const Token = await hre.ethers.getContractFactory('TestToken')
		const tokenA = await Token.deploy('Token A', 'TKA')
		const tokenB = await Token.deploy('Token B', 'TKB')

		// Deploy batch auction
		const BatchAuction = await hre.ethers.getContractFactory('BatchAuction')
		const auction = await BatchAuction.deploy(
			await tokenA.getAddress(),
			await tokenB.getAddress(),
			BATCH_DURATION
		)
		const auctionAddr = await auction.getAddress()

		// Mint tokens to traders
		const mintAmount = 100_000n * 10n ** 18n
		for (const user of [alice, bob, carol, dave]) {
			await tokenA.mint(user.address, mintAmount)
			await tokenB.mint(user.address, mintAmount)
			await tokenA.connect(user).approve(auctionAddr, mintAmount)
			await tokenB.connect(user).approve(auctionAddr, mintAmount)
		}

		return { auction, tokenA, tokenB, deployer, alice, bob, carol, dave }
	}

	describe('Deposit and Withdraw', function () {
		it('should deposit and track balances', async function () {
			const { auction, alice } = await loadFixture(deployFixture)

			await auction.connect(alice).deposit(1000n, 5000n)

			expect(await auction.balanceA(alice.address)).to.equal(1000n)
			expect(await auction.balanceB(alice.address)).to.equal(5000n)
		})

		it('should withdraw deposited tokens', async function () {
			const { auction, alice, tokenA } = await loadFixture(deployFixture)
			const balBefore = await tokenA.balanceOf(alice.address)

			await auction.connect(alice).deposit(1000n, 0n)
			await auction.connect(alice).withdraw(500n, 0n)

			expect(await auction.balanceA(alice.address)).to.equal(500n)
			expect(await tokenA.balanceOf(alice.address)).to.equal(balBefore - 500n)
		})
	})

	describe('Batch Lifecycle', function () {
		beforeEach(function () {
			if (!hre.cofhe.isPermittedEnvironment('MOCK')) this.skip()
		})

		it('should open a batch', async function () {
			const { auction } = await loadFixture(deployFixture)

			// refPrice = 1.0 (1_000_000), tickSpacing = 0.05 (50_000)
			await auction.openBatch(PRICE_SCALE, 50_000n)

			const batchId = await auction.currentBatchId()
			expect(batchId).to.equal(1n)

			const batch = await auction.getBatch(1n)
			expect(batch.status).to.equal(1n) // Open
		})

		it('should submit orders and settle', async function () {
			const { auction, deployer, alice, bob, carol, dave } = await loadFixture(deployFixture)

			await hre.cofhe.expectResultSuccess(hre.cofhe.initializeWithHardhatSigner(deployer))

			// Deposit tokens
			const depositAmt = 10000n * 10n ** 18n
			await auction.connect(alice).deposit(0n, depositAmt)  // buyer
			await auction.connect(bob).deposit(0n, depositAmt)    // buyer
			await auction.connect(carol).deposit(depositAmt, 0n)  // seller
			await auction.connect(dave).deposit(depositAmt, 0n)   // seller

			// Open batch: refPrice = 1.0, tickSpacing = 0.1
			await auction.openBatch(PRICE_SCALE, 100_000n)
			const batchId = await auction.currentBatchId()

			// Alice buys at tick 5 (price = 1.0 - 0.4 + 0.5 = 1.1)
			const [aliceTick] = await hre.cofhe.expectResultSuccess(
				cofhejs.encrypt([Encryptable.uint8(5n)] as const)
			)
			const [aliceAmt] = await hre.cofhe.expectResultSuccess(
				cofhejs.encrypt([Encryptable.uint64(100n)] as const)
			)
			await auction.connect(alice).submitBuyOrder(batchId, aliceTick, aliceAmt)

			// Bob buys at tick 3 (price = 1.0 - 0.4 + 0.3 = 0.9)
			const [bobTick] = await hre.cofhe.expectResultSuccess(
				cofhejs.encrypt([Encryptable.uint8(3n)] as const)
			)
			const [bobAmt] = await hre.cofhe.expectResultSuccess(
				cofhejs.encrypt([Encryptable.uint64(100n)] as const)
			)
			await auction.connect(bob).submitBuyOrder(batchId, bobTick, bobAmt)

			// Carol sells at tick 2 (price = 1.0 - 0.4 + 0.2 = 0.8)
			const [carolTick] = await hre.cofhe.expectResultSuccess(
				cofhejs.encrypt([Encryptable.uint8(2n)] as const)
			)
			const [carolAmt] = await hre.cofhe.expectResultSuccess(
				cofhejs.encrypt([Encryptable.uint64(100n)] as const)
			)
			await auction.connect(carol).submitSellOrder(batchId, carolTick, carolAmt)

			// Dave sells at tick 4 (price = 1.0 - 0.4 + 0.4 = 1.0)
			const [daveTick] = await hre.cofhe.expectResultSuccess(
				cofhejs.encrypt([Encryptable.uint8(4n)] as const)
			)
			const [daveAmt] = await hre.cofhe.expectResultSuccess(
				cofhejs.encrypt([Encryptable.uint64(100n)] as const)
			)
			await auction.connect(dave).submitSellOrder(batchId, daveTick, daveAmt)

			// Check order counts
			const batch = await auction.getBatch(batchId)
			expect(batch.buyCount).to.equal(2)
			expect(batch.sellCount).to.equal(2)

			// Advance time past batch close
			await time.increase(BATCH_DURATION + 1)

			// Settle
			await auction.settle(batchId)

			// Wait for mock decryption
			await time.increase(15)

			// Finalize
			await auction.finalize(batchId)

			// Check clearing tick
			const settled = await auction.getBatch(batchId)
			expect(settled.status).to.equal(3n) // Settled
			expect(settled.clearingReady).to.be.true
			// Clearing tick should be 3 (same as benchmark test)
			expect(settled.clearingTick).to.equal(3n)

			// Clearing price = 1.0 - 0.4 + 0.3 = 0.9 (900_000)
			const clearingPrice = await auction.getClearingPrice(batchId)
			expect(clearingPrice).to.equal(900_000n)
		})

		it('should prevent withdraw while funds are locked', async function () {
			const { auction, deployer, alice, carol } = await loadFixture(deployFixture)

			await hre.cofhe.expectResultSuccess(hre.cofhe.initializeWithHardhatSigner(deployer))

			const depositAmt = 10000n * 10n ** 18n
			await auction.connect(alice).deposit(0n, depositAmt)  // buyer deposits tokenB
			await auction.connect(carol).deposit(depositAmt, 0n)  // seller deposits tokenA

			await auction.openBatch(PRICE_SCALE, 100_000n)
			const batchId = await auction.currentBatchId()

			// Alice submits buy order - locks her tokenB
			const [tick] = await hre.cofhe.expectResultSuccess(
				cofhejs.encrypt([Encryptable.uint8(5n)] as const)
			)
			const [amt] = await hre.cofhe.expectResultSuccess(
				cofhejs.encrypt([Encryptable.uint64(100n)] as const)
			)
			await auction.connect(alice).submitBuyOrder(batchId, tick, amt)

			// Alice tries to withdraw tokenB - should revert with FundsLocked
			await expect(
				auction.connect(alice).withdraw(0n, 1n)
			).to.be.revertedWithCustomError(auction, 'FundsLocked')

			// Alice can still withdraw tokenA (not locked)
			// She has no tokenA deposited, so this would revert InsufficientBalance
			// Instead verify carol's tokenA is locked after sell order
			const [cTick] = await hre.cofhe.expectResultSuccess(
				cofhejs.encrypt([Encryptable.uint8(2n)] as const)
			)
			const [cAmt] = await hre.cofhe.expectResultSuccess(
				cofhejs.encrypt([Encryptable.uint64(100n)] as const)
			)
			await auction.connect(carol).submitSellOrder(batchId, cTick, cAmt)

			await expect(
				auction.connect(carol).withdraw(1n, 0n)
			).to.be.revertedWithCustomError(auction, 'FundsLocked')
		})

		it('should revert on double claim', async function () {
			const { auction, deployer, alice, bob, carol, dave } = await loadFixture(deployFixture)

			await hre.cofhe.expectResultSuccess(hre.cofhe.initializeWithHardhatSigner(deployer))

			const depositAmt = 10000n * 10n ** 18n
			await auction.connect(alice).deposit(0n, depositAmt)
			await auction.connect(bob).deposit(0n, depositAmt)
			await auction.connect(carol).deposit(depositAmt, 0n)
			await auction.connect(dave).deposit(depositAmt, 0n)

			await auction.openBatch(PRICE_SCALE, 100_000n)
			const batchId = await auction.currentBatchId()

			const [aliceTick] = await hre.cofhe.expectResultSuccess(cofhejs.encrypt([Encryptable.uint8(5n)] as const))
			const [aliceAmt] = await hre.cofhe.expectResultSuccess(cofhejs.encrypt([Encryptable.uint64(100n)] as const))
			await auction.connect(alice).submitBuyOrder(batchId, aliceTick, aliceAmt)

			const [bobTick] = await hre.cofhe.expectResultSuccess(cofhejs.encrypt([Encryptable.uint8(3n)] as const))
			const [bobAmt] = await hre.cofhe.expectResultSuccess(cofhejs.encrypt([Encryptable.uint64(100n)] as const))
			await auction.connect(bob).submitBuyOrder(batchId, bobTick, bobAmt)

			const [carolTick] = await hre.cofhe.expectResultSuccess(cofhejs.encrypt([Encryptable.uint8(2n)] as const))
			const [carolAmt] = await hre.cofhe.expectResultSuccess(cofhejs.encrypt([Encryptable.uint64(100n)] as const))
			await auction.connect(carol).submitSellOrder(batchId, carolTick, carolAmt)

			const [daveTick] = await hre.cofhe.expectResultSuccess(cofhejs.encrypt([Encryptable.uint8(4n)] as const))
			const [daveAmt] = await hre.cofhe.expectResultSuccess(cofhejs.encrypt([Encryptable.uint64(100n)] as const))
			await auction.connect(dave).submitSellOrder(batchId, daveTick, daveAmt)

			await time.increase(BATCH_DURATION + 1)
			await auction.settle(batchId)
			await time.increase(15)
			await auction.finalize(batchId)

			// Alice requests decrypt and claims
			await auction.connect(alice).requestFillDecrypt(batchId)
			await time.increase(15)
			await auction.connect(alice).claimFill(batchId)

			// Second claim should revert
			await expect(
				auction.connect(alice).claimFill(batchId)
			).to.be.revertedWithCustomError(auction, 'AlreadyClaimed')
		})

		it('should mark expired batches with Expired status', async function () {
			const { auction } = await loadFixture(deployFixture)

			await auction.openBatch(PRICE_SCALE, 100_000n)

			// Let the batch expire
			await time.increase(BATCH_DURATION + 1)

			// Opening a new batch should expire the old one
			await auction.openBatch(PRICE_SCALE, 100_000n)

			const oldBatch = await auction.getBatch(1n)
			expect(oldBatch.status).to.equal(4n) // Expired (not Settled=3)
		})

		it('should revert if refPrice too low for tick range', async function () {
			const { auction } = await loadFixture(deployFixture)

			// tickSpacing=500_000, NUM_TICKS/2=4, need refPrice >= 2_000_000
			await expect(
				auction.openBatch(1_000_000n, 500_000n)
			).to.be.revertedWithCustomError(auction, 'RefPriceTooLow')
		})

		it('should handle e2e with balance assertions after claim', async function () {
			const { auction, deployer, alice, carol } = await loadFixture(deployFixture)

			await hre.cofhe.expectResultSuccess(hre.cofhe.initializeWithHardhatSigner(deployer))

			const depositAmt = 10000n * 10n ** 18n
			await auction.connect(alice).deposit(0n, depositAmt)  // buyer
			await auction.connect(carol).deposit(depositAmt, 0n)  // seller

			await auction.openBatch(PRICE_SCALE, 100_000n)
			const batchId = await auction.currentBatchId()

			// Alice buys at tick 5, Carol sells at tick 2
			// These cross, so both should fill
			const [aliceTick] = await hre.cofhe.expectResultSuccess(cofhejs.encrypt([Encryptable.uint8(5n)] as const))
			const [aliceAmt] = await hre.cofhe.expectResultSuccess(cofhejs.encrypt([Encryptable.uint64(100n)] as const))
			await auction.connect(alice).submitBuyOrder(batchId, aliceTick, aliceAmt)

			const [carolTick] = await hre.cofhe.expectResultSuccess(cofhejs.encrypt([Encryptable.uint8(2n)] as const))
			const [carolAmt] = await hre.cofhe.expectResultSuccess(cofhejs.encrypt([Encryptable.uint64(100n)] as const))
			await auction.connect(carol).submitSellOrder(batchId, carolTick, carolAmt)

			// Record balances before settlement
			const aliceBalBBefore = await auction.balanceB(alice.address)
			const aliceBalABefore = await auction.balanceA(alice.address)
			const carolBalABefore = await auction.balanceA(carol.address)
			const carolBalBBefore = await auction.balanceB(carol.address)

			await time.increase(BATCH_DURATION + 1)
			await auction.settle(batchId)
			await time.increase(15)
			await auction.finalize(batchId)

			// Claims
			await auction.connect(alice).requestFillDecrypt(batchId)
			await auction.connect(carol).requestFillDecrypt(batchId)
			await time.increase(15)
			await auction.connect(alice).claimFill(batchId)
			await auction.connect(carol).claimFill(batchId)

			// Check Alice got tokenA
			const aliceBalAAfter = await auction.balanceA(alice.address)
			expect(aliceBalAAfter).to.be.gt(aliceBalABefore)

			// Check Carol got tokenB
			const carolBalBAfter = await auction.balanceB(carol.address)
			expect(carolBalBAfter).to.be.gt(carolBalBBefore)

			// Funds should be unlocked after claim - withdraw should work
			// Alice should be able to withdraw her tokenA
			await auction.connect(alice).withdraw(aliceBalAAfter, 0n)
			expect(await auction.balanceA(alice.address)).to.equal(0n)
		})
	})
})
