import chai, { expect } from 'chai'
import { Contract, constants } from 'ethers'
import { solidity, MockProvider, createFixtureLoader, deployContract } from 'ethereum-waffle'

import UniswapV2Factory from '@uniswap/v2-core/build/UniswapV2Factory.json'
import UniswapV2Pair from '@uniswap/v2-core/build/UniswapV2Pair.json'
import FeeToSetter from '../../build/FeeToSetter.json'
import Uni from '../../build/Uni.json'

import { governanceFixture } from '../fixtures'
import { mineBlock, expandTo18Decimals } from '../utils'

chai.use(solidity)

describe('scenario:FeeToSetter', () => {
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
  beforeEach('deploy feeToSetter vesting contract', async () => {
    const { timestamp: now } = await provider.getBlock('latest')
    vestingEnd = now + 60
    // 3rd constructor arg should be timelock, just mocking for testing purposes
    feeToSetter = await deployContract(wallet, FeeToSetter, [factory.address, vestingEnd, wallet.address])

    // set feeToSetter to be the vesting contract
    await factory.setFeeToSetter(feeToSetter.address)
  })

  it('permissions', async () => {
    await expect(feeToSetter.connect(other).setTimelock(other.address)).to.be.revertedWith(
      'FeeToSetter::setTimelock: not allowed'
    )

    await expect(feeToSetter.connect(other).setHandler(other.address)).to.be.revertedWith(
      'FeeToSetter::setHandler: not allowed'
    )

    await expect(feeToSetter.setFeeTo(true)).to.be.revertedWith('FeeToSetter::setFeeTo: not time yet')

    await mineBlock(provider, vestingEnd)

    await expect(feeToSetter.connect(other).setFeeTo(true)).to.be.revertedWith('FeeToSetter::setFeeTo: not allowed')
  })

  it('setFeeTo', async () => {
    await mineBlock(provider, vestingEnd)

    let feeTo = await factory.feeTo()
    expect(feeTo).to.be.eq(constants.AddressZero)
    await feeToSetter.setFeeTo(true)

    feeTo = await factory.feeTo()
    expect(feeTo).to.be.eq(feeToSetter.address)

    await feeToSetter.setFeeTo(false)
    feeTo = await factory.feeTo()
    expect(feeTo).to.be.eq(constants.AddressZero)
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

    it('updateTokenAllowState', async () => {
      await feeToSetter.updateTokenAllowState(tokens[0].address, true)
      let tokenAllowState = await feeToSetter.tokenAllowStates(tokens[0].address)
      expect(tokenAllowState[0]).to.be.true
      expect(tokenAllowState[1]).to.be.eq(1)

      await feeToSetter.updateTokenAllowState(tokens[0].address, false)
      tokenAllowState = await feeToSetter.tokenAllowStates(tokens[0].address)
      expect(tokenAllowState[0]).to.be.false
      expect(tokenAllowState[1]).to.be.eq(2)

      await feeToSetter.updateTokenAllowState(tokens[0].address, false)
      tokenAllowState = await feeToSetter.tokenAllowStates(tokens[0].address)
      expect(tokenAllowState[0]).to.be.false
      expect(tokenAllowState[1]).to.be.eq(2)

      await feeToSetter.updateTokenAllowState(tokens[0].address, true)
      tokenAllowState = await feeToSetter.tokenAllowStates(tokens[0].address)
      expect(tokenAllowState[0]).to.be.true
      expect(tokenAllowState[1]).to.be.eq(2)

      await feeToSetter.updateTokenAllowState(tokens[0].address, false)
      tokenAllowState = await feeToSetter.tokenAllowStates(tokens[0].address)
      expect(tokenAllowState[0]).to.be.false
      expect(tokenAllowState[1]).to.be.eq(3)
    })

    let pair: Contract
    beforeEach('create fee liquidity', async () => {
      // turn the fee on
      await mineBlock(provider, vestingEnd)
      await feeToSetter.setFeeTo(true)

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

    it('claim is a no-op if renounce has not been called', async () => {
      await feeToSetter.updateTokenAllowState(tokens[0].address, true)
      await feeToSetter.updateTokenAllowState(tokens[1].address, true)
      await feeToSetter.setHandler(other.address)

      const balanceBefore = await pair.balanceOf(other.address)
      expect(balanceBefore).to.be.eq(0)
      await feeToSetter.claim(pair.address)
      const balanceAfter = await pair.balanceOf(other.address)
      expect(balanceAfter).to.be.eq(0)
    })

    it('renounce works', async () => {
      await feeToSetter.updateTokenAllowState(tokens[0].address, true)
      await feeToSetter.updateTokenAllowState(tokens[1].address, true)
      await feeToSetter.setHandler(other.address)

      const totalSupplyBefore = await pair.totalSupply()
      await feeToSetter.renounce(pair.address, { gasLimit: 9999999 })
      const totalSupplyAfter = await pair.totalSupply()
      expect(totalSupplyAfter.lt(totalSupplyBefore)).to.be.true
    })

    it('claim works', async () => {
      await feeToSetter.updateTokenAllowState(tokens[0].address, true)
      await feeToSetter.updateTokenAllowState(tokens[1].address, true)
      await feeToSetter.setHandler(other.address)

      await feeToSetter.renounce(pair.address, { gasLimit: 9999999 })

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
      await feeToSetter.claim(pair.address, { gasLimit: 9999999 })
      const balanceAfter = await pair.balanceOf(other.address)
      expect(balanceAfter.gt(balanceBefore)).to.be.true
    })
  })
})
