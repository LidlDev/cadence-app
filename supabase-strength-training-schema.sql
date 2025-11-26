-- ============================================
-- STRENGTH TRAINING SCHEMA
-- Run this migration to add strength training support
-- ============================================

-- ============================================
-- 1. STRENGTH TRAINING PLANS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS public.strength_training_plans (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  
  -- Goals and preferences from onboarding
  strength_goals JSONB, -- ['build_muscle', 'injury_prevention', 'running_performance']
  weight_goal TEXT, -- 'maintain', 'lose', 'gain'
  target_weight NUMERIC, -- Target weight in kg/lbs
  running_integration TEXT, -- 'complement_running', 'separate', 'recovery_focused'
  training_days JSONB, -- ['monday', 'wednesday', 'friday']
  equipment_access TEXT, -- 'full_gym', 'home_gym', 'bodyweight', 'minimal'
  experience_level TEXT, -- 'beginner', 'intermediate', 'advanced'
  additional_notes TEXT,
  
  -- Plan structure
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  weeks INTEGER NOT NULL,
  sessions_per_week INTEGER DEFAULT 3,
  
  -- Status
  status TEXT DEFAULT 'active', -- 'active', 'completed', 'paused'
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- 2. EXERCISES REFERENCE TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS public.exercises (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL UNIQUE,
  category TEXT NOT NULL, -- 'legs', 'core', 'upper_body', 'full_body', 'mobility', 'plyometrics'
  muscle_groups JSONB, -- ['quads', 'glutes', 'hamstrings']
  equipment_needed TEXT, -- 'barbell', 'dumbbells', 'bodyweight', 'machine', 'bands'
  running_benefit TEXT, -- 'injury_prevention', 'power', 'stability', 'endurance'
  difficulty_level TEXT, -- 'beginner', 'intermediate', 'advanced'
  instructions TEXT,
  video_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- 3. STRENGTH SESSIONS TABLE (ENHANCED)
-- ============================================
-- Drop and recreate if exists to update schema
DROP TABLE IF EXISTS public.strength_sessions CASCADE;

CREATE TABLE public.strength_sessions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  strength_plan_id UUID REFERENCES public.strength_training_plans(id) ON DELETE CASCADE,
  
  -- Scheduling
  week_number INTEGER NOT NULL,
  day_of_week TEXT NOT NULL, -- 'Monday', 'Tuesday', etc.
  scheduled_date DATE NOT NULL,
  session_type TEXT NOT NULL, -- 'lower_body', 'upper_body', 'full_body', 'core', 'mobility', 'power'
  session_name TEXT, -- 'Lower Body Strength', 'Core & Stability', etc.
  
  -- Session details
  focus_areas JSONB, -- ['quads', 'glutes', 'core']
  estimated_duration INTEGER DEFAULT 45, -- minutes
  warmup_notes TEXT,
  cooldown_notes TEXT,
  
  -- Completion tracking
  completed BOOLEAN DEFAULT FALSE,
  completed_at TIMESTAMPTZ,
  actual_duration INTEGER, -- minutes
  rpe INTEGER, -- Rate of Perceived Exertion (1-10)
  notes TEXT,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- 4. SESSION EXERCISES JUNCTION TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS public.session_exercises (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  session_id UUID REFERENCES public.strength_sessions(id) ON DELETE CASCADE NOT NULL,
  exercise_id UUID REFERENCES public.exercises(id) ON DELETE CASCADE,
  
  -- For custom exercises not in the library
  custom_exercise_name TEXT,
  
  -- Planned values
  exercise_order INTEGER NOT NULL,
  planned_sets INTEGER NOT NULL,
  planned_reps TEXT NOT NULL, -- Can be '8-10' or '12' or 'AMRAP'
  planned_weight TEXT, -- '20kg', 'bodyweight', 'light band'
  planned_rest_seconds INTEGER DEFAULT 60,
  
  -- Actual values (when completed)
  completed_sets JSONB, -- [{reps: 10, weight: '20kg'}, {reps: 8, weight: '20kg'}]
  notes TEXT,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- 5. ENABLE RLS
-- ============================================
ALTER TABLE public.strength_training_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.exercises ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.strength_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.session_exercises ENABLE ROW LEVEL SECURITY;

-- ============================================
-- 6. RLS POLICIES
-- ============================================
-- Strength Training Plans policies
CREATE POLICY "Users can view own strength plans" 
  ON public.strength_training_plans FOR SELECT 
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own strength plans" 
  ON public.strength_training_plans FOR INSERT 
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own strength plans" 
  ON public.strength_training_plans FOR UPDATE 
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own strength plans" 
  ON public.strength_training_plans FOR DELETE 
  USING (auth.uid() = user_id);

-- Exercises are readable by all authenticated users
CREATE POLICY "Authenticated users can view exercises"
  ON public.exercises FOR SELECT
  TO authenticated
  USING (true);

-- Strength Sessions policies
CREATE POLICY "Users can view own strength sessions"
  ON public.strength_sessions FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own strength sessions"
  ON public.strength_sessions FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own strength sessions"
  ON public.strength_sessions FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own strength sessions"
  ON public.strength_sessions FOR DELETE
  USING (auth.uid() = user_id);

-- Session Exercises policies (via session ownership)
CREATE POLICY "Users can view own session exercises"
  ON public.session_exercises FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.strength_sessions s
      WHERE s.id = session_id AND s.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert own session exercises"
  ON public.session_exercises FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.strength_sessions s
      WHERE s.id = session_id AND s.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update own session exercises"
  ON public.session_exercises FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.strength_sessions s
      WHERE s.id = session_id AND s.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete own session exercises"
  ON public.session_exercises FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.strength_sessions s
      WHERE s.id = session_id AND s.user_id = auth.uid()
    )
  );

-- ============================================
-- 7. INDEXES FOR PERFORMANCE
-- ============================================
CREATE INDEX idx_strength_plans_user ON public.strength_training_plans(user_id);
CREATE INDEX idx_strength_plans_status ON public.strength_training_plans(status);
CREATE INDEX idx_strength_sessions_user ON public.strength_sessions(user_id);
CREATE INDEX idx_strength_sessions_plan ON public.strength_sessions(strength_plan_id);
CREATE INDEX idx_strength_sessions_date ON public.strength_sessions(scheduled_date);
CREATE INDEX idx_session_exercises_session ON public.session_exercises(session_id);
CREATE INDEX idx_exercises_category ON public.exercises(category);
CREATE INDEX idx_exercises_equipment ON public.exercises(equipment_needed);

-- ============================================
-- 8. SEED EXERCISE LIBRARY
-- ============================================
INSERT INTO public.exercises (name, category, muscle_groups, equipment_needed, running_benefit, difficulty_level, instructions) VALUES
-- Lower Body - Running Focused
('Squats', 'legs', '["quads", "glutes", "hamstrings"]', 'barbell', 'power', 'intermediate', 'Stand with feet shoulder-width apart. Lower hips back and down, keeping chest up. Return to standing.'),
('Bulgarian Split Squats', 'legs', '["quads", "glutes", "hip_flexors"]', 'dumbbells', 'stability', 'intermediate', 'Rear foot elevated on bench. Lower into a lunge, keeping front knee over ankle.'),
('Romanian Deadlifts', 'legs', '["hamstrings", "glutes", "lower_back"]', 'barbell', 'injury_prevention', 'intermediate', 'Hinge at hips with slight knee bend. Lower weight along legs, feeling hamstring stretch.'),
('Single-Leg Deadlifts', 'legs', '["hamstrings", "glutes", "balance"]', 'dumbbells', 'stability', 'advanced', 'Balance on one leg. Hinge forward while extending other leg behind for counterbalance.'),
('Calf Raises', 'legs', '["calves"]', 'bodyweight', 'injury_prevention', 'beginner', 'Rise onto toes, pause at top, lower with control.'),
('Goblet Squats', 'legs', '["quads", "glutes", "core"]', 'dumbbells', 'power', 'beginner', 'Hold weight at chest. Squat deep with elbows inside knees.'),
('Step-Ups', 'legs', '["quads", "glutes"]', 'bodyweight', 'power', 'beginner', 'Step onto elevated surface, drive through heel. Alternate legs.'),
('Hip Thrusts', 'legs', '["glutes", "hamstrings"]', 'barbell', 'power', 'intermediate', 'Upper back on bench, drive hips up, squeeze glutes at top.'),
('Nordic Curls', 'legs', '["hamstrings"]', 'bodyweight', 'injury_prevention', 'advanced', 'Kneel with feet anchored. Lower body forward with control, using hamstrings.'),
('Box Jumps', 'plyometrics', '["quads", "glutes", "calves"]', 'bodyweight', 'power', 'intermediate', 'Jump onto box, land softly with bent knees. Step down and repeat.'),

-- Core - Running Focused
('Plank', 'core', '["abs", "obliques", "lower_back"]', 'bodyweight', 'stability', 'beginner', 'Hold body in straight line from head to heels, engaging core.'),
('Dead Bug', 'core', '["abs", "hip_flexors"]', 'bodyweight', 'stability', 'beginner', 'Lie on back. Extend opposite arm and leg while keeping lower back pressed down.'),
('Bird Dog', 'core', '["lower_back", "glutes", "abs"]', 'bodyweight', 'stability', 'beginner', 'On hands and knees, extend opposite arm and leg. Hold, then switch.'),
('Pallof Press', 'core', '["obliques", "abs"]', 'bands', 'stability', 'intermediate', 'Resist rotation while pressing band away from chest.'),
('Side Plank', 'core', '["obliques", "hip_stabilizers"]', 'bodyweight', 'stability', 'intermediate', 'Stack feet, lift hips, maintain straight line from head to feet.'),
('Russian Twists', 'core', '["obliques", "abs"]', 'bodyweight', 'endurance', 'intermediate', 'Seated, lean back slightly. Rotate torso side to side with or without weight.'),
('Hanging Leg Raises', 'core', '["abs", "hip_flexors"]', 'bodyweight', 'power', 'advanced', 'Hang from bar. Raise legs to 90 degrees with control.'),
('Copenhagen Plank', 'core', '["adductors", "obliques"]', 'bodyweight', 'injury_prevention', 'advanced', 'Side plank with top leg on bench. Squeeze adductors to maintain position.'),

-- Upper Body
('Push-Ups', 'upper_body', '["chest", "triceps", "shoulders"]', 'bodyweight', 'endurance', 'beginner', 'Lower chest to ground, push back up. Keep body in straight line.'),
('Pull-Ups', 'upper_body', '["lats", "biceps", "upper_back"]', 'bodyweight', 'endurance', 'intermediate', 'Hang from bar, pull chin above bar, lower with control.'),
('Dumbbell Rows', 'upper_body', '["lats", "rhomboids", "biceps"]', 'dumbbells', 'stability', 'beginner', 'Hinge forward, pull weight to hip, squeeze shoulder blade.'),
('Shoulder Press', 'upper_body', '["shoulders", "triceps"]', 'dumbbells', 'endurance', 'intermediate', 'Press weights overhead, fully extend arms, lower with control.'),
('Face Pulls', 'upper_body', '["rear_delts", "rhomboids"]', 'bands', 'injury_prevention', 'beginner', 'Pull band to face, rotating hands outward. Squeeze shoulder blades.'),
('Dips', 'upper_body', '["chest", "triceps", "shoulders"]', 'bodyweight', 'endurance', 'intermediate', 'Lower body between parallel bars, push back up.'),

-- Mobility & Recovery
('Hip Flexor Stretch', 'mobility', '["hip_flexors"]', 'bodyweight', 'injury_prevention', 'beginner', 'Kneeling lunge position. Push hips forward, feel stretch in front of hip.'),
('Pigeon Pose', 'mobility', '["glutes", "hip_rotators"]', 'bodyweight', 'injury_prevention', 'beginner', 'One leg bent in front, other extended behind. Fold forward over front leg.'),
('World''s Greatest Stretch', 'mobility', '["hip_flexors", "hamstrings", "thoracic_spine"]', 'bodyweight', 'injury_prevention', 'intermediate', 'Lunge with rotation, opening chest to ceiling. Great dynamic warmup.'),
('Foam Rolling IT Band', 'mobility', '["it_band"]', 'bodyweight', 'injury_prevention', 'beginner', 'Roll outer thigh from hip to knee. Pause on tight spots.'),
('Cat-Cow', 'mobility', '["spine", "abs"]', 'bodyweight', 'injury_prevention', 'beginner', 'On hands and knees, alternate arching and rounding spine.'),

-- Full Body
('Kettlebell Swings', 'full_body', '["glutes", "hamstrings", "core", "shoulders"]', 'dumbbells', 'power', 'intermediate', 'Hinge at hips, swing weight to shoulder height using hip drive.'),
('Burpees', 'full_body', '["full_body"]', 'bodyweight', 'endurance', 'intermediate', 'Drop to ground, push up, jump with hands overhead.'),
('Turkish Get-Up', 'full_body', '["core", "shoulders", "hips"]', 'dumbbells', 'stability', 'advanced', 'From lying, stand while keeping weight overhead. Reverse to return.'),
('Clean and Press', 'full_body', '["legs", "core", "shoulders"]', 'barbell', 'power', 'advanced', 'Explosively lift weight from floor to shoulders, then press overhead.'),
('Lunges', 'legs', '["quads", "glutes", "balance"]', 'bodyweight', 'stability', 'beginner', 'Step forward into lunge, keeping front knee over ankle. Push back to start.');

-- ============================================
-- 9. UPDATED_AT TRIGGER
-- ============================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_strength_plans_updated_at
    BEFORE UPDATE ON public.strength_training_plans
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_strength_sessions_updated_at
    BEFORE UPDATE ON public.strength_sessions
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_session_exercises_updated_at
    BEFORE UPDATE ON public.session_exercises
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

