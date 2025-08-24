import { useState, useEffect } from 'react'
import { useReadContract, useWriteContract, useWaitForTransactionReceipt } from 'wagmi'
import { parseEther, formatEther } from 'viem'
import { SHADOWAUTH_ADDRESS, SHADOWAUTH_ABI } from '../contract'

interface Props {
  address: string
}

interface WithdrawalLimit {
  maxAmount: bigint
  deadline: bigint
  isSet: boolean
}

export default function MultisigManager({ address }: Props) {
  const [maxAmount, setMaxAmount] = useState('')
  const [days, setDays] = useState('')
  const [withdrawalLimit, setWithdrawalLimit] = useState<WithdrawalLimit | null>(null)

  const { writeContract, data: hash, isPending } = useWriteContract()

  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({
    hash,
  })

  // Get current withdrawal limit for this signer address
  const { data: withdrawalLimitData, refetch: refetchLimit } = useReadContract({
    address: SHADOWAUTH_ADDRESS,
    abi: SHADOWAUTH_ABI,
    functionName: 'getWithdrawalLimit',
    args: [address as `0x${string}`],
  })

  useEffect(() => {
    if (withdrawalLimitData) {
      const [maxAmount, deadline, isSet] = withdrawalLimitData as [bigint, bigint, boolean]
      setWithdrawalLimit({
        maxAmount,
        deadline,
        isSet
      })
    }
  }, [withdrawalLimitData])

  useEffect(() => {
    if (isSuccess) {
      setMaxAmount('')
      setDays('')
      refetchLimit()
    }
  }, [isSuccess, refetchLimit])

  const handleSetLimit = async () => {
    try {
      const amountWei = parseEther(maxAmount)
      const daysInSeconds = BigInt(parseInt(days) * 24 * 60 * 60)
      const deadline = BigInt(Math.floor(Date.now() / 1000)) + daysInSeconds
      
      writeContract({
        address: SHADOWAUTH_ADDRESS,
        abi: SHADOWAUTH_ABI,
        functionName: 'setWithdrawalLimit',
        args: [amountWei, deadline],
      })
    } catch (error) {
      console.error('Set limit error:', error)
      alert(`Failed to set limit: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  const formatDeadline = (deadline: bigint) => {
    const date = new Date(Number(deadline) * 1000)
    return date.toLocaleString()
  }

  return (
    <div className="multisig-manager">
      <h3>Multisig Manager</h3>
      <p>Set withdrawal limits as a multisig signer</p>

      {/* Current Limit Display */}
      {withdrawalLimit?.isSet ? (
        <div className="current-limit-card">
          <h4>Current Withdrawal Limit</h4>
          <div className="limit-details">
            <p><strong>Max Amount:</strong> {formatEther(withdrawalLimit.maxAmount)} ETH</p>
            <p><strong>Deadline:</strong> {formatDeadline(withdrawalLimit.deadline)}</p>
            <p className={Number(withdrawalLimit.deadline) > Date.now() / 1000 ? "status-active" : "status-expired"}>
              {Number(withdrawalLimit.deadline) > Date.now() / 1000 ? "✅ Active" : "❌ Expired"}
            </p>
          </div>
        </div>
      ) : (
        <div className="no-limit-card">
          <p>No withdrawal limit set for this address</p>
        </div>
      )}

      {/* Set New Limit Form */}
      <div className="set-limit-card">
        <h4>Set New Withdrawal Limit</h4>
        
        <div className="input-group">
          <label htmlFor="max-amount">Maximum Withdrawal Amount (ETH):</label>
          <input
            id="max-amount"
            type="number"
            step="0.01"
            placeholder="0.0"
            value={maxAmount}
            onChange={(e) => setMaxAmount(e.target.value)}
            disabled={isPending || isConfirming}
          />
        </div>

        <div className="input-group">
          <label htmlFor="days">Valid for (days):</label>
          <input
            id="days"
            type="number"
            min="1"
            placeholder="7"
            value={days}
            onChange={(e) => setDays(e.target.value)}
            disabled={isPending || isConfirming}
          />
        </div>

        <button
          onClick={handleSetLimit}
          disabled={
            !maxAmount || 
            !days || 
            parseFloat(maxAmount) <= 0 || 
            parseInt(days) <= 0 || 
            isPending || 
            isConfirming
          }
          className="action-button set-limit-button"
        >
          {isPending ? 'Confirming...' : 
           isConfirming ? 'Processing...' : 
           'Set Withdrawal Limit'}
        </button>
      </div>

      {/* Information Section */}
      <div className="info-card">
        <h4>How it works</h4>
        <ul>
          <li>As a multisig signer, you can set withdrawal limits for users who have registered your address</li>
          <li>Users need ALL their registered multisig addresses to set valid withdrawal limits</li>
          <li>The withdrawal amount must be within the limit and before the deadline</li>
          <li>Limits are automatically cleared after successful withdrawals</li>
        </ul>
      </div>

      {/* Success Message */}
      {isSuccess && (
        <div className="success-message">
          Withdrawal limit set successfully!
        </div>
      )}
    </div>
  )
}