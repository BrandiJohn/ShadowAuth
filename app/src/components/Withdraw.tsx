import React, { useState, useEffect } from 'react';
import { Contract, parseEther } from 'ethers';
import { FhevmInstance } from '../types';

interface WithdrawProps {
  contract: Contract | null;
  instance: FhevmInstance | null;
  userAddress: string;
  onComplete: () => void;
}

interface LimitStatus {
  signerIndex: number;
  isSet: boolean;
  deadline: number;
  isValid: boolean;
}

export const Withdraw: React.FC<WithdrawProps> = ({
  contract,
  instance,
  userAddress,
  onComplete
}) => {
  const [amount, setAmount] = useState('');
  const [loading, setLoading] = useState(false);
  const [checkingLimits, setCheckingLimits] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [limitStatuses, setLimitStatuses] = useState<LimitStatus[]>([]);

  useEffect(() => {
    if (contract) {
      checkWithdrawalLimits();
    }
  }, [contract, userAddress]);

  const checkWithdrawalLimits = async () => {
    if (!contract) return;

    try {
      setCheckingLimits(true);
      const now = Math.floor(Date.now() / 1000);
      
      const limitPromises = [0, 1, 2].map(async (index) => {
        try {
          const [, deadline, isSet] = await contract.getWithdrawalLimit(userAddress, index);
          const deadlineNum = Number(deadline);
          return {
            signerIndex: index,
            isSet,
            deadline: deadlineNum,
            isValid: isSet && deadlineNum > now
          };
        } catch (error) {
          console.error(`Error checking limit for signer ${index}:`, error);
          return {
            signerIndex: index,
            isSet: false,
            deadline: 0,
            isValid: false
          };
        }
      });

      const statuses = await Promise.all(limitPromises);
      setLimitStatuses(statuses);
    } catch (error) {
      console.error('Error checking withdrawal limits:', error);
    } finally {
      setCheckingLimits(false);
    }
  };

  const canWithdraw = (): boolean => {
    return limitStatuses.every(status => status.isValid);
  };

  const handleWithdraw = async () => {
    if (!contract || !instance) {
      setError('Contract or FHEVM instance not available');
      return;
    }

    const withdrawAmount = parseFloat(amount);
    if (isNaN(withdrawAmount) || withdrawAmount <= 0) {
      setError('Please enter a valid withdrawal amount');
      return;
    }

    if (!canWithdraw()) {
      setError('Cannot withdraw: not all multi-sig limits are set and valid');
      return;
    }

    try {
      setLoading(true);
      setError('');
      setSuccess('');

      // Create encrypted input for the withdrawal amount
      const input = instance.createEncryptedInput(await contract.getAddress(), userAddress);
      input.add64(parseEther(amount));
      const encryptedInput = await input.encrypt();

      const tx = await contract.withdraw(
        encryptedInput.handles[0],
        encryptedInput.inputProof
      );

      console.log('Withdrawal transaction sent:', tx.hash);
      setSuccess(`Transaction sent: ${tx.hash}`);

      await tx.wait();
      console.log('Withdrawal completed!');
      setSuccess('Withdrawal completed successfully!');
      setAmount('');
      onComplete();
      checkWithdrawalLimits(); // Refresh limit statuses

    } catch (error: any) {
      console.error('Withdrawal error:', error);
      if (error.message?.includes('NotRegistered')) {
        setError('User is not registered');
      } else if (error.message?.includes('All multi-sig limits must be set and valid')) {
        setError('All multi-sig addresses must set valid withdrawal limits first');
      } else {
        setError(error.message || 'Withdrawal failed');
      }
    } finally {
      setLoading(false);
    }
  };

  const formatDeadline = (timestamp: number): string => {
    if (timestamp === 0) return 'Not set';
    return new Date(timestamp * 1000).toLocaleString();
  };

  const getTimeRemaining = (deadline: number): string => {
    if (deadline === 0) return 'Not set';
    const now = Math.floor(Date.now() / 1000);
    const remaining = deadline - now;
    
    if (remaining <= 0) return 'Expired';
    
    const hours = Math.floor(remaining / 3600);
    const minutes = Math.floor((remaining % 3600) / 60);
    
    if (hours > 0) {
      return `${hours}h ${minutes}m remaining`;
    } else {
      return `${minutes}m remaining`;
    }
  };

  return (
    <div className="withdraw">
      <div className="withdraw-card">
        <h2>Withdraw Funds</h2>
        <p>
          Withdraw ETH from your ShadowAuth wallet. All 3 multi-signature addresses must have 
          set valid withdrawal limits before you can proceed.
        </p>

        <div className="limit-status-section">
          <h3>Multi-sig Authorization Status</h3>
          {checkingLimits ? (
            <div className="loading">Checking limits...</div>
          ) : (
            <div className="limit-status-grid">
              {limitStatuses.map((status) => (
                <div key={status.signerIndex} className={`limit-status-card ${status.isValid ? 'valid' : 'invalid'}`}>
                  <div className="status-header">
                    <h4>Signer {status.signerIndex + 1}</h4>
                    <span className={`status-indicator ${status.isValid ? 'valid' : 'invalid'}`}>
                      {status.isValid ? '✓' : '✗'}
                    </span>
                  </div>
                  <div className="status-details">
                    <div className="detail">
                      <span className="label">Status:</span>
                      <span className={`value ${status.isSet ? 'set' : 'not-set'}`}>
                        {status.isSet ? 'Limit Set' : 'No Limit'}
                      </span>
                    </div>
                    <div className="detail">
                      <span className="label">Deadline:</span>
                      <span className={`value ${status.isValid ? 'valid' : 'invalid'}`}>
                        {formatDeadline(status.deadline)}
                      </span>
                    </div>
                    <div className="detail">
                      <span className="label">Time Left:</span>
                      <span className={`value ${status.isValid ? 'valid' : 'invalid'}`}>
                        {getTimeRemaining(status.deadline)}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
          
          <div className={`overall-status ${canWithdraw() ? 'ready' : 'not-ready'}`}>
            {canWithdraw() ? '✅ Ready to Withdraw' : '❌ Cannot Withdraw - Missing Valid Authorizations'}
          </div>
        </div>

        <div className="withdraw-form">
          <div className="form-group">
            <label htmlFor="amount">Withdrawal Amount (ETH):</label>
            <input
              type="number"
              id="amount"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0.0"
              min="0"
              step="0.001"
              className="amount-input"
              disabled={!canWithdraw()}
            />
          </div>

          {error && <div className="error-message">{error}</div>}
          {success && <div className="success-message">{success}</div>}

          <button 
            className="withdraw-button"
            onClick={handleWithdraw}
            disabled={loading || !amount || parseFloat(amount) <= 0 || !canWithdraw()}
          >
            {loading ? 'Withdrawing...' : 'Withdraw ETH'}
          </button>

          <button 
            className="refresh-button secondary"
            onClick={checkWithdrawalLimits}
            disabled={checkingLimits}
          >
            {checkingLimits ? 'Checking...' : 'Refresh Status'}
          </button>
        </div>

        <div className="withdraw-info">
          <h3>Withdrawal Process</h3>
          <div className="process-steps">
            <div className="step">
              <span className="step-number">1</span>
              <div className="step-content">
                <h4>Multi-sig Authorization</h4>
                <p>All 3 multi-sig addresses must set withdrawal limits with future deadlines</p>
              </div>
            </div>
            <div className="step">
              <span className="step-number">2</span>
              <div className="step-content">
                <h4>Amount Verification</h4>
                <p>Your withdrawal amount must be within all set limits</p>
              </div>
            </div>
            <div className="step">
              <span className="step-number">3</span>
              <div className="step-content">
                <h4>Encrypted Processing</h4>
                <p>The withdrawal is processed using encrypted computation</p>
              </div>
            </div>
            <div className="step">
              <span className="step-number">4</span>
              <div className="step-content">
                <h4>Limits Cleared</h4>
                <p>After successful withdrawal, all limits are cleared for security</p>
              </div>
            </div>
          </div>
        </div>

        {!canWithdraw() && (
          <div className="help-section">
            <h3>Need Help?</h3>
            <p>
              To withdraw funds, you need all 3 of your registered multi-signature addresses to:
            </p>
            <ul>
              <li>Set a maximum withdrawal amount</li>
              <li>Set a deadline in the future</li>
              <li>Ensure the limits haven't expired</li>
            </ul>
            <p>
              Contact your multi-sig addresses and ask them to use the "Set Limits" tab to 
              authorize your withdrawal.
            </p>
          </div>
        )}
      </div>
    </div>
  );
};