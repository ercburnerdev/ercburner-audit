const { expect } = require("chai");
const { deployTestEnvironment } = require("../setup");
const { ethers } = require("hardhat");

describe("Burner - Bridge Admin", function () {
  let env;

  beforeEach(async function () {
    env = await deployTestEnvironment();
  });

  it("Should allow owner to set native sent fee divisor", async function () {
    await expect(env.burner.connect(env.owner).setNativeSentFeeDivisor(500))
      .to.emit(env.burner, "NativeSentFeeDivisorChanged")
      .withArgs(500);

    expect(await env.burner.nativeSentFeeDivisor()).to.equal(500);
  });

  it("Should not allow non-owner to set native sent fee divisor", async function () {
    await expect(env.burner.connect(env.user).setNativeSentFeeDivisor(500))
      .to.be.revertedWithCustomError(env.burner, "OwnableUnauthorizedAccount")
      .withArgs(env.user.address);
  });

  it("Should allow owner to set bridge address", async function () {
    const newBridgeAddress = "0x1000000000000000000000000000000000000001";
    
    await expect(env.burner.connect(env.owner).setBridgeAddress(newBridgeAddress))
      .to.emit(env.burner, "BridgeAddressChanged")
      .withArgs(newBridgeAddress);

    expect(await env.burner.bridgeAddress()).to.equal(newBridgeAddress);
  });

  it("Should not allow non-owner to set bridge address", async function () {
    const newBridgeAddress = "0x1000000000000000000000000000000000000001";
    
    await expect(env.burner.connect(env.user).setBridgeAddress(newBridgeAddress))
      .to.be.revertedWithCustomError(env.burner, "OwnableUnauthorizedAccount")
      .withArgs(env.user.address);
  });

  it("Should allow owner to pause bridge", async function () {
    expect(await env.burner.pauseBridge()).to.equal(false);
    
    await expect(env.burner.connect(env.owner).changePauseBridge())
      .to.emit(env.burner, "PauseBridgeChanged")
      .withArgs(true);

    expect(await env.burner.pauseBridge()).to.equal(true);
  });

  it("Should not allow non-owner to pause bridge", async function () {
    await expect(env.burner.connect(env.user).changePauseBridge())
      .to.be.revertedWithCustomError(env.burner, "OwnableUnauthorizedAccount")
      .withArgs(env.user.address);
  });

  it("Should allow owner to unpause bridge", async function () {
    // First pause the bridge
    await env.burner.connect(env.owner).changePauseBridge();
    expect(await env.burner.pauseBridge()).to.equal(true);
    
    // Then unpause it
    await expect(env.burner.connect(env.owner).changePauseBridge())
      .to.emit(env.burner, "PauseBridgeChanged")
      .withArgs(false);

    expect(await env.burner.pauseBridge()).to.equal(false);
  });

  it("Should relay bridge call when called by owner", async function () {
    const bridgeData = ethers.keccak256(ethers.toUtf8Bytes("bridge_data"));
    const value = ethers.parseEther("0.1");
    
    // Track ETH balances before relay
    const feeCollectorBalanceBefore = await ethers.provider.getBalance(env.feeCollector.address);
    
    // Call relayBridge
    const tx = await env.burner.connect(env.owner).relayBridge(
      bridgeData,
      "0x0000000000000000000000000000000000000000", // No referrer
      { value }
    );
    
    // Check event emission
    await expect(tx)
      .to.emit(env.burner, "BridgeSuccess")
      .withArgs(
        env.owner.address,
        "0x", // Return data from mock receiver
        ethers.parseEther("0.09975"), // 99.75% of 0.1 ETH (after 0.25% fee)
        ethers.parseEther("0.00025")  // 0.25% of 0.1 ETH fee
      );
    
    // Check fee collection
    const feeCollectorBalanceAfter = await ethers.provider.getBalance(env.feeCollector.address);
    const nativeSentFee = value / await env.burner.nativeSentFeeDivisor();
    
    expect(feeCollectorBalanceAfter).to.equal(feeCollectorBalanceBefore + nativeSentFee);
  });

  it("Should correctly rescue ETH from contract", async function () {
    // First send some ETH to the contract
    await env.user.sendTransaction({
      to: await env.burner.getAddress(),
      value: ethers.parseEther("1.0")
    });
    
    const initialBalance = await ethers.provider.getBalance(env.owner.address);
    const amount = ethers.parseEther("0.5");
    
    // Rescue half of the ETH
    await env.burner.connect(env.owner).rescueETH(env.owner.address, amount);
    
    const finalBalance = await ethers.provider.getBalance(env.owner.address);
    
    // Account for gas costs
    expect(finalBalance > initialBalance).to.equal(true);
  });
}); 