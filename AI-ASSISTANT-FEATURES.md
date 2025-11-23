# 🤖 Cadence AI Assistant - Complete Feature Guide

## Overview

The Cadence AI Assistant is a world-class training intelligence system that goes far beyond simple Q&A. It combines proven sports science methodology with real-time data analysis to provide personalized coaching, proactive insights, and injury prevention.

---

## 🎯 Core Capabilities

### 1. **Personalized Context Awareness**

The AI has complete access to your training profile:

**Profile Data:**
- Age, gender, weight, height
- Running experience level (beginner/intermediate/advanced/elite)
- Training goals and weekly mileage targets
- Max heart rate and resting heart rate
- Custom HR zone thresholds (Zones 1-5)

**Training History:**
- Last 30 days of completed runs
- Personal bests for all distances
- Top 3 performances for each distance
- Upcoming scheduled runs
- AI memories of your goals, injuries, and preferences

---

### 2. **Training Load Analytics (CTL/ATL/TSB)**

Based on proven sports science methodology used by elite coaches:

**Chronic Training Load (CTL)** - *Fitness*
- 42-day exponentially weighted average
- Represents long-term fitness built over 6 weeks
- Higher CTL = better endurance base

**Acute Training Load (ATL)** - *Fatigue*
- 7-day exponentially weighted average
- Represents short-term fatigue from recent training
- Higher ATL = more accumulated fatigue

**Training Stress Balance (TSB)** - *Form*
- TSB = CTL - ATL
- Indicates race readiness and recovery status

**TSB Interpretation:**
- **TSB > 25**: Very fresh, possibly losing fitness
- **TSB 10-25**: Fresh, perfect for racing 🏁
- **TSB -10 to 10**: Neutral, normal training state
- **TSB -30 to -10**: Fatigued, building fitness
- **TSB < -30**: Very fatigued, overtraining risk ⚠️

**Training Stress Score (TSS):**
- Calculated per workout using RPE, distance, and heart rate
- Combines multiple methods for accuracy
- Tracks training load over time

---

### 3. **Proactive Insights System** 🔍

The AI automatically analyzes your training and generates actionable insights:

**Overtraining Detection:**
- Monitors TSB for dangerous fatigue levels
- Alerts when TSB < -30 (high risk)
- Warns when TSB < -20 (elevated fatigue)
- Recommends specific recovery actions

**High RPE Streak Warnings:**
- Detects 3+ consecutive runs with RPE ≥ 8
- Prevents burnout and injury
- Suggests easy recovery runs
- Enforces hard-easy training principle

**Sudden Mileage Increase Alerts:**
- Monitors weekly mileage changes
- Flags increases > 20% (violates 10% rule)
- Calculates exact percentage increase
- Recommends gradual progression

**Performance Celebrations:**
- Detects new personal bests
- Celebrates achievements
- Suggests recovery to consolidate gains

**Training Consistency Monitoring:**
- Tracks run frequency
- Alerts if < 4 runs in 14 days
- Encourages consistency for improvement

**Peak Form Detection:**
- Identifies optimal racing conditions
- TSB 10-25 with high CTL
- Recommends race timing

---

### 4. **Heart Rate Zone Analysis**

**Zone Distribution:**
- Calculates % time in each zone (Z1-Z5)
- Analyzes training intensity balance
- Recommends 80/20 distribution (80% easy, 20% hard)

**Zone-Specific Advice:**
- Too much Zone 4/5: Risk of overtraining
- Too much Zone 1/2: May need more intensity
- Balanced distribution: Optimal training

**Custom Zones:**
- Uses YOUR actual HR zones from profile
- Not generic percentages
- Accurate zone-based recommendations

---

### 5. **Strava Metrics Integration**

Every run includes rich Strava data:

- **Suffer Score**: Strava's intensity metric (0-10)
- **Elevation Gain**: Total climbing in meters
- **Cadence**: Steps per minute
- **Calories**: Energy expenditure
- **PRs**: Personal records achieved
- **Achievements**: Strava achievements earned
- **Kudos**: Social engagement

The AI uses these metrics for deeper analysis and motivation.

---

### 6. **Enhanced Error Handling**

**Retry Logic:**
- Exponential backoff (3 attempts)
- Automatic retry on network errors
- Smart error categorization

**Fallback Responses:**
- Provides general advice if OpenAI unavailable
- Graceful degradation
- Never leaves you without guidance

**Error Types:**
- Rate limit detection
- Network timeout handling
- Service unavailability
- Quota exceeded alerts

---

## 💬 Example Conversations

### Overtraining Detection
**You:** "I'm feeling really tired lately"

**AI:** "🚨 I've detected a high overtraining risk. Your Training Stress Balance is -32.5, indicating very high fatigue levels. You've been training hard without adequate recovery.

💡 Recommendation: Take 2-3 easy days or a complete rest day. Reduce training volume by 30-40% this week. Focus on sleep, nutrition, and hydration.

Looking at your recent runs, you've completed 3 consecutive runs with RPE ≥ 8. This pattern increases injury risk. Let's schedule some easy recovery runs (RPE 4-6) before your next hard workout."

---

### Zone-Based Training
**You:** "How should I structure my training this week?"

**AI:** "Based on your HR zone distribution, you're spending 65% of your time in Zone 2 (Aerobic) and 25% in Zone 4 (Threshold). This is close to the ideal 80/20 distribution, but you're doing slightly too much hard work.

Your TSB is -15, showing you're building fitness but accumulating fatigue. Here's my recommendation:

**This Week:**
- 3 easy runs in Zone 2 (≤133 bpm)
- 1 tempo run in Zone 3 (134-152 bpm)
- 1 rest day
- 1 long run in Zone 2

This will help you recover while maintaining fitness. Your CTL is 58.3, which is solid - let's consolidate these gains before pushing harder."

---

### Performance Celebration
**You:** "Just finished my run!"

**AI:** "🎉 Congratulations! You set a new personal best! You achieved 1 PR in the last 2 weeks. Your training is paying off!

💡 Great work! Consider a recovery week to consolidate these gains before pushing for more improvements. Your TSB is currently 8.2, which means you're in good form. This is an excellent time for quality workouts or races."

---

## 🎓 Training Science Behind the AI

### TSS Calculation
Uses three methods and averages them:
1. **RPE-based**: Duration (hours) × RPE × 10
2. **Distance-based**: Distance × intensity factor × 10
3. **HR-based**: Duration × (Avg HR / Max HR) × 100

### CTL/ATL Formulas
- **CTL**: 42-day exponentially weighted moving average of TSS
- **ATL**: 7-day exponentially weighted moving average of TSS
- **Exponential weighting**: Recent days have more influence

### Training Principles Enforced
- **10% Rule**: Weekly mileage increases ≤ 10%
- **Hard-Easy Principle**: No 3+ consecutive hard runs
- **80/20 Rule**: 80% easy (Z1-Z2), 20% hard (Z3-Z5)
- **Recovery Timing**: TSB-based rest recommendations

---

## 🚀 How to Get the Most from Your AI Coach

1. **Fill in your profile completely**
   - Age, weight, gender for accurate calculations
   - Max HR and custom zones for zone analysis
   - Training goals for personalized advice

2. **Log your RPE consistently**
   - RPE is crucial for TSS calculation
   - Be honest about effort level
   - Use 1-10 scale consistently

3. **Sync Strava activities**
   - Provides rich data for analysis
   - Enables HR zone tracking
   - Unlocks suffer score insights

4. **Ask specific questions**
   - "Should I run today or rest?"
   - "Am I training too hard?"
   - "When should I race?"
   - "How's my training balance?"

5. **Review proactive insights**
   - AI generates insights automatically
   - Prioritized by importance
   - Act on high-priority warnings

---

## 📊 What Makes This AI Special

✅ **Proactive, not reactive** - Warns you before problems occur
✅ **Science-based** - Uses proven CTL/ATL/TSB methodology
✅ **Personalized** - Knows your profile, goals, and history
✅ **Context-aware** - Remembers your injuries, preferences, goals
✅ **Comprehensive** - Analyzes training load, zones, consistency
✅ **Actionable** - Provides specific, prioritized recommendations
✅ **Reliable** - Handles errors gracefully with fallbacks

---

This is not just a chatbot - it's your personal running coach, available 24/7, with perfect memory and deep analytical capabilities. 🏃‍♂️💨

