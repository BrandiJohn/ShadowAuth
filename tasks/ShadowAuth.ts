import { task } from "hardhat/config";
import type { TaskArguments } from "hardhat/types";

// Task to register a new user with encrypted multi-sig addresses
task("shadowauth:register")
  .addParam("contract", "The deployed ShadowAuth contract address")
  .addParam("signer1", "First signer address")
  .addParam("signer2", "Second signer address")
  .addParam("signer3", "Third signer address")
  .setDescription("Register a new ShadowAuth user with encrypted multi-sig addresses")
  .setAction(async function (taskArguments: TaskArguments, hre) {
    const { ethers, fhevm } = hre;
    const { contract, signer1, signer2, signer3 } = taskArguments;
    
    await fhevm.initializeCLIApi();
    
    const [deployer] = await ethers.getSigners();
    console.log("Registering user:", await deployer.getAddress());
    
    const shadowAuth = await ethers.getContractAt("ShadowAuth", contract);
    
    // Create encrypted input
    const input = fhevm.createEncryptedInput(contract, await deployer.getAddress());
    input.addAddress(signer1);
    input.addAddress(signer2);
    input.addAddress(signer3);
    const encryptedInput = await input.encrypt();
    
    console.log("Registering user with encrypted multi-sig addresses...");
    const tx = await shadowAuth.register(
      encryptedInput.handles[0],
      encryptedInput.handles[1], 
      encryptedInput.handles[2],
      encryptedInput.inputProof
    );
    
    console.log("Transaction hash:", tx.hash);
    await tx.wait();
    console.log("User registered successfully!");
  });

// Task to deposit funds
task("shadowauth:deposit")
  .addParam("contract", "The deployed ShadowAuth contract address")
  .addParam("amount", "Amount to deposit (in ETH)")
  .setDescription("Deposit ETH into your ShadowAuth account")
  .setAction(async function (taskArguments: TaskArguments, hre) {
    const { ethers } = hre;
    const { contract, amount } = taskArguments;
    
    const [deployer] = await ethers.getSigners();
    console.log("Depositing with account:", await deployer.getAddress());
    
    const shadowAuth = await ethers.getContractAt("ShadowAuth", contract);
    
    const depositAmount = ethers.parseEther(amount);
    console.log(`Depositing ${amount} ETH...`);
    
    const tx = await shadowAuth.deposit({ value: depositAmount });
    console.log("Transaction hash:", tx.hash);
    await tx.wait();
    console.log("Deposit successful!");
  });

// Task to set withdrawal limit (for multi-sig addresses)
task("shadowauth:set-withdrawal-limit")
  .addParam("contract", "The deployed ShadowAuth contract address")
  .addParam("maxamount", "Maximum withdrawal amount (in ETH)")
  .addParam("deadline", "Deadline timestamp (seconds since epoch)")
  .setDescription("Set withdrawal limit and deadline (called by multi-sig address)")
  .setAction(async function (taskArguments: TaskArguments, hre) {
    const { ethers } = hre;
    const { contract, maxamount, deadline } = taskArguments;
    
    const [deployer] = await ethers.getSigners();
    console.log("Setting withdrawal limit with signer:", await deployer.getAddress());
    
    const shadowAuth = await ethers.getContractAt("ShadowAuth", contract);
    
    const maxAmountWei = ethers.parseEther(maxamount);
    
    console.log(`Setting withdrawal limit of ${maxamount} ETH with deadline ${deadline}...`);
    const tx = await shadowAuth.setWithdrawalLimit(maxAmountWei, parseInt(deadline));
    
    console.log("Transaction hash:", tx.hash);
    await tx.wait();
    console.log("Withdrawal limit set successfully!");
  });

// Task to request withdrawal (first step)
task("shadowauth:request-withdrawal")
  .addParam("contract", "The deployed ShadowAuth contract address")
  .addParam("amount", "Amount to withdraw (in ETH)")
  .setDescription("Request withdrawal - first step that initiates decryption")
  .setAction(async function (taskArguments: TaskArguments, hre) {
    const { ethers } = hre;
    const { contract, amount } = taskArguments;
    
    const [deployer] = await ethers.getSigners();
    console.log("Requesting withdrawal with account:", await deployer.getAddress());
    
    const shadowAuth = await ethers.getContractAt("ShadowAuth", contract);
    
    const withdrawAmount = ethers.parseEther(amount);
    
    console.log(`Requesting withdrawal of ${amount} ETH...`);
    const tx = await shadowAuth.requestWithdrawal(withdrawAmount);
    
    console.log("Transaction hash:", tx.hash);
    await tx.wait();
    console.log("Withdrawal request submitted! Wait for decryption callback to complete.");
  });

// Task to execute withdrawal (second step)
task("shadowauth:execute-withdrawal")
  .addParam("contract", "The deployed ShadowAuth contract address")
  .setDescription("Execute withdrawal after multi-sig verification is complete")
  .setAction(async function (taskArguments: TaskArguments, hre) {
    const { ethers } = hre;
    const { contract } = taskArguments;
    
    const [deployer] = await ethers.getSigners();
    console.log("Executing withdrawal with account:", await deployer.getAddress());
    
    const shadowAuth = await ethers.getContractAt("ShadowAuth", contract);
    
    console.log("Executing withdrawal...");
    const tx = await shadowAuth.executeWithdrawal();
    
    console.log("Transaction hash:", tx.hash);
    await tx.wait();
    console.log("Withdrawal executed successfully!");
  });


// Task to check if user is registered
task("shadowauth:check-registration")
  .addParam("contract", "The deployed ShadowAuth contract address")
  .addOptionalParam("address", "Address to check (defaults to deployer)")
  .setDescription("Check if a user is registered")
  .setAction(async function (taskArguments: TaskArguments, hre) {
    const { ethers } = hre;
    const { contract, address } = taskArguments;
    
    const [deployer] = await ethers.getSigners();
    const checkAddress = address || await deployer.getAddress();
    
    const shadowAuth = await ethers.getContractAt("ShadowAuth", contract);
    
    const isRegistered = await shadowAuth.isUserRegistered(checkAddress);
    console.log(`User ${checkAddress} is registered:`, isRegistered);
  });

// Task to get balance (plaintext)
task("shadowauth:get-balance")
  .addParam("contract", "The deployed ShadowAuth contract address")
  .addOptionalParam("address", "Address to get balance for (defaults to deployer)")
  .setDescription("Get balance for a user")
  .setAction(async function (taskArguments: TaskArguments, hre) {
    const { ethers } = hre;
    const { contract, address } = taskArguments;
    
    const [deployer] = await ethers.getSigners();
    const userAddress = address || await deployer.getAddress();
    console.log("Getting balance for account:", userAddress);
    
    const shadowAuth = await ethers.getContractAt("ShadowAuth", contract);
    
    try {
      const balance = await shadowAuth.getBalance(userAddress);
      console.log("Balance:", ethers.formatEther(balance), "ETH");
    } catch (error: any) {
      console.log("Error getting balance:", error.message);
    }
  });

// Task to get withdrawal limit info
task("shadowauth:get-withdrawal-limit")
  .addParam("contract", "The deployed ShadowAuth contract address")
  .addParam("signer", "Signer address")
  .setDescription("Get withdrawal limit information for a signer")
  .setAction(async function (taskArguments: TaskArguments, hre) {
    const { ethers } = hre;
    const { contract, signer } = taskArguments;
    
    const shadowAuth = await ethers.getContractAt("ShadowAuth", contract);
    
    try {
      const [maxAmount, deadline, isSet] = await shadowAuth.getWithdrawalLimit(signer);
      console.log("Withdrawal Limit Info for signer", signer, ":");
      console.log("- Max Amount:", ethers.formatEther(maxAmount), "ETH");
      console.log("- Deadline:", new Date(Number(deadline) * 1000).toISOString());
      console.log("- Is Set:", isSet);
    } catch (error: any) {
      console.log("Error getting withdrawal limit:", error.message);
    }
  });

// Task to get multi-sig address
task("shadowauth:get-multisig-address")
  .addParam("contract", "The deployed ShadowAuth contract address")
  .addParam("user", "User address")
  .addParam("signerindex", "Signer index (0, 1, or 2)")
  .setDescription("Get encrypted multi-sig address")
  .setAction(async function (taskArguments: TaskArguments, hre) {
    const { ethers } = hre;
    const { contract, user, signerindex } = taskArguments;
    
    const shadowAuth = await ethers.getContractAt("ShadowAuth", contract);
    
    try {
      const multiSigAddress = await shadowAuth.getMultiSigAddress(user, parseInt(signerindex));
      console.log(`Multi-sig Address ${signerindex} for user ${user}:`);
      console.log("- Encrypted Address Handle:", multiSigAddress);
      console.log("Note: To see the actual address value, you need to decrypt it using the fhevm SDK");
    } catch (error: any) {
      console.log("Error getting multi-sig address:", error.message);
    }
  });

// Task to get withdrawal request status
task("shadowauth:get-withdrawal-request")
  .addParam("contract", "The deployed ShadowAuth contract address")
  .addOptionalParam("address", "Address to check (defaults to deployer)")
  .setDescription("Get withdrawal request status for a user")
  .setAction(async function (taskArguments: TaskArguments, hre) {
    const { ethers } = hre;
    const { contract, address } = taskArguments;
    
    const [deployer] = await ethers.getSigners();
    const userAddress = address || await deployer.getAddress();
    console.log("Getting withdrawal request for account:", userAddress);
    
    const shadowAuth = await ethers.getContractAt("ShadowAuth", contract);
    
    try {
      const [amount, requestId, isPending, canWithdraw, isProcessed] = await shadowAuth.getWithdrawalRequest(userAddress);
      console.log("Withdrawal Request Status:");
      console.log("- Amount:", ethers.formatEther(amount), "ETH");
      console.log("- Request ID:", requestId.toString());
      console.log("- Is Pending:", isPending);
      console.log("- Can Withdraw:", canWithdraw);
      console.log("- Is Processed:", isProcessed);
      
      if (isPending && !isProcessed) {
        console.log("\nStatus: Waiting for decryption callback...");
      } else if (isPending && isProcessed && canWithdraw) {
        console.log("\nStatus: Ready to execute withdrawal!");
      } else if (isPending && isProcessed && !canWithdraw) {
        console.log("\nStatus: Withdrawal not authorized by multi-sig addresses");
      } else if (!isPending) {
        console.log("\nStatus: No active withdrawal request");
      }
    } catch (error: any) {
      console.log("Error getting withdrawal request:", error.message);
    }
  });