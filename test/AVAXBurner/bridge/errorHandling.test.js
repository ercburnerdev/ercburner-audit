const { expect } = require("chai");
const { deployTestEnvironment } = require("../setup");
const { getSwapParamsV3 } = require("../utils/getSwapParams");
const { ethers } = require("hardhat");

describe("Burner - Bridge Error Handling", function () {
  let env;

  beforeEach(async function () {
    env = await deployTestEnvironment();
  });

  it("Should revert when trying to bridge while paused", async function () {
    // Pause bridge
    await env.burner.connect(env.owner).changePauseBridge();
    
    const swap = await getSwapParamsV3(env);
    const swapParams = [{
      tokenIn: swap.swapParams.tokenIn,
      amountIn: swap.swapParams.amountIn,
      amountOutMinimum: swap.swapParams.amountOutMinimum,
      path: swap.swapParams.path
    }];

    const bridgeData = ethers.keccak256(ethers.toUtf8Bytes("bridge_data"));

    await expect(env.burner.connect(env.user).swapExactInputMultiple(
      swapParams,
      "0x0000000000000000000000000000000000000000",
      true, // bridge = true
      bridgeData,
      env.referrer.address
    )).to.be.revertedWithCustomError(env.burner, "BridgePaused");
  });

  it("Should revert when trying to set both bridge and recipient", async function () {
    const swap = await getSwapParamsV3(env);
    const swapParams = [{
      tokenIn: swap.swapParams.tokenIn,
      amountIn: swap.swapParams.amountIn,
      amountOutMinimum: swap.swapParams.amountOutMinimum,
      path: swap.swapParams.path
    }];

    const bridgeData = ethers.keccak256(ethers.toUtf8Bytes("bridge_data"));

    await expect(env.burner.connect(env.user).swapExactInputMultiple(
      swapParams,
      env.user.address, // non-zero recipient
      true, // bridge = true
      bridgeData,
      env.referrer.address
    )).to.be.revertedWithCustomError(env.burner, "BridgeAndRecipientBothSet")
      .withArgs(env.user.address);
  });

  it("Should revert when trying to bridge with empty bridge data", async function () {
    const swap = await getSwapParamsV3(env);
    const swapParams = [{
      tokenIn: swap.swapParams.tokenIn,
      amountIn: swap.swapParams.amountIn,
      amountOutMinimum: swap.swapParams.amountOutMinimum,
      path: swap.swapParams.path
    }];

    await expect(env.burner.connect(env.user).swapExactInputMultiple(
      swapParams,
      "0x0000000000000000000000000000000000000000",
      true, // bridge = true
      "0x", // empty bridge data
      env.referrer.address
    )).to.be.revertedWithCustomError(env.burner, "InvalidBridgeData");
  });

  it("Should revert when non-bridge transaction has non-empty bridge data", async function () {
    const swap = await getSwapParamsV3(env);
    const swapParams = [{
      tokenIn: swap.swapParams.tokenIn,
      amountIn: swap.swapParams.amountIn,
      amountOutMinimum: swap.swapParams.amountOutMinimum,
      path: swap.swapParams.path
    }];

    const bridgeData = ethers.keccak256(ethers.toUtf8Bytes("bridge_data"));

    await expect(env.burner.connect(env.user).swapExactInputMultiple(
      swapParams,
      "0x0000000000000000000000000000000000000000",
      false, // bridge = false
      bridgeData, // non-empty bridge data
      env.referrer.address
    )).to.be.revertedWithCustomError(env.burner, "BridgeDataMustBeEmpty")
      .withArgs(bridgeData);
  });

  it("Should revert when non-bridge transaction with ETH has no recipient", async function () {
    const swap = await getSwapParamsV3(env);
    const swapParams = [{
      tokenIn: swap.swapParams.tokenIn,
      amountIn: swap.swapParams.amountIn,
      amountOutMinimum: swap.swapParams.amountOutMinimum,
      path: swap.swapParams.path
    }];

    await expect(env.burner.connect(env.user).swapExactInputMultiple(
      swapParams,
      "0x0000000000000000000000000000000000000000", // zero address recipient
      false, // bridge = false
      "0x", // empty bridge data
      env.referrer.address,
      { value: ethers.parseEther("0.1") } // sending ETH
    )).to.be.revertedWithCustomError(env.burner, "RecipientMustBeSet");
  });

  it("Should revert when bridge ETH value is insufficient", async function () {
    const swap = await getSwapParamsV3(env);
    const swapParams = [{
      tokenIn: swap.swapParams.tokenIn,
      amountIn: swap.swapParams.amountIn,
      amountOutMinimum: swap.swapParams.amountOutMinimum,
      path: swap.swapParams.path
    }];

    const bridgeData = ethers.keccak256(ethers.toUtf8Bytes("bridge_data"));
    
    // Get the bridge fee divisor to calculate a value below minimum
    const bridgeFeeDivisor = await env.burner.bridgeFeeDivisor();
    const minRequired = bridgeFeeDivisor * 20n;
    const insufficientValue = minRequired - 1n;

    await expect(env.burner.connect(env.user).swapExactInputMultiple(
      swapParams,
      "0x0000000000000000000000000000000000000000",
      true, // bridge = true
      bridgeData,
      env.referrer.address,
      { value: insufficientValue }
    )).to.be.revertedWithCustomError(env.burner, "InsufficientValue")
      .withArgs(insufficientValue, minRequired);
  });

  it("Should revert when relayBridge is called with zero value", async function () {
    const bridgeData = ethers.keccak256(ethers.toUtf8Bytes("bridge_data"));

    await expect(env.burner.connect(env.owner).relayBridge(
      bridgeData,
      env.referrer.address,
      { value: 0 }
    )).to.be.revertedWithCustomError(env.burner, "ZeroValue");
  });

  it("Should revert when relayBridge is called with empty bridge data", async function () {
    await expect(env.burner.connect(env.owner).relayBridge(
      "0x", // empty bridge data
      env.referrer.address,
      { value: ethers.parseEther("0.1") }
    )).to.be.revertedWithCustomError(env.burner, "InvalidBridgeData");
  });

  it("Should revert when relayBridge is called with insufficient value", async function () {
    const bridgeData = ethers.keccak256(ethers.toUtf8Bytes("bridge_data"));
    
    // Get the bridge fee divisor to calculate a value below minimum
    const bridgeFeeDivisor = await env.burner.bridgeFeeDivisor();
    const minRequired = bridgeFeeDivisor * 20n;
    const insufficientValue = minRequired - 1n;

    await expect(env.burner.connect(env.owner).relayBridge(
      bridgeData,
      env.referrer.address,
      { value: insufficientValue }
    )).to.be.revertedWithCustomError(env.burner, "InsufficientValue")
      .withArgs(insufficientValue, minRequired);
  });

  it("Should revert when setting bridge address to zero address", async function () {
    await expect(env.burner.connect(env.owner).setBridgeAddress(
      "0x0000000000000000000000000000000000000000"
    )).to.be.revertedWithCustomError(env.burner, "ZeroAddress");
  });

  it("Should revert when bridge fee divisor is set to zero", async function () {
    await expect(env.burner.connect(env.owner).setBridgeFeeDivisor(0))
      .to.be.revertedWithCustomError(env.burner, "FeeDivisorTooLow");
  });

  it("Should revert when bridge fee divisor is set too low", async function () {
    await expect(env.burner.connect(env.owner).setBridgeFeeDivisor(399))
      .to.be.revertedWithCustomError(env.burner, "FeeDivisorTooLow")
      .withArgs(399, 400);
  });
}); 