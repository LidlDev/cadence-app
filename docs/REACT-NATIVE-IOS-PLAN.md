# 📱 Cadence iOS App - React Native Development Plan

## 🎯 Executive Summary

This document outlines the strategy for creating a native iOS app for Cadence using **Expo** with React Native. The approach maximizes code reuse from the existing Next.js web app while enabling native iOS capabilities like push notifications, camera integration, and HealthKit sync.

---

## 🏗️ Recommended Technology Stack

### Core Framework
| Technology | Purpose | Why |
|------------|---------|-----|
| **Expo SDK 52+** | React Native framework | Managed workflow, OTA updates, easy native module integration |
| **Expo Router** | File-based navigation | Mirrors Next.js App Router patterns - easy migration |
| **TypeScript** | Type safety | Already used in web app, shared types |

### Native Capabilities
| Feature | Library | Purpose |
|---------|---------|---------|
| **Push Notifications** | expo-notifications | Training reminders, Strava sync alerts |
| **Camera** | expo-camera | Run photo uploads, coach image feedback |
| **Image Picker** | expo-image-picker | Gallery selection for run memories |
| **HealthKit** | expo-apple-health-kit | Native step/run sync, heart rate data |
| **Haptics** | expo-haptics | Tactile feedback on achievements |
| **Secure Storage** | expo-secure-store | Auth token storage |

### Shared Infrastructure (Already Have ✅)
- **Supabase** - Database, Auth, Edge Functions
- **Strava API** - Activity sync (same OAuth flow)
- **OpenAI** - AI coaching chat

---

## 📁 Proposed Project Structure

```
cadence/
├── cadence-app/              # Existing Next.js web app
│   └── ...
├── cadence-mobile/           # New Expo React Native app
│   ├── app/                  # Expo Router (mirrors web structure)
│   │   ├── (tabs)/
│   │   │   ├── dashboard.tsx
│   │   │   ├── runs.tsx
│   │   │   ├── strength.tsx
│   │   │   ├── nutrition.tsx
│   │   │   └── profile.tsx
│   │   ├── login.tsx
│   │   ├── run/[id].tsx
│   │   └── _layout.tsx
│   ├── components/           # Mobile-optimized components
│   │   ├── runs/
│   │   ├── dashboard/
│   │   └── ui/
│   ├── lib/                  # Shared utilities
│   │   ├── supabase.ts       # Supabase client (mobile)
│   │   ├── strava.ts         # Strava auth (deep linking)
│   │   └── types/            # Shared from web app
│   └── app.config.ts         # Expo configuration
└── shared/                   # Shared code between web & mobile
    ├── types/                # TypeScript interfaces
    ├── utils/                # Pure utility functions
    └── constants/            # Colors, config values
```

---

## 🔄 Code Reuse Strategy

### What Can Be Shared (~40% of codebase)
| Category | Files | Notes |
|----------|-------|-------|
| **TypeScript Types** | `lib/types/database.ts` | 100% reusable |
| **Utility Functions** | `lib/utils/*.ts` | Pure functions, no DOM |
| **AI Logic** | `lib/ai/*.ts` | Context builders, analyzers |
| **API Calls** | Business logic | Refactor to shared functions |
| **Supabase Queries** | All database queries | Same Supabase client |

### What Needs Mobile-Specific Rewrites (~60%)
| Category | Web | Mobile Alternative |
|----------|-----|-------------------|
| **Navigation** | Next.js App Router | Expo Router |
| **Styling** | Tailwind CSS | NativeWind or StyleSheet |
| **Storage** | Cookies | expo-secure-store |
| **Charts** | Recharts | react-native-chart-kit / Victory |
| **Routing** | next/router | expo-router |
| **Date Picker** | HTML inputs | @react-native-community/datetimepicker |

---

## 📱 Native iOS Features to Implement

### Phase 1: Core Notifications
```typescript
// Training reminders
- Daily run reminders based on training plan
- Strava sync completion alerts  
- Weekly summary notifications
- PB achievement celebrations
```

### Phase 2: Camera & Image Upload
```typescript
// Run coaching feature
- Photo upload for form analysis
- Post-run photo memories
- Progress photo comparisons
- AI-powered running form feedback
```

### Phase 3: HealthKit Integration
```typescript
// Native health data
- Auto-sync runs from Apple Watch
- Heart rate zone data
- Recovery metrics
- Sleep tracking for recovery insights
```

### Phase 4: Widget & Watch Support
```typescript
// Home screen widgets
- Next run preview widget
- Weekly mileage progress
- Apple Watch complication
```

---

## 🚀 Implementation Phases

### Phase 1: Foundation (Week 1-2)
- [ ] Initialize Expo project with TypeScript
- [ ] Set up Expo Router navigation structure
- [ ] Configure Supabase for mobile (expo-secure-store)
- [ ] Implement authentication flow (Supabase Auth)
- [ ] Create shared types package
- [ ] Set up NativeWind for Tailwind-like styling

### Phase 2: Core Screens (Week 3-4)
- [ ] Dashboard with mileage chart, PBs, predictions
- [ ] Runs list with calendar view
- [ ] Run detail screen with Strava data visualization
- [ ] Run logging with Strava sync
- [ ] AI Chat interface

### Phase 3: Native Features (Week 5-6)
- [ ] Push notifications setup
- [ ] Camera integration for run photos
- [ ] Image upload to Supabase storage
- [ ] HealthKit read permissions
- [ ] Deep linking for Strava OAuth

### Phase 4: Polish & Submit (Week 7-8)
- [ ] App Store assets (screenshots, icons)
- [ ] TestFlight beta testing
- [ ] Performance optimization
- [ ] App Store submission

---

## 🔐 Authentication Flow (Mobile)

```
┌─────────────────────────────────────────────────────────────┐
│                     Mobile Auth Flow                        │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  1. User opens app                                          │
│         │                                                   │
│         ▼                                                   │
│  2. Check expo-secure-store for session                     │
│         │                                                   │
│         ├── Session exists ──► Validate with Supabase       │
│         │                              │                    │
│         │                    ├── Valid ──► Dashboard        │
│         │                    └── Invalid ──► Login          │
│         │                                                   │
│         └── No session ──► Show Login Screen                │
│                                   │                         │
│                    ┌──────────────┼──────────────┐          │
│                    ▼              ▼              ▼          │
│               Email/Pass     Google SSO     Apple Sign-In   │
│                    │              │              │          │
│                    └──────────────┼──────────────┘          │
│                                   ▼                         │
│                    Store tokens in secure-store             │
│                                   │                         │
│                                   ▼                         │
│                              Dashboard                      │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

## 🎨 Design System (Mobile Adaptation)

### Color Palette (Same as Web)
```typescript
// Keep the existing brand colors
const colors = {
  primary: {
    600: '#FF6F00', // Primary action color
    // ... full scale from web
  },
  runTypes: {
    easy: '#0d9488',    // Teal
    tempo: '#d97706',   // Amber
    quality: '#dc2626', // Red
    long: '#2563eb',    // Blue
    fartlek: '#9333ea', // Purple
    interval: '#db2777', // Pink
    hill: '#059669',    // Emerald
  }
};
```

### NativeWind Configuration
```typescript
// tailwind.config.js for React Native
module.exports = {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}'],
  presets: [require('nativewind/preset')],
  theme: {
    extend: {
      colors: {
        primary: colors.primary,
        // ... same color system as web
      }
    }
  }
};
```

---

## 📦 Key Dependencies

```json
{
  "dependencies": {
    "expo": "~52.0.0",
    "expo-router": "~4.0.0",
    "expo-secure-store": "~14.0.0",
    "expo-notifications": "~0.29.0",
    "expo-camera": "~16.0.0",
    "expo-image-picker": "~16.0.0",
    "expo-haptics": "~14.0.0",
    "expo-linking": "~7.0.0",
    "@supabase/supabase-js": "^2.83.0",
    "nativewind": "^4.0.0",
    "react-native-chart-kit": "^6.12.0",
    "date-fns": "^4.1.0",
    "lucide-react-native": "^0.554.0"
  }
}
```

---

## 🔗 Strava Deep Linking

```typescript
// app.config.ts
export default {
  expo: {
    scheme: 'cadence',
    ios: {
      bundleIdentifier: 'com.cadence.app',
      associatedDomains: [
        'applinks:cadence.app', // Your domain
      ]
    }
  }
};

// Strava OAuth redirect
const stravaRedirectUri = 'cadence://strava/callback';
// This enables: Strava app → OAuth → Back to Cadence app
```

---

## 📊 Component Migration Examples

### Web RunCard → Mobile RunCard
```tsx
// Web (Tailwind CSS)
<div className="rounded-xl shadow-lg p-6 border-2 bg-easy-100">

// Mobile (NativeWind - almost identical!)
<View className="rounded-xl shadow-lg p-6 border-2 bg-easy-100">
```

### Charts Migration
```tsx
// Web (Recharts)
<AreaChart data={data}>
  <Area dataKey="actual" fill="#FF6F00" />
</AreaChart>

// Mobile (react-native-chart-kit)
<LineChart
  data={{ datasets: [{ data: actualData }] }}
  chartConfig={{ color: () => '#FF6F00' }}
/>
```

---

## 🧪 Testing Strategy

| Type | Tool | Coverage |
|------|------|----------|
| Unit Tests | Jest | Shared utilities, pure functions |
| Component Tests | React Native Testing Library | UI components |
| E2E Tests | Detox or Maestro | Critical user flows |
| Beta Testing | TestFlight | Real user feedback |

---

## 📈 Success Metrics

1. **Code Reuse**: Target 40%+ shared code with web
2. **Performance**: <2s cold start, 60fps animations
3. **Notifications**: >50% opt-in rate
4. **Store Rating**: Target 4.5+ stars
5. **DAU/MAU**: Track engagement vs web app

---

## 🚀 Getting Started Commands

```bash
# 1. Create the Expo project
npx create-expo-app cadence-mobile --template tabs

# 2. Install key dependencies
cd cadence-mobile
npx expo install expo-secure-store expo-notifications expo-camera
npx expo install @supabase/supabase-js nativewind tailwindcss

# 3. Configure NativeWind
npx tailwindcss init

# 4. Run on iOS Simulator
npx expo run:ios

# 5. Build for TestFlight
eas build --platform ios --profile preview
```

---

## ⚠️ Considerations

### Apple Developer Program
- **Required**: $99/year Apple Developer account
- **Needed for**: TestFlight, App Store submission, push notifications

### App Store Review
- Ensure Strava OAuth complies with Apple guidelines
- Health data access requires clear privacy descriptions
- Camera usage requires permission descriptions

### HealthKit
- Requires separate HealthKit capability in Apple Developer portal
- Must justify health data usage in App Store submission

---

## 📝 Next Steps

1. **Set up Apple Developer Account** (if not already)
2. **Create `cadence-mobile` Expo project**
3. **Copy shared types to shared package**
4. **Implement auth flow with expo-secure-store**
5. **Build Dashboard screen first** (highest value)
6. **Iterate on navigation patterns**

---

*Created: November 2025*
*Stack: Expo SDK 52 + React Native + Supabase + NativeWind*

