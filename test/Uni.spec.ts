import chai, { expect } from 'chai'
import { Contract, BigNumber, constants, utils } from 'ethers'
import { solidity, MockProvider, createFixtureLoader } from 'ethereum-waffle'
import { ecsign } from 'ethereumjs-util'

import { governanceFixture } from './fixtures'
import { DELAY } from './utils'

chai.use(solidity)

const DOMAIN_TYPEHASH = utils.keccak256(
  utils.toUtf8Bytes('EIP712Domain(string name,uint256 chainId,address verifyingContract)')
)

const PERMIT_TYPEHASH = utils.keccak256(
  utils.toUtf8Bytes('Permit(address owner,address spender,uint256 value,uint256 nonce,uint256 deadline)')
)

// function getDomainSeparator(name: string, tokenAddress: string) {
//   return
// }

describe('Uni', () => {
  const provider = new MockProvider({
    ganacheOptions: {
      hardfork: 'istanbul',
      mnemonic: 'horn horn horn horn horn horn horn horn horn horn horn horn',
      gasLimit: 9999999,
    },
  })
  const [wallet, other] = provider.getWallets()
  const loadFixture = createFixtureLoader([wallet], provider)

  let uni: Contract
  beforeEach(async () => {
    const fixture = await loadFixture(governanceFixture)
    uni = fixture.uni
  })

  it.only('permit', async () => {
    const domainSeparator = utils.keccak256(
      utils.defaultAbiCoder.encode(
        ['bytes32', 'bytes32', 'uint256', 'address'],
        [DOMAIN_TYPEHASH, utils.keccak256(utils.toUtf8Bytes('Uniswap')), 1, uni.address]
      )
    )

    const owner = wallet.address
    const spender = other.address
    const value = 123
    const nonce = await uni.nonces(wallet.address)
    const deadline = constants.MaxUint256
    const digest = utils.keccak256(
      utils.solidityPack(
        ['bytes1', 'bytes1', 'bytes32', 'bytes32'],
        [
          '0x19',
          '0x01',
          domainSeparator,
          utils.keccak256(
            utils.defaultAbiCoder.encode(
              ['bytes32', 'address', 'address', 'uint256', 'uint256', 'uint256'],
              [PERMIT_TYPEHASH, owner, spender, value, nonce, deadline]
            )
          ),
        ]
      )
    )

    const { v, r, s } = ecsign(Buffer.from(digest.slice(2), 'hex'), Buffer.from(wallet.privateKey.slice(2), 'hex'))

    await uni.permit(owner, spender, value, deadline, v, utils.hexlify(r), utils.hexlify(s))
    expect(await uni.allowance(owner, spender)).to.eq(value)
    expect(await uni.nonces(owner)).to.eq(1)

    await uni.connect(other).transferFrom(owner, spender, value)
  })
})
