const { ethers } = require("hardhat");

/**
 * Creates swap parameters for a TraderJoe LBRouter swap
 * 
 * @param {string} tokenIn - Token address to swap from
 * @param {BigInt | string} amountIn - Amount to swap
 * @param {BigInt | string} amountOutMinimum - Minimum amount to receive
 * @param {string} recipient - Address to receive tokens
 * @param {object} path - Path object with tokenPath, pairBinSteps, versions
 * @returns {Object} Swap parameters
 */
function createSwapParams(tokenIn, amountIn, amountOutMinimum, recipient, path, deadline = null) {
    return {
        tokenIn,
        amountIn: BigInt(amountIn),
        amountOutMinimum: BigInt(amountOutMinimum),
        path,
        to: recipient,
    };
}

/**
 * Creates swap parameters for native token (WNATIVE)
 * 
 * @param {string} tokenAddress - WNATIVE token address
 * @param {BigInt | string} amountIn - Amount to swap
 * @param {string} recipient - Address to receive tokens
 * @returns {Object} Swap parameters
 */
function createNativeSwapParams(tokenAddress, amountIn, recipient) {
    return {
        tokenIn: tokenAddress,
        amountIn: BigInt(amountIn),
        amountOutMinimum: BigInt(amountIn),
        path: {
            tokenPath: [],
            pairBinSteps: [],
            versions: []
        },
        to: recipient,
        
    };
}

module.exports = { 
    createSwapParams,
    createNativeSwapParams
};