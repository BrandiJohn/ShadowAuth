import React, { useState, useEffect } from 'react';
import { ethers } from 'ethers';
import { WalletConnection } from './components/WalletConnection';
import { UserRegistration } from './components/UserRegistration';
import { Dashboard } from './components/Dashboard';
import { Deposit } from './components/Deposit';
import { WithdrawalLimits } from './components/WithdrawalLimits';
import { Withdraw } from './components/Withdraw';
import { useContract } from './hooks/useContract';
import { useFhevm } from './hooks/useFhevm';
import './styles/App.css';

// Contract address - update this after deployment
const CONTRACT_ADDRESS = process.env.REACT_APP_CONTRACT_ADDRESS || '';

interface User {
  address: string;
  isRegistered: boolean;
  balance: string;
}

function App() {
  const [currentAccount, setCurrentAccount] = useState<string>('');
  const [user, setUser] = useState<User | null>(null);
  const [activeTab, setActiveTab] = useState<'dashboard' | 'deposit' | 'withdraw' | 'limits'>('dashboard');
  const [loading, setLoading] = useState(false);

  const { contract, provider } = useContract(CONTRACT_ADDRESS);
  const { instance, isInitialized } = useFhevm();

  // Check if wallet is connected on page load
  useEffect(() => {
    checkConnection();
  }, []);

  // Load user data when account changes
  useEffect(() => {
    if (currentAccount && contract) {
      loadUserData();
    }
  }, [currentAccount, contract]);

  const checkConnection = async () => {
    try {
      if (typeof window.ethereum !== 'undefined') {
        const accounts = await window.ethereum.request({ method: 'eth_accounts' });
        if (accounts.length > 0) {
          setCurrentAccount(accounts[0]);
        }
      }
    } catch (error) {
      console.error('Error checking connection:', error);
    }
  };

  const connectWallet = async () => {
    try {
      if (typeof window.ethereum !== 'undefined') {
        const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
        setCurrentAccount(accounts[0]);
        
        // Switch to Sepolia testnet if needed
        try {
          await window.ethereum.request({
            method: 'wallet_switchEthereumChain',
            params: [{ chainId: '0xaa36a7' }], // Sepolia testnet
          });
        } catch (switchError: any) {
          // This error code indicates that the chain has not been added to MetaMask
          if (switchError.code === 4902) {
            try {
              await window.ethereum.request({
                method: 'wallet_addEthereumChain',
                params: [
                  {
                    chainId: '0xaa36a7',
                    chainName: 'Sepolia Test Network',
                    nativeCurrency: {
                      name: 'ETH',
                      symbol: 'ETH',
                      decimals: 18,
                    },
                    rpcUrls: ['https://sepolia.infura.io/v3/'],
                    blockExplorerUrls: ['https://sepolia.etherscan.io/'],
                  },
                ],
              });
            } catch (addError) {
              console.error('Error adding Sepolia network:', addError);
            }
          }
        }
      } else {
        alert('Please install MetaMask to use this dApp');
      }
    } catch (error) {
      console.error('Error connecting wallet:', error);
    }
  };

  const loadUserData = async () => {
    if (!contract || !currentAccount) return;

    try {
      setLoading(true);
      
      // Check if user is registered
      const isRegistered = await contract.isUserRegistered(currentAccount);
      
      let balance = '0';
      if (isRegistered) {
        // Get encrypted balance (this returns a handle, not the actual value)
        const balanceHandle = await contract.getBalance(currentAccount);
        balance = 'encrypted'; // We'll show this as encrypted since we can't decrypt easily in frontend
      }

      setUser({
        address: currentAccount,
        isRegistered,
        balance
      });
    } catch (error) {
      console.error('Error loading user data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleRegistrationComplete = () => {
    loadUserData();
  };

  const handleDepositComplete = () => {
    loadUserData();
  };

  const handleWithdrawComplete = () => {
    loadUserData();
  };

  if (!currentAccount) {
    return (
      <div className="app">
        <div className="container">
          <h1 className="app-title">ShadowAuth</h1>
          <p className="app-subtitle">Encrypted Multi-signature Wallet</p>
          <WalletConnection onConnect={connectWallet} />
        </div>
      </div>
    );
  }

  if (!CONTRACT_ADDRESS) {
    return (
      <div className="app">
        <div className="container">
          <h1 className="app-title">ShadowAuth</h1>
          <div className="error-message">
            Contract address not configured. Please deploy the contract and set REACT_APP_CONTRACT_ADDRESS.
          </div>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="app">
        <div className="container">
          <div className="loading">Loading...</div>
        </div>
      </div>
    );
  }

  if (!user?.isRegistered) {
    return (
      <div className="app">
        <div className="container">
          <h1 className="app-title">ShadowAuth</h1>
          <p className="user-address">Connected: {currentAccount}</p>
          <UserRegistration 
            contract={contract}
            instance={instance}
            userAddress={currentAccount}
            onComplete={handleRegistrationComplete}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="app">
      <div className="container">
        <header className="app-header">
          <h1 className="app-title">ShadowAuth</h1>
          <p className="user-address">Connected: {currentAccount}</p>
        </header>

        <nav className="tab-nav">
          <button 
            className={`tab ${activeTab === 'dashboard' ? 'active' : ''}`}
            onClick={() => setActiveTab('dashboard')}
          >
            Dashboard
          </button>
          <button 
            className={`tab ${activeTab === 'deposit' ? 'active' : ''}`}
            onClick={() => setActiveTab('deposit')}
          >
            Deposit
          </button>
          <button 
            className={`tab ${activeTab === 'limits' ? 'active' : ''}`}
            onClick={() => setActiveTab('limits')}
          >
            Set Limits
          </button>
          <button 
            className={`tab ${activeTab === 'withdraw' ? 'active' : ''}`}
            onClick={() => setActiveTab('withdraw')}
          >
            Withdraw
          </button>
        </nav>

        <main className="main-content">
          {activeTab === 'dashboard' && (
            <Dashboard user={user} contract={contract} />
          )}
          
          {activeTab === 'deposit' && (
            <Deposit 
              contract={contract}
              userAddress={currentAccount}
              onComplete={handleDepositComplete}
            />
          )}
          
          {activeTab === 'limits' && (
            <WithdrawalLimits 
              contract={contract}
              instance={instance}
              userAddress={currentAccount}
            />
          )}
          
          {activeTab === 'withdraw' && (
            <Withdraw 
              contract={contract}
              instance={instance}
              userAddress={currentAccount}
              onComplete={handleWithdrawComplete}
            />
          )}
        </main>
      </div>
    </div>
  );
}

export default App;