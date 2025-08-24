import { DeployFunction } from "hardhat-deploy/types";
import { HardhatRuntimeEnvironment } from "hardhat/types";

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { deployments, getNamedAccounts } = hre;
  const { deploy } = deployments;

  const { deployer } = await getNamedAccounts();

  console.log("Deploying ShadowAuth with deployer:", deployer);

  const shadowAuth = await deploy("ShadowAuth", {
    from: deployer,
    args: [], // No constructor arguments
    log: true,
    autoMine: true, // Speed up deployment on local network (ganache, hardhat), no effect on live networks
  });

  console.log(`ShadowAuth contract deployed to: ${shadowAuth.address}`);
  console.log(`Transaction hash: ${shadowAuth.transactionHash}`);
  
  // Verify contract on Etherscan if not on local network
  if (hre.network.name !== "hardhat" && hre.network.name !== "localhost") {
    console.log("Waiting for block confirmations...");
    // Wait for 6 confirmations for verification
    await hre.ethers.provider.waitForTransaction(shadowAuth.transactionHash!, 6);
    
    console.log("Verifying contract...");
    try {
      await hre.run("verify:verify", {
        address: shadowAuth.address,
        constructorArguments: [],
      });
      console.log("Contract verified successfully!");
    } catch (error) {
      console.log("Verification failed:", error);
    }
  }
};

func.tags = ["ShadowAuth"];

export default func;