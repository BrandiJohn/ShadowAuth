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

  describe("User Registration", function () {
    it("Should register a user with encrypted multi-sig addresses", async function () {
      // Create encrypted input for 3 multi-sig addresses
      const input = fhevm.createEncryptedInput(await shadowAuth.getAddress(), aliceAddress);
      input.addAddress(bobAddress);     // signer1
      input.addAddress(charlieAddress); // signer2  
      input.addAddress(davidAddress);   // signer3
      const encryptedInput = await input.encrypt();

      // Register user
      await expect(
        shadowAuth.connect(alice).register(
          encryptedInput.handles[0], // encryptedSigner1
          encryptedInput.handles[1], // encryptedSigner2
          encryptedInput.handles[2], // encryptedSigner3
          encryptedInput.inputProof
        )
      ).to.emit(shadowAuth, "UserRegistered").withArgs(aliceAddress);

      // Check user is registered
      expect(await shadowAuth.isUserRegistered(aliceAddress)).to.be.true;
    });

    it("Should not register duplicate users", async function () {
      // Register user first time
      const input1 = fhevm.createEncryptedInput(await shadowAuth.getAddress(), aliceAddress);
      input1.addAddress(bobAddress);
      input1.addAddress(charlieAddress);
      input1.addAddress(davidAddress);
      const encryptedInput1 = await input1.encrypt();

      await shadowAuth.connect(alice).register(
        encryptedInput1.handles[0],
        encryptedInput1.handles[1],
        encryptedInput1.handles[2],
        encryptedInput1.inputProof
      );

      // Try to register again - should revert
      const input2 = fhevm.createEncryptedInput(await shadowAuth.getAddress(), aliceAddress);
      input2.addAddress(bobAddress);
      input2.addAddress(charlieAddress);
      input2.addAddress(davidAddress);
      const encryptedInput2 = await input2.encrypt();

      await expect(
        shadowAuth.connect(alice).register(
          encryptedInput2.handles[0],
          encryptedInput2.handles[1],
          encryptedInput2.handles[2],
          encryptedInput2.inputProof
        )
      ).to.be.revertedWithCustomError(shadowAuth, "AlreadyRegistered");
    });

    it("Should allow getting encrypted multi-sig addresses", async function () {
      // Register user
      const input = fhevm.createEncryptedInput(await shadowAuth.getAddress(), aliceAddress);
      input.addAddress(bobAddress);
      input.addAddress(charlieAddress);
      input.addAddress(davidAddress);
      const encryptedInput = await input.encrypt();

      await shadowAuth.connect(alice).register(
        encryptedInput.handles[0],
        encryptedInput.handles[1],
        encryptedInput.handles[2],
        encryptedInput.inputProof
      );

      // Get multi-sig addresses
      const signer0 = await shadowAuth.getMultiSigAddress(aliceAddress, 0);
      const signer1 = await shadowAuth.getMultiSigAddress(aliceAddress, 1);
      const signer2 = await shadowAuth.getMultiSigAddress(aliceAddress, 2);

      expect(signer0).to.not.be.null;
      expect(signer1).to.not.be.null;
      expect(signer2).to.not.be.null;
    });

    it("Should revert when getting multi-sig address for unregistered user", async function () {
      await expect(
        shadowAuth.getMultiSigAddress(bobAddress, 0)
      ).to.be.revertedWithCustomError(shadowAuth, "NotRegistered");
    });

    it("Should revert with invalid signer index", async function () {
      // Register user first
      const input = fhevm.createEncryptedInput(await shadowAuth.getAddress(), aliceAddress);
      input.addAddress(bobAddress);
      input.addAddress(charlieAddress);
      input.addAddress(davidAddress);
      const encryptedInput = await input.encrypt();

      await shadowAuth.connect(alice).register(
        encryptedInput.handles[0],
        encryptedInput.handles[1],
        encryptedInput.handles[2],
        encryptedInput.inputProof
      );

      await expect(
        shadowAuth.getMultiSigAddress(aliceAddress, 3)
      ).to.be.revertedWithCustomError(shadowAuth, "InvalidSignerIndex");
    });
  });

  describe("Deposits", function () {
    beforeEach(async function () {
      // Register user first
      const input = fhevm.createEncryptedInput(await shadowAuth.getAddress(), aliceAddress);
      input.addAddress(bobAddress);
      input.addAddress(charlieAddress);
      input.addAddress(davidAddress);
      const encryptedInput = await input.encrypt();

      await shadowAuth.connect(alice).register(
        encryptedInput.handles[0],
        encryptedInput.handles[1],
        encryptedInput.handles[2],
        encryptedInput.inputProof
      );
    });

    it("Should allow deposits from registered users", async function () {
      const depositAmount = ethers.parseEther("1.0");

      await expect(
        shadowAuth.connect(alice).deposit({ value: depositAmount })
      ).to.emit(shadowAuth, "Deposit").withArgs(aliceAddress, depositAmount);

      // Balance should be updated (encrypted)
      const balance = await shadowAuth.getBalance(aliceAddress);
      expect(balance).to.not.be.null;
    });

    it("Should not allow deposits from unregistered users", async function () {
      const depositAmount = ethers.parseEther("1.0");

      await expect(
        shadowAuth.connect(bob).deposit({ value: depositAmount })
      ).to.be.revertedWithCustomError(shadowAuth, "NotRegistered");
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
      const balance = await shadowAuth.getBalance(aliceAddress);
      expect(balance).to.not.be.null;
    });
  });

  describe("Withdrawal Limits", function () {
    let currentTimestamp: number;

    beforeEach(async function () {
      // Register user
      const input = fhevm.createEncryptedInput(await shadowAuth.getAddress(), aliceAddress);
      input.addAddress(bobAddress);
      input.addAddress(charlieAddress);
      input.addAddress(davidAddress);
      const encryptedInput = await input.encrypt();

      await shadowAuth.connect(alice).register(
        encryptedInput.handles[0],
        encryptedInput.handles[1],
        encryptedInput.handles[2],
        encryptedInput.inputProof
      );

      // Deposit funds
      await shadowAuth.connect(alice).deposit({ value: ethers.parseEther("2.0") });

      // Get current timestamp
      const block = await ethers.provider.getBlock("latest");
      currentTimestamp = block!.timestamp;
    });

    it("Should allow multi-sig addresses to set withdrawal limits", async function () {
      // Bob (signer 0) sets withdrawal limit
      const input = fhevm.createEncryptedInput(await shadowAuth.getAddress(), bobAddress);
      input.add64(ethers.parseEther("1.0")); // max amount
      const encryptedInput = await input.encrypt();

      const deadline = currentTimestamp + 3600; // 1 hour from now

      await expect(
        shadowAuth.connect(bob).setWithdrawalLimit(
          aliceAddress,
          0, // signer index
          encryptedInput.handles[0],
          deadline,
          encryptedInput.inputProof
        )
      ).to.emit(shadowAuth, "WithdrawalLimitSet").withArgs(aliceAddress, 0);

      // Check withdrawal limit was set
      const [maxAmount, deadlineStored, isSet] = await shadowAuth.getWithdrawalLimit(aliceAddress, 0);
      expect(maxAmount).to.not.be.null;
      expect(deadlineStored).to.equal(deadline);
      expect(isSet).to.be.true;
    });

    it("Should not allow setting withdrawal limit with past deadline", async function () {
      const input = fhevm.createEncryptedInput(await shadowAuth.getAddress(), bobAddress);
      input.add64(ethers.parseEther("1.0"));
      const encryptedInput = await input.encrypt();

      const pastDeadline = currentTimestamp - 3600; // 1 hour ago

      await expect(
        shadowAuth.connect(bob).setWithdrawalLimit(
          aliceAddress,
          0,
          encryptedInput.handles[0],
          pastDeadline,
          encryptedInput.inputProof
        )
      ).to.be.revertedWith("Deadline must be in the future");
    });

    it("Should not allow setting withdrawal limit for unregistered user", async function () {
      const input = fhevm.createEncryptedInput(await shadowAuth.getAddress(), bobAddress);
      input.add64(ethers.parseEther("1.0"));
      const encryptedInput = await input.encrypt();

      const deadline = currentTimestamp + 3600;

      await expect(
        shadowAuth.connect(bob).setWithdrawalLimit(
          davidAddress, // unregistered user
          0,
          encryptedInput.handles[0],
          deadline,
          encryptedInput.inputProof
        )
      ).to.be.revertedWithCustomError(shadowAuth, "NotRegistered");
    });

    it("Should revert with invalid signer index", async function () {
      const input = fhevm.createEncryptedInput(await shadowAuth.getAddress(), bobAddress);
      input.add64(ethers.parseEther("1.0"));
      const encryptedInput = await input.encrypt();

      const deadline = currentTimestamp + 3600;

      await expect(
        shadowAuth.connect(bob).setWithdrawalLimit(
          aliceAddress,
          3, // invalid index
          encryptedInput.handles[0],
          deadline,
          encryptedInput.inputProof
        )
      ).to.be.revertedWithCustomError(shadowAuth, "InvalidSignerIndex");
    });
  });

  describe("Withdrawals", function () {
    let currentTimestamp: number;

    beforeEach(async function () {
      // Register user
      const input = fhevm.createEncryptedInput(await shadowAuth.getAddress(), aliceAddress);
      input.addAddress(bobAddress);
      input.addAddress(charlieAddress);
      input.addAddress(davidAddress);
      const encryptedInput = await input.encrypt();

      await shadowAuth.connect(alice).register(
        encryptedInput.handles[0],
        encryptedInput.handles[1],
        encryptedInput.handles[2],
        encryptedInput.inputProof
      );

      // Deposit funds
      await shadowAuth.connect(alice).deposit({ value: ethers.parseEther("5.0") });

      // Get current timestamp
      const block = await ethers.provider.getBlock("latest");
      currentTimestamp = block!.timestamp;
    });

    it("Should allow withdrawal when all multi-sig limits are set", async function () {
      const withdrawAmount = ethers.parseEther("1.0");
      const deadline = currentTimestamp + 3600;

      // All three signers set withdrawal limits
      for (let i = 0; i < 3; i++) {
        const signer = [bob, charlie, david][i];
        const input = fhevm.createEncryptedInput(await shadowAuth.getAddress(), await signer.getAddress());
        input.add64(ethers.parseEther("2.0")); // max amount higher than withdraw amount
        const encryptedInput = await input.encrypt();

        await shadowAuth.connect(signer).setWithdrawalLimit(
          aliceAddress,
          i,
          encryptedInput.handles[0],
          deadline,
          encryptedInput.inputProof
        );
      }

      // Now Alice can withdraw
      const withdrawInput = fhevm.createEncryptedInput(await shadowAuth.getAddress(), aliceAddress);
      withdrawInput.add64(withdrawAmount);
      const withdrawEncrypted = await withdrawInput.encrypt();

      await expect(
        shadowAuth.connect(alice).withdraw(
          withdrawEncrypted.handles[0],
          withdrawEncrypted.inputProof
        )
      ).to.emit(shadowAuth, "Withdrawal").withArgs(aliceAddress, 0); // Amount is encrypted

      // Check withdrawal limits are cleared
      for (let i = 0; i < 3; i++) {
        const [, , isSet] = await shadowAuth.getWithdrawalLimit(aliceAddress, i);
        expect(isSet).to.be.false;
      }
    });

    it("Should not allow withdrawal without all multi-sig limits set", async function () {
      const withdrawAmount = ethers.parseEther("1.0");
      const deadline = currentTimestamp + 3600;

      // Only set limit for first signer
      const input = fhevm.createEncryptedInput(await shadowAuth.getAddress(), bobAddress);
      input.add64(ethers.parseEther("2.0"));
      const encryptedInput = await input.encrypt();

      await shadowAuth.connect(bob).setWithdrawalLimit(
        aliceAddress,
        0,
        encryptedInput.handles[0],
        deadline,
        encryptedInput.inputProof
      );

      // Try to withdraw - should not revert but won't transfer
      const withdrawInput = fhevm.createEncryptedInput(await shadowAuth.getAddress(), aliceAddress);
      withdrawInput.add64(withdrawAmount);
      const withdrawEncrypted = await withdrawInput.encrypt();

      await expect(
        shadowAuth.connect(alice).withdraw(
          withdrawEncrypted.handles[0],
          withdrawEncrypted.inputProof
        )
      ).to.be.revertedWith("All multi-sig limits must be set and valid");
    });

    it("Should not allow withdrawal from unregistered user", async function () {
      const withdrawAmount = ethers.parseEther("1.0");

      const withdrawInput = fhevm.createEncryptedInput(await shadowAuth.getAddress(), bobAddress);
      withdrawInput.add64(withdrawAmount);
      const withdrawEncrypted = await withdrawInput.encrypt();

      await expect(
        shadowAuth.connect(bob).withdraw(
          withdrawEncrypted.handles[0],
          withdrawEncrypted.inputProof
        )
      ).to.be.revertedWithCustomError(shadowAuth, "NotRegistered");
    });

    it("Should not allow withdrawal with expired deadlines", async function () {
      const withdrawAmount = ethers.parseEther("1.0");
      const pastDeadline = currentTimestamp - 3600; // 1 hour ago

      // Try to set withdrawal limit with past deadline (should fail)
      const input = fhevm.createEncryptedInput(await shadowAuth.getAddress(), bobAddress);
      input.add64(ethers.parseEther("2.0"));
      const encryptedInput = await input.encrypt();

      await expect(
        shadowAuth.connect(bob).setWithdrawalLimit(
          aliceAddress,
          0,
          encryptedInput.handles[0],
          pastDeadline,
          encryptedInput.inputProof
        )
      ).to.be.revertedWith("Deadline must be in the future");
    });
  });

  describe("View Functions", function () {
    beforeEach(async function () {
      // Register user
      const input = fhevm.createEncryptedInput(await shadowAuth.getAddress(), aliceAddress);
      input.addAddress(bobAddress);
      input.addAddress(charlieAddress);
      input.addAddress(davidAddress);
      const encryptedInput = await input.encrypt();

      await shadowAuth.connect(alice).register(
        encryptedInput.handles[0],
        encryptedInput.handles[1],
        encryptedInput.handles[2],
        encryptedInput.inputProof
      );
    });

    it("Should return encrypted balance for registered user", async function () {
      const balance = await shadowAuth.getBalance(aliceAddress);
      expect(balance).to.not.be.null;
    });

    it("Should return registration status", async function () {
      expect(await shadowAuth.isUserRegistered(aliceAddress)).to.be.true;
      expect(await shadowAuth.isUserRegistered(bobAddress)).to.be.false;
    });

    it("Should return withdrawal limit info", async function () {
      // Initially no limits set
      const [maxAmount, deadline, isSet] = await shadowAuth.getWithdrawalLimit(aliceAddress, 0);
      expect(maxAmount).to.not.be.null;
      expect(deadline).to.equal(0);
      expect(isSet).to.be.false;
    });

    it("Should revert for invalid withdrawal limit signer index", async function () {
      await expect(
        shadowAuth.getWithdrawalLimit(aliceAddress, 3)
      ).to.be.revertedWithCustomError(shadowAuth, "InvalidSignerIndex");
    });
  });
});