# 🚀 Supabase Edge Functions Setup Guide

This guide will help you deploy Supabase Edge Functions for handling long-running AI requests without timeout constraints.

## 🎯 Why Edge Functions?

**Problem**: Vercel Functions have a 10-second timeout on the free tier, but agentic AI requests can take 15-30+ seconds.

**Solution**: Supabase Edge Functions have no practical timeout limits (up to 150 seconds) and are free tier friendly:
- ✅ 500K invocations/month
- ✅ 2M execution seconds/month
- ✅ No timeout constraints
- ✅ Built on Deno (modern, secure)

## 📋 Prerequisites

1. **Supabase CLI** - Install using Homebrew (recommended for macOS):
   ```bash
   brew install supabase/tap/supabase
   ```

   Or using other methods:
   - **macOS/Linux**: `brew install supabase/tap/supabase`
   - **Windows**: `scoop bucket add supabase https://github.com/supabase/scoop-bucket.git && scoop install supabase`
   - **NPX** (no install): Use `npx supabase` instead of `supabase` in all commands

   See all options: https://github.com/supabase/cli#install-the-cli

2. **Supabase Project** - You should already have one set up

3. **OpenAI API Key** - For AI functionality

## 🔧 Step 1: Apply Database Schema

First, add the AI jobs tracking table to your Supabase database:

```bash
# Go to Supabase SQL Editor
# Run the contents of: supabase-ai-jobs-schema.sql
```

Or via CLI:
```bash
psql -h YOUR_SUPABASE_DB_HOST -U postgres -d postgres -f supabase-ai-jobs-schema.sql
```

## 🔑 Step 2: Link Your Supabase Project

```bash
cd cadence-app

# Login to Supabase
supabase login

# Link to your project
supabase link --project-ref YOUR_PROJECT_REF
```

**Find your project ref**:
- Go to Supabase Dashboard → Settings → General
- Copy the "Reference ID"

## 🌐 Step 3: Set Environment Variables

Set secrets for your Edge Functions:

```bash
# Set OpenAI API Key
supabase secrets set OPENAI_API_KEY=your_openai_api_key_here

# Set your Vercel app URL (for API calls)
supabase secrets set APP_URL=https://your-app.vercel.app

# Verify secrets
supabase secrets list
```

**Note**: The `APP_URL` is needed so Edge Functions can call your Vercel-hosted training plan modification API.

## 🚀 Step 4: Deploy Edge Functions

Deploy all Edge Functions at once:

```bash
# Deploy all functions
supabase functions deploy ai-chat-agentic
supabase functions deploy build-user-context

# Or deploy all at once
supabase functions deploy
```

## ✅ Step 5: Verify Deployment

Test your Edge Functions:

```bash
# Test the agentic AI function
curl -i --location --request POST \
  'https://YOUR_PROJECT_REF.supabase.co/functions/v1/ai-chat-agentic' \
  --header 'Authorization: Bearer YOUR_ANON_KEY' \
  --header 'Content-Type: application/json' \
  --data '{"messages":[{"role":"user","content":"Hello"}],"enableTools":false}'
```

## 🔄 Step 6: Update Frontend Environment Variables

Make sure your `.env.local` has:

```bash
NEXT_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key_here
```

## 🧪 Step 7: Test Locally (Optional)

You can test Edge Functions locally before deploying:

```bash
# Start Supabase locally
supabase start

# Serve functions locally
supabase functions serve

# In another terminal, test the function
curl -i --location --request POST \
  'http://localhost:54321/functions/v1/ai-chat-agentic' \
  --header 'Authorization: Bearer YOUR_ANON_KEY' \
  --header 'Content-Type: application/json' \
  --data '{"messages":[{"role":"user","content":"Hello"}],"enableTools":false}'
```

## 📊 Step 8: Monitor Usage

Monitor your Edge Functions usage:

1. Go to Supabase Dashboard → Edge Functions
2. View invocations, execution time, and errors
3. Check logs for debugging

## 🔍 Troubleshooting

### Function not found
- Make sure you deployed: `supabase functions deploy`
- Check function name matches in code

### Authorization errors
- Verify `NEXT_PUBLIC_SUPABASE_URL` is correct
- Check that user is authenticated
- Ensure RLS policies are set up correctly

### OpenAI errors
- Verify secret is set: `supabase secrets list`
- Check OpenAI API key is valid
- Ensure you have credits in OpenAI account

### Timeout still occurring
- Edge Functions have 150s max timeout
- Check if OpenAI API itself is slow
- Consider breaking up very long operations

## 🎉 Success!

Your agentic AI requests now run on Supabase Edge Functions with no timeout constraints!

**What happens now:**
- Regular chat (advice mode) → Vercel API (streaming, fast)
- Agentic mode (plan modifications) → Supabase Edge Function (no timeout)
- All requests tracked in `ai_jobs` table for debugging

## 📚 Next Steps

1. **Monitor performance** in Supabase Dashboard
2. **Add more Edge Functions** for other long-running tasks
3. **Implement job polling** for very long operations (optional)
4. **Set up alerts** for failed jobs

## 🔗 Useful Links

- [Supabase Edge Functions Docs](https://supabase.com/docs/guides/functions)
- [Deno Documentation](https://deno.land/manual)
- [OpenAI API Reference](https://platform.openai.com/docs/api-reference)

