/**
 * Serverless Room Management API
 * 
 * Handles room creation, joining, and listing for multiplayer games
 * Uses edge functions with database for room state
 */

import jwt from 'jsonwebtoken';
import { customAlphabet } from 'nanoid';

// Generate room codes
const generateRoomCode = customAlphabet('ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789', 6);

// In production, use a database like Vercel KV or Upstash Redis
const rooms = new Map();

export default async function handler(req, res) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,POST,PUT,DELETE');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization'
  );

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  try {
    // Verify JWT token for authenticated endpoints
    let userId = null;
    let username = null;
    
    if (req.method !== 'GET' || req.query.action !== 'list') {
      const token = req.headers.authorization?.replace('Bearer ', '');
      if (!token) {
        return res.status(401).json({ error: 'No authorization token' });
      }
      
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      userId = decoded.userId;
      username = decoded.username || `Player ${userId}`;
    }

    // Handle different actions
    switch (req.method) {
      case 'POST':
        return handleCreateRoom(req, res, userId, username);
      
      case 'PUT':
        return handleJoinRoom(req, res, userId, username);
      
      case 'GET':
        if (req.query.action === 'list') {
          return handleListRooms(req, res);
        } else if (req.query.roomId) {
          return handleGetRoom(req, res, req.query.roomId);
        }
        return res.status(400).json({ error: 'Invalid GET request' });
      
      case 'DELETE':
        return handleLeaveRoom(req, res, userId);
      
      default:
        return res.status(405).json({ error: 'Method not allowed' });
    }

  } catch (error) {
    console.error('Room API error:', error);
    
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({ error: 'Invalid token' });
    }
    
    res.status(500).json({ error: 'Internal server error' });
  }
}

async function handleCreateRoom(req, res, userId, username) {
  const { isPrivate = false, maxPlayers = 6, gameMode = 'standard' } = req.body;
  
  const roomCode = generateRoomCode();
  const room = {
    id: roomCode,
    host: userId,
    players: [{
      id: userId,
      username,
      isHost: true,
      isReady: false
    }],
    settings: {
      isPrivate,
      maxPlayers,
      gameMode,
      mapRotation: true,
      bettingEnabled: true
    },
    status: 'waiting',
    createdAt: Date.now()
  };
  
  // Store room (in production, use database)
  rooms.set(roomCode, room);
  
  // Schedule cleanup after 1 hour
  setTimeout(() => {
    if (rooms.has(roomCode) && rooms.get(roomCode).status === 'waiting') {
      rooms.delete(roomCode);
    }
  }, 3600000);
  
  res.status(201).json({
    success: true,
    room: {
      code: roomCode,
      ...room
    }
  });
}

async function handleJoinRoom(req, res, userId, username) {
  const { roomCode } = req.body;
  
  if (!roomCode) {
    return res.status(400).json({ error: 'Room code required' });
  }
  
  const room = rooms.get(roomCode.toUpperCase());
  if (!room) {
    return res.status(404).json({ error: 'Room not found' });
  }
  
  // Check if room is full
  if (room.players.length >= room.settings.maxPlayers) {
    return res.status(400).json({ error: 'Room is full' });
  }
  
  // Check if player already in room
  if (room.players.find(p => p.id === userId)) {
    return res.status(400).json({ error: 'Already in room' });
  }
  
  // Add player to room
  room.players.push({
    id: userId,
    username,
    isHost: false,
    isReady: false
  });
  
  res.status(200).json({
    success: true,
    room
  });
}

async function handleLeaveRoom(req, res, userId) {
  const { roomCode } = req.body;
  
  if (!roomCode) {
    return res.status(400).json({ error: 'Room code required' });
  }
  
  const room = rooms.get(roomCode.toUpperCase());
  if (!room) {
    return res.status(404).json({ error: 'Room not found' });
  }
  
  // Remove player from room
  room.players = room.players.filter(p => p.id !== userId);
  
  // If room is empty, delete it
  if (room.players.length === 0) {
    rooms.delete(roomCode.toUpperCase());
  } else if (room.host === userId) {
    // Transfer host to next player
    room.players[0].isHost = true;
    room.host = room.players[0].id;
  }
  
  res.status(200).json({
    success: true,
    left: true
  });
}

async function handleListRooms(req, res) {
  const publicRooms = Array.from(rooms.values())
    .filter(room => !room.settings.isPrivate && room.status === 'waiting')
    .map(room => ({
      code: room.id,
      players: room.players.length,
      maxPlayers: room.settings.maxPlayers,
      gameMode: room.settings.gameMode,
      host: room.players.find(p => p.isHost)?.username
    }));
  
  res.status(200).json({
    success: true,
    rooms: publicRooms
  });
}

async function handleGetRoom(req, res, roomId) {
  const room = rooms.get(roomId.toUpperCase());
  
  if (!room) {
    return res.status(404).json({ error: 'Room not found' });
  }
  
  res.status(200).json({
    success: true,
    room
  });
}