# Security Deployment Guide

## Quick Start - Security Setup

### 1. Install New Dependencies
```bash
npm install helmet@^7.1.0
npm install webpack-dev-server@^5.2.2
```

### 2. Environment Configuration

**Copy the updated environment template:**
```bash
cp .env.example .env
```

**Configure critical security settings in `.env`:**
```bash
# Generate a secure JWT secret
node -e "console.log('JWT_SECRET=' + require('crypto').randomBytes(32).toString('hex'))"

# Add the generated secret to your .env file
JWT_SECRET=your-generated-secret-here

# Configure allowed origins (CRITICAL for production)
ALLOWED_ORIGINS=http://localhost:3000,https://your-production-domain.com

# Set production mode
NODE_ENV=production
```

### 3. Start the Secure Server
```bash
# Development mode (with enhanced security)
npm run server:dev

# Production mode
npm run server
```

## Testing Security Fixes

### 1. Verify CORS Protection
```bash
# This should be BLOCKED
curl -H "Origin: https://malicious-site.com" http://localhost:3001/health
# Expected: CORS error

# This should WORK
curl -H "Origin: http://localhost:3000" http://localhost:3001/health
# Expected: {"status":"healthy",...}
```

### 2. Test Rate Limiting
```bash
# Test API rate limiting (should get 429 after 100 requests in 15 minutes)
for i in {1..150}; do 
  echo "Request $i: $(curl -s -o /dev/null -w "%{http_code}" http://localhost:3001/health)"
done
```

### 3. Verify Security Headers
```bash
curl -I http://localhost:3001/health
# Should see headers like:
# X-Frame-Options: DENY
# X-Content-Type-Options: nosniff
# Content-Security-Policy: ...
```

### 4. Test WebSocket Security
```javascript
// In browser console
const socket = io('http://localhost:3001', {
  auth: {
    token: 'your-jwt-token' // Optional
  }
});

socket.on('connect', () => {
  console.log('Connected with security checks passed');
});
```

## Production Deployment

### 1. Environment Setup
```bash
# Production .env configuration
NODE_ENV=production
PORT=3001

# CRITICAL: Use a strong JWT secret
JWT_SECRET=your-256-bit-secret-key-generated-with-crypto

# CRITICAL: Specify exact allowed origins
ALLOWED_ORIGINS=https://your-domain.com,https://admin.your-domain.com

# Server URLs
REACT_APP_SERVER_URL=https://your-domain.com
CLIENT_URL=https://your-domain.com
WEBSOCKET_URL=wss://your-domain.com

# Disable debug mode
REACT_APP_DEBUG_MODE=false

# Rate limiting (adjust based on your needs)
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100
AUTH_RATE_LIMIT_MAX=5
```

### 2. Nginx Configuration (Recommended)
```nginx
server {
    listen 443 ssl http2;
    server_name your-domain.com;

    # SSL Configuration
    ssl_certificate /path/to/your/certificate.crt;
    ssl_certificate_key /path/to/your/private.key;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers ECDHE-RSA-AES256-GCM-SHA512:DHE-RSA-AES256-GCM-SHA512;
    ssl_prefer_server_ciphers off;

    # Security Headers (additional to application headers)
    add_header Strict-Transport-Security "max-age=63072000" always;
    add_header X-Frame-Options DENY always;
    add_header X-Content-Type-Options nosniff always;

    # Rate limiting at nginx level
    limit_req_zone $binary_remote_addr zone=api:10m rate=10r/s;
    
    location / {
        try_files $uri $uri/ /index.html;
    }

    location /api/ {
        limit_req zone=api burst=20 nodelay;
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }

    # WebSocket support
    location /socket.io/ {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

### 3. Process Management (PM2)
```bash
# Install PM2
npm install -g pm2

# Create ecosystem file
cat > ecosystem.config.js << 'EOF'
module.exports = {
  apps: [{
    name: 'memex-racing-server',
    script: 'src/server/index.js',
    cwd: '/path/to/memex-racing-game',
    env: {
      NODE_ENV: 'production',
      PORT: 3001
    },
    instances: 'max',
    exec_mode: 'cluster',
    error_file: '/var/log/memex-racing/error.log',
    out_file: '/var/log/memex-racing/out.log',
    log_file: '/var/log/memex-racing/combined.log',
    time: true,
    max_memory_restart: '1G'
  }]
};
EOF

# Start with PM2
pm2 start ecosystem.config.js
pm2 save
pm2 startup
```

## Security Monitoring

### 1. Log Analysis Setup
```bash
# Create log directory
sudo mkdir -p /var/log/memex-racing
sudo chown $(whoami):$(whoami) /var/log/memex-racing

# Monitor security events
tail -f /var/log/memex-racing/combined.log | grep -E "(CORS blocked|Rate limit|Auth failed|Suspicious)"
```

### 2. Automated Security Checks
```bash
# Create security check script
cat > scripts/security-check.sh << 'EOF'
#!/bin/bash

echo "=== Memex Racing Security Check ==="

# Check for dependency vulnerabilities
echo "Checking dependencies..."
npm audit --audit-level high

# Check environment configuration
echo "Checking environment..."
if [ "$JWT_SECRET" = "your-secure-jwt-secret-32-characters-minimum-required" ]; then
    echo "⚠️  WARNING: Default JWT_SECRET in use!"
fi

if [ "$NODE_ENV" != "production" ]; then
    echo "⚠️  WARNING: Not in production mode!"
fi

if [[ "$ALLOWED_ORIGINS" == *"*"* ]]; then
    echo "⚠️  WARNING: Wildcard in ALLOWED_ORIGINS!"
fi

echo "Security check complete."
EOF

chmod +x scripts/security-check.sh
```

### 3. Health Monitoring
```bash
# Create health check script
cat > scripts/health-check.sh << 'EOF'
#!/bin/bash

HEALTH_URL="http://localhost:3001/health"
RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" $HEALTH_URL)

if [ $RESPONSE -eq 200 ]; then
    echo "✅ Server healthy"
else
    echo "❌ Server unhealthy (HTTP $RESPONSE)"
    # Add alerting logic here
fi
EOF

chmod +x scripts/health-check.sh

# Add to crontab for regular checks
echo "*/5 * * * * /path/to/memex-racing-game/scripts/health-check.sh" | crontab -
```

## Troubleshooting

### Common Issues

**1. CORS Errors**
```bash
# Check your ALLOWED_ORIGINS environment variable
echo $ALLOWED_ORIGINS

# Verify the origin in request headers
curl -H "Origin: your-origin-here" -v http://localhost:3001/health
```

**2. Rate Limiting Issues**
```bash
# Check current rate limit status
curl -v http://localhost:3001/health
# Look for X-RateLimit-* headers
```

**3. Authentication Problems**
```bash
# Test JWT token validation
curl -H "Authorization: Bearer your-token" http://localhost:3001/api/race/current
```

**4. WebSocket Connection Issues**
- Verify WEBSOCKET_URL in environment
- Check firewall settings for WebSocket ports
- Test with browser developer tools

## Security Checklist

Before deploying to production:

- [ ] JWT_SECRET is unique and secure (32+ characters)
- [ ] ALLOWED_ORIGINS contains only trusted domains
- [ ] NODE_ENV=production
- [ ] HTTPS is enabled
- [ ] All dependencies are up to date
- [ ] Rate limiting is configured appropriately
- [ ] Monitoring and alerting is set up
- [ ] Backups are configured
- [ ] Security headers are working
- [ ] Input validation is active
- [ ] Error handling doesn't leak sensitive information

## Emergency Response

### If Security Breach Detected:

1. **Immediate Actions:**
   ```bash
   # Stop the server
   pm2 stop memex-racing-server
   
   # Check logs for suspicious activity
   grep -E "(failed|error|suspicious|blocked)" /var/log/memex-racing/combined.log
   ```

2. **Investigation:**
   - Review access logs
   - Check for unauthorized API calls
   - Verify data integrity
   - Assess impact scope

3. **Recovery:**
   - Patch vulnerabilities
   - Rotate JWT secrets
   - Update allowed origins
   - Restore from clean backup if needed

4. **Prevention:**
   - Implement additional monitoring
   - Review and strengthen security measures
   - Update incident response procedures

## Contact and Support

For security issues:
1. Check the troubleshooting section
2. Review server logs
3. Verify environment configuration
4. Test with the provided security check scripts

Remember: Security is an ongoing process. Regularly review and update these configurations as threats evolve.