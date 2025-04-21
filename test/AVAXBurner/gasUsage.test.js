const { expect } = require("chai");
const { deployTestEnvironment } = require("./setup");
const { prepareSwapExactInput, encodePath, URswapParamForWnative } = require("./utils/prepareSwaps");
const { getSwapParamsV2, getSwapParamsV3, getSwapParamsWNATIVE, getMixedV2V3SwapParams } = require("./utils/getSwapParams");

describe("Burner - Gas Usage Analysis", function () {
  let env;

  beforeEach(async function () {
    env = await deployTestEnvironment();
  });

  async function measureGas(tx) {
    const receipt = await tx.wait();
    console.log(`Gas Used: ${receipt.gasUsed.toString()} units`);
    return receipt.gasUsed;
  }

  describe("Basic Swaps Gas Usage", function () {
    it("Should measure gas for WNATIVE swap", async function () {
      const swap = await getSwapParamsWNATIVE(env);

      let swapParams = [{
        tokenIn: swap.swapParams.tokenIn,
        amountIn: swap.swapParams.amountIn,
        amountOutMinimum: swap.swapParams.amountOutMinimum,
        path: swap.swapParams.path,
        
      }];

      const tx = await env.burner.connect(env.user).swapExactInputMultiple(swapParams,
        "0x0000000000000000000000000000000000000000",
         false,
         "0x", 
         "0x0000000000000000000000000000000000000000",
         BigInt(Math.floor(Date.now() / 1000) + 100000)
      );
      await measureGas(tx);
    });

    it("Should measure gas for V3 token swap", async function () {
      const swap = await getSwapParamsV3(env);

      let swapParams = [{
        tokenIn: swap.swapParams.tokenIn,
        amountIn: swap.swapParams.amountIn,
        amountOutMinimum: swap.swapParams.amountOutMinimum,
        path: swap.swapParams.path,
        
      }];

      const tx = await env.burner.connect(env.user).swapExactInputMultiple(swapParams,
        "0x0000000000000000000000000000000000000000",
         false,
         "0x", 
         "0x0000000000000000000000000000000000000000",
         BigInt(Math.floor(Date.now() / 1000) + 100000)
      );
      await measureGas(tx);
    });

    it("Should measure gas for V2 token swap", async function () {
      const swap = await getSwapParamsV2(env);

      let swapParams = [{
        tokenIn: swap.swapParams.tokenIn,
        amountIn: swap.swapParams.amountIn,
        amountOutMinimum: swap.swapParams.amountOutMinimum,
        path: swap.swapParams.path,
        
      }];

      const tx = await env.burner.connect(env.user).swapExactInputMultiple(swapParams,
        "0x0000000000000000000000000000000000000000",
         false,
         "0x", 
         "0x0000000000000000000000000000000000000000",
         BigInt(Math.floor(Date.now() / 1000) + 100000)
      );
      await measureGas(tx);
    });
  });

  describe("Multiple Swaps Gas Usage", function () {
    it("Should measure gas for two token swaps", async function () {
      const swap1 = await getSwapParamsV3(env);
      const swap2 = await getSwapParamsV2(env);

      let swapParams = [
        {
          tokenIn: swap1.swapParams.tokenIn,
          amountIn: swap1.swapParams.amountIn,
          amountOutMinimum: swap1.swapParams.amountOutMinimum,
          path: swap1.swapParams.path,
          
        },
        {
          tokenIn: swap2.swapParams.tokenIn,
          amountIn: swap2.swapParams.amountIn,
          amountOutMinimum: swap2.swapParams.amountOutMinimum,
          path: swap2.swapParams.path,
          
        }
      ];

      const tx = await env.burner.connect(env.user).swapExactInputMultiple(swapParams,
        "0x0000000000000000000000000000000000000000",
         false,
         "0x", 
         "0x0000000000000000000000000000000000000000",
         BigInt(Math.floor(Date.now() / 1000) + 100000)
      );
      await measureGas(tx);
    });

    it("Should measure gas for eleven mixed V2 and V3 swaps", async function () {
      const swapParams = await getMixedV2V3SwapParams(env);

      const tx = await env.burner.connect(env.user).swapExactInputMultiple(swapParams.swapParams,
        "0x0000000000000000000000000000000000000000",
         false,
         "0x", 
         "0x0000000000000000000000000000000000000000",
         BigInt(Math.floor(Date.now() / 1000) + 100000)
      );
      await measureGas(tx);
    });
  });
});
