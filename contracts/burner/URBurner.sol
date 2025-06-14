// SPDX-License-Identifier: MIT
/*
 * This contract uses:
 * - OpenZeppelin Contracts (MIT License)
 * - Uniswap V3 Contracts (GPL-3.0-or-later)
 *
 * For full license texts, see LICENSE file in the root directory
*/
/// @custom:security-contact security@ercburner.xyz
/// @custom:security-contact contact@ercburner.xyz
pragma solidity 0.8.24;

import { IERC20 } from '@openzeppelin/contracts/token/ERC20/IERC20.sol';
import { SafeERC20 } from '@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol';
import { Address } from '@openzeppelin/contracts/utils/Address.sol';
import { Commands } from "@uniswap/universal-router/contracts/libraries/Commands.sol";

import { Burner } from "./Burner.sol";
import { IUniversalRouter } from "./interfaces/IUniversalRouter.sol";
import { IWNATIVE } from "./interfaces/IWNATIVE.sol";
import { IRelayReceiver } from "./interfaces/IRelayReceiver.sol";

import { BurnerEvents } from "./libraries/BurnerEvents.sol";
import { BurnerErrors } from "./libraries/BurnerErrors.sol";

/// @title Universal Router Token Burner & Bridge
/// @author ERC Burner Team
/// @notice A contract that allows users to swap multiple tokens to NATIVE in a single transaction, and send to a different address, or through Relay's bridge.
/// @dev Uses Uniswap's Universal Router for token swaps and implements security measures
/// @dev Uses Relay's RelayReceiver contract for bridge calls
contract URBurner is Burner {
    using SafeERC20 for IERC20;
    using BurnerErrors for *;
    using BurnerEvents for *;

    /// @notice The parameters for a swap
    /// @param commands The command the router will execute
    /// @param inputs The parameters to the command
    struct SwapParams
    {
        bytes commands;
        bytes[] inputs;
    }

    /// @notice The Universal Router contract
    IUniversalRouter public routerContract;

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    /// @notice Initializes the contract with required parameters
    /// @param _routerContract Address of Uniswap's Universal Router contract
    /// @param _bridgeContract Address of the bridge contract
    /// @param _WNATIVE Address of the wrapped native token (WNATIVE)
    /// @param _USDC Address of the USDC token
    /// @param _USDC_DECIMALS The number of decimals of USDC
    /// @param _feeCollector Address that will receive the fees
    /// @param _burnFeeDivisor Burn fee divisor (100 = 1%, 200 = 0.5%)
    /// @param _nativeSentFeeDivisor Native sent fee divisor (1000 = 0.1%, 2000 = 0.05%)
    /// @param _referrerFeeShare Referrer fee share (5 = 25%, 20 = 100%)
    /// @param _minGasLeft Minimum gas left for a single swap
    /// @param _maxTokensPerBurn Maximum number of tokens that can be burned in one transaction
    /// @param _admin Address of the admin
    function initializeBurner(
        IUniversalRouter _routerContract,
        IRelayReceiver _bridgeContract,
        address _WNATIVE,
        address _USDC,
        uint256 _USDC_DECIMALS,
        address _feeCollector,
        uint256 _burnFeeDivisor,
        uint256 _nativeSentFeeDivisor,
        uint256 _referrerFeeShare,
        uint32 _minGasLeft,
        uint32 _maxTokensPerBurn,
        address _admin
    ) 
        external 
        initializer
    {
        if(address(_routerContract) == address(0)) revert BurnerErrors.ZeroAddress();

        routerContract = _routerContract;
        super.initialize(_bridgeContract, _WNATIVE, _USDC, _USDC_DECIMALS, _feeCollector, _burnFeeDivisor, _nativeSentFeeDivisor, _referrerFeeShare, _minGasLeft, _maxTokensPerBurn, _admin);

        emit BurnerEvents.RouterContractChanged(address(_routerContract));
    }
    

    /// @notice Swaps multiple tokens for NATIVE in a single transaction
    /// @dev Processes multiple swaps and charges a fee on the total output
    /// @param params Array of swap parameters for each token
    /// @param _to The recipient address
    /// @param bridge Whether to bridge the NATIVE
    /// @param bridgeData The data to be sent to the bridge contract
    /// @param _referrer The referrer address
    /// @return amountAfterFee The amount of NATIVE received after fees
    function swapExactInputMultiple(
        SwapParams[] calldata params,
        address _to,
        bool bridge,
        bytes calldata bridgeData,
        address _referrer,
        uint256 deadline
    ) 
        external 
        payable 
        nonReentrant 
        whenNotPaused 
        referrerCheck(_referrer) 
        returns (uint256 amountAfterFee) 
    {
        if (bridge && pauseBridge) revert BurnerErrors.BridgePaused();
        if (params.length == 0 || params.length > maxTokensPerBurn) revert BurnerErrors.MismatchedInputs(params.length);
        if (!bridge && bridgeData.length > 0) revert BurnerErrors.BridgeDataMustBeEmpty(bridgeData);
        if (bridge && _to != address(0)) revert BurnerErrors.BridgeAndRecipientBothSet(_to);
        if (bridge && bridgeData.length == 0) revert BurnerErrors.InvalidBridgeData();
        if (!bridge && msg.value > 0 && _to == address(0)) revert BurnerErrors.RecipientMustBeSet();
        if (!bridge && msg.value > 0 && _to == msg.sender) revert BurnerErrors.RecipientIsSender();

        if (deadline < block.timestamp) revert BurnerErrors.InvalidDeadline(deadline, block.timestamp);

        uint256 totalAmountOut = 0;
        uint256 len = params.length;

        for (uint256 i; i < len; i++) {
            SwapParams calldata param = params[i];
            // Validate and decode swap parameters
            (address tokenIn, uint256 amountIn) = _validateAndDecodeSwapParams(param);
            

            // Skip processing if gas is insufficient or amount is zero
            if (gasleft() < minGasLeft) {
                emit BurnerEvents.SwapFailed(msg.sender, tokenIn, amountIn, "Insufficient gas");
                break;
            }
            
            if (amountIn == 0) {
                emit BurnerEvents.SwapFailed(msg.sender, tokenIn, amountIn, "Zero amount");
                continue;
            }

            // Get the pre-balance of WNATIVE in the contract
            uint256 preBalance = IERC20(WNATIVE).balanceOf(address(this));

            // If token is WNATIVE, skip the swap
            if (tokenIn == WNATIVE) {
                IERC20(tokenIn).safeTransferFrom(msg.sender, address(this), amountIn);
                totalAmountOut += amountIn;
                emit BurnerEvents.SwapSuccess(msg.sender, tokenIn, amountIn, amountIn);
                continue;
            }

            IERC20(tokenIn).safeTransferFrom(msg.sender, address(routerContract), amountIn);

            try routerContract.execute(param.commands, param.inputs, deadline) {
                // Calculate the actual amount received
                uint256 postBalance = IERC20(WNATIVE).balanceOf(address(this));
                if (postBalance <= preBalance) revert BurnerErrors.SwapIssue(preBalance, postBalance);
                
                uint256 actualReceived = postBalance - preBalance;
                totalAmountOut += actualReceived;

                emit BurnerEvents.SwapSuccess(msg.sender, tokenIn, amountIn, actualReceived);
            } catch {
                (bytes memory command, bytes[] memory sweepInputs) = _createSweepParams(tokenIn, amountIn);
                try routerContract.execute(command, sweepInputs, deadline) {
                    emit BurnerEvents.SwapFailed(msg.sender, tokenIn, amountIn, "Router error");
                } catch {
                    revert BurnerErrors.SwapIssue(preBalance, 0);
                }
            }
        }
        
        // If the total amount out is 0, return 0.
        if (totalAmountOut == 0) return 0;
        // If the total amount out is less than the burn fee divisor * 20, revert.
        if (totalAmountOut < burnFeeDivisor * 20) revert BurnerErrors.InsufficientTotalOutput(totalAmountOut, burnFeeDivisor * 20);

        // Calculate the fee amount.
        uint256 feeAmount = totalAmountOut / burnFeeDivisor;
        // Calculate the amount after fee.
        amountAfterFee = totalAmountOut - feeAmount;

        // Convert WNATIVE to NATIVE.
        IWNATIVE(WNATIVE).withdraw(totalAmountOut);

        // If msg.value is sent and less than the bridge fee divisor * 20 (Times 20 to ensure proper fee calculation), revert.
        if (msg.value > 0 && msg.value < nativeSentFeeDivisor * 20) revert BurnerErrors.InsufficientValue(msg.value, nativeSentFeeDivisor * 20);

        // If msg.value is sent, calculate the bridge fee and update amountAfterFee.
        if (msg.value >= nativeSentFeeDivisor * 20) {
            uint256 bridgeFee = msg.value / nativeSentFeeDivisor;
            uint256 valueAfterFee = msg.value - bridgeFee;
            feeAmount += bridgeFee;
            amountAfterFee += valueAfterFee;
        }

        // If the referrer is not the zero address, calculate the referrer fee and update feeAmount.
        uint256 referrerFee = 0;
        if (_referrer != address(0)) {
            referrerFee = _calculateReferrerFee(feeAmount, _referrer);
            feeAmount -= referrerFee;
            Address.sendValue(payable(_referrer), referrerFee);
            emit BurnerEvents.ReferrerFeePaid(msg.sender, _referrer, referrerFee);
        }

        // Send the fee to the fee collector.
        Address.sendValue(payable(feeCollector), feeAmount);

        // If the bridge is true, send both the swapped NATIVE (net of fee) and the msg.value (net of fee) to the bridge contract.
        if (bridge) {
            // Send both the swapped NATIVE and the msg.value (net of fee) to the bridge contract.
            bridgeContract.forward{value: amountAfterFee}(bridgeData);
            // Redundant event, but kept for clarity and dashboards.
            emit BurnerEvents.BridgeSuccess(msg.sender, bridgeData, amountAfterFee, feeAmount + referrerFee);
        } else {
            // Determine recipient: use _to if provided, otherwise default to msg.sender.
            address recipient = _to == address(0) ? msg.sender : _to;
            
            // Send the swapped NATIVE (net of fee) to the recipient.
            Address.sendValue(payable(recipient), amountAfterFee);
        }

        emit BurnerEvents.BurnSuccess(msg.sender, amountAfterFee, feeAmount + referrerFee);
        return amountAfterFee;
    }

    /// @notice Validates and decodes swap parameters
    /// @dev Ensures the swap parameters are valid and returns the input amount
    /// @param param The swap parameters to validate
    /// @return tokenIn The token to swap
    /// @return amountIn The amount of tokens to swap
    function _validateAndDecodeSwapParams(SwapParams calldata param) 
        private 
        view 
        returns (address tokenIn, uint256 amountIn) 
    {
        // If the commands length is different from 1, revert.
        if (param.commands.length != 1) revert BurnerErrors.InvalidCommands(param.commands);
        // If the inputs length is different from 1, revert.
        if (param.inputs.length != 1) revert BurnerErrors.MismatchedInputLength(param.inputs);
        // Get the command.
        address recipient = address(0);
        
        // Decode input based on command, to ensure the input is valid.
        // Cast Commands constants to bytes1 for comparison
        if (param.commands[0] == bytes1(uint8(Commands.V3_SWAP_EXACT_IN))) {
            (recipient, tokenIn, amountIn) = _validateAndDecodeV3(param);
        } else if (param.commands[0] == bytes1(uint8(Commands.V2_SWAP_EXACT_IN))) {
            (recipient, tokenIn, amountIn) = _validateAndDecodeV2(param);
        } else if (param.commands[0] == bytes1(uint8(Commands.UNWRAP_WETH))) {
            (recipient, tokenIn, amountIn) = _validateAndDecodeWNATIVE(param);
        } else {
            // Cast command byte to uint8 for the error
            revert BurnerErrors.InvalidCommand(uint8(param.commands[0]));
        }

        if (recipient != address(this)) revert BurnerErrors.InvalidRecipient(recipient);

        return (tokenIn, amountIn);
    }

    /// @notice Validates a SWAPV3 is formatted as expected
    /// @param param The swap parameters
    /// @return recipient The swap recipient
    /// @return tokenIn The token being swapped
    /// @return amountIn The amount of token being swapped
    function _validateAndDecodeV3(SwapParams calldata param)
        private
        view
        returns (address recipient, address tokenIn, uint256 amountIn)
    {
        bytes memory path;
        address tokenOut;
        bool payerIsUser;

        (recipient, amountIn, , path, payerIsUser) = 
        abi.decode(param.inputs[0],(address, uint256, uint256, bytes, bool));
        if (path.length == 43) {
            // For a path with format [tokenIn (20 bytes)][fee (3 bytes)][tokenOut (20 bytes)]
            assembly {
                tokenIn := mload(add(path, 20))
                tokenOut := mload(add(path, 43))
            }
            if (tokenOut != WNATIVE) revert BurnerErrors.InvalidTokenOut(tokenOut);
            if (payerIsUser) revert BurnerErrors.PayerIsUser();
        } else {
            revert BurnerErrors.MismatchedInputLength(param.inputs);
        }
    }

    /// @notice Validates a SWAPV2 is formatted as expected
    /// @param param The swap parameters
    /// @return recipient The swap recipient
    /// @return tokenIn The token being swapped
    /// @return amountIn The amount of token being swapped
    function _validateAndDecodeV2(SwapParams calldata param)
        private
        view
        returns (address recipient, address tokenIn, uint256 amountIn)
    {
        address[] memory path;
        address tokenOut;
        bool payerIsUser;
        (recipient, amountIn, , path, payerIsUser) = 
        abi.decode(param.inputs[0],(address, uint256, uint256, address[], bool));
        if (path.length == 2) {
            tokenIn = path[0];
            tokenOut = path[1];
            if (tokenOut != WNATIVE) revert BurnerErrors.InvalidTokenOut(tokenOut);
            if (payerIsUser) revert BurnerErrors.PayerIsUser();
        } else {
            revert BurnerErrors.MismatchedInputLength(param.inputs);
        }
    }

    /// @notice Validates a WNATIVE swap paremeter is formatted as expected
    /// @param param The swap parameters
    /// @return recipient The swap recipient
    /// @return tokenIn The token being swapped
    /// @return amountIn The amount of token being swapped
    function _validateAndDecodeWNATIVE(SwapParams calldata param)
        private
        pure
        returns (address recipient, address tokenIn, uint256 amountIn)
    {
        (recipient, tokenIn, amountIn) =
        abi.decode(param.inputs[0], (address, address, uint256));
    }

    /// @notice Creates the sweep parameters when a swap fails
    /// @param tokenIn The token being sweeped
    /// @param amountIn The amount of token being sweeped
    /// @return commands The sweep command to executes
    /// @return inputs The inputs to the commands
    function _createSweepParams(address tokenIn, uint256 amountIn) 
        private 
        view 
        returns (bytes memory commands, bytes[] memory inputs) 
    {
        bytes memory command = new bytes(1);
        command[0] = bytes1(uint8(Commands.SWEEP)); 
        bytes[] memory sweepInputs = new bytes[](1);
        sweepInputs[0] = abi.encode(tokenIn, msg.sender, amountIn);
        return (command, sweepInputs);
    }
}