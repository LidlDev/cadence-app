import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.4'
import { allReadTools } from '../_shared/training-plan-tools.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface Message {
  role: 'user' | 'assistant' | 'system'
  content: string
  tool_calls?: any[]
  function_call?: any
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Get authorization header
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Missing authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Create Supabase client with user's auth token
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!

    // Extract JWT token from Authorization header
    const jwt = authHeader.replace('Bearer ', '')

    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: {
        headers: { Authorization: authHeader },
      },
      auth: {
        persistSession: false,
      },
    })

    // Verify user
    const { data: { user }, error: userError } = await supabase.auth.getUser(jwt)
    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized', details: userError?.message }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Parse request body
    const { messages, conversationId, conversationTitle, stream: shouldStream = true } = await req.json()

    // Get OpenAI API key
    const openaiApiKey = Deno.env.get('OPENAI_API_KEY')
    if (!openaiApiKey) {
      return new Response(
        JSON.stringify({ error: 'AI service not configured' }),
        { status: 503, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Build system message with user context
    const contextResponse = await fetch(`${supabaseUrl}/functions/v1/build-user-context`, {
      method: 'POST',
      headers: {
        'Authorization': authHeader,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ userId: user.id }),
    })

    let systemMessage = 'You are an enthusiastic, knowledgeable, and motivating running coach! 🏃‍♂️'
    if (contextResponse.ok) {
      const contextData = await contextResponse.json()
      systemMessage = contextData.systemMessage || systemMessage
      console.log('User context loaded successfully')
    } else {
      console.error('Failed to load user context:', contextResponse.status)
    }

    console.log(`Calling OpenAI API with streaming=${shouldStream}`)

    // Initial request - check for tool calls (non-streaming first to handle decisions)
    // We use allReadTools to give it read access
    const tools = allReadTools;

    const initialResponse = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openaiApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: systemMessage },
          ...messages,
        ],
        temperature: 0.8,
        max_tokens: 1000,
        tools: tools,
        tool_choice: 'auto',
        stream: false,
      }),
    })

    if (!initialResponse.ok) {
      const error = await initialResponse.text()
      throw new Error(`OpenAI API error: ${initialResponse.statusText} - ${error}`)
    }

    const initialData = await initialResponse.json()
    const initialMessage = initialData.choices[0].message

    let finalMessages = [...messages]

    // Check if tools were called
    if (initialMessage.tool_calls && initialMessage.tool_calls.length > 0) {
      console.log(`AI called ${initialMessage.tool_calls.length} tools`)

      // Append assistant message with tool calls
      finalMessages.push(initialMessage)

      const toolResults = []

      for (const toolCall of initialMessage.tool_calls) {
        const functionName = toolCall.function.name
        const args = JSON.parse(toolCall.function.arguments)

        console.log(`Executing ${functionName} with args:`, args)

        let result = {}
        try {
          if (functionName === 'get_running_metrics') {
            result = await getRunningMetrics(supabase, user.id, args)
          } else if (functionName === 'get_strength_pbs') {
            result = await getStrengthPBs(supabase, user.id, args)
          } else if (functionName === 'get_recent_activities') {
            result = await getRecentActivities(supabase, user.id, args)
          } else if (functionName === 'get_nutrition_logs') {
            result = await getNutritionLogs(supabase, user.id, args)
          } else {
            result = { error: 'Unknown function' }
          }
        } catch (e: any) {
          console.error(`Error executing ${functionName}:`, e)
          result = { error: e.message }
        }

        toolResults.push({
          role: 'tool',
          tool_call_id: toolCall.tool_call_id || toolCall.id,
          name: functionName,
          content: JSON.stringify(result)
        })
      }

      finalMessages.push(...toolResults)
    } else {
      // If no tools called, we already have the content, but to support streaming consistency
      // we might want to just return this, OR if streaming was requested, we might need to "fake" stream
      // or just do a second call if we want to be lazy (but expensive).
      // Better: if no tools, just return the content we got.
      // But if existing client expects stream, we should stream. 
      // ACTUALLY: The client might break if we return JSON when it expects stream.
      // So if no tools + stream=true, we should probably have just streamed from the start.
      // Compromise: If no tools, we send the content we got but wrapped in a stream format 
      // or we just make a second call to stream it (safest implementation, slightly more tokens/time).
      // Given gpt-4o-mini is cheap and fast, re-streaming the response is acceptable ensuring consistent UX.
      // Wait, we can't re-stream the SAME response easily without just sending it.
      // Let's just use the messages array we have (which hasn't changed) and call OpenAI again with stream=true.
      // This is a bit wasteful but ensures the client gets the `text/event-stream` it expects.
      console.log('No tools called, proceeding to stream response')
    }

    // Final response (streaming or not)
    const finalResponse = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openaiApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: systemMessage },
          ...finalMessages
        ],
        temperature: 0.8,
        max_tokens: 4000,
        stream: shouldStream,
      }),
    })

    if (!finalResponse.ok) {
      throw new Error(`OpenAI API error: ${finalResponse.statusText}`)
    }

    if (!shouldStream) {
      const data = await finalResponse.json()
      const content = data.choices[0]?.message?.content || ''

      await saveInteraction(supabase, user.id, conversationId, conversationTitle, messages, content)

      return new Response(
        JSON.stringify({ message: content }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Streaming handler
    const stream = new ReadableStream({
      async start(controller) {
        const encoder = new TextEncoder()
        const decoder = new TextDecoder()
        let fullMessage = ''

        try {
          const reader = finalResponse.body?.getReader()
          if (!reader) throw new Error('No response body')

          while (true) {
            const { done, value } = await reader.read()
            if (done) break

            const chunk = decoder.decode(value)
            const lines = chunk.split('\n').filter(line => line.trim() !== '')

            for (const line of lines) {
              if (line.startsWith('data: ')) {
                const data = line.slice(6)
                if (data === '[DONE]') {
                  controller.enqueue(encoder.encode('data: [DONE]\n\n'))
                  break
                }

                try {
                  const parsed = JSON.parse(data)
                  const content = parsed.choices[0]?.delta?.content || ''
                  if (content) {
                    fullMessage += content
                    controller.enqueue(encoder.encode(`data: ${JSON.stringify({ content })}\n\n`))
                  }
                } catch (e) {
                  // Skip invalid JSON
                }
              }
            }
          }

          if (fullMessage) {
            await saveInteraction(supabase, user.id, conversationId, conversationTitle, messages, fullMessage)
          }

          controller.close()
        } catch (error) {
          console.error('Streaming error:', error)
          controller.error(error)
        }
      },
    })

    return new Response(stream, {
      headers: {
        ...corsHeaders,
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    })

  } catch (error: any) {
    console.error('Error in AI chat:', error)
    return new Response(
      JSON.stringify({ error: error.message || 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})

// --- Helper Functions ---

async function saveInteraction(supabase: any, userId: string, conversationId: string | null, title: string | undefined, messages: any[], responseContent: string) {
  if (!messages.length) return;

  const userMessage = messages[messages.length - 1].content;

  // Store conversation and messages
  storeConversation(supabase, userId, conversationId, title || 'New Chat', userMessage, responseContent)
    .catch(err => console.error('Error storing conversation:', err))

  // Store memories
  extractAndStoreMemories(supabase, userId, userMessage, responseContent)
    .catch(err => console.error('Error storing memories:', err))
}

async function getRunningMetrics(supabase: any, userId: string, args: any) {
  const { start_date, end_date, metric_type } = args

  const { data: runs, error } = await supabase
    .from('runs')
    .select('actual_distance, duration, average_heart_rate, calories, actual_pace, scheduled_date')
    .eq('user_id', userId)
    .gte('scheduled_date', start_date)
    .lte('scheduled_date', end_date)
    .eq('completed', true)

  if (error) throw error

  // Calculate aggregations
  const totalDistance = runs.reduce((acc: number, r: any) => acc + (r.actual_distance || 0), 0)
  const count = runs.length
  const totalDuration = runs.reduce((acc: number, r: any) => acc + (r.duration || 0), 0) // minutes

  return {
    period: { start: start_date, end: end_date },
    metrics: {
      total_distance_km: parseFloat(totalDistance.toFixed(2)),
      run_count: count,
      total_duration_min: totalDuration,
      avg_distance: count ? parseFloat((totalDistance / count).toFixed(2)) : 0,
      details: metric_type === 'distance' ? runs.map((r: any) => ({ date: r.scheduled_date, distance: r.actual_distance })) : undefined
    }
  }
}

async function getStrengthPBs(supabase: any, userId: string, args: any) {
  let query = supabase.from('strength_pbs').select('*').eq('user_id', userId).order('weight', { ascending: false })

  if (args.exercise_names && args.exercise_names.length > 0) {
    query = query.in('exercise_name', args.exercise_names)
  } else {
    query = query.limit(5)
  }

  const { data, error } = await query
  if (error) throw error
  return data
}

async function getRecentActivities(supabase: any, userId: string, args: any) {
  const limit = Math.min(args.limit || 5, 10)
  const activities = []

  if (args.activity_type !== 'strength') {
    const { data: runs } = await supabase
      .from('runs')
      .select('id, scheduled_date, run_type, actual_distance, duration, average_heart_rate, actual_pace')
      .eq('user_id', userId)
      .eq('completed', true)
      .order('scheduled_date', { ascending: false })
      .limit(limit)

    if (runs) activities.push(...runs.map((r: any) => ({ ...r, type: 'run' })))
  }

  if (args.activity_type !== 'run') {
    const { data: sessions } = await supabase
      .from('strength_sessions')
      .select('id, scheduled_date, session_type, actual_duration, rpe, session_name')
      .eq('user_id', userId)
      .eq('completed', true)
      .order('scheduled_date', { ascending: false })
      .limit(limit)

    if (sessions) activities.push(...sessions.map((s: any) => ({ ...s, type: 'strength' })))
  }

  // Sort combined results
  return activities
    .sort((a, b) => new Date(b.scheduled_date).getTime() - new Date(a.scheduled_date).getTime())
    .slice(0, limit)
}

async function getNutritionLogs(supabase: any, userId: string, args: any) {
  const { start_date, end_date } = args

  const { data: meals } = await supabase
    .from('meal_logs')
    .select('*')
    .eq('user_id', userId)
    .gte('log_date', start_date)
    .lte('log_date', end_date)
    .order('log_date', { ascending: false })

  return {
    logs: meals,
    count: meals?.length || 0,
    summary: {
      total_calories: meals?.reduce((acc: number, m: any) => acc + (m.total_calories || 0), 0)
    }
  }
}

/**
 * Stores conversation and messages in the database
 */
async function storeConversation(
  supabase: any,
  userId: string,
  conversationId: string | null,
  conversationTitle: string,
  userMessage: string,
  assistantMessage: string
) {
  try {
    let convId = conversationId

    // Create or get conversation
    if (!convId) {
      // Generate title from first user message (first 50 chars)
      const title = conversationTitle || userMessage.substring(0, 50) + (userMessage.length > 50 ? '...' : '')

      const { data: newConv, error: convError } = await supabase
        .from('chat_conversations')
        .insert({
          user_id: userId,
          title: title,
          mode: 'chat',
        })
        .select()
        .single()

      if (convError) {
        console.error('Error creating conversation:', convError)
        return
      }

      convId = newConv.id
    }

    // Store user message
    await supabase.from('chat_messages').insert({
      conversation_id: convId,
      role: 'user',
      content: userMessage,
    })

    // Store assistant message
    await supabase.from('chat_messages').insert({
      conversation_id: convId,
      role: 'assistant',
      content: assistantMessage,
    })

    console.log('Conversation and messages stored successfully')
    return convId
  } catch (error) {
    console.error('Error in storeConversation:', error)
  }
}

/**
 * Extracts important information from conversation and stores as memories
 */
async function extractAndStoreMemories(
  supabase: any,
  userId: string,
  userMessage: string,
  assistantMessage: string | null
) {
  // Simple keyword-based memory extraction
  const keywords = {
    goal: ['goal', 'target', 'aiming for', 'want to'],
    injury: ['injury', 'injured', 'pain', 'hurt', 'sore'],
    preference: ['prefer', 'like', 'enjoy', 'favorite'],
    race: ['race', 'event', 'competition', 'marathon', 'half marathon'],
  }

  const lowerMessage = userMessage.toLowerCase()

  for (const [memory_type, terms] of Object.entries(keywords)) {
    if (terms.some((term) => lowerMessage.includes(term))) {
      // Check if similar memory already exists
      const { data: existing } = await supabase
        .from('ai_memories')
        .select('*')
        .eq('user_id', userId)
        .eq('memory_type', memory_type)
        .ilike('content', `%${userMessage.substring(0, 50)}%`)
        .single()

      if (!existing) {
        // Store new memory
        await supabase.from('ai_memories').insert({
          user_id: userId,
          memory_type,
          content: userMessage,
          importance: memory_type === 'injury' || memory_type === 'goal' ? 10 : 5,
          last_accessed_at: new Date().toISOString(),
        })
      } else {
        // Update last accessed
        await supabase
          .from('ai_memories')
          .update({
            last_accessed_at: new Date().toISOString(),
            access_count: (existing.access_count || 0) + 1
          })
          .eq('id', existing.id)
      }
    }
  }
}


