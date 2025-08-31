import { useState, useEffect } from 'react'
import { useReadContract, useWriteContract, useWaitForTransactionReceipt, useAccount, useWalletClient } from 'wagmi'
import { isAddress } from 'viem'
import { getFhevmInstance } from '../fhevm'
import { SHADOWAUTH_ADDRESS, SHADOWAUTH_ABI } from '../contract'

interface Props {
  address: string
  fhevmReady: boolean
}

export default function Registration({ address, fhevmReady }: Props) {
  const [isRegistered, setIsRegistered] = useState(false)
  const [multisigAddresses, setMultisigAddresses] = useState(['', '', ''])
  const [isRegistering, setIsRegistering] = useState(false)
  const [encryptedAddresses, setEncryptedAddresses] = useState<string[]>([])
  const [decryptedAddresses, setDecryptedAddresses] = useState<string[]>([])
  const [isDecrypting, setIsDecrypting] = useState(false)
  const [decryptError, setDecryptError] = useState<string | null>(null)
  
  const { data: walletClient } = useWalletClient();

  const { writeContract, data: hash, error, isPending } = useWriteContract()

  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({
    hash,
  })

  // Check if user is already registered
  const { data: registrationStatus } = useReadContract({
    address: SHADOWAUTH_ADDRESS,
    abi: SHADOWAUTH_ABI,
    functionName: 'isUserRegistered',
    args: [address as `0x${string}`],
  })

  // Get encrypted multi-sig addresses
  const { data: encryptedSigner1 } = useReadContract({
    address: SHADOWAUTH_ADDRESS,
    abi: SHADOWAUTH_ABI,
    functionName: 'getMultiSigAddress',
    args: [address as `0x${string}`, BigInt(0)],
    query: {
      enabled: isRegistered && fhevmReady
    }
  })

  const { data: encryptedSigner2 } = useReadContract({
    address: SHADOWAUTH_ADDRESS,
    abi: SHADOWAUTH_ABI,
    functionName: 'getMultiSigAddress',
    args: [address as `0x${string}`, BigInt(1)],
    query: {
      enabled: isRegistered && fhevmReady
    }
  })

  const { data: encryptedSigner3 } = useReadContract({
    address: SHADOWAUTH_ADDRESS,
    abi: SHADOWAUTH_ABI,
    functionName: 'getMultiSigAddress',
    args: [address as `0x${string}`, BigInt(2)],
    query: {
      enabled: isRegistered && fhevmReady
    }
  })

  useEffect(() => {
    if (registrationStatus !== undefined) {
      setIsRegistered(registrationStatus as boolean)
    }
  }, [registrationStatus])

  // Update encrypted addresses when data is fetched
  useEffect(() => {
    const addresses = []
    if (encryptedSigner1) addresses.push(encryptedSigner1 as string)
    if (encryptedSigner2) addresses.push(encryptedSigner2 as string)
    if (encryptedSigner3) addresses.push(encryptedSigner3 as string)
    
    if (addresses.length === 3) {
      setEncryptedAddresses(addresses)
    }
  }, [encryptedSigner1, encryptedSigner2, encryptedSigner3])

  useEffect(() => {
    if (isSuccess) {
      setIsRegistered(true)
      setMultisigAddresses(['', '', ''])
    }
  }, [isSuccess])
//  as `0x${string}`
  const hexConverter = (array:Uint8Array):`0x${string}`=>{
    return `0x${Array.from(array).map(b => b.toString(16).padStart(2, '0')).join('')}`;
  }

  const handleRegister = async () => {
    try {
      setIsRegistering(true)

      // Check if FHE is ready
      if (!fhevmReady) {
        throw new Error('Please initialize FHE system first')
      }

      // Validate addresses
      const validAddresses = multisigAddresses.every(addr => 
        addr.trim() !== '' && isAddress(addr.trim())
      )
      
      if (!validAddresses) {
        throw new Error('Please enter 3 valid Ethereum addresses')
      }

      const fhevm = getFhevmInstance()


      // Create encrypted input for the three multisig addresses
      const input = fhevm.createEncryptedInput(SHADOWAUTH_ADDRESS, address)
      input.addAddress(multisigAddresses[0].trim())
      input.addAddress(multisigAddresses[1].trim())
      input.addAddress(multisigAddresses[2].trim())
      
      const encryptedInput = await input.encrypt()

      // Call register function with encrypted addresses
      writeContract({
        address: SHADOWAUTH_ADDRESS,
        abi: SHADOWAUTH_ABI,
        functionName: 'register',
        args: [
          hexConverter(encryptedInput.handles[0]), // encryptedSigner1
          hexConverter(encryptedInput.handles[1]), // encryptedSigner2
          hexConverter(encryptedInput.handles[2]), // encryptedSigner3
          hexConverter(encryptedInput.inputProof),
        ],
      })
    } catch (error) {
      console.error('Registration error:', error)
      alert(`Registration failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
    } finally {
      setIsRegistering(false)
    }
  }

  const handleDecrypt = async () => {
    try {
      setIsDecrypting(true)
      setDecryptError(null)

      if (!fhevmReady) {
        throw new Error('FHE system not ready')
      }

      if (encryptedAddresses.length !== 3) {
        throw new Error('Encrypted addresses not loaded')
      }

      if (!walletClient) {
        throw new Error('No wallet connected')
      }

      const fhevm = getFhevmInstance()
      
      // Generate keypair for decryption
      const keypair = fhevm.generateKeypair()
      
      // Prepare handles and contract pairs for decryption
      const handleContractPairs = encryptedAddresses.map(handle => ({
        handle: handle,
        contractAddress: SHADOWAUTH_ADDRESS,
      }))
      
      const startTimeStamp = Math.floor(Date.now() / 1000).toString()
      const durationDays = "10"
      const contractAddresses = [SHADOWAUTH_ADDRESS]
      
      // Create EIP-712 signature for user decryption
      const eip712 = fhevm.createEIP712(
        keypair.publicKey,
        contractAddresses,
        startTimeStamp,
        durationDays
      )
      
      
      // Create a signer-like object for signing typed data
    const signature = await walletClient.signTypedData({
      domain: eip712.domain,
      types: {
        UserDecryptRequestVerification: eip712.types.UserDecryptRequestVerification,
      },
      primaryType: 'UserDecryptRequestVerification',
      message: eip712.message,
    });
      
      // Decrypt the addresses
      const result = await fhevm.userDecrypt(
        handleContractPairs,
        keypair.privateKey,
        keypair.publicKey,
        signature.replace("0x", ""),
        contractAddresses,
        address,
        startTimeStamp,
        durationDays
      )
      
      // Extract decrypted values
      const decryptedValues = encryptedAddresses.map(handle => {
        const decryptedValue = result[handle]
        console.log('Decrypted handle:', handle, 'Value:', decryptedValue)
        
        // Convert decrypted address to proper format if needed
        if (typeof decryptedValue === 'string' && decryptedValue.startsWith('0x')) {
          return decryptedValue
        } else if (typeof decryptedValue === 'bigint') {
          // Convert bigint to address format
          return `0x${decryptedValue.toString(16).padStart(40, '0')}`
        } else if (decryptedValue) {
          // Try to convert to hex address
          return `0x${decryptedValue.toString()}`
        }
        return 'Decryption failed'
      })
      setDecryptedAddresses(decryptedValues)
      
    } catch (error) {
      console.error('Decryption error:', error)
      setDecryptError(error instanceof Error ? error.message : 'Decryption failed')
    } finally {
      setIsDecrypting(false)
    }
  }

  if (isRegistered) {
    return (
      <div className="registration-success">
        <h3>✓ Registration Complete</h3>
        <p>Your account is registered with encrypted multisig addresses.</p>
        
        <div className="multisig-display">
          <h4>Your Encrypted Multi-sig Addresses:</h4>
          
          {encryptedAddresses.length > 0 ? (
            <>
              {encryptedAddresses.map((encryptedAddr, index) => (
                <div key={index} className="encrypted-address">
                  {decryptedAddresses.length === 0 && (
                    <>
                      <label>Multi-sig Address {index + 1} (Encrypted):</label>
                      <div className="address-value">
                        <input 
                          type="text" 
                          value={encryptedAddr} 
                          readOnly 
                          className="encrypted-input"
                        />
                      </div>
                    </>
                  )}
                  {decryptedAddresses[index] && (
                    <div className="decrypted-value">
                      <label>Multi-sig Address {index + 1}:</label>
                      <input 
                        type="text" 
                        value={decryptedAddresses[index]} 
                        readOnly 
                        className="decrypted-input"
                      />
                    </div>
                  )}
                </div>
              ))}
              
              <button
                onClick={handleDecrypt}
                disabled={!fhevmReady || isDecrypting || encryptedAddresses.length !== 3}
                className="decrypt-button"
              >
                {!fhevmReady ? 'FHE Not Ready' :
                 isDecrypting ? 'Decrypting...' :
                 decryptedAddresses.length > 0 ? 'Decrypt Again' :
                 'Decrypt Addresses'}
              </button>
              
              {decryptError && (
                <div className="error">
                  Decryption Error: {decryptError}
                </div>
              )}
            </>
          ) : (
            <p>Loading encrypted addresses...</p>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="registration-form">
      <h3>Register Your Account</h3>
      <p>Enter 3 Ethereum addresses that will serve as your encrypted multisig validators:</p>
      
      {multisigAddresses.map((address, index) => (
        <div key={index} className="input-group">
          <label htmlFor={`signer-${index}`}>
            Multisig Address {index + 1}:
          </label>
          <input
            id={`signer-${index}`}
            type="text"
            placeholder="0x..."
            value={address}
            onChange={(e) => {
              const newAddresses = [...multisigAddresses]
              newAddresses[index] = e.target.value
              setMultisigAddresses(newAddresses)
            }}
            disabled={isRegistering || isPending || isConfirming}
          />
        </div>
      ))}

      {!fhevmReady && (
        <div className="fhe-required">
          <p>⚠️ FHE system must be initialized to register with encrypted addresses</p>
          <p>Click "Initialize FHE" in the header to enable registration.</p>
        </div>
      )}

      <button
        onClick={handleRegister}
        disabled={
          !fhevmReady ||
          isRegistering || 
          isPending || 
          isConfirming || 
          multisigAddresses.some(addr => addr.trim() === '')
        }
        className="register-button"
      >
        {!fhevmReady ? 'Initialize FHE Required' :
         isRegistering || isPending ? 'Encrypting...' : 
         isConfirming ? 'Confirming...' : 
         'Register Account'}
      </button>

      {error && (
        <div className="error">
          Error: {error.message}
        </div>
      )}
    </div>
  )
}