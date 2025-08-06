# 🚀 Memex Racing - Serverless Deployment

This guide explains how to deploy Memex Racing to serverless platforms with automatic scaling and WebSocket support.

## 🎯 Why Serverless?

The original `claudeweb` file works great locally because it's a single HTML file. However, for multiplayer support, we need:
- Real-time WebSocket connections
- Player authentication
- Game state synchronization
- Automatic scaling for many players

Our serverless solution provides all of this without managing servers!

## 🛠️ Quick Start

### 1. Initial Setup
```bash
# Install dependencies
npm install

# Run setup script
npm run deploy:setup
```

### 2. Configure Ably (for WebSockets)
1. Sign up at [ably.com](https://ably.com)
2. Create a new app
3. Copy your API key
4. Add to `.env` file:
```
ABLY_API_KEY=your_ably_api_key_here
```

### 3. Configure JWT Secret
Generate a secure secret:
```bash
openssl rand -base64 32
```

Add to `.env`:
```
JWT_SECRET=your_generated_secret_here
```

### 4. Deploy to Vercel
```bash
# First deployment
npm run deploy:vercel

# Production deployment
npm run deploy:vercel:prod
```

## 📁 Architecture

### Traditional Setup (Complex)
```
claudeweb (single file) → Requires:
  - Node.js server running
  - Socket.io server
  - Database server
  - Manual scaling
  - Server maintenance
```

### Serverless Setup (Simple)
```
Vercel Edge Functions → Provides:
  - Automatic deployment
  - Global CDN
  - Auto-scaling
  - No server management
  - Pay per use
```

## 🎮 How It Works

1. **Frontend**: Static files served from CDN
2. **API**: Edge functions handle game logic
3. **WebSockets**: Ably provides real-time communication
4. **Auth**: JWT tokens for secure player sessions
5. **State**: Distributed across edge locations

## 🌍 Global Deployment

Your game automatically deploys to:
- 🇺🇸 North America
- 🇪🇺 Europe  
- 🇯🇵 Asia Pacific
- 🇦🇺 Australia
- And more...

Players connect to the nearest server automatically!

## 💰 Cost Comparison

### Traditional Server
- Fixed monthly cost: $20-100/month
- Scales poorly with traffic spikes
- Requires maintenance

### Serverless
- Free tier: 100k requests/month
- Pay only for usage
- Automatic scaling
- No maintenance

## 🔧 Environment Variables

Set these in Vercel dashboard:

| Variable | Description | Required |
|----------|-------------|----------|
| `ABLY_API_KEY` | Ably API key for WebSockets | ✅ |
| `JWT_SECRET` | Secret for auth tokens (32+ chars) | ✅ |
| `NODE_ENV` | Set to `production` | ✅ |

## 📊 Monitoring

### Vercel Dashboard
- Real-time function logs
- Performance metrics
- Error tracking
- Usage analytics

### Ably Dashboard
- WebSocket connections
- Message throughput
- Channel analytics
- Connection debugging

## 🐛 Troubleshooting

### "Cannot connect to game"
1. Check Ably API key is valid
2. Verify environment variables in Vercel
3. Check browser console for errors

### "Build failed"
1. Run `npm run build:serverless` locally
2. Check for missing dependencies
3. Review Vercel build logs

### "Slow performance"
1. Check function execution time
2. Review Ably connection latency
3. Enable caching if needed

## 🚀 Advanced Features

### Custom Domain
1. Add domain in Vercel settings
2. Update DNS records
3. SSL automatically configured

### Edge Middleware
- Add rate limiting
- Implement geo-blocking
- Custom authentication

### Analytics
- Integrate Google Analytics
- Add custom events
- Track player behavior

## 📚 Resources

- [Vercel Documentation](https://vercel.com/docs)
- [Ably Documentation](https://ably.com/docs)
- [Edge Functions Guide](https://vercel.com/docs/functions)
- [WebSocket Best Practices](https://ably.com/topic/websockets)

## 🤝 Support

Having issues? Check:
1. Browser console for errors
2. Vercel function logs
3. Ably connection status
4. Network tab in DevTools

---

Ready to go serverless? Run `npm run deploy:vercel` and your game will be live in minutes! 🎮✨