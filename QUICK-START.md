# 🚀 QUICK START - Memex Racing Serverless

## 🎮 Easiest Way to Start (One Command!)

### Mac/Linux:
```bash
./start-game.sh
```

### Windows:
```cmd
start-game.bat
```

That's it! The script will:
1. ✅ Check your setup
2. 📦 Install everything needed
3. 🚀 Deploy your game online
4. 🌐 Give you a URL to play

## 🔑 First Time Only Setup (5 minutes)

### 1. Get Ably API Key (2 minutes)
- Go to [ably.com](https://ably.com)
- Sign up (free)
- Create new app
- Copy API key

### 2. Create JWT Secret (10 seconds)
```bash
# Mac/Linux
openssl rand -base64 32

# Windows (PowerShell)
[System.Web.Security.Membership]::GeneratePassword(32,10)
```

### 3. Add to .env file
```
ABLY_API_KEY=your_ably_key_here
JWT_SECRET=your_generated_secret_here
```

### 4. Run the start script again!

## 🎯 After Deployment

Your game will be live at a URL like:
```
https://memex-racing-abc123.vercel.app
```

Share this with friends to play together!

## 📱 Playing the Game

1. **Visit the URL** - Works on any device
2. **Create Account** - Quick registration
3. **Join/Create Room** - Up to 6 players
4. **Start Racing** - Real-time multiplayer!

## 🆚 Comparison

| Starting Method | Time | Multiplayer | Setup |
|----------------|------|-------------|--------|
| claudeweb | 0 sec | ❌ No | None |
| This Script | 5 min | ✅ Yes | Once |

## ❓ Common Questions

**Q: Do I need to keep my computer on?**
A: No! Once deployed, the game runs on Vercel's servers.

**Q: How many players can play?**
A: Unlimited! Vercel scales automatically.

**Q: Is it free?**
A: Yes! Free tier supports thousands of players.

**Q: Can I update the game?**
A: Yes! Just run the script and choose "Deploy new version"

## 🐛 Troubleshooting

**"Command not found"**
- Install Node.js from [nodejs.org](https://nodejs.org)

**"Ably key invalid"**
- Check your .env file
- Make sure key is copied correctly

**"Build failed"**
- Run `npm install` first
- Check for error messages

---

🎮 **Ready to play? Run the start script!** 🚀