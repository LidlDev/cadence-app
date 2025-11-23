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
  run_type: 'Easy Run' | 'Tempo Run' | 'Quality Run' | 'Long Run'
  session_type: string | null
  planned_distance: number
  planned_pace: string | null
  target_pace: string | null
  scheduled_date: string
  completed: boolean
  actual_distance: number | null
  actual_pace: string | null
  actual_time: string | null
  rpe: number | null
  notes: string | null
  comments: string | null
  strava_activity_id: number | null
  created_at: string
  updated_at: string
}

export interface StrengthSession {
  id: string
  user_id: string
  training_plan_id: string | null
  scheduled_date: string
  completed: boolean
  session_type: string | null
  exercises: Exercise[] | null
  duration: number | null
  notes: string | null
  created_at: string
  updated_at: string
}

export interface Exercise {
  name: string
  sets: number
  reps: number
  weight?: number
  notes?: string
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
  distance: number
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

