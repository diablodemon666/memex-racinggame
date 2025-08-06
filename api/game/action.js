/**
 * Serverless Game Action Handler
 * 
 * Processes game actions and broadcasts updates via Ably
 * Deployed as Vercel serverless function
 */

import Ably from 'ably/promises';
import jwt from 'jsonwebtoken';

// Initialize Ably REST client
const ably = new Ably.Rest(process.env.ABLY_API_KEY);

// Game state cache (use Redis/DynamoDB in production)
const gameStateCache = new Map();

export default async function handler(req, res) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization'
  );

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'POST') {
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

    // Parse request body
    const { roomId, playerId, action, data } = req.body;

    // Validate request
    if (!roomId || !playerId || !action) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Verify player ID matches token
    if (playerId !== userId) {
      return res.status(403).json({ error: 'Player ID mismatch' });
    }

    // Get room channel
    const channel = ably.channels.get(`room:${roomId}`);

    // Process action based on type
    let response = {};
    let broadcastEvent = null;
    let broadcastData = null;

    switch (action) {
      case 'updateState':
        // Update player position/state
        broadcastEvent = 'playerUpdate';
        broadcastData = {
          playerId,
          state: data,
          timestamp: Date.now()
        };
        response = { success: true, updated: true };
        break;

      case 'placeBet':
        // Validate bet
        if (!data.targetPlayerId || !data.amount || data.amount <= 0) {
          return res.status(400).json({ error: 'Invalid bet data' });
        }

        // Process bet (simplified - add more validation in production)
        broadcastEvent = 'betPlaced';
        broadcastData = {
          playerId,
          targetPlayerId: data.targetPlayerId,
          amount: data.amount,
          timestamp: Date.now()
        };
        response = { success: true, betId: generateBetId() };
        break;

      case 'activateSkill':
        // Validate skill
        const validSkills = ['thunder', 'fire', 'bubble', 'magnet', 'teleport'];
        if (!validSkills.includes(data.skillType)) {
          return res.status(400).json({ error: 'Invalid skill type' });
        }

        // Process skill activation
        broadcastEvent = 'skillActivated';
        broadcastData = {
          playerId,
          skillType: data.skillType,
          timestamp: Date.now()
        };
        response = { success: true, skillActivated: true };
        break;

      case 'collectPowerUp':
        // Process power-up collection
        broadcastEvent = 'powerUpCollected';
        broadcastData = {
          playerId,
          powerUpId: data.powerUpId,
          powerUpType: data.powerUpType,
          timestamp: Date.now()
        };
        response = { success: true, collected: true };
        break;

      case 'finishRace':
        // Process race finish
        broadcastEvent = 'playerFinished';
        broadcastData = {
          playerId,
          position: data.position,
          time: data.time,
          timestamp: Date.now()
        };
        response = { success: true, finished: true };
        break;

      default:
        return res.status(400).json({ error: 'Unknown action' });
    }

    // Broadcast update to room
    if (broadcastEvent && broadcastData) {
      await channel.publish(broadcastEvent, broadcastData);
    }

    // Return response
    res.status(200).json(response);

  } catch (error) {
    console.error('Game action error:', error);
    
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({ error: 'Invalid token' });
    }
    
    res.status(500).json({ error: 'Internal server error' });
  }
}

function generateBetId() {
  return `bet_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}