import chai from 'chai'
import { Contract, Wallet, providers, utils } from 'ethers'
import { solidity, deployContract } from 'ethereum-waffle'

import Uni from '../build/Uni.json'
import Timelock from '../build/Timelock.json'
import GovernorAlpha from '../build/GovernorAlpha.json'

import { DELAY, mineBlock } from './utils'

chai.use(solidity)

interface GovernanceFixture {
  uni: Contract
  timelock: Contract
  governorAlpha: Contract
}

export async function governanceFixture(
  [wallet]: Wallet[],
  provider: providers.Web3Provider
): Promise<GovernanceFixture> {
  const guardian = wallet.address

  // deploy UNI, sending the total supply to the guardian
  const uni = await deployContract(wallet, Uni, [guardian])

  // deploy timelock, controlled by the guardian
  const timelock = await deployContract(wallet, Timelock, [guardian, DELAY])

  // deploy governorAlpha
  const governorAlpha = await deployContract(wallet, GovernorAlpha, [timelock.address, uni.address, guardian])

  // nominate governorAlpha as pending admin
  const target = timelock.address
  const value = 0
  const signature = 'setPendingAdmin(address)'
  const data = utils.defaultAbiCoder.encode(['address'], [governorAlpha.address])
  const { timestamp: now } = await provider.getBlock('latest')
  const eta = now + DELAY + 60 // give a minute margin
  await timelock.queueTransaction(target, value, signature, data, eta)

  await mineBlock(provider, eta)

  await timelock.executeTransaction(target, value, signature, data, eta)

  // accept admin
  await governorAlpha.__acceptAdmin()
  await governorAlpha.__abdicate()

  return { uni, timelock, governorAlpha }
}
