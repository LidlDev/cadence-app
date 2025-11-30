#!/bin/bash

# Cadence App - Deployment Script
# This script helps you deploy the app to Vercel

set -e  # Exit on error

echo "🚀 Cadence App - Deployment Script"
echo "===================================="
echo ""

# Check if git is initialized
if [ ! -d ".git" ]; then
    echo "📦 Initializing Git repository..."
    git init
    git add .
    git commit -m "Initial commit: Cadence running tracker app"
    echo "✅ Git repository initialized"
    echo ""
else
    echo "✅ Git repository already initialized"
    echo ""
fi

# Check if remote is set
if ! git remote | grep -q "origin"; then
    echo "🔗 Setting up GitHub remote..."
    echo ""
    echo "Please enter your GitHub username:"
    read github_username
    echo ""
    echo "Please enter your repository name (default: cadence-app):"
    read repo_name
    repo_name=${repo_name:-cadence-app}
    
    git remote add origin "https://github.com/$github_username/$repo_name.git"
    echo "✅ Remote added: https://github.com/$github_username/$repo_name.git"
    echo ""
    echo "⚠️  Make sure you've created this repository on GitHub first!"
    echo "   Go to: https://github.com/new"
    echo ""
    echo "Press Enter to continue after creating the repository..."
    read
else
    echo "✅ GitHub remote already configured"
    echo ""
fi

# Push to GitHub
echo "📤 Pushing to GitHub..."
git branch -M main
git push -u origin main
echo "✅ Pushed to GitHub"
echo ""

# Check if Vercel CLI is installed
if ! command -v vercel &> /dev/null; then
    echo "📦 Installing Vercel CLI..."
    npm i -g vercel
    echo "✅ Vercel CLI installed"
    echo ""
else
    echo "✅ Vercel CLI already installed"
    echo ""
fi

# Deploy to Vercel
echo "🚀 Deploying to Vercel..."
echo ""
echo "You'll need to:"
echo "1. Login to Vercel"
echo "2. Select your account/team"
echo "3. Confirm project settings"
echo ""
echo "Press Enter to start deployment..."
read

vercel --prod

echo ""
echo "✅ Deployment complete!"
echo ""
echo "📋 Next Steps:"
echo "1. Copy your Vercel deployment URL"
echo "2. Update environment variables in Vercel dashboard:"
echo "   - NEXT_PUBLIC_STRAVA_REDIRECT_URI=https://YOUR_URL/api/strava/callback"
echo "   - NEXT_PUBLIC_APP_URL=https://YOUR_URL"
echo "3. Update Strava OAuth settings:"
echo "   - Go to: https://www.strava.com/settings/api"
echo "   - Set Authorization Callback Domain to: YOUR_VERCEL_DOMAIN"
echo "4. Redeploy: vercel --prod"
echo ""
echo "📖 For detailed instructions, see DEPLOYMENT-GUIDE.md"
echo ""

