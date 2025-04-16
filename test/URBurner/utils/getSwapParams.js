const { ethers } = require("hardhat");
const { prepareSwapExactInput, encodePath, URswapParamForWnative } = require("./prepareSwaps");

async function getSwapParamsV3(env, amount = 100, minimumAmountOut = 0.1) {
    let MockToken = await ethers.getContractFactory("MockToken");
    let mockToken = await MockToken.deploy(`MockToken`, `MTK`);


    await mockToken.mint(env.user.address, ethers.parseEther("1000"));
    await mockToken.connect(env.user).approve(await env.burner.getAddress(), ethers.parseEther("1000"));

    const encodedPath = encodePath(
        "0x00", 
        [await mockToken.getAddress(), await env.mockWNATIVE.getAddress()], 
        [3000]
    );

    return {
        swapParams: prepareSwapExactInput(
            "0x00",
            await env.burner.getAddress(),
            await mockToken.getAddress(),
            ethers.parseEther(amount.toString()),
            ethers.parseEther(minimumAmountOut.toString()),
            encodedPath,
            false,
            env.user.address,
            Math.floor(Date.now() / 1000) + 3600
        ),
        token: mockToken
    }
}

async function getSwapParamsV2(env, amount = 100, minimumAmountOut = 0.1) {
    let MockToken = await ethers.getContractFactory("MockToken");
    let mockToken = await MockToken.deploy(`MockToken`, `MTK`);

    await mockToken.mint(env.user.address, ethers.parseEther("1000"));
    await mockToken.connect(env.user).approve(await env.burner.getAddress(), ethers.parseEther("1000"));

    return {
        swapParams: prepareSwapExactInput(
                "0x08",
                await env.burner.getAddress(),
                await mockToken.getAddress(),
                ethers.parseEther(amount.toString()),
                ethers.parseEther(minimumAmountOut.toString()),
                [await mockToken.getAddress(), await env.mockWNATIVE.getAddress()],
                false,
                env.user.address,
                Math.floor(Date.now() / 1000) + 3600
            ),
        token: mockToken
    }
}

async function getSwapParamsWNATIVE(env, amount = 1) {
    const swap = URswapParamForWnative(
        await env.mockWNATIVE.getAddress(),
        ethers.parseEther(amount.toString()),
        await env.burner.getAddress(),
        env.user.address,
        await env.mockWNATIVE.getAddress()
    );

    return {
        swapParams: swap,
        token: env.mockWNATIVE
    }
}

async function getMixedV2V3SwapParams(env, amount = 100, minimumAmountOut = 0.1) {
    const mockTokens = [env.mockToken];
    for (let i = 2; i <= 11; i++) {
      const MockToken = await ethers.getContractFactory("MockToken");
      const token = await MockToken.deploy(`MockToken${i}`, `MTK${i}`);
      await token.mint(env.user.address, ethers.parseEther("1000"));
      await token.connect(env.user).approve(await env.burner.getAddress(), ethers.parseEther("1000"));
      mockTokens.push(token);
    }

    const swapParams = await Promise.all(mockTokens.map(async (token, index) => {
      const encodedPath = encodePath(
        "0x00", 
        [await token.getAddress(), await env.mockWNATIVE.getAddress()], 
        [3000]
      );
      
      const swap = prepareSwapExactInput(
        index % 2 === 0 ? "0x00" : "0x08",
        await env.burner.getAddress(),
        await token.getAddress(),
        ethers.parseEther(amount.toString()),
        ethers.parseEther(minimumAmountOut.toString()),
        index % 2 === 0 ? encodedPath : [await token.getAddress(), await env.mockWNATIVE.getAddress()],
        false,
        env.user.address,
        Math.floor(Date.now() / 1000) + 3600
      );

      return {
        commands: swap.commands,
        inputs: swap.inputs
      };
    }));

    return {swapParams: swapParams, mockTokens: mockTokens};
}

module.exports = {
    getSwapParamsV3,
    getSwapParamsV2,
    getSwapParamsWNATIVE,
    getMixedV2V3SwapParams
}
