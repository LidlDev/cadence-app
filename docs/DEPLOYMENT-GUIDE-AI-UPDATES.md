# Deployment Guide - AI Updates

## Quick Start

Follow these steps to deploy the AI improvements to production.

## Step 1: Deploy Supabase Edge Functions

### Prerequisites
- Supabase CLI installed (`npm install -g supabase`)
- Logged in to Supabase (`supabase login`)
- Linked to your project (`supabase link --project-ref YOUR_PROJECT_REF`)

### Deploy Commands

```bash
cd cadence-app

# Deploy the new AI chat function with streaming
supabase functions deploy ai-chat

# Deploy the enhanced AI insights function
supabase functions deploy ai-run-insights

# Ensure supporting functions are deployed
supabase functions deploy build-user-context
supabase functions deploy ai-chat-agentic
```

### Verify Deployment

```bash
# List all deployed functions
supabase functions list

# Check function logs
supabase functions logs ai-chat
supabase functions logs ai-run-insights
```

## Step 2: Set Environment Variables

Make sure these environment variables are set in your Supabase project:

```bash
# Set OpenAI API key (required for all AI functions)
supabase secrets set OPENAI_API_KEY=your_openai_api_key_here

# Verify secrets are set
supabase secrets list
```

The following are automatically provided by Supabase:
- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`

## Step 3: Deploy Frontend Changes

The frontend changes are in:
- `components/dashboard/AIChat.tsx`

Deploy to Vercel:

```bash
# Commit changes
git add .
git commit -m "feat: move AI chat to Edge Function and enhance insights with granular data"

# Push to trigger Vercel deployment
git push origin main
```

Or manually deploy:

```bash
vercel --prod
```

## Step 4: Test the Changes

### Test AI Chat
1. Go to Dashboard
2. Open AI Chat
3. Send a long message and verify streaming works
4. Have a multi-turn conversation to test timeout handling

### Test AI Insights

#### Test with Easy Run
1. View a completed easy run
2. Click to view details
3. Verify AI insights praise restraint and low HR zones

#### Test with Interval/Fartlek Run
1. View a completed interval or fartlek run
2. Click to view details
3. Verify AI insights:
   - Detect and analyze individual intervals
   - Don't judge negatively based on average pace
   - Analyze pacing strategy
   - Show HR zone distribution

#### Test with Long Run
1. View a completed long run
2. Click to view details
3. Verify AI insights analyze endurance and pacing strategy

## Step 5: Monitor Performance

### Check Edge Function Logs

```bash
# Monitor AI chat function
supabase functions logs ai-chat --follow

# Monitor AI insights function
supabase functions logs ai-run-insights --follow
```

### Check for Errors

Look for:
- Authentication errors (check JWT tokens)
- OpenAI API errors (check API key and quota)
- Database errors (check RLS policies)
- Timeout errors (should be eliminated)

## Rollback Plan

If issues occur, you can quickly rollback:

### Rollback Frontend
```bash
# Revert the commit
git revert HEAD

# Push to trigger new deployment
git push origin main
```

### Rollback Edge Functions
The old Vercel API routes are still in place as fallback:
- `/api/ai/chat` - Old chat endpoint
- `/api/runs/[runId]/insights` - Old insights endpoint

To use them, revert the frontend changes in `AIChat.tsx`:

```typescript
// Change this:
const response = await fetch(`${supabaseUrl}/functions/v1/ai-chat`, {

// Back to this:
const response = await fetch('/api/ai/chat', {
```

## Troubleshooting

### AI Chat Not Streaming
- Check browser console for errors
- Verify `NEXT_PUBLIC_SUPABASE_URL` is set in Vercel
- Check Edge Function logs for errors
- Verify user is authenticated

### AI Insights Not Loading
- Check if `ai-run-insights` function is deployed
- Verify OpenAI API key is set
- Check if activity streams exist for the run
- Look for errors in Edge Function logs

### "Unauthorized" Errors
- Verify user session is valid
- Check RLS policies on `runs`, `activity_streams`, `activity_heart_rate_zones` tables
- Ensure JWT token is being passed correctly

### OpenAI API Errors
- Check API key is valid: `supabase secrets list`
- Verify you have quota remaining
- Check for rate limiting (429 errors)

## Performance Expectations

### AI Chat
- **First response**: 1-3 seconds
- **Streaming**: Real-time token-by-token
- **No timeouts**: Can handle conversations of any length

### AI Insights
- **With cached insights**: < 100ms
- **First generation**: 3-8 seconds (depending on data volume)
- **With granular data**: 5-10 seconds (more analysis)

## Success Criteria

✅ AI chat streams responses without timeout
✅ AI insights correctly analyze interval/fartlek runs
✅ Granular data (pace, HR, cadence) is included in analysis
✅ HR zone distribution is shown
✅ Interval detection works for quality runs
✅ Pacing strategy analysis is accurate
✅ No increase in error rates
✅ User feedback is positive

## Next Steps

After successful deployment:
1. Monitor user feedback on AI insights quality
2. Collect examples of well-analyzed runs
3. Consider adding more granular metrics (power, grade, temperature)
4. Explore AI-powered training plan adjustments based on performance trends

