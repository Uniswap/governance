import chai, { expect } from 'chai'
import { Contract } from 'ethers'
import { solidity, MockProvider, createFixtureLoader, deployContract } from 'ethereum-waffle'

import UniswapV2Factory from '@uniswap/v2-core/build/UniswapV2Factory.json'
import FeeToSetterVester from '../../build/FeeToSetterVester.json'

import { governanceFixture } from '../fixtures'
import { mineBlock } from '../utils'

chai.use(solidity)

describe('scenario:FeeToSetterVester', () => {
  const provider = new MockProvider({
    ganacheOptions: {
      hardfork: 'istanbul',
      mnemonic: 'horn horn horn horn horn horn horn horn horn horn horn horn',
      gasLimit: 9999999,
    },
  })
  const [wallet, other] = provider.getWallets()
  const loadFixture = createFixtureLoader([wallet], provider)

  let timelock: Contract
  beforeEach(async () => {
    const fixture = await loadFixture(governanceFixture)
    timelock = fixture.timelock
  })

  let factory: Contract
  beforeEach('deploy uniswap v2', async () => {
    factory = await deployContract(wallet, UniswapV2Factory, [wallet.address])
  })

  let feeToSetterVester: Contract
  let vestingEnd: number
  beforeEach('deploy feeToSetter vesting contract', async () => {
    const { timestamp: now } = await provider.getBlock('latest')
    vestingEnd = now + 60
    // 2nd constructor arg should be timelock, just mocking for testing purposes
    feeToSetterVester = await deployContract(wallet, FeeToSetterVester, [factory.address, wallet.address, vestingEnd])
  })

  it('divest', async () => {
    // set feeToSetter to be the vesting contract
    await factory.setFeeToSetter(feeToSetterVester.address)

    await expect(feeToSetterVester.divest()).to.be.revertedWith('FeeToSetterVester::divest: not time yet')

    await mineBlock(provider, vestingEnd)

    await expect(feeToSetterVester.divest()).to.be.revertedWith('FeeToSetterVester::divest: zero address')

    await expect(feeToSetterVester.connect(other).setFeeToSetterToBe(timelock.address)).to.be.revertedWith(
      'FeeToSetterVester::setFeeToSetterToBe: not authorized'
    )

    await feeToSetterVester.setFeeToSetterToBe(timelock.address)

    await feeToSetterVester.divest()

    const feeToSetter = await factory.feeToSetter()
    expect(feeToSetter).to.be.eq(timelock.address)
  })
})
