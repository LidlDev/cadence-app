#!/bin/bash

# Supabase Edge Functions Deployment Script
# This script helps you deploy Edge Functions to handle long-running AI requests

set -e  # Exit on error

echo "🚀 Supabase Edge Functions Deployment"
echo "======================================"
echo ""

# Check if Supabase CLI is installed
if ! command -v supabase &> /dev/null; then
    echo "❌ Supabase CLI not found!"
    echo ""
    echo "Please install Supabase CLI first:"
    echo ""
    echo "macOS/Linux:"
    echo "  brew install supabase/tap/supabase"
    echo ""
    echo "Windows:"
    echo "  scoop bucket add supabase https://github.com/supabase/scoop-bucket.git"
    echo "  scoop install supabase"
    echo ""
    echo "Or use NPX (no install needed):"
    echo "  Replace 'supabase' with 'npx supabase' in all commands"
    echo ""
    echo "See: https://github.com/supabase/cli#install-the-cli"
    echo ""
    exit 1
fi

# Check if logged in
echo "🔐 Checking Supabase authentication..."
if ! supabase projects list &> /dev/null; then
    echo "Please login to Supabase:"
    supabase login
fi
echo "✅ Authenticated"
echo ""

# Check if project is linked
if [ ! -f ".supabase/config.toml" ]; then
    echo "🔗 Linking to Supabase project..."
    echo ""
    echo "You'll need your project reference ID from:"
    echo "Supabase Dashboard → Settings → General → Reference ID"
    echo ""
    read -p "Enter your project reference ID: " PROJECT_REF
    supabase link --project-ref "$PROJECT_REF"
    echo "✅ Project linked"
    echo ""
else
    echo "✅ Project already linked"
    echo ""
fi

# Apply database schema
echo "📊 Database Schema"
echo "=================="
echo ""
echo "Before deploying Edge Functions, you need to apply the AI jobs schema."
echo ""
read -p "Have you applied supabase-ai-jobs-schema.sql to your database? (y/n) " -n 1 -r
echo ""
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo ""
    echo "Please apply the schema first:"
    echo "1. Go to Supabase Dashboard → SQL Editor"
    echo "2. Copy and paste contents of: supabase-ai-jobs-schema.sql"
    echo "3. Click 'Run'"
    echo ""
    echo "Then run this script again."
    exit 1
fi
echo ""

# Set environment variables
echo "🔑 Setting Environment Variables"
echo "================================"
echo ""
read -p "Do you want to set/update your OpenAI API key? (y/n) " -n 1 -r
echo ""
if [[ $REPLY =~ ^[Yy]$ ]]; then
    echo ""
    read -p "Enter your OpenAI API key: " OPENAI_KEY
    supabase secrets set OPENAI_API_KEY="$OPENAI_KEY"
    echo "✅ OpenAI API key set"
fi
echo ""

read -p "Do you want to set/update your Vercel app URL? (y/n) " -n 1 -r
echo ""
if [[ $REPLY =~ ^[Yy]$ ]]; then
    echo ""
    echo "Enter your Vercel app URL (e.g., https://your-app.vercel.app)"
    read -p "App URL: " APP_URL
    supabase secrets set APP_URL="$APP_URL"
    echo "✅ App URL set"
fi
echo ""

# Show current secrets
echo "Current secrets:"
supabase secrets list
echo ""

# Deploy functions
echo "🚀 Deploying Edge Functions"
echo "============================"
echo ""
echo "Deploying ai-chat-agentic..."
supabase functions deploy ai-chat-agentic
echo ""
echo "Deploying build-user-context..."
supabase functions deploy build-user-context
echo ""

echo "✅ Deployment Complete!"
echo ""
echo "📋 Next Steps:"
echo "=============="
echo ""
echo "1. Test your Edge Function:"
echo "   Visit: https://YOUR_PROJECT.supabase.co/functions/v1/ai-chat-agentic"
echo ""
echo "2. Monitor function logs:"
echo "   npm run supabase:logs"
echo ""
echo "3. Check function usage:"
echo "   Supabase Dashboard → Edge Functions"
echo ""
echo "4. Test in your app:"
echo "   - Enable Agentic Mode in AI Chat"
echo "   - Try: 'Move all tempo runs to Thursday'"
echo ""
echo "🎉 Your AI requests now have no timeout limits!"
echo ""
echo "📚 For more info, see: SUPABASE-EDGE-FUNCTIONS-SETUP.md"
echo ""

