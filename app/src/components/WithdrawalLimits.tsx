import React, { useState } from 'react';
import { Contract, parseEther } from 'ethers';
import { FhevmInstance } from '../types';

interface WithdrawalLimitsProps {
  contract: Contract | null;
  instance: FhevmInstance | null;
  userAddress: string;
}

export const WithdrawalLimits: React.FC<WithdrawalLimitsProps> = ({
  contract,
  instance,
  userAddress
}) => {
  const [targetUser, setTargetUser] = useState('');
  const [signerIndex, setSignerIndex] = useState('0');
  const [maxAmount, setMaxAmount] = useState('');
  const [hours, setHours] = useState('24');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const isValidAddress = (address: string): boolean => {
    return /^0x[a-fA-F0-9]{40}$/.test(address);
  };

  const handleSetLimit = async () => {
    if (!contract || !instance) {
      setError('Contract or FHEVM instance not available');
      return;
    }

    if (!isValidAddress(targetUser)) {
      setError('Please enter a valid user address');
      return;
    }

    const amountValue = parseFloat(maxAmount);
    const hoursValue = parseFloat(hours);

    if (isNaN(amountValue) || amountValue <= 0) {
      setError('Please enter a valid maximum amount');
      return;
    }

    if (isNaN(hoursValue) || hoursValue <= 0) {
      setError('Please enter valid hours');
      return;
    }

    try {
      setLoading(true);
      setError('');
      setSuccess('');

      // Create encrypted input for the maximum amount
      const input = instance.createEncryptedInput(await contract.getAddress(), userAddress);
      input.add64(parseEther(maxAmount));
      const encryptedInput = await input.encrypt();

      // Calculate deadline (current time + hours)
      const deadline = Math.floor(Date.now() / 1000) + (hoursValue * 3600);

      const tx = await contract.setWithdrawalLimit(
        targetUser,
        parseInt(signerIndex),
        encryptedInput.handles[0],
        deadline,
        encryptedInput.inputProof
      );

      console.log('Set withdrawal limit transaction sent:', tx.hash);
      setSuccess(`Transaction sent: ${tx.hash}`);

      await tx.wait();
      console.log('Withdrawal limit set successfully!');
      setSuccess('Withdrawal limit set successfully!');

      // Reset form
      setTargetUser('');
      setMaxAmount('');
      setHours('24');

    } catch (error: any) {
      console.error('Set withdrawal limit error:', error);
      if (error.message?.includes('NotRegistered')) {
        setError('User is not registered');
      } else if (error.message?.includes('InvalidSignerIndex')) {
        setError('Invalid signer index');
      } else if (error.message?.includes('UnauthorizedSigner')) {
        setError('You are not authorized to set limits for this user');
      } else {
        setError(error.message || 'Failed to set withdrawal limit');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="withdrawal-limits">
      <div className="limits-card">
        <h2>Set Withdrawal Limits</h2>
        <p>
          As a multi-signature address, you can set withdrawal limits for registered users. 
          All 3 multi-sig addresses must set valid limits before a user can withdraw.
        </p>

        <div className="limits-form">
          <div className="form-group">
            <label htmlFor="targetUser">User Address:</label>
            <input
              type="text"
              id="targetUser"
              value={targetUser}
              onChange={(e) => setTargetUser(e.target.value)}
              placeholder="0x..."
              className="address-input"
            />
            <small>Enter the address of the user you want to set limits for</small>
          </div>

          <div className="form-group">
            <label htmlFor="signerIndex">Your Signer Index:</label>
            <select
              id="signerIndex"
              value={signerIndex}
              onChange={(e) => setSignerIndex(e.target.value)}
              className="select-input"
            >
              <option value="0">Signer 1 (Index 0)</option>
              <option value="1">Signer 2 (Index 1)</option>
              <option value="2">Signer 3 (Index 2)</option>
            </select>
            <small>Select which multi-sig position you represent for this user</small>
          </div>

          <div className="form-group">
            <label htmlFor="maxAmount">Maximum Withdrawal Amount (ETH):</label>
            <input
              type="number"
              id="maxAmount"
              value={maxAmount}
              onChange={(e) => setMaxAmount(e.target.value)}
              placeholder="0.0"
              min="0"
              step="0.001"
              className="amount-input"
            />
            <small>The maximum amount this user can withdraw in a single transaction</small>
          </div>

          <div className="form-group">
            <label htmlFor="hours">Valid for (Hours):</label>
            <input
              type="number"
              id="hours"
              value={hours}
              onChange={(e) => setHours(e.target.value)}
              placeholder="24"
              min="1"
              step="1"
              className="time-input"
            />
            <small>How many hours this withdrawal limit will remain valid</small>
          </div>

          {error && <div className="error-message">{error}</div>}
          {success && <div className="success-message">{success}</div>}

          <button 
            className="set-limit-button"
            onClick={handleSetLimit}
            disabled={loading || !targetUser || !maxAmount || !hours}
          >
            {loading ? 'Setting Limit...' : 'Set Withdrawal Limit'}
          </button>
        </div>

        <div className="limits-info">
          <h3>Important Information</h3>
          <div className="info-grid">
            <div className="info-item">
              <h4>🔐 Authorization Required</h4>
              <p>You must be one of the user's registered multi-sig addresses to set limits</p>
            </div>
            <div className="info-item">
              <h4>⏰ Time Sensitive</h4>
              <p>Limits expire after the specified time period</p>
            </div>
            <div className="info-item">
              <h4>🤝 Consensus Needed</h4>
              <p>All 3 multi-sig addresses must set valid limits for withdrawal to be possible</p>
            </div>
            <div className="info-item">
              <h4>🔒 Encrypted Amount</h4>
              <p>The maximum amount is encrypted and stored privately</p>
            </div>
          </div>
        </div>

        <div className="workflow-info">
          <h3>Multi-sig Workflow</h3>
          <ol>
            <li>User registers with 3 encrypted multi-sig addresses</li>
            <li>User deposits funds (no restrictions)</li>
            <li>When user wants to withdraw, all 3 multi-sig addresses must set limits</li>
            <li>Each limit includes maximum amount and expiration time</li>
            <li>User can withdraw only if all limits are valid and amount is within bounds</li>
            <li>After withdrawal, all limits are cleared</li>
          </ol>
        </div>
      </div>
    </div>
  );
};