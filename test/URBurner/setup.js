const { ethers } = require("hardhat");

async function deployTestEnvironment() {
  const [owner, feeCollector, user, solver, referrer, recipient, admin] = await ethers.getSigners();

  const MockWNATIVE = await ethers.getContractFactory("MockWNATIVE");
  const mockWNATIVE = await MockWNATIVE.deploy();

  const MockUSDC = await ethers.getContractFactory("MockUSDC");
  const mockUSDC = await MockUSDC.deploy();

  const MockToken = await ethers.getContractFactory("MockToken");
  const mockToken = await MockToken.deploy("MockToken", "MTK");

  const MockPermit2 = await ethers.getContractFactory("MockPermit2");
  const mockPermit2 = await MockPermit2.deploy();

  // Deploy mock UniversalRouter and Permit2
  const MockUniversalRouter = await ethers.getContractFactory("MockUniversalRouter");
  const mockUniversalRouter = await MockUniversalRouter.deploy(
    await mockPermit2.getAddress(),
    await mockWNATIVE.getAddress()
  );

  const MockReceiver = await ethers.getContractFactory("MockReceiver");
  const mockReceiver = await MockReceiver.deploy(solver.address);

  // Initialize user and MockWNATIVE with ETH
  await ethers.provider.send("hardhat_setBalance", [
    owner.address,
    ethers.toBeHex(ethers.parseEther("1000"))
  ]);

  await ethers.provider.send("hardhat_setBalance", [
    user.address,
    ethers.toBeHex(ethers.parseEther("1000"))
  ]);

  await ethers.provider.send("hardhat_setBalance", [
    admin.address,
    ethers.toBeHex(ethers.parseEther("1000"))
  ]);
  
  await ethers.provider.send("hardhat_setBalance", [
    await mockWNATIVE.getAddress(),
    ethers.toBeHex(ethers.parseEther("1000"))
  ]);

  // Deploy Burner
  const Burner = await ethers.getContractFactory("contracts/burner/URBurner.sol:Burner");
  const burner = await upgrades.deployProxy(Burner, [
    await mockUniversalRouter.getAddress(),
    await mockPermit2.getAddress(),
    await mockReceiver.getAddress(),
    await mockWNATIVE.getAddress(),
    await mockUSDC.getAddress(),
    feeCollector.address,
    40,
    400,
    4,
    100000, // minGasForSwap
    50, // maxTokensPerBurn
    false,
    false,
    admin.address
  ], {initializer: "initialize"});

  // Setup initial state
  await mockToken.mint(user.address, ethers.parseEther("1000"));
  
  // Approve tokens for both Burner and Permit2
  await mockToken.connect(user).approve(await burner.getAddress(), ethers.parseEther("1000"));
  await mockToken.connect(user).approve(await mockPermit2.getAddress(), ethers.parseEther("1000"));
  
  // Setup WNATIVE
  await mockWNATIVE.mint(await mockUniversalRouter.getAddress(), ethers.parseEther("1000"));
  await mockWNATIVE.connect(user).deposit({value: ethers.parseEther("500")});
  await mockWNATIVE.connect(user).approve(await burner.getAddress(), ethers.parseEther("1000"));
  await mockWNATIVE.connect(user).approve(await mockPermit2.getAddress(), ethers.parseEther("1000"));

  // Setup USDC
  await mockUSDC.mint(user.address, 1000 * 10 ** 6);

  // Setup mock return amount
  await mockUniversalRouter.setReturnAmount(ethers.parseEther("1"));

  // Pre-approve tokens in Permit2 for the Universal Router
  await mockPermit2.connect(user).approve(
    await mockToken.getAddress(),
    await mockUniversalRouter.getAddress(),
    ethers.parseEther("1000"),
    Math.floor(Date.now() / 1000) + 3600
  );
  
  await mockPermit2.connect(user).approve(
    await mockWNATIVE.getAddress(),
    await mockUniversalRouter.getAddress(),
    ethers.parseEther("1000"),
    Math.floor(Date.now() / 1000) + 3600
  );

  return {
    owner,
    feeCollector,
    referrer,
    user,
    solver,
    recipient,
    mockUniversalRouter,
    mockWNATIVE,
    mockUSDC,
    mockToken,
    mockPermit2,
    mockReceiver,
    burner,
    admin
  };
}

module.exports = {
  deployTestEnvironment
};