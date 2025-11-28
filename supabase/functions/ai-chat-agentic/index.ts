// Supabase Edge Function for Agentic AI Chat
// Handles long-running AI requests without timeout constraints

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.4'
import { allTrainingTools } from '../_shared/training-plan-tools.ts'

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

    // Verify user by passing the JWT token directly
    const { data: { user }, error: userError } = await supabase.auth.getUser(jwt)
    if (userError || !user) {
      console.error('Auth error:', userError)
      console.error('User:', user)
      console.error('Auth header present:', !!authHeader)
      console.error('JWT token length:', jwt?.length)
      return new Response(
        JSON.stringify({
          error: 'Unauthorized',
          details: userError?.message || 'No user found',
          hasAuthHeader: !!authHeader,
          jwtLength: jwt?.length
        }),
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

    let systemMessage = 'You are an enthusiastic, knowledgeable, and motivating running coach! 🏃‍♂️'
    if (contextResponse.ok) {
      const contextData = await contextResponse.json()
      systemMessage = contextData.systemMessage || systemMessage
      console.log('User context loaded successfully')
      console.log('System message length:', systemMessage.length)
      console.log('System message preview:', systemMessage.substring(0, 500))
    } else {
      console.error('Failed to load user context:', contextResponse.status, contextResponse.statusText)
      const errorText = await contextResponse.text()
      console.error('Context error details:', errorText)
    }

    const agenticSystemMessage = `${systemMessage}

## 🔧 Function Calling Instructions - You Can Make Real Changes!

You have access to powerful tools that can modify the user's training plan! When the user asks you to make changes:

1. **Explain first**: Tell the user what you're about to do with enthusiasm!
2. **Call the function**: Use the appropriate tool
3. **Confirm**: Explain what was changed and celebrate the update! 🎉

### Available Functions:

#### Bulk Operations:
- **add_runs_to_plan**: Add new runs to the training plan
- **move_run_type_to_day**: Move all runs of a type to a different day
- **change_run_distances**: Change distances for specific runs
- **add_training_weeks**: Add weeks to the plan
- **change_run_type**: Convert runs from one type to another

#### Targeted Operations:
- **modify_single_run**: Modify a specific run by ID - use this for targeted changes to individual workouts (change distance, pace, type, day, notes, etc.)

#### Plan Optimization:
- **analyze_and_optimize_plan**: Analyze the training plan against user goals and make intelligent modifications to multiple runs at once. Use this when the user asks to optimize their plan, improve their training, or align their plan with their goals.

### Example Requests You Can Handle:

**Bulk Changes:**
- "Move all my tempo runs to Thursday"
- "Add a 4-week build block"
- "Change all easy runs to Monday"

**Targeted Changes:**
- "Change my Tuesday run to 8km"
- "Make tomorrow's run a tempo instead of easy"
- "Update the pace for my long run this week to 5:30"

**Plan Optimization:**
- "Optimize my plan for a half marathon"
- "Analyze my plan and suggest improvements"
- "Adjust my training to peak for my race in 6 weeks"

### 💪 Strength Training Functions:

#### Session Management:
- **modify_strength_session**: Modify a specific strength session by ID
- **add_strength_sessions**: Add new strength sessions to the plan
- **swap_session_day**: Move a strength session to a different day
- **mark_strength_session_complete**: Mark a session as completed

#### Exercise-Level Modifications:
- **add_exercise_to_session**: Add an exercise to a specific session
- **remove_exercise_from_session**: Remove an exercise from a session
- **modify_session_exercise**: Change sets, reps, weight, or notes for an exercise

#### Plan Extension:
- **extend_strength_plan**: Generate additional weeks building on current progression

#### Analysis:
- **analyze_strength_plan**: Analyze the strength plan for balance, progress, recovery, or running integration

### Strength Training Examples:
- "Move my lower body session to Friday"
- "Add a core workout on Wednesday"
- "How is my strength training balanced?"
- "Mark today's strength session as complete"
- "Add hip thrusts to my Tuesday session"
- "Remove the lunges from tomorrow's workout"
- "Change squats to 4 sets of 8 reps"
- "Generate 2 more weeks of strength sessions"

### 🥗 Nutrition Functions:

#### Logging:
- **log_meal**: Log a meal or food item with macros
- **log_hydration**: Log water or beverage intake

#### Analysis:
- **get_nutrition_summary**: Get nutrition summary for a date
- **analyze_nutrition**: Analyze nutrition patterns and training alignment

#### Adjustments:
- **adjust_nutrition_targets**: Modify daily macro/calorie targets
- **get_meal_suggestions**: Get meal ideas based on remaining macros

### Nutrition Examples:
- "I just had a chicken salad for lunch"
- "Log 500ml of water"
- "How are my macros looking today?"
- "What should I eat for dinner to hit my protein goal?"
- "Increase my carb target by 10%"
- "Analyze my nutrition this week"

### Important:
- For single run changes, use modify_single_run with the specific run ID from the training plan context
- For plan-wide optimization, use analyze_and_optimize_plan with specific modifications
- Always explain what you're about to do before calling functions
- Be specific about what will change
- Confirm the changes after execution with energy and positivity
- Ask for clarification if the request is ambiguous
- Provide detailed, comprehensive responses - don't be brief when the situation calls for thoroughness!`

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
        temperature: 0.8,
        max_tokens: 4000,
        tools: enableTools ? allTrainingTools : undefined,
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
          // Map function names to API actions and determine endpoint
          let action = functionName
          let endpoint = 'training-plan/modify'

          // Running plan functions
          if (functionName === 'add_runs_to_plan') action = 'add_runs'
          else if (functionName === 'move_run_type_to_day') action = 'move_run_type'
          else if (functionName === 'change_run_distances') action = 'change_distances'
          else if (functionName === 'change_run_type') action = 'change_run_type'
          else if (functionName === 'add_training_weeks') action = 'add_weeks'
          else if (functionName === 'modify_single_run') action = 'modify_single_run'
          else if (functionName === 'analyze_and_optimize_plan') action = 'analyze_and_optimize'
          // Strength training functions
          else if (functionName === 'modify_strength_session') {
            action = 'modify_session'
            endpoint = 'strength-plan/modify'
          }
          else if (functionName === 'add_strength_sessions') {
            action = 'add_sessions'
            endpoint = 'strength-plan/modify'
          }
          else if (functionName === 'analyze_strength_plan') {
            action = 'analyze_plan'
            endpoint = 'strength-plan/modify'
          }
          else if (functionName === 'swap_session_day') {
            action = 'swap_day'
            endpoint = 'strength-plan/modify'
          }
          else if (functionName === 'mark_strength_session_complete') {
            action = 'mark_complete'
            endpoint = 'strength-plan/modify'
          }
          else if (functionName === 'add_exercise_to_session') {
            action = 'add_exercise'
            endpoint = 'strength-plan/modify'
          }
          else if (functionName === 'remove_exercise_from_session') {
            action = 'remove_exercise'
            endpoint = 'strength-plan/modify'
          }
          else if (functionName === 'modify_session_exercise') {
            action = 'modify_exercise'
            endpoint = 'strength-plan/modify'
          }
          else if (functionName === 'extend_strength_plan') {
            // Handle extend_strength_plan specially - call edge function directly
            const weeksToAdd = functionArgs.weeks_to_add || 2

            // Get active plan
            const { data: plan } = await supabase
              .from('strength_training_plans')
              .select('*')
              .eq('status', 'active')
              .single()

            if (!plan) {
              functionResults.push({
                role: 'tool',
                tool_call_id: toolCall.id,
                content: JSON.stringify({ error: 'No active strength plan found' }),
              })
              continue
            }

            // Get recent sessions
            const { data: recentSessions } = await supabase
              .from('strength_sessions')
              .select('*, session_exercises:session_exercises(*, exercise:exercises(*))')
              .eq('strength_plan_id', plan.id)
              .order('week_number', { ascending: false })
              .order('scheduled_date', { ascending: false })
              .limit(10)

            // Call extend-strength-plan edge function directly
            const extendResponse = await fetch(`${supabaseUrl}/functions/v1/extend-strength-plan`, {
              method: 'POST',
              headers: {
                'Authorization': authHeader,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({ plan, recentSessions, weeksToAdd }),
            })

            let result
            if (extendResponse.ok) {
              result = await extendResponse.json()
            } else {
              result = { error: await extendResponse.text() }
            }

            functionResults.push({
              role: 'tool',
              tool_call_id: toolCall.id,
              content: JSON.stringify(result),
            })
            continue
          }
          // Handle nutrition functions directly in edge function
          else if (functionName === 'log_meal') {
            const today = new Date().toISOString().split('T')[0]
            const mealDate = functionArgs.date || today

            // Estimate macros if not provided
            const foods = functionArgs.foods || []
            let totalCals = 0, totalProtein = 0, totalCarbs = 0, totalFat = 0

            for (const food of foods) {
              totalCals += food.calories || 0
              totalProtein += food.protein_g || 0
              totalCarbs += food.carbs_g || 0
              totalFat += food.fat_g || 0
            }

            const { data: mealLog, error: mealError } = await supabase
              .from('meal_logs')
              .insert({
                user_id: user.id,
                log_date: mealDate,
                meal_type: functionArgs.meal_type,
                meal_name: functionArgs.meal_name || functionArgs.meal_type,
                total_calories: totalCals,
                total_protein_g: totalProtein,
                total_carbs_g: totalCarbs,
                total_fat_g: totalFat,
              })
              .select()
              .single()

            functionResults.push({
              role: 'tool',
              tool_call_id: toolCall.id,
              content: JSON.stringify(mealError ? { error: mealError.message } : { success: true, meal: mealLog }),
            })
            continue
          }
          else if (functionName === 'log_hydration') {
            const today = new Date().toISOString().split('T')[0]

            const { data: hydrationLog, error: hydrationError } = await supabase
              .from('hydration_logs')
              .insert({
                user_id: user.id,
                log_date: functionArgs.date || today,
                amount_ml: functionArgs.amount_ml,
                beverage_type: functionArgs.beverage_type || 'water',
              })
              .select()
              .single()

            functionResults.push({
              role: 'tool',
              tool_call_id: toolCall.id,
              content: JSON.stringify(hydrationError ? { error: hydrationError.message } : { success: true, log: hydrationLog }),
            })
            continue
          }
          else if (functionName === 'get_nutrition_summary') {
            const today = new Date().toISOString().split('T')[0]
            const targetDate = functionArgs.date || today

            const { data: target } = await supabase
              .from('daily_nutrition_targets')
              .select('*')
              .eq('user_id', user.id)
              .eq('target_date', targetDate)
              .single()

            const { data: meals } = await supabase
              .from('meal_logs')
              .select('*')
              .eq('user_id', user.id)
              .eq('log_date', targetDate)

            const { data: hydration } = await supabase
              .from('hydration_logs')
              .select('*')
              .eq('user_id', user.id)
              .eq('log_date', targetDate)

            const totalCals = meals?.reduce((sum, m) => sum + (m.total_calories || 0), 0) || 0
            const totalProtein = meals?.reduce((sum, m) => sum + (m.total_protein_g || 0), 0) || 0
            const totalCarbs = meals?.reduce((sum, m) => sum + (m.total_carbs_g || 0), 0) || 0
            const totalFat = meals?.reduce((sum, m) => sum + (m.total_fat_g || 0), 0) || 0
            const totalHydration = hydration?.reduce((sum, h) => sum + (h.amount_ml || 0), 0) || 0

            functionResults.push({
              role: 'tool',
              tool_call_id: toolCall.id,
              content: JSON.stringify({
                date: targetDate,
                target,
                actual: { calories: totalCals, protein_g: totalProtein, carbs_g: totalCarbs, fat_g: totalFat, hydration_ml: totalHydration },
                meals: functionArgs.include_meals ? meals : undefined,
                remaining: target ? {
                  calories: target.target_calories - totalCals,
                  protein_g: target.target_protein_g - totalProtein,
                  carbs_g: target.target_carbs_g - totalCarbs,
                  fat_g: target.target_fat_g - totalFat,
                } : null,
              }),
            })
            continue
          }

          // Get app URL from environment or construct from Supabase URL
          const appUrl = Deno.env.get('APP_URL') || supabaseUrl.replace('.supabase.co', '.vercel.app').replace('/v1', '')

          // Call the appropriate modification API on Vercel
          const modifyResponse = await fetch(`${appUrl}/api/${endpoint}`, {
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
            console.log(`Function ${functionName} succeeded:`, result)
          } else {
            const errorText = await modifyResponse.text()
            result = { error: errorText }
            console.error(`Function ${functionName} failed:`, errorText)
          }

          functionResults.push({
            role: 'tool',
            tool_call_id: toolCall.id,
            content: JSON.stringify(result),
          })
          console.log(`Function result for ${functionName}:`, JSON.stringify(result))
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
          temperature: 0.8,
          max_tokens: 4000,
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

