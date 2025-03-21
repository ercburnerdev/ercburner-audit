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
    await env.mockUSDC.mint(env.user.address, 25 * 10 ** 6);
    
    // Approve USDC for the burner contract
    await env.mockUSDC.connect(env.user).approve(await env.burner.getAddress(), 25 * 10 ** 6);
    
    // Register as a paid referrer
    await expect(env.burner.connect(env.user).paidReferrer(25 * 10 ** 6))
      .to.emit(env.burner, "PartnerAdded")
      .withArgs(env.user.address);
    
    expect(await env.burner.partners(env.user.address)).to.equal(6);
  });

  it("Should allow user to become a paid referrer with the 40% tier", async function () {
    // Mint USDC for the user
    await env.mockUSDC.mint(env.user.address, 50 * 10 ** 6);
    
    // Approve USDC for the burner contract
    await env.mockUSDC.connect(env.user).approve(await env.burner.getAddress(), 50 * 10 ** 6);
    
    // Register as a paid referrer
    await expect(env.burner.connect(env.user).paidReferrer(50 * 10 ** 6))
      .to.emit(env.burner, "PartnerAdded")
      .withArgs(env.user.address);
    
    expect(await env.burner.partners(env.user.address)).to.equal(8);
  });

  it("Should allow user to become a paid referrer with the 50% tier", async function () {
    // Mint USDC for the user
    await env.mockUSDC.mint(env.user.address, 100 * 10 ** 6);
    
    // Approve USDC for the burner contract
    await env.mockUSDC.connect(env.user).approve(await env.burner.getAddress(), 100 * 10 ** 6);
    
    // Register as a paid referrer
    await expect(env.burner.connect(env.user).paidReferrer(100 * 10 ** 6))
      .to.emit(env.burner, "PartnerAdded")
      .withArgs(env.user.address);
    
    expect(await env.burner.partners(env.user.address)).to.equal(10);
  });

  it("Should allow a 30% tier referrer to upgrade to 40% tier", async function () {
    // First become a 30% tier referrer
    await env.mockUSDC.mint(env.user.address, 25 * 10 ** 6);
    await env.mockUSDC.connect(env.user).approve(await env.burner.getAddress(), 25 * 10 ** 6);
    await env.burner.connect(env.user).paidReferrer(25 * 10 ** 6);
    
    // Now upgrade to 40% tier
    await env.mockUSDC.mint(env.user.address, 25 * 10 ** 6);
    await env.mockUSDC.connect(env.user).approve(await env.burner.getAddress(), 25 * 10 ** 6);
    
    await expect(env.burner.connect(env.user).upgradeReferrer(25 * 10 ** 6))
      .to.emit(env.burner, "PartnerFeeShareChanged")
      .withArgs(env.user.address, 8);
    
    expect(await env.burner.partners(env.user.address)).to.equal(8);
  });

  it("Should allow a 30% tier referrer to upgrade to 50% tier", async function () {
    // First become a 30% tier referrer
    await env.mockUSDC.mint(env.user.address, 25 * 10 ** 6);
    await env.mockUSDC.connect(env.user).approve(await env.burner.getAddress(), 25 * 10 ** 6);
    await env.burner.connect(env.user).paidReferrer(25 * 10 ** 6);
    
    // Now upgrade to 50% tier
    await env.mockUSDC.mint(env.user.address, 75 * 10 ** 6);
    await env.mockUSDC.connect(env.user).approve(await env.burner.getAddress(), 75 * 10 ** 6);
    
    await expect(env.burner.connect(env.user).upgradeReferrer(75 * 10 ** 6))
      .to.emit(env.burner, "PartnerFeeShareChanged")
      .withArgs(env.user.address, 10);
    
    expect(await env.burner.partners(env.user.address)).to.equal(10);
  });

  it("Should allow a 40% tier referrer to upgrade to 50% tier", async function () {
    // First become a 40% tier referrer
    await env.mockUSDC.mint(env.user.address, 50 * 10 ** 6);
    await env.mockUSDC.connect(env.user).approve(await env.burner.getAddress(), 50 * 10 ** 6);
    await env.burner.connect(env.user).paidReferrer(50 * 10 ** 6);
    
    // Now upgrade to 50% tier
    await env.mockUSDC.mint(env.user.address, 50 * 10 ** 6);
    await env.mockUSDC.connect(env.user).approve(await env.burner.getAddress(), 50 * 10 ** 6);
    
    await expect(env.burner.connect(env.user).upgradeReferrer(50 * 10 ** 6))
      .to.emit(env.burner, "PartnerFeeShareChanged")
      .withArgs(env.user.address, 10);
    
    expect(await env.burner.partners(env.user.address)).to.equal(10);
  });
}); 