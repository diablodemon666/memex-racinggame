#!/bin/bash

# Quick deploy script for Memex Racing Game

echo "🚀 Deploying Memex Racing Game to Vercel..."
echo ""

# Check if logged in
if ! vercel whoami &> /dev/null; then
    echo "📝 Please login to Vercel first:"
    vercel login
    echo ""
fi

# Deploy to production
echo "🔨 Building and deploying..."
vercel --prod

echo ""
echo "✅ Deployment complete!"
echo ""
echo "🎮 Your game should be live at one of these URLs:"
echo "   https://memex-racing-game.vercel.app"
echo "   https://memex-racing-game-[your-username].vercel.app"
echo ""
echo "📊 To view deployment status: vercel ls"
echo "📝 To view logs: vercel logs"
echo ""