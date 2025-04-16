 // SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

/// @title RelayReceiver Interface
/// @notice Interface for the RelayReceiver contract
interface IRelayReceiver {
    /// @notice Approves a spender to spend a specific amount of tokens.
    /// @param data The data to forward to the bridge.
    function forward(
        bytes calldata data
    ) external payable;
}