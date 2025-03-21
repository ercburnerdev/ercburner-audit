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
    sourceOfFundsIsMsgSender
) {
    const amountInBig = BigInt(amountIn);
    const amountOutMinBig = BigInt(amountOutMinimum);
    const abiCoder = new ethers.AbiCoder();
    let commands = [];
    let input;
    let inputs = [];
    
    if (command == "0x00") {
        // Encode the inputs for the V3_SWAP_EXACT_IN command
        input = abiCoder.encode(
            ["address", "uint256", "uint256", "bytes", "bool"],
            [recipient, amountInBig, amountOutMinBig, path, sourceOfFundsIsMsgSender]
        );

        // Encode commands (as a single byte)
        commands = ethers.hexlify(ethers.zeroPadBytes(command, 1));
        inputs = [input];
    } else if (command == "0x08") {
        input = abiCoder.encode(
            ["address", "uint256", "uint256", "address[]", "bool"],
            [recipient, amountInBig, amountOutMinBig, path, sourceOfFundsIsMsgSender]
        );
        commands = ethers.hexlify(ethers.zeroPadBytes(command, 1));
        inputs = [input];
    } 
    // else if (command == "0x10") {
    //     let actions = abiCoder.encodePacked(
    //         uint8(0x06),
    //         uint8(0x0c),
    //         uint8(0x0f)

    //     );


    //     input = abiCoder.encode(
    //         ["address", "uint256"],
    //         [recipient, amountInBig]
    //     );

    //     commands = ethers.hexlify(ethers.zeroPadBytes(command, 1));
    //     inputs = [input];
    // }
    else if (command == "0x0c") {
        input = abiCoder.encode(
            ["address", "uint256"],
            [recipient, amountInBig]
        );
        commands = ethers.hexlify(ethers.zeroPadBytes(command, 1));
        inputs = [input];
    }

    return {
        tokenIn,
        amountIn,
        amountOutMinimum,
        commands,
        inputs
    };
}

function URswapParamForWnative(tokenAddress, amountIn, incineratorAddress, wnativeAddress) {
    return prepareSwapExactInput(
        "0x0c",
        incineratorAddress,
        tokenAddress,
        amountIn,
        amountIn,
        [],
        null,
        BigInt(Math.floor(Date.now() / 1000) + 600)
    )
}

module.exports = { prepareSwapExactInput, encodePath, URswapParamForWnative };