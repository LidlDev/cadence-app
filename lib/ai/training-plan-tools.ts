/**
 * Training Plan Modification Tools for AI Function Calling
 * Defines the tools/functions that the AI can use to modify training plans
 */

export const trainingPlanTools = [
  {
    type: 'function' as const,
    function: {
      name: 'add_runs_to_plan',
      description: 'Add new runs to the training plan. Use this when the user wants to add workouts.',
      parameters: {
        type: 'object',
        properties: {
          runs: {
            type: 'array',
            description: 'Array of runs to add',
            items: {
              type: 'object',
              properties: {
                week_number: {
                  type: 'number',
                  description: 'Week number in the training plan',
                },
                day_of_week: {
                  type: 'string',
                  enum: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'],
                  description: 'Day of the week for the run',
                },
                run_type: {
                  type: 'string',
                  enum: ['Easy Run', 'Tempo Run', 'Quality Run', 'Long Run', 'Recovery Run', 'Hill Repeats', 'Intervals'],
                  description: 'Type of run',
                },
                session_type: {
                  type: 'string',
                  description: 'Specific session type (e.g., "Fartlek", "400m repeats", "Hill sprints")',
                },
                planned_distance: {
                  type: 'number',
                  description: 'Planned distance in kilometers',
                },
                target_pace: {
                  type: 'string',
                  description: 'Target pace (e.g., "5:00")',
                },
                scheduled_date: {
                  type: 'string',
                  description: 'Date in YYYY-MM-DD format',
                },
              },
              required: ['week_number', 'day_of_week', 'run_type', 'planned_distance', 'scheduled_date'],
            },
          },
        },
        required: ['runs'],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'move_run_type_to_day',
      description: 'Move all runs of a specific type to a different day of the week. Use when user says "move all tempo runs to Thursday".',
      parameters: {
        type: 'object',
        properties: {
          run_type: {
            type: 'string',
            enum: ['Easy Run', 'Tempo Run', 'Quality Run', 'Long Run', 'Recovery Run', 'Hill Repeats', 'Intervals'],
            description: 'Type of run to move',
          },
          new_day_of_week: {
            type: 'string',
            enum: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'],
            description: 'New day of the week',
          },
        },
        required: ['run_type', 'new_day_of_week'],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'change_run_distances',
      description: 'Change the distance for runs matching specific criteria.',
      parameters: {
        type: 'object',
        properties: {
          run_type: {
            type: 'string',
            enum: ['Easy Run', 'Tempo Run', 'Quality Run', 'Long Run', 'Recovery Run', 'Hill Repeats', 'Intervals'],
            description: 'Type of run to modify (optional)',
          },
          new_distance: {
            type: 'number',
            description: 'New distance in kilometers',
          },
          week_range: {
            type: 'object',
            properties: {
              start: { type: 'number' },
              end: { type: 'number' },
            },
            description: 'Week range to apply changes (optional)',
          },
        },
        required: ['new_distance'],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'add_training_weeks',
      description: 'Add additional weeks to the training plan. Use when user wants to extend the plan.',
      parameters: {
        type: 'object',
        properties: {
          num_weeks: {
            type: 'number',
            description: 'Number of weeks to add',
          },
          phase_type: {
            type: 'string',
            enum: ['base', 'build', 'peak', 'taper'],
            description: 'Training phase type for the new weeks',
          },
          template: {
            type: 'array',
            description: 'Custom template for weekly runs (optional)',
            items: {
              type: 'object',
              properties: {
                day: { type: 'string' },
                type: { type: 'string' },
                distance: { type: 'number' },
              },
            },
          },
        },
        required: ['num_weeks'],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'change_run_type',
      description: 'Change the type of runs matching specific criteria. Use when user wants to convert runs from one type to another.',
      parameters: {
        type: 'object',
        properties: {
          old_run_type: {
            type: 'string',
            description: 'Current run type to change from',
          },
          new_run_type: {
            type: 'string',
            enum: ['Easy Run', 'Tempo Run', 'Quality Run', 'Long Run', 'Recovery Run', 'Hill Repeats', 'Intervals'],
            description: 'New run type',
          },
          week_range: {
            type: 'object',
            properties: {
              start: { type: 'number' },
              end: { type: 'number' },
            },
            description: 'Week range to apply changes (optional)',
          },
          day_of_week: {
            type: 'string',
            description: 'Specific day of week to target (optional)',
          },
        },
        required: ['new_run_type'],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'modify_single_run',
      description: 'Modify a specific run by ID. Use this for targeted changes to individual runs when the user wants to change a specific workout. You must first get the run details from the training plan context to know the run ID.',
      parameters: {
        type: 'object',
        properties: {
          run_id: {
            type: 'string',
            description: 'The UUID of the specific run to modify',
          },
          changes: {
            type: 'object',
            description: 'Object containing the fields to update',
            properties: {
              run_type: {
                type: 'string',
                enum: ['Easy Run', 'Tempo Run', 'Quality Run', 'Long Run', 'Recovery Run', 'Hill Repeats', 'Intervals'],
                description: 'New run type',
              },
              session_type: {
                type: 'string',
                description: 'Specific session type (e.g., "Fartlek", "400m repeats")',
              },
              planned_distance: {
                type: 'number',
                description: 'New planned distance in kilometers',
              },
              target_pace: {
                type: 'string',
                description: 'New target pace (e.g., "5:00")',
              },
              day_of_week: {
                type: 'string',
                enum: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'],
                description: 'New day of the week',
              },
              scheduled_date: {
                type: 'string',
                description: 'New scheduled date in YYYY-MM-DD format',
              },
              notes: {
                type: 'string',
                description: 'Updated notes for the run',
              },
            },
          },
        },
        required: ['run_id', 'changes'],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'analyze_and_optimize_plan',
      description: 'Analyze the current training plan against user goals and make intelligent modifications to multiple runs. Use this when the user asks to optimize their plan, improve their training, or align their plan with their goals. This is a powerful tool that can modify distances, paces, run types, and scheduling across the entire plan.',
      parameters: {
        type: 'object',
        properties: {
          optimization_goals: {
            type: 'array',
            description: 'List of optimization goals to achieve',
            items: {
              type: 'string',
              enum: [
                'increase_weekly_mileage',
                'improve_speed_work',
                'add_recovery',
                'balance_intensity',
                'progressive_overload',
                'taper_for_race',
                'build_base',
                'peak_performance',
              ],
            },
          },
          target_race_distance: {
            type: 'string',
            description: 'Target race distance if optimizing for a specific race (e.g., "5K", "10K", "Half Marathon", "Marathon")',
          },
          target_race_date: {
            type: 'string',
            description: 'Target race date in YYYY-MM-DD format if optimizing for a race',
          },
          weekly_mileage_target: {
            type: 'number',
            description: 'Target weekly mileage in kilometers',
          },
          modifications: {
            type: 'array',
            description: 'Specific modifications to make to runs',
            items: {
              type: 'object',
              properties: {
                run_id: {
                  type: 'string',
                  description: 'ID of the run to modify',
                },
                changes: {
                  type: 'object',
                  description: 'Changes to apply to this run',
                  properties: {
                    run_type: { type: 'string' },
                    planned_distance: { type: 'number' },
                    target_pace: { type: 'string' },
                    day_of_week: { type: 'string' },
                    scheduled_date: { type: 'string' },
                    notes: { type: 'string' },
                  },
                },
              },
              required: ['run_id', 'changes'],
            },
          },
        },
        required: ['modifications'],
      },
    },
  },
]

/**
 * Strength Training Tools for AI Function Calling
 * Defines the tools/functions that the AI can use to modify strength training plans
 */
export const strengthTrainingTools = [
  {
    type: 'function' as const,
    function: {
      name: 'modify_strength_session',
      description: 'Modify a specific strength training session. Use this for targeted changes to individual sessions.',
      parameters: {
        type: 'object',
        properties: {
          session_id: {
            type: 'string',
            description: 'The UUID of the strength session to modify',
          },
          changes: {
            type: 'object',
            description: 'Object containing the fields to update',
            properties: {
              session_type: {
                type: 'string',
                enum: ['lower_body', 'upper_body', 'full_body', 'core', 'mobility', 'power', 'recovery'],
                description: 'Type of strength session',
              },
              session_name: {
                type: 'string',
                description: 'Name of the session',
              },
              scheduled_date: {
                type: 'string',
                description: 'New scheduled date in YYYY-MM-DD format',
              },
              estimated_duration: {
                type: 'number',
                description: 'Estimated duration in minutes',
              },
              focus_areas: {
                type: 'array',
                items: { type: 'string' },
                description: 'Focus areas for the session (e.g., ["glutes", "hamstrings"])',
              },
              notes: {
                type: 'string',
                description: 'Updated notes for the session',
              },
            },
          },
        },
        required: ['session_id', 'changes'],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'add_strength_sessions',
      description: 'Add new strength training sessions to the plan. Use when the user wants to add workouts.',
      parameters: {
        type: 'object',
        properties: {
          sessions: {
            type: 'array',
            description: 'Array of sessions to add',
            items: {
              type: 'object',
              properties: {
                week_number: {
                  type: 'number',
                  description: 'Week number in the training plan',
                },
                session_type: {
                  type: 'string',
                  enum: ['lower_body', 'upper_body', 'full_body', 'core', 'mobility', 'power', 'recovery'],
                  description: 'Type of strength session',
                },
                session_name: {
                  type: 'string',
                  description: 'Name of the session',
                },
                scheduled_date: {
                  type: 'string',
                  description: 'Date in YYYY-MM-DD format',
                },
                estimated_duration: {
                  type: 'number',
                  description: 'Estimated duration in minutes',
                },
                focus_areas: {
                  type: 'array',
                  items: { type: 'string' },
                  description: 'Focus areas for the session',
                },
              },
              required: ['week_number', 'session_type', 'scheduled_date'],
            },
          },
        },
        required: ['sessions'],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'analyze_strength_plan',
      description: 'Analyze the current strength training plan and provide insights or recommendations. Use when the user asks about their strength training progress, balance, or wants suggestions.',
      parameters: {
        type: 'object',
        properties: {
          analysis_type: {
            type: 'string',
            enum: ['balance', 'progress', 'recovery', 'running_integration', 'recommendations'],
            description: 'Type of analysis to perform',
          },
          focus_area: {
            type: 'string',
            description: 'Specific area to focus the analysis on (optional)',
          },
        },
        required: ['analysis_type'],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'swap_session_day',
      description: 'Swap a strength session to a different day. Use when the user wants to reschedule a session.',
      parameters: {
        type: 'object',
        properties: {
          session_id: {
            type: 'string',
            description: 'The UUID of the session to move',
          },
          new_date: {
            type: 'string',
            description: 'New date in YYYY-MM-DD format',
          },
        },
        required: ['session_id', 'new_date'],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'mark_strength_session_complete',
      description: 'Mark a strength session as completed. Use when the user says they finished a workout.',
      parameters: {
        type: 'object',
        properties: {
          session_id: {
            type: 'string',
            description: 'The UUID of the session to mark complete',
          },
          actual_duration: {
            type: 'number',
            description: 'Actual duration in minutes',
          },
          rpe: {
            type: 'number',
            description: 'Rate of perceived exertion (1-10)',
          },
          notes: {
            type: 'string',
            description: 'Notes about the completed session',
          },
        },
        required: ['session_id'],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'add_exercise_to_session',
      description: 'Add an exercise to an existing strength session. Use this when the user wants to add a specific exercise to a workout.',
      parameters: {
        type: 'object',
        properties: {
          session_id: {
            type: 'string',
            description: 'The UUID of the strength session',
          },
          exercise_name: {
            type: 'string',
            description: 'Name of the exercise to add',
          },
          sets: {
            type: 'number',
            description: 'Number of sets (default: 3)',
          },
          reps: {
            type: 'string',
            description: 'Number of reps (e.g., "10", "8-12", "AMRAP")',
          },
          weight_suggestion: {
            type: 'string',
            description: 'Weight suggestion (e.g., "bodyweight", "light", "moderate", "heavy")',
          },
          rest_seconds: {
            type: 'number',
            description: 'Rest time between sets in seconds',
          },
          notes: {
            type: 'string',
            description: 'Form cues or notes for the exercise',
          },
        },
        required: ['session_id', 'exercise_name'],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'remove_exercise_from_session',
      description: 'Remove an exercise from a strength session.',
      parameters: {
        type: 'object',
        properties: {
          session_id: {
            type: 'string',
            description: 'The UUID of the strength session',
          },
          exercise_name: {
            type: 'string',
            description: 'Name of the exercise to remove',
          },
        },
        required: ['session_id', 'exercise_name'],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'modify_session_exercise',
      description: 'Modify an exercise within a strength session (change sets, reps, weight, etc).',
      parameters: {
        type: 'object',
        properties: {
          session_id: {
            type: 'string',
            description: 'The UUID of the strength session',
          },
          exercise_name: {
            type: 'string',
            description: 'Name of the exercise to modify',
          },
          changes: {
            type: 'object',
            properties: {
              sets: { type: 'number' },
              reps: { type: 'string' },
              weight_suggestion: { type: 'string' },
              rest_seconds: { type: 'number' },
              notes: { type: 'string' },
            },
          },
        },
        required: ['session_id', 'exercise_name', 'changes'],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'extend_strength_plan',
      description: 'Generate additional weeks for the strength training plan, building on the current progression.',
      parameters: {
        type: 'object',
        properties: {
          weeks_to_add: {
            type: 'number',
            description: 'Number of weeks to add (default: 2)',
          },
        },
        required: [],
      },
    },
  },
]

/**
 * Combined tools for both running and strength training
 */
export const allTrainingTools = [...trainingPlanTools, ...strengthTrainingTools]

