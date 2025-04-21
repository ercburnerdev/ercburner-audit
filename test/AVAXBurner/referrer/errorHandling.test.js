const { expect } = require("chai");
const { deployTestEnvironment } = require("../setup");
const { getSwapParamsV3 } = require("../utils/getSwapParams");

describe("Burner - Referrer Error Handling", function () {
  let env;

  beforeEach(async function () {
    env = await deployTestEnvironment();
  });

  it("Should revert when trying to set referrer fee share to zero", async function () {
    await expect(env.burner.connect(env.owner).setReferrerFeeShare(0))
      .to.be.revertedWithCustomError(env.burner, "ZeroFeeShare");
  });

  it("Should revert when trying to set referrer fee share too high", async function () {
    await expect(env.burner.connect(env.owner).setReferrerFeeShare(21))
      .to.be.revertedWithCustomError(env.burner, "FeeShareTooHigh")
      .withArgs(21, 20);
  });

  it("Should revert when trying to add partner with zero address", async function () {
    await expect(env.burner.connect(env.owner).putPartner("0x0000000000000000000000000000000000000000", 10))
      .to.be.revertedWithCustomError(env.burner, "ZeroAddress");
  });

  it("Should revert when trying to add partner with zero fee share", async function () {
    await expect(env.burner.connect(env.owner).putPartner(env.referrer.address, 0))
      .to.be.revertedWithCustomError(env.burner, "ZeroFeeShare");
  });

  it("Should revert when trying to self-refer without being registered", async function () {
    const swap = await getSwapParamsV3(env);

    const swapParams = [{
      tokenIn: swap.swapParams.tokenIn,
      amountIn: swap.swapParams.amountIn,
      amountOutMinimum: swap.swapParams.amountOutMinimum,
      path: swap.swapParams.path,
      
    }];

    await expect(env.burner.connect(env.user).swapExactInputMultiple(
      swapParams,
      "0x0000000000000000000000000000000000000000",
      false,
      "0x",
      env.user.address,
      BigInt(Math.floor(Date.now() / 1000) + 100000)
    )).to.be.revertedWithCustomError(env.burner, "ReferrerCannotBeSelfUnlessPartner");
  });

  it("Should revert when non-referrer tries to upgrade", async function () {
    const usdcDecimals = BigInt(parseInt(await env.mockUSDC.decimals()));

    await env.mockUSDC.mint(env.user.address, 50n * 10n ** usdcDecimals);
    await env.mockUSDC.connect(env.user).approve(await env.burner.getAddress(), 50n * 10n ** usdcDecimals);
    
    await expect(env.burner.connect(env.user).upgradeReferrer(50n * 10n ** usdcDecimals))
      .to.be.revertedWithCustomError(env.burner, "ReferrerNotRegistered");
  });

  it("Should revert when 50% tier referrer tries to upgrade", async function () {
    // First become a 50% tier referrer
    const usdcDecimals = BigInt(parseInt(await env.mockUSDC.decimals()));

    await env.mockUSDC.mint(env.user.address, 100n * 10n ** usdcDecimals);
    await env.mockUSDC.connect(env.user).approve(await env.burner.getAddress(), 100n * 10n ** usdcDecimals);
    await env.burner.connect(env.user).paidReferrer(100n * 10n ** usdcDecimals);
    
    // Try to upgrade again
    await env.mockUSDC.mint(env.user.address, 50n * 10n ** usdcDecimals);
    await env.mockUSDC.connect(env.user).approve(await env.burner.getAddress(), 50n * 10n ** usdcDecimals);
    
    await expect(env.burner.connect(env.user).upgradeReferrer(50n * 10n ** usdcDecimals))
      .to.be.revertedWithCustomError(env.burner, "MaximumTierReached");
  });

  it("Should revert when trying to become a paid referrer with insufficient USDC amount", async function () {
    const usdcDecimals = BigInt(parseInt(await env.mockUSDC.decimals()));
    
    await env.mockUSDC.mint(env.user.address, 20n * 10n ** usdcDecimals);
    await env.mockUSDC.connect(env.user).approve(await env.burner.getAddress(), 20n * 10n ** usdcDecimals);
    
    await expect(env.burner.connect(env.user).paidReferrer(25n * 10n ** usdcDecimals))
      .to.be.revertedWithCustomError(env.burner, "InsufficientAllowanceOrAmount");
  });

  it("Should revert when trying to become a paid referrer with insufficient USDC allowance", async function () {
    const usdcDecimals = BigInt(parseInt(await env.mockUSDC.decimals()));
    
    await env.mockUSDC.mint(env.user.address, 25n * 10n ** usdcDecimals);
    await env.mockUSDC.connect(env.user).approve(await env.burner.getAddress(), 20n * 10n ** usdcDecimals);
    
    await expect(env.burner.connect(env.user).paidReferrer(25n * 10n ** usdcDecimals))
      .to.be.revertedWithCustomError(env.burner, "InsufficientAllowanceOrAmount");
  });

  it("Should revert when trying to upgrade with insufficient USDC amount", async function () {
    // First become a 30% tier referrer
    const usdcDecimals = BigInt(parseInt(await env.mockUSDC.decimals()));

    await env.mockUSDC.mint(env.user.address, 25n * 10n ** usdcDecimals);
    await env.mockUSDC.connect(env.user).approve(await env.burner.getAddress(), 25n * 10n ** usdcDecimals);
    await env.burner.connect(env.user).paidReferrer(25n * 10n ** usdcDecimals);
    
    // Try to upgrade with less than required
    await env.mockUSDC.mint(env.user.address, 20n * 10n ** usdcDecimals);
    await env.mockUSDC.connect(env.user).approve(await env.burner.getAddress(), 20n * 10n ** usdcDecimals);
    
    await expect(env.burner.connect(env.user).upgradeReferrer(25n * 10n ** usdcDecimals))
      .to.be.revertedWithCustomError(env.burner, "InsufficientAllowanceOrAmount");
  });

  it("Should revert when 30% tier referrer provides incorrect amount for upgrade", async function () {
    // First become a 30% tier referrer
    const usdcDecimals = BigInt(parseInt(await env.mockUSDC.decimals()));

    await env.mockUSDC.mint(env.user.address, 25n * 10n ** usdcDecimals);
    await env.mockUSDC.connect(env.user).approve(await env.burner.getAddress(), 25n * 10n ** usdcDecimals);
    await env.burner.connect(env.user).paidReferrer(25n * 10n ** usdcDecimals);
    
    // Try to upgrade with incorrect amount
    await env.mockUSDC.mint(env.user.address, 30n * 10n ** usdcDecimals);
    await env.mockUSDC.connect(env.user).approve(await env.burner.getAddress(), 30n * 10n ** usdcDecimals);
    
    await expect(env.burner.connect(env.user).upgradeReferrer(30n * 10n ** usdcDecimals))
      .to.be.revertedWithCustomError(env.burner, "InsufficientAllowanceOrAmount");
  });

  it("Should revert when the contract is paused", async function () {
    // Pause the contract
    await env.burner.connect(env.owner).pause();
    
    const swap = await getSwapParamsV3(env);
    const swapParams = [{
      tokenIn: swap.swapParams.tokenIn,
      amountIn: swap.swapParams.amountIn,
      amountOutMinimum: swap.swapParams.amountOutMinimum,
      path: swap.swapParams.path,
      
    }];

    await expect(env.burner.connect(env.user).swapExactInputMultiple(
      swapParams,
      "0x0000000000000000000000000000000000000000",
      false,
      "0x",
      env.referrer.address,
      BigInt(Math.floor(Date.now() / 1000) + 100000)
    )).to.be.revertedWithCustomError(env.burner, "EnforcedPause");
  });
}); 