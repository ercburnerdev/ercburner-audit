 // SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

/// @title WNATIVE Interface
/// @notice Interface for the Wrapped NATIVE contract
interface IWNATIVE {
    /// @notice Withdraws a specific amount of NATIVE from the contract.
    /// @param amount The amount of NATIVE to withdraw.
    function withdraw(uint256 amount) external;
}