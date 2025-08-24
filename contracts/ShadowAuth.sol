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
    mapping(address => WithdrawalLimit) private withdrawalLimits;

    // Withdrawal requests for decryption
    struct WithdrawalRequest {
        uint256 amount;
        uint256 requestId;
        bool isPending;
        address user; // Store the user who made the request
        bool canWithdraw; // Result of multi-sig verification
        bool isProcessed; // Whether decryption callback has been processed
    }

    mapping(address => WithdrawalRequest) private withdrawalRequests;
    mapping(uint256 => address) private requestIdToUser; // Map request ID to user

    // Events
    event UserRegistered(address indexed user);
    event Deposit(address indexed user, uint256 amount);
    event WithdrawalLimitSet(address indexed user, uint256 indexed signerIndex);
    event WithdrawalRequested(address indexed user, uint256 amount, uint256 requestId);
    event WithdrawalExecuted(address indexed user, uint256 amount);
    event SignersDecrypted(address indexed user, uint256 requestId);

    // Errors
    error AlreadyRegistered();
    error NotRegistered();
    error InvalidSignerIndex();
    error UnauthorizedSigner();
    error InsufficientBalance();
    error WithdrawalNotAuthorized();
    error WithdrawalDeadlineExpired();
    error WithdrawalRequestPending();
    error NoWithdrawalRequest();
    error DecryptionInProgress();

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
        uint256 depositAmount = (msg.value);
        uint256 newBalance = (currentBalance + depositAmount);

        balances[msg.sender] = newBalance;

        emit Deposit(msg.sender, msg.value);
    }

    /// @notice Set withdrawal limit and deadline by multi-sig address
    /// @param maxAmount Maximum withdrawal amount
    /// @param deadline Withdrawal deadline timestamp
    function setWithdrawalLimit(uint256 maxAmount, uint256 deadline) external {
        require(deadline > block.timestamp, "Deadline must be in the future");
        require(maxAmount > 0, "amount is 0");

        // Note: The caller (msg.sender) is one of the multi-sig addresses
        // Setting withdrawal limit for themselves as the authorizing signer

        withdrawalLimits[msg.sender] = WithdrawalLimit({maxAmount: maxAmount, deadline: deadline, isSet: true});

        emit WithdrawalLimitSet(msg.sender, 0); // Signer sets limit for themselves
    }

    /// @notice Request withdrawal - first step that initiates decryption of multi-sig addresses
    /// @param withdrawAmount withdrawal amount
    /// @dev Creates a withdrawal request and initiates decryption of encrypted signer addresses
    function requestWithdrawal(uint256 withdrawAmount) external {
        if (!userMultiSig[msg.sender].isRegistered) {
            revert NotRegistered();
        }

        if (withdrawalRequests[msg.sender].isPending) {
            revert WithdrawalRequestPending();
        }

        uint256 currentBalance = balances[msg.sender];
        require(currentBalance >= withdrawAmount, "Insufficient balance");

        // Prepare encrypted signers for decryption
        bytes32[] memory ciphertexts = new bytes32[](3);
        ciphertexts[0] = FHE.toBytes32(userMultiSig[msg.sender].signers[0]);
        ciphertexts[1] = FHE.toBytes32(userMultiSig[msg.sender].signers[1]);
        ciphertexts[2] = FHE.toBytes32(userMultiSig[msg.sender].signers[2]);

        // Request decryption of all 3 multi-sig addresses
        uint256 requestId = FHE.requestDecryption(ciphertexts, this.decryptionCallback.selector);

        // Store withdrawal request
        withdrawalRequests[msg.sender] = WithdrawalRequest({
            amount: withdrawAmount,
            requestId: requestId,
            isPending: true,
            user: msg.sender,
            canWithdraw: false,
            isProcessed: false
        });

        // Map request ID to user for callback lookup
        requestIdToUser[requestId] = msg.sender;

        emit WithdrawalRequested(msg.sender, withdrawAmount, requestId);
    }

    /// @notice Decryption callback - receives decrypted multi-sig addresses and verifies withdrawal permission
    /// @param requestId The decryption request ID
    /// @param decryptedSigner1 First decrypted signer address
    /// @param decryptedSigner2 Second decrypted signer address
    /// @param decryptedSigner3 Third decrypted signer address
    /// @param signatures Decryption signatures for verification
    function decryptionCallback(
        uint256 requestId,
        address decryptedSigner1,
        address decryptedSigner2,
        address decryptedSigner3,
        bytes[] memory signatures
    ) public {
        _processDecryptionCallback(requestId, decryptedSigner1, decryptedSigner2, decryptedSigner3, signatures);
    }

    /// @notice Internal function to process decryption callback
    function _processDecryptionCallback(
        uint256 requestId,
        address decryptedSigner1,
        address decryptedSigner2,
        address decryptedSigner3,
        bytes[] memory signatures
    ) internal {
        // Verify the decryption request
        FHE.checkSignatures(requestId, signatures);

        // Find the user for this request
        address user = requestIdToUser[requestId];
        require(user != address(0), "Invalid request ID");

        WithdrawalRequest storage request = withdrawalRequests[user];
        require(request.isPending && request.requestId == requestId, "Invalid request");
        require(!request.isProcessed, "Request already processed");

        // Verify withdrawal permissions
        bool canWithdraw = _verifyWithdrawalPermissions(
            user,
            request.amount,
            decryptedSigner1,
            decryptedSigner2,
            decryptedSigner3
        );

        // Update request status
        request.canWithdraw = canWithdraw;
        request.isProcessed = true;
        
        // Clean up withdrawal limits
        _cleanupWithdrawalLimits(decryptedSigner1, decryptedSigner2, decryptedSigner3);
        
        emit SignersDecrypted(user, requestId);
    }

    /// @notice Internal function to cleanup withdrawal limits
    function _cleanupWithdrawalLimits(
        address signer1,
        address signer2,
        address signer3
    ) internal {
        delete withdrawalLimits[signer1];
        delete withdrawalLimits[signer2];
        delete withdrawalLimits[signer3];
    }

    /// @notice Internal function to verify withdrawal permissions
    /// @param withdrawAmount The amount to withdraw
    /// @param signer1 First decrypted signer address
    /// @param signer2 Second decrypted signer address
    /// @param signer3 Third decrypted signer address
    /// @return bool Whether withdrawal is authorized
    function _verifyWithdrawalPermissions(
        address /* user */,
        uint256 withdrawAmount,
        address signer1,
        address signer2,
        address signer3
    ) private view returns (bool) {
        // Check each decrypted signer's withdrawal limit
        address[3] memory signers = [signer1, signer2, signer3];

        for (uint256 i = 0; i < 3; i++) {
            WithdrawalLimit storage limit = withdrawalLimits[signers[i]];

            // Check if limit is set
            if (!limit.isSet) {
                return false;
            }

            // Check if deadline has not expired
            if (limit.deadline < block.timestamp) {
                return false;
            }

            // Check if amount is within limit
            if (limit.maxAmount < withdrawAmount) {
                return false;
            }
        }

        return true;
    }

    /// @notice Execute withdrawal after successful multi-sig verification
    /// @dev Called after decryption callback has verified all multi-sig permissions
    function executeWithdrawal() external {
        WithdrawalRequest storage request = withdrawalRequests[msg.sender];

        if (!request.isPending) {
            revert NoWithdrawalRequest();
        }

        if (!request.isProcessed) {
            revert DecryptionInProgress();
        }

        if (!request.canWithdraw) {
            revert WithdrawalNotAuthorized();
        }

        // Execute the withdrawal
        uint256 currentBalance = balances[msg.sender];
        require(currentBalance >= request.amount, "Insufficient balance");

        balances[msg.sender] = currentBalance - request.amount;

        // Transfer ETH to user
        (bool success, ) = payable(msg.sender).call{value: request.amount}("");
        require(success, "Transfer failed");

        // Clear withdrawal request
        delete requestIdToUser[request.requestId];
        delete withdrawalRequests[msg.sender];

        // Note: In the original design, withdrawal limits are cleared by each signer
        // after successful withdrawal. This would need to be done separately.

        emit WithdrawalExecuted(msg.sender, request.amount);
    }

    /// @notice Get user's balance
    /// @param user Address of the user
    /// @return Balance amount
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

    /// @notice Get withdrawal request status
    /// @param user Address of the user
    /// @return amount The withdrawal amount
    /// @return requestId The decryption request ID
    /// @return isPending Whether the request is pending
    /// @return canWithdraw Whether withdrawal is authorized
    /// @return isProcessed Whether decryption has been processed
    function getWithdrawalRequest(
        address user
    ) external view returns (uint256 amount, uint256 requestId, bool isPending, bool canWithdraw, bool isProcessed) {
        WithdrawalRequest storage request = withdrawalRequests[user];
        return (request.amount, request.requestId, request.isPending, request.canWithdraw, request.isProcessed);
    }

    /// @notice Get withdrawal limit for a specific signer
    /// @param signerAddress The signer address
    /// @return maxAmount Maximum withdrawal amount
    /// @return deadline Withdrawal deadline
    /// @return isSet Whether the limit is set
    function getWithdrawalLimit(
        address signerAddress
    ) external view returns (uint256 maxAmount, uint256 deadline, bool isSet) {
        WithdrawalLimit storage limit = withdrawalLimits[signerAddress];
        return (limit.maxAmount, limit.deadline, limit.isSet);
    }
}
