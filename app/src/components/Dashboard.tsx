import { useState, useEffect } from 'react'
import { useReadContract, useWriteContract, useWaitForTransactionReceipt } from 'wagmi'
import { parseEther, formatEther } from 'viem'
import { SHADOWAUTH_ADDRESS, SHADOWAUTH_ABI } from '../contract'

interface Props {
  address: string
}

interface WithdrawalRequest {
  amount: bigint
  requestId: bigint
  isPending: boolean
  canWithdraw: boolean
  isProcessed: boolean
}

export default function Dashboard({ address }: Props) {
  const [depositAmount, setDepositAmount] = useState('')
  const [withdrawAmount, setWithdrawAmount] = useState('')
  const [withdrawalRequest, setWithdrawalRequest] = useState<WithdrawalRequest | null>(null)

  const { writeContract: writeDeposit, data: depositHash, isPending: isDepositPending } = useWriteContract()
  const { writeContract: writeWithdrawRequest, data: withdrawRequestHash, isPending: isWithdrawRequestPending } = useWriteContract()
  const { writeContract: writeExecuteWithdraw, data: executeHash, isPending: isExecutePending } = useWriteContract()

  const { isLoading: isDepositConfirming, isSuccess: isDepositSuccess } = useWaitForTransactionReceipt({
    hash: depositHash,
  })

  const { isLoading: isWithdrawRequestConfirming, isSuccess: isWithdrawRequestSuccess } = useWaitForTransactionReceipt({
    hash: withdrawRequestHash,
  })

  const { isLoading: isExecuteConfirming, isSuccess: isExecuteSuccess } = useWaitForTransactionReceipt({
    hash: executeHash,
  })

  // Get user balance
  const { data: balance, refetch: refetchBalance } = useReadContract({
    address: SHADOWAUTH_ADDRESS,
    abi: SHADOWAUTH_ABI,
    functionName: 'getBalance',
    args: [address as `0x${string}`],
  })

  // Get withdrawal request status
  const { data: withdrawalRequestData, refetch: refetchWithdrawalRequest } = useReadContract({
    address: SHADOWAUTH_ADDRESS,
    abi: SHADOWAUTH_ABI,
    functionName: 'getWithdrawalRequest',
    args: [address as `0x${string}`],
  })

  // Check if user is registered
  const { data: isRegistered } = useReadContract({
    address: SHADOWAUTH_ADDRESS,
    abi: SHADOWAUTH_ABI,
    functionName: 'isUserRegistered',
    args: [address as `0x${string}`],
  })

  useEffect(() => {
    if (withdrawalRequestData) {
      const [amount, requestId, isPending, canWithdraw, isProcessed] = withdrawalRequestData as [bigint, bigint, boolean, boolean, boolean]
      setWithdrawalRequest({
        amount,
        requestId,
        isPending,
        canWithdraw,
        isProcessed
      })
    }
  }, [withdrawalRequestData])

  useEffect(() => {
    if (isDepositSuccess) {
      setDepositAmount('')
      refetchBalance()
    }
  }, [isDepositSuccess, refetchBalance])

  useEffect(() => {
    if (isWithdrawRequestSuccess) {
      setWithdrawAmount('')
      refetchWithdrawalRequest()
    }
  }, [isWithdrawRequestSuccess, refetchWithdrawalRequest])

  useEffect(() => {
    if (isExecuteSuccess) {
      refetchBalance()
      refetchWithdrawalRequest()
    }
  }, [isExecuteSuccess, refetchBalance, refetchWithdrawalRequest])

  const handleDeposit = async () => {
    try {
      const amount = parseEther(depositAmount)
      
      writeDeposit({
        address: SHADOWAUTH_ADDRESS,
        abi: SHADOWAUTH_ABI,
        functionName: 'deposit',
        value: amount,
      })
    } catch (error) {
      console.error('Deposit error:', error)
      alert(`Deposit failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  const handleRequestWithdrawal = async () => {
    try {
      const amount = parseEther(withdrawAmount)
      
      writeWithdrawRequest({
        address: SHADOWAUTH_ADDRESS,
        abi: SHADOWAUTH_ABI,
        functionName: 'requestWithdrawal',
        args: [amount],
      })
    } catch (error) {
      console.error('Withdrawal request error:', error)
      alert(`Withdrawal request failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  const handleExecuteWithdrawal = async () => {
    try {
      writeExecuteWithdraw({
        address: SHADOWAUTH_ADDRESS,
        abi: SHADOWAUTH_ABI,
        functionName: 'executeWithdrawal',
      })
    } catch (error) {
      console.error('Execute withdrawal error:', error)
      alert(`Execute withdrawal failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  if (!isRegistered) {
    return (
      <div className="dashboard-inactive">
        <h3>Account Not Registered</h3>
        <p>Please register your account first before using the dashboard.</p>
      </div>
    )
  }

  return (
    <div className="dashboard">
      <h3>Account Dashboard</h3>
      
      {/* Balance Display */}
      <div className="balance-card">
        <h4>Your Balance</h4>
        <div className="balance-amount">
          {balance !== undefined ? `${formatEther(balance as bigint)} ETH` : 'Loading...'}
        </div>
      </div>

      {/* Deposit Section */}
      <div className="action-card">
        <h4>Deposit Funds</h4>
        <div className="input-group">
          <label htmlFor="deposit-amount">Amount (ETH):</label>
          <input
            id="deposit-amount"
            type="number"
            step="0.01"
            placeholder="0.0"
            value={depositAmount}
            onChange={(e) => setDepositAmount(e.target.value)}
            disabled={isDepositPending || isDepositConfirming}
          />
        </div>
        <button
          onClick={handleDeposit}
          disabled={
            !depositAmount || 
            parseFloat(depositAmount) <= 0 || 
            isDepositPending || 
            isDepositConfirming
          }
          className="action-button deposit-button"
        >
          {isDepositPending ? 'Confirming...' : 
           isDepositConfirming ? 'Processing...' : 
           'Deposit'}
        </button>
      </div>

      {/* Withdrawal Section */}
      <div className="action-card">
        <h4>Withdraw Funds</h4>
        
        {!withdrawalRequest?.isPending ? (
          <>
            <div className="input-group">
              <label htmlFor="withdraw-amount">Amount (ETH):</label>
              <input
                id="withdraw-amount"
                type="number"
                step="0.01"
                placeholder="0.0"
                value={withdrawAmount}
                onChange={(e) => setWithdrawAmount(e.target.value)}
                disabled={isWithdrawRequestPending || isWithdrawRequestConfirming}
              />
            </div>
            <button
              onClick={handleRequestWithdrawal}
              disabled={
                !withdrawAmount || 
                parseFloat(withdrawAmount) <= 0 || 
                isWithdrawRequestPending || 
                isWithdrawRequestConfirming
              }
              className="action-button withdraw-button"
            >
              {isWithdrawRequestPending ? 'Confirming...' : 
               isWithdrawRequestConfirming ? 'Processing...' : 
               'Request Withdrawal'}
            </button>
          </>
        ) : (
          <div className="withdrawal-request-status">
            <h5>Withdrawal Request Status</h5>
            <p>Amount: {formatEther(withdrawalRequest.amount)} ETH</p>
            <p>Request ID: {withdrawalRequest.requestId.toString()}</p>
            
            {!withdrawalRequest.isProcessed ? (
              <p className="status-pending">⏳ Waiting for multisig decryption...</p>
            ) : withdrawalRequest.canWithdraw ? (
              <>
                <p className="status-approved">✅ Withdrawal approved by multisig</p>
                <button
                  onClick={handleExecuteWithdrawal}
                  disabled={isExecutePending || isExecuteConfirming}
                  className="action-button execute-button"
                >
                  {isExecutePending ? 'Confirming...' : 
                   isExecuteConfirming ? 'Processing...' : 
                   'Execute Withdrawal'}
                </button>
              </>
            ) : (
              <p className="status-rejected">❌ Withdrawal rejected by multisig</p>
            )}
          </div>
        )}
      </div>

      {/* Transaction Status */}
      {(isDepositSuccess || isWithdrawRequestSuccess || isExecuteSuccess) && (
        <div className="success-message">
          {isDepositSuccess && 'Deposit successful!'}
          {isWithdrawRequestSuccess && 'Withdrawal request submitted!'}
          {isExecuteSuccess && 'Withdrawal executed successfully!'}
        </div>
      )}
    </div>
  )
}