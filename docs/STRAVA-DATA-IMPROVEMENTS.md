# Strava Data & Visualization Improvements

## Issues to Address

### 1. Heart Rate Zones Miscalculation
**Problem**: HR zones are incorrectly calculated - Strava shows Zone 2 but our app shows Zone 4.

**Root Cause**: Missing user HR zone configuration in the app. We don't have the user's actual HR zone thresholds stored.

**Solution Needed**:
- Add HR zone configuration to user profile
- Store user's HR zone thresholds (Zone 1-5 boundaries)
- Recalculate zone distribution based on user's actual zones, not generic percentages

---

### 2. Pace Graph Visualization Issues

**Problem**: Pace graphs need visual improvements for better readability.

**Required Changes**:

#### i. Invert Pace Axis
- **Current**: Slower pace at top, faster at bottom
- **Needed**: Faster pace at top (higher on graph), slower at bottom (lower on graph)
- This matches intuitive understanding: "higher = better performance"

#### ii. Auto-Zoom to Data Range
- **Current**: Large white space above/below actual data points
- **Needed**: Zoom graph to fit actual pace range achieved in the run
- Set Y-axis min/max to the slowest and fastest pace in the dataset
- Add small padding (e.g., 5-10%) for visual breathing room
- Eliminates wasted white space

---

### 3. Profile Screen Enhancement

**Problem**: Profile screen is underdeveloped and missing critical user data.

**Data to Add**:
- ✅ Heart Rate Zones (Zone 1-5 thresholds in BPM)
- ✅ Weight (kg or lbs)
- ✅ Height (cm or inches)
- ✅ Age
- ✅ Gender
- ✅ Max Heart Rate
- ✅ Resting Heart Rate
- ✅ Running experience level
- ✅ Preferred units (metric/imperial)
- ✅ Training goals
- ✅ Injury history

**Use Cases**:
- More accurate VDOT calculations (age, weight, gender)
- Proper HR zone analysis
- Better AI context for personalized coaching
- Calorie burn estimates
- Training load calculations

**Database Schema Needed**:
- Check if `profiles` table has these fields
- Add missing columns or create new tables as needed
- Provide SQL migration script

---

## Implementation Priority

1. **High Priority**: HR zones configuration (blocking accurate analysis)
2. **High Priority**: Pace graph inversion (UX improvement)
3. **Medium Priority**: Graph auto-zoom (visual polish)
4. **Medium Priority**: Profile data expansion (AI enhancement)

---

## Notes

- All graph improvements should apply to:
  - Pace over distance
  - Heart rate over distance
  - Cadence over distance
  - Elevation profile
- Consider adding user preferences for graph display options
- Ensure mobile responsiveness for all graphs

