#!/bin/bash

# ShadowAuth Frontend Setup Script

echo "🔐 Setting up ShadowAuth Frontend..."

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed. Please install Node.js 16+ first."
    echo "Visit: https://nodejs.org/"
    exit 1
fi

# Check Node.js version
NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt "16" ]; then
    echo "❌ Node.js version 16+ required. Current version: $(node -v)"
    exit 1
fi

echo "✅ Node.js $(node -v) detected"

# Navigate to app directory
cd app || { echo "❌ app directory not found"; exit 1; }

# Install dependencies
echo "📦 Installing dependencies..."
npm install

if [ $? -ne 0 ]; then
    echo "❌ Failed to install dependencies"
    exit 1
fi

echo "✅ Dependencies installed successfully"

# Check if wagmi.ts needs WalletConnect project ID
if grep -q "YOUR_WALLETCONNECT_PROJECT_ID" src/wagmi.ts; then
    echo ""
    echo "⚠️  IMPORTANT: Update WalletConnect Project ID"
    echo "1. Get a project ID from: https://cloud.walletconnect.com"
    echo "2. Edit src/wagmi.ts and replace 'YOUR_WALLETCONNECT_PROJECT_ID'"
    echo ""
fi

# Build the project to check for errors
echo "🏗️  Building project to verify setup..."
npm run build

if [ $? -eq 0 ]; then
    echo "✅ Build successful!"
    echo ""
    echo "🚀 Setup complete! To start developing:"
    echo "   cd app"
    echo "   npm run dev"
    echo ""
    echo "📋 Next steps:"
    echo "1. Update WalletConnect project ID in src/wagmi.ts"
    echo "2. Ensure you have Sepolia testnet ETH"
    echo "3. Connect your wallet and start using ShadowAuth!"
else
    echo "❌ Build failed. Please check the errors above."
    exit 1
fi