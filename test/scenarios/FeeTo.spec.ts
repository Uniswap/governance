import chai, { expect } from 'chai'
import { Contract, constants } from 'ethers'
import { solidity, MockProvider, createFixtureLoader, deployContract } from 'ethereum-waffle'

import UniswapV2Factory from '@uniswap/v2-core/build/UniswapV2Factory.json'
import UniswapV2Pair from '@uniswap/v2-core/build/UniswapV2Pair.json'
import FeeToSetter from '../../build/FeeToSetter.json'
import FeeTo from '../../build/FeeTo.json'
import Uni from '../../build/Uni.json'

import { governanceFixture } from '../fixtures'
import { mineBlock, expandTo18Decimals } from '../utils'

chai.use(solidity)

describe('scenario:FeeTo', () => {
  const provider = new MockProvider({
    ganacheOptions: {
      hardfork: 'istanbul',
      mnemonic: 'horn horn horn horn horn horn horn horn horn horn horn horn',
      gasLimit: 9999999,
    },
  })
  const [wallet, other] = provider.getWallets()
  const loadFixture = createFixtureLoader([wallet], provider)

  beforeEach(async () => {
    await loadFixture(governanceFixture)
  })

  let factory: Contract
  beforeEach('deploy uniswap v2', async () => {
    factory = await deployContract(wallet, UniswapV2Factory, [wallet.address])
  })

  let feeToSetter: Contract
  let vestingEnd: number
  let feeTo: Contract
  beforeEach('deploy feeToSetter vesting contract', async () => {
    // deploy feeTo
    // constructor arg should be timelock, just mocking for testing purposes
    feeTo = await deployContract(wallet, FeeTo, [wallet.address])

    const { timestamp: now } = await provider.getBlock('latest')
    vestingEnd = now + 60
    // 3rd constructor arg should be timelock, just mocking for testing purposes
    // 4th constructor arg should be feeTo, just mocking for testing purposes
    feeToSetter = await deployContract(wallet, FeeToSetter, [
      factory.address,
      vestingEnd,
      wallet.address,
      feeTo.address,
    ])

    // set feeToSetter to be the vesting contract
    await factory.setFeeToSetter(feeToSetter.address)

    await mineBlock(provider, vestingEnd)
  })

  it('permissions', async () => {
    await expect(feeTo.connect(other).setOwner(other.address)).to.be.revertedWith('FeeTo::setOwner: not allowed')

    await expect(feeTo.connect(other).setFeeRecipient(other.address)).to.be.revertedWith(
      'FeeTo::setFeeRecipient: not allowed'
    )
  })

  describe('tokens', () => {
    const tokens: Contract[] = []
    beforeEach('make test tokens', async () => {
      const { timestamp: now } = await provider.getBlock('latest')
      const token0 = await deployContract(wallet, Uni, [wallet.address, constants.AddressZero, now + 60 * 60])
      tokens.push(token0)
      const token1 = await deployContract(wallet, Uni, [wallet.address, constants.AddressZero, now + 60 * 60])
      tokens.push(token1)
    })

    let pair: Contract
    beforeEach('create fee liquidity', async () => {
      // turn the fee on
      await feeToSetter.toggleFees(true)

      // create the pair
      await factory.createPair(tokens[0].address, tokens[1].address)
      const pairAddress = await factory.getPair(tokens[0].address, tokens[1].address)
      pair = new Contract(pairAddress, UniswapV2Pair.abi).connect(wallet)

      // add liquidity
      await tokens[0].transfer(pair.address, expandTo18Decimals(1))
      await tokens[1].transfer(pair.address, expandTo18Decimals(1))
      await pair.mint(wallet.address)

      // swap
      await tokens[0].transfer(pair.address, expandTo18Decimals(1).div(10))
      const amounts =
        tokens[0].address.toLowerCase() < tokens[1].address.toLowerCase()
          ? [0, expandTo18Decimals(1).div(20)]
          : [expandTo18Decimals(1).div(20), 0]
      await pair.swap(...amounts, wallet.address, '0x', { gasLimit: 9999999 })

      // mint again to collect the rewards
      await tokens[0].transfer(pair.address, expandTo18Decimals(1))
      await tokens[1].transfer(pair.address, expandTo18Decimals(1))
      await pair.mint(wallet.address, { gasLimit: 9999999 })
    })

    it('updateTokenAllowState', async () => {
      await feeTo.updateTokenAllowState(tokens[0].address, true)
      let tokenAllowState = await feeTo.tokenAllowStates(tokens[0].address)
      expect(tokenAllowState[0]).to.be.true
      expect(tokenAllowState[1]).to.be.eq(1)

      await feeTo.updateTokenAllowState(tokens[0].address, false)
      tokenAllowState = await feeTo.tokenAllowStates(tokens[0].address)
      expect(tokenAllowState[0]).to.be.false
      expect(tokenAllowState[1]).to.be.eq(2)

      await feeTo.updateTokenAllowState(tokens[0].address, false)
      tokenAllowState = await feeTo.tokenAllowStates(tokens[0].address)
      expect(tokenAllowState[0]).to.be.false
      expect(tokenAllowState[1]).to.be.eq(2)

      await feeTo.updateTokenAllowState(tokens[0].address, true)
      tokenAllowState = await feeTo.tokenAllowStates(tokens[0].address)
      expect(tokenAllowState[0]).to.be.true
      expect(tokenAllowState[1]).to.be.eq(2)

      await feeTo.updateTokenAllowState(tokens[0].address, false)
      tokenAllowState = await feeTo.tokenAllowStates(tokens[0].address)
      expect(tokenAllowState[0]).to.be.false
      expect(tokenAllowState[1]).to.be.eq(3)
    })

    it('claim is a no-op if renounce has not been called', async () => {
      await feeTo.updateTokenAllowState(tokens[0].address, true)
      await feeTo.updateTokenAllowState(tokens[1].address, true)
      await feeTo.setFeeRecipient(other.address)

      const balanceBefore = await pair.balanceOf(other.address)
      expect(balanceBefore).to.be.eq(0)
      await feeTo.claim(pair.address)
      const balanceAfter = await pair.balanceOf(other.address)
      expect(balanceAfter).to.be.eq(0)
    })

    it('renounce works', async () => {
      await feeTo.updateTokenAllowState(tokens[0].address, true)
      await feeTo.updateTokenAllowState(tokens[1].address, true)
      await feeTo.setFeeRecipient(other.address)

      const totalSupplyBefore = await pair.totalSupply()
      await feeTo.renounce(pair.address, { gasLimit: 9999999 })
      const totalSupplyAfter = await pair.totalSupply()
      expect(totalSupplyAfter.lt(totalSupplyBefore)).to.be.true
    })

    it('claim works', async () => {
      await feeTo.updateTokenAllowState(tokens[0].address, true)
      await feeTo.updateTokenAllowState(tokens[1].address, true)
      await feeTo.setFeeRecipient(other.address)

      await feeTo.renounce(pair.address, { gasLimit: 9999999 })

      // swap
      await tokens[0].transfer(pair.address, expandTo18Decimals(1).div(10))
      const amounts =
        tokens[0].address.toLowerCase() < tokens[1].address.toLowerCase()
          ? [0, expandTo18Decimals(1).div(1000)]
          : [expandTo18Decimals(1).div(1000), 0]
      await pair.swap(...amounts, wallet.address, '0x', { gasLimit: 9999999 })

      // mint again to collect the rewards
      await tokens[0].transfer(pair.address, expandTo18Decimals(1))
      await tokens[1].transfer(pair.address, expandTo18Decimals(1))
      await pair.mint(wallet.address, { gasLimit: 9999999 })

      const balanceBefore = await pair.balanceOf(other.address)
      await feeTo.claim(pair.address, { gasLimit: 9999999 })
      const balanceAfter = await pair.balanceOf(other.address)
      expect(balanceAfter.gt(balanceBefore)).to.be.true
    })
  })
})
