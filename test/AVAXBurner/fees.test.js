const { expect } = require("chai");
const { deployTestEnvironment } = require("./setup");
const { prepareSwapExactInput, encodePath } = require("./utils/prepareSwaps");
const { getSwapParamsV3, getSwapParamsV2 } = require("./utils/getSwapParams");
describe("Burner - Fees", function () {
  let env;

  beforeEach(async function () {
    env = await deployTestEnvironment();
  });

  it("Should allow owner to change fee percentage", async function () {
    await expect(env.burner.connect(env.owner).setBurnFeeDivisor(50))
      .to.emit(env.burner, "BurnFeeDivisorChanged")
      .withArgs(50);

    expect(await env.burner.burnFeeDivisor()).to.equal(50);
  });

  it("Should not allow non-owner to change fee percentage", async function () {
    await expect(env.burner.connect(env.user).setBurnFeeDivisor(50))
      .to.be.revertedWithCustomError(env.burner, "OwnableUnauthorizedAccount")
      .withArgs(env.user.address);
  });

  it("Should allow owner to change fee collector", async function () {
    const newFeeCollector = ethers.Wallet.createRandom().address;
    await expect(env.burner.connect(env.owner).setFeeCollector(newFeeCollector))
      .to.emit(env.burner, "FeeCollectorChanged")
      .withArgs(newFeeCollector);

    expect(await env.burner.feeCollector()).to.equal(newFeeCollector);
  });

  it("Should not allow non-owner to change fee collector", async function () {
    const newFeeCollector = ethers.Wallet.createRandom().address;
    await expect(env.burner.connect(env.user).setFeeCollector(newFeeCollector))
      .to.be.revertedWithCustomError(env.burner, "OwnableUnauthorizedAccount")
      .withArgs(env.user.address);
  });

  it("Should not allow fee percentage below 40", async function () {
    await expect(env.burner.connect(env.owner).setBurnFeeDivisor(39))
      .to.be.revertedWithCustomError(env.burner, "FeeDivisorTooLow");
  });

  it("Should handle maximum fee percentage correctly", async function () {
    await env.burner.connect(env.owner).setBurnFeeDivisor(40);

    let swap = await getSwapParamsV3(env);

    let swapParams = [{
      tokenIn: swap.swapParams.tokenIn,
      amountIn: swap.swapParams.amountIn,
      amountOutMinimum: swap.swapParams.amountOutMinimum,
      path: swap.swapParams.path,
      deadline: swap.swapParams.deadline
    }];

    // Mock router to return 0.1 ETH
    await env.mockLBRouter.setReturnAmount(ethers.parseEther("0.1"));

    // Track ETH balances before swap
    const userBalanceBefore = await ethers.provider.getBalance(env.user.address);
    const feeCollectorBalanceBefore = await ethers.provider.getBalance(env.feeCollector.address);

    const tx = await env.burner.connect(env.user).swapExactInputMultiple(swapParams,
      "0x0000000000000000000000000000000000000000",
       false,
       "0x", 
       "0x0000000000000000000000000000000000000000"
    );
    const receipt = await tx.wait();
    const gasCost = receipt.gasUsed * receipt.gasPrice;


    // Check final ETH balances
    const userBalanceAfter = await ethers.provider.getBalance(env.user.address);
    const feeCollectorBalanceAfter = await ethers.provider.getBalance(env.feeCollector.address);
    // Calculate expected values
    const expectedUserBalance = userBalanceBefore - gasCost + ethers.parseEther("0.0975"); // 97.5% of 0.1 ETH

    const expectedFeeCollectorBalance = feeCollectorBalanceBefore + ethers.parseEther("0.0025"); // 2.5% of 0.1 ETH

    expect(userBalanceAfter).to.equal(expectedUserBalance);
    expect(feeCollectorBalanceAfter).to.equal(expectedFeeCollectorBalance);
  });

  it("Should handle multiple token swaps with minimum fee correctly", async function () {

    let swap1 = await getSwapParamsV3(env);
    let swap2 = await getSwapParamsV2(env);

    const swapParams = [
      {
        tokenIn: swap1.swapParams.tokenIn,
        amountIn: swap1.swapParams.amountIn,
        amountOutMinimum: swap1.swapParams.amountOutMinimum,
        path: swap1.swapParams.path,
        deadline: swap1.swapParams.deadline
      },
      {
        tokenIn: swap2.swapParams.tokenIn,
        amountIn: swap2.swapParams.amountIn,
        amountOutMinimum: swap2.swapParams.amountOutMinimum,
        path: swap2.swapParams.path,
        deadline: swap2.swapParams.deadline
      }
    ];

    // Mock router to return 0.1 ETH for each swap
    await env.mockLBRouter.setReturnAmount(ethers.parseEther("0.1"));

    const userBalanceBefore = await ethers.provider.getBalance(env.user.address);
    const feeCollectorBalanceBefore = await ethers.provider.getBalance(env.feeCollector.address);

    const tx = await env.burner.connect(env.user).swapExactInputMultiple(swapParams,
      "0x0000000000000000000000000000000000000000",
       false,
       "0x", 
       "0x0000000000000000000000000000000000000000"
    );
    const receipt = await tx.wait();
    const gasCost = receipt.gasUsed * receipt.gasPrice;

    const userBalanceAfter = await ethers.provider.getBalance(env.user.address);
    const feeCollectorBalanceAfter = await ethers.provider.getBalance(env.feeCollector.address);

    // Total output is 0.2 ETH, with minimum fee of 0.01 ETH
    const expectedUserBalance = userBalanceBefore - gasCost + ethers.parseEther("0.195"); // 97.5% of 0.2 ETH
    const expectedFeeCollectorBalance = feeCollectorBalanceBefore + ethers.parseEther("0.005"); // 2.5% of 0.2 ETH


    expect(userBalanceAfter).to.equal(expectedUserBalance);
    expect(feeCollectorBalanceAfter).to.equal(expectedFeeCollectorBalance);
  });

});