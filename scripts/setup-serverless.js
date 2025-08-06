#!/usr/bin/env node

/**
 * Setup script for serverless deployment
 * Configures Ably and Vercel for one-click deployment
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

console.log('🚀 Setting up Memex Racing for serverless deployment...\n');

// Check if .env exists
const envPath = path.join(__dirname, '..', '.env');
const envExamplePath = path.join(__dirname, '..', '.env.example');

if (!fs.existsSync(envPath)) {
  console.log('📝 Creating .env file...');
  
  // Create .env.example if it doesn't exist
  if (!fs.existsSync(envExamplePath)) {
    const envExample = `# Ably Configuration
ABLY_API_KEY=your_ably_api_key_here

# JWT Configuration  
JWT_SECRET=your_jwt_secret_here_minimum_32_chars
JWT_EXPIRES_IN=24h
JWT_REFRESH_EXPIRES_IN=7d

# Environment
NODE_ENV=production

# Server URL (automatically set by Vercel)
VERCEL_URL=

# Optional: Custom domain
CUSTOM_DOMAIN=
`;
    fs.writeFileSync(envExamplePath, envExample);
  }
  
  // Copy .env.example to .env
  fs.copyFileSync(envExamplePath, envPath);
  console.log('✅ .env file created. Please update it with your configuration.\n');
}

// Check for required environment variables
console.log('🔍 Checking environment configuration...');

const requiredEnvVars = ['ABLY_API_KEY', 'JWT_SECRET'];
const missingVars = [];

// Read current .env file
const envContent = fs.readFileSync(envPath, 'utf8');
const envLines = envContent.split('\n');
const envVars = {};

envLines.forEach(line => {
  const match = line.match(/^([^#=]+)=(.*)$/);
  if (match) {
    envVars[match[1].trim()] = match[2].trim();
  }
});

requiredEnvVars.forEach(varName => {
  if (!envVars[varName] || envVars[varName].includes('your_')) {
    missingVars.push(varName);
  }
});

if (missingVars.length > 0) {
  console.log('\n⚠️  Missing required environment variables:');
  missingVars.forEach(varName => {
    console.log(`   - ${varName}`);
  });
  console.log('\n📋 Setup Instructions:\n');
  
  if (missingVars.includes('ABLY_API_KEY')) {
    console.log('1. Get your Ably API key:');
    console.log('   - Sign up at https://ably.com');
    console.log('   - Create a new app');
    console.log('   - Copy the API key from the dashboard\n');
  }
  
  if (missingVars.includes('JWT_SECRET')) {
    console.log('2. Generate a secure JWT secret:');
    console.log('   - Run: openssl rand -base64 32');
    console.log('   - Or use any 32+ character random string\n');
  }
  
  console.log('3. Update your .env file with these values\n');
  console.log('4. Run this script again\n');
  process.exit(1);
}

console.log('✅ Environment variables configured\n');

// Install Vercel CLI if not installed
console.log('🔧 Checking Vercel CLI...');
try {
  execSync('vercel --version', { stdio: 'ignore' });
  console.log('✅ Vercel CLI already installed\n');
} catch (error) {
  console.log('📦 Installing Vercel CLI...');
  try {
    execSync('npm install -g vercel', { stdio: 'inherit' });
    console.log('✅ Vercel CLI installed\n');
  } catch (installError) {
    console.error('❌ Failed to install Vercel CLI');
    console.log('Please install manually: npm install -g vercel\n');
    process.exit(1);
  }
}

// Create deployment instructions
const deploymentGuide = `# 🎮 Memex Racing - Serverless Deployment Guide

## Quick Deploy to Vercel

1. **Deploy with one command:**
   \`\`\`bash
   npm run deploy:vercel
   \`\`\`

2. **First deployment setup:**
   - Vercel will ask you to log in (if not already)
   - Choose your account/team
   - Confirm project settings
   - Set environment variables when prompted

3. **Deploy to production:**
   \`\`\`bash
   npm run deploy:vercel:prod
   \`\`\`

## Environment Variables

Make sure these are set in Vercel dashboard:
- \`ABLY_API_KEY\` - Your Ably API key
- \`JWT_SECRET\` - Your JWT secret (32+ chars)

## Features

✅ **Serverless Architecture**
- No server management required
- Automatic scaling with demand
- Pay only for what you use

✅ **Real-time Multiplayer**
- WebSocket support via Ably
- Low latency game updates
- Automatic reconnection

✅ **Edge Functions**
- Fast API responses
- Global deployment
- Automatic HTTPS

## Testing Your Deployment

1. Visit your deployment URL
2. Create/join a room
3. Test multiplayer features
4. Check real-time updates

## Custom Domain (Optional)

1. Add domain in Vercel dashboard
2. Update DNS records
3. SSL automatically configured

## Monitoring

- View logs: \`vercel logs\`
- Check functions: \`vercel inspect\`
- Analytics: Available in Vercel dashboard

## Troubleshooting

**Connection Issues:**
- Check Ably API key is valid
- Verify environment variables in Vercel
- Check browser console for errors

**Build Failures:**
- Run \`npm run build:serverless\` locally
- Check Vercel build logs
- Ensure all dependencies are listed

**Performance:**
- Monitor function execution time
- Check Ably usage limits
- Enable caching where possible

## Support

- Vercel Docs: https://vercel.com/docs
- Ably Docs: https://ably.com/docs
- Game Issues: Check browser console

---

Ready to deploy? Run \`npm run deploy:vercel\` 🚀
`;

const guidePath = path.join(__dirname, '..', 'DEPLOYMENT.md');
fs.writeFileSync(guidePath, deploymentGuide);
console.log('📄 Created DEPLOYMENT.md with instructions\n');

// Create serverless function helpers
const functionHelpers = `/**
 * Serverless function helpers
 */

export function corsHeaders(origin = '*') {
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Max-Age': '86400',
  };
}

export function errorResponse(message, status = 400) {
  return new Response(
    JSON.stringify({ error: message }),
    {
      status,
      headers: {
        'Content-Type': 'application/json',
        ...corsHeaders()
      }
    }
  );
}

export function successResponse(data, status = 200) {
  return new Response(
    JSON.stringify(data),
    {
      status,
      headers: {
        'Content-Type': 'application/json',
        ...corsHeaders()
      }
    }
  );
}

export async function validateAuth(request) {
  const authHeader = request.headers.get('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    throw new Error('Unauthorized');
  }
  
  const token = authHeader.substring(7);
  // Add JWT validation here
  return { token };
}
`;

const helpersPath = path.join(__dirname, '..', 'api', '_helpers.js');
fs.mkdirSync(path.dirname(helpersPath), { recursive: true });
fs.writeFileSync(helpersPath, functionHelpers);
console.log('✅ Created API helper functions\n');

// Final instructions
console.log('🎉 Setup complete!\n');
console.log('Next steps:');
console.log('1. Review DEPLOYMENT.md for detailed instructions');
console.log('2. Run "npm run build:serverless" to test the build');
console.log('3. Run "npm run deploy:vercel" to deploy\n');
console.log('Happy deploying! 🚀\n');