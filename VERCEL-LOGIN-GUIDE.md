# 🔐 Vercel Login Guide for diablodemon9966@gmail.com

## Step 1: Start Login Process

Open your terminal and run:
```bash
cd "/Volumes/MOVESPEED/Memex Racing game"
vercel login
```

## Step 2: Select Email Login

1. Use arrow keys to move down to **"Continue with Email"**
2. Press **Enter**

## Step 3: Enter Your Email

1. Type: `diablodemon9966@gmail.com`
2. Press **Enter**

## Step 4: Verify Your Email

1. Vercel will say: **"We sent an email to diablodemon9966@gmail.com"**
2. Check your Gmail inbox for an email from Vercel
3. Click the **"Verify"** button in the email
4. Return to your terminal - it should say **"Email confirmed"**

## Step 5: Deploy Your Game

Once logged in, run:
```bash
vercel --prod --yes
```

## What Happens During First Deployment:

Vercel will ask you several questions. Here are the answers:

1. **"Set up and deploy?"** → Press Enter (Yes)
2. **"Which scope?"** → Select your username
3. **"Link to existing project?"** → Type `N` (No)
4. **"Project name?"** → Press Enter (accept default: memex-racing-game)
5. **"Directory?"** → Press Enter (accept default: ./)
6. **"Override settings?"** → Type `N` (No)

## 🎮 After Deployment

You'll see something like:
```
🎊 Production: https://memex-racing-game-abc123.vercel.app [copied to clipboard]
```

That's your live game URL!

## 🔑 Add Environment Variables

1. Go to [vercel.com/dashboard](https://vercel.com/dashboard)
2. Click on your project "memex-racing-game"
3. Go to **Settings** → **Environment Variables**
4. Add these:
   
   **Variable 1:**
   - Name: `ABLY_API_KEY`
   - Value: (your Ably API key)
   - Environment: Production ✓
   
   **Variable 2:**
   - Name: `JWT_SECRET`
   - Value: `your-super-secret-jwt-key-minimum-32-characters-long`
   - Environment: Production ✓

5. Click **Save** for each

## 🔄 Redeploy with Secrets

After adding environment variables:
```bash
vercel --prod --yes --force
```

## ✅ Test Your Game

1. Visit your deployment URL
2. Create an account
3. Create a room
4. Share the room code with friends!

---

**Need help?** The deployment process is straightforward once you're logged in!