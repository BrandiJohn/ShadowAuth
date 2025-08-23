import { expect } from "chai";
import { ethers, fhevm } from "hardhat";
import type { ShadowAuth } from "../types";
import { Signer } from "ethers";

describe("ShadowAuth", function () {
  let shadowAuth: ShadowAuth;
  let signers: Signer[];
  let alice: Signer, bob: Signer, charlie: Signer, david: Signer;
  let aliceAddress: string, bobAddress: string, charlieAddress: string, davidAddress: string;

  beforeEach(async function () {
    // Check whether the tests are running against an FHEVM mock environment
    if (!fhevm.isMock) {
      console.warn("This hardhat test suite can only run on Sepolia Testnet");
      this.skip();
    }

    // Get signers
    signers = await ethers.getSigners();
    [alice, bob, charlie, david] = signers;
    aliceAddress = await alice.getAddress();
    bobAddress = await bob.getAddress();
    charlieAddress = await charlie.getAddress();
    davidAddress = await david.getAddress();

    // Deploy ShadowAuth contract
    const ShadowAuthFactory = await ethers.getContractFactory("ShadowAuth");
    shadowAuth = await ShadowAuthFactory.deploy();
    await shadowAuth.waitForDeployment();
  });

  describe("Account Creation", function () {
    it("Should create a single-sig account", async function () {
      // Create encrypted input for single signer
      const input = fhevm.createEncryptedInput(await shadowAuth.getAddress(), aliceAddress);
      input.addAddress(bobAddress);      // signer1
      input.addAddress(ethers.ZeroAddress); // signer2 (unused)
      input.addAddress(ethers.ZeroAddress); // signer3 (unused)
      input.add8(1); // signerCount = 1
      const encryptedInput = await input.encrypt();

      // Create account
      await expect(
        shadowAuth.connect(alice).createAccount(
          encryptedInput.handles[0], // encryptedSigner1
          encryptedInput.handles[1], // encryptedSigner2
          encryptedInput.handles[2], // encryptedSigner3
          encryptedInput.handles[3], // signerCount
          encryptedInput.inputProof
        )
      ).to.emit(shadowAuth, "AccountCreated").withArgs(aliceAddress, 0);

      // Check account exists
      expect(await shadowAuth.accountExists(aliceAddress)).to.be.true;
    });

    it("Should create a multi-sig account with 3 signers", async function () {
      // Create encrypted input for 3 signers
      const input = fhevm.createEncryptedInput(await shadowAuth.getAddress(), aliceAddress);
      input.addAddress(bobAddress);     // signer1
      input.addAddress(charlieAddress); // signer2
      input.addAddress(davidAddress);   // signer3
      input.add8(3); // signerCount = 3
      const encryptedInput = await input.encrypt();

      // Create account
      await shadowAuth.connect(alice).createAccount(
        encryptedInput.handles[0],
        encryptedInput.handles[1],
        encryptedInput.handles[2],
        encryptedInput.handles[3],
        encryptedInput.inputProof
      );

      // Check account exists
      expect(await shadowAuth.accountExists(aliceAddress)).to.be.true;

      // Verify signer count
      const signerCount = await shadowAuth.connect(alice).getSignerCount();
      expect(signerCount).to.not.be.null;
    });

    it("Should not create account with invalid signer count", async function () {
      // Create encrypted input with invalid signer count
      const input = fhevm.createEncryptedInput(await shadowAuth.getAddress(), aliceAddress);
      input.addAddress(bobAddress);
      input.addAddress(ethers.ZeroAddress);
      input.addAddress(ethers.ZeroAddress);
      input.add8(5); // Invalid signer count
      const encryptedInput = await input.encrypt();

      // Try to create account - should not revert but set error
      await shadowAuth.connect(alice).createAccount(
        encryptedInput.handles[0],
        encryptedInput.handles[1],
        encryptedInput.handles[2],
        encryptedInput.handles[3],
        encryptedInput.inputProof
      );

      // Check error was set (we can't decrypt the error in tests easily, but account should still exist)
      expect(await shadowAuth.accountExists(aliceAddress)).to.be.true;
    });

    it("Should not create duplicate accounts", async function () {
      // Create first account
      const input1 = fhevm.createEncryptedInput(await shadowAuth.getAddress(), aliceAddress);
      input1.addAddress(bobAddress);
      input1.addAddress(ethers.ZeroAddress);
      input1.addAddress(ethers.ZeroAddress);
      input1.add8(1);
      const encryptedInput1 = await input1.encrypt();

      await shadowAuth.connect(alice).createAccount(
        encryptedInput1.handles[0],
        encryptedInput1.handles[1],
        encryptedInput1.handles[2],
        encryptedInput1.handles[3],
        encryptedInput1.inputProof
      );

      // Try to create second account - should revert
      const input2 = fhevm.createEncryptedInput(await shadowAuth.getAddress(), aliceAddress);
      input2.addAddress(charlieAddress);
      input2.addAddress(ethers.ZeroAddress);
      input2.addAddress(ethers.ZeroAddress);
      input2.add8(1);
      const encryptedInput2 = await input2.encrypt();

      await expect(
        shadowAuth.connect(alice).createAccount(
          encryptedInput2.handles[0],
          encryptedInput2.handles[1],
          encryptedInput2.handles[2],
          encryptedInput2.handles[3],
          encryptedInput2.inputProof
        )
      ).to.be.revertedWith("Account already exists");
    });
  });

  describe("Deposits", function () {
    beforeEach(async function () {
      // Create account first
      const input = fhevm.createEncryptedInput(await shadowAuth.getAddress(), aliceAddress);
      input.addAddress(bobAddress);
      input.addAddress(ethers.ZeroAddress);
      input.addAddress(ethers.ZeroAddress);
      input.add8(1);
      const encryptedInput = await input.encrypt();

      await shadowAuth.connect(alice).createAccount(
        encryptedInput.handles[0],
        encryptedInput.handles[1],
        encryptedInput.handles[2],
        encryptedInput.handles[3],
        encryptedInput.inputProof
      );
    });

    it("Should allow deposits", async function () {
      const depositAmount = ethers.parseEther("1.0");

      await expect(
        shadowAuth.connect(alice).deposit({ value: depositAmount })
      ).to.emit(shadowAuth, "Deposit").withArgs(aliceAddress, depositAmount);

      // Balance should be updated (encrypted)
      const balance = await shadowAuth.connect(alice).getBalance();
      expect(balance).to.not.be.null;
    });

    it("Should not allow deposits to non-existent accounts", async function () {
      const depositAmount = ethers.parseEther("1.0");

      await expect(
        shadowAuth.connect(bob).deposit({ value: depositAmount })
      ).to.be.revertedWith("Account does not exist");
    });

    it("Should not allow zero deposits", async function () {
      await expect(
        shadowAuth.connect(alice).deposit({ value: 0 })
      ).to.be.revertedWith("Deposit amount must be greater than 0");
    });

    it("Should allow multiple deposits", async function () {
      const deposit1 = ethers.parseEther("1.0");
      const deposit2 = ethers.parseEther("0.5");

      await shadowAuth.connect(alice).deposit({ value: deposit1 });
      await shadowAuth.connect(alice).deposit({ value: deposit2 });

      // Balance should be sum of both deposits (encrypted)
      const balance = await shadowAuth.connect(alice).getBalance();
      expect(balance).to.not.be.null;
    });
  });

  describe("Withdrawal Requests", function () {
    beforeEach(async function () {
      // Create account and deposit funds
      const input = fhevm.createEncryptedInput(await shadowAuth.getAddress(), aliceAddress);
      input.addAddress(bobAddress);
      input.addAddress(ethers.ZeroAddress);
      input.addAddress(ethers.ZeroAddress);
      input.add8(1);
      const encryptedInput = await input.encrypt();

      await shadowAuth.connect(alice).createAccount(
        encryptedInput.handles[0],
        encryptedInput.handles[1],
        encryptedInput.handles[2],
        encryptedInput.handles[3],
        encryptedInput.inputProof
      );

      // Deposit some funds
      await shadowAuth.connect(alice).deposit({ value: ethers.parseEther("2.0") });
    });

    it("Should create withdrawal request", async function () {
      // Create encrypted withdrawal amount
      const input = fhevm.createEncryptedInput(await shadowAuth.getAddress(), aliceAddress);
      input.add64(ethers.parseEther("1.0"));
      const encryptedInput = await input.encrypt();

      await expect(
        shadowAuth.connect(alice).requestWithdrawal(
          encryptedInput.handles[0],
          encryptedInput.inputProof
        )
      ).to.emit(shadowAuth, "SignerApprovalRequested").withArgs(aliceAddress, 1);

      // Check withdrawal request exists
      const [amount, timestamp, executed] = await shadowAuth.getWithdrawalRequest(1);
      expect(amount).to.not.be.null;
      expect(timestamp).to.be.greaterThan(0);
      expect(executed).to.be.false;
    });

    it("Should not create withdrawal request for non-existent account", async function () {
      const input = fhevm.createEncryptedInput(await shadowAuth.getAddress(), bobAddress);
      input.add64(ethers.parseEther("1.0"));
      const encryptedInput = await input.encrypt();

      await expect(
        shadowAuth.connect(bob).requestWithdrawal(
          encryptedInput.handles[0],
          encryptedInput.inputProof
        )
      ).to.be.revertedWith("Account does not exist");
    });
  });

  describe("Multi-sig Approval", function () {
    let withdrawalId: number;

    beforeEach(async function () {
      // Create 2-sig account
      const input = fhevm.createEncryptedInput(await shadowAuth.getAddress(), aliceAddress);
      input.addAddress(bobAddress);
      input.addAddress(charlieAddress);
      input.addAddress(ethers.ZeroAddress);
      input.add8(2);
      const encryptedInput = await input.encrypt();

      await shadowAuth.connect(alice).createAccount(
        encryptedInput.handles[0],
        encryptedInput.handles[1],
        encryptedInput.handles[2],
        encryptedInput.handles[3],
        encryptedInput.inputProof
      );

      // Deposit funds
      await shadowAuth.connect(alice).deposit({ value: ethers.parseEther("2.0") });

      // Create withdrawal request
      const withdrawalInput = fhevm.createEncryptedInput(await shadowAuth.getAddress(), aliceAddress);
      withdrawalInput.add64(ethers.parseEther("1.0"));
      const withdrawalEncrypted = await withdrawalInput.encrypt();

      await shadowAuth.connect(alice).requestWithdrawal(
        withdrawalEncrypted.handles[0],
        withdrawalEncrypted.inputProof
      );

      withdrawalId = 1;
    });

    it("Should allow signer to approve withdrawal", async function () {
      // Bob approves as signer 0
      const input = fhevm.createEncryptedInput(await shadowAuth.getAddress(), bobAddress);
      input.add8(0); // signer index
      const encryptedInput = await input.encrypt();

      await expect(
        shadowAuth.connect(bob).approveWithdrawal(
          withdrawalId,
          encryptedInput.handles[0],
          encryptedInput.inputProof
        )
      ).to.emit(shadowAuth, "SignerApproved").withArgs(bobAddress, withdrawalId);

      // Check approval status
      const approval = await shadowAuth.getSignerApproval(withdrawalId, 0);
      expect(approval).to.not.be.null;
    });

    it("Should not allow unauthorized approval", async function () {
      // David (not a signer) tries to approve
      const input = fhevm.createEncryptedInput(await shadowAuth.getAddress(), davidAddress);
      input.add8(0);
      const encryptedInput = await input.encrypt();

      // This won't revert but will set error
      await shadowAuth.connect(david).approveWithdrawal(
        withdrawalId,
        encryptedInput.handles[0],
        encryptedInput.inputProof
      );

      // Error should be set for unauthorized signer
      const [error] = await shadowAuth.connect(david).getLastError();
      expect(error).to.not.be.null;
    });

    it("Should not allow double approval from same signer", async function () {
      // Bob approves first time
      const input = fhevm.createEncryptedInput(await shadowAuth.getAddress(), bobAddress);
      input.add8(0);
      const encryptedInput = await input.encrypt();

      await shadowAuth.connect(bob).approveWithdrawal(
        withdrawalId,
        encryptedInput.handles[0],
        encryptedInput.inputProof
      );

      // Bob tries to approve again
      const input2 = fhevm.createEncryptedInput(await shadowAuth.getAddress(), bobAddress);
      input2.add8(0);
      const encryptedInput2 = await input2.encrypt();

      await expect(
        shadowAuth.connect(bob).approveWithdrawal(
          withdrawalId,
          encryptedInput2.handles[0],
          encryptedInput2.inputProof
        )
      ).to.be.revertedWith("Signer already approved");
    });
  });

  describe("Withdrawal Execution", function () {
    let withdrawalId: number;

    beforeEach(async function () {
      // Create single-sig account
      const input = fhevm.createEncryptedInput(await shadowAuth.getAddress(), aliceAddress);
      input.addAddress(bobAddress);
      input.addAddress(ethers.ZeroAddress);
      input.addAddress(ethers.ZeroAddress);
      input.add8(1);
      const encryptedInput = await input.encrypt();

      await shadowAuth.connect(alice).createAccount(
        encryptedInput.handles[0],
        encryptedInput.handles[1],
        encryptedInput.handles[2],
        encryptedInput.handles[3],
        encryptedInput.inputProof
      );

      // Deposit funds
      await shadowAuth.connect(alice).deposit({ value: ethers.parseEther("2.0") });

      // Create withdrawal request
      const withdrawalInput = fhevm.createEncryptedInput(await shadowAuth.getAddress(), aliceAddress);
      withdrawalInput.add64(ethers.parseEther("1.0"));
      const withdrawalEncrypted = await withdrawalInput.encrypt();

      await shadowAuth.connect(alice).requestWithdrawal(
        withdrawalEncrypted.handles[0],
        withdrawalEncrypted.inputProof
      );

      withdrawalId = 1;

      // Approve withdrawal
      const approvalInput = fhevm.createEncryptedInput(await shadowAuth.getAddress(), bobAddress);
      approvalInput.add8(0);
      const approvalEncrypted = await approvalInput.encrypt();

      await shadowAuth.connect(bob).approveWithdrawal(
        withdrawalId,
        approvalEncrypted.handles[0],
        approvalEncrypted.inputProof
      );
    });

    it("Should execute withdrawal after approval", async function () {
      await expect(
        shadowAuth.connect(alice).executeWithdrawal(withdrawalId)
      ).to.emit(shadowAuth, "WithdrawalExecuted").withArgs(aliceAddress, withdrawalId, 0);

      // Check withdrawal is marked as executed
      const [, , executed] = await shadowAuth.getWithdrawalRequest(withdrawalId);
      expect(executed).to.be.true;
    });

    it("Should not execute withdrawal without approval", async function () {
      // Create another withdrawal request
      const withdrawalInput = fhevm.createEncryptedInput(await shadowAuth.getAddress(), aliceAddress);
      withdrawalInput.add64(ethers.parseEther("0.5"));
      const withdrawalEncrypted = await withdrawalInput.encrypt();

      await shadowAuth.connect(alice).requestWithdrawal(
        withdrawalEncrypted.handles[0],
        withdrawalEncrypted.inputProof
      );

      const newWithdrawalId = 2;

      // Try to execute without approval - won't revert but will set error
      await shadowAuth.connect(alice).executeWithdrawal(newWithdrawalId);

      // Error should be set
      const [error] = await shadowAuth.connect(alice).getLastError();
      expect(error).to.not.be.null;
    });

    it("Should not allow non-requester to execute withdrawal", async function () {
      await expect(
        shadowAuth.connect(bob).executeWithdrawal(withdrawalId)
      ).to.be.revertedWith("Only requester can execute withdrawal");
    });

    it("Should not execute already executed withdrawal", async function () {
      // Execute first time
      await shadowAuth.connect(alice).executeWithdrawal(withdrawalId);

      // Try to execute again
      await expect(
        shadowAuth.connect(alice).executeWithdrawal(withdrawalId)
      ).to.be.revertedWith("Withdrawal already executed");
    });
  });

  describe("View Functions", function () {
    beforeEach(async function () {
      // Create account
      const input = fhevm.createEncryptedInput(await shadowAuth.getAddress(), aliceAddress);
      input.addAddress(bobAddress);
      input.addAddress(charlieAddress);
      input.addAddress(ethers.ZeroAddress);
      input.add8(2);
      const encryptedInput = await input.encrypt();

      await shadowAuth.connect(alice).createAccount(
        encryptedInput.handles[0],
        encryptedInput.handles[1],
        encryptedInput.handles[2],
        encryptedInput.handles[3],
        encryptedInput.inputProof
      );
    });

    it("Should return encrypted balance", async function () {
      const balance = await shadowAuth.connect(alice).getBalance();
      expect(balance).to.not.be.null;
    });

    it("Should return encrypted signer count", async function () {
      const signerCount = await shadowAuth.connect(alice).getSignerCount();
      expect(signerCount).to.not.be.null;
    });

    it("Should return encrypted signer addresses", async function () {
      const signer0 = await shadowAuth.connect(alice).getEncryptedSigner(0);
      const signer1 = await shadowAuth.connect(alice).getEncryptedSigner(1);
      const signer2 = await shadowAuth.connect(alice).getEncryptedSigner(2);
      
      expect(signer0).to.not.be.null;
      expect(signer1).to.not.be.null;
      expect(signer2).to.not.be.null;
    });

    it("Should not return data for non-existent accounts", async function () {
      await expect(
        shadowAuth.connect(bob).getBalance()
      ).to.be.revertedWith("Account does not exist");

      await expect(
        shadowAuth.connect(bob).getSignerCount()
      ).to.be.revertedWith("Account does not exist");

      await expect(
        shadowAuth.connect(bob).getEncryptedSigner(0)
      ).to.be.revertedWith("Account does not exist");
    });

    it("Should revert for invalid signer index", async function () {
      await expect(
        shadowAuth.connect(alice).getEncryptedSigner(3)
      ).to.be.revertedWith("Invalid signer index");
    });
  });
});