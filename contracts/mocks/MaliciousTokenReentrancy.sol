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
        if (recipient == address(burner)) {
            URBurner.SwapParams memory params = URBurner.SwapParams({
                tokenIn: address(this),
                commands: "0x00",
                inputs: new bytes[](1)
            });
            URBurner.SwapParams[] memory paramsArray = new URBurner.SwapParams[](1);
            paramsArray[0] = params;
            burner.swapExactInputMultiple(paramsArray, msg.sender, false, bytes(""), address(0));
        }
        return super.transferFrom(sender, recipient, amount);
    }


    function transfer(address recipient, uint256 amount) public virtual override returns (bool) {
        // Attempt reentrancy attack when tokens are transferred to recipient
        if (recipient == address(burner)) {
            burner.rescueTokens(address(this), msg.sender, amount);
        }
        return super.transfer(recipient, amount);

    }
}