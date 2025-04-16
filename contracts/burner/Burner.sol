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

import { Initializable } from '@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol';
import { ReentrancyGuardUpgradeable } from '@openzeppelin/contracts-upgradeable/utils/ReentrancyGuardUpgradeable.sol';
import { OwnableUpgradeable } from '@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol';
import { AccessControlUpgradeable } from '@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol';
import { IERC20 } from '@openzeppelin/contracts/token/ERC20/IERC20.sol';
import { SafeERC20 } from '@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol';
import { PausableUpgradeable } from '@openzeppelin/contracts-upgradeable/utils/PausableUpgradeable.sol';
import { Address } from '@openzeppelin/contracts/utils/Address.sol';

import { IUniversalRouter } from "./interfaces/IUniversalRouter.sol";
import { IPermit2 } from "./interfaces/IPermit2.sol";
import { IWETH } from "./interfaces/IWETH.sol";
import { IRelayReceiver } from "./interfaces/IRelayReceiver.sol";

import { BurnerEvents } from "./libraries/BurnerEvents.sol";
import { BurnerErrors } from "./libraries/BurnerErrors.sol";

/// @title Universal Router Token Burner & Bridge
/// @author ERC Burner Team
/// @notice A contract that allows users to swap multiple tokens to ETH in a single transaction, and send to a different address, or through Relay's bridge.
/// @dev Uses Uniswap's Universal Router for token swaps and implements security measures
/// @dev Uses Relay's RelayReceiver contract for bridge calls
abstract contract Burner is Initializable, ReentrancyGuardUpgradeable, OwnableUpgradeable, PausableUpgradeable, AccessControlUpgradeable {
    using SafeERC20 for IERC20;
    using BurnerErrors for *;
    using BurnerEvents for *;
    
    /// @notice Role identifier for administrators
    bytes32 public constant ADMIN_ROLE = keccak256("ADMIN_ROLE");

    /// @notice The bridge contract address
    IRelayReceiver public bridgeContract;
    /// @notice The wrapped native token address
    address public WNATIVE;
    /// @notice The USDC token address
    address public USDC;
    /// @notice USDC Decimal multiplier (10 ** USDC_DECIMALS)
    uint256 public USDC_DECIMALS_MULTIPLIER;
    /// @notice The fee collector address
    address public feeCollector;

    /// @notice The burn fee divisor, as in 100/divisor = y%
    uint256 public burnFeeDivisor;
    /// @notice The bridge fee divisor, as in 100/divisor = y%
    uint256 public nativeSentFeeDivisor;
    /// @notice The default referrer fee share, as in share/20 = y%
    uint256 public referrerFeeShare;

    /// @notice The partners addresses mapped to a specific fee share
    mapping(address partner => uint8 feeShare) public partners;

    /// @notice The minimum gas required for a swap
    /// @dev This is to short circuit the burn function and prevent reverts cause by low gas.
    uint32 public minGasForSwap;
    
    /// @notice The maximum number of tokens that can be burned in one transaction. 
    /// @dev Has been calculated based on the max gas limit of blocks. Should over around 50-70% of the max gas limit.
    uint32 public maxTokensPerBurn;

    /// @notice Whether to pause the bridge
    bool public pauseBridge;
    /// @notice Whether to pause the referral
    bool public pauseReferral;

    /// @notice Initializes the contract with required parameters
    /// @param _bridgeContract Address of the bridge contract
    /// @param _WNATIVE Address of the wrapped native token (WETH)
    /// @param _USDC Address of the USDC token,
    /// @param _USDC_DECIMALS The number of decimals of USDC
    /// @param _feeCollector Address that will receive the fees
    /// @param _burnFeeDivisor Burn fee divisor (100 = 1%, 200 = 0.5%)
    /// @param _nativeSentFeeDivisor Native sent fee divisor (1000 = 0.1%, 2000 = 0.05%)
    /// @param _referrerFeeShare Referrer fee share (5 = 25%, 20 = 100%)
    /// @param _minGasForSwap Minimum gas required for a single swap
    /// @param _maxTokensPerBurn Maximum number of tokens that can be burned in one transaction
    /// @param _pauseBridge Whether to pause bridge
    /// @param _pauseReferral Whether to pause referral
    /// @param _admin Address of the admin
    function initialize(
        IRelayReceiver _bridgeContract,
        address _WNATIVE,
        address _USDC,
        uint256 _USDC_DECIMALS,
        address _feeCollector,
        uint256 _burnFeeDivisor,
        uint256 _nativeSentFeeDivisor,
        uint256 _referrerFeeShare,
        uint32 _minGasForSwap,
        uint32 _maxTokensPerBurn,
        bool _pauseBridge,
        bool _pauseReferral,
        address _admin
    ) 
        internal 
        initializer 
    {
        __ReentrancyGuard_init_unchained();
        __Ownable_init_unchained(msg.sender);
        __Pausable_init_unchained();
        __AccessControl_init_unchained();

        if(address(_bridgeContract) == address(0)) revert BurnerErrors.ZeroAddress();
        if(_WNATIVE == address(0)) revert BurnerErrors.ZeroAddress();
        if(_USDC == address(0)) revert BurnerErrors.ZeroAddress();
        if(_feeCollector == address(0)) revert BurnerErrors.ZeroAddress();
        if(_admin == address(0)) revert BurnerErrors.ZeroAddress();

        bridgeContract = _bridgeContract;
        WNATIVE = _WNATIVE;
        USDC = _USDC;
        USDC_DECIMALS_MULTIPLIER = 10 ** _USDC_DECIMALS;
        feeCollector = _feeCollector;
        referrerFeeShare = _referrerFeeShare;
        burnFeeDivisor = _burnFeeDivisor;
        nativeSentFeeDivisor = _nativeSentFeeDivisor;
        minGasForSwap = _minGasForSwap;
        maxTokensPerBurn = _maxTokensPerBurn;
        pauseBridge = _pauseBridge;
        pauseReferral = _pauseReferral;

        // Setup administration roles
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(ADMIN_ROLE, _admin);

        emit BurnerEvents.FeeCollectorChanged(_feeCollector);
        emit BurnerEvents.BridgeContractChanged(address(_bridgeContract));
        emit BurnerEvents.PauseBridgeChanged(_pauseBridge);
        emit BurnerEvents.BurnFeeDivisorChanged(_burnFeeDivisor);
        emit BurnerEvents.NativeSentFeeDivisorChanged(_nativeSentFeeDivisor);
        emit BurnerEvents.ReferrerFeeShareChanged(_referrerFeeShare);
        emit BurnerEvents.MinGasForSwapChanged(_minGasForSwap);
        emit BurnerEvents.MaxTokensPerBurnChanged(_maxTokensPerBurn);
        emit BurnerEvents.AdminChanged(_admin);
    }

    /// @notice Fallback function to allow the contract to receive ETH
    fallback() external payable {}

    /// @notice Receive function to allow the contract to receive ETH
    receive() external payable {}

    /// @notice Modifier to check if the referrer is valid
    /// @param _referrer The referrer address
    modifier referrerCheck(address _referrer) {
        if (_referrer == msg.sender && partners[_referrer] == 0) revert BurnerErrors.ReferrerCannotBeSelf();
        if (_referrer == feeCollector) revert BurnerErrors.ReferrerCannotBeFeeCollector();
        if (_referrer == address(this)) revert BurnerErrors.ReferrerCannotBeContract();
        _;
    }
    
    /// @notice Modifier to check if the recipient is valid
    /// @param _to The recipient address
    modifier toCheck(address _to) {
        if (_to == address(this)) revert BurnerErrors.ToCannotBeContract();
        if (_to == feeCollector) revert BurnerErrors.ToCannotBeFeeCollector();
        _;
    }

    /// @notice Calls the Relay Receiver bridge contract
    /// @param _bridgeData The data to be sent to the bridge contract
    /// @param _referrer The referrer address
    function relayBridge(bytes calldata _bridgeData, address _referrer)
        external 
        payable 
        nonReentrant 
        whenNotPaused
        referrerCheck(_referrer) 
    {
        if (pauseBridge) revert BurnerErrors.BridgePaused();
        if (msg.value == 0) revert BurnerErrors.ZeroValue();
        if (_bridgeData.length == 0) revert BurnerErrors.InvalidBridgeData();
        if (msg.value < nativeSentFeeDivisor * 20) revert BurnerErrors.InsufficientValue(msg.value, nativeSentFeeDivisor * 20);

        // Calculate the bridge fee and amount after fee.
        uint256 bridgeFee = msg.value / nativeSentFeeDivisor;
        uint256 amountAfterFee = msg.value - bridgeFee;

        uint256 referrerFee = 0;
        if (_referrer != address(0)) {
            referrerFee = _calculateReferrerFee(bridgeFee, _referrer);
            bridgeFee -= referrerFee;
            Address.sendValue(payable(_referrer), referrerFee);
            emit BurnerEvents.ReferrerFeePaid(msg.sender, _referrer, referrerFee);
        }
        // Send the fee to the fee collector.
        Address.sendValue(payable(feeCollector), bridgeFee);

        // Call the bridge contract.
        IRelayReceiver(bridgeContract).forward{value: amountAfterFee}(_bridgeData);
        emit BurnerEvents.BridgeSuccess(msg.sender, _bridgeData, amountAfterFee, bridgeFee + referrerFee);
    }

    /// @notice User can pay for a better referrer fee share.
    /// @param _amount The amount of USDC to pay for the referrer fee share.
    function paidReferrer(uint256 _amount) 
        external         
    {
        if (partners[msg.sender] > 0) revert BurnerErrors.ReferrerAlreadyPaid();
        uint256 allowance = IERC20(USDC).allowance(msg.sender, address(this));
        uint8 feeShare = 0;
        
        // 100 USDC = 50% share
        // 50 USDC = 40% share
        // 25 USDC = 30% share
        if (_amount == 100 * USDC_DECIMALS_MULTIPLIER && allowance >= 100 * USDC_DECIMALS_MULTIPLIER) {
            feeShare = 10; // 50% share
        } else if (_amount == 50 * USDC_DECIMALS_MULTIPLIER && allowance >= 50 * USDC_DECIMALS_MULTIPLIER) {
            feeShare = 8; // 40% share
        } else if (_amount == 25 * USDC_DECIMALS_MULTIPLIER && allowance >= 25 * USDC_DECIMALS_MULTIPLIER) {
            feeShare = 6; // 30% share
        } else {
            revert BurnerErrors.InsufficientAllowanceOrAmount(allowance, _amount);
        }
        // Update the partner's fee share.
        partners[msg.sender] = feeShare;
        // Transfer the required amount.
        IERC20(USDC).safeTransferFrom(msg.sender, feeCollector, _amount);

        emit BurnerEvents.PartnerAdded(msg.sender);
        emit BurnerEvents.PartnerFeeShareChanged(msg.sender, feeShare);
    }

    /// @notice User can upgrade their referrer fee share.
    /// @param _amount The amount of USDC to pay for the referrer fee share.
    function upgradeReferrer(uint256 _amount) 
        external 
    {
        uint256 currentShare = partners[msg.sender];
        if (currentShare == 0) revert BurnerErrors.ReferrerNotRegistered();
        
        uint256 allowance = IERC20(USDC).allowance(msg.sender, address(this));
        uint8 newFeeShare = 0;
        uint256 requiredAmount = 0;

        // For 30% tier, 75 USDC = 50% share
        // For 30% tier, 25 USDC = 40% share
        if (currentShare == 6) { // Current tier is 30%
            if (_amount == 75 * USDC_DECIMALS_MULTIPLIER && allowance >= 75 * USDC_DECIMALS_MULTIPLIER) {
                newFeeShare = 10; // 50% share
                requiredAmount = 75 * USDC_DECIMALS_MULTIPLIER;
            } else if (_amount == 25 * USDC_DECIMALS_MULTIPLIER && allowance >= 25 * USDC_DECIMALS_MULTIPLIER) {
                newFeeShare = 8; // 40% share
                requiredAmount = 25 * USDC_DECIMALS_MULTIPLIER;
            } else {
                revert BurnerErrors.InsufficientAllowanceOrAmount(allowance, _amount);
            }
        } else if (currentShare == 8) { // Current tier is 40%
            // For 40% tier, 50 USDC = 50% share
            if (_amount == 50 * USDC_DECIMALS_MULTIPLIER && allowance >= 50 * USDC_DECIMALS_MULTIPLIER) {
                newFeeShare = 10; // 50% share
                requiredAmount = 50 * USDC_DECIMALS_MULTIPLIER;
            } else {
                revert BurnerErrors.InsufficientAllowanceOrAmount(allowance, _amount);
            }
        } else if (currentShare == 10) {
            // If the current tier is 50%, the maximum tier is reached.
            revert BurnerErrors.MaximumTierReached();
        } else {
            // If the current tier is not 30% or 40%, revert.
            revert BurnerErrors.OnPartnerTier();
        }
        // Update the partner's fee share
        partners[msg.sender] = newFeeShare;
        
        // Transfer the required amount
        IERC20(USDC).safeTransferFrom(msg.sender, feeCollector, requiredAmount);

        emit BurnerEvents.PartnerFeeShareChanged(msg.sender, newFeeShare);
    }

    /// @notice Calculates the referrer fee
    /// @param _amount The amount to calculate the referrer fee for
    /// @return referrerFee The referrer fee
    function _calculateReferrerFee(uint256 _amount, address _referrer) 
        internal 
        view 
        returns (uint256 referrerFee) 
    {
        // If the referral is paused, return 0.
        if (pauseReferral) return 0;
        // If the referrer is registered, calculate the partner's fee.
        if (partners[_referrer] > 0) {
            return _amount * partners[_referrer] / 20;
        } else {
            // If the referrer is not registered, calculate the referrer fee.
            return _amount * referrerFeeShare / 20;
        }
    }

    /// @notice Adds or modifies a partner share
    /// @dev Can be called by the owner or by the ADMIN_ROLE
    /// @param _partner The partner address
    /// @param _feeShare The fee share, from 1 to 20 (1 = 5%, 20 = 100%)
    function putPartner(address _partner, uint8 _feeShare) 
        external 
        whenNotPaused 
    {
        // If the caller is not the owner or the ADMIN_ROLE, revert.
        if(!hasRole(DEFAULT_ADMIN_ROLE, msg.sender) && !hasRole(ADMIN_ROLE, msg.sender)) revert BurnerErrors.CallerNotAdminOrOwner(msg.sender);
        // If the partner is the zero address, revert.
        if (_partner == address(0)) revert BurnerErrors.ZeroAddress();
        if (_feeShare > 20) revert BurnerErrors.FeeShareTooHigh(_feeShare, 20);
        if (_feeShare == 0) revert BurnerErrors.ZeroFeeShare();

        // If the partner is not already registered, emit the event.
        if (partners[_partner] == 0) emit BurnerEvents.PartnerAdded(_partner); 
        // Update the partner's fee share.
        partners[_partner] = _feeShare;

        emit BurnerEvents.PartnerFeeShareChanged(_partner, _feeShare);
    }

    /// @notice Removes a partner
    /// @dev Can only be called by the owner
    /// @param _partner The partner address
    function removePartner(address _partner) 
        external 
        onlyOwner 
    {
        // Delete the partner's fee share.
        delete partners[_partner];
        emit BurnerEvents.PartnerRemoved(_partner);
    }
    
    /// @notice Updates the burn fee divisor, 2.5% being the maximum
    /// @dev Can only be called by the owner
    /// @param _newBurnFeeDivisor New fee divisor
    function setBurnFeeDivisor(uint16 _newBurnFeeDivisor) 
        external 
        onlyOwner
    {
        // If the new burn fee divisor is less than 40, revert.
        if (_newBurnFeeDivisor < 40) revert BurnerErrors.FeeDivisorTooLow(_newBurnFeeDivisor, 40);
        // Update the burn fee divisor.
        burnFeeDivisor = _newBurnFeeDivisor;
        
        emit BurnerEvents.BurnFeeDivisorChanged(_newBurnFeeDivisor);
    }

    /// @notice Updates the bridge fee divisor, 0.25% being the maximum
    /// @dev Can only be called by the owner
    /// @param _newNativeSentFeeDivisor New fee divisor
    function setNativeSentFeeDivisor(uint16 _newNativeSentFeeDivisor) 
        external 
        onlyOwner 
    {
        // If the new bridge fee divisor is less than 400, revert.
        if (_newNativeSentFeeDivisor < 400) revert BurnerErrors.FeeDivisorTooLow(_newNativeSentFeeDivisor, 400);
        // Update the bridge fee divisor.
        nativeSentFeeDivisor = _newNativeSentFeeDivisor;

        emit BurnerEvents.NativeSentFeeDivisorChanged(_newNativeSentFeeDivisor);
    }

    /// @notice Updates the referrer fee share
    /// @dev Can only be called by the owner
    /// @param _newReferrerFeeShare New fee share
    function setReferrerFeeShare(uint256 _newReferrerFeeShare) 
        external 
        onlyOwner 
    {
        // If the new referrer fee share is greater than 20, revert.
        if (_newReferrerFeeShare > 20) revert BurnerErrors.FeeShareTooHigh(_newReferrerFeeShare, 20);
        // If the new referrer fee share is 0, revert.
        if (_newReferrerFeeShare == 0) revert BurnerErrors.ZeroFeeShare();
        // Update the referrer fee share.
        referrerFeeShare = _newReferrerFeeShare;
        emit BurnerEvents.ReferrerFeeShareChanged(_newReferrerFeeShare);
    }

    /// @notice Updates the fee collector address
    /// @dev Can only be called by the owner
    /// @param _newFeeCollector New address to collect fees
    function setFeeCollector(address _newFeeCollector)
        external
        onlyOwner
    {
        if (_newFeeCollector == address(0)) revert BurnerErrors.ZeroAddress();
        feeCollector = _newFeeCollector;
        emit BurnerEvents.FeeCollectorChanged(_newFeeCollector);
    }

    /// @notice Updates the admin address
    /// @dev Can only be called by the owner
    /// @param _oldAdmin The old admin address
    /// @param _newAdmin New address to admin
    function setAdmin(address _oldAdmin, address _newAdmin)
        external
        onlyOwner
    {
        // If the new admin is the zero address, revert.
        if (_newAdmin == address(0)) revert BurnerErrors.ZeroAddress();
        // If the old admin is the zero address, revert.
        if (_oldAdmin == address(0)) revert BurnerErrors.ZeroAddress();
        // If the old admin is the same as the new admin, revert.
        if (_oldAdmin == _newAdmin) revert BurnerErrors.SameAdmin();
        // If the new admin already has the ADMIN_ROLE, revert.
        if (hasRole(ADMIN_ROLE, _newAdmin)) revert BurnerErrors.AdminAlreadyExists();
        // If the old admin does not have the ADMIN_ROLE, revert.
        if (!hasRole(ADMIN_ROLE, _oldAdmin)) revert BurnerErrors.AdminDoesNotExist();

        // Revoke the old admin's ADMIN_ROLE.
        _revokeRole(ADMIN_ROLE, _oldAdmin);
        // Grant the new admin the ADMIN_ROLE.
        _grantRole(ADMIN_ROLE, _newAdmin);
        emit BurnerEvents.AdminChanged(_newAdmin);
    }

    /// @notice Updates the minimum gas required for a swap
    /// @dev Can only be called by the owner
    /// @param _newMinGasForSwap New minimum gas value
    function setMinGasForSwap(uint32 _newMinGasForSwap)
        external
        onlyOwner
    {
        if (_newMinGasForSwap == 0) revert BurnerErrors.ZeroMinGasForSwap();
        minGasForSwap = _newMinGasForSwap;
        emit BurnerEvents.MinGasForSwapChanged(_newMinGasForSwap);
    }

    /// @notice Updates the maximum number of tokens that can be burned in one transaction
    /// @dev Can only be called by the owner
    /// @param _newMaxTokensPerBurn New maximum number of tokens
    function setMaxTokensPerBurn(uint32 _newMaxTokensPerBurn)
        external
        onlyOwner
    {
        if (_newMaxTokensPerBurn == 0) revert BurnerErrors.ZeroMaxTokensPerBurn();
        maxTokensPerBurn = _newMaxTokensPerBurn;
        emit BurnerEvents.MaxTokensPerBurnChanged(_newMaxTokensPerBurn);
    }

    /// @notice Allows the owner to rescue stuck tokens
    /// @dev Transfers any ERC20 tokens stuck in the contract
    /// @dev Can only be called by the owner
    /// @param _token Address of the token to rescue
    /// @param _to Address to send the tokens to
    /// @param _amount Amount of tokens to rescue
    function rescueTokens(
        address _token, 
        address _to, 
        uint256 _amount
    )
        external
        onlyOwner
        nonReentrant
    {
        if (_token == address(0)) revert BurnerErrors.ZeroAddress();
        if (_to == address(0)) revert BurnerErrors.ZeroAddress();
        IERC20(_token).safeTransfer(_to, _amount);
    }

    /// @notice Allows the owner to rescue stuck ETH
    /// @dev Transfers any ETH stuck in the contract
    /// @dev Can only be called by the owner
    /// @param _to Address to send the ETH to
    /// @param _amount Amount of ETH to rescue
    function rescueETH(address _to, uint256 _amount)
        external
        onlyOwner
    {
        if (_to == address(0)) revert BurnerErrors.ZeroAddress();
        Address.sendValue(payable(_to), _amount);
    }

    /// @notice Pauses the bridge
    /// @dev Can only be called by the owner
    function changePauseBridge()
        external
        onlyOwner
    {
        pauseBridge = !pauseBridge;
        emit BurnerEvents.PauseBridgeChanged(pauseBridge);
    }

    /// @notice Pauses the referral
    /// @dev Can only be called by the owner
    function changePauseReferral()
        external
        onlyOwner
    {
        pauseReferral = !pauseReferral;
        emit BurnerEvents.PauseReferralChanged(pauseReferral);
    }

    /// @notice Pauses the contract
    /// @dev Can only be called by the owner
    function pause()
        external
        onlyOwner
    {
        _pause();
    }

    /// @notice Unpauses the contract
    /// @dev Can only be called by the owner
    function unpause()
        external
        onlyOwner
    {
        _unpause();
    }

    /// @dev To prevent upgradeability issues.
    uint256[50] private __gap;
}