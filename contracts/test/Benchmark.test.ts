import { loadFixture, time } from '@nomicfoundation/hardhat-toolbox/network-helpers'
import { expect } from 'chai'
import hre from 'hardhat'
import { cofhejs, Encryptable, FheTypes } from 'cofhejs/node'

describe('Benchmark', function () {
	async function deployFixture() {
		const [deployer, alice, bob, carol, dave] = await hre.ethers.getSigners()

		const Benchmark = await hre.ethers.getContractFactory('Benchmark')
		const benchmark = await Benchmark.connect(deployer).deploy()

		return { benchmark, deployer, alice, bob, carol, dave }
	}

	describe('Compare-Swap', function () {
		beforeEach(function () {
			if (!hre.cofhe.isPermittedEnvironment('MOCK')) this.skip()
		})

		it('should sort two encrypted values (larger first)', async function () {
			const { benchmark, alice } = await loadFixture(deployFixture)

			await hre.cofhe.expectResultSuccess(hre.cofhe.initializeWithHardhatSigner(alice))

			const [encA] = await hre.cofhe.expectResultSuccess(
				cofhejs.encrypt([Encryptable.uint64(50n)] as const)
			)
			const [encB] = await hre.cofhe.expectResultSuccess(
				cofhejs.encrypt([Encryptable.uint64(100n)] as const)
			)

			await benchmark.connect(alice).benchCompareSwap(encA, encB)

			// After compare-swap, resultA should be the larger (100), resultB the smaller (50)
			const ra = await benchmark.resultA()
			const rb = await benchmark.resultB()
			await hre.cofhe.mocks.expectPlaintext(ra, 100n)
			await hre.cofhe.mocks.expectPlaintext(rb, 50n)
		})

		it('should handle already-sorted values', async function () {
			const { benchmark, alice } = await loadFixture(deployFixture)

			await hre.cofhe.expectResultSuccess(hre.cofhe.initializeWithHardhatSigner(alice))

			const [encA] = await hre.cofhe.expectResultSuccess(
				cofhejs.encrypt([Encryptable.uint64(200n)] as const)
			)
			const [encB] = await hre.cofhe.expectResultSuccess(
				cofhejs.encrypt([Encryptable.uint64(100n)] as const)
			)

			await benchmark.connect(alice).benchCompareSwap(encA, encB)

			const ra = await benchmark.resultA()
			const rb = await benchmark.resultB()
			await hre.cofhe.mocks.expectPlaintext(ra, 200n)
			await hre.cofhe.mocks.expectPlaintext(rb, 100n)
		})
	})

	describe('Price-Tick Accumulation', function () {
		beforeEach(function () {
			if (!hre.cofhe.isPermittedEnvironment('MOCK')) this.skip()
		})

		it('should find clearing tick with 2 buys and 2 sells', async function () {
			const { benchmark, deployer, alice, bob } = await loadFixture(deployFixture)

			await hre.cofhe.expectResultSuccess(hre.cofhe.initializeWithHardhatSigner(deployer))

			// Reset batch (initializes volumes to 0)
			await benchmark.resetBatch()

			// Buy orders: Alice buys 100 at tick 5, Bob buys 100 at tick 3
			const [alicePrice] = await hre.cofhe.expectResultSuccess(
				cofhejs.encrypt([Encryptable.uint8(5n)] as const)
			)
			const [aliceAmt] = await hre.cofhe.expectResultSuccess(
				cofhejs.encrypt([Encryptable.uint64(100n)] as const)
			)
			await benchmark.connect(deployer).submitBuyOrder(alicePrice, aliceAmt)

			const [bobPrice] = await hre.cofhe.expectResultSuccess(
				cofhejs.encrypt([Encryptable.uint8(3n)] as const)
			)
			const [bobAmt] = await hre.cofhe.expectResultSuccess(
				cofhejs.encrypt([Encryptable.uint64(100n)] as const)
			)
			await benchmark.connect(deployer).submitBuyOrder(bobPrice, bobAmt)

			// Sell orders: Carol sells 100 at tick 2, Dave sells 100 at tick 4
			const [carolPrice] = await hre.cofhe.expectResultSuccess(
				cofhejs.encrypt([Encryptable.uint8(2n)] as const)
			)
			const [carolAmt] = await hre.cofhe.expectResultSuccess(
				cofhejs.encrypt([Encryptable.uint64(100n)] as const)
			)
			await benchmark.connect(deployer).submitSellOrder(carolPrice, carolAmt)

			const [davePrice] = await hre.cofhe.expectResultSuccess(
				cofhejs.encrypt([Encryptable.uint8(4n)] as const)
			)
			const [daveAmt] = await hre.cofhe.expectResultSuccess(
				cofhejs.encrypt([Encryptable.uint64(100n)] as const)
			)
			await benchmark.connect(deployer).submitSellOrder(davePrice, daveAmt)

			// Settle: find clearing tick
			// Buy demand curve:
			//   tick 0: 200 (both buy at >= 0)
			//   tick 1: 200
			//   tick 2: 200
			//   tick 3: 200 (both buy at >= 3)
			//   tick 4: 100 (only Alice buys at >= 4)
			//   tick 5: 100 (only Alice buys at >= 5)
			//   tick 6: 0
			//   tick 7: 0
			//
			// Sell supply curve:
			//   tick 0: 0
			//   tick 1: 0
			//   tick 2: 100 (Carol sells at <= 2)
			//   tick 3: 100
			//   tick 4: 200 (both sell at <= 4)
			//   tick 5: 200
			//   tick 6: 200
			//   tick 7: 200
			//
			// Crossing: buyVol >= sellVol
			//   tick 0: 200 >= 0 -> YES
			//   tick 1: 200 >= 0 -> YES
			//   tick 2: 200 >= 100 -> YES
			//   tick 3: 200 >= 100 -> YES
			//   tick 4: 100 >= 200 -> NO
			//   tick 5: 100 >= 200 -> NO
			//
			// Clearing tick = 3 (highest tick where buy >= sell)
			await benchmark.settle()

			// Mock FHE decryption has a delay - advance time
			await time.increase(15)

			const [tick, ready] = await benchmark.getClearingTick()
			expect(ready).to.be.true
			expect(tick).to.equal(3n)
		})

		it('should handle all buys above all sells (tick = highest sell)', async function () {
			const { benchmark, deployer } = await loadFixture(deployFixture)

			await hre.cofhe.expectResultSuccess(hre.cofhe.initializeWithHardhatSigner(deployer))
			await benchmark.resetBatch()

			// Buy at tick 7, sell at tick 0
			const [bp] = await hre.cofhe.expectResultSuccess(cofhejs.encrypt([Encryptable.uint8(7n)] as const))
			const [ba] = await hre.cofhe.expectResultSuccess(cofhejs.encrypt([Encryptable.uint64(100n)] as const))
			await benchmark.submitBuyOrder(bp, ba)

			const [sp] = await hre.cofhe.expectResultSuccess(cofhejs.encrypt([Encryptable.uint8(0n)] as const))
			const [sa] = await hre.cofhe.expectResultSuccess(cofhejs.encrypt([Encryptable.uint64(100n)] as const))
			await benchmark.submitSellOrder(sp, sa)

			// Buy demand >= sell supply at ALL ticks (100 >= 100 at ticks 0-7)
			// Wait - sell at tick 0 means supply at tick 0 = 100, tick 1 = 100, ... tick 7 = 100
			// Buy at tick 7 means demand at tick 0-7 = 100
			// So crossed at all ticks. Clearing tick = 7.
			await benchmark.settle()

			// Mock FHE decryption has a delay
			await time.increase(15)

			const [tick, ready] = await benchmark.getClearingTick()
			expect(ready).to.be.true
			expect(tick).to.equal(7n)
		})
	})
})
