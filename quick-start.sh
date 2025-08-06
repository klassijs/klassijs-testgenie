#!/bin/bash

echo "🚀 AI-Powered Test Automation Platform - Quick Start"
echo "=================================================="

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed. Please install Node.js v16 or higher."
    echo "   Download from: https://nodejs.org/"
    exit 1
fi

echo "✅ Node.js version: $(node --version)"

# Check if pnpm is installed
if ! command -v pnpm &> /dev/null; then
    echo "❌ pnpm is not installed. Installing pnpm..."
    npm install -g pnpm
    if [ $? -ne 0 ]; then
        echo "❌ Failed to install pnpm. Please install manually:"
        echo "   npm install -g pnpm"
        echo "   or visit: https://pnpm.io/installation"
        exit 1
    fi
fi

echo "✅ pnpm version: $(pnpm --version)"

# Check if .env file exists
if [ ! -f .env ]; then
    echo "📝 Creating .env file from template..."
    cp env.example .env
    echo "⚠️  Please edit .env file with your Azure OpenAI credentials before starting the app."
    echo "   Required variables:"
    echo "   - AZURE_OPENAI_API_KEY"
    echo "   - AZURE_OPENAI_ENDPOINT"
    echo "   - AZURE_OPENAI_MODEL"
    echo "   - FRONTEND_URL (optional, defaults to http://localhost:3000)"
fi

# Clean install with pnpm
echo "🧹 Cleaning previous installations..."
rm -rf node_modules pnpm-lock.yaml
rm -rf frontend/node_modules frontend/pnpm-lock.yaml
rm -rf backend/node_modules backend/pnpm-lock.yaml

# Install dependencies for the monorepo
echo "📦 Installing dependencies for monorepo..."
pnpm install

if [ $? -ne 0 ]; then
    echo "❌ Failed to install dependencies"
    exit 1
fi

echo ""
echo "🎯 Setup complete! To start the application:"
echo ""
echo "1. Configure your Azure OpenAI credentials in .env file"
echo "2. Run: pnpm run dev"
echo ""
echo "The application will be available at:"
echo "   Frontend: http://localhost:3000"
echo "   Backend:  http://localhost:5000"
echo ""
echo "Other useful commands:"
echo "   pnpm run server    - Start backend only"
echo "   pnpm run client    - Start frontend only"
echo "   pnpm run build     - Build frontend for production"
echo "   pnpm run test      - Run frontend tests"
echo ""
echo "Project structure:"
echo "   frontend/ - React application"
echo "   backend/  - Express API server"
echo ""
echo "Happy testing! 🧪" 