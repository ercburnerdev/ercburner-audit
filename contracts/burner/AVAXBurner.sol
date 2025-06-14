// SPDX-License-Identifier: MIT
/*
 * This contract uses:
 * - OpenZeppelin Contracts (MIT License)
 * - Trader Joe's LB Router (MIT License)
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
import { ILBRouter } from './interfaces/ILBRouter.sol';
import { IWNATIVE } from "./interfaces/IWNATIVE.sol";
import { IRelayReceiver } from "./interfaces/IRelayReceiver.sol";

import { BurnerEvents } from "./libraries/BurnerEvents.sol";
import { BurnerErrors } from "./libraries/BurnerErrors.sol";

/// @title Trader Joe's LB Router Token Burner
/// @author ERC Burner Team
/// @notice A contract that allows users to swap multiple tokens to AVAX in a single transaction
/// @dev Uses Trader Joe's LB Router for token swaps and implements security measures
/// @dev Uses Relay's RelayReceiver contract for bridge calls
contract AVAXBurner is Burner {
    using SafeERC20 for IERC20;
    using BurnerErrors for *;
    using BurnerEvents for *;

    /// @notice The parameters for a swap
    /// @param tokenIn The token to swap
    /// @param amountIn The amount of tokens to swap
    /// @param amountOutMinimum The minimum amount of tokens to receive
    /// @param path The path of the swap
    struct SwapParams 
    {
        address tokenIn;
        uint256 amountIn;
        uint256 amountOutMinimum;
        ILBRouter.Path path;
    }

    /// @notice The Trader Joe's LB Router contract
    ILBRouter public routerContract;
    /// @notice The bridge contract address

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    /// @notice Initializes the contract with required parameters
    /// @dev Sets up the contract with initial configuration values
    /// @param _routerContract Address of the LFJ's LBRouter contract
    /// @param _bridgeAddress Address of the bridge contract
    /// @param _WNATIVE Address of the wrapped native token (WNATIVE)
    /// @param _USDC Address of the USDC token
    /// @param _USDC_DECIMALS The number of decimals of USDC
    /// @param _feeCollector Address that will receive the fees
    /// @param _burnFeeDivisor Burn fee divisor (100 = 1%, 200 = 0.5%)
    /// @param _bridgeFeeDivisor Bridge fee divisor (1000 = 0.1%, 2000 = 0.05%)
    /// @param _referrerFeeShare Referrer fee share (5 = 25%, 20 = 100%)
    /// @param _minGasLeft Minimum gas required for a single swap
    /// @param _maxTokensPerBurn Maximum number of tokens that can be burned in one transaction
    /// @param _admin Address of the admin
    function initializeBurner(
        ILBRouter _routerContract,
        IRelayReceiver _bridgeAddress,
        address _WNATIVE,
        address _USDC,
        uint256 _USDC_DECIMALS,
        address _feeCollector,
        uint256 _burnFeeDivisor,
        uint256 _bridgeFeeDivisor,
        uint256 _referrerFeeShare,
        uint32 _minGasLeft,
        uint32 _maxTokensPerBurn,
        address _admin
    ) 
        external 
        initializer 
    {
        if(address(_routerContract) == address(0)) revert BurnerErrors.ZeroAddress();

        super.initialize(
            _bridgeAddress,
            _WNATIVE,
            _USDC,
            _USDC_DECIMALS,
            _feeCollector,
            _burnFeeDivisor,
            _bridgeFeeDivisor,
            _referrerFeeShare,
            _minGasLeft,
            _maxTokensPerBurn,
            _admin
        );

        routerContract = _routerContract;

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
            // Short circuit if insufficient gas.
            if (gasleft() < minGasLeft) {
                emit BurnerEvents.SwapFailed(msg.sender, param.tokenIn, param.amountIn, "Insufficient gas");
                break;
            }
            // Skip if amount is 0.
            if (param.amountIn == 0) {
                emit BurnerEvents.SwapFailed(msg.sender, param.tokenIn, param.amountIn, "Zero amount");
                continue;
            }

            // Transfer the tokens from the sender to the contract.
            IERC20 token = IERC20(param.tokenIn);
            token.safeTransferFrom(msg.sender, address(this), param.amountIn);

            // If token is WNATIVE, skip the swap.
            if (param.tokenIn == WNATIVE) {
                totalAmountOut += param.amountIn;
                emit BurnerEvents.SwapSuccess(msg.sender, param.tokenIn, param.amountIn, param.amountIn);
                continue;
            }
            
            if(address(param.path.tokenPath[param.path.tokenPath.length - 1]) != WNATIVE) revert BurnerErrors.InvalidTokenOut(address(param.path.tokenPath[param.path.tokenPath.length - 1]));
            // Increase allowance for the swap router.
            token.safeIncreaseAllowance(address(routerContract), param.amountIn);

            // Execute the swap.
            try routerContract.swapExactTokensForTokens(param.amountIn, param.amountOutMinimum, param.path, address(this), deadline) returns (uint256 actualReceived) {
                // If the amount received is 0, revert.
                if (actualReceived <= 0) revert BurnerErrors.AvaxSwapIssue(msg.sender, param.tokenIn, param.amountIn, "Zero amount received");
                // Add the amount received to the total amount out.
                totalAmountOut += actualReceived;

                emit BurnerEvents.SwapSuccess(msg.sender, param.tokenIn, param.amountIn, actualReceived);
            } catch {
                // If the swap fails, decrease the allowance of the router contract.
                token.safeTransfer(msg.sender, param.amountIn);
                try token.approve(address(routerContract), 0) {
                    emit BurnerEvents.SwapFailed(msg.sender, param.tokenIn, param.amountIn, "Router error");
                } catch {
                    emit BurnerEvents.SwapFailed(msg.sender, param.tokenIn, param.amountIn, "Router error + Revoke failure");
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
            //Redundant event, but kept for clarity and dashboards.
            emit BurnerEvents.BridgeSuccess(msg.sender, bridgeData, amountAfterFee, feeAmount + referrerFee);
        } else {
            // Determine recipient: use _to if provided, otherwise default to msg.sender.
            address recipient = _to == address(0) ? msg.sender : _to;
            // Send the amount after fee to the recipient.
            Address.sendValue(payable(recipient), amountAfterFee);
        }

        emit BurnerEvents.BurnSuccess(msg.sender, amountAfterFee, feeAmount + referrerFee);
        return amountAfterFee;
    }
}