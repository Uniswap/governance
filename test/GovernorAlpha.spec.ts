import chai, { expect } from 'chai'
import { Contract, BigNumber } from 'ethers'
import { solidity, MockProvider, createFixtureLoader } from 'ethereum-waffle'

import { governanceFixture } from './fixtures'

chai.use(solidity)

describe('StakingRewardsFactory', () => {
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

  it('test', async () => {
    console.log('test me!')
  })
})
