const { expect } = require("chai");
const { deployTestEnvironment } = require("./setup");

describe("Burner - Deployment", function () {
  let env;

  beforeEach(async function () {
    env = await deployTestEnvironment();
  });

  it("Should deploy with correct owner", async function () {
    expect(await env.burner.owner()).to.equal(env.owner.address);
  });

  it("Should deploy with correct fee collector", async function () {
    expect(await env.burner.feeCollector()).to.equal(env.feeCollector.address);
  });

  it("Should deploy with correct burn fee divisor", async function () {
    expect(await env.burner.burnFeeDivisor()).to.equal(40);
  });

  it("Should deploy with correct native sent fee divisor", async function () {
    expect(await env.burner.nativeSentFeeDivisor()).to.equal(400);
  });

  it("Should deploy with correct referrer fee share", async function () {
    expect(await env.burner.referrerFeeShare()).to.equal(4);
  });


  it("Should deploy with correct max tokens per burn", async function () {
    expect(await env.burner.maxTokensPerBurn()).to.equal(50);
  });
  
  it("Should deploy with correct min gas left", async function () {
    expect(await env.burner.minGasLeft()).to.equal(100000);
  });
  
  it("Should deploy with pauseBridge set to false", async function () {
    expect(await env.burner.pauseBridge()).to.equal(false);
  });

  it("Should deploy with correct pauseReferral set to false", async function () {
    expect(await env.burner.pauseReferral()).to.equal(false);
  });

  it("Should deploy with correct WNATIVE address", async function () {
    expect(await env.burner.WNATIVE()).to.equal(await env.mockWNATIVE.getAddress());
  });
});