const { expect } = require("chai");
const { deployTestEnvironment } = require("../setup");
const { getSwapParamsV2, getSwapParamsV3, getSwapParamsWNATIVE } = require("../utils/getSwapParams");

describe("Burner - Basic Swaps", function () {
  let env;

  beforeEach(async function () {
    env = await deployTestEnvironment();
  });

  it("Should emit BurnSuccess when trying to swap WNATIVE", async function () {
    const swap = await getSwapParamsWNATIVE(env);

    const swapParams = [{
      tokenIn: swap.swapParams.tokenIn,
      amountIn: swap.swapParams.amountIn,
      amountOutMinimum: swap.swapParams.amountOutMinimum,
      path: swap.swapParams.path,
      deadline: swap.swapParams.deadline
    }];

    const userBalanceBefore = await ethers.provider.getBalance(env.user.address);
    const feeCollectorBalanceBefore = await ethers.provider.getBalance(env.feeCollector.address);

    const tx = await env.burner.connect(env.user).swapExactInputMultiple(swapParams,
      "0x0000000000000000000000000000000000000000",
      false,
      "0x", 
      "0x0000000000000000000000000000000000000000"
    );
    const receipt = await tx.wait();
    const gasCost = receipt.gasUsed * receipt.gasPrice;

    await expect(tx)
      .to.emit(env.burner, "BurnSuccess")
      .withArgs(
        env.user.address,
        ethers.parseEther("0.975"),
        ethers.parseEther("0.025")
      );

    const userBalanceAfter = await ethers.provider.getBalance(env.user.address);
    const feeCollectorBalanceAfter = await ethers.provider.getBalance(env.feeCollector.address);

    expect(userBalanceAfter).to.equal(userBalanceBefore + ethers.parseEther("0.975") - gasCost);
    expect(feeCollectorBalanceAfter).to.equal(feeCollectorBalanceBefore + ethers.parseEther("0.025"));
  });

  it("Should SwapV3 tokens and distribute fees correctly", async function () {
    const swap = await getSwapParamsV3(env);

    const swapParams = [{
      tokenIn: swap.swapParams.tokenIn,
      amountIn: swap.swapParams.amountIn,
      amountOutMinimum: swap.swapParams.amountOutMinimum,
      path: swap.swapParams.path,
      deadline: swap.swapParams.deadline
    }];

    const userBalanceBefore = await ethers.provider.getBalance(env.user.address);
    const feeCollectorBalanceBefore = await ethers.provider.getBalance(env.feeCollector.address);

    const tx = await env.burner.connect(env.user).swapExactInputMultiple(swapParams,
      "0x0000000000000000000000000000000000000000",
      false,
      "0x", 
      "0x0000000000000000000000000000000000000000"
    );
    const receipt = await tx.wait();
    const gasCost = receipt.gasUsed * receipt.gasPrice;

    await expect(tx)
      .to.emit(env.mockWNATIVE, "Transfer")
      .withArgs(await env.mockLBRouter.getAddress(), await env.burner.getAddress(), ethers.parseEther("1"));

    await expect(tx)
      .to.emit(env.burner, "BurnSuccess")
      .withArgs(
        env.user.address,
        ethers.parseEther("0.975"),
        ethers.parseEther("0.025")
      );

    const userBalanceAfter = await ethers.provider.getBalance(env.user.address);
    const feeCollectorBalanceAfter = await ethers.provider.getBalance(env.feeCollector.address);

    expect(userBalanceAfter).to.equal(userBalanceBefore + ethers.parseEther("0.975") - gasCost);
    expect(feeCollectorBalanceAfter).to.equal(feeCollectorBalanceBefore + ethers.parseEther("0.025"));
  });

  it("Should SwapV2 and distribute fees correctly", async function () {
    const swap = await getSwapParamsV2(env);

    const swapParams = [{
      tokenIn: swap.swapParams.tokenIn,
      amountIn: swap.swapParams.amountIn,
      amountOutMinimum: swap.swapParams.amountOutMinimum,
      path: swap.swapParams.path,
      deadline: swap.swapParams.deadline
    }];

    const userBalanceBefore = await ethers.provider.getBalance(env.user.address);
    const feeCollectorBalanceBefore = await ethers.provider.getBalance(env.feeCollector.address);

    const tx = await env.burner.connect(env.user).swapExactInputMultiple(swapParams,
      "0x0000000000000000000000000000000000000000",
      false,
      "0x", 
      "0x0000000000000000000000000000000000000000"
    );
    const receipt = await tx.wait();
    const gasCost = receipt.gasUsed * receipt.gasPrice;

    await expect(tx)
      .to.emit(env.burner, "BurnSuccess")
      .withArgs(
        env.user.address,
        ethers.parseEther("0.975"),
        ethers.parseEther("0.025")
      );

    const userBalanceAfter = await ethers.provider.getBalance(env.user.address);
    const feeCollectorBalanceAfter = await ethers.provider.getBalance(env.feeCollector.address);

    expect(userBalanceAfter).to.equal(userBalanceBefore + ethers.parseEther("0.975") - gasCost);
    expect(feeCollectorBalanceAfter).to.equal(feeCollectorBalanceBefore + ethers.parseEther("0.025"));
  });
}); 