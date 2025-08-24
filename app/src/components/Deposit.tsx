import React, { useState } from 'react';
import { Contract, parseEther } from 'ethers';

interface DepositProps {
  contract: Contract | null;
  userAddress: string;
  onComplete: () => void;
}

export const Deposit: React.FC<DepositProps> = ({ contract, userAddress, onComplete }) => {
  const [amount, setAmount] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const handleDeposit = async () => {
    if (!contract) {
      setError('Contract not available');
      return;
    }

    const depositAmount = parseFloat(amount);
    if (isNaN(depositAmount) || depositAmount <= 0) {
      setError('Please enter a valid deposit amount');
      return;
    }

    try {
      setLoading(true);
      setError('');
      setSuccess('');

      const tx = await contract.deposit({
        value: parseEther(amount)
      });

      console.log('Deposit transaction sent:', tx.hash);
      setSuccess(`Transaction sent: ${tx.hash}`);

      await tx.wait();
      console.log('Deposit completed!');
      setSuccess('Deposit completed successfully!');
      setAmount('');
      onComplete();

    } catch (error: any) {
      console.error('Deposit error:', error);
      setError(error.message || 'Deposit failed');
    } finally {
      setLoading(false);
    }
  };

  const handleMaxDeposit = async () => {
    try {
      if (typeof window.ethereum !== 'undefined') {
        const balance = await window.ethereum.request({
          method: 'eth_getBalance',
          params: [userAddress, 'latest']
        });
        
        // Convert from hex to decimal and then to ether, leaving some for gas
        const balanceInEth = parseFloat((parseInt(balance, 16) / 1e18).toFixed(6));
        const maxDeposit = Math.max(0, balanceInEth - 0.01); // Leave 0.01 ETH for gas
        
        setAmount(maxDeposit.toString());
      }
    } catch (error) {
      console.error('Error getting balance:', error);
    }
  };

  return (
    <div className="deposit">
      <div className="deposit-card">
        <h2>Deposit Funds</h2>
        <p>
          Deposit ETH into your ShadowAuth wallet. Your balance will be encrypted and stored securely.
          You can deposit any amount at any time.
        </p>

        <div className="deposit-form">
          <div className="form-group">
            <label htmlFor="amount">Deposit Amount (ETH):</label>
            <div className="amount-input-container">
              <input
                type="number"
                id="amount"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0.0"
                min="0"
                step="0.001"
                className="amount-input"
              />
              <button 
                type="button" 
                className="max-button"
                onClick={handleMaxDeposit}
                disabled={loading}
              >
                MAX
              </button>
            </div>
          </div>

          {error && <div className="error-message">{error}</div>}
          {success && <div className="success-message">{success}</div>}

          <button 
            className="deposit-button"
            onClick={handleDeposit}
            disabled={loading || !amount || parseFloat(amount) <= 0}
          >
            {loading ? 'Depositing...' : 'Deposit ETH'}
          </button>
        </div>

        <div className="deposit-info">
          <h3>Deposit Information</h3>
          <div className="info-list">
            <div className="info-item">
              <span className="label">Network:</span>
              <span className="value">Sepolia Testnet</span>
            </div>
            <div className="info-item">
              <span className="label">Gas Fee:</span>
              <span className="value">Paid by you</span>
            </div>
            <div className="info-item">
              <span className="label">Minimum Amount:</span>
              <span className="value">No minimum</span>
            </div>
            <div className="info-item">
              <span className="label">Maximum Amount:</span>
              <span className="value">No maximum</span>
            </div>
          </div>
        </div>

        <div className="security-note">
          <h4>🔒 Security Features</h4>
          <ul>
            <li>Your balance is encrypted using fully homomorphic encryption</li>
            <li>Only you can see your encrypted balance handle</li>
            <li>Deposit transactions are public, but your total balance remains private</li>
            <li>No third party can determine your total holdings</li>
          </ul>
        </div>
      </div>
    </div>
  );
};