// Supabase Edge Function for Agentic AI Chat
// Handles long-running AI requests without timeout constraints

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.4'
import { trainingPlanTools } from '../_shared/training-plan-tools.ts'

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
    // In Edge Functions, use the built-in environment variables
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: {
        headers: { Authorization: authHeader },
      },
      auth: {
        persistSession: false,
      },
    })

    // Verify user
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Parse request body
    const { messages, enableTools = false, jobId } = await req.json()

    // Get OpenAI API key
    const openaiApiKey = Deno.env.get('OPENAI_API_KEY')
    if (!openaiApiKey) {
      return new Response(
        JSON.stringify({ error: 'AI service not configured' }),
        { status: 503, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Create or update job record
    let currentJobId = jobId
    if (!currentJobId) {
      const { data: job, error: jobError } = await supabase
        .from('ai_jobs')
        .insert({
          user_id: user.id,
          job_type: 'agentic_chat',
          status: 'processing',
          request_data: { messages, enableTools },
          started_at: new Date().toISOString(),
        })
        .select()
        .single()

      if (jobError) throw jobError
      currentJobId = job.id
    } else {
      // Update existing job to processing
      await supabase
        .from('ai_jobs')
        .update({
          status: 'processing',
          started_at: new Date().toISOString(),
        })
        .eq('id', currentJobId)
    }

    const startTime = Date.now()

    // Build system message with user context
    const contextResponse = await fetch(`${supabaseUrl}/functions/v1/build-user-context`, {
      method: 'POST',
      headers: {
        'Authorization': authHeader,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ userId: user.id }),
    })

    let systemMessage = 'You are a knowledgeable running coach assistant.'
    if (contextResponse.ok) {
      const contextData = await contextResponse.json()
      systemMessage = contextData.systemMessage || systemMessage
    }

    const agenticSystemMessage = `${systemMessage}

## Function Calling Instructions

You have access to tools that can modify the user's training plan. When the user asks you to make changes:

1. **Explain first**: Tell the user what you're about to do
2. **Call the function**: Use the appropriate tool
3. **Confirm**: Explain what was changed

### Available Actions:
- Add new runs to the plan
- Move runs to different days
- Change run distances
- Change run types
- Add weeks to the plan

### Important:
- Always explain what you're about to do before calling functions
- Be specific about what will change
- Confirm the changes after execution
- Ask for clarification if the request is ambiguous`

    console.log('Calling OpenAI API with function calling enabled:', enableTools)

    // First API call - may include function calls
    const completion = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openaiApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: agenticSystemMessage },
          ...messages,
        ],
        temperature: 0.7,
        max_tokens: 2500,
        tools: enableTools ? trainingPlanTools : undefined,
        tool_choice: enableTools ? 'auto' : undefined,
      }),
    })

    if (!completion.ok) {
      throw new Error(`OpenAI API error: ${completion.statusText}`)
    }

    const completionData = await completion.json()
    const responseMessage = completionData.choices[0].message

    // Check if AI wants to call functions
    if (responseMessage.tool_calls && responseMessage.tool_calls.length > 0) {
      console.log('AI requested function calls:', responseMessage.tool_calls.length)

      // Execute each function call
      const functionResults = []
      for (const toolCall of responseMessage.tool_calls) {
        const functionName = toolCall.function.name
        const functionArgs = JSON.parse(toolCall.function.arguments)

        console.log(`Executing function: ${functionName}`, functionArgs)

        try {
          // Map function names to API actions
          let action = functionName
          if (functionName === 'add_runs_to_plan') action = 'add_runs'
          else if (functionName === 'move_run_type_to_day') action = 'move_run_type'
          else if (functionName === 'change_run_distances') action = 'change_distances'
          else if (functionName === 'change_run_type') action = 'change_run_type'
          else if (functionName === 'add_training_weeks') action = 'add_weeks'

          // Get app URL from environment or construct from Supabase URL
          const appUrl = Deno.env.get('APP_URL') || supabaseUrl.replace('.supabase.co', '.vercel.app').replace('/v1', '')

          // Call the training plan modification API on Vercel
          const modifyResponse = await fetch(`${appUrl}/api/training-plan/modify`, {
            method: 'POST',
            headers: {
              'Authorization': authHeader,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              action: action,
              params: functionArgs,
            }),
          })

          let result
          if (modifyResponse.ok) {
            result = await modifyResponse.json()
          } else {
            const errorText = await modifyResponse.text()
            result = { error: errorText }
          }

          functionResults.push({
            role: 'tool',
            tool_call_id: toolCall.id,
            content: JSON.stringify(result),
          })
        } catch (error) {
          console.error(`Error executing ${functionName}:`, error)
          functionResults.push({
            role: 'tool',
            tool_call_id: toolCall.id,
            content: JSON.stringify({ error: error.message }),
          })
        }
      }

      // Second API call with function results
      const secondCompletion = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${openaiApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          messages: [
            { role: 'system', content: agenticSystemMessage },
            ...messages,
            responseMessage,
            ...functionResults,
          ],
          temperature: 0.7,
          max_tokens: 2500,
        }),
      })

      if (!secondCompletion.ok) {
        throw new Error(`OpenAI API error on second call: ${secondCompletion.statusText}`)
      }

      const secondCompletionData = await secondCompletion.json()
      const executionTime = Date.now() - startTime

      // Update job as completed
      await supabase
        .from('ai_jobs')
        .update({
          status: 'completed',
          response_data: {
            message: secondCompletionData.choices[0].message.content,
            function_calls: responseMessage.tool_calls.map((tc: any) => tc.function.name),
            modifications_made: true,
          },
          completed_at: new Date().toISOString(),
          execution_time_ms: executionTime,
        })
        .eq('id', currentJobId)

      return new Response(
        JSON.stringify({
          jobId: currentJobId,
          message: secondCompletionData.choices[0].message.content,
          function_calls: responseMessage.tool_calls.map((tc: any) => tc.function.name),
          modifications_made: true,
          execution_time_ms: executionTime,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // No function calls - return normal response
    const executionTime = Date.now() - startTime

    await supabase
      .from('ai_jobs')
      .update({
        status: 'completed',
        response_data: {
          message: responseMessage.content,
          modifications_made: false,
        },
        completed_at: new Date().toISOString(),
        execution_time_ms: executionTime,
      })
      .eq('id', currentJobId)

    return new Response(
      JSON.stringify({
        jobId: currentJobId,
        message: responseMessage.content,
        modifications_made: false,
        execution_time_ms: executionTime,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    console.error('Error in agentic AI chat:', error)

    // Try to update job as failed if we have a jobId
    try {
      const { jobId } = await req.json()
      if (jobId) {
        const authHeader = req.headers.get('Authorization')
        const supabaseUrl = Deno.env.get('SUPABASE_URL')!
        const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!
        const supabase = createClient(supabaseUrl, supabaseAnonKey, {
          global: { headers: { Authorization: authHeader } },
          auth: { persistSession: false },
        })

        await supabase
          .from('ai_jobs')
          .update({
            status: 'failed',
            error_message: error.message,
            completed_at: new Date().toISOString(),
          })
          .eq('id', jobId)
      }
    } catch (updateError) {
      console.error('Failed to update job status:', updateError)
    }

    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})

