 // SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

/// @title Permit2 Interface
/// @notice Interface for the Uniswap Permit2 contract
interface IPermit2 {
    function approve(
        address token, 
        address spender, 
        uint160 amount, 
        uint48 expiration
    ) external;
}