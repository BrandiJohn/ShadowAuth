import { useState, useEffect } from 'react'
import { useReadContract, useWriteContract, useWaitForTransactionReceipt } from 'wagmi'
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

  useEffect(() => {
    if (registrationStatus !== undefined) {
      setIsRegistered(registrationStatus as boolean)
    }
  }, [registrationStatus])

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

  if (isRegistered) {
    return (
      <div className="registration-success">
        <h3>✓ Registration Complete</h3>
        <p>Your account is registered with encrypted multisig addresses.</p>
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