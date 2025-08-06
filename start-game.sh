#!/bin/bash

# 🎮 Memex Racing - Easy Start Script
# This script makes it easy to deploy and play the game

echo "🎮 Memex Racing - Serverless Multiplayer"
echo "========================================"
echo ""

# Check if node is installed
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed. Please install Node.js first."
    echo "   Visit: https://nodejs.org"
    exit 1
fi

# Check if this is first run
if [ ! -f ".env" ]; then
    echo "🔧 First time setup detected..."
    echo ""
    
    # Run setup
    npm run deploy:setup
    
    echo ""
    echo "⚠️  Please configure your .env file with:"
    echo "   - Ably API key (get from ably.com)"
    echo "   - JWT secret (generate with: openssl rand -base64 32)"
    echo ""
    echo "Then run this script again!"
    exit 0
fi

# Check if already deployed
if [ -f ".vercel/project.json" ]; then
    echo "✅ Project already deployed!"
    echo ""
    
    # Get deployment URL
    DEPLOYMENT_URL=$(vercel ls --json 2>/dev/null | grep -o '"url":"[^"]*' | head -1 | cut -d'"' -f4)
    
    if [ ! -z "$DEPLOYMENT_URL" ]; then
        echo "🌐 Your game is live at: https://$DEPLOYMENT_URL"
        echo ""
        echo "Options:"
        echo "1) Open game in browser"
        echo "2) Deploy new version"
        echo "3) View logs"
        echo "4) Exit"
        echo ""
        read -p "Choose an option (1-4): " choice
        
        case $choice in
            1)
                echo "🌐 Opening game..."
                open "https://$DEPLOYMENT_URL" 2>/dev/null || xdg-open "https://$DEPLOYMENT_URL" 2>/dev/null || echo "Please open: https://$DEPLOYMENT_URL"
                ;;
            2)
                echo "🚀 Deploying new version..."
                npm run deploy:vercel:prod
                ;;
            3)
                echo "📊 Viewing logs..."
                vercel logs
                ;;
            4)
                echo "👋 Goodbye!"
                exit 0
                ;;
        esac
    fi
else
    echo "🚀 Deploying game for the first time..."
    echo ""
    
    # Install dependencies if needed
    if [ ! -d "node_modules" ]; then
        echo "📦 Installing dependencies..."
        npm install
    fi
    
    # Build for serverless
    echo "🔨 Building game..."
    npm run build:serverless
    
    # Check if logged in to Vercel
    if ! vercel whoami &> /dev/null; then
        echo "📝 Please login to Vercel first..."
        vercel login
    fi
    
    # Deploy
    echo "🚀 Deploying to Vercel..."
    vercel --prod --yes
    
    echo ""
    echo "✅ Deployment complete!"
    echo "🎮 Your game is now live and ready for multiplayer!"
fi

echo ""
echo "🎯 Next steps:"
echo "   - Share your game URL with friends"
echo "   - Create rooms and play together"
echo "   - Check Vercel dashboard for analytics"
echo ""