# ShadowAuth

An encrypted multi-signature wallet system built with Zama's FHEVM (Fully Homomorphic Encryption Virtual Machine). ShadowAuth allows users to register with encrypted multisig addresses that remain private on-chain, providing enhanced security and privacy for fund management.

## Features

- **Encrypted Multi-signature**: Register 3 encrypted multisig addresses that remain private on-chain
- **Secure Deposits**: Deposit ETH freely into your encrypted wallet
- **Protected Withdrawals**: Require all multisig addresses to approve withdrawals with time-based limits
- **Privacy-First**: All sensitive data encrypted with Zama's FHE technology
- **User-Friendly Interface**: React-based frontend with wallet integration

## Quick Start

### Frontend Setup (Recommended)

1. **Quick setup with script**
   ```bash
   chmod +x setup-frontend.sh
   ./setup-frontend.sh
   ```

2. **Manual setup**
   ```bash
   cd app
   npm install
   npm run dev
   ```

3. **Update WalletConnect Project ID**
   - Get a project ID from [WalletConnect Cloud](https://cloud.walletconnect.com)
   - Edit `app/src/wagmi.ts` and replace `'YOUR_WALLETCONNECT_PROJECT_ID'`

### Contract Development

1. **Install dependencies**
   ```bash
   npm install
   ```

2. **Set up environment variables**
   ```bash
   npx hardhat vars set MNEMONIC
   npx hardhat vars set INFURA_API_KEY
   npx hardhat vars set ETHERSCAN_API_KEY  # Optional
   ```

3. **Compile and test contracts**
   ```bash
   npm run compile
   npm run test
   ```

4. **Deploy to Sepolia**
   ```bash
   npx hardhat deploy --network sepolia
   ```

## 📁 Project Structure

```
ShadowAuth/
├── contracts/              # Smart contracts
│   └── ShadowAuth.sol     # Main encrypted multisig contract
├── app/                   # React frontend
│   ├── src/
│   │   ├── components/    # React components
│   │   ├── contract.ts    # Contract ABI and address
│   │   ├── fhevm.ts      # Zama FHEVM setup
│   │   └── wagmi.ts      # Wallet configuration
│   └── README.md         # Frontend documentation
├── deploy/               # Deployment scripts
├── tasks/                # Hardhat custom tasks
├── test/                 # Contract tests
├── setup-frontend.sh     # Frontend setup script
└── README.md            # This file
```

## 🚀 Deployed Contracts

### Sepolia Testnet
- **ShadowAuth**: `0xcf91b437a6880e14e7615d07b3aCAce6A533dFB7`
- **Network**: Sepolia (Chain ID: 11155111)
- **Explorer**: [View on Sepolia Etherscan](https://sepolia.etherscan.io/address/0xcf91b437a6880e14e7615d07b3aCAce6A533dFB7)

## 📜 Available Scripts

| Script             | Description              |
| ------------------ | ------------------------ |
| `npm run compile`  | Compile all contracts    |
| `npm run test`     | Run all tests            |
| `npm run coverage` | Generate coverage report |
| `npm run lint`     | Run linting checks       |
| `npm run clean`    | Clean build artifacts    |

## 🔐 How ShadowAuth Works

### 1. Registration
- Users register by providing 3 Ethereum addresses as multisig validators
- These addresses are encrypted using Zama's FHE and stored on-chain
- The encrypted addresses remain private and cannot be viewed by anyone

### 2. Deposits
- Users can deposit ETH freely into their account
- Funds are held securely in the contract

### 3. Withdrawals
- To withdraw, users must request withdrawal first
- The system decrypts the encrypted multisig addresses using Zama's decryption oracle
- All 3 multisig addresses must have set valid withdrawal limits with deadlines
- If approved by all signers, users can execute the withdrawal

### 4. Multisig Management
- Multisig signers can set withdrawal limits with deadlines
- Limits specify maximum withdrawal amount and expiration time
- All 3 registered multisig addresses must approve for successful withdrawal

## 📚 Documentation

- **Frontend Guide**: See [app/README.md](app/README.md) for detailed frontend documentation
- **FHEVM Documentation**: [Zama FHEVM Docs](https://docs.zama.ai/fhevm)
- **Contract Guide**: Check [CLAUDE.md](CLAUDE.md) for development guidelines

## 🔒 Security Features

- **Fully Encrypted**: All sensitive data encrypted with FHE
- **Private Multisig**: Multisig addresses never revealed on-chain
- **Time-based Limits**: Withdrawal permissions expire automatically
- **Decentralized Decryption**: Uses Zama's decentralized oracle network
- **Access Control**: Fine-grained permissions for data access

## 📄 License

This project is licensed under the BSD-3-Clause-Clear License. See the [LICENSE](LICENSE) file for details.

## 🆘 Support

- **Issues**: [Report bugs or request features](https://github.com/zama-ai/fhevm/issues)
- **Documentation**: [Zama Docs](https://docs.zama.ai)
- **Community**: [Zama Discord](https://discord.gg/zama)

---

**Built with ❤️ using Zama's FHEVM technology**
