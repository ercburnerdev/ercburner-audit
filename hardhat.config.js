// require("@nomicfoundation/hardhat-toolbox");
require('@openzeppelin/hardhat-upgrades');
require("@nomicfoundation/hardhat-verify");
require('@matterlabs/hardhat-zksync');
require("@matterlabs/hardhat-zksync-verify");
require('@nomicfoundation/hardhat-chai-matchers');
require('dotenv').config()  

/** @type import('hardhat/config').HardhatUserConfig */
module.exports = {
  solidity: {
    version: "0.8.24",
    settings: {
      optimizer: {
        enabled: true,
        runs: 200
      },
      viaIR: true
    }
  },
  networks: {
    sepolia: {
      url: "https://ethereum-sepolia-rpc.publicnode.com",
      accounts: [process.env.DEPLOYER_PRIVATE_KEY],
      chainId: 11155111,
    },
    // baseSepolia: {
    //   url: "https://base-sepolia-rpc.publicnode.com",
    //   accounts: {
    //     mnemonic: process.env.MNEMONIC,
    //   },
    //   chainId: 84532,
    // },
    // polygonMumbai: {
    //   url: "https://polygon-mumbai-bor.publicnode.com",
    //   accounts: {
    //     mnemonic: process.env.MNEMONIC,
    //   },
    //   chainId: 80001,
    // },
    ethereum : {
      url: "https://eth.llamarpc.com",
      accounts: [process.env.DEPLOYER_PRIVATE_KEY],
      chainId: 1,
    },
    arbitrum: {
      url: "https://arb1.arbitrum.io/rpc",
      accounts: [process.env.DEPLOYER_PRIVATE_KEY],
      chainId: 42161,
    },
    polygon: {
      url: "https://polygon-rpc.com",
      accounts: [process.env.DEPLOYER_PRIVATE_KEY],
      chainId: 137,
    },
    avalanche: {
      url: "https://1rpc.io/avax/c",
      accounts: [process.env.DEPLOYER_PRIVATE_KEY],
      chainId: 43114,
    },
    bsc: {
      url: "https://bscrpc.com",
      accounts: [process.env.DEPLOYER_PRIVATE_KEY],
      chainId: 56,
    },
    optimism: {
      url: "https://mainnet.optimism.io",
      accounts: [process.env.DEPLOYER_PRIVATE_KEY],
      chainId: 10,
    },
    base: {
      url: "https://base.llamarpc.com",
      accounts: [process.env.DEPLOYER_PRIVATE_KEY],
      chainId: 8453,
    },
    blast: {
      url: "https://rpc.blast.io",
      accounts: [process.env.DEPLOYER_PRIVATE_KEY],
      chainId: 81457,
    },
    celo: {
      url: "https://forno.celo.org",
      accounts: [process.env.DEPLOYER_PRIVATE_KEY],
      chainId: 42220,
    },
    zksync: {
      url: "https://mainnet.era.zksync.io",
      accounts: [process.env.DEPLOYER_PRIVATE_KEY],
      chainId: 324,
      ethNetwork: "mainnet",
      zksync: true,
      verifyURL: 'https://block-explorer-api.mainnet.zksync.io/api'
    },
    sonic: {
      url: "https://rpc.soniclabs.com",
      accounts: [process.env.DEPLOYER_PRIVATE_KEY],
      chainId: 146,
    }
  },
  etherscan: {
    apiKey: {
      mainnet: process.env.ETHERSCAN_API_KEY,
      arbitrumOne: process.env.ARBISCAN_API_KEY,
      bsc: process.env.BSCSCAN_API_KEY,
      base: process.env.BASESCAN_API_KEY,
      polygon: process.env.POLYGONSCAN_API_KEY,
      avalanche: "PLACEHOLDER",
      optimisticEthereum: process.env.OPTIMISM_API_KEY,
      blast: process.env.BLAST_API_KEY,
      celo: process.env.CELO_SCAN_API_KEY,
      zksync: "PLACEHOLDER"
    },
    customChains: [
      {
        network: "blast",
        chainId: 81457,
        urls: {
          apiURL: "https://api.blastscan.io/api",
          browserURL: "https://blastscan.io/"
        }
      },
      {
        network: "celo",
        chainId: 42220,
        urls: {
          apiURL: "https://api.celoscan.io/api",
          browserURL: "https://celoscan.io/"
        }
      },
      {
        network: "zksync",
        chainId: 324,
        urls: {
          apiURL: "https://api.routescan.io/v2/network/mainnet/evm/324/etherscan",
          browserURL: "https://hyperscan.xyz"
        }
      }
    ]
  }
};
