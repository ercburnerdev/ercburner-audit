const { expect } = require("chai");
const { deployTestEnvironment } = require("./setup");
const { prepareSwapExactInput, encodePath } = require("./utils/prepareSwaps");
const { getSwapParamsV3, getSwapParamsV2 } = require("./utils/getSwapParams");

describe("Burner - Admin Functions", function () {
  let env;

  beforeEach(async function () {
    env = await deployTestEnvironment();
  });

  it("Should allow owner to rescue tokens", async function () {
    // Send some tokens to the incinerator contract
    const amount = ethers.parseEther("10");
    await env.mockToken.mint(await env.burner.getAddress(), amount);
    
    // Create a rescue recipient address
    const rescueRecipient = ethers.Wallet.createRandom().address;
    
    // Verify initial balances
    expect(await env.mockToken.balanceOf(await env.burner.getAddress())).to.equal(amount);
    expect(await env.mockToken.balanceOf(rescueRecipient)).to.equal(0n);

    // Execute rescue
    await expect(env.burner.connect(env.owner).rescueTokens(
      await env.mockToken.getAddress(),
      rescueRecipient,
      amount
    )).to.emit(env.mockToken, "Transfer")

      .withArgs(await env.burner.getAddress(), rescueRecipient, amount);


    // Verify final balances
    expect(await env.mockToken.balanceOf(await env.burner.getAddress())).to.equal(0n);
    expect(await env.mockToken.balanceOf(rescueRecipient)).to.equal(amount);
  });

  it("Should not allow non-owner to rescue tokens", async function () {
    const amount = ethers.parseEther("10");
    await env.mockToken.mint(await env.burner.getAddress(), amount);
    const rescueRecipient = ethers.Wallet.createRandom().address;


    await expect(env.burner.connect(env.user).rescueTokens(
        await env.mockToken.getAddress(),
        rescueRecipient,
        amount
    )).to.be.revertedWithCustomError(env.burner, "OwnableUnauthorizedAccount")

      .withArgs(env.user.address);
  });

  it("Should allow owner to pause and unpause the contract", async function () {
    // Verify initial state
    expect(await env.burner.paused()).to.equal(false);


    // Pause
    await expect(env.burner.connect(env.owner).pause())
      .to.emit(env.burner, "Paused")
      .withArgs(env.owner.address);


    expect(await env.burner.paused()).to.equal(true);


    // Unpause
    await expect(env.burner.connect(env.owner).unpause())
      .to.emit(env.burner, "Unpaused")
      .withArgs(env.owner.address);


    expect(await env.burner.paused()).to.equal(false);
  });


  it("Should not allow non-owner to pause or unpause", async function () {
    await expect(env.burner.connect(env.user).pause())
      .to.be.revertedWithCustomError(env.burner, "OwnableUnauthorizedAccount")
      .withArgs(env.user.address);


    await expect(env.burner.connect(env.user).unpause())
      .to.be.revertedWithCustomError(env.burner, "OwnableUnauthorizedAccount")
      .withArgs(env.user.address);

  });

  it("Should not allow swaps when contract is paused", async function () {
    // Pause the contract
    await env.burner.connect(env.owner).pause();

    let swap = await getSwapParamsV3(env);
    let swapParams = [{
      commands: swap.swapParams.commands,
      inputs: swap.swapParams.inputs,
      deadline: swap.swapParams.deadline
    }];

    await expect(
      env.burner.connect(env.user).swapExactInputMultiple(swapParams,
         "0x0000000000000000000000000000000000000000",
          false,
          "0x", 
          "0x0000000000000000000000000000000000000000"
        )
    ).to.be.revertedWithCustomError(env.burner, "EnforcedPause");
  });


  it("Should allow owner to rescue ETH", async function () {
    const amount = ethers.parseEther("10");
    await env.owner.sendTransaction({
      to: await env.burner.getAddress(),
      value: amount
    });


    // Verify initial balance
    expect(await ethers.provider.getBalance(await env.burner.getAddress())).to.equal(amount);


    const recipientBalanceBefore = await ethers.provider.getBalance(env.user.address);

    await env.burner.connect(env.owner).rescueETH(env.user.address, amount);


    // Verify the ETH was transferred
    expect(await ethers.provider.getBalance(await env.burner.getAddress())).to.equal(0n);
    expect(await ethers.provider.getBalance(env.user.address))
      .to.equal(recipientBalanceBefore + amount);
  });

  it("Should not allow non-owner to rescue ETH", async function () {
    const amount = ethers.parseEther("10");
    await expect(env.burner.connect(env.user).rescueETH(env.user.address, amount))
      .to.be.revertedWithCustomError(env.burner, "OwnableUnauthorizedAccount")
      .withArgs(env.user.address);

  });

  it("Should allow owner to set minGasLeft", async function () {
    const newMinGasLeft = 122222;
    await env.burner.connect(env.owner).setMinGasLeft(newMinGasLeft);
    expect(await env.burner.minGasLeft()).to.equal(newMinGasLeft);
  });

  it("Should not allow non-owner to set minGasLeft", async function () {
    const newMinGasLeft = 122222;
    await expect(env.burner.connect(env.user).setMinGasLeft(newMinGasLeft))
      .to.be.revertedWithCustomError(env.burner, "OwnableUnauthorizedAccount")
      .withArgs(env.user.address);
  });

  it("Should not allow setting minGasLeft to 0", async function () {
    await expect(env.burner.connect(env.owner).setMinGasLeft(0))
      .to.be.revertedWithCustomError(env.burner, "ZeroMinGasLeft")
  });

  it("Should ensure a swap fails if gasleft is less than minGasLeft", async function () {
    await env.burner.connect(env.owner).setMinGasLeft(1000000);

    let swap = await getSwapParamsV3(env);

    const swapParams = [{
      commands: swap.swapParams.commands,
      inputs: swap.swapParams.inputs,
      deadline: swap.swapParams.deadline
    }];

    const userTokenBalanceBefore = await env.mockToken.balanceOf(env.user.address);

    const userBalanceBefore = await ethers.provider.getBalance(env.user.address);
    const feeCollectorBalanceBefore = await ethers.provider.getBalance(env.feeCollector.address);

    const tx = await env.burner.connect(env.user).swapExactInputMultiple(swapParams,
      "0x0000000000000000000000000000000000000000",
       false,
       "0x", 
       "0x0000000000000000000000000000000000000000", 
       {gasLimit: 200000}
    );
    const receipt = await tx.wait();
    const gasCost = receipt.gasUsed * receipt.gasPrice;

    await expect(tx)
      .to.emit(env.burner, "SwapFailed")
      .withArgs(
        env.user.address,
        swap.swapParams.tokenIn,
        ethers.parseEther("100"),
        "Insufficient gas"
      );
    
    const userTokenBalanceAfter = await swap.token.balanceOf(env.user.address);
    const userBalanceAfter = await ethers.provider.getBalance(env.user.address);
    const feeCollectorBalanceAfter = await ethers.provider.getBalance(env.feeCollector.address);

    expect(userTokenBalanceAfter).to.equal(userTokenBalanceBefore);
    expect(userBalanceAfter).to.equal(userBalanceBefore - gasCost);
    expect(feeCollectorBalanceAfter).to.equal(feeCollectorBalanceBefore);
  });
  
  // New tests for admin functionality
  it("Should properly initialize admin role", async function () {
    const ADMIN_ROLE = await env.burner.ADMIN_ROLE();
    expect(await env.burner.hasRole(ADMIN_ROLE, env.admin.address)).to.equal(true);
    
    const DEFAULT_ADMIN_ROLE = await ethers.ZeroHash;
    expect(await env.burner.hasRole(DEFAULT_ADMIN_ROLE, env.owner.address)).to.equal(true);
  });
  
  it("Should allow owner to change admin via setAdmin", async function () {
    const ADMIN_ROLE = await env.burner.ADMIN_ROLE();
    const newAdmin = env.recipient.address;
    
    // Verify current admin has role and new admin doesn't
    expect(await env.burner.hasRole(ADMIN_ROLE, env.admin.address)).to.equal(true);
    expect(await env.burner.hasRole(ADMIN_ROLE, newAdmin)).to.equal(false);
    
    // Change admin
    await expect(env.burner.connect(env.owner).setAdmin(env.admin.address, newAdmin))
      .to.emit(env.burner, "AdminChanged")
      .withArgs(newAdmin);
    
    // Verify roles were updated correctly
    expect(await env.burner.hasRole(ADMIN_ROLE, env.admin.address)).to.equal(false);
    expect(await env.burner.hasRole(ADMIN_ROLE, newAdmin)).to.equal(true);
  });
  
  it("Should not allow non-owner to call setAdmin", async function () {
    await expect(env.burner.connect(env.user).setAdmin(env.admin.address, env.user.address))
      .to.be.revertedWithCustomError(env.burner, "OwnableUnauthorizedAccount")
      .withArgs(env.user.address);

    await expect(env.burner.connect(env.admin).setAdmin(env.admin.address, env.user.address))
    .to.be.revertedWithCustomError(env.burner, "OwnableUnauthorizedAccount")
    .withArgs(env.admin.address);
  });
  
  it("Should not allow setting a zero address as admin", async function () {
    await expect(env.burner.connect(env.owner).setAdmin(env.admin.address, ethers.ZeroAddress))
      .to.be.revertedWithCustomError(env.burner, "ZeroAddress");
  });
  
  it("Should not allow setting oldAdmin as zero address", async function () {
    await expect(env.burner.connect(env.owner).setAdmin(ethers.ZeroAddress, env.user.address))
      .to.be.revertedWithCustomError(env.burner, "ZeroAddress");
  });
  
  it("Should not allow setting same address as old and new admin", async function () {
    await expect(env.burner.connect(env.owner).setAdmin(env.admin.address, env.admin.address))
      .to.be.revertedWithCustomError(env.burner, "SameAdmin");
  });
  
  it("Should not allow setting an address that already has admin role", async function () {
    // First grant admin role to another address
    const ADMIN_ROLE = await env.burner.ADMIN_ROLE();
    await env.burner.connect(env.owner).grantRole(ADMIN_ROLE, env.user.address);
    
    // Try to set this user as admin via setAdmin
    await expect(env.burner.connect(env.owner).setAdmin(env.admin.address, env.user.address))
      .to.be.revertedWithCustomError(env.burner, "AdminAlreadyExists");
  });
  
  it("Should not allow setting a non-admin address as oldAdmin", async function () {
    await expect(env.burner.connect(env.owner).setAdmin(env.user.address, env.recipient.address))
      .to.be.revertedWithCustomError(env.burner, "AdminDoesNotExist");
  });
  
  it("Should allow admin to add a partner", async function () {
    await expect(env.burner.connect(env.admin).putPartner(env.referrer.address, 10))
      .to.emit(env.burner, "PartnerAdded")
      .withArgs(env.referrer.address);
    
    expect(await env.burner.partners(env.referrer.address)).to.equal(10);
  });
  
  it("Should allow admin to update a partner's fee share", async function () {
    // First add a partner
    await env.burner.connect(env.admin).putPartner(env.referrer.address, 10);
    
    // Update fee share
    await expect(env.burner.connect(env.admin).putPartner(env.referrer.address, 15))
      .to.emit(env.burner, "PartnerFeeShareChanged")
      .withArgs(env.referrer.address, 15);
    
    expect(await env.burner.partners(env.referrer.address)).to.equal(15);
  });
  
  it("Should not allow regular user to add a partner", async function () {
    await expect(env.burner.connect(env.user).putPartner(env.referrer.address, 10))
      .to.be.revertedWithCustomError(env.burner, "CallerNotAdminOrOwner")
      .withArgs(env.user.address);
  });
  
  it("Should not allow admin to remove a partner", async function () {
    // First add a partner
    await env.burner.connect(env.admin).putPartner(env.referrer.address, 10);
    
    // Try to remove partner
    await expect(env.burner.connect(env.admin).removePartner(env.referrer.address))
      .to.be.revertedWithCustomError(env.burner, "OwnableUnauthorizedAccount")
      .withArgs(env.admin.address);
  });
  
  it("Should allow owner to directly grant and revoke ADMIN_ROLE", async function () {
    const ADMIN_ROLE = await env.burner.ADMIN_ROLE();
    
    // Grant role
    await env.burner.connect(env.owner).grantRole(ADMIN_ROLE, env.user.address);
    expect(await env.burner.hasRole(ADMIN_ROLE, env.user.address)).to.equal(true);
    
    // New admin should be able to add partner
    await expect(env.burner.connect(env.user).putPartner(env.referrer.address, 10))
      .to.emit(env.burner, "PartnerAdded")
      .withArgs(env.referrer.address);
    
    // Revoke role
    await env.burner.connect(env.owner).revokeRole(ADMIN_ROLE, env.user.address);
    expect(await env.burner.hasRole(ADMIN_ROLE, env.user.address)).to.equal(false);
    
    // Should no longer be able to add partner
    await expect(env.burner.connect(env.user).putPartner(env.solver.address, 10))
      .to.be.revertedWithCustomError(env.burner, "CallerNotAdminOrOwner")
      .withArgs(env.user.address);
  });
});