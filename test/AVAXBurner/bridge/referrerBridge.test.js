const { expect } = require("chai");
const { deployTestEnvironment } = require("../setup");
const { getSwapParamsV3, getSwapParamsV2, getSwapParamsWNATIVE } = require("../utils/getSwapParams");
const { ethers } = require("hardhat");

describe("Burner - Bridge with Referrer", function () {
  let env;

  beforeEach(async function () {
    env = await deployTestEnvironment();
  });

  it("Should properly handle bridge transaction with regular token swap and referrer", async function () {
    // Prepare a bridge call data
    const bridgeData = ethers.keccak256(ethers.toUtf8Bytes("bridge_data"));
    
    const swap = await getSwapParamsV3(env);

    const swapParams = [{
      tokenIn: swap.swapParams.tokenIn,
      amountIn: swap.swapParams.amountIn,
      amountOutMinimum: swap.swapParams.amountOutMinimum,
      path: swap.swapParams.path
    }];

    // Track contract balances before swap
    const mockSolverBalance = await ethers.provider.getBalance(env.solver.address);
    const feeCollectorBalance = await ethers.provider.getBalance(env.feeCollector.address);
    const referrerBalance = await ethers.provider.getBalance(env.referrer.address);

    // Execute swap with bridge and referrer
    const tx = await env.burner.connect(env.user).swapExactInputMultiple(
      swapParams,
      "0x0000000000000000000000000000000000000000", // no recipient (using bridge)
      true, // bridge = true
      bridgeData,
      env.referrer.address, // referrer
      {value: ethers.parseEther("0.1")} // Add ETH for bridge fee
    );

    // Check event emission for bridge
    await expect(tx)
      .to.emit(env.burner, "BridgeSuccess")
      .withArgs(
        env.user.address,
        bridgeData, // Return data from mock receiver
        ethers.parseEther("0.975") + ethers.parseEther("0.09975"), // 97.5% of swap amount + 99.75% of direct ETH
        ethers.parseEther("0.025") + ethers.parseEther("0.00025")  // 2.5% of swap fee + 0.25% of bridge fee
      );

    // Check event emission for referrer fee
    await expect(tx)
      .to.emit(env.burner, "ReferrerFeePaid")
      .withArgs(
        env.user.address, 
        env.referrer.address, 
        ethers.parseEther("0.005") + ethers.parseEther("0.00005")  // 20% of swap fee + 20% of bridge fee
      );

    // Check final ETH balances
    const mockSolverBalanceAfter = await ethers.provider.getBalance(env.solver.address);
    const feeCollectorBalanceAfter = await ethers.provider.getBalance(env.feeCollector.address);
    const referrerBalanceAfter = await ethers.provider.getBalance(env.referrer.address);

    // Calculate expected values
    // From swap: 1 ETH, 2.5% fee = 0.025 ETH, user gets 0.975 ETH
    // From direct ETH: 0.1 ETH, 0.25% fee = 0.00025 ETH, user gets 0.09975 ETH
    // Total to bridge: 0.975 + 0.09975 = 1.07475 ETH
    // Total fee: 0.025 + 0.00025 = 0.02525 ETH
    // Referrer gets 20% of fees: 0.005 + 0.00005 = 0.00505 ETH
    // Fee collector gets 80% of fees: 0.02 + 0.0002 = 0.0202 ETH
    const expectedMockSolverBalance = mockSolverBalance + ethers.parseEther("1.07475");
    const expectedFeeCollectorBalance = feeCollectorBalance + ethers.parseEther("0.0202");
    const expectedReferrerBalance = referrerBalance + ethers.parseEther("0.00505");

    expect(mockSolverBalanceAfter).to.equal(expectedMockSolverBalance);
    expect(feeCollectorBalanceAfter).to.equal(expectedFeeCollectorBalance);
    expect(referrerBalanceAfter).to.equal(expectedReferrerBalance);
  });

  it("Should properly handle bridge transaction with WNATIVE token and referrer", async function () {
    // Prepare a bridge call data
    const bridgeData = ethers.keccak256(ethers.toUtf8Bytes("bridge_data"));
    
    const swap = await getSwapParamsWNATIVE(env);

    const swapParams = [{
      tokenIn: swap.swapParams.tokenIn, // WNATIVE
      amountIn: swap.swapParams.amountIn,
      amountOutMinimum: swap.swapParams.amountOutMinimum,
      path: swap.swapParams.path
    }];

    // Track contract balances before swap
    const mockSolverBalance = await ethers.provider.getBalance(env.solver.address);
    const feeCollectorBalance = await ethers.provider.getBalance(env.feeCollector.address);
    const referrerBalance = await ethers.provider.getBalance(env.referrer.address);

    // Execute swap with bridge and referrer
    const tx = await env.burner.connect(env.user).swapExactInputMultiple(
      swapParams,
      "0x0000000000000000000000000000000000000000", // no recipient (using bridge)
      true, // bridge = true
      bridgeData,
      env.referrer.address, // referrer
      {value: ethers.parseEther("0.1")} // Add ETH for bridge fee
    );

    // Check event emission for bridge
    await expect(tx)
      .to.emit(env.burner, "BridgeSuccess")
      .withArgs(
        env.user.address,
        bridgeData, // Return data from mock receiver
        ethers.parseEther("0.975") + ethers.parseEther("0.09975"), // 97.5% of swap amount + 99.75% of direct ETH
        ethers.parseEther("0.025") + ethers.parseEther("0.00025")  // 2.5% of swap fee + 0.25% of bridge fee
      );

    // Check event emission for referrer fee
    await expect(tx)
      .to.emit(env.burner, "ReferrerFeePaid")
      .withArgs(
        env.user.address, 
        env.referrer.address, 
        ethers.parseEther("0.005") + ethers.parseEther("0.00005")  // 20% of swap fee + 20% of bridge fee
      );

    // Check final ETH balances
    const mockSolverBalanceAfter = await ethers.provider.getBalance(env.solver.address);
    const feeCollectorBalanceAfter = await ethers.provider.getBalance(env.feeCollector.address);
    const referrerBalanceAfter = await ethers.provider.getBalance(env.referrer.address);

    // Calculate expected values
    // From swap: 1 ETH, 2.5% fee = 0.025 ETH, user gets 0.975 ETH
    // From direct ETH: 0.1 ETH, 0.25% fee = 0.00025 ETH, user gets 0.09975 ETH
    // Total to bridge: 0.975 + 0.09975 = 1.07475 ETH
    // Total fee: 0.025 + 0.00025 = 0.02525 ETH
    // Referrer gets 20% of fees: 0.005 + 0.00005 = 0.00505 ETH
    // Fee collector gets 80% of fees: 0.02 + 0.0002 = 0.0202 ETH
    const expectedMockSolverBalance = mockSolverBalance + ethers.parseEther("1.07475");
    const expectedFeeCollectorBalance = feeCollectorBalance + ethers.parseEther("0.0202");
    const expectedReferrerBalance = referrerBalance + ethers.parseEther("0.00505");

    expect(mockSolverBalanceAfter).to.equal(expectedMockSolverBalance);
    expect(feeCollectorBalanceAfter).to.equal(expectedFeeCollectorBalance);
    expect(referrerBalanceAfter).to.equal(expectedReferrerBalance);
  });

  it("Should properly handle bridge transaction with multiple token swaps and referrer", async function () {
    // Prepare a bridge call data
    const bridgeData = ethers.keccak256(ethers.toUtf8Bytes("bridge_data"));
    
    let swap1 = await getSwapParamsV3(env);
    let swap2 = await getSwapParamsV2(env);

    const swapParams = [
      {
        tokenIn: swap1.swapParams.tokenIn,
        amountIn: swap1.swapParams.amountIn,
        amountOutMinimum: swap1.swapParams.amountOutMinimum,
        path: swap1.swapParams.path
      },
      {
        tokenIn: swap2.swapParams.tokenIn,
        amountIn: swap2.swapParams.amountIn,
        amountOutMinimum: swap2.swapParams.amountOutMinimum,
        path: swap2.swapParams.path
      }
    ];

    // Mock router to return 0.5 ETH for each swap for a total of 1 ETH
    await env.mockLBRouter.setReturnAmount(ethers.parseEther("0.5"));

    // Track contract balances before swap
    const mockSolverBalance = await ethers.provider.getBalance(env.solver.address);
    const feeCollectorBalance = await ethers.provider.getBalance(env.feeCollector.address);
    const referrerBalance = await ethers.provider.getBalance(env.referrer.address);

    // Execute swap with bridge and referrer
    const tx = await env.burner.connect(env.user).swapExactInputMultiple(
      swapParams,
      "0x0000000000000000000000000000000000000000", // no recipient (using bridge)
      true, // bridge = true
      bridgeData,
      env.referrer.address, // referrer
      {value: ethers.parseEther("0.1")} // Add ETH for bridge fee
    );

    // Check event emission for bridge
    await expect(tx)
      .to.emit(env.burner, "BridgeSuccess")
      .withArgs(
        env.user.address,
        bridgeData, // Return data from mock receiver
        ethers.parseEther("0.975") + ethers.parseEther("0.09975"), // 97.5% of swap amount + 99.75% of direct ETH
        ethers.parseEther("0.025") + ethers.parseEther("0.00025")  // 2.5% of swap fee + 0.25% of bridge fee
      );

    // Check event emission for referrer fee
    await expect(tx)
      .to.emit(env.burner, "ReferrerFeePaid")
      .withArgs(
        env.user.address, 
        env.referrer.address, 
        ethers.parseEther("0.005") + ethers.parseEther("0.00005")  // 20% of swap fee + 20% of bridge fee
      );

    // Check final ETH balances
    const mockSolverBalanceAfter = await ethers.provider.getBalance(env.solver.address);
    const feeCollectorBalanceAfter = await ethers.provider.getBalance(env.feeCollector.address);
    const referrerBalanceAfter = await ethers.provider.getBalance(env.referrer.address);

    // Calculate expected values
    // From swap: 1 ETH (0.5 ETH each), 2.5% fee = 0.025 ETH, user gets 0.975 ETH
    // From direct ETH: 0.1 ETH, 0.25% fee = 0.00025 ETH, user gets 0.09975 ETH
    // Total to bridge: 0.975 + 0.09975 = 1.07475 ETH
    // Total fee: 0.025 + 0.00025 = 0.02525 ETH
    // Referrer gets 20% of fees: 0.005 + 0.00005 = 0.00505 ETH
    // Fee collector gets 80% of fees: 0.02 + 0.0002 = 0.0202 ETH
    const expectedMockSolverBalance = mockSolverBalance + ethers.parseEther("1.07475");
    const expectedFeeCollectorBalance = feeCollectorBalance + ethers.parseEther("0.0202");
    const expectedReferrerBalance = referrerBalance + ethers.parseEther("0.00505");

    expect(mockSolverBalanceAfter).to.equal(expectedMockSolverBalance);
    expect(feeCollectorBalanceAfter).to.equal(expectedFeeCollectorBalance);
    expect(referrerBalanceAfter).to.equal(expectedReferrerBalance);
  });

  it("Should properly handle direct bridge transaction with no swaps and referrer", async function () {
    // Prepare a bridge call data
    const bridgeData = ethers.keccak256(ethers.toUtf8Bytes("bridge_data"));
    
    // Empty swap params array (no swaps)
    const swapParams = [];

    // Track contract balances before swap
    const mockSolverBalance = await ethers.provider.getBalance(env.solver.address);
    const feeCollectorBalance = await ethers.provider.getBalance(env.feeCollector.address);
    const referrerBalance = await ethers.provider.getBalance(env.referrer.address);

    // Execute with bridge only (no swaps) with referrer
    const tx = await env.burner.connect(env.user).relayBridge(
      bridgeData,
      env.referrer.address, // referrer
      {value: ethers.parseEther("1.0")} // Direct bridge with 1 ETH
    );

    // Check event emission for bridge
    await expect(tx)
      .to.emit(env.burner, "BridgeSuccess")
      .withArgs(
        env.user.address,
        bridgeData, // Return data from mock receiver
        ethers.parseEther("0.9975"), // 99.75% of 1 ETH
        ethers.parseEther("0.0025")  // 0.25% of 1 ETH
      );

    // Check event emission for referrer fee
    await expect(tx)
      .to.emit(env.burner, "ReferrerFeePaid")
      .withArgs(
        env.user.address, 
        env.referrer.address, 
        ethers.parseEther("0.0005")  // 20% of 0.25% bridge fee
      );

    // Check final ETH balances
    const mockSolverBalanceAfter = await ethers.provider.getBalance(env.solver.address);
    const feeCollectorBalanceAfter = await ethers.provider.getBalance(env.feeCollector.address);
    const referrerBalanceAfter = await ethers.provider.getBalance(env.referrer.address);

    // Calculate expected values
    // From direct ETH: 1 ETH, 0.25% fee = 0.0025 ETH, to bridge: 0.9975 ETH
    // Referrer gets 20% of fees: 0.0005 ETH
    // Fee collector gets 80% of fees: 0.002 ETH
    const expectedMockSolverBalance = mockSolverBalance + ethers.parseEther("0.9975");
    const expectedFeeCollectorBalance = feeCollectorBalance + ethers.parseEther("0.002");
    const expectedReferrerBalance = referrerBalance + ethers.parseEther("0.0005");

    expect(mockSolverBalanceAfter).to.equal(expectedMockSolverBalance);
    expect(feeCollectorBalanceAfter).to.equal(expectedFeeCollectorBalance);
    expect(referrerBalanceAfter).to.equal(expectedReferrerBalance);
  });

  it("Should properly handle relayBridge by owner with referrer", async function () {
    // Prepare a bridge call data
    const bridgeData = ethers.keccak256(ethers.toUtf8Bytes("bridge_data"));
    
    // Track contract balances before relay
    const mockSolverBalance = await ethers.provider.getBalance(env.solver.address);
    const feeCollectorBalance = await ethers.provider.getBalance(env.feeCollector.address);
    const referrerBalance = await ethers.provider.getBalance(env.referrer.address);

    // Call relayBridge with referrer
    const tx = await env.burner.connect(env.user).relayBridge(
      bridgeData,
      env.referrer.address, // Referrer
      { value: ethers.parseEther("1.0") }
    );

    // Check event emission for bridge
    await expect(tx)
      .to.emit(env.burner, "BridgeSuccess")
      .withArgs(
        env.user.address,
        bridgeData, // Return data from mock receiver
        ethers.parseEther("0.9975"), // 99.75% of 1 ETH
        ethers.parseEther("0.0025")  // 0.25% of 1 ETH
      );

    // Check event emission for referrer fee
    await expect(tx)
      .to.emit(env.burner, "ReferrerFeePaid")
      .withArgs(
        env.user.address, 
        env.referrer.address, 
        ethers.parseEther("0.0005")  // 20% of 0.25% bridge fee
      );

    // Check final ETH balances
    const mockSolverBalanceAfter = await ethers.provider.getBalance(env.solver.address);
    const feeCollectorBalanceAfter = await ethers.provider.getBalance(env.feeCollector.address);
    const referrerBalanceAfter = await ethers.provider.getBalance(env.referrer.address);

    // Calculate expected values
    // From direct ETH: 1 ETH, 0.25% fee = 0.0025 ETH, to bridge: 0.9975 ETH
    // Referrer gets 20% of fees: 0.0005 ETH
    // Fee collector gets 80% of fees: 0.002 ETH
    const expectedMockSolverBalance = mockSolverBalance + ethers.parseEther("0.9975");
    const expectedFeeCollectorBalance = feeCollectorBalance + ethers.parseEther("0.002");
    const expectedReferrerBalance = referrerBalance + ethers.parseEther("0.0005");

    expect(mockSolverBalanceAfter).to.equal(expectedMockSolverBalance);
    expect(feeCollectorBalanceAfter).to.equal(expectedFeeCollectorBalance);
    expect(referrerBalanceAfter).to.equal(expectedReferrerBalance);
  });

  // Additional tests for complex scenarios without referrers

  it("Should handle bridge with mixed token types (ERC20 + WNATIVE) and referrer", async function () {
    // Prepare bridge data
    const bridgeData = ethers.keccak256(ethers.toUtf8Bytes("bridge_data"));
    
    // Get swap params for regular token and WNATIVE
    const swap1 = await getSwapParamsV3(env);
    const swap2 = await getSwapParamsWNATIVE(env);

    const swapParams = [
      {
        tokenIn: swap1.swapParams.tokenIn,
        amountIn: swap1.swapParams.amountIn,
        amountOutMinimum: swap1.swapParams.amountOutMinimum,
        path: swap1.swapParams.path
      },
      {
        tokenIn: swap2.swapParams.tokenIn,
        amountIn: swap2.swapParams.amountIn,
        amountOutMinimum: swap2.swapParams.amountOutMinimum,
        path: swap2.swapParams.path
      }
    ];

    // Mock router to return specific amounts
    await env.mockLBRouter.setReturnAmount(ethers.parseEther("0.5"));

    // Track balances
    const mockSolverBalance = await ethers.provider.getBalance(env.solver.address);
    const feeCollectorBalance = await ethers.provider.getBalance(env.feeCollector.address);
    const referrerBalance = await ethers.provider.getBalance(env.referrer.address);

    // Execute transaction with referrer
    const tx = await env.burner.connect(env.user).swapExactInputMultiple(
      swapParams,
      "0x0000000000000000000000000000000000000000",
      true,
      bridgeData,
      env.referrer.address, // referrer
      {value: ethers.parseEther("0.2")}
    );

    // Calculate expected values:
    // - 0.5 ETH from first swap (standard token)
    // - 1 ETH from second swap (WNATIVE)
    // - 0.2 ETH direct value
    // - Total: 1.7 ETH
    // - Swap fee (2.5%): 0.0375 ETH (only applied to 1.5 ETH from swaps)
    // - Bridge fee (0.25%): 0.0005 ETH (only applied to 0.2 ETH direct value)
    // - Total fees: 0.038 ETH
    // - Referrer gets 20% of fees: 0.0076 ETH (0.0075 + 0.0001)
    // - Fee collector gets 80% of fees: 0.0304 ETH (0.03 + 0.0004)
    // - Total to bridge: 1.7 - 0.038 = 1.662 ETH

    // Check event for bridge
    await expect(tx)
      .to.emit(env.burner, "BridgeSuccess")
      .withArgs(
        env.user.address,
        bridgeData,
        ethers.parseEther("1.662"), // 0.975 + 0.687 = 1.662 ETH
        ethers.parseEther("0.038")  // 0.0375 + 0.0005 = 0.038 ETH
      );

    // Check event for referrer fee
    await expect(tx)
      .to.emit(env.burner, "ReferrerFeePaid")
      .withArgs(
        env.user.address,
        env.referrer.address,
        ethers.parseEther("0.0076") // 20% of total fees (0.0075 + 0.0001)
      );

    // Check balances
    const mockSolverBalanceAfter = await ethers.provider.getBalance(env.solver.address);
    const feeCollectorBalanceAfter = await ethers.provider.getBalance(env.feeCollector.address);
    const referrerBalanceAfter = await ethers.provider.getBalance(env.referrer.address);

    const expectedMockSolverBalance = mockSolverBalance + ethers.parseEther("1.662");
    const expectedFeeCollectorBalance = feeCollectorBalance + ethers.parseEther("0.0304");
    const expectedReferrerBalance = referrerBalance + ethers.parseEther("0.0076");

    expect(mockSolverBalanceAfter).to.equal(expectedMockSolverBalance);
    expect(feeCollectorBalanceAfter).to.equal(expectedFeeCollectorBalance);
    expect(referrerBalanceAfter).to.equal(expectedReferrerBalance);
  });

  it("Should handle bridge with three different token types and referrer", async function () {
    const bridgeData = ethers.keccak256(ethers.toUtf8Bytes("bridge_data"));
    
    // Get swap params for three different tokens
    const swap1 = await getSwapParamsV3(env);
    const swap2 = await getSwapParamsV2(env);
    const swap3 = await getSwapParamsWNATIVE(env);

    const swapParams = [
      {
        tokenIn: swap1.swapParams.tokenIn,
        amountIn: swap1.swapParams.amountIn,
        amountOutMinimum: swap1.swapParams.amountOutMinimum,
        path: swap1.swapParams.path
      },
      {
        tokenIn: swap2.swapParams.tokenIn,
        amountIn: swap2.swapParams.amountIn,
        amountOutMinimum: swap2.swapParams.amountOutMinimum,
        path: swap2.swapParams.path
      },
      {
        tokenIn: swap3.swapParams.tokenIn,
        amountIn: swap3.swapParams.amountIn,
        amountOutMinimum: swap3.swapParams.amountOutMinimum,
        path: swap3.swapParams.path
      }
    ];

    // Mock router to return specific amounts (total: 1.5 ETH from swaps)
    await env.mockLBRouter.setReturnAmount(ethers.parseEther("0.5"));

    // Track balances
    const mockSolverBalance = await ethers.provider.getBalance(env.solver.address);
    const feeCollectorBalance = await ethers.provider.getBalance(env.feeCollector.address);
    const referrerBalance = await ethers.provider.getBalance(env.referrer.address);

    // Execute transaction with 0.5 ETH direct value and referrer
    const tx = await env.burner.connect(env.user).swapExactInputMultiple(
      swapParams,
      "0x0000000000000000000000000000000000000000",
      true,
      bridgeData,
      env.referrer.address, // referrer
      {value: ethers.parseEther("0.5")}
    );

    // Calculate expected values:
    // - 2 ETH from swaps (0.5 ETH x 2 + 1 ETH)
    // - 0.5 ETH direct value
    // - Total: 2.5 ETH
    // - Swap fee (2.5%): 0.05 ETH (applied to 2 ETH from swaps)
    // - Bridge fee (0.25%): 0.00125 ETH (applied to 0.5 ETH direct value)
    // - Total fees: 0.05125 ETH
    // - Referrer gets 20% of fees: 0.01025 ETH (0.01 + 0.00025)
    // - Fee collector gets 80% of fees: 0.041 ETH (0.04 + 0.001)
    // - Total to bridge: 2.5 - 0.05125 = 2.44875 ETH

    // Check event for bridge
    await expect(tx)
      .to.emit(env.burner, "BridgeSuccess")
      .withArgs(
        env.user.address,
        bridgeData,
        ethers.parseEther("2.44875"), // 1.95 + 0.49875 = 2.49875 ETH
        ethers.parseEther("0.05125")  // 0.05 + 0.00125 = 0.05125 ETH
      );

    // Check event for referrer fee
    await expect(tx)
      .to.emit(env.burner, "ReferrerFeePaid")
      .withArgs(
        env.user.address,
        env.referrer.address,
        ethers.parseEther("0.01025") // 20% of total fees (0.04 + 0.001)
      );

    // Check balances
    const mockSolverBalanceAfter = await ethers.provider.getBalance(env.solver.address);
    const feeCollectorBalanceAfter = await ethers.provider.getBalance(env.feeCollector.address);
    const referrerBalanceAfter = await ethers.provider.getBalance(env.referrer.address);

    const expectedMockSolverBalance = mockSolverBalance + ethers.parseEther("2.44875");
    const expectedFeeCollectorBalance = feeCollectorBalance + ethers.parseEther("0.041");
    const expectedReferrerBalance = referrerBalance + ethers.parseEther("0.01025");

    expect(mockSolverBalanceAfter).to.equal(expectedMockSolverBalance);
    expect(feeCollectorBalanceAfter).to.equal(expectedFeeCollectorBalance);
    expect(referrerBalanceAfter).to.equal(expectedReferrerBalance);
  });

  it("Should handle relayBridge with different ETH amounts and referrer", async function () {
    // Test with different ETH amounts to verify correct fee calculation
    const testAmounts = [
      ethers.parseEther("0.1"),    // Small amount
      ethers.parseEther("1.0"),    // Medium amount
      ethers.parseEther("10.0")    // Large amount
    ];
    
    const bridgeData = ethers.keccak256(ethers.toUtf8Bytes("bridge_data"));

    for (const amount of testAmounts) {
      // Track balances before transaction
      const mockSolverBalance = await ethers.provider.getBalance(env.solver.address);
      const feeCollectorBalance = await ethers.provider.getBalance(env.feeCollector.address);
      const referrerBalance = await ethers.provider.getBalance(env.referrer.address);
      
      // Calculate expected fee and amount after fee
      const expectedFee = amount * 25n / 10000n; // 0.25%
      const expectedAmount = amount - expectedFee;
      const expectedReferrerFee = expectedFee * 20n / 100n; // 20% of fee
      const expectedFeeCollectorFee = expectedFee * 80n / 100n; // 80% of fee
      
      // Execute transaction with referrer
      const tx = await env.burner.connect(env.user).relayBridge(
        bridgeData,
        env.referrer.address, // referrer
        { value: amount }
      );
      
      // Check event emission for bridge
      await expect(tx)
        .to.emit(env.burner, "BridgeSuccess")
        .withArgs(
          env.user.address,
          bridgeData,
          expectedAmount,
          expectedFee
        );

      // Check event emission for referrer fee
      await expect(tx)
        .to.emit(env.burner, "ReferrerFeePaid")
        .withArgs(
          env.user.address,
          env.referrer.address,
          expectedReferrerFee
        );
      
      // Check balances after transaction
      const mockSolverBalanceAfter = await ethers.provider.getBalance(env.solver.address);
      const feeCollectorBalanceAfter = await ethers.provider.getBalance(env.feeCollector.address);
      const referrerBalanceAfter = await ethers.provider.getBalance(env.referrer.address);
      
      expect(mockSolverBalanceAfter).to.equal(mockSolverBalance + expectedAmount);
      expect(feeCollectorBalanceAfter).to.equal(feeCollectorBalance + expectedFeeCollectorFee);
      expect(referrerBalanceAfter).to.equal(referrerBalance + expectedReferrerFee);
    }
  });

  it("Should handle edge case with very large ETH amounts and referrer", async function () {
    // Use a large amount to test for any potential overflow issues
    await ethers.provider.send("hardhat_setBalance", [
      env.user.address,
      ethers.toBeHex(ethers.parseEther("1000000000"))
    ]);

    const largeAmount = ethers.parseEther("1000000"); // 1 million ETH
    const bridgeData = ethers.keccak256(ethers.toUtf8Bytes("bridge_data"));
    
    // Track balances
    const mockSolverBalance = await ethers.provider.getBalance(env.solver.address);
    const feeCollectorBalance = await ethers.provider.getBalance(env.feeCollector.address);
    const referrerBalance = await ethers.provider.getBalance(env.referrer.address);
    
    // Calculate expected values
    const expectedFee = largeAmount * 25n / 10000n; // 0.25%
    const expectedAmount = largeAmount - expectedFee;
    const expectedReferrerFee = expectedFee * 20n / 100n; // 20% of fee
    const expectedFeeCollectorFee = expectedFee * 80n / 100n; // 80% of fee
    
    // Execute transaction with referrer
    const tx = await env.burner.connect(env.user).relayBridge(
      bridgeData,
      env.referrer.address, // referrer
      { value: largeAmount }
    );
    
    // Check event emission for bridge
    await expect(tx)
      .to.emit(env.burner, "BridgeSuccess")
      .withArgs(
        env.user.address,
        bridgeData,
        expectedAmount,
        expectedFee
      );
    
    // Check event emission for referrer fee
    await expect(tx)
      .to.emit(env.burner, "ReferrerFeePaid")
      .withArgs(
        env.user.address,
        env.referrer.address,
        expectedReferrerFee
      );
    
    // Check balances
    const mockSolverBalanceAfter = await ethers.provider.getBalance(env.solver.address);
    const feeCollectorBalanceAfter = await ethers.provider.getBalance(env.feeCollector.address);
    const referrerBalanceAfter = await ethers.provider.getBalance(env.referrer.address);
    
    expect(mockSolverBalanceAfter).to.equal(mockSolverBalance + expectedAmount);
    expect(feeCollectorBalanceAfter).to.equal(feeCollectorBalance + expectedFeeCollectorFee);
    expect(referrerBalanceAfter).to.equal(referrerBalance + expectedReferrerFee);
  });

  it("Should handle bridge with partner tier referrer (30% tier)", async function () {
    // Setup 30% tier partner
    await env.burner.connect(env.owner).putPartner(env.referrer.address, 6);
    
    const bridgeData = ethers.keccak256(ethers.toUtf8Bytes("bridge_data"));
    const swap = await getSwapParamsV3(env);

    const swapParams = [{
      tokenIn: swap.swapParams.tokenIn,
      amountIn: swap.swapParams.amountIn,
      amountOutMinimum: swap.swapParams.amountOutMinimum,
      path: swap.swapParams.path
    }];

    // Track balances
    const mockSolverBalance = await ethers.provider.getBalance(env.solver.address);
    const feeCollectorBalance = await ethers.provider.getBalance(env.feeCollector.address);
    const referrerBalance = await ethers.provider.getBalance(env.referrer.address);

    // Execute transaction with partner referrer
    const tx = await env.burner.connect(env.user).swapExactInputMultiple(
      swapParams,
      "0x0000000000000000000000000000000000000000", // no recipient (using bridge)
      true, // bridge = true
      bridgeData,
      env.referrer.address, // partner referrer
      {value: ethers.parseEther("0.1")} // Add ETH for bridge fee
    );

    // Calculate expected values:
    // - 1 ETH from swap
    // - 0.1 ETH direct value
    // - Swap fee (2.5%): 0.025 ETH
    // - Bridge fee (0.25%): 0.00025 ETH
    // - Total fees: 0.02525 ETH
    // - Referrer gets 30% of fees: 0.007575 ETH (0.0075 + 0.000075)
    // - Fee collector gets 70% of fees: 0.017675 ETH (0.0175 + 0.000175)
    // - Total to bridge: 1.1 - 0.02525 = 1.07475 ETH

    // Check event for bridge
    await expect(tx)
      .to.emit(env.burner, "BridgeSuccess")
      .withArgs(
        env.user.address,
        bridgeData,
        ethers.parseEther("1.07475"), // 0.975 + 0.09975 = 1.07475 ETH
        ethers.parseEther("0.02525")  // 0.025 + 0.00025 = 0.02525 ETH
      );

    // Check event for referrer fee (30% tier)
    await expect(tx)
      .to.emit(env.burner, "ReferrerFeePaid")
      .withArgs(
        env.user.address,
        env.referrer.address,
        ethers.parseEther("0.007575") // 30% of total fees (0.0075 + 0.000075)
      );

    // Check balances
    const mockSolverBalanceAfter = await ethers.provider.getBalance(env.solver.address);
    const feeCollectorBalanceAfter = await ethers.provider.getBalance(env.feeCollector.address);
    const referrerBalanceAfter = await ethers.provider.getBalance(env.referrer.address);

    const expectedMockSolverBalance = mockSolverBalance + ethers.parseEther("1.07475");
    const expectedFeeCollectorBalance = feeCollectorBalance + ethers.parseEther("0.017675");
    const expectedReferrerBalance = referrerBalance + ethers.parseEther("0.007575");

    expect(mockSolverBalanceAfter).to.equal(expectedMockSolverBalance);
    expect(feeCollectorBalanceAfter).to.equal(expectedFeeCollectorBalance);
    expect(referrerBalanceAfter).to.equal(expectedReferrerBalance);
  });

  it("Should handle bridge with partner tier referrer (50% tier)", async function () {
    // Setup 50% tier partner
    await env.burner.connect(env.owner).putPartner(env.referrer.address, 10);
    
    const bridgeData = ethers.keccak256(ethers.toUtf8Bytes("bridge_data"));
    const swap = await getSwapParamsV3(env);

    const swapParams = [{
      tokenIn: swap.swapParams.tokenIn,
      amountIn: swap.swapParams.amountIn,
      amountOutMinimum: swap.swapParams.amountOutMinimum,
      path: swap.swapParams.path
    }];

    // Track balances
    const mockSolverBalance = await ethers.provider.getBalance(env.solver.address);
    const feeCollectorBalance = await ethers.provider.getBalance(env.feeCollector.address);
    const referrerBalance = await ethers.provider.getBalance(env.referrer.address);

    // Execute transaction with partner referrer
    const tx = await env.burner.connect(env.user).swapExactInputMultiple(
      swapParams,
      "0x0000000000000000000000000000000000000000", // no recipient (using bridge)
      true, // bridge = true
      bridgeData,
      env.referrer.address, // partner referrer
      {value: ethers.parseEther("0.1")} // Add ETH for bridge fee
    );

    // Calculate expected values:
    // - 1 ETH from swap
    // - 0.1 ETH direct value
    // - Swap fee (2.5%): 0.025 ETH
    // - Bridge fee (0.25%): 0.00025 ETH
    // - Total fees: 0.02525 ETH
    // - Referrer gets 50% of fees: 0.012625 ETH (0.0125 + 0.000125)
    // - Fee collector gets 50% of fees: 0.012625 ETH (0.0125 + 0.000125)
    // - Total to bridge: 1.1 - 0.02525 = 1.07475 ETH

    // Check event for bridge
    await expect(tx)
      .to.emit(env.burner, "BridgeSuccess")
      .withArgs(
        env.user.address,
        bridgeData,
        ethers.parseEther("1.07475"), // 0.975 + 0.09975 = 1.07475 ETH
        ethers.parseEther("0.02525")  // 0.025 + 0.00025 = 0.02525 ETH
      );

    // Check event for referrer fee (50% tier)
    await expect(tx)
      .to.emit(env.burner, "ReferrerFeePaid")
      .withArgs(
        env.user.address,
        env.referrer.address,
        ethers.parseEther("0.012625") // 50% of total fees (0.0125 + 0.000125)
      );

    // Check balances
    const mockSolverBalanceAfter = await ethers.provider.getBalance(env.solver.address);
    const feeCollectorBalanceAfter = await ethers.provider.getBalance(env.feeCollector.address);
    const referrerBalanceAfter = await ethers.provider.getBalance(env.referrer.address);

    const expectedMockSolverBalance = mockSolverBalance + ethers.parseEther("1.07475");
    const expectedFeeCollectorBalance = feeCollectorBalance + ethers.parseEther("0.012625");
    const expectedReferrerBalance = referrerBalance + ethers.parseEther("0.012625");

    expect(mockSolverBalanceAfter).to.equal(expectedMockSolverBalance);
    expect(feeCollectorBalanceAfter).to.equal(expectedFeeCollectorBalance);
    expect(referrerBalanceAfter).to.equal(expectedReferrerBalance);
  });

  it("Should allow paid referrer to self-refer in a bridge transaction", async function () {
    // Setup user as a paid referrer (30% tier)
    const usdcDecimals = BigInt(parseInt(await env.mockUSDC.decimals()));

    await env.mockUSDC.mint(env.user.address, 25n * 10n ** usdcDecimals);
    await env.mockUSDC.connect(env.user).approve(await env.burner.getAddress(), 25n * 10n ** usdcDecimals);
    await env.burner.connect(env.user).paidReferrer(25n * 10n ** usdcDecimals);
    
    const bridgeData = ethers.keccak256(ethers.toUtf8Bytes("bridge_data"));
    const swap = await getSwapParamsV3(env);

    const swapParams = [{
      tokenIn: swap.swapParams.tokenIn,
      amountIn: swap.swapParams.amountIn,
      amountOutMinimum: swap.swapParams.amountOutMinimum,
      path: swap.swapParams.path
    }];

    // Track balances
    const mockSolverBalance = await ethers.provider.getBalance(env.solver.address);
    const feeCollectorBalance = await ethers.provider.getBalance(env.feeCollector.address);
    const userBalanceBefore = await ethers.provider.getBalance(env.user.address);

    // Execute transaction with self as referrer
    const tx = await env.burner.connect(env.user).swapExactInputMultiple(
      swapParams,
      "0x0000000000000000000000000000000000000000", // no recipient (using bridge)
      true, // bridge = true
      bridgeData,
      env.user.address, // self-referral
      {value: ethers.parseEther("0.1")} // Add ETH for bridge fee
    );
    
    const receipt = await tx.wait();
    const gasCost = receipt.gasUsed * receipt.gasPrice;

    // Calculate expected values:
    // - 1 ETH from swap
    // - 0.1 ETH direct value
    // - Swap fee (2.5%): 0.025 ETH
    // - Bridge fee (0.25%): 0.00025 ETH
    // - Total fees: 0.02525 ETH
    // - User as referrer gets 30% of fees: 0.007575 ETH (0.0075 + 0.000075)
    // - Fee collector gets 70% of fees: 0.017675 ETH (0.0175 + 0.000175)
    // - Total to bridge: 1.1 - 0.02525 = 1.07475 ETH

    // Check event for bridge
    await expect(tx)
      .to.emit(env.burner, "BridgeSuccess")
      .withArgs(
        env.user.address,
        bridgeData,
        ethers.parseEther("1.07475"), // 0.975 + 0.09975 = 1.07475 ETH
        ethers.parseEther("0.02525")  // 0.025 + 0.00025 = 0.02525 ETH
      );

    // Check event for referrer fee (user self-referring with 30% tier)
    await expect(tx)
      .to.emit(env.burner, "ReferrerFeePaid")
      .withArgs(
        env.user.address,
        env.user.address,
        ethers.parseEther("0.007575") // 30% of total fees (0.0075 + 0.000075)
      );

    // Check balances
    const mockSolverBalanceAfter = await ethers.provider.getBalance(env.solver.address);
    const feeCollectorBalanceAfter = await ethers.provider.getBalance(env.feeCollector.address);
    const userBalanceAfter = await ethers.provider.getBalance(env.user.address);

    const expectedMockSolverBalance = mockSolverBalance + ethers.parseEther("1.07475");
    const expectedFeeCollectorBalance = feeCollectorBalance + ethers.parseEther("0.017675");
    
    // User spent 0.1 ETH for bridge value + gas cost, but received referrer fee of 0.007575 ETH
    const expectedUserBalance = userBalanceBefore - ethers.parseEther("0.1") - gasCost + ethers.parseEther("0.007575");

    expect(mockSolverBalanceAfter).to.equal(expectedMockSolverBalance);
    expect(feeCollectorBalanceAfter).to.equal(expectedFeeCollectorBalance);
    expect(userBalanceAfter).to.equal(expectedUserBalance);
  });

  it("Should handle bridge with paused referrals", async function () {
    // Pause referrals
    await env.burner.connect(env.owner).changePauseReferral();
    
    const bridgeData = ethers.keccak256(ethers.toUtf8Bytes("bridge_data"));
    const swap = await getSwapParamsV3(env);

    const swapParams = [{
      tokenIn: swap.swapParams.tokenIn,
      amountIn: swap.swapParams.amountIn,
      amountOutMinimum: swap.swapParams.amountOutMinimum,
      path: swap.swapParams.path
    }];

    // Track balances
    const mockSolverBalance = await ethers.provider.getBalance(env.solver.address);
    const feeCollectorBalance = await ethers.provider.getBalance(env.feeCollector.address);
    const referrerBalance = await ethers.provider.getBalance(env.referrer.address);

    // Execute transaction with referrer (but referrals are paused)
    const tx = await env.burner.connect(env.user).swapExactInputMultiple(
      swapParams,
      "0x0000000000000000000000000000000000000000", // no recipient (using bridge)
      true, // bridge = true
      bridgeData,
      env.referrer.address, // referrer (but referrals are paused)
      {value: ethers.parseEther("0.1")} // Add ETH for bridge fee
    );

    // Check event for bridge
    await expect(tx)
      .to.emit(env.burner, "BridgeSuccess")
      .withArgs(
        env.user.address,
        bridgeData,
        ethers.parseEther("1.07475"), // 0.975 + 0.09975 = 1.07475 ETH
        ethers.parseEther("0.02525")  // 0.025 + 0.00025 = 0.02525 ETH
      );

    // Check balances - referrer balance should remain unchanged
    const mockSolverBalanceAfter = await ethers.provider.getBalance(env.solver.address);
    const feeCollectorBalanceAfter = await ethers.provider.getBalance(env.feeCollector.address);
    const referrerBalanceAfter = await ethers.provider.getBalance(env.referrer.address);

    const expectedMockSolverBalance = mockSolverBalance + ethers.parseEther("1.07475");
    const expectedFeeCollectorBalance = feeCollectorBalance + ethers.parseEther("0.02525"); // fee collector gets all fees
    
    expect(mockSolverBalanceAfter).to.equal(expectedMockSolverBalance);
    expect(feeCollectorBalanceAfter).to.equal(expectedFeeCollectorBalance);
    expect(referrerBalanceAfter).to.equal(referrerBalance); // referrer balance unchanged
  });
}); 