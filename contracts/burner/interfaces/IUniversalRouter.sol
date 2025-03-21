 // SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

/// @title Universal Router Interface
/// @notice Interface for the Uniswap Universal Router contract
interface IUniversalRouter {
    function execute(
        bytes calldata commands, 
        bytes[] calldata inputs, 
        uint256 deadline
    ) external payable;
}