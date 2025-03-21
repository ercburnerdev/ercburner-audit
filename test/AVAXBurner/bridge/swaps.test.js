const { expect } = require("chai");
const { deployTestEnvironment } = require("../setup");
const { getSwapParamsV3, getSwapParamsV2, getSwapParamsWNATIVE } = require("../utils/getSwapParams");
const { ethers } = require("hardhat");

describe("Burner - Bridge Swaps", function () {
  let env;

  beforeEach(async function () {
    env = await deployTestEnvironment();
  });

  it("Should properly handle bridge transaction with regular token swap", async function () {
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

    // Execute swap with bridge
    const tx = await env.burner.connect(env.user).swapExactInputMultiple(
      swapParams,
      "0x0000000000000000000000000000000000000000", // no recipient (using bridge)
      true, // bridge = true
      bridgeData,
      "0x0000000000000000000000000000000000000000", // no referrer
      {value: ethers.parseEther("0.1")} // Add ETH for bridge fee
    );

    // Check event emission
    await expect(tx)
      .to.emit(env.burner, "BridgeSuccess")
      .withArgs(
        env.user.address,
        "0x", // Return data from mock receiver
        ethers.parseEther("0.975") + ethers.parseEther("0.09975"), // 97.5% of swap amount + 99.75% of direct ETH
        ethers.parseEther("0.025") + ethers.parseEther("0.00025")  // 2.5% of swap fee + 0.25% of bridge fee
      );

    // Check final ETH balances
    const mockSolverBalanceAfter = await ethers.provider.getBalance(env.solver.address);
    const feeCollectorBalanceAfter = await ethers.provider.getBalance(env.feeCollector.address);

    // Calculate expected values
    // From swap: 1 ETH, 2.5% fee = 0.025 ETH, user gets 0.975 ETH
    // From direct ETH: 0.1 ETH, 0.25% fee = 0.00025 ETH, user gets 0.09975 ETH
    // Total to bridge: 0.975 + 0.09975 = 1.07475 ETH
    // Total fee: 0.025 + 0.00025 = 0.02525 ETH
    const expectedMockSolverBalance = mockSolverBalance + ethers.parseEther("1.07475");
    const expectedFeeCollectorBalance = feeCollectorBalance + ethers.parseEther("0.02525");

    expect(mockSolverBalanceAfter).to.equal(expectedMockSolverBalance);
    expect(feeCollectorBalanceAfter).to.equal(expectedFeeCollectorBalance);
  });

  it("Should properly handle bridge transaction with WNATIVE token", async function () {
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

    // Execute swap with bridge
    const tx = await env.burner.connect(env.user).swapExactInputMultiple(
      swapParams,
      "0x0000000000000000000000000000000000000000", // no recipient (using bridge)
      true, // bridge = true
      bridgeData,
      "0x0000000000000000000000000000000000000000", // no referrer
      {value: ethers.parseEther("0.1")} // Add ETH for bridge fee
    );

    // Check event emission
    await expect(tx)
      .to.emit(env.burner, "BridgeSuccess")
      .withArgs(
        env.user.address,
        "0x", // Return data from mock receiver
        ethers.parseEther("0.975") + ethers.parseEther("0.09975"), // 97.5% of swap amount + 99.75% of direct ETH
        ethers.parseEther("0.025") + ethers.parseEther("0.00025")  // 2.5% of swap fee + 0.25% of bridge fee
      );

    // Check final ETH balances
    const mockSolverBalanceAfter = await ethers.provider.getBalance(env.solver.address);
    const feeCollectorBalanceAfter = await ethers.provider.getBalance(env.feeCollector.address);

    // Calculate expected values (same as before since WNATIVE should unwrap to ETH)
    const expectedMockSolverBalance = mockSolverBalance + ethers.parseEther("1.07475");
    const expectedFeeCollectorBalance = feeCollectorBalance + ethers.parseEther("0.02525");

    expect(mockSolverBalanceAfter).to.equal(expectedMockSolverBalance);
    expect(feeCollectorBalanceAfter).to.equal(expectedFeeCollectorBalance);
  });

  it("Should properly handle bridge transaction with multiple token swaps", async function () {
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

    // Execute swap with bridge
    const tx = await env.burner.connect(env.user).swapExactInputMultiple(
      swapParams,
      "0x0000000000000000000000000000000000000000", // no recipient (using bridge)
      true, // bridge = true
      bridgeData,
      "0x0000000000000000000000000000000000000000", // no referrer
      {value: ethers.parseEther("0.1")} // Add ETH for bridge fee
    );

    // Check event emission
    await expect(tx)
      .to.emit(env.burner, "BridgeSuccess")
      .withArgs(
        env.user.address,
        "0x", // Return data from mock receiver
        ethers.parseEther("0.975") + ethers.parseEther("0.09975"), // 97.5% of swap amount + 99.75% of direct ETH
        ethers.parseEther("0.025") + ethers.parseEther("0.00025")  // 2.5% of swap fee + 0.25% of bridge fee
      );

    // Check final ETH balances
    const mockSolverBalanceAfter = await ethers.provider.getBalance(env.solver.address);
    const feeCollectorBalanceAfter = await ethers.provider.getBalance(env.feeCollector.address);

    // Calculate expected values
    // From swap: 1 ETH (0.5 ETH each), 2.5% fee = 0.025 ETH, user gets 0.975 ETH
    // From direct ETH: 0.1 ETH, 0.25% fee = 0.00025 ETH, user gets 0.09975 ETH
    // Total to bridge: 0.975 + 0.09975 = 1.07475 ETH
    // Total fee: 0.025 + 0.00025 = 0.02525 ETH
    const expectedMockSolverBalance = mockSolverBalance + ethers.parseEther("1.07475");
    const expectedFeeCollectorBalance = feeCollectorBalance + ethers.parseEther("0.02525");

    expect(mockSolverBalanceAfter).to.equal(expectedMockSolverBalance);
    expect(feeCollectorBalanceAfter).to.equal(expectedFeeCollectorBalance);
  });

  it("Should properly handle direct bridge transaction with no swaps", async function () {
    // Prepare a bridge call data
    const bridgeData = ethers.keccak256(ethers.toUtf8Bytes("bridge_data"));
    
    // Empty swap params array (no swaps)
    const swapParams = [];

    // Track contract balances before swap
    const mockSolverBalance = await ethers.provider.getBalance(env.solver.address);
    const feeCollectorBalance = await ethers.provider.getBalance(env.feeCollector.address);

    // Execute with bridge only (no swaps)
    const tx = await env.burner.connect(env.user).relayBridge(
      bridgeData,
      "0x0000000000000000000000000000000000000000", // no referrer
      {value: ethers.parseEther("1.0")} // Direct bridge with 1 ETH
    );

    // Check event emission
    await expect(tx)
      .to.emit(env.burner, "BridgeSuccess")
      .withArgs(
        env.user.address,
        "0x", // Return data from mock receiver
        ethers.parseEther("0.9975"), // 99.75% of 1 ETH
        ethers.parseEther("0.0025")  // 0.25% of 1 ETH
      );

    // Check final ETH balances
    const mockSolverBalanceAfter = await ethers.provider.getBalance(env.solver.address);
    const feeCollectorBalanceAfter = await ethers.provider.getBalance(env.feeCollector.address);

    // Calculate expected values
    // From direct ETH: 1 ETH, 0.25% fee = 0.0025 ETH, to bridge: 0.9975 ETH
    const expectedMockSolverBalance = mockSolverBalance + ethers.parseEther("0.9975");
    const expectedFeeCollectorBalance = feeCollectorBalance + ethers.parseEther("0.0025");

    expect(mockSolverBalanceAfter).to.equal(expectedMockSolverBalance);
    expect(feeCollectorBalanceAfter).to.equal(expectedFeeCollectorBalance);
  });

  it("Should properly handle relayBridge by owner", async function () {
    // Prepare a bridge call data
    const bridgeData = ethers.keccak256(ethers.toUtf8Bytes("bridge_data"));
    
    // Track contract balances before relay
    const mockSolverBalance = await ethers.provider.getBalance(env.solver.address);
    const feeCollectorBalance = await ethers.provider.getBalance(env.feeCollector.address);

    // Call relayBridge
    const tx = await env.burner.connect(env.user).relayBridge(
      bridgeData,
      "0x0000000000000000000000000000000000000000", // No referrer
      { value: ethers.parseEther("1.0") }
    );

    // Check event emission
    await expect(tx)
      .to.emit(env.burner, "BridgeSuccess")
      .withArgs(
        env.user.address,
        "0x", // Return data from mock receiver
        ethers.parseEther("0.9975"), // 99.75% of 1 ETH
        ethers.parseEther("0.0025")  // 0.25% of 1 ETH
      );

    // Check final ETH balances
    const mockSolverBalanceAfter = await ethers.provider.getBalance(env.solver.address);
    const feeCollectorBalanceAfter = await ethers.provider.getBalance(env.feeCollector.address);

    // Calculate expected values
    // From direct ETH: 1 ETH, 0.25% fee = 0.0025 ETH, to bridge: 0.9975 ETH
    const expectedMockSolverBalance = mockSolverBalance + ethers.parseEther("0.9975");
    const expectedFeeCollectorBalance = feeCollectorBalance + ethers.parseEther("0.0025");

    expect(mockSolverBalanceAfter).to.equal(expectedMockSolverBalance);
    expect(feeCollectorBalanceAfter).to.equal(expectedFeeCollectorBalance);
  });

  // Additional tests for complex scenarios without referrers

  it("Should handle bridge with mixed token types (ERC20 + WNATIVE)", async function () {
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

    // Execute transaction
    const tx = await env.burner.connect(env.user).swapExactInputMultiple(
      swapParams,
      "0x0000000000000000000000000000000000000000",
      true,
      bridgeData,
      "0x0000000000000000000000000000000000000000",
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
    // - Total to bridge: 1.7 - 0.038 = 1.662 ETH

    // Check event
    await expect(tx)
      .to.emit(env.burner, "BridgeSuccess")
      .withArgs(
        env.user.address,
        "0x",
        ethers.parseEther("1.662"), // 1.1745 + 0.4875 = 1.662 ETH
        ethers.parseEther("0.038")  // 0.0375 + 0.0005 = 0.038 ETH
      );

    // Check balances
    const mockSolverBalanceAfter = await ethers.provider.getBalance(env.solver.address);
    const feeCollectorBalanceAfter = await ethers.provider.getBalance(env.feeCollector.address);

    const expectedMockSolverBalance = mockSolverBalance + ethers.parseEther("1.662");
    const expectedFeeCollectorBalance = feeCollectorBalance + ethers.parseEther("0.038");

    expect(mockSolverBalanceAfter).to.equal(expectedMockSolverBalance);
    expect(feeCollectorBalanceAfter).to.equal(expectedFeeCollectorBalance);
  });

  it("Should handle bridge with three different token types", async function () {
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

    // Mock router to return specific amounts (total: 2 ETH from swaps)
    await env.mockLBRouter.setReturnAmount(ethers.parseEther("0.5"));

    // Track balances
    const mockSolverBalance = await ethers.provider.getBalance(env.solver.address);
    const feeCollectorBalance = await ethers.provider.getBalance(env.feeCollector.address);

    // Execute transaction with 0.5 ETH direct value
    const tx = await env.burner.connect(env.user).swapExactInputMultiple(
      swapParams,
      "0x0000000000000000000000000000000000000000",
      true,
      bridgeData,
      "0x0000000000000000000000000000000000000000",
      {value: ethers.parseEther("0.5")}
    );

    // Calculate expected values:
    // - 2 ETH from swaps (0.5 ETH x 2 + 1 ETH)
    // - 0.5 ETH direct value
    // - Total: 2.5 ETH
    // - Swap fee (2.5%): 0.05 ETH (only applied to 2 ETH from swaps)
    // - Bridge fee (0.25%): 0.00125 ETH (only applied to 0.5 ETH direct value)
    // - Total fees: 0.05125 ETH
    // - Total to bridge: 2.5 - 0.05125 = 2.44875 ETH

    // Check event
    await expect(tx)
      .to.emit(env.burner, "BridgeSuccess")
      .withArgs(
        env.user.address,
        "0x",
        ethers.parseEther("2.44875"), // 1.94875 + 0.49875 = 2.44875 ETH
        ethers.parseEther("0.05125")  // 0.05 + 0.00125 = 0.05125 ETH
      );

    // Check balances
    const mockSolverBalanceAfter = await ethers.provider.getBalance(env.solver.address);
    const feeCollectorBalanceAfter = await ethers.provider.getBalance(env.feeCollector.address);

    const expectedMockSolverBalance = mockSolverBalance + ethers.parseEther("2.44875");
    const expectedFeeCollectorBalance = feeCollectorBalance + ethers.parseEther("0.05125");

    expect(mockSolverBalanceAfter).to.equal(expectedMockSolverBalance);
    expect(feeCollectorBalanceAfter).to.equal(expectedFeeCollectorBalance);
  });

  it("Should handle relayBridge with different ETH amounts", async function () {
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
      
      // Calculate expected fee and amount after fee
      const expectedFee = amount * 25n / 10000n; // 0.25%
      const expectedAmount = amount - expectedFee;
      
      // Execute transaction
      const tx = await env.burner.connect(env.user).relayBridge(
        bridgeData,
        "0x0000000000000000000000000000000000000000",
        { value: amount }
      );
      
      // Check event emission
      await expect(tx)
        .to.emit(env.burner, "BridgeSuccess")
        .withArgs(
          env.user.address,
          "0x",
          expectedAmount,
          expectedFee
        );
      
      // Check balances after transaction
      const mockSolverBalanceAfter = await ethers.provider.getBalance(env.solver.address);
      const feeCollectorBalanceAfter = await ethers.provider.getBalance(env.feeCollector.address);
      
      expect(mockSolverBalanceAfter).to.equal(mockSolverBalance + expectedAmount);
      expect(feeCollectorBalanceAfter).to.equal(feeCollectorBalance + expectedFee);
    }
  });

  it("Should handle edge case with very large ETH amounts", async function () {
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
    
    // Calculate expected values
    const expectedFee = largeAmount * 25n / 10000n; // 0.25%
    const expectedAmount = largeAmount - expectedFee;
    
    // Execute transaction
    const tx = await env.burner.connect(env.user).relayBridge(
      bridgeData,
      "0x0000000000000000000000000000000000000000",
      { value: largeAmount }
    );
    
    // Check event emission
    await expect(tx)
      .to.emit(env.burner, "BridgeSuccess")
      .withArgs(
        env.user.address,
        "0x",
        expectedAmount,
        expectedFee
      );
    
    // Check balances
    const mockSolverBalanceAfter = await ethers.provider.getBalance(env.solver.address);
    const feeCollectorBalanceAfter = await ethers.provider.getBalance(env.feeCollector.address);
    
    expect(mockSolverBalanceAfter).to.equal(mockSolverBalance + expectedAmount);
    expect(feeCollectorBalanceAfter).to.equal(feeCollectorBalance + expectedFee);
  });
}); 