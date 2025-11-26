export interface Profile {
  id: string
  email: string | null
  full_name: string | null
  avatar_url: string | null
  created_at: string
  updated_at: string

  // Physical attributes
  age: number | null
  gender: 'male' | 'female' | 'other' | 'prefer_not_to_say' | null
  weight_kg: number | null
  height_cm: number | null

  // Heart rate configuration
  max_heart_rate: number | null
  resting_heart_rate: number | null

  // Custom HR zones
  hr_zone_1_max: number | null // Max HR for Zone 1 (Recovery)
  hr_zone_2_max: number | null // Max HR for Zone 2 (Aerobic)
  hr_zone_3_max: number | null // Max HR for Zone 3 (Tempo)
  hr_zone_4_max: number | null // Max HR for Zone 4 (Threshold)
  // Zone 5 is anything above zone_4_max

  // Training preferences
  preferred_units: 'metric' | 'imperial' | null
  running_experience: 'beginner' | 'intermediate' | 'advanced' | 'elite' | null
  training_goal: string | null
  weekly_mileage_target: number | null
}

export interface TrainingPlan {
  id: string
  user_id: string
  name: string
  goal_race: string | null
  goal_distance: number | null
  goal_time: string | null
  start_date: string
  end_date: string
  weeks: number
  status: 'active' | 'completed' | 'paused'
  created_at: string
  updated_at: string
}

export interface Run {
  id: string
  user_id: string
  training_plan_id: string | null
  week_number: number
  day_of_week: string
  run_type: 'Easy Run' | 'Tempo Run' | 'Quality Run' | 'Long Run' | 'Fartlek' | 'Interval' | 'Hill Repeats'
  session_type: string | null
  planned_distance: number
  target_pace: string | null
  scheduled_date: string
  completed: boolean
  actual_distance: number | null
  actual_pace: string | null
  actual_time: string | null
  rpe: number | null
  notes: string | null
  comments: string | null
  ai_insights: string | null
  strava_activity_id: number | null
  created_at: string
  updated_at: string

  // Strava-synced fields
  average_hr: number | null
  max_hr: number | null
  elevation_gain: number | null
  elevation_loss: number | null
  average_cadence: number | null
  max_cadence: number | null
  average_watts: number | null
  max_watts: number | null
  calories: number | null
  average_temp: number | null
  suffer_score: number | null
  moving_time: number | null
  elapsed_time: number | null
  achievement_count: number | null
  pr_count: number | null
  kudos_count: number | null
  comment_count: number | null
  perceived_exertion: number | null
  device_name: string | null
  gear_id: string | null
  average_speed: number | null
  max_speed: number | null

  // Stream availability flags
  has_heartrate: boolean | null
  has_cadence: boolean | null
  has_power: boolean | null
  has_gps: boolean | null
  has_time_stream: boolean | null
  has_distance_stream: boolean | null
  has_latlng_stream: boolean | null
  has_altitude_stream: boolean | null
  has_velocity_stream: boolean | null
  has_grade_stream: boolean | null
  has_temp_stream: boolean | null
}

// ============================================
// STRENGTH TRAINING TYPES
// ============================================

export type StrengthGoal =
  | 'build_muscle'
  | 'injury_prevention'
  | 'running_performance'
  | 'weight_loss'
  | 'general_fitness'
  | 'power_development'

export type WeightGoal = 'maintain' | 'lose' | 'gain'

export type RunningIntegration = 'complement_running' | 'separate' | 'recovery_focused'

export type EquipmentAccess = 'full_gym' | 'home_gym' | 'bodyweight' | 'minimal'

export type ExperienceLevel = 'beginner' | 'intermediate' | 'advanced'

export type SessionType =
  | 'lower_body'
  | 'upper_body'
  | 'full_body'
  | 'core'
  | 'mobility'
  | 'power'
  | 'recovery'

export type ExerciseCategory =
  | 'legs'
  | 'core'
  | 'upper_body'
  | 'full_body'
  | 'mobility'
  | 'plyometrics'

export interface StrengthTrainingPlan {
  id: string
  user_id: string
  name: string

  // Goals and preferences from onboarding
  strength_goals: StrengthGoal[] | null
  weight_goal: WeightGoal | null
  target_weight: number | null
  running_integration: RunningIntegration | null
  training_days: string[] | null // ['Monday', 'Wednesday', 'Friday']
  equipment_access: EquipmentAccess | null
  experience_level: ExperienceLevel | null
  additional_notes: string | null

  // Plan structure
  start_date: string
  end_date: string
  weeks: number
  sessions_per_week: number

  // Status
  status: 'active' | 'completed' | 'paused'

  created_at: string
  updated_at: string
}

export interface Exercise {
  id: string
  name: string
  category: ExerciseCategory
  muscle_groups: string[] | null
  equipment_needed: string | null
  running_benefit: string | null
  difficulty_level: ExperienceLevel | null
  instructions: string | null
  video_url: string | null
  created_at: string
}

export interface StrengthSession {
  id: string
  user_id: string
  strength_plan_id: string | null

  // Scheduling
  week_number: number
  day_of_week: string
  scheduled_date: string
  session_type: SessionType
  session_name: string | null

  // Session details
  focus_areas: string[] | null
  estimated_duration: number
  warmup_notes: string | null
  cooldown_notes: string | null

  // Completion tracking
  completed: boolean
  completed_at: string | null
  actual_duration: number | null
  rpe: number | null
  notes: string | null

  created_at: string
  updated_at: string

  // Joined data
  exercises?: SessionExercise[]
}

export interface CompletedSet {
  reps: number
  weight: string
}

export interface SessionExercise {
  id: string
  session_id: string
  exercise_id: string | null
  custom_exercise_name: string | null

  // Planned values
  exercise_order: number
  planned_sets: number
  planned_reps: string // Can be '8-10' or '12' or 'AMRAP'
  planned_weight: string | null // '20kg', 'bodyweight', 'light band'
  planned_rest_seconds: number

  // Actual values (when completed)
  completed_sets: CompletedSet[] | null
  notes: string | null

  created_at: string
  updated_at: string

  // Joined data
  exercise?: Exercise
}

// Onboarding form data type
export interface StrengthOnboardingData {
  strength_goals: StrengthGoal[]
  weight_goal: WeightGoal
  target_weight?: number
  running_integration: RunningIntegration
  training_days: string[]
  equipment_access: EquipmentAccess
  experience_level: ExperienceLevel
  additional_notes?: string
  plan_weeks: number
}

export interface NutritionLog {
  id: string
  user_id: string
  log_date: string
  meal_type: 'breakfast' | 'lunch' | 'dinner' | 'snack' | null
  description: string | null
  calories: number | null
  protein: number | null
  carbs: number | null
  fats: number | null
  notes: string | null
  created_at: string
  updated_at: string
}

export interface StravaActivity {
  id: string
  user_id: string
  strava_id: number
  name: string | null
  type: string | null
  distance: number | null
  moving_time: number | null
  elapsed_time: number | null
  total_elevation_gain: number | null
  start_date: string | null
  average_speed: number | null
  max_speed: number | null
  average_heartrate: number | null
  max_heartrate: number | null
  suffer_score: number | null
  calories: number | null
  raw_data: any | null
  created_at: string
  updated_at: string
}

export interface PersonalBest {
  id: string
  user_id: string
  distance: string
  distance_unit: string
  time: string
  pace: string | null
  achieved_date: string
  race_name: string | null
  strava_activity_id: number | null
  is_target: boolean
  created_at: string
  updated_at: string
}

export interface ChatConversation {
  id: string
  user_id: string
  title: string
  mode: 'chat' | 'agentic'
  created_at: string
  updated_at: string
  last_message_at: string
}

export interface ChatMessage {
  id: string
  conversation_id: string
  role: 'user' | 'assistant' | 'system'
  content: string
  modifications_made: boolean
  function_calls: string[] | null
  created_at: string
}
