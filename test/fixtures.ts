import chai from 'chai'
import { Contract, Wallet } from 'ethers'
import { solidity, deployContract } from 'ethereum-waffle'

import Uni from '../build/Uni.json'
import Timelock from '../build/Timelock.json'
import GovernorAlpha from '../build/GovernorAlpha.json'

chai.use(solidity)

interface GovernanceFixture {
  uni: Contract
  timelock: Contract
  governorAlpha: Contract
}

export async function governanceFixture([wallet]: Wallet[]): Promise<GovernanceFixture> {
  const uni = await deployContract(wallet, Uni, [wallet.address])
  const timelock = await deployContract(wallet, Timelock, [wallet.address, 60 * 60 * 24 * 2])
  const governorAlpha = await deployContract(wallet, GovernorAlpha, [wallet.address, wallet.address, wallet.address])

  return { uni, timelock, governorAlpha }
}
