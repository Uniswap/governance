import chai, { expect } from 'chai'
import { Contract, BigNumber, utils } from 'ethers'
import { solidity, MockProvider, createFixtureLoader, deployContract } from 'ethereum-waffle'

import UniswapV2Factory from '@uniswap/v2-core/build/UniswapV2Factory.json'

import { governanceFixture } from '../fixtures'
import { mineBlock, DELAY } from '../utils'

chai.use(solidity)

describe('scenario:setFeeTo', () => {
  const provider = new MockProvider({
    ganacheOptions: {
      hardfork: 'istanbul',
      mnemonic: 'horn horn horn horn horn horn horn horn horn horn horn horn',
      gasLimit: 9999999,
    },
  })
  const [wallet] = provider.getWallets()
  const loadFixture = createFixtureLoader([wallet], provider)

  let uni: Contract
  let timelock: Contract
  let governorAlpha: Contract
  beforeEach(async () => {
    const fixture = await loadFixture(governanceFixture)
    uni = fixture.uni
    timelock = fixture.timelock
    governorAlpha = fixture.governorAlpha
  })

  let factory: Contract
  beforeEach('deploy uniswap v2', async () => {
    factory = await deployContract(wallet, UniswapV2Factory, [timelock.address])
  })

  it('setFeeTo', async () => {
    const target = factory.address
    const value = 0
    const signature = 'setFeeTo(address)'
    const calldata = utils.defaultAbiCoder.encode(['address'], [timelock.address])
    const description = 'Set feeTo on the UniswapV2Factory to the timelock address.'

    // activate balances
    await uni.delegate(wallet.address)
    const { timestamp: now } = await provider.getBlock('latest')
    await mineBlock(provider, now)

    const proposalId = await governorAlpha.callStatic.propose([target], [value], [signature], [calldata], description)
    await governorAlpha.propose([target], [value], [signature], [calldata], description)

    // overcome votingDelay
    await mineBlock(provider, now)

    await governorAlpha.castVote(proposalId, true)

    // TODO fix if possible, this is really annoying
    // overcome votingPeriod
    const votingPeriod = await governorAlpha.votingPeriod().then((votingPeriod: BigNumber) => votingPeriod.toNumber())
    await Promise.all(new Array(votingPeriod).fill(0).map(() => mineBlock(provider, now)))

    await governorAlpha.queue(proposalId)

    const eta = now + DELAY + 60 // give a minute margin
    await mineBlock(provider, eta)

    await governorAlpha.execute(proposalId)

    const feeTo = await factory.feeTo()
    expect(feeTo).to.be.eq(timelock.address)
  }).timeout(500000)
})
