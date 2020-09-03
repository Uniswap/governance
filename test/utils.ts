import { providers } from 'ethers'

export async function mineBlock(provider: providers.Web3Provider, timestamp: number): Promise<void> {
  return provider.send('evm_mine', [timestamp])
}
