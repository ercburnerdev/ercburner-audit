 // SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {IERC20} from '@openzeppelin/contracts/token/ERC20/IERC20.sol';

/// @title Universal Router Interface
/// @notice Interface for the Uniswap Universal Router contract
interface ILBRouter {
    enum Version {
        V1,
        V2,
        V2_1,
        V2_2
    }

    struct Path {
        uint256[] pairBinSteps;
        Version[] versions;
        IERC20[] tokenPath;
    }

    function swapExactTokensForTokens(
        uint256 amountIn,
        uint256 amountOutMin,
        Path memory path,
        address to,
        uint256 deadline
    ) external returns (uint256 amountOut);
}