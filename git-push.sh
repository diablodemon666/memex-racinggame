#!/bin/bash

echo "🚀 Pushing Memex Racing Game to GitHub..."
echo ""

# Configure git (if not already done)
git config user.email "diablodemon9966@gmail.com"
git config user.name "diablodemon666"

# Add all files
echo "📦 Adding files..."
git add -A

# Create commit
echo "💾 Creating commit..."
git commit -m "Initial commit: Memex Racing Game with serverless multiplayer support"

# Push to GitHub
echo "📤 Pushing to GitHub..."
git branch -M main
git push -u origin main

echo ""
echo "✅ Done! Your code is now on GitHub."
echo ""
echo "🎮 Next steps:"
echo "1. Go to https://vercel.com/new"
echo "2. Import from GitHub: diablodemon666/memex-racinggame"
echo "3. Deploy with one click!"
echo ""