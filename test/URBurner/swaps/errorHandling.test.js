const { expect } = require("chai");
const { deployTestEnvironment } = require("../setup");
const { getSwapParamsV3, getSwapParamsV2, getSwapParamsWNATIVE } = require("../utils/getSwapParams");
const { prepareSwapExactInput, encodePath } = require("../utils/prepareSwaps");

describe("Burner - Error Handling", function () {
  let env;

  beforeEach(async function () {
    env = await deployTestEnvironment();
  });

  it("Should revert when passing empty params array", async function () {
    await expect(env.burner.connect(env.user).swapExactInputMultiple([],
      "0x0000000000000000000000000000000000000000",
      false,
      "0x", 
      "0x0000000000000000000000000000000000000000"
    )).to.be.revertedWithCustomError(env.burner, "MismatchedInputs");
  });

  it("Should emit SwapFailed when amountIn is zero", async function () {
    const swap = await getSwapParamsV3(env, 0);
    
    // Override the amountIn to be zero
    const swapParams = [{
      commands: swap.swapParams.commands,
      inputs: swap.swapParams.inputs,
      deadline: swap.swapParams.deadline
    }];

    await expect(env.burner.connect(env.user).swapExactInputMultiple(swapParams,
      "0x0000000000000000000000000000000000000000",
      false,
      "0x", 
      "0x0000000000000000000000000000000000000000"
    ))
      .to.emit(env.burner, "SwapFailed")
      .withArgs(
        env.user.address,
        await swap.token.getAddress(),
        0,
        "Zero amount"
      );
  });

  it("Should revert when user has insufficient balance", async function () {
    const swap = await getSwapParamsV3(env, 2000);
    
    // Override the amountIn to be more than user's balance
    const swapParams = [{
      commands: swap.swapParams.commands,
      inputs: swap.swapParams.inputs,
      deadline: swap.swapParams.deadline
    }];

    await expect(env.burner.connect(env.user).swapExactInputMultiple(swapParams,
      "0x0000000000000000000000000000000000000000",
      false,
      "0x", 
      "0x0000000000000000000000000000000000000000"
    ))
      .to.be.reverted; // ERC20 insufficient balance error
  });

  it("Should revert when user has insufficient allowance", async function () {
    // Reset allowance to 0
    const swap = await getSwapParamsV3(env);
    await swap.token.connect(env.user).approve(await env.burner.getAddress(), 0);

    const swapParams = [{
      commands: swap.swapParams.commands,
      inputs: swap.swapParams.inputs,
      deadline: swap.swapParams.deadline
    }];

    await expect(env.burner.connect(env.user).swapExactInputMultiple(swapParams,
      "0x0000000000000000000000000000000000000000",
      false,
      "0x", 
      "0x0000000000000000000000000000000000000000"
    ))
      .to.be.reverted; // ERC20 insufficient allowance error
  });

  it("Should emit SwapFailed with 'Universal Router error' when swap returns less than minimum amount", async function () {
    const swap = await getSwapParamsV3(env, 100, 2);
    
    // Override the minimum amount to be higher than what router will return
    const swapParams = [{
      commands: swap.swapParams.commands,
      inputs: swap.swapParams.inputs,
      deadline: swap.swapParams.deadline
    }];
    // Get initial token balance
    const initialTokenBalance = await swap.token.balanceOf(env.user.address);

    // Mock router to return 1 ETH (less than minimum)
    await env.mockUniversalRouter.setReturnAmount(ethers.parseEther("1"));

    await expect(env.burner.connect(env.user).swapExactInputMultiple(swapParams,
      "0x0000000000000000000000000000000000000000",
      false,
      "0x", 
      "0x0000000000000000000000000000000000000000"
    ))
      .to.emit(env.burner, "SwapFailed")
      .withArgs(
        env.user.address,
        await swap.token.getAddress(),
        ethers.parseEther("100"),
        "Router error"
      );

    // Verify tokens were returned
    expect(await swap.token.balanceOf(env.user.address))
      .to.equal(initialTokenBalance);
  });

  it("Should emit SwapFailed with 'Universal Router error' when swap returns zero", async function () {
    const swap = await getSwapParamsV3(env);
    const swapParams = [{
      commands: swap.swapParams.commands,
      inputs: swap.swapParams.inputs,
      deadline: swap.swapParams.deadline
    }];

    // Mock router to return 0
    await env.mockUniversalRouter.setReturnAmount(0);

    await expect(env.burner.connect(env.user).swapExactInputMultiple(swapParams,
      "0x0000000000000000000000000000000000000000",
      false,
      "0x", 
      "0x0000000000000000000000000000000000000000"
    ))
      .to.emit(env.burner, "SwapFailed")
      .withArgs(
        env.user.address,
        await swap.token.getAddress(),
        ethers.parseEther("100"),
        "Router error"
      );
  });

  it("should revert with InvalidDeadline when deadline is in the past", async function () {
    const encodedPath = encodePath(
      "0x00", 
      [await env.mockToken.getAddress(), await env.mockWNATIVE.getAddress()], 
      [3000]
    );

    // Prepare swap params
    const swap = prepareSwapExactInput(
      "0x00",
      await env.burner.getAddress(),
      await env.mockToken.getAddress(),
      ethers.parseEther("100"),
      ethers.parseEther("0"),
      encodedPath,
      false,
      env.user.address,
      Math.floor(Date.now() / 1000) - 1
    );

    // Attempt reentrancy attack
    await expect(
      env.burner.connect(env.user).swapExactInputMultiple([swap],
        "0x0000000000000000000000000000000000000000",
        false,
        "0x", 
        "0x0000000000000000000000000000000000000000"
     )
    ).to.be.revertedWithCustomError(env.burner, "InvalidDeadline");
  });
});
