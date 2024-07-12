import { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox";
import "hardhat-abi-exporter";
import "hardhat-contract-sizer";

const mumbaiRPC = process.env.MUMBAI_RPC;
const mainnetRPC = process.env.MAINNET_RPC;
const avalancheRPC = process.env.AVALANCHE_RPC;
const sepoliaRPC = process.env.SEPOLIA_RPC;


const config: HardhatUserConfig = {
  // solidity: "0.8.18",
  solidity: {
    compilers: [
      {
        version: "0.5.16",
        settings: {
          // See: https://smock.readthedocs.io/en/latest/getting-started.html#required-config-for-mocks
          outputSelection: {
            "*": {
              "*": ["storageLayout"],
            },
          },
        },
      },
    ],
  },
  abiExporter: {
    runOnCompile: true,
    clear: true,
    flat: false,
    format: "json",
  },
  etherscan: {
    apiKey: "68YU3C27DCWKJRPXFB8FWPJ16G3RJRP6PR"
  }
};

const deployerWallet = process.env.DEPLOYER_WALLET;
const deployerWallets = process.env.DEPLOYER_WALLET?.split(",");

// Setup base-goerli test network.
const baseGoerliRPC = process.env.BASE_GOERLI_RPC;
if (deployerWallet && baseGoerliRPC) {
  if (!config.networks) {
    config.networks = {};
  }
  config.networks.baseGoerli = {
    url: baseGoerliRPC,
    accounts: [deployerWallet, ...(deployerWallets || [])],
    gas: "auto",
    gasPrice: 25500000000,
    chainId: 84531,
  };
}

if (deployerWallet && mumbaiRPC) {
  if (!config.networks) {
    config.networks = {};
  }
  config.networks.polygon_mumbai = {
    url: mumbaiRPC,
    accounts: [deployerWallet, ...(deployerWallets || [])],
    gas: "auto",
    gasPrice: 25500000000,
    chainId: 80001,
  };
}

if (mainnetRPC && deployerWallet) {
  if (!config.networks) {
    config.networks = {};
  }
  config.networks.mainnet = {
    url: mainnetRPC,
    accounts: [deployerWallet, ...(deployerWallets || [])],
    gas: "auto",
    gasPrice: "auto",
    chainId: 1,
  };
}

if (deployerWallet && sepoliaRPC) {
  if (!config.networks) {
    config.networks = {};
  }
  config.networks.sepolia = {
    url: sepoliaRPC,
    accounts: [deployerWallet, ...(deployerWallets || [])],
    gas: "auto",
    gasPrice: "auto",
    chainId: 11155111,
  };
}

if (deployerWallet && avalancheRPC) {
  if (!config.networks) {
    config.networks = {};
  }
  config.networks.avalanche = {
    url: avalancheRPC,
    accounts: [deployerWallet, ...(deployerWallets || [])],
    gas: "auto",
    gasPrice: "auto",
    chainId: 43114,
  };
}

export default config;
