# ShadowAuth Frontend

A React-based frontend application for the ShadowAuth encrypted multi-signature wallet system.

## Features

- **Wallet Connection**: Connect to Ethereum wallets using RainbowKit
- **User Registration**: Register with 3 encrypted multisig addresses
- **Deposit Funds**: Deposit ETH into your encrypted wallet
- **Withdrawal System**: Request and execute withdrawals with multisig authorization
- **Multisig Management**: Set withdrawal limits as a multisig signer
- **FHE Integration**: Uses Zama's FHEVM for encryption

## Getting Started

### Prerequisites

- Node.js 16+ 
- An Ethereum wallet (MetaMask, etc.)
- Sepolia testnet ETH for testing

### Installation

1. Install dependencies:
```bash
npm install
```

2. Update the WalletConnect Project ID in `src/wagmi.ts`:
   - Get a project ID from [WalletConnect Cloud](https://cloud.walletconnect.com)
   - Replace `'YOUR_WALLETCONNECT_PROJECT_ID'` with your actual project ID

3. Start the development server:
```bash
npm run dev
```

## How It Works

### 1. Registration
- Users register by providing 3 Ethereum addresses as multisig validators
- These addresses are encrypted using Zama's FHE and stored on-chain
- The encrypted addresses remain private and cannot be viewed by anyone

### 2. Deposits
- Users can deposit ETH freely into their account
- Funds are held in the contract and tracked in the user's balance

### 3. Withdrawals
- To withdraw, users must request withdrawal first
- The system decrypts the encrypted multisig addresses
- All 3 multisig addresses must have set valid withdrawal limits
- If approved, users can execute the withdrawal

### 4. Multisig Management
- Multisig signers can set withdrawal limits with deadlines
- Limits specify maximum withdrawal amount and expiration time
- All 3 registered multisig addresses must approve for successful withdrawal

## Contract Integration

The frontend connects to the deployed ShadowAuth contract on Sepolia testnet:
- Contract Address: `0xcf91b437a6880e14e7615d07b3aCAce6A533dFB7`
- Network: Sepolia Testnet
- Uses Zama's FHEVM for encrypted operations

## Technology Stack

- **React + TypeScript**: Frontend framework
- **Vite**: Build tool and dev server
- **RainbowKit + Wagmi**: Wallet connection and Ethereum interactions
- **Viem**: Ethereum library for type-safe interactions
- **Zama Relayer SDK**: FHE encryption and decryption
- **CSS Grid/Flexbox**: Responsive layout

## Development

### Available Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run preview` - Preview production build
- `npm run lint` - Run ESLint

### Project Structure

```
src/
├── components/          # React components
│   ├── Registration.tsx # User registration form
│   ├── Dashboard.tsx    # Main user interface
│   └── MultisigManager.tsx # Multisig limit management
├── contract.ts          # Contract ABI and address
├── fhevm.ts            # Zama FHEVM initialization
├── wagmi.ts            # Wagmi configuration
├── App.tsx             # Main app component
└── main.tsx            # App entry point
```

## Security Features

- **Encrypted Multisig**: Multisig addresses are encrypted and never revealed on-chain
- **Withdrawal Protection**: Requires all multisig approvals before withdrawal
- **Time-based Limits**: Withdrawal limits have expiration deadlines
- **FHE Privacy**: All sensitive data encrypted with fully homomorphic encryption

## Troubleshooting

### Common Issues

1. **FHEVM Initialization Fails**
   - Check network connection
   - Ensure you're on Sepolia testnet
   - Try refreshing the page

2. **Transaction Fails**
   - Ensure you have enough Sepolia ETH for gas
   - Check if you're registered before trying other operations
   - Verify contract interaction parameters

3. **Wallet Connection Issues**
   - Update your WalletConnect project ID
   - Try different wallet or browser
   - Clear browser cache and reconnect
