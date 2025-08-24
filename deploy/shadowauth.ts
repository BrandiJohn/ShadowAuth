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
  
};

func.tags = ["ShadowAuth"];

export default func;