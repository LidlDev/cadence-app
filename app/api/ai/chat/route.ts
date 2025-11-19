import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import OpenAI from 'openai'
import { buildUserContext, formatContextForAI } from '@/lib/ai/context-builder'

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
})

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

    // Build user context
    const context = await buildUserContext(supabase, user.id)
    const systemMessage = formatContextForAI(context)

    // Call OpenAI API
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: systemMessage,
        },
        ...messages,
      ],
      temperature: 0.7,
      max_tokens: 1000,
    })

    const assistantMessage = completion.choices[0].message.content

    // Extract and store any important information as memories
    await extractAndStoreMemories(supabase, user.id, messages[messages.length - 1].content, assistantMessage)

    return NextResponse.json({
      success: true,
      message: assistantMessage,
    })
  } catch (error) {
    console.error('Error in AI chat:', error)
    return NextResponse.json({ error: 'Failed to process chat' }, { status: 500 })
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

