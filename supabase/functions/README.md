# Supabase Edge Functions

This directory contains Supabase Edge Functions for handling long-running operations without timeout constraints.

## 📁 Structure

```
functions/
├── _shared/                    # Shared utilities and types
│   └── training-plan-tools.ts  # AI function calling tool definitions
├── ai-chat-agentic/           # Agentic AI chat (no timeout)
│   └── index.ts
└── build-user-context/        # Helper to build AI context
    └── index.ts
```

## 🚀 Functions

### `ai-chat-agentic`
**Purpose**: Handle agentic AI requests that can modify training plans  
**Timeout**: Up to 150 seconds (vs 10s on Vercel)  
**Features**:
- Function calling for training plan modifications
- Job tracking in database
- Full user context integration
- Error handling and retry logic

**Endpoint**: `https://YOUR_PROJECT.supabase.co/functions/v1/ai-chat-agentic`

**Request**:
```json
{
  "messages": [
    {"role": "user", "content": "Move all tempo runs to Thursday"}
  ],
  "enableTools": true
}
```

**Response**:
```json
{
  "jobId": "uuid",
  "message": "I've moved all tempo runs to Thursday...",
  "modifications_made": true,
  "function_calls": ["move_run_type_to_day"],
  "execution_time_ms": 12500
}
```

### `build-user-context`
**Purpose**: Build personalized AI context from user data  
**Used by**: Other Edge Functions  
**Features**:
- Fetches user profile, runs, training plan
- Retrieves AI memories
- Formats context for AI system message

## 🛠️ Development

### Local Testing
```bash
# Start Supabase locally
supabase start

# Serve functions
supabase functions serve

# Test in another terminal
curl -i --location --request POST \
  'http://localhost:54321/functions/v1/ai-chat-agentic' \
  --header 'Authorization: Bearer YOUR_ANON_KEY' \
  --header 'Content-Type: application/json' \
  --data '{"messages":[{"role":"user","content":"Hello"}]}'
```

### Deployment
```bash
# Deploy single function
supabase functions deploy ai-chat-agentic

# Deploy all functions
supabase functions deploy

# Set secrets
supabase secrets set OPENAI_API_KEY=sk-...
```

### Logs
```bash
# View logs
supabase functions logs ai-chat-agentic

# Follow logs in real-time
supabase functions logs ai-chat-agentic --follow
```

## 🔐 Environment Variables

Set via Supabase secrets:

```bash
supabase secrets set OPENAI_API_KEY=sk-...
```

Auto-available in functions:
- `SUPABASE_URL` - Your Supabase project URL
- `SUPABASE_ANON_KEY` - Public anon key
- `SUPABASE_SERVICE_ROLE_KEY` - Service role key (use carefully!)

## 📊 Monitoring

Track function performance:
1. Supabase Dashboard → Edge Functions
2. View invocations, errors, execution time
3. Check `ai_jobs` table for detailed job history

## 🔄 Architecture

```
User Request (Agentic Mode)
    ↓
Frontend (AIChat.tsx)
    ↓
Supabase Edge Function (ai-chat-agentic)
    ↓
├─→ build-user-context (get user data)
├─→ OpenAI API (get AI response)
├─→ Training Plan API (execute modifications)
└─→ OpenAI API (confirm changes)
    ↓
Response to Frontend
```

## 🆚 Vercel vs Supabase

| Feature | Vercel Functions | Supabase Edge Functions |
|---------|-----------------|------------------------|
| Timeout | 10s (free tier) | 150s max |
| Invocations | 100K/month | 500K/month |
| Execution time | Limited | 2M seconds/month |
| Streaming | ✅ Yes | ✅ Yes |
| Best for | Quick responses | Long operations |

**Our Strategy**:
- Regular chat → Vercel (streaming, fast)
- Agentic AI → Supabase (no timeout)

## 🐛 Debugging

Common issues:

1. **CORS errors**: Check `corsHeaders` in function
2. **Auth errors**: Verify Authorization header is passed
3. **Timeout**: Even Edge Functions have 150s limit
4. **OpenAI errors**: Check API key and credits

View detailed logs:
```bash
supabase functions logs ai-chat-agentic --follow
```

## 📚 Resources

- [Supabase Edge Functions Docs](https://supabase.com/docs/guides/functions)
- [Deno Manual](https://deno.land/manual)
- [OpenAI API Docs](https://platform.openai.com/docs)

