import { useState } from 'react'
import { ConnectButton } from '@rainbow-me/rainbowkit'
import { useAccount } from 'wagmi'
import { initFhevm } from './fhevm'
import Registration from './components/Registration'
import Dashboard from './components/Dashboard'
import MultisigManager from './components/MultisigManager'
import './App.css'

function App() {
  const { address, isConnected } = useAccount()
  const [fhevmReady, setFhevmReady] = useState(false)
  const [fhevmInitializing, setFhevmInitializing] = useState(false)
  const [fhevmError, setFhevmError] = useState<string | null>(null)
  const [currentView, setCurrentView] = useState<'dashboard' | 'multisig'>('dashboard')

  const handleInitFhevm = async () => {
    try {
      setFhevmInitializing(true)
      setFhevmError(null)
      
      await initFhevm()
      setFhevmReady(true)
      console.log('FHEVM initialized successfully')
    } catch (error) {
      console.error('Failed to initialize FHEVM:', error)
      setFhevmError(error instanceof Error ? error.message : 'Failed to initialize FHEVM')
    } finally {
      setFhevmInitializing(false)
    }
  }


  return (
    <div className="app">
      <header className="header">
        <div className="header-left">
          <h1>ShadowAuth</h1>
          <p>Encrypted Multi-signature Wallet</p>
        </div>
        <div className="header-right">
          {!fhevmReady && (
            <div className="fhe-init-section">
              <button
                onClick={handleInitFhevm}
                disabled={fhevmInitializing}
                className="fhe-init-button"
              >
                {fhevmInitializing ? 'Initializing FHE...' : 'Initialize FHE'}
              </button>
              {fhevmError && (
                <div className="fhe-error">
                  <span>FHE Init Failed</span>
                  <button onClick={handleInitFhevm} className="fhe-retry-button">
                    Retry
                  </button>
                </div>
              )}
            </div>
          )}
          {fhevmReady && (
            <div className="fhe-status">
              <span className="fhe-ready">✓ FHE Ready</span>
            </div>
          )}
          <ConnectButton />
        </div>
      </header>

      {isConnected && address ? (
        <main className="main">
          <nav className="nav">
            <button 
              className={currentView === 'dashboard' ? 'active' : ''}
              onClick={() => setCurrentView('dashboard')}
            >
              Dashboard
            </button>
            <button 
              className={currentView === 'multisig' ? 'active' : ''}
              onClick={() => setCurrentView('multisig')}
            >
              Multisig Manager
            </button>
          </nav>

          <div className="content">
            <Registration address={address} fhevmReady={fhevmReady} />
            {currentView === 'dashboard' && <Dashboard address={address} />}
            {currentView === 'multisig' && <MultisigManager address={address} />}
          </div>
        </main>
      ) : (
        <div className="connect-prompt">
          <h2>Connect Your Wallet</h2>
          <p>Please connect your wallet to access ShadowAuth</p>
        </div>
      )}
    </div>
  )
}

export default App
