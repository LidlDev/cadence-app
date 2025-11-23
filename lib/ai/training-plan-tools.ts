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
]

