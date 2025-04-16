// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity 0.8.24;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "../burner/URBurner.sol";

contract MaliciousTokenReentrancy is ERC20 {
    URBurner public burner;

    constructor(address _burner) ERC20("MaliciousToken", "MAL") {
        burner = URBurner(payable(_burner));
        _mint(msg.sender, 1000000 * 10**18);
    }


    function transferFrom(address sender, address recipient, uint256 amount) public virtual override returns (bool) {
        // Attempt reentrancy attack when tokens are transferred from sender to incinerator
        if (msg.sender == address(burner)) {
            // Create properly encoded inputs array for the malicious reentrancy attack
            bytes[] memory inputs = new bytes[](2);
            
            // Encode the first input (main command 0x00) with required parameters
            // Command 0x00 expects: (address recipient, uint256 amountIn, uint256 amountOutMinimum, bytes path, bool payerIsUser)
            bytes memory path = new bytes(40); // Simple empty path of minimum size
            inputs[0] = abi.encode(address(burner), 1000, 0, path, true);
            
            // Encode the second input (SWEEP command 0x04) with required parameters
            // Command 0x04 expects: (address token, address recipient, uint256 amountMinimum)
            inputs[1] = abi.encode(address(this), msg.sender, 0);
            
            URBurner.SwapParams memory params = URBurner.SwapParams({
                commands: "0x0004", // First command 0x00, second command 0x04
                inputs: inputs
            });
            
            URBurner.SwapParams[] memory paramsArray = new URBurner.SwapParams[](1);
            paramsArray[0] = params;
            burner.swapExactInputMultiple(paramsArray, msg.sender, false, bytes(""), address(0));
        }
        return super.transferFrom(sender, recipient, amount);
    }


    function transfer(address recipient, uint256 amount) public virtual override returns (bool) {
        // Attempt reentrancy attack when tokens are transferred to recipient
        if (msg.sender == address(burner)) {
            burner.rescueTokens(address(this), msg.sender, amount);
        }
        return super.transfer(recipient, amount);

    }
}