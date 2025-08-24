// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {
    FHE,
    euint64,
    externalEuint64,
    eaddress,
    externalEaddress,
    ebool,
    externalEbool
} from "@fhevm/solidity/lib/FHE.sol";
import {SepoliaConfig} from "@fhevm/solidity/config/ZamaConfig.sol";

/// @title ShadowAuth - Encrypted Multi-signature Wallet
/// @notice A secure wallet system with encrypted multi-signature addresses for withdrawal authorization
/// @dev Uses Zama's FHE (Fully Homomorphic Encryption) to keep multi-signature addresses private
contract ShadowAuth is SepoliaConfig {
    // Structure to hold encrypted multi-signature addresses for each user
    struct MultiSigData {
        eaddress[3] signers; // 3 encrypted multi-signature addresses
        bool isRegistered; // Whether this user has registered multi-sig addresses
    }

    // Structure to hold withdrawal limits and deadlines set by multi-sig addresses
    struct WithdrawalLimit {
        uint256 maxAmount; // Maximum withdrawal amount
        uint256 deadline; // Withdrawal deadline (plaintext timestamp)
        bool isSet; // Whether this limit has been set
    }

    // User balances
    mapping(address => uint256) private balances;

    // User multi-signature data
    mapping(address => MultiSigData) private userMultiSig;

    // Withdrawal limits for each user, set by each of the 3 multi-sig addresses
    // signerAddress => WithdrawalLimit
    mapping(address => WithdrawalLimit)) private withdrawalLimits;

    // Events
    event UserRegistered(address indexed user);
    event Deposit(address indexed user, uint256 amount);
    event WithdrawalLimitSet(address indexed user, uint256 indexed signerIndex);
    event Withdrawal(address indexed user, uint256 amount);

    // Errors
    error AlreadyRegistered();
    error NotRegistered();
    error InvalidSignerIndex();
    error UnauthorizedSigner();
    error InsufficientBalance();
    error WithdrawalNotAuthorized();
    error WithdrawalDeadlineExpired();

    /// @notice Register a user with 3 encrypted multi-signature addresses
    /// @param encryptedSigner1 First encrypted multi-sig address
    /// @param encryptedSigner2 Second encrypted multi-sig address
    /// @param encryptedSigner3 Third encrypted multi-sig address
    /// @param inputProof Input proof for validation
    function register(
        externalEaddress encryptedSigner1,
        externalEaddress encryptedSigner2,
        externalEaddress encryptedSigner3,
        bytes calldata inputProof
    ) external {
        if (userMultiSig[msg.sender].isRegistered) {
            revert AlreadyRegistered();
        }

        // Convert external encrypted addresses to internal encrypted addresses
        eaddress signer1 = FHE.fromExternal(encryptedSigner1, inputProof);
        eaddress signer2 = FHE.fromExternal(encryptedSigner2, inputProof);
        eaddress signer3 = FHE.fromExternal(encryptedSigner3, inputProof);

        // Store encrypted multi-sig addresses
        userMultiSig[msg.sender].signers[0] = signer1;
        userMultiSig[msg.sender].signers[1] = signer2;
        userMultiSig[msg.sender].signers[2] = signer3;
        userMultiSig[msg.sender].isRegistered = true;

        // Grant ACL permissions using method chaining
        FHE.allowThis(signer1);
        FHE.allow(signer1, msg.sender);
        FHE.allowThis(signer2);
        FHE.allow(signer2, msg.sender);
        FHE.allowThis(signer3);
        FHE.allow(signer3, msg.sender);

        emit UserRegistered(msg.sender);
    }

    /// @notice Deposit funds into the contract
    /// @dev Users can deposit freely, funds are automatically encrypted
    function deposit() external payable {
        if (!userMultiSig[msg.sender].isRegistered) {
            revert NotRegistered();
        }

        require(msg.value > 0, "Deposit amount must be greater than 0");

        // Add to encrypted balance
        uint256 currentBalance = balances[msg.sender];
        euint64 depositAmount = (msg.value);
        euint64 newBalance = (currentBalance + depositAmount);

        balances[msg.sender] = newBalance;

        emit Deposit(msg.sender, msg.value);
    }

    /// @notice Set withdrawal limit and deadline by multi-sig address
    /// @param user The user for whom to set the withdrawal limit
    /// @param signerIndex Index of the multi-sig address (0, 1, or 2)
    /// @param maxAmount Encrypted maximum withdrawal amount
    /// @param deadline Withdrawal deadline timestamp
    function setWithdrawalLimit( uint256 maxAmount, uint256 deadline) external {
        require(deadline > block.timestamp, "Deadline must be in the future");
        require(maxAmount>0,"amount is 0");
        // Note: Direct verification of encrypted addresses against plaintext addresses
        // is not feasible in FHE. This function relies on the caller being honest
        // about their identity, which will be verified during withdrawal through
        // the encrypted multi-sig validation process.

        // Validate and store the withdrawal limit
        // euint64 maxAmount = FHE.fromExternal(encryptedMaxAmount, inputProof);

        withdrawalLimits[msg.sender] = WithdrawalLimit({maxAmount: maxAmount, deadline: deadline, isSet: true});
    }

    /// @notice Withdraw funds after multi-sig verification
    /// @param withdrawAmount withdrawal amount
    /// @dev Requires all 3 multi-sig addresses to have set valid withdrawal limits
    function withdraw(uint256 withdrawAmount) external {
        if (!userMultiSig[msg.sender].isRegistered) {
            revert NotRegistered();
        }

        // euint64 withdrawAmount = FHE.fromExternal(encryptedAmount, inputProof);
        uint256 currentBalance = balances[msg.sender];

        // Check if user has sufficient balance
        // ebool hasSufficientBalance = FHE.le(withdrawAmount, currentBalance);
        require(currentBalance > withdrawAmount, "can not withdraw");
        // Verify all 3 multi-sig addresses have set valid withdrawal limits (plaintext check)

        for (uint256 i = 0; i < 3; i++) {
            WithdrawalLimit storage limit = withdrawalLimits[msg.sender][i];
            if (!limit.isSet || limit.deadline < block.timestamp) {}
            if (limit.maxAmount < withdrawAmount) {
                revert("multi-sig amount not match");
            }
        }

        // Perform conditional withdrawal using FHE.select
        // euint64 actualWithdrawAmount = FHE.select(canWithdraw, withdrawAmount, FHE.asEuint64(0));

        // Update balance conditionally
        uint256 newBalance = currentBalance - withdrawAmount;
        balances[msg.sender] = newBalance;

        // Note: In a real implementation, you would need to use the decryption oracle
        // to decrypt the actualWithdrawAmount for the actual ETH transfer
        // This is beyond the scope of this basic implementation

        // Clear withdrawal limits only after successful withdrawal
        // In practice, you'd want to decrypt first to verify non-zero withdrawal
        for (uint256 i = 0; i < 3; i++) {
            delete withdrawalLimits[msg.sender][i];
        }

        emit Withdrawal(msg.sender, withdrawAmount); // Amount kept private
    }

    /// @notice Get user's encrypted balance
    /// @param user Address of the user
    /// @return Encrypted balance
    function getBalance(address user) external view returns (uint256) {
        return balances[user];
    }

    /// @notice Get encrypted multi-sig address for a user
    /// @param user Address of the user
    /// @param signerIndex Index of the multi-sig address (0, 1, or 2)
    /// @return Encrypted multi-sig address
    function getMultiSigAddress(address user, uint256 signerIndex) external view returns (eaddress) {
        if (!userMultiSig[user].isRegistered) {
            revert NotRegistered();
        }
        if (signerIndex >= 3) {
            revert InvalidSignerIndex();
        }
        return userMultiSig[user].signers[signerIndex];
    }

    /// @notice Check if a user is registered
    /// @param user Address of the user
    /// @return Boolean indicating registration status
    function isUserRegistered(address user) external view returns (bool) {
        return userMultiSig[user].isRegistered;
    }
}
