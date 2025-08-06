/**
 * Ably Token Authentication Endpoint
 * 
 * Generates Ably tokens for authenticated users
 * This allows secure real-time communication without exposing API keys
 */

import Ably from 'ably/promises';
import jwt from 'jsonwebtoken';

const ably = new Ably.Rest(process.env.ABLY_API_KEY);

export default async function handler(req, res) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,POST');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization'
  );

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'GET' && req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Verify JWT token
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (!token) {
      return res.status(401).json({ error: 'No authorization token' });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const userId = decoded.userId;
    const username = decoded.username || `Player ${userId}`;

    // Create token request for Ably
    const tokenRequest = await ably.auth.createTokenRequest({
      clientId: userId,
      capability: {
        '*': ['subscribe', 'publish', 'presence']
      },
      ttl: 3600000 // 1 hour
    });

    // Add user metadata
    tokenRequest.clientData = {
      username,
      userId,
      timestamp: Date.now()
    };

    res.status(200).json(tokenRequest);

  } catch (error) {
    console.error('Ably token error:', error);
    
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({ error: 'Invalid token' });
    }
    
    res.status(500).json({ error: 'Internal server error' });
  }
}