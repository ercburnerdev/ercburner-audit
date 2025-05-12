# ERC Burner Contracts

This repository contains smart contracts designed to facilitate batch token swaps across multiple blockchain networks and bridges to other networks. The contracts enable efficient token swapping operations through integration with various decentralized exchanges and bridge through integration with Relay's RelayReceiver bridge contracts.

The ERC Burner contracts are meant to provide a secure and gas-efficient way to execute batch swaps of ERC20 tokens and optionnal bridges to other networks.

## Audit Scope

The audit focuses on the smart contracts in the `/contracts/burner` directory:

```
contracts/burner/
├── libraries/
│   ├── BurnerErrors.sol
│   └── BurnerEvents.sol
├── interfaces/
│   ├── ILBRouter.sol
│   ├── IUniversalRouter.sol
│   ├── IPermit2.sol
│   └── IWETH.sol
├── URBurner.sol
└── AVAXBurner.sol
```

## Supported Networks and DEXs

The contracts are designed to work with different DEX routers based on the network:

- **UniversalRouter Implementation (URBurner.sol)**
  - Ethereum (Uniswap)
  - Arbitrum (Uniswap)
  - Base (Uniswap)
  - Polygon (Uniswap)
  - Optimism (Uniswap)
  - Blast (Uniswap)
  - BSC (PancakeSwap)
  - ZKSync (ZKSwap)

- **LBRouter Implementation (AVAXBurner.sol)**
  - Avalanche (Trader Joe LB)

- **Relay Bridge Implementation (URBurner.sol and AVAXBurner.sol)**
  - Relay's RelayReceiver for all chains

## Key Features

- Batch token swaps
- Fee collection mechanism
- Referral system
- Paid referrals
- Bridge integration
- Emergency pause functionality
- Token rescue capabilities
- Upgradeable contract architecture
- Reentrancy protection
- Owner and Admin controlled parameters


## Contract Security

The contracts implement several security features:
- OpenZeppelin's security contracts
- OpenZeppelin's Address contract
- Reentrancy Guard
- Pausable functionality
- Access Control
- Safe ERC20 operations

## Fee calculations

The contracts implement a service fee system: 
- Burn service fee (2.5%), applied only to tokens swapped: burnFee = burnAmount / burnFeeDivisor (40)
- Bridge service fee (0.25%), applied only to msg.value: bridgeFee = bridgeAmount / bridgeFeeDivisor (400) 
- Referrer fee (0-100% of total fee amount): (burnFee + bridgeFee) * referrerShare (4-20) / 20

## Core Functions

### URBurner.sol (Universal Router Implementation)

#### Key Operations
- `swapExactInputMultiple`: Execute batch swaps through Uniswap's UniversalRouter with configurable recipient and optional bridging as well as referrer's share of fees
- `relayBridge`: Bridge native tokens through the connected bridge contract as well as referrer's share of fees
- `paidReferrer`: Register as a paid referrer with tiered fee sharing benefits
- `upgradeReferrer`: Upgrade referrer tier by paying additional USDC

#### Administrative Functions
- `initialize`: Set up contract parameters including routers, addresses, and fee settings
- `reinitialize`: Used for future upgrades to initialize new state variables
- `setBurnFeeDivisor`: Update burn fee percentage (max 2.5%)
- `setBridgeFeeDivisor`: Update bridge fee percentage (max 0.25%)
- `setReferrerFeeShare`: Update the default referrer fee share
- `putPartner`: Add or modify partner fee share settings
- `removePartner`: Remove a partner from the referral system
- `setUniversalRouter`: Update the Universal Router address
- `setPermit2`: Update the Permit2 contract address
- `setBridgeAddress`: Update the bridge contract address
- `setFeeCollector`: Update fee collector address
- `setAdmin`: Update admin address with role management
- `setMinGasForSwap`: Update minimum gas required for swaps
- `setMaxTokensPerBurn`: Update maximum token count per transaction
- `rescueTokens`: Rescue stuck ERC20 tokens
- `rescueETH`: Rescue stuck ETH
- `changePauseBridge`: Toggle bridge functionality
- `changePauseReferral`: Toggle referral functionality
- `pause/unpause`: Emergency controls for the entire contract

### AVAXBurner.sol (LB Router Implementation)

#### Key Operations
- `swapExactInputMultiple`: Execute batch swaps through Trader Joe's LBRouter with configurable recipient and optional bridging as well as referrer's share of fees
- `relayBridge`: Bridge native tokens through the connected bridge contract as well as referrer's share of fees
- `paidReferrer`: Register as a paid referrer with tiered fee sharing benefits
- `upgradeReferrer`: Upgrade referrer tier by paying additional USDC

#### Administrative Functions
- `initialize`: Set up contract parameters including router, addresses, and fee settings
- `reinitialize`: Used for future upgrades to initialize new state variables
- `setBurnFeeDivisor`: Update burn fee percentage (max 2.5%)
- `setBridgeFeeDivisor`: Update bridge fee percentage (max 0.25%)
- `setReferrerFeeShare`: Update the default referrer fee share
- `putPartner`: Add or modify partner fee share settings
- `removePartner`: Remove a partner from the referral system
- `setUniversalRouter`: Update the LB Router address
- `setBridgeAddress`: Update the bridge contract address
- `setFeeCollector`: Update fee collector address
- `setAdmin`: Update admin address with role management
- `setMinGasForSwap`: Update minimum gas required for swaps
- `setMaxTokensPerBurn`: Update maximum token count per transaction
- `rescueTokens`: Rescue stuck ERC20 tokens
- `rescueETH`: Rescue stuck ETH
- `changePauseBridge`: Toggle bridge functionality
- `changePauseReferral`: Toggle referral functionality
- `pause/unpause`: Emergency controls for the entire contract

## Dependencies

The contracts require the following OpenZeppelin contracts:
- `@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol`
- `@openzeppelin/contracts-upgradeable/utils/ReentrancyGuardUpgradeable.sol`
- `@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol`
- `@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol`
- `@openzeppelin/contracts/token/ERC20/IERC20.sol`
- `@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol`
- `@openzeppelin/contracts-upgradeable/utils/PausableUpgradeable.sol`
- `@openzeppelin/contracts/utils/Address.sol`


## Relay Bridge Integration

The ERC Burner contracts integrate with Relay's bridge service to enable cross-chain transfers. This integration works by:

1. Obtaining a bridge quote from Relay's API
2. Using the quote data to interact with the Relay bridge contracts

### Getting a Bridge Quote

To use the bridge functionality, you first need to get a quote from Relay's API:

```javascript
const quote = await getClient()?.actions.getQuote({
    chainId: sourceChainId,            // Current chain ID
    toChainId: destinationChainId,     // Target chain ID
    currency: "0x0000000000000000000000000000000000000000", // Source currency (native token)
    toCurrency: getChainNativeAddress(destinationChainId), // Destination currency
    amount: amountToBridge, // Amount to bridge
    tradeType: "EXACT_INPUT",          // Trade type
    wallet: walletViem,                // Wallet instance
    recipient: recipientAddress || userAddress, // Recipient address (default: user's address)
    refundTo: userAddress              // Address to send refunds in case of failure
});
```

### Important Parameters

- **recipient**: The address that will receive the bridged tokens on the destination chain. If not specified, defaults to the user's address.
- **refundTo**: The address that will receive any refunds in case the bridge operation fails. Always specified to be user's address.

### Deployment Strategy

The contracts will be deployed from a freshly created deployer EOA to ensure common deployment addresses across all supported networks.

## Development Setup

### Installing Dependencies

```bash
npm i
```

### Compiling Contracts

```bash
npx hardhat compile
```

### Running Tests

```bash
npx hardhat test
```

## Security Analysis

### Setting Up Slither

1. Create a Python virtual environment:
```bash
python -m venv venv
```

2. Activate the virtual environment:
```bash
# On Windows
venv\Scripts\activate

# On Linux/Mac
source venv/bin/activate
```

3. Install dependencies:
```bash
pip install -r requirements.txt
```

4. Run Slither:
```bash
slither .
```


## Contact

For security-related issues, please contact: security@ercburner.xyz

## License

GPL-3.0-or-later