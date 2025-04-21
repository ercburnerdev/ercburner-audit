const { ethers } = require("hardhat");

/**
 * Encodes a path to bytes for Uniswap V3 swaps
 * @param {string[]} tokenAddresses Array of token addresses in order of swap
 * @param {number[]} fees Array of fees for each pool in the path
 * @returns {string} Encoded path
 */
function encodePath(command, tokenAddresses, fees) {
    if (tokenAddresses.length <= 1) {
        throw new Error('Invalid tokens length');
    }
    const ADDR_SIZE = 20;
    let encoded = '0x';

    if (command == "0x00") {
        const FEE_SIZE = 3;
        
    
        if (fees.length !== tokenAddresses.length - 1) {
            throw new Error('Invalid fees length');
        }
    
        for (let i = 0; i < tokenAddresses.length - 1; i++) {
            // Add token address
            encoded += tokenAddresses[i].slice(2).padStart(ADDR_SIZE * 2, '0');
            // Add fee
            encoded += fees[i].toString(16).padStart(FEE_SIZE * 2, '0');
        }
        // Add final token address
        encoded += tokenAddresses[tokenAddresses.length - 1].slice(2).padStart(ADDR_SIZE * 2, '0');
    } else if (command == "0x08") {
        for (let i = 0; i < tokenAddresses.length - 1; i++) {
            // Add token address
            encoded += tokenAddresses[i].slice(2).padStart(ADDR_SIZE * 2, '0');
        }
        encoded += tokenAddresses[tokenAddresses.length - 1].slice(2).padStart(ADDR_SIZE * 2, '0');
    }

    return encoded.toLowerCase();
}

/**
 * Prepares data for a V3_SWAP_EXACT_IN and V2_SWAP_EXACT_IN call to the Uniswap UniversalRouter.
 * 
 * @param {string} recipient - The address of the recipient.
 * @param {BigInt | string} amountIn - The input amount (in wei).
 * @param {BigInt | string} amountOutMinimum - The minimum output amount (in wei).
 * @param {string} path - The encoded path for the swap.
 * @param {boolean} sourceOfFundsIsMsgSender - Whether the source of funds is the sender.
 * @param {BigInt | string} deadline - The transaction deadline (in seconds since epoch).
 * @returns {Object} - Encoded data containing `commands`, `inputs`, and `deadline`.
 */
function prepareSwapExactInput(
    command,
    recipient,
    tokenIn,
    amountIn,
    amountOutMinimum,
    path,
    sourceOfFundsIsMsgSender,
    sweepRecipient,
    deadline
) {
    const amountInBig = BigInt(amountIn);
    const amountOutMinBig = BigInt(amountOutMinimum);
    const deadlineBigInt = BigInt(deadline);
    const abiCoder = new ethers.AbiCoder();
    let commandsString = "";
    let inputs = [];
    
    let mainInput;
    
    if (command == "0x00") {
        mainInput = abiCoder.encode(
            ["address", "uint256", "uint256", "bytes", "bool"],
            [recipient, amountInBig, amountOutMinBig, path, sourceOfFundsIsMsgSender]
        );
    } else if (command == "0x08") {
        mainInput = abiCoder.encode(
            ["address", "uint256", "uint256", "address[]", "bool"],
            [recipient, amountInBig, amountOutMinBig, path, sourceOfFundsIsMsgSender]
        );
    } 
    else if (command == "0x0c") {
        mainInput = abiCoder.encode(
            ["address", "address", "uint256"],
            [recipient, tokenIn, amountInBig]
        );
    } else {
        throw new Error(`Unsupported command: ${command}`);
    }

    commandsString += command.startsWith("0x") ? command.substring(2) : command;
    inputs.push(mainInput);

    return {
        tokenIn,
        amountIn,
        amountOutMinimum,
        commands: "0x" + commandsString,
        inputs
    };
}

function URswapParamForWnative(tokenAddress, amountIn, incineratorAddress, sweepRecipient, wnativeAddress) {
    const deadline = BigInt(Math.floor(Date.now() / 1000) + 100000);
    return prepareSwapExactInput(
        "0x0c",
        incineratorAddress,
        tokenAddress,
        amountIn,
        amountIn,
        [],
        false,
        sweepRecipient,
        deadline
    );
}

module.exports = { prepareSwapExactInput, encodePath, URswapParamForWnative };