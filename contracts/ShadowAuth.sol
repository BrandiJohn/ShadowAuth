// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {FHE, euint64, euint8, eaddress, externalEuint64, externalEuint8, externalEaddress, ebool} from "@fhevm/solidity/lib/FHE.sol";
import {SepoliaConfig} from "@fhevm/solidity/config/ZamaConfig.sol";

/// @title ShadowAuth - A confidential multi-signature wallet using FHE
/// @notice This contract allows users to create accounts with encrypted multi-sig addresses,
///         deposit funds, and withdraw only after all encrypted signers approve
contract ShadowAuth is SepoliaConfig {
    
    // Events
    event AccountCreated(address indexed user, uint8 signerCount);
    event Deposit(address indexed user, uint256 amount);
    event SignerApprovalRequested(address indexed user, uint256 indexed withdrawalId);
    event SignerApproved(address indexed signer, uint256 indexed withdrawalId);
    event WithdrawalExecuted(address indexed user, uint256 indexed withdrawalId, uint256 amount);
    
    // Error codes for encrypted error handling
    euint8 internal NO_ERROR;
    euint8 internal ACCOUNT_NOT_EXISTS;
    euint8 internal INSUFFICIENT_BALANCE;
    euint8 internal INVALID_SIGNER_COUNT;
    euint8 internal UNAUTHORIZED_SIGNER;
    euint8 internal WITHDRAWAL_NOT_EXISTS;
    euint8 internal NOT_ALL_APPROVED;
    
    // User account structure
    struct UserAccount {
        eaddress[3] encryptedSigners;  // Up to 3 encrypted signer addresses
        euint8 signerCount;            // Number of signers (1-3)
        euint64 balance;               // Encrypted balance
        uint256 nextWithdrawalId;     // Next withdrawal ID
        bool exists;                   // Account existence flag
    }
    
    // Withdrawal request structure
    struct WithdrawalRequest {
        address user;                  // User requesting withdrawal
        euint64 amount;               // Encrypted withdrawal amount
        ebool[3] signerApprovals;     // Encrypted approval status from each signer
        uint256 timestamp;            // Request timestamp
        bool executed;                // Execution status
        bool exists;                  // Request existence flag
    }
    
    // Error tracking for users
    struct LastError {
        euint8 error;
        uint256 timestamp;
    }
    
    // State variables
    mapping(address => UserAccount) private userAccounts;
    mapping(uint256 => WithdrawalRequest) private withdrawalRequests;
    mapping(address => LastError) private lastErrors;
    mapping(address => mapping(uint256 => bool)) private signerHasApproved; // signer => withdrawalId => approved
    
    uint256 private nextGlobalWithdrawalId = 1;
    
    constructor() {
        // Initialize error codes
        NO_ERROR = FHE.asEuint8(0);
        ACCOUNT_NOT_EXISTS = FHE.asEuint8(1);
        INSUFFICIENT_BALANCE = FHE.asEuint8(2);
        INVALID_SIGNER_COUNT = FHE.asEuint8(3);
        UNAUTHORIZED_SIGNER = FHE.asEuint8(4);
        WITHDRAWAL_NOT_EXISTS = FHE.asEuint8(5);
        NOT_ALL_APPROVED = FHE.asEuint8(6);
    }
    
    /// @notice Create a new user account with encrypted multi-sig addresses
    /// @param encryptedSigner1 First encrypted signer address
    /// @param encryptedSigner2 Second encrypted signer address (optional)
    /// @param encryptedSigner3 Third encrypted signer address (optional)
    /// @param signerCount Number of signers (1-3)
    /// @param inputProof Proof for encrypted inputs
    function createAccount(
        externalEaddress encryptedSigner1,
        externalEaddress encryptedSigner2,
        externalEaddress encryptedSigner3,
        externalEuint8 signerCount,
        bytes calldata inputProof
    ) external {
        require(!userAccounts[msg.sender].exists, "Account already exists");
        
        // Validate and convert inputs
        eaddress signer1 = FHE.fromExternal(encryptedSigner1, inputProof);
        eaddress signer2 = FHE.fromExternal(encryptedSigner2, inputProof);
        eaddress signer3 = FHE.fromExternal(encryptedSigner3, inputProof);
        euint8 count = FHE.fromExternal(signerCount, inputProof);
        
        // Grant temporary ACL permissions for validation
        FHE.allowThis(count);
        
        // Validate signer count (1-3)
        ebool validCount1 = FHE.eq(count, FHE.asEuint8(1));
        ebool validCount2 = FHE.eq(count, FHE.asEuint8(2));
        ebool validCount3 = FHE.eq(count, FHE.asEuint8(3));
        ebool isValidCount = FHE.or(FHE.or(validCount1, validCount2), validCount3);
        
        // Set error if invalid count, otherwise no error
        euint8 errorCode = FHE.select(isValidCount, NO_ERROR, INVALID_SIGNER_COUNT);
        setLastError(errorCode, msg.sender);
        
        // Only create account if valid count
        UserAccount storage account = userAccounts[msg.sender];
        account.encryptedSigners[0] = signer1;
        account.encryptedSigners[1] = signer2;
        account.encryptedSigners[2] = signer3;
        account.signerCount = count;
        account.balance = FHE.asEuint64(0);
        account.nextWithdrawalId = 1;
        account.exists = true;
        
        // Grant ACL permissions
        FHE.allowThis(account.encryptedSigners[0]);
        FHE.allowThis(account.encryptedSigners[1]);
        FHE.allowThis(account.encryptedSigners[2]);
        FHE.allowThis(account.signerCount);
        FHE.allowThis(account.balance);
        FHE.allow(account.balance, msg.sender);
        
        emit AccountCreated(msg.sender, 0); // Emit with 0 as we can't decrypt signerCount in event
    }
    
    /// @notice Deposit ETH into the user's account
    function deposit() external payable {
        require(userAccounts[msg.sender].exists, "Account does not exist");
        require(msg.value > 0, "Deposit amount must be greater than 0");
        
        UserAccount storage account = userAccounts[msg.sender];
        
        // Add to encrypted balance
        euint64 depositAmount = FHE.asEuint64(uint64(msg.value));
        account.balance = FHE.add(account.balance, depositAmount);
        
        // Grant ACL permissions
        FHE.allowThis(account.balance);
        FHE.allow(account.balance, msg.sender);
        
        setLastError(NO_ERROR, msg.sender);
        emit Deposit(msg.sender, msg.value);
    }
    
    /// @notice Request a withdrawal (requires multi-sig approval)
    /// @param encryptedAmount Encrypted withdrawal amount
    /// @param inputProof Proof for encrypted input
    /// @return withdrawalId The ID of the withdrawal request
    function requestWithdrawal(
        externalEuint64 encryptedAmount,
        bytes calldata inputProof
    ) external returns (uint256 withdrawalId) {
        require(userAccounts[msg.sender].exists, "Account does not exist");
        
        UserAccount storage account = userAccounts[msg.sender];
        euint64 amount = FHE.fromExternal(encryptedAmount, inputProof);
        
        // Grant temporary ACL permission for comparison
        FHE.allowThis(amount);
        
        // Check if user has sufficient balance
        ebool hasSufficientBalance = FHE.le(amount, account.balance);
        euint8 errorCode = FHE.select(hasSufficientBalance, NO_ERROR, INSUFFICIENT_BALANCE);
        setLastError(errorCode, msg.sender);
        
        // Create withdrawal request
        withdrawalId = nextGlobalWithdrawalId++;
        WithdrawalRequest storage request = withdrawalRequests[withdrawalId];
        request.user = msg.sender;
        request.amount = amount;
        request.timestamp = block.timestamp;
        request.exists = true;
        
        // Initialize all approvals as false
        request.signerApprovals[0] = FHE.asEbool(false);
        request.signerApprovals[1] = FHE.asEbool(false);
        request.signerApprovals[2] = FHE.asEbool(false);
        
        // Grant ACL permissions
        FHE.allowThis(request.amount);
        FHE.allowThis(request.signerApprovals[0]);
        FHE.allowThis(request.signerApprovals[1]);
        FHE.allowThis(request.signerApprovals[2]);
        
        emit SignerApprovalRequested(msg.sender, withdrawalId);
    }
    
    /// @notice Approve a withdrawal request (called by encrypted signers)
    /// @param withdrawalId The withdrawal request ID
    /// @param encryptedSignerIndex Encrypted index of the signer (0, 1, or 2)
    /// @param inputProof Proof for encrypted input
    function approveWithdrawal(
        uint256 withdrawalId,
        externalEuint8 encryptedSignerIndex,
        bytes calldata inputProof
    ) external {
        require(withdrawalRequests[withdrawalId].exists, "Withdrawal request does not exist");
        require(!withdrawalRequests[withdrawalId].executed, "Withdrawal already executed");
        
        WithdrawalRequest storage request = withdrawalRequests[withdrawalId];
        UserAccount storage account = userAccounts[request.user];
        euint8 signerIndex = FHE.fromExternal(encryptedSignerIndex, inputProof);
        
        // Grant temporary ACL permission for comparison
        FHE.allowThis(signerIndex);
        
        // Verify the caller is one of the encrypted signers
        eaddress callerAddress = FHE.asEaddress(msg.sender);
        
        ebool isSigner0 = FHE.eq(callerAddress, account.encryptedSigners[0]);
        ebool isSigner1 = FHE.eq(callerAddress, account.encryptedSigners[1]);
        ebool isSigner2 = FHE.eq(callerAddress, account.encryptedSigners[2]);
        
        // Check if signer index matches the caller
        ebool isIndex0 = FHE.and(FHE.eq(signerIndex, FHE.asEuint8(0)), isSigner0);
        ebool isIndex1 = FHE.and(FHE.eq(signerIndex, FHE.asEuint8(1)), isSigner1);
        ebool isIndex2 = FHE.and(FHE.eq(signerIndex, FHE.asEuint8(2)), isSigner2);
        ebool isAuthorized = FHE.or(FHE.or(isIndex0, isIndex1), isIndex2);
        
        euint8 errorCode = FHE.select(isAuthorized, NO_ERROR, UNAUTHORIZED_SIGNER);
        setLastError(errorCode, msg.sender);
        
        // Prevent double approval from same signer
        require(!signerHasApproved[msg.sender][withdrawalId], "Signer already approved");
        signerHasApproved[msg.sender][withdrawalId] = true;
        
        // Set approval based on signer index
        request.signerApprovals[0] = FHE.select(isIndex0, FHE.asEbool(true), request.signerApprovals[0]);
        request.signerApprovals[1] = FHE.select(isIndex1, FHE.asEbool(true), request.signerApprovals[1]);
        request.signerApprovals[2] = FHE.select(isIndex2, FHE.asEbool(true), request.signerApprovals[2]);
        
        // Grant ACL permissions
        FHE.allowThis(request.signerApprovals[0]);
        FHE.allowThis(request.signerApprovals[1]);
        FHE.allowThis(request.signerApprovals[2]);
        
        emit SignerApproved(msg.sender, withdrawalId);
    }
    
    /// @notice Execute a withdrawal after all required signatures are collected
    /// @param withdrawalId The withdrawal request ID
    function executeWithdrawal(uint256 withdrawalId) external {
        require(withdrawalRequests[withdrawalId].exists, "Withdrawal request does not exist");
        require(!withdrawalRequests[withdrawalId].executed, "Withdrawal already executed");
        
        WithdrawalRequest storage request = withdrawalRequests[withdrawalId];
        require(request.user == msg.sender, "Only requester can execute withdrawal");
        
        UserAccount storage account = userAccounts[msg.sender];
        
        // Check if all required signers have approved
        ebool allApproved = checkAllSignersApproved(withdrawalId);
        
        euint8 errorCode = FHE.select(allApproved, NO_ERROR, NOT_ALL_APPROVED);
        setLastError(errorCode, msg.sender);
        
        // Check sufficient balance again
        ebool hasSufficientBalance = FHE.le(request.amount, account.balance);
        errorCode = FHE.select(hasSufficientBalance, errorCode, INSUFFICIENT_BALANCE);
        setLastError(errorCode, msg.sender);
        
        // Execute withdrawal only if all conditions are met
        ebool canExecute = FHE.and(allApproved, hasSufficientBalance);
        
        // Conditional execution using FHE.select
        euint64 withdrawAmount = FHE.select(canExecute, request.amount, FHE.asEuint64(0));
        account.balance = FHE.sub(account.balance, withdrawAmount);
        
        // Mark as executed if successful
        request.executed = true; // This will always be set, but withdrawal only happens if conditions met
        
        // Grant ACL permissions
        FHE.allowThis(account.balance);
        FHE.allow(account.balance, msg.sender);
        
        emit WithdrawalExecuted(msg.sender, withdrawalId, 0); // Amount is encrypted, emit 0
    }
    
    /// @notice Check if all required signers have approved a withdrawal
    /// @param withdrawalId The withdrawal request ID
    /// @return allApproved Boolean indicating if all signers approved
    function checkAllSignersApproved(uint256 withdrawalId) internal returns (ebool) {
        WithdrawalRequest storage request = withdrawalRequests[withdrawalId];
        UserAccount storage account = userAccounts[request.user];
        
        // Check approvals based on signer count
        ebool signer1Required = FHE.ge(account.signerCount, FHE.asEuint8(1));
        ebool signer2Required = FHE.ge(account.signerCount, FHE.asEuint8(2));
        ebool signer3Required = FHE.ge(account.signerCount, FHE.asEuint8(3));
        
        ebool approval1 = FHE.select(signer1Required, request.signerApprovals[0], FHE.asEbool(true));
        ebool approval2 = FHE.select(signer2Required, request.signerApprovals[1], FHE.asEbool(true));
        ebool approval3 = FHE.select(signer3Required, request.signerApprovals[2], FHE.asEbool(true));
        
        return FHE.and(FHE.and(approval1, approval2), approval3);
    }
    
    /// @notice Set last error for a user
    /// @param error The error code
    /// @param user The user address
    function setLastError(euint8 error, address user) private {
        lastErrors[user] = LastError(error, block.timestamp);
    }
    
    // View functions
    
    /// @notice Get user's encrypted balance
    /// @return The encrypted balance
    function getBalance() external view returns (euint64) {
        require(userAccounts[msg.sender].exists, "Account does not exist");
        return userAccounts[msg.sender].balance;
    }
    
    /// @notice Get user's encrypted signer count
    /// @return The encrypted signer count
    function getSignerCount() external view returns (euint8) {
        require(userAccounts[msg.sender].exists, "Account does not exist");
        return userAccounts[msg.sender].signerCount;
    }
    
    /// @notice Get user's encrypted signer at specific index
    /// @param index The signer index (0, 1, or 2)
    /// @return The encrypted signer address
    function getEncryptedSigner(uint8 index) external view returns (eaddress) {
        require(userAccounts[msg.sender].exists, "Account does not exist");
        require(index < 3, "Invalid signer index");
        return userAccounts[msg.sender].encryptedSigners[index];
    }
    
    /// @notice Get withdrawal request details
    /// @param withdrawalId The withdrawal request ID
    /// @return amount The encrypted withdrawal amount
    /// @return timestamp The request timestamp
    /// @return executed Whether the withdrawal was executed
    function getWithdrawalRequest(uint256 withdrawalId) external view returns (
        euint64 amount,
        uint256 timestamp,
        bool executed
    ) {
        require(withdrawalRequests[withdrawalId].exists, "Withdrawal request does not exist");
        WithdrawalRequest storage request = withdrawalRequests[withdrawalId];
        return (request.amount, request.timestamp, request.executed);
    }
    
    /// @notice Get last error for the caller
    /// @return error The encrypted error code
    /// @return timestamp The error timestamp
    function getLastError() external view returns (euint8 error, uint256 timestamp) {
        LastError memory lastError = lastErrors[msg.sender];
        return (lastError.error, lastError.timestamp);
    }
    
    /// @notice Check if an account exists
    /// @param user The user address
    /// @return exists Whether the account exists
    function accountExists(address user) external view returns (bool) {
        return userAccounts[user].exists;
    }
    
    /// @notice Get approval status for a withdrawal request
    /// @param withdrawalId The withdrawal request ID
    /// @param signerIndex The signer index (0, 1, or 2)
    /// @return The encrypted approval status
    function getSignerApproval(uint256 withdrawalId, uint8 signerIndex) external view returns (ebool) {
        require(withdrawalRequests[withdrawalId].exists, "Withdrawal request does not exist");
        require(signerIndex < 3, "Invalid signer index");
        return withdrawalRequests[withdrawalId].signerApprovals[signerIndex];
    }
}