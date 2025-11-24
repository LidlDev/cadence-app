# 🚀 Deployment Checklist - Supabase Edge Functions

Use this checklist to ensure everything is set up correctly for the AI timeout solution.

## ✅ Pre-Deployment

- [ ] **Supabase CLI installed**
  ```bash
  # macOS/Linux
  brew install supabase/tap/supabase

  # Or use NPX (no install needed)
  # Replace 'supabase' with 'npx supabase' in all commands
  ```
  See: https://github.com/supabase/cli#install-the-cli

- [ ] **Logged into Supabase**
  ```bash
  supabase login
  ```

- [ ] **Project linked**
  ```bash
  supabase link --project-ref YOUR_PROJECT_REF
  ```
  - Get project ref from: Supabase Dashboard → Settings → General → Reference ID

- [ ] **Database schema applied**
  - Go to Supabase Dashboard → SQL Editor
  - Run: `supabase-ai-jobs-schema.sql`
  - Verify table exists: `SELECT * FROM ai_jobs LIMIT 1;`

## 🔑 Environment Variables

- [ ] **OpenAI API Key set**
  ```bash
  supabase secrets set OPENAI_API_KEY=sk-...
  ```

- [ ] **Vercel App URL set**
  ```bash
  supabase secrets set APP_URL=https://your-app.vercel.app
  ```

- [ ] **Verify secrets**
  ```bash
  supabase secrets list
  ```
  Should show:
  - `OPENAI_API_KEY`
  - `APP_URL`

## 📦 Deployment

- [ ] **Deploy Edge Functions**
  ```bash
  npm run supabase:deploy
  ```
  Or individually:
  ```bash
  supabase functions deploy ai-chat-agentic
  supabase functions deploy build-user-context
  ```

- [ ] **Verify deployment**
  - Go to Supabase Dashboard → Edge Functions
  - Should see:
    - `ai-chat-agentic`
    - `build-user-context`

## 🧪 Testing

- [ ] **Test Edge Function locally (optional)**
  ```bash
  supabase functions serve
  ```
  Then in another terminal:
  ```bash
  curl -i --location --request POST \
    'http://localhost:54321/functions/v1/ai-chat-agentic' \
    --header 'Authorization: Bearer YOUR_ANON_KEY' \
    --header 'Content-Type: application/json' \
    --data '{"messages":[{"role":"user","content":"Hello"}],"enableTools":false}'
  ```

- [ ] **Test in production**
  1. Open your app
  2. Go to Dashboard → AI Chat
  3. Enable "Agentic Mode" toggle
  4. Send message: "Move all tempo runs to Thursday"
  5. Should see:
     - Processing indicator
     - Response within 15-30 seconds
     - "Training Plan Modified" badge
     - No timeout errors

- [ ] **Check logs**
  ```bash
  npm run supabase:logs
  ```
  Should see function execution logs

- [ ] **Verify job tracking**
  - Go to Supabase Dashboard → Table Editor → `ai_jobs`
  - Should see completed jobs with:
    - `status: 'completed'`
    - `execution_time_ms` populated
    - `response_data` with AI response

## 🔍 Verification

- [ ] **Frontend environment variables**
  - `.env.local` has:
    ```
    NEXT_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
    NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
    ```

- [ ] **Vercel deployment updated**
  - If you made frontend changes, redeploy to Vercel:
    ```bash
    vercel --prod
    ```

- [ ] **CORS working**
  - Edge Functions should accept requests from your app domain
  - Check `corsHeaders` in Edge Function code

## 📊 Monitoring

- [ ] **Set up monitoring**
  - Bookmark: Supabase Dashboard → Edge Functions
  - Check daily for:
    - Invocation count
    - Error rate
    - Execution time

- [ ] **Set up alerts (optional)**
  - Configure Supabase alerts for:
    - High error rate
    - Approaching usage limits

## 🎯 Success Criteria

Your deployment is successful when:

✅ Agentic AI requests complete without timeout  
✅ Processing indicator shows during long operations  
✅ Training plan modifications work correctly  
✅ Jobs are tracked in `ai_jobs` table  
✅ Logs show successful function executions  
✅ No CORS or authentication errors  
✅ Regular chat still works with streaming  

## 🐛 Common Issues

### "Function not found"
- Run: `npm run supabase:deploy`
- Check function name in code matches deployment

### "Unauthorized" errors
- Verify user is logged in
- Check `Authorization` header is passed
- Ensure RLS policies allow access

### "OpenAI API error"
- Verify secret: `supabase secrets list`
- Check OpenAI API key is valid
- Ensure you have credits

### Still timing out
- Check if it's the Edge Function or OpenAI API
- View logs: `npm run supabase:logs`
- Consider optimizing context building

### CORS errors
- Verify `corsHeaders` in Edge Function
- Check `Access-Control-Allow-Origin` is set correctly

## 📚 Resources

- [Setup Guide](./SUPABASE-EDGE-FUNCTIONS-SETUP.md)
- [Solution Summary](./AI-TIMEOUT-SOLUTION.md)
- [Function README](./supabase/functions/README.md)
- [Supabase Docs](https://supabase.com/docs/guides/functions)

## 🎉 Done!

Once all items are checked, your AI timeout solution is fully deployed and operational!

