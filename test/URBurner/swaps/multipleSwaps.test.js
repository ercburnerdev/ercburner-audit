const { expect } = require("chai");
const { deployTestEnvironment } = require("../setup");
const { prepareSwapExactInput, encodePath } = require("../utils/prepareSwaps");
const { getSwapParamsV3, getSwapParamsV2, getMixedV2V3SwapParams } = require("../utils/getSwapParams");


describe("Burner - Multiple Swaps", function () {
  let env;

  beforeEach(async function () {
    env = await deployTestEnvironment();
  });

  it("Should handle multiple token swaps in a single transaction", async function () {
    const swap1 = await getSwapParamsV3(env);
    const swap2 = await getSwapParamsV3(env, 50, 0.1);

    const swapParams = [
      {
        commands: swap1.swapParams.commands,
        inputs: swap1.swapParams.inputs,
        
      },
      {
        commands: swap2.swapParams.commands,
        inputs: swap2.swapParams.inputs,
        
      }
    ];

    await env.mockUniversalRouter.setReturnAmount(ethers.parseEther("1"));

    const userBalanceBefore = await ethers.provider.getBalance(env.user.address);
    const feeCollectorBalanceBefore = await ethers.provider.getBalance(env.feeCollector.address);

    const tx = await env.burner.connect(env.user).swapExactInputMultiple(swapParams,
      "0x0000000000000000000000000000000000000000",
      false,
      "0x", 
      "0x0000000000000000000000000000000000000000",
      BigInt(Math.floor(Date.now() / 1000) + 100000)
    );
    const receipt = await tx.wait();
    const gasCost = receipt.gasUsed * receipt.gasPrice;

    await expect(tx)
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
      )
      .to.emit(env.burner, "BurnSuccess")
      .withArgs(
        env.user.address,
        ethers.parseEther("1.95"),
        ethers.parseEther("0.05")
      );

    const feeCollectorBalanceAfter = await ethers.provider.getBalance(env.feeCollector.address);
    const userBalanceAfter = await ethers.provider.getBalance(env.user.address);

    expect(feeCollectorBalanceAfter)
      .to.equal(feeCollectorBalanceBefore + ethers.parseEther("0.05"));
    expect(userBalanceAfter)
      .to.equal(userBalanceBefore + ethers.parseEther("1.95") - gasCost);
  });

  it("Should handle one V2 swap and one V3 swap in a single transaction", async function () {
    const swap1 = await getSwapParamsV3(env);
    const swap2 = await getSwapParamsV2(env, 50, 0.1);

    const swapParams = [
      {
        commands: swap1.swapParams.commands,
        inputs: swap1.swapParams.inputs,
        
      },
      {
        commands: swap2.swapParams.commands,
        inputs: swap2.swapParams.inputs,
        
      }
    ];

    await env.mockUniversalRouter.setReturnAmount(ethers.parseEther("1"));

    const userBalanceBefore = await ethers.provider.getBalance(env.user.address);
    const feeCollectorBalanceBefore = await ethers.provider.getBalance(env.feeCollector.address);

    const tx = await env.burner.connect(env.user).swapExactInputMultiple(swapParams,
      "0x0000000000000000000000000000000000000000",
      false,
      "0x", 
      "0x0000000000000000000000000000000000000000",
      BigInt(Math.floor(Date.now() / 1000) + 100000)
    );
    const receipt = await tx.wait();
    const gasCost = receipt.gasUsed * receipt.gasPrice;

    await expect(tx)
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
      )
      .to.emit(env.burner, "BurnSuccess")
      .withArgs(
        env.user.address,
        ethers.parseEther("1.95"),
        ethers.parseEther("0.05")
      );

    const feeCollectorBalanceAfter = await ethers.provider.getBalance(env.feeCollector.address);
    const userBalanceAfter = await ethers.provider.getBalance(env.user.address);

    expect(feeCollectorBalanceAfter)
      .to.equal(feeCollectorBalanceBefore + ethers.parseEther("0.05"));
    expect(userBalanceAfter)
      .to.equal(userBalanceBefore + ethers.parseEther("1.95") - gasCost);
  });

  it("Should handle eleven mixed V2 and V3 token swaps in a single transaction", async function () {
    // Deploy 10 additional mock tokens (plus original mockToken = 11)
    let swapParams = await getMixedV2V3SwapParams(env);

    await env.mockUniversalRouter.setReturnAmount(ethers.parseEther("1"));

    const feeCollectorBalanceBefore = await ethers.provider.getBalance(env.feeCollector.address);
    const userBalanceBefore = await ethers.provider.getBalance(env.user.address);

    const tx = await env.burner.connect(env.user).swapExactInputMultiple(swapParams.swapParams,
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

    // Verify all SwapSuccess events
    for (let i = 0; i < swapParams.mockTokens.length; i++) {
      await expect(tx)
        .to.emit(env.burner, "SwapSuccess")
        .withArgs(
          env.user.address,
          await swapParams.mockTokens[i].getAddress(),
          ethers.parseEther("100"),
          ethers.parseEther("1")
        );
    }

    await expect(tx)
      .to.emit(env.burner, "BurnSuccess")
      .withArgs(
        env.user.address,
        ethers.parseEther("10.725"),
        ethers.parseEther("0.275")
      );

    expect(feeCollectorBalanceAfter)
      .to.equal(feeCollectorBalanceBefore + ethers.parseEther("0.275"));
    expect(userBalanceAfter)
      .to.equal(userBalanceBefore + ethers.parseEther("10.725") - gasCost);
  });

  it("Should handle multiple successful and failed V2 and V3 swaps correctly", async function () {
    const mockTokens = [env.mockToken];
    for (let i = 1; i <= 10; i++) {
      const MockToken = await ethers.getContractFactory("MockToken");
      const token = await MockToken.deploy(`MockToken${i}`, `MTK${i}`);
      
      // Setup each token
      await token.mint(env.user.address, ethers.parseEther("1000"));
      await token.connect(env.user).approve(await env.burner.getAddress(), ethers.parseEther("1000"));
      mockTokens.push(token);
    }

    const initialTokenBalances = [];
    for (let i = 0; i < mockTokens.length; i++) {
      initialTokenBalances.push(await mockTokens[i].balanceOf(env.user.address));
    }

    let swapParams = [];

    for (let i = 0; i < mockTokens.length; i++) {
      const encodedPath = encodePath(
        "0x00", 
        [await mockTokens[i].getAddress(), await env.mockWNATIVE.getAddress()], 
        [3000]
      );

      const swap = prepareSwapExactInput( 
        i % 2 === 0 ? "0x00" : "0x08",
        await env.burner.getAddress(),
        await mockTokens[i].getAddress(),
        ethers.parseEther("100"),
        i % 3 === 0 ? ethers.parseEther("2") : ethers.parseEther("0.1"),
        i % 2 === 0 ? encodedPath : [await mockTokens[i].getAddress(), await env.mockWNATIVE.getAddress()],
        false,
        env.user.address,
        Math.floor(Date.now() / 1000) + 100000
      );

      swapParams.push({
        commands: swap.commands,
        inputs: swap.inputs,
        
      });
    }

    // Mock router to return 1 ETH for each swap
    await env.mockUniversalRouter.setReturnAmount(ethers.parseEther("1"));

    // Get initial balances
    const userBalanceBefore = await ethers.provider.getBalance(env.user.address);
    const feeCollectorBalanceBefore = await ethers.provider.getBalance(env.feeCollector.address);

    // Create transaction promise with all expected events
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

    // Expect SwapSuccess events for successful swaps
    for (let i = 0; i < mockTokens.length; i++) {
      if (i % 3 !== 0) {
        await expect(tx)
          .to.emit(env.burner, "SwapSuccess")
          .withArgs(
            env.user.address,
            await mockTokens[i].getAddress(),
            ethers.parseEther("100"),
            ethers.parseEther("1")
          );
      }
    }

    // Expect SwapFailed events for failed swaps
    for (let i = 0; i < mockTokens.length; i++) {
      if (i % 3 === 0) {
        await expect(tx)
          .to.emit(env.burner, "SwapFailed")
          .withArgs(
            env.user.address,
            await mockTokens[i].getAddress(),
            ethers.parseEther("100"),
            "Router error"
          );
      }
    }

    await expect(tx)
      .to.emit(env.burner, "BurnSuccess")
      .withArgs(
        env.user.address,
        ethers.parseEther("6.825"),
        ethers.parseEther("0.175")
      );

    // Verify final balances
    // Fee collector should receive 2.5% of 7 ETH
    expect(feeCollectorBalanceAfter)
      .to.equal(feeCollectorBalanceBefore + ethers.parseEther("0.175"));
    
    // User should receive 97.5% of 7 ETH
    expect(userBalanceAfter)
      .to.equal(userBalanceBefore + ethers.parseEther("6.825") - gasCost);

    // Verify token balances after swaps
    for (let i = 0; i < mockTokens.length; i++) {
      const finalBalance = await mockTokens[i].balanceOf(env.user.address);

      if (i % 3 !== 0) {
        // Successful swaps - tokens should be spent
        expect(finalBalance).to.equal(initialTokenBalances[i] - ethers.parseEther("100"));
      } else {
        // Failed swaps - tokens should be returned
        expect(finalBalance).to.equal(initialTokenBalances[i]);
      }
    }
  });
}); 