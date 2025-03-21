 // SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

/// @title WETH Interface
/// @notice Interface for the Wrapped ETH contract
interface IWETH {
    function withdraw(uint256) external;
}