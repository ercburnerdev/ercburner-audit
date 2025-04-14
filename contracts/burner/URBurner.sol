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

import { Burner } from "./Burner.sol";
import { IUniversalRouter } from "./interfaces/IUniversalRouter.sol";
import { IPermit2 } from "./interfaces/IPermit2.sol";
import { IWETH } from "./interfaces/IWETH.sol";

import { BurnerEvents } from "./libraries/BurnerEvents.sol";
import { BurnerErrors } from "./libraries/BurnerErrors.sol";

/// @title Universal Router Token Burner & Bridge
/// @author ERC Burner Team
/// @notice A contract that allows users to swap multiple tokens to ETH in a single transaction, and send to a different address, or through Relay's bridge.
/// @dev Uses Uniswap's Universal Router for token swaps and implements security measures
/// @dev Uses Relay's RelayReceiver contract for bridge calls
contract URBurner is Burner {
    using SafeERC20 for IERC20;
    using BurnerErrors for *;
    using BurnerEvents for *;

    /// @notice The parameters for a swap
    /// @param tokenIn The token to swap
    /// @param commands The command the router will execute
    /// @param inputs The parameters to the command
    struct SwapParams
    {
        address tokenIn;
        bytes commands;
        bytes[] inputs;
    }

    /// @notice The Universal Router contract
    IUniversalRouter public universalRouter;
    /// @notice The Permit2 contract
    IPermit2 public permit2;

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    /// @notice Initializes the contract with required parameters
    /// @param _universalRouter Address of Uniswap's Universal Router contract
    /// @param _permit2 Address of the Permit2 contract
    /// @param _bridgeAddress Address of the bridge contract
    /// @param _WNATIVE Address of the wrapped native token (WETH)
    /// @param _USDC Address of the USDC token
    /// @param _feeCollector Address that will receive the fees
    /// @param _burnFeeDivisor Burn fee divisor (100 = 1%, 200 = 0.5%)
    /// @param _bridgeFeeDivisor Bridge fee divisor (1000 = 0.1%, 2000 = 0.05%)
    /// @param _referrerFeeShare Referrer fee share (5 = 25%, 20 = 100%)
    /// @param _minGasForSwap Minimum gas required for a single swap
    /// @param _maxTokensPerBurn Maximum number of tokens that can be burned in one transaction
    /// @param _pauseBridge Whether to pause bridge
    /// @param _pauseReferral Whether to pause referral
    /// @param _admin Address of the admin
    function initializeBurner(
        IUniversalRouter _universalRouter,
        IPermit2 _permit2,
        address _bridgeAddress,
        address _WNATIVE,
        address _USDC,
        address _feeCollector,
        uint256 _burnFeeDivisor,
        uint256 _bridgeFeeDivisor,
        uint8 _referrerFeeShare,
        uint32 _minGasForSwap,
        uint32 _maxTokensPerBurn,
        bool _pauseBridge,
        bool _pauseReferral,
        address _admin
    ) 
        external 
        initializer 
    {
        __ReentrancyGuard_init_unchained();
        __Ownable_init_unchained(msg.sender);
        __Pausable_init_unchained();
        __AccessControl_init_unchained();

        if(address(_universalRouter) == address(0)) revert BurnerErrors.ZeroAddress();
        if(address(_permit2) == address(0)) revert BurnerErrors.ZeroAddress();

        universalRouter = _universalRouter;
        permit2 = _permit2;

        emit BurnerEvents.RouterChanged(address(_universalRouter));
        emit BurnerEvents.Permit2Changed(address(_permit2));

        super.initialize(_bridgeAddress, _WNATIVE, _USDC, _feeCollector, _burnFeeDivisor, _bridgeFeeDivisor, _referrerFeeShare, _minGasForSwap, _maxTokensPerBurn, _pauseBridge, _pauseReferral, _admin);
    }
    

    /// @notice Swaps multiple tokens for ETH in a single transaction
    /// @dev Processes multiple swaps and charges a fee on the total output
    /// @param params Array of swap parameters for each token
    /// @param _to The recipient address
    /// @param bridge Whether to bridge the ETH
    /// @param bridgeData The data to be sent to the bridge contract
    /// @param _referrer The referrer address
    /// @return amountAfterFee The amount of ETH received after fees
    function swapExactInputMultiple(
        SwapParams[] calldata params,
        address _to,
        bool bridge,
        bytes calldata bridgeData,
        address _referrer
    ) 
        external 
        payable 
        nonReentrant 
        whenNotPaused 
        referrerCheck(_referrer) 
        toCheck(_to) 
        returns (uint256 amountAfterFee) 
    {
        if (bridge && pauseBridge) revert BurnerErrors.BridgePaused();
        if (params.length == 0 || params.length > maxTokensPerBurn) revert BurnerErrors.MismatchedInputs(params.length);
        if (!bridge && bridgeData.length > 0) revert BurnerErrors.BridgeDataMustBeEmpty(bridgeData);
        if (bridge && _to != address(0)) revert BurnerErrors.BridgeAndRecipientBothSet(_to);
        if (bridge && bridgeData.length == 0) revert BurnerErrors.InvalidBridgeData();
        if (!bridge && msg.value > 0 && _to == address(0)) revert BurnerErrors.RecipientMustBeSet();

        uint256 totalAmountOut = 0;
        uint48 expiration = uint48(block.timestamp + 900);
        uint256 len = params.length;

        for (uint256 i; i < len; ) {
            SwapParams calldata param = params[i];
            uint256 amountIn = _validateAndDecodeSwapParams(param);

            // Short circuit if insufficient gas.
            if (gasleft() < minGasForSwap) {
                emit BurnerEvents.SwapFailed(msg.sender, param.tokenIn, amountIn, "Insufficient gas");
                break;
            }
            // Skip if amount is 0.
            if (amountIn == 0) {
                emit BurnerEvents.SwapFailed(msg.sender, param.tokenIn, amountIn, "Zero amount");
                unchecked { ++i; }
                continue;
            }



            // Get the pre-balance of WNATIVE in the contract.
            uint256 preBalance = IERC20(WNATIVE).balanceOf(address(this));

            // Transfer the token from the sender to the contract.
            IERC20 token = IERC20(param.tokenIn);
            token.safeTransferFrom(msg.sender, address(this), amountIn);

            // If token is WNATIVE, skip the swap.
            if (param.tokenIn == WNATIVE) {
                totalAmountOut += amountIn;
                emit BurnerEvents.SwapSuccess(msg.sender, param.tokenIn, amountIn, amountIn);
                unchecked { ++i; }
                continue;
            }

            // Increase the allowance of the permit2 contract.
            token.safeIncreaseAllowance(address(permit2), amountIn);
            // Approve router for the amount of tokens to be swapped.
            permit2.approve(param.tokenIn, address(universalRouter), uint160(amountIn), expiration);

            // Execute the swap.
            try universalRouter.execute(param.commands, param.inputs, expiration) {
                // Get the post-balance of WNATIVE in the contract.
                uint256 postBalance = IERC20(WNATIVE).balanceOf(address(this));

                // If the post-balance is less than the pre-balance, there was an issue with the swap.
                if (postBalance < preBalance) revert BurnerErrors.SwapIssue(preBalance, postBalance);

                // Calculate the actual amount received.
                uint256 actualReceived = postBalance - preBalance;
                totalAmountOut += actualReceived;

                emit BurnerEvents.SwapSuccess(msg.sender, param.tokenIn, amountIn, actualReceived);
            } catch {
                // If the swap fails, decrease the allowance of the permit2 contract.
                token.safeDecreaseAllowance(address(permit2), amountIn);
                // Return the tokens to the sender.
                token.safeTransfer(msg.sender, amountIn);

                emit BurnerEvents.SwapFailed(msg.sender, param.tokenIn, amountIn, "Router error");

                unchecked { ++i; }
                continue;
            }
            unchecked { ++i; }
        }
        
        // If the total amount out is 0, return 0.
        if (totalAmountOut == 0) return 0;
        // If the total amount out is less than the burn fee divisor * 20, revert.
        if (totalAmountOut < burnFeeDivisor * 20) revert BurnerErrors.InsufficientTotalOutput(totalAmountOut, burnFeeDivisor * 20);

        // Calculate the fee amount.
        uint256 feeAmount = totalAmountOut / burnFeeDivisor;
        // Calculate the amount after fee.
        amountAfterFee = totalAmountOut - feeAmount;

        // Convert WNATIVE to ETH.
        IWETH(WNATIVE).withdraw(totalAmountOut);

        // If msg.value is sent and less than the bridge fee divisor * 20 (Times 20 to ensure proper fee calculation), revert.
        if (msg.value > 0 && msg.value < bridgeFeeDivisor * 20) revert BurnerErrors.InsufficientValue(msg.value, bridgeFeeDivisor * 20);

        // If msg.value is sent, calculate the bridge fee and update amountAfterFee.
        if (msg.value >= bridgeFeeDivisor * 20) {
            uint256 bridgeFee = msg.value / bridgeFeeDivisor;
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

        // If the bridge is true, send both the swapped ETH (net of fee) and the msg.value (net of fee) to the bridge contract.
        if (bridge) {
            // Send both the swapped ETH and the msg.value (net of fee) to the bridge contract.
            bytes memory returnData = Address.functionCallWithValue(bridgeAddress, bridgeData, amountAfterFee);
            // Redundant event, but kept for clarity and dashboards.
            emit BurnerEvents.BridgeSuccess(msg.sender, returnData, amountAfterFee, feeAmount + referrerFee);
        } else {
            // Determine recipient: use _to if provided, otherwise default to msg.sender.
            address recipient = _to == address(0) ? msg.sender : _to;
            
            // Send the swapped ETH (net of fee) to the recipient.
            Address.sendValue(payable(recipient), amountAfterFee);
        }

        emit BurnerEvents.BurnSuccess(msg.sender, amountAfterFee, feeAmount + referrerFee);
        return amountAfterFee;
    }

    /// @notice Validates and decodes swap parameters
    /// @dev Ensures the swap parameters are valid and returns the input amount
    /// @param param The swap parameters to validate
    /// @return amountIn The amount of tokens to swap
    function _validateAndDecodeSwapParams(SwapParams calldata param) 
        private 
        view 
        returns (uint256 amountIn) 
    {
        // If the commands length is not 1, revert.
        if (param.commands.length != 1) revert BurnerErrors.InvalidCommands(param.commands);
        // If the inputs length is not 1, revert.
        if (param.inputs.length != 1) revert BurnerErrors.MismatchedInputLength(param.inputs);
        // Get the command.
        bytes1 command = param.commands[0];
        // If the command is not 0x00, 0x08, or 0x0c, revert.
        if (command != 0x00 && command != 0x08 && command != 0x0c) {
            revert BurnerErrors.InvalidCommand(command);
        }
        address recipient = address(0);
        bool payerIsUser = false;
        uint256 amountOutMinimum = 0;
        
        // Decode input based on command, to ensure the input is valid.
        if (command == 0x00) {
            bytes memory path;
            (recipient, amountIn, amountOutMinimum, path, payerIsUser) = 
            abi.decode(param.inputs[0],(address, uint256, uint256, bytes, bool));
        } else if (command == 0x08) {
            address[] memory path;
            (recipient, amountIn, amountOutMinimum, path, payerIsUser) = 
            abi.decode(param.inputs[0],(address, uint256, uint256, address[], bool));
        } else if (command == 0x0c) {
            (recipient, amountIn) =
            abi.decode(param.inputs[0], (address, uint256));
            amountOutMinimum = amountIn;
        }
        if (recipient != address(this)) {
            revert BurnerErrors.InvalidRecipient(recipient);
        }
        return amountIn;
    }

    /// @notice Updates the universal router address
    /// @dev Can only be called by the owner
    /// @param _newUniversalRouter New address to universal router
    function setUniversalRouter(address _newUniversalRouter) 
        external 
        onlyOwner 
        nonReentrant 
    {
        if (_newUniversalRouter == address(0)) revert BurnerErrors.ZeroAddress();
        universalRouter = IUniversalRouter(_newUniversalRouter);
        emit BurnerEvents.RouterChanged(_newUniversalRouter);
    }

    /// @notice Updates the permit2 address
    /// @dev Can only be called by the owner
    /// @param _newPermit2 New address to permit2
    function setPermit2(address _newPermit2)
        external
        onlyOwner
        nonReentrant
    {
        if (_newPermit2 == address(0)) revert BurnerErrors.ZeroAddress();
        permit2 = IPermit2(_newPermit2);
        emit BurnerEvents.Permit2Changed(_newPermit2);
    }
}