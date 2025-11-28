/**
 * Training Plan Modification Tools for AI Function Calling
 * Shared between Edge Functions and API routes
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
      description: 'Change the planned distance for runs matching specific criteria.',
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
      name: 'change_run_type',
      description: 'Change the type of specific runs.',
      parameters: {
        type: 'object',
        properties: {
          current_type: {
            type: 'string',
            description: 'Current run type to change from',
          },
          new_type: {
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
          },
        },
        required: ['current_type', 'new_type'],
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
        },
        required: ['num_weeks'],
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
              },
              session_name: { type: 'string' },
              scheduled_date: { type: 'string' },
              estimated_duration: { type: 'number' },
              focus_areas: { type: 'array', items: { type: 'string' } },
              notes: { type: 'string' },
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
      description: 'Add new strength training sessions to the plan.',
      parameters: {
        type: 'object',
        properties: {
          sessions: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                week_number: { type: 'number' },
                session_type: {
                  type: 'string',
                  enum: ['lower_body', 'upper_body', 'full_body', 'core', 'mobility', 'power', 'recovery'],
                },
                session_name: { type: 'string' },
                scheduled_date: { type: 'string' },
                estimated_duration: { type: 'number' },
                focus_areas: { type: 'array', items: { type: 'string' } },
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
      description: 'Analyze the current strength training plan and provide insights.',
      parameters: {
        type: 'object',
        properties: {
          analysis_type: {
            type: 'string',
            enum: ['balance', 'progress', 'recovery', 'running_integration', 'recommendations'],
          },
          focus_area: { type: 'string' },
        },
        required: ['analysis_type'],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'swap_session_day',
      description: 'Swap a strength session to a different day.',
      parameters: {
        type: 'object',
        properties: {
          session_id: { type: 'string' },
          new_date: { type: 'string' },
        },
        required: ['session_id', 'new_date'],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'mark_strength_session_complete',
      description: 'Mark a strength session as completed.',
      parameters: {
        type: 'object',
        properties: {
          session_id: { type: 'string' },
          actual_duration: { type: 'number' },
          rpe: { type: 'number' },
          notes: { type: 'string' },
        },
        required: ['session_id'],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'add_exercise_to_session',
      description: 'Add an exercise to a strength session.',
      parameters: {
        type: 'object',
        properties: {
          session_id: { type: 'string' },
          exercise_name: { type: 'string' },
          sets: { type: 'number' },
          reps: { type: 'string' },
          weight_suggestion: { type: 'string' },
          rest_seconds: { type: 'number' },
          notes: { type: 'string' },
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
          session_id: { type: 'string' },
          exercise_name: { type: 'string' },
        },
        required: ['session_id', 'exercise_name'],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'modify_session_exercise',
      description: 'Modify an exercise within a session.',
      parameters: {
        type: 'object',
        properties: {
          session_id: { type: 'string' },
          exercise_name: { type: 'string' },
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
      description: 'Generate additional weeks for the strength training plan.',
      parameters: {
        type: 'object',
        properties: {
          weeks_to_add: { type: 'number' },
        },
        required: [],
      },
    },
  },
]

// Nutrition Tools
export const nutritionTools = [
  {
    type: 'function' as const,
    function: {
      name: 'log_meal',
      description: 'Log a meal or food item for the user. Use when user says they ate something.',
      parameters: {
        type: 'object',
        properties: {
          meal_type: {
            type: 'string',
            enum: ['breakfast', 'lunch', 'dinner', 'snack', 'pre_workout', 'post_workout'],
            description: 'Type of meal',
          },
          meal_name: {
            type: 'string',
            description: 'Name or description of the meal',
          },
          foods: {
            type: 'array',
            description: 'List of foods in the meal',
            items: {
              type: 'object',
              properties: {
                name: { type: 'string' },
                quantity: { type: 'number' },
                calories: { type: 'number' },
                protein_g: { type: 'number' },
                carbs_g: { type: 'number' },
                fat_g: { type: 'number' },
              },
              required: ['name'],
            },
          },
          date: {
            type: 'string',
            description: 'Date in YYYY-MM-DD format (defaults to today)',
          },
        },
        required: ['meal_type', 'foods'],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'log_hydration',
      description: 'Log water or beverage intake for the user.',
      parameters: {
        type: 'object',
        properties: {
          amount_ml: {
            type: 'number',
            description: 'Amount in milliliters',
          },
          beverage_type: {
            type: 'string',
            enum: ['water', 'electrolytes', 'sports_drink', 'coffee', 'tea', 'other'],
            description: 'Type of beverage',
          },
          date: {
            type: 'string',
            description: 'Date in YYYY-MM-DD format (defaults to today)',
          },
        },
        required: ['amount_ml'],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'get_nutrition_summary',
      description: 'Get nutrition summary for a specific date or date range.',
      parameters: {
        type: 'object',
        properties: {
          date: {
            type: 'string',
            description: 'Date in YYYY-MM-DD format (defaults to today)',
          },
          include_meals: {
            type: 'boolean',
            description: 'Whether to include meal details',
          },
        },
        required: [],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'analyze_nutrition',
      description: 'Analyze nutrition patterns and provide insights based on training.',
      parameters: {
        type: 'object',
        properties: {
          days: {
            type: 'number',
            description: 'Number of days to analyze (default 7)',
          },
          focus: {
            type: 'string',
            enum: ['macros', 'hydration', 'timing', 'training_alignment', 'all'],
            description: 'What aspect to focus the analysis on',
          },
        },
        required: [],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'adjust_nutrition_targets',
      description: 'Adjust daily nutrition targets based on user request.',
      parameters: {
        type: 'object',
        properties: {
          target_type: {
            type: 'string',
            enum: ['calories', 'protein', 'carbs', 'fat', 'hydration'],
            description: 'Which target to adjust',
          },
          adjustment: {
            type: 'string',
            enum: ['increase', 'decrease', 'set'],
            description: 'Type of adjustment',
          },
          value: {
            type: 'number',
            description: 'Value for the adjustment (percentage for increase/decrease, absolute for set)',
          },
        },
        required: ['target_type', 'adjustment', 'value'],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'get_meal_suggestions',
      description: 'Get meal suggestions based on remaining macros and preferences.',
      parameters: {
        type: 'object',
        properties: {
          meal_type: {
            type: 'string',
            enum: ['breakfast', 'lunch', 'dinner', 'snack', 'pre_workout', 'post_workout'],
            description: 'Type of meal to suggest',
          },
          constraints: {
            type: 'object',
            properties: {
              max_calories: { type: 'number' },
              min_protein: { type: 'number' },
              quick_prep: { type: 'boolean' },
            },
          },
        },
        required: ['meal_type'],
      },
    },
  },
]

export const allTrainingTools = [...trainingPlanTools, ...strengthTrainingTools, ...nutritionTools]
