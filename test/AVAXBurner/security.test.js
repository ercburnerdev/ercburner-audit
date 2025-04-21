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
          "0x0000000000000000000000000000000000000000",
          BigInt(Math.floor(Date.now() / 1000) + 100000)
       )
      ).to.be.revertedWithCustomError(env.burner, "ReentrancyGuardReentrantCall");
    });
  });

  describe("Failed Swap and Revoke Handling", function () {
    let mockTokenRevertApproveZero;
    const swapAmount = ethers.parseEther("100");

    beforeEach(async function () {
      // Deploy the mock token
      const MockTokenRevertApproveZero = await ethers.getContractFactory("MockTokenRevertApproveZero");
      mockTokenRevertApproveZero = await MockTokenRevertApproveZero.deploy("Mock Revert", "MKRV");
      await mockTokenRevertApproveZero.waitForDeployment();

      // Mint tokens to the user and approve burner
      await mockTokenRevertApproveZero.mint(env.user.address, swapAmount);
      await mockTokenRevertApproveZero.connect(env.user).approve(await env.burner.getAddress(), swapAmount);
    });

    it("should emit SwapFailed with 'Router error + Revoke failure' and return tokens when revoke(0) fails", async function () {
      const path = {
        tokenPath: [await mockTokenRevertApproveZero.getAddress(), await env.mockWNATIVE.getAddress()],
        pairBinSteps: [20], // Example bin step, adjust if needed for specific V2 pairs
        versions: [2] // Assuming a V2 swap via Universal Router based on other tests
      };

      // Prepare swap params with an impossibly high amountOutMinimum to force router failure
      const swap = createSwapParams(
        await mockTokenRevertApproveZero.getAddress(),
        swapAmount,
        ethers.MaxUint256, // Force router failure
        await env.user.getAddress(), // recipient is user
        path
      );
      
      const userBalanceBefore = await mockTokenRevertApproveZero.balanceOf(env.user.address);
      expect(userBalanceBefore).to.equal(swapAmount); // Make sure user has tokens

      const tx = await env.burner.connect(env.user).swapExactInputMultiple([swap],
        "0x0000000000000000000000000000000000000000", // refund native to user
        false, // unwrap = false
        "0x", // Permit data
        "0x0000000000000000000000000000000000000000", // fee recipient
        BigInt(Math.floor(Date.now() / 1000) + 100000) // deadline
      );

      // Check for the specific failure event
      await expect(tx)
        .to.emit(env.burner, "SwapFailed")
        .withArgs(
          env.user.address,
          await mockTokenRevertApproveZero.getAddress(),
          swapAmount,
          "Router error + Revoke failure" // Expected reason
        );
        
      // Check that tokens were returned to the user
      const userBalanceAfter = await mockTokenRevertApproveZero.balanceOf(env.user.address);
      expect(userBalanceAfter).to.equal(userBalanceBefore); // Balance should be restored
      
      // Check burner balance is zero
      const burnerBalance = await mockTokenRevertApproveZero.balanceOf(await env.burner.getAddress());
       expect(burnerBalance).to.equal(0);

      // Check allowance was not revoked (because revoke failed)
      const allowance = await mockTokenRevertApproveZero.allowance(await env.burner.getAddress(), env.mockLBRouter.getAddress());
      expect(allowance).to.equal(swapAmount); 
    });
  });
});