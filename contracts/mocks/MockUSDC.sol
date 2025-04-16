// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract MockUSDC is ERC20 {
    uint8 public immutable DECIMALS;

    constructor(uint8 _decimals) ERC20("Mock USDC", "USDC") {
        // Mint initial supply to deployer (1 billion USDC with 6 decimals)
        _mint(msg.sender, 1_000_000 * 10 **_decimals);
        DECIMALS = _decimals;
    }

    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }

    function burn(address from, uint256 amount) external {
        _burn(from, amount);
    }

    function decimals() public view override returns (uint8) {
        return DECIMALS;
    }
} 