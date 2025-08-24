import React from 'react';

interface WalletConnectionProps {
  onConnect: () => Promise<void>;
}

export const WalletConnection: React.FC<WalletConnectionProps> = ({ onConnect }) => {
  return (
    <div className="wallet-connection">
      <div className="connection-card">
        <h2>Connect Your Wallet</h2>
        <p>
          To use ShadowAuth, you need to connect your wallet to the Sepolia testnet.
          This dApp uses fully homomorphic encryption to keep your multi-signature addresses private.
        </p>
        <button className="connect-button" onClick={onConnect}>
          Connect MetaMask
        </button>
        <div className="requirements">
          <h3>Requirements:</h3>
          <ul>
            <li>MetaMask wallet extension</li>
            <li>Sepolia testnet ETH for gas fees</li>
            <li>Access to Sepolia testnet</li>
          </ul>
        </div>
      </div>
    </div>
  );
};