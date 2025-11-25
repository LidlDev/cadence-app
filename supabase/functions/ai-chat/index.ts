// Supabase Edge Function for AI Chat with Streaming
// Handles long-running AI chat requests without timeout constraints

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.4'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface Message {
  role: 'user' | 'assistant' | 'system'
  content: string
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
    const { messages, conversationId, conversationTitle } = await req.json()

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

    console.log('Calling OpenAI API with streaming')

    // Call OpenAI API with streaming
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
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
        max_tokens: 4000,
        stream: true,
      }),
    })

    if (!response.ok) {
      throw new Error(`OpenAI API error: ${response.statusText}`)
    }

    // Create a streaming response
    const stream = new ReadableStream({
      async start(controller) {
        const encoder = new TextEncoder()
        const decoder = new TextDecoder()
        let fullMessage = ''

        try {
          const reader = response.body?.getReader()
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

          // Store conversation and messages after streaming completes (non-blocking)
          if (fullMessage && messages.length > 0) {
            const userMessage = messages[messages.length - 1].content

            // Store conversation and messages
            storeConversation(supabase, user.id, conversationId, conversationTitle || 'New Chat', userMessage, fullMessage)
              .catch(err => console.error('Error storing conversation:', err))

            // Store memories
            extractAndStoreMemories(supabase, user.id, userMessage, fullMessage)
              .catch(err => console.error('Error storing memories:', err))
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

