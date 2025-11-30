# ⚡ Quick Start Guide

Get your Cadence running tracker up and running in 10 minutes!

## 🎯 What You'll Need

1. A Supabase account (free) - [Sign up here](https://supabase.com)
2. Your Strava credentials (you already have these!)
3. Optional: OpenAI API key for AI features

## 🚀 5-Minute Local Setup

### Step 1: Set Up Supabase (3 minutes)

1. Go to [supabase.com](https://supabase.com) and create a new project
2. Wait for it to initialize (~2 minutes)
3. Go to SQL Editor → New Query
4. Copy and paste the entire `supabase-schema.sql` file
5. Click "Run"
6. Go to Settings → API and copy:
   - Project URL
   - anon public key
   - service_role key

### Step 2: Configure Environment (1 minute)

1. Open `.env.local` in the `cadence-app` folder
2. Replace the placeholder values:
   ```env
   NEXT_PUBLIC_SUPABASE_URL=your-actual-url-here
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your-actual-anon-key-here
   SUPABASE_SERVICE_ROLE_KEY=your-actual-service-key-here
   ```
3. Save the file

### Step 3: Start the App (1 minute)

```bash
cd cadence-app
npm install  # First time only
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

### Step 4: Create Your Account

1. Click "Sign Up"
2. Enter your email and password
3. Check your email and click the confirmation link
4. Log in!

### Step 5: Import Your Training Data

1. In Supabase, go to Authentication → Users
2. Copy your User ID
3. Open `scripts/import-training-data.ts`
4. The script will automatically use your authenticated user
5. Run:
   ```bash
   npx tsx scripts/import-training-data.ts
   ```
6. Refresh the dashboard - your training plan is loaded! 🎉

## 🎨 What You'll See

### Dashboard
- Monthly mileage chart (planned vs actual)
- Personal bests and targets
- Performance predictions
- AI training assistant

### Runs Page
- All your training runs in beautiful cards
- Color-coded by run type
- Filter by week or completion status
- Log runs with actual data

## 🔗 Optional: Connect Strava

1. Update your Strava app settings at [strava.com/settings/api](https://www.strava.com/settings/api)
2. Set Authorization Callback Domain to `localhost:3000`
3. In the app, you'll need to add a "Connect Strava" button (or use the API directly)

## 🤖 Optional: Enable AI Features

1. Get an OpenAI API key from [platform.openai.com](https://platform.openai.com)
2. Add it to `.env.local`:
   ```env
   OPENAI_API_KEY=sk-your-key-here
   ```
3. Restart the dev server
4. Try the AI assistant on the dashboard!

## 📱 Mobile Testing

The app is fully responsive! Open it on your phone:
1. Find your local IP: `ipconfig getifaddr en0` (Mac) or `ipconfig` (Windows)
2. Update `.env.local`:
   ```env
   NEXT_PUBLIC_APP_URL=http://YOUR-IP:3000
   ```
3. On your phone, visit `http://YOUR-IP:3000`

## 🚀 Ready to Deploy?

See [DEPLOYMENT-CHECKLIST.md](./DEPLOYMENT-CHECKLIST.md) for complete deployment instructions to Vercel.

## 🎯 Your First Week

1. **Day 1**: Set up the app and import your training data
2. **Day 2**: Log your first run manually
3. **Day 3**: Connect Strava for automatic sync
4. **Day 4**: Add your personal bests and targets
5. **Day 5**: Try the AI assistant for training insights
6. **Day 6**: Deploy to Vercel for access anywhere
7. **Day 7**: Add to your phone's home screen

## 💡 Pro Tips

- **Dark Mode**: Your system preference is automatically detected
- **Keyboard Shortcuts**: Tab through forms for quick logging
- **Mobile**: Add to home screen for app-like experience
- **AI Queries**: Ask specific questions like "Should I increase my mileage?" or "Predict my half marathon time"

## 🆘 Having Issues?

### App won't start
```bash
rm -rf node_modules .next
npm install
npm run dev
```

### Database connection error
- Double-check your Supabase URL and keys in `.env.local`
- Make sure you ran the schema SQL

### Can't log in
- Check Supabase → Authentication → Providers
- Make sure Email provider is enabled

### Data not showing
- Make sure you ran the import script
- Check Supabase → Table Editor to verify data exists

## 🎉 You're All Set!

Your personal running tracker is ready. Time to crush those goals! 🏃‍♂️💨

**Next Steps:**
- Customize your training plan
- Set your race goals
- Start tracking consistently
- Use AI insights to improve

Happy running! 🎯

