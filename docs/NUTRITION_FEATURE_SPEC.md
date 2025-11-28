# Nutrition Feature Specification

## Overview

The Nutrition feature is a comprehensive meal and hydration tracking system deeply integrated with the user's running and strength training plans. Unlike the session-based running and strength pages, nutrition operates on a **daily cadence** with multiple meal touchpoints throughout each day.

---

## Core Philosophy

Nutrition in Cadence is not a standalone calorie counter—it's a **performance optimization tool** that:

- Adapts macro targets based on training load and recovery needs
- Provides race-week and taper-specific nutrition guidance
- Links hydration to upcoming workouts and weather conditions
- Offers AI-powered insights connecting nutrition to performance trends

---

## Feature Components

### 1. Nutrition Onboarding Flow (Modal)

Similar to strength onboarding, a multi-step modal captures user preferences:

#### Step 1: Goals Assessment

- Primary goal: Performance, Weight Loss, Weight Gain, Maintain, Body Recomposition
- Target weight (optional)
- Timeline alignment with running plan phases

#### Step 2: Current Eating Habits

- Meals per day (2-6)
- Typical eating window (intermittent fasting support)
- Cooking frequency: Daily / Few times a week / Rarely
- Meal prep preference: Yes / No / Sometimes

#### Step 3: Dietary Preferences

- Diet type: Omnivore, Vegetarian, Vegan, Pescatarian, Keto, Paleo, Mediterranean
- Allergies/Intolerances: Gluten, Dairy, Nuts, Shellfish, Soy, Eggs, etc.
- Foods to avoid (free text)
- Favorite foods/cuisines (free text)

#### Step 4: Lifestyle Factors

- Activity level outside training
- Sleep schedule (affects meal timing recommendations)
- Hydration habits baseline
- Supplements currently taking

#### Step 5: Review & Generate

- Summary of inputs
- "Generate My Nutrition Plan" button → Calls Supabase Edge Function

---

### 2. AI Plan Generation (Edge Function: `generate-nutrition-plan`)

**Input Context:**

- User's nutrition preferences from onboarding
- Active running plan (phases, key workouts, race dates)
- Active strength plan (session types, frequency)
- User's fitness goals and current metrics

**Output:**

- 12-week phased nutrition plan aligned with training
- Daily macro targets varying by training day type and phase
- Meal templates for each day type
- Hydration targets with pre/post workout adjustments
- Race week specific protocols

---

### 3. External API Integrations

#### Open Food Facts API (Free, Open Source)

- Barcode scanning for packaged foods
- Nutritional data for common ingredients
- No API key required, rate-limited

#### FatSecret API (Free Tier Available)

- More comprehensive food database
- Recipe nutrition calculation
- Requires OAuth authentication
- 5000 calls/day on free tier

#### Nutritionix API (Alternative)

- Natural language food parsing ("2 eggs and toast")
- Restaurant menu items
- Exercise calorie burn data

**Implementation Strategy:**

1. Primary: FatSecret for detailed lookups
2. Fallback: Open Food Facts for packaged goods
3. Manual entry with AI estimation for unlisted items

---

### 4. Database Schema

See `supabase-nutrition-schema.sql` for full implementation. Key tables:

- `nutrition_plans` - User's active nutrition plan with preferences
- `daily_nutrition_targets` - Per-day macro targets based on training
- `meal_templates` - Reusable meal suggestions with nutrition data
- `meal_logs` - User's logged meals
- `meal_log_items` - Individual food items within meals
- `hydration_logs` - Water and beverage tracking
- `daily_nutrition_summaries` - Materialized daily totals for performance

---

### 5. UI/UX Structure

#### Main Nutrition Page Layout

```text
┌─────────────────────────────────────────────────────────────┐
│  📊 Today's Focus Card                                       │
│  ┌─────────────────────────────────────────────────────────┐│
│  │ 🍽️ Next Up: Lunch (12:00 PM)                            ││
│  │ Suggested: Grilled Chicken Salad with Quinoa            ││
│  │ Target: 650 cal | 45g protein | 55g carbs | 20g fat     ││
│  │ [Log This Meal] [Choose Different] [Skip]               ││
│  └─────────────────────────────────────────────────────────┘│
├─────────────────────────────────────────────────────────────┤
│  📈 Daily Progress (Pie Charts / Progress Bars)             │
│  ┌──────────┬──────────┬──────────┬──────────┐              │
│  │ Calories │ Protein  │ Carbs    │ Fat      │              │
│  │ 1,247    │ 82g      │ 145g     │ 42g      │              │
│  │ ████░░░░ │ ██████░░ │ █████░░░ │ ██████░░ │              │
│  │ 62%      │ 75%      │ 58%      │ 70%      │              │
│  └──────────┴──────────┴──────────┴──────────┘              │
│                                                              │
│  💧 Hydration: 1.8L / 3.2L  ████████░░░░░░░░  56%           │
│  [+ Add Water] [+ Add Electrolytes]                         │
├─────────────────────────────────────────────────────────────┤
│  🍳 Today's Meals                                            │
│  ┌─────────────────────────────────────────────────────────┐│
│  │ ✅ Breakfast (7:30 AM)                    547 cal       ││
│  │ ⏳ Lunch (suggested 12:00 PM)             [Log Meal]    ││
│  │ ○ Pre-Workout Snack (3:30 PM)             --            ││
│  │ ○ Dinner (7:00 PM)                        --            ││
│  └─────────────────────────────────────────────────────────┘│
├─────────────────────────────────────────────────────────────┤
│  🧠 AI Insight                                               │
│  "Great protein intake! With your 10K tempo run today,      │
│   aim for an extra 30g carbs at lunch to fuel your session."│
└─────────────────────────────────────────────────────────────┘
```

#### View Toggles

- **Today** (default) - Focus on current day with meal slots
- **Week** - 7-day overview with daily macro summaries
- **Phase** - Current training phase macro trends and averages
- **Calendar** - Monthly view with color-coded adherence indicators

#### Meal Logging Flow

1. Select meal type (Breakfast/Lunch/Dinner/Snack/Pre-Workout/Post-Workout)
2. Search foods via FatSecret API or barcode scan
3. Select from recent foods or plan suggestions
4. Adjust portions and confirm nutritional values
5. Save → Update daily summary automatically

---

### 6. Training Integration Points

#### Dynamic Macro Adjustment

| Day Type        | Carb Modifier | Protein Modifier | Calorie Modifier |
| --------------- | ------------- | ---------------- | ---------------- |
| Rest Day        | -20%          | Base             | -10%             |
| Easy Run        | Base          | Base             | Base             |
| Tempo/Intervals | +15%          | +10%             | +10%             |
| Long Run        | +30%          | +15%             | +20%             |
| Race Day        | +40%          | Base             | +15%             |
| Recovery        | +10%          | +20%             | +5%              |
| Strength Day    | +10%          | +25%             | +10%             |

#### Pre-Race Week Protocol

- **7 days out:** Normal eating, increase hydration
- **3 days out:** Begin carb loading (+50% carbs)
- **1 day out:** High carb, low fiber, familiar foods only
- **Race morning:** Proven pre-race meal, 2-3 hours before

#### Hydration Alerts

- Based on upcoming workout intensity
- Weather/temperature adjustments (if available)
- Pre-long run hydration reminders (24-48 hours out)
- Post-workout rehydration targets

---

### 7. AI Agentic Tools

New nutrition-specific tools for the agentic AI chat:

| Tool                    | Description                                       |
| ----------------------- | ------------------------------------------------- |
| `log_meal`              | Log a meal with food items                        |
| `log_hydration`         | Log water or beverage intake                      |
| `get_nutrition_status`  | Get current day nutrition progress                |
| `suggest_meal`          | Get meal suggestion based on remaining macros     |
| `analyze_nutrition`     | Analyze nutrition trends and adherence            |
| `modify_daily_targets`  | Adjust targets for a specific day                 |
| `search_food`           | Search for food nutritional information           |

**Example AI Conversations:**

- "What should I eat for dinner tonight?"
- "Log my breakfast: 2 eggs, toast with avocado, and a coffee"
- "I just drank 500ml of water"
- "How are my macros looking this week?"
- "I have a long run tomorrow, what should I eat today?"
- "Find me a high-protein snack under 200 calories"
- "Am I eating enough carbs for my training load?"

---

### 8. Edge Functions Required

| Function                    | Purpose                                        |
| --------------------------- | ---------------------------------------------- |
| `generate-nutrition-plan`   | Create 12-week plan from onboarding data       |
| `extend-nutrition-plan`     | Add more weeks to existing plan                |
| `search-food-database`      | Proxy to FatSecret/OpenFoodFacts APIs          |
| `calculate-daily-targets`   | Compute macros based on training schedule      |
| `generate-meal-suggestion`  | AI-powered meal recommendation                 |
| `analyze-nutrition-trends`  | Weekly/phase analysis with insights            |

---

### 9. Implementation Phases

#### Phase 1: Foundation (MVP) ✅ COMPLETE

- [x] Database schema and migrations
- [x] Onboarding modal flow
- [x] `generate-nutrition-plan` edge function
- [x] Basic daily view with macro targets
- [x] Manual meal logging (no API integration)
- [x] Simple hydration tracking

#### Phase 2: API Integration 🔄 IN PROGRESS

- [x] FatSecret API integration
- [x] Open Food Facts integration
- [x] Food search in meal logging
- [x] Barcode scanning (manual entry)

- [x] Recent foods quick-add
- [ ] Camera-based barcode scanning (requires native camera API)

#### Phase 3: Intelligence

- [ ] Training-aware macro adjustments
- [ ] AI meal suggestions
- [ ] Daily AI insights
- [ ] Agentic AI tools
- [ ] Performance correlation analysis

#### Phase 4: Advanced

- [ ] Race week protocols
- [ ] Weather-based hydration
- [ ] Meal prep planning
- [ ] Shopping list generation
- [ ] Recipe scaling

---

### 10. API Keys & Setup Required

```env
# FatSecret API (OAuth 1.0)
FATSECRET_CONSUMER_KEY=
FATSECRET_CONSUMER_SECRET=

# Optional: Nutritionix (if needed)
NUTRITIONIX_APP_ID=
NUTRITIONIX_API_KEY=

# Open Food Facts - No key required (public API)
```

---

### 11. Key Differentiators from Generic Calorie Trackers

1. **Training-Aware**: Macros adjust automatically based on tomorrow's workout
2. **Phase-Aligned**: Nutrition periodization matches running plan phases
3. **Performance-Linked**: AI correlates nutrition with run performance data
4. **Race-Focused**: Specific protocols for taper and race week
5. **Holistic View**: Single AI assistant understands running + strength + nutrition
6. **Endurance-Specific**: Sodium, hydration, and carb-loading built in

---

## Questions to Resolve

1. **Meal Timing**: Should we track specific times or just meal slots?
2. **Recipe Support**: Build full recipe database or just individual foods?
3. **Supplement Tracking**: Include vitamins, creatine, caffeine, etc.?
4. **Body Metrics**: Track weight, body fat %, etc. in this module?
5. **Social Features**: Meal sharing, community recipes?

---

_Last Updated: November 2024_
_Status: Planning / Pre-Development_
