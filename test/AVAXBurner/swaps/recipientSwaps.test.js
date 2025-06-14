const { expect } = require("chai");
const { deployTestEnvironment } = require("../setup");
const { prepareSwapExactInput, encodePath } = require("../utils/prepareSwaps");
const { getSwapParamsV3, getSwapParamsV2, getMixedV2V3SwapParams } = require("../utils/getSwapParams");


describe("Burner - Multiple Swaps With Recipient", function () {
  let env;

  beforeEach(async function () {
    env = await deployTestEnvironment();
  });

  it("Should handle multiple token swaps in a single transaction with different recipient", async function () {
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

    await env.mockLBRouter.setReturnAmount(ethers.parseEther("1"));

    // Use a different recipient - the owner account
    const recipient = env.owner.address;
    const recipientBalanceBefore = await ethers.provider.getBalance(recipient);
    const userBalanceBefore = await ethers.provider.getBalance(env.user.address);
    const feeCollectorBalanceBefore = await ethers.provider.getBalance(env.feeCollector.address);

    const tx = await env.burner.connect(env.user).swapExactInputMultiple(swapParams,
      recipient, // Recipient is the owner, not the zero address
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
    const recipientBalanceAfter = await ethers.provider.getBalance(recipient);

    expect(feeCollectorBalanceAfter)
      .to.equal(feeCollectorBalanceBefore + ethers.parseEther("0.05"));
    
    // User only paid gas, didn't receive ETH
    expect(userBalanceAfter)
      .to.equal(userBalanceBefore - gasCost);
    
    // Recipient received the ETH
    expect(recipientBalanceAfter)
      .to.equal(recipientBalanceBefore + ethers.parseEther("1.95"));
  });

  it("Should handle one V2 swap and one V3 swap with different recipient", async function () {
    const swap1 = await getSwapParamsV3(env);
    const swap2 = await getSwapParamsV2(env, 50, 0.1);

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

    await env.mockLBRouter.setReturnAmount(ethers.parseEther("1"));

    // Use a different recipient - the deployer account
    const recipient = env.recipient.address;
    const recipientBalanceBefore = await ethers.provider.getBalance(recipient);
    const userBalanceBefore = await ethers.provider.getBalance(env.user.address);
    const feeCollectorBalanceBefore = await ethers.provider.getBalance(env.feeCollector.address);

    const tx = await env.burner.connect(env.user).swapExactInputMultiple(swapParams,
      recipient,
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
    const recipientBalanceAfter = await ethers.provider.getBalance(recipient);

    expect(feeCollectorBalanceAfter)
      .to.equal(feeCollectorBalanceBefore + ethers.parseEther("0.05"));
    
    // User only paid gas, didn't receive ETH
    expect(userBalanceAfter)
      .to.equal(userBalanceBefore - gasCost);
    
    // Recipient received the ETH
    expect(recipientBalanceAfter)
      .to.equal(recipientBalanceBefore + ethers.parseEther("1.95"));
  });

  it("Should handle eleven mixed V2 and V3 token swaps with different recipient", async function () {
    // Deploy 10 additional mock tokens (plus original mockToken = 11)
    let swapParams = await getMixedV2V3SwapParams(env);

    await env.mockLBRouter.setReturnAmount(ethers.parseEther("1"));

    // Use a different recipient
    const recipient = env.recipient.address;
    const recipientBalanceBefore = await ethers.provider.getBalance(recipient);
    const feeCollectorBalanceBefore = await ethers.provider.getBalance(env.feeCollector.address);
    const userBalanceBefore = await ethers.provider.getBalance(env.user.address);

    const tx = await env.burner.connect(env.user).swapExactInputMultiple(swapParams.swapParams,
      recipient,
      false,
      "0x", 
      "0x0000000000000000000000000000000000000000",
      BigInt(Math.floor(Date.now() / 1000) + 100000)
    );
    const receipt = await tx.wait();
    const gasCost = receipt.gasUsed * receipt.gasPrice;

    const feeCollectorBalanceAfter = await ethers.provider.getBalance(env.feeCollector.address);
    const userBalanceAfter = await ethers.provider.getBalance(env.user.address);
    const recipientBalanceAfter = await ethers.provider.getBalance(recipient);

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
    
    // User only paid gas, didn't receive ETH
    expect(userBalanceAfter)
      .to.equal(userBalanceBefore - gasCost);
    
    // Recipient received the ETH
    expect(recipientBalanceAfter)
      .to.equal(recipientBalanceBefore + ethers.parseEther("10.725"));
  });

  it("Should handle multiple successful and failed V2 and V3 swaps with different recipient", async function () {
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
      const mockTokenAddress = await mockTokens[i].getAddress();
      const wnativeAddress = await env.mockWNATIVE.getAddress();
      const amountIn = ethers.parseEther("100");
      
      // For tokens where i % 3 === 0, set a high minimumOut to force failure
      const amountOutMinimum = i % 3 === 0 
        ? ethers.parseEther("2")  // Will fail (too high expectation)
        : ethers.parseEther("0.1"); // Will succeed
      
      // Create path parameters based on index
      // For testing we alternate between V2 and V3 style paths
      const path = {
        tokenPath: [mockTokenAddress, wnativeAddress],
        pairBinSteps: [i % 2 === 0 ? 20 : 0],
        versions: [i % 2 === 0 ? 2 : 0]
      };
      
      swapParams.push({
        tokenIn: mockTokenAddress,
        amountIn: amountIn,
        amountOutMinimum: amountOutMinimum,
        path: path,
        
      });
    }

    // Mock router to return 1 ETH for each swap
    await env.mockLBRouter.setReturnAmount(ethers.parseEther("1"));

    // Use a different recipient - the deployer account
    const recipient = env.recipient.address;
    const recipientBalanceBefore = await ethers.provider.getBalance(recipient);
    const userBalanceBefore = await ethers.provider.getBalance(env.user.address);
    const feeCollectorBalanceBefore = await ethers.provider.getBalance(env.feeCollector.address);

    // Create transaction promise with all expected events
    const tx = await env.burner.connect(env.user).swapExactInputMultiple(swapParams,
      recipient,
      false,
      "0x", 
      "0x0000000000000000000000000000000000000000",
      BigInt(Math.floor(Date.now() / 1000) + 100000)
    );
    const receipt = await tx.wait();
    const gasCost = receipt.gasUsed * receipt.gasPrice;

    const feeCollectorBalanceAfter = await ethers.provider.getBalance(env.feeCollector.address);
    const userBalanceAfter = await ethers.provider.getBalance(env.user.address);
    const recipientBalanceAfter = await ethers.provider.getBalance(recipient);

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
    
    // User should NOT receive the ETH, only pay gas
    expect(userBalanceAfter)
      .to.equal(userBalanceBefore - gasCost);
      
    // Recipient should receive 97.5% of 7 ETH
    expect(recipientBalanceAfter)
      .to.equal(recipientBalanceBefore + ethers.parseEther("6.825"));

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

  it("Should handle swaps with both different recipient and referrer", async function () {
    const swap1 = await getSwapParamsV3(env);
    const swap2 = await getSwapParamsV2(env, 50, 0.1);

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

    await env.mockLBRouter.setReturnAmount(ethers.parseEther("1"));

    // Use different recipient and referrer
    const recipient = env.recipient.address;
    const referrer = env.referrer.address;
    
    // Set referrer fee share
    const referrerFeeShare = 5n; // 25% of fees
    await env.burner.connect(env.owner).setReferrerFeeShare(referrerFeeShare);

    const recipientBalanceBefore = await ethers.provider.getBalance(recipient);
    const userBalanceBefore = await ethers.provider.getBalance(env.user.address);
    const feeCollectorBalanceBefore = await ethers.provider.getBalance(env.feeCollector.address);
    const referrerBalanceBefore = await ethers.provider.getBalance(referrer);

    const tx = await env.burner.connect(env.user).swapExactInputMultiple(
      swapParams,
      recipient,
      false,
      "0x", 
      referrer,
      BigInt(Math.floor(Date.now() / 1000) + 100000)
    );
    const receipt = await tx.wait();
    const gasCost = receipt.gasUsed * receipt.gasPrice;

    const feeCollectorBalanceAfter = await ethers.provider.getBalance(env.feeCollector.address);
    const userBalanceAfter = await ethers.provider.getBalance(env.user.address);
    const recipientBalanceAfter = await ethers.provider.getBalance(recipient);
    const referrerBalanceAfter = await ethers.provider.getBalance(referrer);

    // Calculate expected fees
    const totalOutputAmount = ethers.parseEther("2"); // 2 ETH (1 ETH from each swap)
    const totalFeeAmount = totalOutputAmount / await env.burner.burnFeeDivisor(); // 0.05 ETH (2.5% of 2 ETH)
    const referrerFeeAmount = totalFeeAmount * referrerFeeShare / 20n; // 0.0125 ETH (25% of fees)
    const feeCollectorAmount = totalFeeAmount - referrerFeeAmount; // 0.0375 ETH (75% of fees)
    const amountAfterFee = totalOutputAmount - totalFeeAmount; // 1.95 ETH

    // Events
    await expect(tx)
      .to.emit(env.burner, "ReferrerFeePaid")
      .withArgs(env.user.address, referrer, referrerFeeAmount);
    
    await expect(tx)
      .to.emit(env.burner, "BurnSuccess")
      .withArgs(env.user.address, amountAfterFee, totalFeeAmount);

    // Verify balances
    // Fee collector should receive 75% of fees
    expect(feeCollectorBalanceAfter)
      .to.equal(feeCollectorBalanceBefore + (feeCollectorAmount));
    
    // Referrer should receive 25% of fees
    expect(referrerBalanceAfter)
      .to.equal(referrerBalanceBefore+ (referrerFeeAmount));
    
    // User should only pay gas
    expect(userBalanceAfter)
      .to.equal(userBalanceBefore - (gasCost));
    
    // Recipient should receive the swapped ETH after fees
    expect(recipientBalanceAfter)
      .to.equal(recipientBalanceBefore + (amountAfterFee));
  });

  it("Should revert when recipient is user", async function () {
    const swap = await getSwapParamsV3(env);

    const swapParams = [{
      tokenIn: swap.swapParams.tokenIn,
      amountIn: swap.swapParams.amountIn,
      amountOutMinimum: swap.swapParams.amountOutMinimum,
      path: swap.swapParams.path,
      
    }];

    expect(await env.burner.connect(env.user).swapExactInputMultiple(swapParams,
      env.user.address,
      false,
      "0x", 
      "0x0000000000000000000000000000000000000000",
      BigInt(Math.floor(Date.now() / 1000) + 100000)
    )).to.revertedWithCustomError(env.burner, "RecipientIsSender");
  });
}); 