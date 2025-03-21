const { ethers } = require("hardhat");
const { createSwapParams, createNativeSwapParams } = require("./prepareSwaps");

async function getSwapParamsV3(env, amount = 100, minimumAmountOut = 0.1) {
    let MockToken = await ethers.getContractFactory("MockToken");
    let mockToken = await MockToken.deploy(`MockToken`, `MTK`);

    await mockToken.mint(env.user.address, ethers.parseEther("1000"));
    await mockToken.connect(env.user).approve(await env.burner.getAddress(), ethers.parseEther("1000"));

    // Create simple mock path
    const mockTokenAddress = await mockToken.getAddress();
    const wnativeAddress = await env.mockWNATIVE.getAddress();
    const amountIn = ethers.parseEther(amount.toString());
    const amountOut = ethers.parseEther(minimumAmountOut.toString());
    
    // Simple path with any version (not important for test)
    const path = {
        tokenPath: [mockTokenAddress, wnativeAddress],
        pairBinSteps: [20],
        versions: [2]
    };

    return {
        swapParams: createSwapParams(
            mockTokenAddress,
            amountIn,
            BigInt(amountOut) * BigInt(99) / BigInt(100), // 1% slippage
            await env.burner.getAddress(),
            path
        ),
        token: mockToken
    }
}

async function getSwapParamsV2(env, amount = 100, minimumAmountOut = 0.1) {
    let MockToken = await ethers.getContractFactory("MockToken");
    let mockToken = await MockToken.deploy(`MockToken`, `MTK`);

    await mockToken.mint(env.user.address, ethers.parseEther("1000"));
    await mockToken.connect(env.user).approve(await env.burner.getAddress(), ethers.parseEther("1000"));

    // Create simple mock path
    const mockTokenAddress = await mockToken.getAddress();
    const wnativeAddress = await env.mockWNATIVE.getAddress();
    const amountIn = ethers.parseEther(amount.toString());
    const amountOut = ethers.parseEther(minimumAmountOut.toString());
    
    // Simple path with any version (not important for test)
    const path = {
        tokenPath: [mockTokenAddress, wnativeAddress],
        pairBinSteps: [0],
        versions: [0]
    };

    return {
        swapParams: createSwapParams(
            mockTokenAddress,
            amountIn,
            BigInt(amountOut) * BigInt(99) / BigInt(100), // 1% slippage
            await env.burner.getAddress(),
            path
        ),
        token: mockToken
    }
}

async function getSwapParamsWNATIVE(env, amount = 1) {
    return {
        swapParams: createNativeSwapParams(
            await env.mockWNATIVE.getAddress(),
            ethers.parseEther(amount.toString()),
            await env.burner.getAddress()
        ),
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
        const mockTokenAddress = await token.getAddress();
        const wnativeAddress = await env.mockWNATIVE.getAddress();
        const amountIn = ethers.parseEther(amount.toString());
        const amountOut = ethers.parseEther(minimumAmountOut.toString());
        
        // Just alternate any values for testing - versions don't matter
        const version = index % 2;
        const binStep = index % 2 === 0 ? 20 : 0;
        
        const path = {
            tokenPath: [mockTokenAddress, wnativeAddress],
            pairBinSteps: [binStep],
            versions: [version]
        };
        
        return createSwapParams(
            mockTokenAddress,
            amountIn,
            BigInt(amountOut) * BigInt(99) / BigInt(100),
            await env.burner.getAddress(),
            path
        );
    }));

    return {swapParams: swapParams, mockTokens: mockTokens};
}

module.exports = {
    getSwapParamsV3,
    getSwapParamsV2,
    getSwapParamsWNATIVE,
    getMixedV2V3SwapParams
}
