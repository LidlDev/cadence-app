import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import OpenAI from 'openai'
import { buildUserContext, formatContextForAI } from '@/lib/ai/context-builder'

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
})

/**
 * Retry with exponential backoff
 */
async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  maxRetries: number = 3,
  baseDelay: number = 1000
): Promise<T> {
  let lastError: any

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await fn()
    } catch (error: any) {
      lastError = error

      // Don't retry on certain errors
      if (error?.status === 401 || error?.status === 403 || error?.code === 'insufficient_quota') {
        throw error
      }

      // If this was the last attempt, throw
      if (attempt === maxRetries - 1) {
        throw error
      }

      // Calculate delay with exponential backoff
      const delay = baseDelay * Math.pow(2, attempt)
      console.log(`Retry attempt ${attempt + 1}/${maxRetries} after ${delay}ms`)
      await new Promise(resolve => setTimeout(resolve, delay))
    }
  }

  throw lastError
}

export async function POST(request: NextRequest) {
  try {
    const { messages } = await request.json()

    const supabase = await createClient()

    // Get current user
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check if API key is configured
    if (!process.env.OPENAI_API_KEY) {
      console.error('OpenAI API key not configured')
      return NextResponse.json({
        error: 'AI chat is not configured. Please add OPENAI_API_KEY to environment variables.'
      }, { status: 500 })
    }

    // Build user context with retry
    const context = await retryWithBackoff(
      () => buildUserContext(supabase, user.id),
      2,
      500
    )
    const systemMessage = formatContextForAI(context)

    console.log('Calling OpenAI API with model: gpt-4o-mini (streaming)')

    // Call OpenAI API with streaming and retry logic
    const stream = await retryWithBackoff(
      () => openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: systemMessage,
          },
          ...messages,
        ],
        temperature: 0.8,
        max_tokens: 4000,
        stream: true,
      }),
      3,
      1000
    )

    // Create a readable stream for the response
    const encoder = new TextEncoder()
    let fullMessage = ''

    const readableStream = new ReadableStream({
      async start(controller) {
        try {
          for await (const chunk of stream) {
            const content = chunk.choices[0]?.delta?.content || ''
            if (content) {
              fullMessage += content
              controller.enqueue(encoder.encode(`data: ${JSON.stringify({ content })}\n\n`))
            }
          }

          // Send done signal
          controller.enqueue(encoder.encode('data: [DONE]\n\n'))
          controller.close()

          // Store memories after streaming completes (non-blocking)
          extractAndStoreMemories(supabase, user.id, messages[messages.length - 1].content, fullMessage)
            .catch(err => console.error('Error storing memories:', err))
        } catch (error) {
          console.error('Streaming error:', error)
          controller.error(error)
        }
      },
    })

    return new Response(readableStream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    })
  } catch (error: any) {
    console.error('Error in AI chat:', error)
    console.error('Error details:', {
      message: error?.message,
      status: error?.status,
      type: error?.type,
      code: error?.code,
    })

    // Categorize error type
    const errorType = categorizeError(error)

    // For network/timeout errors, provide fallback response
    if (errorType === 'network' || errorType === 'timeout') {
      return provideFallbackResponse(request)
    }

    // Provide more specific error messages
    let errorMessage = 'Failed to process chat'
    if (error?.status === 401) {
      errorMessage = 'Invalid OpenAI API key. Please check your configuration.'
    } else if (error?.status === 429) {
      errorMessage = 'OpenAI API rate limit exceeded. Please try again in a few moments.'
    } else if (error?.code === 'insufficient_quota') {
      errorMessage = 'OpenAI API quota exceeded. Please check your billing.'
    } else if (error?.status === 503) {
      errorMessage = 'OpenAI service is temporarily unavailable. Please try again shortly.'
    } else if (error?.message) {
      errorMessage = `AI Error: ${error.message}`
    }

    return NextResponse.json({
      error: errorMessage,
      type: errorType,
      retryable: errorType === 'rate_limit' || errorType === 'network' || errorType === 'timeout'
    }, { status: 500 })
  }
}

/**
 * Categorize error for better handling
 */
function categorizeError(error: any): string {
  if (error?.status === 429) return 'rate_limit'
  if (error?.status === 401 || error?.status === 403) return 'auth'
  if (error?.status === 503 || error?.status === 504) return 'service_unavailable'
  if (error?.code === 'ECONNREFUSED' || error?.code === 'ETIMEDOUT') return 'network'
  if (error?.code === 'insufficient_quota') return 'quota'
  if (error?.message?.includes('timeout')) return 'timeout'
  return 'unknown'
}

/**
 * Provide fallback response when OpenAI is unavailable
 */
async function provideFallbackResponse(request: NextRequest): Promise<Response> {
  const fallbackMessage = `I apologize, but I'm having trouble connecting to my AI service right now.

However, I can still help you with some general running advice:

**General Training Tips:**
- Listen to your body and prioritize recovery
- Follow the 80/20 rule: 80% easy runs, 20% hard workouts
- Increase weekly mileage by no more than 10% per week
- Include at least one rest day per week
- Stay consistent with your training

**For specific questions:**
- Check your training plan for upcoming workouts
- Review your recent runs and performance trends
- Monitor your RPE (Rate of Perceived Exertion) to gauge intensity

Please try again in a few moments, and I'll be able to provide more personalized advice based on your training data.`

  const encoder = new TextEncoder()
  const readableStream = new ReadableStream({
    start(controller) {
      controller.enqueue(encoder.encode(`data: ${JSON.stringify({ content: fallbackMessage })}\n\n`))
      controller.enqueue(encoder.encode('data: [DONE]\n\n'))
      controller.close()
    },
  })

  return new Response(readableStream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  })
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

  for (const [category, terms] of Object.entries(keywords)) {
    if (terms.some((term) => lowerMessage.includes(term))) {
      // Check if similar memory already exists
      const { data: existing } = await supabase
        .from('ai_memories')
        .select('*')
        .eq('user_id', userId)
        .eq('category', category)
        .ilike('content', `%${userMessage.substring(0, 50)}%`)
        .single()

      if (!existing) {
        // Store new memory
        await supabase.from('ai_memories').insert({
          user_id: userId,
          category,
          content: userMessage,
          importance: category === 'injury' || category === 'goal' ? 10 : 5,
          last_accessed: new Date().toISOString(),
        })
      } else {
        // Update last accessed
        await supabase
          .from('ai_memories')
          .update({ last_accessed: new Date().toISOString() })
          .eq('id', existing.id)
      }
    }
  }
}

