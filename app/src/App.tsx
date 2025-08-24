import { useEffect, useState } from 'react'
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
  const [currentView, setCurrentView] = useState<'dashboard' | 'multisig'>('dashboard')

  useEffect(() => {
    const init = async () => {
      try {
        await initFhevm()
        setFhevmReady(true)
        console.log('FHEVM initialized successfully')
      } catch (error) {
        console.error('Failed to initialize FHEVM:', error)
      }
    }
    init()
  }, [])

  if (!fhevmReady) {
    return (
      <div className="app">
        <div className="loading">
          <h2>Initializing ShadowAuth...</h2>
          <p>Loading FHEVM encryption system...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="app">
      <header className="header">
        <h1>ShadowAuth</h1>
        <p>Encrypted Multi-signature Wallet</p>
        <ConnectButton />
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
            <Registration address={address} />
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
