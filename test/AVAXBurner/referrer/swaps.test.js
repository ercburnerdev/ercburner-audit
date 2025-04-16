const { expect } = require("chai");
const { deployTestEnvironment } = require("../setup");
const { getSwapParamsV3, getSwapParamsV2, getSwapParamsWNATIVE } = require("../utils/getSwapParams");

describe("Burner - Referrer Swaps", function () {
  let env;

  beforeEach(async function () {
    env = await deployTestEnvironment();
  });

  it("Should calculate and distribute the standard referrer fee correctly", async function () {
    const swap = await getSwapParamsV3(env);

    const swapParams = [{
      tokenIn: swap.swapParams.tokenIn,
      amountIn: swap.swapParams.amountIn,
      amountOutMinimum: swap.swapParams.amountOutMinimum,
      path: swap.swapParams.path
    }];

    // Track ETH balances before swap
    const userBalanceBefore = await ethers.provider.getBalance(env.user.address);
    const feeCollectorBalanceBefore = await ethers.provider.getBalance(env.feeCollector.address);
    const referrerBalanceBefore = await ethers.provider.getBalance(env.referrer.address);

    // Execute swap with referrer
    const tx = await env.burner.connect(env.user).swapExactInputMultiple(
      swapParams,
      "0x0000000000000000000000000000000000000000",
      false,
      "0x",
      env.referrer.address
    );
    const receipt = await tx.wait();
    const gasCost = receipt.gasUsed * receipt.gasPrice;

    // Check event emission
    await expect(tx)
      .to.emit(env.burner, "ReferrerFeePaid")
      .withArgs(env.user.address, env.referrer.address, ethers.parseEther("0.005")); // 20% of 2.5% fee = 0.5% of total

    await expect(tx)
      .to.emit(env.burner, "BurnSuccess")
      .withArgs(
        env.user.address,
        ethers.parseEther("0.975"),
        ethers.parseEther("0.025")
      );

    // Check final ETH balances
    const userBalanceAfter = await ethers.provider.getBalance(env.user.address);
    const feeCollectorBalanceAfter = await ethers.provider.getBalance(env.feeCollector.address);
    const referrerBalanceAfter = await ethers.provider.getBalance(env.referrer.address);

    // Calculate expected values
    // Total ETH from swap: 1 ETH
    // User gets: 97.5% = 0.975 ETH
    // Total fee: 2.5% = 0.025 ETH
    // Referrer gets: 20% of fee = 0.005 ETH
    // Fee collector gets: 80% of fee = 0.02 ETH
    const expectedUserBalance = userBalanceBefore - gasCost + ethers.parseEther("0.975");
    const expectedFeeCollectorBalance = feeCollectorBalanceBefore + ethers.parseEther("0.02");
    const expectedReferrerBalance = referrerBalanceBefore + ethers.parseEther("0.005");

    expect(userBalanceAfter).to.equal(expectedUserBalance);
    expect(feeCollectorBalanceAfter).to.equal(expectedFeeCollectorBalance);
    expect(referrerBalanceAfter).to.equal(expectedReferrerBalance);
  });

  it("Should not pay referrer fee when referrer is set to zero address", async function () {
    const swap = await getSwapParamsV3(env);

    const swapParams = [{
      tokenIn: swap.swapParams.tokenIn,
      amountIn: swap.swapParams.amountIn,
      amountOutMinimum: swap.swapParams.amountOutMinimum,
      path: swap.swapParams.path
    }];

    // Track ETH balances before swap
    const feeCollectorBalanceBefore = await ethers.provider.getBalance(env.feeCollector.address);

    // Execute swap with zero address referrer
    const tx = await env.burner.connect(env.user).swapExactInputMultiple(
      swapParams,
      "0x0000000000000000000000000000000000000000",
      false,
      "0x",
      "0x0000000000000000000000000000000000000000"
    );

    // Check final ETH balances
    const feeCollectorBalanceAfter = await ethers.provider.getBalance(env.feeCollector.address);

    // Calculate expected values
    // Total ETH from swap: 1 ETH
    // Total fee: 2.5% = 0.025 ETH
    // Fee collector gets: 100% of fee = 0.025 ETH
    const expectedFeeCollectorBalance = feeCollectorBalanceBefore + ethers.parseEther("0.025");

    expect(feeCollectorBalanceAfter).to.equal(expectedFeeCollectorBalance);
  });

  it("Should not pay referrer fee when referral is paused", async function () {
    // Pause referrals
    await env.burner.connect(env.owner).changePauseReferral();

    const swap = await getSwapParamsV3(env);

    const swapParams = [{
      tokenIn: swap.swapParams.tokenIn,
      amountIn: swap.swapParams.amountIn,
      amountOutMinimum: swap.swapParams.amountOutMinimum,
      path: swap.swapParams.path
    }];

    // Track ETH balances before swap
    const referrerBalanceBefore = await ethers.provider.getBalance(env.referrer.address);
    const feeCollectorBalanceBefore = await ethers.provider.getBalance(env.feeCollector.address);

    // Execute swap with referrer (but referrals are paused)
    const tx = await env.burner.connect(env.user).swapExactInputMultiple(
      swapParams,
      "0x0000000000000000000000000000000000000000",
      false,
      "0x",
      env.referrer.address
    );

    // Check final ETH balances
    const referrerBalanceAfter = await ethers.provider.getBalance(env.referrer.address);
    const feeCollectorBalanceAfter = await ethers.provider.getBalance(env.feeCollector.address);

    // Referrer balance should remain unchanged
    expect(referrerBalanceAfter).to.equal(referrerBalanceBefore);
    // Fee collector gets the entire fee
    expect(feeCollectorBalanceAfter).to.equal(feeCollectorBalanceBefore + ethers.parseEther("0.025"));
  });

  it("Should revert when user tries to use self as referrer", async function () {
    const swap = await getSwapParamsV3(env);

    const swapParams = [{
      tokenIn: swap.swapParams.tokenIn,
      amountIn: swap.swapParams.amountIn,
      amountOutMinimum: swap.swapParams.amountOutMinimum,
      path: swap.swapParams.path
    }];

    // Try to use self as referrer
    await expect(env.burner.connect(env.user).swapExactInputMultiple(
      swapParams,
      "0x0000000000000000000000000000000000000000",
      false,
      "0x",
      env.user.address
    )).to.be.revertedWithCustomError(env.burner, "ReferrerCannotBeSelf");
  });

  it("Should calculate and distribute partner tier referrer fee correctly (30% tier)", async function () {
    // Setup 30% tier partner
    await env.burner.connect(env.owner).putPartner(env.referrer.address, 6);
    
    const swap = await getSwapParamsV3(env);

    const swapParams = [{
      tokenIn: swap.swapParams.tokenIn,
      amountIn: swap.swapParams.amountIn,
      amountOutMinimum: swap.swapParams.amountOutMinimum,
      path: swap.swapParams.path
    }];

    // Track ETH balances before swap
    const referrerBalanceBefore = await ethers.provider.getBalance(env.referrer.address);
    const feeCollectorBalanceBefore = await ethers.provider.getBalance(env.feeCollector.address);

    // Execute swap with partner as referrer
    const tx = await env.burner.connect(env.user).swapExactInputMultiple(
      swapParams,
      "0x0000000000000000000000000000000000000000",
      false,
      "0x",
      env.referrer.address
    );

    // Check event emission
    await expect(tx)
      .to.emit(env.burner, "ReferrerFeePaid")
      .withArgs(env.user.address, env.referrer.address, ethers.parseEther("0.0075")); // 30% of 2.5% fee = 0.75% of total

    // Check final ETH balances
    const referrerBalanceAfter = await ethers.provider.getBalance(env.referrer.address);
    const feeCollectorBalanceAfter = await ethers.provider.getBalance(env.feeCollector.address);

    // Calculate expected values
    // Total fee: 2.5% = 0.025 ETH
    // Referrer gets: 30% of fee = 0.0075 ETH
    // Fee collector gets: 70% of fee = 0.0175 ETH
    const expectedReferrerBalance = referrerBalanceBefore + ethers.parseEther("0.0075");
    const expectedFeeCollectorBalance = feeCollectorBalanceBefore + ethers.parseEther("0.0175");

    expect(referrerBalanceAfter).to.equal(expectedReferrerBalance);
    expect(feeCollectorBalanceAfter).to.equal(expectedFeeCollectorBalance);
  });

  it("Should calculate and distribute partner tier referrer fee correctly (40% tier)", async function () {
    // Setup 40% tier partner
    await env.burner.connect(env.owner).putPartner(env.referrer.address, 8);
    
    const swap = await getSwapParamsV3(env);

    const swapParams = [{
      tokenIn: swap.swapParams.tokenIn,
      amountIn: swap.swapParams.amountIn,
      amountOutMinimum: swap.swapParams.amountOutMinimum,
      path: swap.swapParams.path
    }];

    // Track ETH balances before swap
    const referrerBalanceBefore = await ethers.provider.getBalance(env.referrer.address);
    const feeCollectorBalanceBefore = await ethers.provider.getBalance(env.feeCollector.address);

    // Execute swap with partner as referrer
    const tx = await env.burner.connect(env.user).swapExactInputMultiple(
      swapParams,
      "0x0000000000000000000000000000000000000000",
      false,
      "0x",
      env.referrer.address
    );

    // Check event emission
    await expect(tx)
      .to.emit(env.burner, "ReferrerFeePaid")
      .withArgs(env.user.address, env.referrer.address, ethers.parseEther("0.01")); // 40% of 2.5% fee = 1% of total

    // Check final ETH balances
    const referrerBalanceAfter = await ethers.provider.getBalance(env.referrer.address);
    const feeCollectorBalanceAfter = await ethers.provider.getBalance(env.feeCollector.address);

    // Calculate expected values
    // Total fee: 2.5% = 0.025 ETH
    // Referrer gets: 40% of fee = 0.01 ETH
    // Fee collector gets: 60% of fee = 0.015 ETH
    const expectedReferrerBalance = referrerBalanceBefore + ethers.parseEther("0.01");
    const expectedFeeCollectorBalance = feeCollectorBalanceBefore + ethers.parseEther("0.015");

    expect(referrerBalanceAfter).to.equal(expectedReferrerBalance);
    expect(feeCollectorBalanceAfter).to.equal(expectedFeeCollectorBalance);
  });

  it("Should calculate and distribute partner tier referrer fee correctly (50% tier)", async function () {
    // Setup 50% tier partner
    await env.burner.connect(env.owner).putPartner(env.referrer.address, 10);
    
    const swap = await getSwapParamsV3(env);

    const swapParams = [{
      tokenIn: swap.swapParams.tokenIn,
      amountIn: swap.swapParams.amountIn,
      amountOutMinimum: swap.swapParams.amountOutMinimum,
      path: swap.swapParams.path
    }];

    // Track ETH balances before swap
    const referrerBalanceBefore = await ethers.provider.getBalance(env.referrer.address);
    const feeCollectorBalanceBefore = await ethers.provider.getBalance(env.feeCollector.address);

    // Execute swap with partner as referrer
    const tx = await env.burner.connect(env.user).swapExactInputMultiple(
      swapParams,
      "0x0000000000000000000000000000000000000000",
      false,
      "0x",
      env.referrer.address
    );

    // Check event emission
    await expect(tx)
      .to.emit(env.burner, "ReferrerFeePaid")
      .withArgs(env.user.address, env.referrer.address, ethers.parseEther("0.0125")); // 50% of 2.5% fee = 1.25% of total

    // Check final ETH balances
    const referrerBalanceAfter = await ethers.provider.getBalance(env.referrer.address);
    const feeCollectorBalanceAfter = await ethers.provider.getBalance(env.feeCollector.address);

    // Calculate expected values
    // Total fee: 2.5% = 0.025 ETH
    // Referrer gets: 50% of fee = 0.0125 ETH
    // Fee collector gets: 50% of fee = 0.0125 ETH
    const expectedReferrerBalance = referrerBalanceBefore + ethers.parseEther("0.0125");
    const expectedFeeCollectorBalance = feeCollectorBalanceBefore + ethers.parseEther("0.0125");

    expect(referrerBalanceAfter).to.equal(expectedReferrerBalance);
    expect(feeCollectorBalanceAfter).to.equal(expectedFeeCollectorBalance);
  });

  it("Should properly calculate referrer fees for multiple swaps", async function () {
    let swap1 = await getSwapParamsV3(env);
    let swap2 = await getSwapParamsV2(env);

    const swapParams = [
      {
        tokenIn: swap1.swapParams.tokenIn,
        amountIn: swap1.swapParams.amountIn,
        amountOutMinimum: swap1.swapParams.amountOutMinimum,
        path: swap1.swapParams.path
      },
      {
        tokenIn: swap2.swapParams.tokenIn,
        amountIn: swap2.swapParams.amountIn,
        amountOutMinimum: swap2.swapParams.amountOutMinimum,
        path: swap2.swapParams.path
      }
    ];

    // Mock router to return 0.1 ETH for each swap for a total of 0.2 ETH
    await env.mockLBRouter.setReturnAmount(ethers.parseEther("0.1"));

    // Track ETH balances before swap
    const referrerBalanceBefore = await ethers.provider.getBalance(env.referrer.address);
    const feeCollectorBalanceBefore = await ethers.provider.getBalance(env.feeCollector.address);

    // Execute multiple swaps with referrer
    const tx = await env.burner.connect(env.user).swapExactInputMultiple(
      swapParams,
      "0x0000000000000000000000000000000000000000",
      false,
      "0x",
      env.referrer.address
    );

    // Check event emission
    await expect(tx)
      .to.emit(env.burner, "ReferrerFeePaid")
      .withArgs(env.user.address, env.referrer.address, ethers.parseEther("0.001")); // 20% of 2.5% fee on 0.2 ETH = 0.001 ETH

    // Check final ETH balances
    const referrerBalanceAfter = await ethers.provider.getBalance(env.referrer.address);
    const feeCollectorBalanceAfter = await ethers.provider.getBalance(env.feeCollector.address);

    // Calculate expected values
    // Total ETH from swaps: 0.2 ETH
    // Total fee: 2.5% = 0.005 ETH
    // Referrer gets: 20% of fee = 0.001 ETH
    // Fee collector gets: 80% of fee = 0.004 ETH
    const expectedReferrerBalance = referrerBalanceBefore + ethers.parseEther("0.001");
    const expectedFeeCollectorBalance = feeCollectorBalanceBefore + ethers.parseEther("0.004");

    expect(referrerBalanceAfter).to.equal(expectedReferrerBalance);
    expect(feeCollectorBalanceAfter).to.equal(expectedFeeCollectorBalance);
  });

  it("Should calculate referrer fee correctly when sending to a different recipient", async function () {
    const swap = await getSwapParamsV3(env);

    const swapParams = [{
      tokenIn: swap.swapParams.tokenIn,
      amountIn: swap.swapParams.amountIn,
      amountOutMinimum: swap.swapParams.amountOutMinimum,
      path: swap.swapParams.path
    }];

    // Create a random recipient address
    const recipient = ethers.Wallet.createRandom().address;

    // Track ETH balances before swap
    const referrerBalanceBefore = await ethers.provider.getBalance(env.referrer.address);
    const feeCollectorBalanceBefore = await ethers.provider.getBalance(env.feeCollector.address);
    const recipientBalanceBefore = await ethers.provider.getBalance(recipient);

    // Execute swap with referrer and custom recipient
    const tx = await env.burner.connect(env.user).swapExactInputMultiple(
      swapParams,
      recipient,
      false,
      "0x",
      env.referrer.address
    );

    // Check event emission
    await expect(tx)
      .to.emit(env.burner, "ReferrerFeePaid")
      .withArgs(env.user.address, env.referrer.address, ethers.parseEther("0.005"));

    // Check final ETH balances
    const referrerBalanceAfter = await ethers.provider.getBalance(env.referrer.address);
    const feeCollectorBalanceAfter = await ethers.provider.getBalance(env.feeCollector.address);
    const recipientBalanceAfter = await ethers.provider.getBalance(recipient);

    // Calculate expected values
    const expectedReferrerBalance = referrerBalanceBefore + ethers.parseEther("0.005");
    const expectedFeeCollectorBalance = feeCollectorBalanceBefore + ethers.parseEther("0.02");
    const expectedRecipientBalance = recipientBalanceBefore + ethers.parseEther("0.975");

    expect(referrerBalanceAfter).to.equal(expectedReferrerBalance);
    expect(feeCollectorBalanceAfter).to.equal(expectedFeeCollectorBalance);
    expect(recipientBalanceAfter).to.equal(expectedRecipientBalance);
  });

  it("Should allow user who is a paid referrer to self-refer", async function () {
    // Setup user as a paid referrer (30% tier)
    const usdcDecimals = BigInt(parseInt(await env.mockUSDC.decimals()));
    
    await env.mockUSDC.mint(env.user.address, 25n * 10n ** usdcDecimals);
    await env.mockUSDC.connect(env.user).approve(await env.burner.getAddress(), 25n * 10n ** usdcDecimals);
    await env.burner.connect(env.user).paidReferrer(25n * 10n ** usdcDecimals);

    const swap = await getSwapParamsV3(env);

    const swapParams = [{
      tokenIn: swap.swapParams.tokenIn,
      amountIn: swap.swapParams.amountIn,
      amountOutMinimum: swap.swapParams.amountOutMinimum,
      path: swap.swapParams.path
    }];

    // Track ETH balances before swap
    const userBalanceBefore = await ethers.provider.getBalance(env.user.address);
    const feeCollectorBalanceBefore = await ethers.provider.getBalance(env.feeCollector.address);

    // Execute swap with self as referrer (should work since user is a paid referrer)
    const tx = await env.burner.connect(env.user).swapExactInputMultiple(
      swapParams,
      "0x0000000000000000000000000000000000000000",
      false,
      "0x",
      env.user.address
    );
    const receipt = await tx.wait();
    const gasCost = receipt.gasUsed * receipt.gasPrice;

    // Check event emission
    await expect(tx)
      .to.emit(env.burner, "ReferrerFeePaid")
      .withArgs(env.user.address, env.user.address, ethers.parseEther("0.0075")); // 30% of 2.5% fee = 0.75% of total

    // Check final ETH balances
    const userBalanceAfter = await ethers.provider.getBalance(env.user.address);
    const feeCollectorBalanceAfter = await ethers.provider.getBalance(env.feeCollector.address);

    // Calculate expected values
    // User gets: 97.5% of 1 ETH = 0.975 ETH + 30% of 2.5% fee = 0.0075 ETH
    // Total: 0.9825 ETH - gas costs
    // Fee collector gets: 70% of 2.5% fee = 0.01925 ETH
    const expectedUserBalance = userBalanceBefore + ethers.parseEther("0.9825") - gasCost;
    const expectedFeeCollectorBalance = feeCollectorBalanceBefore + ethers.parseEther("0.0175");

    expect(userBalanceAfter).to.equal(expectedUserBalance);
    expect(feeCollectorBalanceAfter).to.equal(expectedFeeCollectorBalance);
  });

  it("Should properly handle bridge transaction with referrer", async function () {
    // Prepare a bridge call data
    const bridgeTarget = env.mockReceiver.address;
    const bridgeData = ethers.keccak256(ethers.toUtf8Bytes("bridge_data"));
    
    const swap = await getSwapParamsV3(env);

    const swapParams = [{
      tokenIn: swap.swapParams.tokenIn,
      amountIn: swap.swapParams.amountIn,
      amountOutMinimum: swap.swapParams.amountOutMinimum,
      path: swap.swapParams.path
    }];

    // Track ETH balances before swap
    const referrerBalanceBefore = await ethers.provider.getBalance(env.referrer.address);
    const feeCollectorBalanceBefore = await ethers.provider.getBalance(env.feeCollector.address);

    // Execute swap with bridge and referrer
    const tx = await env.burner.connect(env.user).swapExactInputMultiple(
      swapParams,
      "0x0000000000000000000000000000000000000000",
      true,
      bridgeData,
      env.referrer.address,
      {value: ethers.parseEther("0.1")} // Add ETH for bridge fee
    );

    // Check event emission for referrer fee from both swap fee and bridge fee
    await expect(tx)
      .to.emit(env.burner, "ReferrerFeePaid")
      .withArgs(env.user.address, env.referrer.address, ethers.parseEther("0.005") + ethers.parseEther("0.00005"));

    // Check final ETH balances
    const referrerBalanceAfter = await ethers.provider.getBalance(env.referrer.address);
    const feeCollectorBalanceAfter = await ethers.provider.getBalance(env.feeCollector.address);

    // Calculate expected values
    // Swap fee: 2.5% of 1 ETH = 0.025 ETH, 20% to referrer = 0.005 ETH
    // Bridge fee: 0.25% of 0.1 ETH = 0.00025 ETH, 20% to referrer = 0.00005 ETH
    // Total to referrer: 0.00525 ETH
    // Total to fee collector: 0.02475 ETH
    const expectedReferrerBalance = referrerBalanceBefore + ethers.parseEther("0.005") + ethers.parseEther("0.00005"); 
    const expectedFeeCollectorBalance = feeCollectorBalanceBefore + ethers.parseEther("0.02") + ethers.parseEther("0.0002");

    expect(referrerBalanceAfter).to.equal(expectedReferrerBalance);
    expect(feeCollectorBalanceAfter).to.equal(expectedFeeCollectorBalance);
  });
}); 