const { expect } = require("chai");
const { deployTestEnvironment } = require("../setup");

describe("Burner - Referrer Admin", function () {
  let env;

  beforeEach(async function () {
    env = await deployTestEnvironment();
  });

  it("Should allow owner to set referrer fee share", async function () {
    await expect(env.burner.connect(env.owner).setReferrerFeeShare(5))
      .to.emit(env.burner, "ReferrerFeeShareChanged")
      .withArgs(5);

    expect(await env.burner.referrerFeeShare()).to.equal(5);
  });

  it("Should not allow non-owner to set referrer fee share", async function () {
    await expect(env.burner.connect(env.user).setReferrerFeeShare(5))
      .to.be.revertedWithCustomError(env.burner, "OwnableUnauthorizedAccount")
      .withArgs(env.user.address);
  });

  it("Should allow owner to add a partner", async function () {
    await expect(env.burner.connect(env.owner).putPartner(env.referrer.address, 10))
      .to.emit(env.burner, "PartnerAdded")
      .withArgs(env.referrer.address);

    await expect(env.burner.connect(env.owner).putPartner(env.referrer.address, 10))
      .to.emit(env.burner, "PartnerFeeShareChanged")
      .withArgs(env.referrer.address, 10);

    expect(await env.burner.partners(env.referrer.address)).to.equal(10);
  });

  it("Should not allow non-owner to add a partner", async function () {
    await expect(env.burner.connect(env.user).putPartner(env.referrer.address, 10))
      .to.be.revertedWithCustomError(env.burner, "CallerNotAdminOrOwner")
      .withArgs(env.user.address);
  });

  it("Should allow owner to update partner fee share", async function () {
    // First add a partner
    await env.burner.connect(env.owner).putPartner(env.referrer.address, 10);
    
    // Then update fee share
    await expect(env.burner.connect(env.owner).putPartner(env.referrer.address, 15))
      .to.emit(env.burner, "PartnerFeeShareChanged")
      .withArgs(env.referrer.address, 15);

    expect(await env.burner.partners(env.referrer.address)).to.equal(15);
  });

  it("Should not allow non-owner to update partner fee share", async function () {
    await env.burner.connect(env.owner).putPartner(env.referrer.address, 10);
    
    await expect(env.burner.connect(env.user).putPartner(env.referrer.address, 15))
      .to.be.revertedWithCustomError(env.burner, "CallerNotAdminOrOwner")
      .withArgs(env.user.address);
  });

  it("Should allow owner to remove a partner", async function () {
    // First add a partner
    await env.burner.connect(env.owner).putPartner(env.referrer.address, 10);
    
    // Then remove partner
    await expect(env.burner.connect(env.owner).removePartner(env.referrer.address))
      .to.emit(env.burner, "PartnerRemoved")
      .withArgs(env.referrer.address);

    expect(await env.burner.partners(env.referrer.address)).to.equal(0);
  });

  it("Should not allow non-owner to remove a partner", async function () {
    await env.burner.connect(env.owner).putPartner(env.referrer.address, 10);
    
    await expect(env.burner.connect(env.user).removePartner(env.referrer.address))
      .to.be.revertedWithCustomError(env.burner, "OwnableUnauthorizedAccount")
      .withArgs(env.user.address);
  });

  it("Should allow owner to pause referral", async function () {
    await expect(env.burner.connect(env.owner).changePauseReferral())
      .to.emit(env.burner, "PauseReferralChanged")
      .withArgs(true);

    expect(await env.burner.pauseReferral()).to.equal(true);
  });

  it("Should not allow non-owner to pause referral", async function () {
    await expect(env.burner.connect(env.user).changePauseReferral())
      .to.be.revertedWithCustomError(env.burner, "OwnableUnauthorizedAccount")
      .withArgs(env.user.address);
  });

  it("Should allow user to become a paid referrer with the 30% tier", async function () {
    // Mint USDC for the user
    const usdcDecimals = BigInt(parseInt(await env.mockUSDC.decimals()));
    await env.mockUSDC.mint(env.user.address, 25n * 10n ** usdcDecimals);
    
    // Approve USDC for the burner contract
    await env.mockUSDC.connect(env.user).approve(await env.burner.getAddress(), 25n * 10n ** usdcDecimals);
    
    // Register as a paid referrer
    await expect(env.burner.connect(env.user).paidReferrer(25n * 10n ** usdcDecimals))
      .to.emit(env.burner, "PartnerAdded")
      .withArgs(env.user.address);
    
    expect(await env.burner.partners(env.user.address)).to.equal(6);
  });

  it("Should allow user to become a paid referrer with the 40% tier", async function () {
    // Mint USDC for the user
    const usdcDecimals = BigInt(parseInt(await env.mockUSDC.decimals()));
    await env.mockUSDC.mint(env.user.address, 50n * 10n ** usdcDecimals);
    
    // Approve USDC for the burner contract
    await env.mockUSDC.connect(env.user).approve(await env.burner.getAddress(), 50n * 10n ** usdcDecimals);
    
    // Register as a paid referrer
    await expect(env.burner.connect(env.user).paidReferrer(50n * 10n ** usdcDecimals))
      .to.emit(env.burner, "PartnerAdded")
      .withArgs(env.user.address);
    
    expect(await env.burner.partners(env.user.address)).to.equal(8);
  });

  it("Should allow user to become a paid referrer with the 50% tier", async function () {
    // Mint USDC for the user
    const usdcDecimals = BigInt(parseInt(await env.mockUSDC.decimals()));
    await env.mockUSDC.mint(env.user.address, 100n * 10n ** usdcDecimals);
    
    // Approve USDC for the burner contract
    await env.mockUSDC.connect(env.user).approve(await env.burner.getAddress(), 100n * 10n ** usdcDecimals);
    
    // Register as a paid referrer
    await expect(env.burner.connect(env.user).paidReferrer(100n * 10n ** usdcDecimals))
      .to.emit(env.burner, "PartnerAdded")
      .withArgs(env.user.address);
    
    expect(await env.burner.partners(env.user.address)).to.equal(10);
  });

  it("Should allow a 30% tier referrer to upgrade to 40% tier", async function () {
    // First become a 30% tier referrer
    const usdcDecimals = BigInt(parseInt(await env.mockUSDC.decimals()));
    await env.mockUSDC.mint(env.user.address, 25n * 10n ** usdcDecimals);
    await env.mockUSDC.connect(env.user).approve(await env.burner.getAddress(), 25n * 10n ** usdcDecimals);
    await env.burner.connect(env.user).paidReferrer(25n * 10n ** usdcDecimals);
    
    // Now upgrade to 40% tier
    await env.mockUSDC.mint(env.user.address, 25n * 10n ** usdcDecimals);
    await env.mockUSDC.connect(env.user).approve(await env.burner.getAddress(), 25n * 10n ** usdcDecimals);
    
    await expect(env.burner.connect(env.user).upgradeReferrer(25n * 10n ** usdcDecimals))
      .to.emit(env.burner, "PartnerFeeShareChanged")
      .withArgs(env.user.address, 8);
    
    expect(await env.burner.partners(env.user.address)).to.equal(8);
  });

  it("Should allow a 30% tier referrer to upgrade to 50% tier", async function () {
    // First become a 30% tier referrer
    const usdcDecimals = BigInt(parseInt(await env.mockUSDC.decimals()));
    await env.mockUSDC.mint(env.user.address, 25n * 10n ** usdcDecimals);
    await env.mockUSDC.connect(env.user).approve(await env.burner.getAddress(), 25n * 10n ** usdcDecimals);
    await env.burner.connect(env.user).paidReferrer(25n * 10n ** usdcDecimals);
    
    // Now upgrade to 50% tier
    await env.mockUSDC.mint(env.user.address, 75n * 10n ** usdcDecimals);
    await env.mockUSDC.connect(env.user).approve(await env.burner.getAddress(), 75n * 10n ** usdcDecimals);
    
    await expect(env.burner.connect(env.user).upgradeReferrer(75n * 10n ** usdcDecimals))
      .to.emit(env.burner, "PartnerFeeShareChanged")
      .withArgs(env.user.address, 10);
    
    expect(await env.burner.partners(env.user.address)).to.equal(10);
  });

  it("Should allow a 40% tier referrer to upgrade to 50% tier", async function () {
    // First become a 40% tier referrer
    const usdcDecimals = BigInt(parseInt(await env.mockUSDC.decimals()));
    await env.mockUSDC.mint(env.user.address, 50n * 10n ** usdcDecimals);
    await env.mockUSDC.connect(env.user).approve(await env.burner.getAddress(), 50n * 10n ** usdcDecimals);
    await env.burner.connect(env.user).paidReferrer(50n * 10n ** usdcDecimals);
    
    // Now upgrade to 50% tier
    await env.mockUSDC.mint(env.user.address, 50n * 10n ** usdcDecimals);
    await env.mockUSDC.connect(env.user).approve(await env.burner.getAddress(), 50n * 10n ** usdcDecimals);
    
    await expect(env.burner.connect(env.user).upgradeReferrer(50n * 10n ** usdcDecimals))
      .to.emit(env.burner, "PartnerFeeShareChanged")
      .withArgs(env.user.address, 10);
    
    expect(await env.burner.partners(env.user.address)).to.equal(10);
  });

  it("Should not allow user to become a paid referrer when referral is paused", async function () {
    const usdcDecimals = BigInt(parseInt(await env.mockUSDC.decimals()));
    await env.burner.connect(env.owner).changePauseReferral();
    await expect(env.burner.connect(env.user).paidReferrer(100n * 10n ** usdcDecimals))
      .to.be.revertedWithCustomError(env.burner, "ReferralPaused");
  });

  it("Should not allow user to become a paid referrer when contract is paused", async function () {
    const usdcDecimals = BigInt(parseInt(await env.mockUSDC.decimals()));
    await env.burner.connect(env.owner).pause();
    await expect(env.burner.connect(env.user).paidReferrer(100n * 10n ** usdcDecimals))
      .to.be.revertedWithCustomError(env.burner, "EnforcedPause");
  });

  it("Should not allow user to upgradeReferrer when referral is paused", async function () {
    // First become a 30% tier referrer
    const usdcDecimals = BigInt(parseInt(await env.mockUSDC.decimals()));
    await env.mockUSDC.mint(env.user.address, 25n * 10n ** usdcDecimals);
    await env.mockUSDC.connect(env.user).approve(await env.burner.getAddress(), 25n * 10n ** usdcDecimals);
    await env.burner.connect(env.user).paidReferrer(25n * 10n ** usdcDecimals);
    
    // Now upgrade to 40% tier
    await env.burner.connect(env.owner).changePauseReferral();

    await env.mockUSDC.mint(env.user.address, 25n * 10n ** usdcDecimals);
    await env.mockUSDC.connect(env.user).approve(await env.burner.getAddress(), 25n * 10n ** usdcDecimals);
    
    await expect(env.burner.connect(env.user).upgradeReferrer(25n * 10n ** usdcDecimals))
    .to.be.revertedWithCustomError(env.burner, "ReferralPaused");
  });

  it("Should not allow user to upgradeReferrer when contract is paused", async function () {
    // First become a 30% tier referrer
    const usdcDecimals = BigInt(parseInt(await env.mockUSDC.decimals()));
    await env.mockUSDC.mint(env.user.address, 25n * 10n ** usdcDecimals);
    await env.mockUSDC.connect(env.user).approve(await env.burner.getAddress(), 25n * 10n ** usdcDecimals);
    await env.burner.connect(env.user).paidReferrer(25n * 10n ** usdcDecimals);
    
    // Now upgrade to 40% tier
    await env.burner.connect(env.owner).pause();

    await env.mockUSDC.mint(env.user.address, 25n * 10n ** usdcDecimals);
    await env.mockUSDC.connect(env.user).approve(await env.burner.getAddress(), 25n * 10n ** usdcDecimals);
    
    await expect(env.burner.connect(env.user).upgradeReferrer(25n * 10n ** usdcDecimals))
    .to.be.revertedWithCustomError(env.burner, "EnforcedPause");
  });

  it("Should not allow owner to add a partner when referral is paused", async function () {
    await env.burner.connect(env.owner).changePauseReferral();
    await expect(env.burner.connect(env.owner).putPartner(env.referrer.address, 10))
      .to.be.revertedWithCustomError(env.burner, "ReferralPaused");
  });

  it("Should not allow owner to add a partner when contract is paused", async function () {
    await env.burner.connect(env.owner).pause();
    await expect(env.burner.connect(env.owner).putPartner(env.referrer.address, 10))
      .to.be.revertedWithCustomError(env.burner, "EnforcedPause");
  });
  
});




