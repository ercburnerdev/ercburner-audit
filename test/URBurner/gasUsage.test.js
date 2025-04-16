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

      const swapParams = [{
        commands: swap.swapParams.commands,
        inputs: swap.swapParams.inputs,
        deadline: swap.swapParams.deadline
      }];

      const tx = await env.burner.connect(env.user).swapExactInputMultiple(swapParams,
        "0x0000000000000000000000000000000000000000",
         false,
         "0x", 
         "0x0000000000000000000000000000000000000000"
      );
      await measureGas(tx);
    });

    it("Should measure gas for V3 token swap", async function () {
      const swap = await getSwapParamsV3(env);

      const swapParams = [{
        commands: swap.swapParams.commands,
        inputs: swap.swapParams.inputs,
        deadline: swap.swapParams.deadline
      }];

      const tx = await env.burner.connect(env.user).swapExactInputMultiple(swapParams,
        "0x0000000000000000000000000000000000000000",
         false,
         "0x", 
         "0x0000000000000000000000000000000000000000"
      );
      await measureGas(tx);
    });

    it("Should measure gas for V2 token swap", async function () {
      const swap = await getSwapParamsV2(env);

      const swapParams = [{
        commands: swap.swapParams.commands,
        inputs: swap.swapParams.inputs,
        deadline: swap.swapParams.deadline
      }];

      const tx = await env.burner.connect(env.user).swapExactInputMultiple(swapParams,
        "0x0000000000000000000000000000000000000000",
         false,
         "0x", 
         "0x0000000000000000000000000000000000000000"
      );
      await measureGas(tx);
    });
  });

  describe("Multiple Swaps Gas Usage", function () {
    it("Should measure gas for two token swaps", async function () {
      const swap1 = await getSwapParamsV3(env);
      const swap2 = await getSwapParamsV2(env);

      const swapParams = [
        {
          commands: swap1.swapParams.commands,
          inputs: swap1.swapParams.inputs,
          deadline: swap1.swapParams.deadline
        },
        {
          commands: swap2.swapParams.commands,
          inputs: swap2.swapParams.inputs,
          deadline: swap2.swapParams.deadline
        }
      ];

      const tx = await env.burner.connect(env.user).swapExactInputMultiple(swapParams,
        "0x0000000000000000000000000000000000000000",
         false,
         "0x", 
         "0x0000000000000000000000000000000000000000"
      );
      await measureGas(tx);
    });

    it("Should measure gas for eleven mixed V2 and V3 swaps", async function () {
      const swapParams = await getMixedV2V3SwapParams(env);

      const tx = await env.burner.connect(env.user).swapExactInputMultiple(swapParams.swapParams,
        "0x0000000000000000000000000000000000000000",
         false,
         "0x", 
         "0x0000000000000000000000000000000000000000"
      );
      await measureGas(tx);
    });
  });
});
