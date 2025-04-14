const { ethers } = require("hardhat");

async function deployTestEnvironment() {
  const [owner, feeCollector, user, solver, referrer, recipient, admin] = await ethers.getSigners();

  const MockWNATIVE = await ethers.getContractFactory("MockWNATIVE");
  const mockWNATIVE = await MockWNATIVE.deploy();

  const MockUSDC = await ethers.getContractFactory("MockUSDC");
  const mockUSDC = await MockUSDC.deploy();

  const MockToken = await ethers.getContractFactory("MockToken");
  const mockToken = await MockToken.deploy("MockToken", "MTK");

  // Deploy mock LBRouter (simplified, without factories)
  const MockLBRouter = await ethers.getContractFactory("MockLBRouter");
  const mockLBRouter = await MockLBRouter.deploy(
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
  const Burner = await ethers.getContractFactory("contracts/burner/AVAXBurner.sol:AVAXBurner");
  const burner = await upgrades.deployProxy(Burner, [
    await mockLBRouter.getAddress(),
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
  ], {initializer: "initializeBurner"});

  // Setup initial state
  await mockToken.mint(user.address, ethers.parseEther("1000"));
  
  // Approve tokens for Burner
  await mockToken.connect(user).approve(await burner.getAddress(), ethers.parseEther("1000"));
  
  // Setup WNATIVE
  await mockWNATIVE.mint(await mockLBRouter.getAddress(), ethers.parseEther("1000"));
  await mockWNATIVE.connect(user).deposit({value: ethers.parseEther("500")});
  await mockWNATIVE.connect(user).approve(await burner.getAddress(), ethers.parseEther("1000"));

  // Setup USDC
  await mockUSDC.mint(user.address, 1000 * 10 ** 6);

  // Setup mock return amount
  await mockLBRouter.setReturnAmount(ethers.parseEther("1"));

  return {
    owner,
    feeCollector,
    referrer,
    user,
    solver,
    recipient,
    mockLBRouter,
    mockWNATIVE,
    mockUSDC,
    mockToken,
    mockReceiver,
    burner,
    admin
  };
}

module.exports = {
  deployTestEnvironment
};