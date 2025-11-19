# 🏃‍♂️ Cadence - Personal Running Training Tracker

A modern, full-stack web application for tracking running training with AI-powered insights, Strava integration, and comprehensive analytics.

![Next.js](https://img.shields.io/badge/Next.js-15-black)
![TypeScript](https://img.shields.io/badge/TypeScript-5-blue)
![Tailwind CSS](https://img.shields.io/badge/Tailwind-3-38bdf8)
![Supabase](https://img.shields.io/badge/Supabase-PostgreSQL-3ecf8e)

## ✨ Features

### 📊 Dashboard
- **Monthly Mileage Charts** - Visualize planned vs actual training volume
- **Personal Bests Tracking** - Track current PBs and set target goals
- **Performance Predictions** - AI-powered race time predictions using Riegel formula
- **Weekly Suffer Score** - Strava integration for training load monitoring
- **AI Training Assistant** - Get personalized insights and recommendations

### 🏃 Training Management
- **Run Tracking** - Log and track all training runs with detailed metrics
- **Smart Run Cards** - Beautiful, color-coded cards for different run types
- **Pace Targets** - Set and track target paces for each session
- **Notes & Comments** - Add detailed notes and post-run reflections
- **Week-by-Week View** - Filter runs by week and completion status

### 🔗 Strava Integration
- **Automatic Sync** - Webhook-based automatic activity import
- **Activity Matching** - Auto-match Strava activities to planned runs
- **Suffer Score** - Import and track Strava's relative effort metric
- **Heart Rate Data** - Track HR zones and cardiovascular metrics

### 🤖 AI-Powered Insights
- **Training Analysis** - Get insights on training load and progression
- **Race Predictions** - Predict finish times for 5K, 10K, Half, and Full marathons
- **Workout Suggestions** - AI-generated workout recommendations
- **Recovery Advice** - Personalized recovery and injury prevention tips
- **Performance Trends** - Analyze your progress over time

### 📱 Responsive Design
- **Mobile-First** - Fully responsive design works on all devices
- **Dark Mode** - Beautiful dark mode support
- **PWA-Ready** - Add to home screen for app-like experience
- **Fast & Modern** - Built with Next.js 15 and React Server Components

## 🛠️ Tech Stack

### Frontend
- **Next.js 15** - React framework with App Router
- **TypeScript** - Type-safe development
- **Tailwind CSS** - Utility-first styling
- **Recharts** - Beautiful, responsive charts
- **Lucide Icons** - Modern icon library

### Backend
- **Vercel Functions** - Serverless API routes
- **Supabase** - PostgreSQL database with real-time capabilities
- **Row Level Security** - Secure, user-scoped data access

### Integrations
- **Strava API** - Activity sync and webhook integration
- **OpenAI GPT-4** - AI-powered training insights
- **Supabase Auth** - Secure authentication

## 🚀 Quick Start

See [SETUP.md](./SETUP.md) for complete deployment instructions.

### Local Development

1. **Clone and install**
```bash
cd cadence-app
npm install
```

2. **Set up environment variables**
```bash
cp .env.local.example .env.local
# Edit .env.local with your credentials
```

3. **Run development server**
```bash
npm run dev
```

4. **Import training data**
```bash
npx tsx scripts/import-training-data.ts
```

## 📁 Project Structure

```
cadence-app/
├── app/                      # Next.js App Router
│   ├── api/                  # API routes (Vercel Functions)
│   │   ├── ai/              # AI agent endpoints
│   │   └── strava/          # Strava integration
│   ├── dashboard/           # Dashboard page
│   ├── runs/                # Runs tracking page
│   ├── strength/            # Strength training page
│   ├── nutrition/           # Nutrition tracking page
│   └── login/               # Authentication page
├── components/              # React components
│   ├── dashboard/           # Dashboard components
│   ├── runs/                # Run tracking components
│   └── layout/              # Layout components
├── lib/                     # Utilities and types
│   ├── supabase/           # Supabase client setup
│   └── types/              # TypeScript types
├── scripts/                 # Utility scripts
│   └── import-training-data.ts
└── supabase-schema.sql     # Database schema
```

## 🎯 Training Plan Structure

The app supports a 12-week half marathon training plan with:
- **4 runs per week** - Easy, Tempo, Quality, Long runs
- **Progressive overload** - Gradual distance and intensity increases
- **Periodization** - Base building, performance, peak, and taper phases
- **Variety** - Fartlek, intervals, tempo, and long runs

## 🔐 Security

- **Row Level Security (RLS)** - Users can only access their own data
- **Secure Authentication** - Supabase Auth with email/password
- **API Key Protection** - Service keys stored securely in environment variables
- **HTTPS Only** - All production traffic encrypted

## 💰 Cost Breakdown

- **Hosting (Vercel)**: Free
- **Database (Supabase)**: Free (up to 500MB)
- **AI (OpenAI)**: ~$0.01-0.10 per query
- **Total**: Essentially free!

## 🎨 Customization

The app is designed to be easily customizable:
- Modify training plan structure in database
- Add custom run types and sessions
- Extend AI prompts for different insights
- Add more chart types and analytics
- Customize styling with Tailwind

## 📈 Future Enhancements

- [ ] Strength training tracking (UI ready)
- [ ] Nutrition logging (UI ready)
- [ ] Race day countdown
- [ ] Training plan templates
- [ ] Social features (share runs)
- [ ] Mobile app (React Native)
- [ ] Garmin/Apple Watch integration
- [ ] Advanced analytics dashboard

## 📝 License

MIT License - feel free to use this for your own training!

---

**Happy Running! 🏃‍♂️💨**
