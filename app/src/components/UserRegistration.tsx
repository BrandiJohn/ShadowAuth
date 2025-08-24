import React, { useState } from 'react';
import { Contract } from 'ethers';
import { FhevmInstance } from '../types';

interface UserRegistrationProps {
  contract: Contract | null;
  instance: FhevmInstance | null;
  userAddress: string;
  onComplete: () => void;
}

export const UserRegistration: React.FC<UserRegistrationProps> = ({
  contract,
  instance,
  userAddress,
  onComplete
}) => {
  const [signer1, setSigner1] = useState('');
  const [signer2, setSigner2] = useState('');
  const [signer3, setSigner3] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const isValidAddress = (address: string): boolean => {
    return /^0x[a-fA-F0-9]{40}$/.test(address);
  };

  const handleRegister = async () => {
    if (!contract || !instance) {
      setError('Contract or FHEVM instance not available');
      return;
    }

    if (!isValidAddress(signer1) || !isValidAddress(signer2) || !isValidAddress(signer3)) {
      setError('Please enter valid Ethereum addresses for all signers');
      return;
    }

    if (new Set([signer1, signer2, signer3]).size !== 3) {
      setError('All signer addresses must be unique');
      return;
    }

    try {
      setLoading(true);
      setError('');

      // Create encrypted input for the multi-sig addresses
      const input = instance.createEncryptedInput(await contract.getAddress(), userAddress);
      input.addAddress(signer1);
      input.addAddress(signer2);
      input.addAddress(signer3);
      
      const encryptedInput = await input.encrypt();

      // Register user with encrypted multi-sig addresses
      const tx = await contract.register(
        encryptedInput.handles[0],
        encryptedInput.handles[1],
        encryptedInput.handles[2],
        encryptedInput.inputProof
      );

      console.log('Registration transaction sent:', tx.hash);
      await tx.wait();
      console.log('Registration completed!');

      onComplete();
    } catch (error: any) {
      console.error('Registration error:', error);
      setError(error.message || 'Registration failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="user-registration">
      <div className="registration-card">
        <h2>Register Your Account</h2>
        <p>
          Register your account by providing 3 multi-signature addresses. These addresses will be encrypted 
          and stored securely on the blockchain. Only these addresses will be able to authorize your withdrawals.
        </p>

        <div className="form-group">
          <label htmlFor="signer1">Multi-sig Address 1:</label>
          <input
            type="text"
            id="signer1"
            value={signer1}
            onChange={(e) => setSigner1(e.target.value)}
            placeholder="0x..."
            className="address-input"
          />
        </div>

        <div className="form-group">
          <label htmlFor="signer2">Multi-sig Address 2:</label>
          <input
            type="text"
            id="signer2"
            value={signer2}
            onChange={(e) => setSigner2(e.target.value)}
            placeholder="0x..."
            className="address-input"
          />
        </div>

        <div className="form-group">
          <label htmlFor="signer3">Multi-sig Address 3:</label>
          <input
            type="text"
            id="signer3"
            value={signer3}
            onChange={(e) => setSigner3(e.target.value)}
            placeholder="0x..."
            className="address-input"
          />
        </div>

        {error && <div className="error-message">{error}</div>}

        <button 
          className="register-button"
          onClick={handleRegister}
          disabled={loading || !contract || !instance}
        >
          {loading ? 'Registering...' : 'Register Account'}
        </button>

        <div className="info-box">
          <h3>Important Notes:</h3>
          <ul>
            <li>Multi-sig addresses are encrypted and stored privately</li>
            <li>All 3 addresses must set withdrawal limits before you can withdraw</li>
            <li>Keep your multi-sig addresses secure as they control your funds</li>
            <li>This registration is permanent and cannot be changed</li>
          </ul>
        </div>
      </div>
    </div>
  );
};