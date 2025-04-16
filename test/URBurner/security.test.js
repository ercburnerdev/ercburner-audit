const { expect } = require("chai");
const { deployTestEnvironment } = require("./setup");
const { prepareSwapExactInput, encodePath } = require("./utils/prepareSwaps");

describe("Burner - Security Tests", function () {
  let env;
  let maliciousTokenReentrancy;

  beforeEach(async function () {
    env = await deployTestEnvironment();
    
    // Deploy malicious token that attempts reentrancy
    const MaliciousTokenReentrancy = await ethers.getContractFactory("MaliciousTokenReentrancy");
    maliciousTokenReentrancy = await MaliciousTokenReentrancy.deploy(await env.burner.getAddress());
    await maliciousTokenReentrancy.waitForDeployment();
  });

  describe("Reentrancy Protection", function () {
    it("should prevent reentrancy in swapExactInputMultiple", async function () {
      const encodedPath = encodePath(
        "0x00", 
        [await maliciousTokenReentrancy.getAddress(), await env.mockWNATIVE.getAddress()], 
        [3000]
      );

      // Prepare swap params
      const swap = prepareSwapExactInput(
        "0x00",
        await env.burner.getAddress(),
        await maliciousTokenReentrancy.getAddress(),
        ethers.parseEther("100"),
        ethers.parseEther("0"),
        encodedPath,
        false,
        env.user.address,
        Math.floor(Date.now() / 1000) + 3600
      );

      // Attempt reentrancy attack
      await expect(
        env.burner.connect(env.user).swapExactInputMultiple([swap],
          "0x0000000000000000000000000000000000000000",
          false,
          "0x", 
          "0x0000000000000000000000000000000000000000"
       )
      ).to.be.revertedWithCustomError(env.burner, "ReentrancyGuardReentrantCall");
    });
  });
});