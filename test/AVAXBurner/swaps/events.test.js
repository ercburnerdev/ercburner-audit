const { expect } = require("chai");
const { deployTestEnvironment } = require("../setup");
const { getSwapParamsV3, getSwapParamsWNATIVE } = require("../utils/getSwapParams");
const { createSwapParams } = require("../utils/prepareSwaps");

describe("Burner - Events", function () {
  let env;

  beforeEach(async function () {
    env = await deployTestEnvironment();
  });

  it("Should emit BurnSuccess event with correct parameters", async function () {
    const swap = await getSwapParamsV3(env);

    const swapParams = [{
      tokenIn: swap.swapParams.tokenIn,
      amountIn: swap.swapParams.amountIn,
      amountOutMinimum: swap.swapParams.amountOutMinimum,
      path: swap.swapParams.path,
      
    }];

    // Mock router to return 1 ETH
    await env.mockLBRouter.setReturnAmount(ethers.parseEther("1"));

    await expect(env.burner.connect(env.user).swapExactInputMultiple(swapParams,
      "0x0000000000000000000000000000000000000000",
      false,
      "0x", 
      "0x0000000000000000000000000000000000000000",
      BigInt(Math.floor(Date.now() / 1000) + 100000)
    ))
      .to.emit(env.burner, "BurnSuccess")
      .withArgs(
        env.user.address,
        ethers.parseEther("0.975"), // totalAmountOut (1 ETH - 2.5% fee)
        ethers.parseEther("0.025") // feeAmount (2.5% of 1 ETH)
      );
  });

  it("Should emit BurnSuccess event with correct parameters for multiple swaps", async function () {
    // Deploy second mock token
    const MockToken2 = await ethers.getContractFactory("MockToken");
    const mockToken2 = await MockToken2.deploy("MockToken2", "MTK2");
    
    // Setup second token
    await mockToken2.mint(env.user.address, ethers.parseEther("1000"));
    await mockToken2.connect(env.user).approve(await env.burner.getAddress(), ethers.parseEther("1000"));

    const swap1 = await getSwapParamsV3(env);
    const swap2 = await getSwapParamsV3(env, 50, 0.1, mockToken2);

    const swapParams = [
      {
        tokenIn: swap1.swapParams.tokenIn,
        amountIn: swap1.swapParams.amountIn,
        amountOutMinimum: swap1.swapParams.amountOutMinimum,
        path: swap1.swapParams.path,
        
      },
      {
        tokenIn: swap2.swapParams.tokenIn,
        amountIn: swap2.swapParams.amountIn,
        amountOutMinimum: swap2.swapParams.amountOutMinimum,
        path: swap2.swapParams.path,
        
      }
    ];

    // Mock router to return 1 ETH for each swap (2 ETH total)
    await env.mockLBRouter.setReturnAmount(ethers.parseEther("1"));

    await expect(env.burner.connect(env.user).swapExactInputMultiple(swapParams,
      "0x0000000000000000000000000000000000000000",
      false,
      "0x", 
      "0x0000000000000000000000000000000000000000",
      BigInt(Math.floor(Date.now() / 1000) + 100000)
    ))
      .to.emit(env.burner, "BurnSuccess")
      .withArgs(
        env.user.address,
        ethers.parseEther("1.95"), // totalAmountOut (2 ETH - 2.5% fee)
        ethers.parseEther("0.05") // feeAmount (2.5% of 2 ETH)
      );
  });

  it("Should handle mixed successful and failed swaps correctly", async function () {
    const swap1 = await getSwapParamsV3(env);
    const swap2 = await getSwapParamsV3(env, 50, 2); // Higher minimum amount for second swap to fail

    const swapParams = [
      {
        tokenIn: swap1.swapParams.tokenIn,
        amountIn: swap1.swapParams.amountIn,
        amountOutMinimum: swap1.swapParams.amountOutMinimum,
        path: swap1.swapParams.path,
        
      },
      {
        tokenIn: swap2.swapParams.tokenIn,
        amountIn: swap2.swapParams.amountIn,
        amountOutMinimum: swap2.swapParams.amountOutMinimum,
        path: swap2.swapParams.path,
        
      }
    ];

    // Get initial token balances
    const initialToken1Balance = await swap1.token.balanceOf(env.user.address);
    const initialToken2Balance = await swap2.token.balanceOf(env.user.address);
    const userBalanceBefore = await ethers.provider.getBalance(env.user.address);
    const feeCollectorBalanceBefore = await ethers.provider.getBalance(env.feeCollector.address);

    // Execute the swaps and verify events
    const tx = await env.burner.connect(env.user).swapExactInputMultiple(swapParams,
      "0x0000000000000000000000000000000000000000",
      false,
      "0x", 
      "0x0000000000000000000000000000000000000000",
      BigInt(Math.floor(Date.now() / 1000) + 100000)
    );
    const receipt = await tx.wait();
    const gasCost = receipt.gasUsed * receipt.gasPrice;

    const feeCollectorBalanceAfter = await ethers.provider.getBalance(env.feeCollector.address);
    const userBalanceAfter = await ethers.provider.getBalance(env.user.address);

    await expect(tx)
      .to.emit(env.burner, "BurnSuccess")
      .withArgs(
        env.user.address,
        ethers.parseEther("0.975"), // Only first swap succeeded (1 ETH - 2.5% fee)
        ethers.parseEther("0.025") // 2.5% fee on 1 ETH
      )
      .and.to.emit(env.burner, "SwapFailed")
      .withArgs(
        env.user.address,
        await swap2.token.getAddress(),
        ethers.parseEther("50"),
        "Router error"
      );

    // Verify final balances
    // First token should be spent (successful swap)
    expect(await swap1.token.balanceOf(env.user.address))
      .to.equal(initialToken1Balance - ethers.parseEther("100"));
    
    // Second token should be returned (failed swap)
    expect(await swap2.token.balanceOf(env.user.address))
      .to.equal(initialToken2Balance);

    // Fee collector should receive 2.5% of 1 ETH
    expect(feeCollectorBalanceAfter)
      .to.equal(feeCollectorBalanceBefore + ethers.parseEther("0.025"));
    
    // User should receive 97.5% of 1 ETH
    expect(userBalanceAfter)
      .to.equal(userBalanceBefore + ethers.parseEther("0.975") - gasCost);
  });

  it("Should emit SwapSuccess event with correct parameters for single swap", async function () {
    const swap = await getSwapParamsV3(env);

    const swapParams = [{
      tokenIn: swap.swapParams.tokenIn,
      amountIn: swap.swapParams.amountIn,
      amountOutMinimum: swap.swapParams.amountOutMinimum,
      path: swap.swapParams.path,
      
    }];

    // Mock router to return 1 ETH
    await env.mockLBRouter.setReturnAmount(ethers.parseEther("1"));

    await expect(env.burner.connect(env.user).swapExactInputMultiple(swapParams,
      "0x0000000000000000000000000000000000000000",
      false,
      "0x", 
      "0x0000000000000000000000000000000000000000",
      BigInt(Math.floor(Date.now() / 1000) + 100000)
    ))
      .to.emit(env.burner, "SwapSuccess")
      .withArgs(
        env.user.address,
        await swap.token.getAddress(),
        ethers.parseEther("100"),
        ethers.parseEther("1")
      );
  });

  it("Should emit SwapSuccess events for each successful swap in multiple swaps", async function () {

    const swap1 = await getSwapParamsV3(env);
    const swap2 = await getSwapParamsV3(env, 50, 0.1);

    const swapParams = [
      {
        tokenIn: swap1.swapParams.tokenIn,
        amountIn: swap1.swapParams.amountIn,
        amountOutMinimum: swap1.swapParams.amountOutMinimum,
        path: swap1.swapParams.path,
        
      },
      {
        tokenIn: swap2.swapParams.tokenIn,
        amountIn: swap2.swapParams.amountIn,
        amountOutMinimum: swap2.swapParams.amountOutMinimum,
        path: swap2.swapParams.path,
        
      }
    ];

    // Mock router to return 1 ETH for each swap
    await env.mockLBRouter.setReturnAmount(ethers.parseEther("1"));

    await expect(env.burner.connect(env.user).swapExactInputMultiple(swapParams,
      "0x0000000000000000000000000000000000000000",
      false,
      "0x", 
      "0x0000000000000000000000000000000000000000",
      BigInt(Math.floor(Date.now() / 1000) + 100000)
    ))
      .to.emit(env.burner, "SwapSuccess")
      .withArgs(
        env.user.address,
        await swap1.token.getAddress(),
        ethers.parseEther("100"),
        ethers.parseEther("1")
      )
      .to.emit(env.burner, "SwapSuccess")
      .withArgs(
        env.user.address,
        await swap2.token.getAddress(),
        ethers.parseEther("50"),
        ethers.parseEther("1")
      );
  });

  it("Should revert when tokenOut is not WNATIVE", async function () {
    let MockToken = await ethers.getContractFactory("MockToken");
    let mockToken = await MockToken.deploy(`MockToken`, `MTK`);

    await mockToken.mint(env.user.address, ethers.parseEther("1000"));
    await mockToken.connect(env.user).approve(await env.burner.getAddress(), ethers.parseEther("1000"));

    // Create simple mock path
    const mockTokenAddress = await mockToken.getAddress();
    const wnativeAddress = await env.mockWNATIVE.getAddress();
    const amountIn = ethers.parseEther('100');
    const amountOut = ethers.parseEther('1');
    
    const path = {
        tokenPath: [wnativeAddress, mockTokenAddress],
        pairBinSteps: [20],
        versions: [2]
    };

    const swapParams = createSwapParams(
        mockTokenAddress,
        amountIn,
        BigInt(amountOut) * BigInt(99) / BigInt(100), // 1% slippage
        path,
        await env.burner.getAddress()
    )

    let swap = [
      {
        tokenIn: swapParams.tokenIn,
        amountIn: swapParams.amountIn,
        amountOutMinimum: swapParams.amountOutMinimum,
        path: path,
      }
    ]
  
    // Mock router to return 1 ETH
    await env.mockLBRouter.setReturnAmount(ethers.parseEther("1"));
  
    await expect(env.burner.connect(env.user).swapExactInputMultiple(swap,
      "0x0000000000000000000000000000000000000000",
      false,
      "0x", 
      "0x0000000000000000000000000000000000000000",
      BigInt(Math.floor(Date.now() / 1000) + 100000)
    ))
      .to.be.revertedWithCustomError(env.burner, "InvalidTokenOut")
      .withArgs(await mockToken.getAddress());
  });
}); 