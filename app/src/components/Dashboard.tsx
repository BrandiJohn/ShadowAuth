import React, { useState, useEffect } from 'react';
import { Contract, formatEther } from 'ethers';
import { User } from '../types';

interface DashboardProps {
  user: User;
  contract: Contract | null;
}

interface LimitInfo {
  signerIndex: number;
  maxAmount: string;
  deadline: number;
  isSet: boolean;
}

export const Dashboard: React.FC<DashboardProps> = ({ user, contract }) => {
  const [limits, setLimits] = useState<LimitInfo[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (contract && user.isRegistered) {
      loadWithdrawalLimits();
    }
  }, [contract, user]);

  const loadWithdrawalLimits = async () => {
    if (!contract) return;

    try {
      setLoading(true);
      const limitPromises = [0, 1, 2].map(async (index) => {
        try {
          const [maxAmount, deadline, isSet] = await contract.getWithdrawalLimit(user.address, index);
          return {
            signerIndex: index,
            maxAmount: maxAmount.toString(), // This will be an encrypted handle
            deadline: Number(deadline),
            isSet
          };
        } catch (error) {
          console.error(`Error loading limit for signer ${index}:`, error);
          return {
            signerIndex: index,
            maxAmount: '0',
            deadline: 0,
            isSet: false
          };
        }
      });

      const loadedLimits = await Promise.all(limitPromises);
      setLimits(loadedLimits);
    } catch (error) {
      console.error('Error loading withdrawal limits:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatDeadline = (timestamp: number): string => {
    if (timestamp === 0) return 'Not set';
    return new Date(timestamp * 1000).toLocaleString();
  };

  const isDeadlineValid = (timestamp: number): boolean => {
    if (timestamp === 0) return false;
    return timestamp > Date.now() / 1000;
  };

  const canWithdraw = (): boolean => {
    return limits.every(limit => limit.isSet && isDeadlineValid(limit.deadline));
  };

  return (
    <div className="dashboard">
      <div className="dashboard-header">
        <h2>Account Dashboard</h2>
        <div className="user-info">
          <div className="info-item">
            <label>Address:</label>
            <span className="address">{user.address}</span>
          </div>
          <div className="info-item">
            <label>Status:</label>
            <span className={`status ${user.isRegistered ? 'registered' : 'unregistered'}`}>
              {user.isRegistered ? 'Registered' : 'Not Registered'}
            </span>
          </div>
          <div className="info-item">
            <label>Balance:</label>
            <span className="balance">
              {user.balance === 'encrypted' ? 'Encrypted (Private)' : `${user.balance} ETH`}
            </span>
          </div>
        </div>
      </div>

      <div className="withdrawal-status">
        <h3>Withdrawal Status</h3>
        <div className={`status-indicator ${canWithdraw() ? 'ready' : 'pending'}`}>
          {canWithdraw() ? '✓ Ready to Withdraw' : '⏳ Waiting for Multi-sig Authorization'}
        </div>
      </div>

      <div className="limits-section">
        <h3>Multi-sig Withdrawal Limits</h3>
        {loading ? (
          <div className="loading">Loading limits...</div>
        ) : (
          <div className="limits-grid">
            {limits.map((limit) => (
              <div key={limit.signerIndex} className="limit-card">
                <div className="limit-header">
                  <h4>Signer {limit.signerIndex + 1}</h4>
                  <span className={`status-badge ${limit.isSet ? 'set' : 'not-set'}`}>
                    {limit.isSet ? 'Set' : 'Not Set'}
                  </span>
                </div>
                <div className="limit-details">
                  <div className="detail">
                    <label>Max Amount:</label>
                    <span>{limit.isSet ? 'Encrypted' : 'Not set'}</span>
                  </div>
                  <div className="detail">
                    <label>Deadline:</label>
                    <span className={isDeadlineValid(limit.deadline) ? 'valid' : 'invalid'}>
                      {formatDeadline(limit.deadline)}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="actions-section">
        <h3>Available Actions</h3>
        <div className="action-buttons">
          <div className="action-item">
            <h4>Deposit Funds</h4>
            <p>Add ETH to your encrypted wallet</p>
            <span className="action-status available">Always Available</span>
          </div>
          <div className="action-item">
            <h4>Withdraw Funds</h4>
            <p>Withdraw ETH with multi-sig authorization</p>
            <span className={`action-status ${canWithdraw() ? 'available' : 'unavailable'}`}>
              {canWithdraw() ? 'Available' : 'Needs Authorization'}
            </span>
          </div>
          <div className="action-item">
            <h4>Set Limits</h4>
            <p>Multi-sig addresses can set withdrawal limits</p>
            <span className="action-status available">Available for Signers</span>
          </div>
        </div>
      </div>

      <div className="info-section">
        <h3>How ShadowAuth Works</h3>
        <div className="info-grid">
          <div className="info-card">
            <h4>🔒 Encrypted Multi-sig</h4>
            <p>Your multi-signature addresses are encrypted and stored privately on-chain</p>
          </div>
          <div className="info-card">
            <h4>💰 Free Deposits</h4>
            <p>Deposit funds anytime without restrictions</p>
          </div>
          <div className="info-card">
            <h4>🔐 Controlled Withdrawals</h4>
            <p>All 3 multi-sig addresses must authorize withdrawals with limits and deadlines</p>
          </div>
          <div className="info-card">
            <h4>⏰ Time-limited</h4>
            <p>Withdrawal authorizations expire after the set deadline</p>
          </div>
        </div>
      </div>
    </div>
  );
};