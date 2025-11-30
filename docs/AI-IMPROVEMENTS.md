# AI Assistant Improvements Roadmap

## Current Features ✅

### Core Capabilities
- **Personalized Context Awareness**: Access to recent runs, personal bests, best performances, upcoming runs, and training statistics
- **Memory System**: Supabase-backed memory for goals, injuries, preferences, and race plans with importance weighting
- **VDOT-Based Race Predictions**: Scientific predictions for 5K, 10K, Half Marathon, Marathon using Jack Daniels' formula
- **Streaming Responses**: Real-time streaming with markdown formatting support
- **Conversational Interface**: Context-aware, encouraging, personalized advice

## Limitations & Improvement Opportunities

### 1. No Access to Granular Activity Data ⚠️
**Current State**: Database has `activity_streams` table but AI doesn't access it

**Missing Capabilities**:
- Per-meter/per-second heart rate, pace, cadence analysis
- Heart rate zone distribution analysis
- Pace variability within runs
- Cadence pattern analysis
- Elevation/grade impact on performance

**Improvement**: Add activity streams to AI context builder
```typescript
// Add to context-builder.ts
const { data: activityStreams } = await supabase
  .from('activity_streams')
  .select('*')
  .eq('user_id', userId)
  .in('run_id', recentRunIds)
```

### 2. Simple Memory Extraction ⚠️
**Current State**: Basic keyword matching ("goal", "injury", "prefer", "race")

**Limitations**:
- No semantic understanding
- May miss nuanced information
- No automatic memory consolidation
- No memory cleanup

**Improvement**: Implement semantic memory with embeddings
- Use OpenAI embeddings for similarity search
- Consolidate duplicate/similar memories
- Implement memory decay based on age and access frequency
- Add memory categories: technique, nutrition, equipment, mental

### 3. Limited Training Plan Integration ⚠️
**Current State**: AI sees upcoming runs but no deep integration

**Missing**:
- Cannot modify or suggest training plan changes
- No periodization awareness
- No understanding of training phases (base, build, peak, taper)

**Improvement**: Add training plan context and modification capabilities
- Include current training phase in context
- Allow AI to suggest workout modifications
- Implement progressive overload tracking

### 4. No Proactive Insights ⚠️
**Current State**: Reactive only - responds to questions

**Missing Alerts**:
- Overtraining risk (high RPE trends, low HRV)
- Recovery needs based on training load
- Performance improvements detection
- Injury risk patterns (sudden mileage increases, high RPE streaks)

**Improvement**: Background job for proactive analysis
- Daily/weekly analysis of training data
- Generate insights and store in notifications table
- Alert user to important patterns

### 6. Token Limit Constraints ⚠️
**Current State**: Max 1000 tokens per response

**Impact**: May truncate detailed responses

**Improvement**: Increase to 2000-4000 tokens for complex queries

### 7. No Strava Webhook Data Integration ⚠️
**Current State**: Webhooks configured but AI doesn't access detailed metrics

**Missing**:
- Real-time activity updates
- Suffer score, relative effort
- Segment performances
- Social data (kudos, comments)

**Improvement**: Include Strava-specific metrics in context

### 8. No Historical Trend Analysis ⚠️
**Missing**:
- Performance trends over time
- Training load progression (CTL, ATL, TSB)
- Fitness/fatigue curves
- Long-term pattern recognition

**Improvement**: Calculate and include fitness metrics
- Chronic Training Load (CTL) - 42-day rolling average
- Acute Training Load (ATL) - 7-day rolling average
- Training Stress Balance (TSB) = CTL - ATL
- Form indicator based on TSB

### 9. Limited Error Handling ⚠️
**Current State**: Basic error messages, no retry logic

**Improvement**:
- Implement exponential backoff retry
- Fallback responses if OpenAI unavailable
- Better error categorization and user messaging

### 10. No User Profile Data ⚠️
**Missing**:
- Age, weight, gender (for accurate VDOT)
- Running experience level
- Training preferences
- Time availability
- **Heart rate zones** (critical for zone analysis)

**Improvement**: Add user profile table and include in context
- Demographics for better predictions
- HR zones for accurate zone analysis
- Training history and experience level

## Priority Improvements

### High Priority 🔴
1. **Add user profile data** (HR zones, weight, age) - Required for accurate analysis
2. **Access granular activity data** - Unlock detailed performance insights
3. **Implement proactive insights** - Add real value beyond Q&A

### Medium Priority 🟡
4. **Historical trend analysis** - CTL/ATL/TSB calculations
5. **Semantic memory system** - Better context retention
6. **Increase token limit** - More detailed responses

### Low Priority 🟢
7. **Multi-modal analysis** - Weather, terrain integration
8. **Training plan modifications** - AI-suggested adjustments
9. **Strava social data** - Kudos, segment analysis

## Implementation Notes

- Start with user profile (needed for HR zones fix)
- Then add activity streams to context
- Implement trend calculations as utility functions
- Consider cost implications of embeddings for semantic memory
- Test token limit increases to ensure response quality

