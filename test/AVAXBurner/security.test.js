const { expect } = require("chai");
const { deployTestEnvironment } = require("./setup");
const { createSwapParams } = require("./utils/prepareSwaps");

describe("Burner - Security Tests", function () {
  let env;
  let maliciousTokenReentrancy;

  beforeEach(async function () {
    env = await deployTestEnvironment();
    
    // Deploy malicious token that attempts reentrancy
    const MaliciousTokenReentrancy = await ethers.getContractFactory("MaliciousTokenReentrancyAvax");
    maliciousTokenReentrancy = await MaliciousTokenReentrancy.deploy(await env.burner.getAddress());
    await maliciousTokenReentrancy.waitForDeployment();
  });

  describe("Reentrancy Protection", function () {
    it("should prevent reentrancy in swapExactInputMultiple", async function () {
      const path = {
        tokenPath: [await maliciousTokenReentrancy.getAddress(), await env.mockWNATIVE.getAddress()],
        pairBinSteps: [20],
        versions: [2]
    };

      // Prepare swap params
      const swap = createSwapParams(
        await maliciousTokenReentrancy.getAddress(),
        ethers.parseEther("100"),
        ethers.parseEther("0"),
        await env.burner.getAddress(),
        path
      );

      // Attempt reentrancy attack
      await expect(
        env.burner.swapExactInputMultiple([swap],
          "0x0000000000000000000000000000000000000000",
          false,
          "0x", 
          "0x0000000000000000000000000000000000000000"
       )
      ).to.be.revertedWithCustomError(env.burner, "ReentrancyGuardReentrantCall");
    });
  });
});