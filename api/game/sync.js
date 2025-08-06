/**
 * Serverless Game State Synchronization
 * 
 * Handles game state updates and synchronization via Ably
 * Optimized for serverless with stateless design
 */

import Ably from 'ably/promises';
import jwt from 'jsonwebtoken';

const ably = new Ably.Rest(process.env.ABLY_API_KEY);

// Game constants
const RACE_DURATION = 300000; // 5 minutes
const BETTING_DURATION = 30000; // 30 seconds

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

    const { action, roomId, data } = req.body;

    if (!action || !roomId) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const channel = ably.channels.get(`room:${roomId}`);

    switch (action) {
      case 'startBetting':
        await handleStartBetting(channel, roomId, userId);
        break;

      case 'startRace':
        await handleStartRace(channel, roomId, userId);
        break;

      case 'syncGameState':
        await handleSyncGameState(channel, roomId, data);
        break;

      case 'endRace':
        await handleEndRace(channel, roomId, data);
        break;

      case 'spawnPowerUp':
        await handleSpawnPowerUp(channel, roomId, data);
        break;

      default:
        return res.status(400).json({ error: 'Unknown action' });
    }

    res.status(200).json({ success: true });

  } catch (error) {
    console.error('Game sync error:', error);
    
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({ error: 'Invalid token' });
    }
    
    res.status(500).json({ error: 'Internal server error' });
  }
}

async function handleStartBetting(channel, roomId, hostId) {
  const bettingState = {
    phase: 'betting',
    startTime: Date.now(),
    endTime: Date.now() + BETTING_DURATION,
    bets: {},
    hostId
  };

  await channel.publish('bettingPhaseStart', bettingState);
  
  // Schedule race start
  setTimeout(async () => {
    await channel.publish('bettingPhaseEnd', {
      phase: 'preparing',
      startTime: Date.now()
    });
  }, BETTING_DURATION);
}

async function handleStartRace(channel, roomId, hostId) {
  const raceState = {
    phase: 'racing',
    startTime: Date.now(),
    endTime: Date.now() + RACE_DURATION,
    raceNumber: Date.now(),
    mapSeed: Math.random(),
    mTokenPosition: generateMTokenPosition(),
    playerPositions: generateStartPositions(),
    hostId
  };

  await channel.publish('raceStart', raceState);
}

async function handleSyncGameState(channel, roomId, gameState) {
  // Broadcast complete game state for late joiners or reconnections
  await channel.publish('gameState', {
    ...gameState,
    timestamp: Date.now(),
    serverTime: Date.now()
  });
}

async function handleEndRace(channel, roomId, results) {
  const endState = {
    phase: 'finished',
    endTime: Date.now(),
    results: results.results || [],
    winner: results.winner,
    nextRaceIn: 10000 // 10 seconds
  };

  await channel.publish('raceFinish', endState);

  // Schedule next race
  setTimeout(async () => {
    await channel.publish('nextRaceReady', {
      phase: 'waiting',
      timestamp: Date.now()
    });
  }, 10000);
}

async function handleSpawnPowerUp(channel, roomId, powerUpData) {
  const powerUp = {
    id: generateId(),
    type: powerUpData.type || getRandomPowerUpType(),
    position: powerUpData.position || generateRandomPosition(),
    spawnTime: Date.now(),
    expiresAt: Date.now() + 30000 // 30 seconds lifetime
  };

  await channel.publish('powerUpSpawned', powerUp);
}

// Helper functions
function generateMTokenPosition() {
  return {
    x: 100 + Math.random() * 1720,
    y: 100 + Math.random() * 880
  };
}

function generateStartPositions() {
  const baseX = 960;
  const baseY = 540;
  const positions = {};
  
  for (let i = 0; i < 6; i++) {
    const angle = (i * 60) * Math.PI / 180;
    positions[`player${i}`] = {
      x: baseX + Math.cos(angle) * 50,
      y: baseY + Math.sin(angle) * 50
    };
  }
  
  return positions;
}

function getRandomPowerUpType() {
  const types = ['antenna', 'twitter', 'memex', 'poo', 'toilet_paper', 'toilet', 'banana', 'kong'];
  return types[Math.floor(Math.random() * types.length)];
}

function generateRandomPosition() {
  return {
    x: 100 + Math.random() * 1720,
    y: 100 + Math.random() * 880
  };
}

function generateId() {
  return `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}