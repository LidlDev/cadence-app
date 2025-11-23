import { NextRequest, NextResponse } from 'next/server'
import OpenAI from 'openai'
import { createClient } from '@/lib/supabase/server'
import { buildUserContext, formatContextForAI } from '@/lib/ai/context-builder'
import { trainingPlanTools } from '@/lib/ai/training-plan-tools'

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
})

/**
 * Agentic AI Chat with Function Calling
 * Allows AI to modify training plans based on user requests
 */
export async function POST(request: NextRequest) {
  try {
    const { messages, enableTools = false } = await request.json()

    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json({
        error: 'AI chat is not configured. Please add OPENAI_API_KEY to environment variables.'
      }, { status: 500 })
    }

    // Build user context
    const context = await buildUserContext(supabase, user.id)
    const systemMessage = formatContextForAI(context)

    // Enhanced system message for agentic capabilities
    const agenticSystemMessage = `${systemMessage}

## 🤖 AGENTIC CAPABILITIES

You have the ability to modify the user's training plan using function calls. When the user requests changes to their plan, you should:

1. **Understand the request** - Parse what they want to change
2. **Propose the changes** - Explain what you'll do
3. **Execute using functions** - Call the appropriate function
4. **Confirm completion** - Tell them what was changed

### Available Functions:

- **add_runs_to_plan**: Add new runs to the training plan
- **move_run_type_to_day**: Move all runs of a type to a different day
- **change_run_distances**: Change distances for specific runs
- **add_training_weeks**: Add weeks to the plan
- **change_run_type**: Convert runs from one type to another

### Example Requests You Can Handle:

- "Move all my tempo runs to Thursday"
- "Add a 4-week build block"
- "Change all easy runs to Monday"
- "Add hill repeats every other week"
- "Increase long run distance to 20km"
- "Add recovery runs on Fridays"

### Important:
- Always explain what you're about to do before calling functions
- Be specific about what will change
- Confirm the changes after execution
- Ask for clarification if the request is ambiguous`

    console.log('Calling OpenAI API with function calling enabled:', enableTools)

    // First API call - may include function calls
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: agenticSystemMessage,
        },
        ...messages,
      ],
      temperature: 0.7,
      max_tokens: 2500,
      tools: enableTools ? trainingPlanTools : undefined,
      tool_choice: enableTools ? 'auto' : undefined,
    })

    const responseMessage = completion.choices[0].message

    // Check if AI wants to call functions
    if (responseMessage.tool_calls && responseMessage.tool_calls.length > 0) {
      console.log('AI requested function calls:', responseMessage.tool_calls.length)

      // Execute all function calls
      const functionResults = await Promise.all(
        responseMessage.tool_calls.map(async (toolCall) => {
          const functionName = toolCall.function.name
          const functionArgs = JSON.parse(toolCall.function.arguments)

          console.log(`Executing function: ${functionName}`, functionArgs)

          // Map function names to API actions
          const actionMap: Record<string, string> = {
            add_runs_to_plan: 'add_runs',
            move_run_type_to_day: 'move_run_type',
            change_run_distances: 'change_distances',
            add_training_weeks: 'add_weeks',
            change_run_type: 'change_run_type',
          }

          const action = actionMap[functionName]

          // Call the training plan modification API
          const modifyResponse = await fetch(`${request.nextUrl.origin}/api/training-plan/modify`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Cookie': request.headers.get('cookie') || '',
            },
            body: JSON.stringify({
              action,
              params: functionArgs,
            }),
          })

          const result = await modifyResponse.json()

          return {
            tool_call_id: toolCall.id,
            role: 'tool' as const,
            name: functionName,
            content: JSON.stringify(result),
          }
        })
      )

      // Second API call with function results
      const secondCompletion = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: agenticSystemMessage,
          },
          ...messages,
          responseMessage,
          ...functionResults,
        ],
        temperature: 0.7,
        max_tokens: 2500,
      })

      return NextResponse.json({
        message: secondCompletion.choices[0].message.content,
        function_calls: responseMessage.tool_calls.map((tc) => tc.function.name),
        modifications_made: true,
      })
    }

    // No function calls - return normal response
    return NextResponse.json({
      message: responseMessage.content,
      modifications_made: false,
    })
  } catch (error: any) {
    console.error('Error in agentic AI chat:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

