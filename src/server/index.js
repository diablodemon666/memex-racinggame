/**
 * index.js - Main Server Entry Point for Memex Racing Game
 * 
 * Express server with Socket.io for multiplayer racing game
 * Handles room management, player connections, and game state synchronization
 */

import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import dotenv from 'dotenv';
import { RoomManager } from './RoomManager.js';
import { GameStateManager } from './GameStateManager.js';
import { MatchmakingService } from './MatchmakingService.js';
import { authenticateSocket, optionalAuthenticateJWT, refreshToken } from './middleware/auth.js';
import { securityHeaders, validateInput, secureSocket, rateLimiters } from './middleware/security.js';

// Load environment variables
dotenv.config();

const app = express();
const server = createServer(app);

// SECURITY FIX: Enhanced CORS configuration
const getAllowedOrigins = () => {
  const defaultOrigins = [
    'http://localhost:3000',
    'http://localhost:3001',
    'http://127.0.0.1:3000',
    'http://127.0.0.1:3001'
  ];

  const productionOrigins = process.env.ALLOWED_ORIGINS 
    ? process.env.ALLOWED_ORIGINS.split(',').map(origin => origin.trim())
    : [];

  if (process.env.NODE_ENV === 'development') {
    return [...defaultOrigins, ...productionOrigins];
  }

  return productionOrigins.length > 0 ? productionOrigins : defaultOrigins;
};

const corsOptions = {
  origin: (origin, callback) => {
    const allowedOrigins = getAllowedOrigins();
    
    // Allow requests with no origin (mobile apps, etc.)
    if (!origin) return callback(null, true);
    
    if (allowedOrigins.includes(origin)) {
      return callback(null, true);
    }
    
    console.warn(`[Server] CORS blocked origin: ${origin}`);
    return callback(new Error('Not allowed by CORS policy'), false);
  },
  methods: ["GET", "POST", "OPTIONS"],
  credentials: true,
  maxAge: 86400 // 24 hours
};

// SECURITY MIDDLEWARE
// Temporarily commented out due to CSP configuration issue
// app.use(securityHeaders);
app.use(cors(corsOptions));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(validateInput);
app.use(rateLimiters.api);

// Socket.io setup with enhanced security
const io = new Server(server, {
  cors: corsOptions,
  pingTimeout: 60000,
  pingInterval: 25000,
  maxHttpBufferSize: 1e6, // 1MB
  allowEIO3: true
});

// Apply security middleware to Socket.io
io.use(secureSocket);
io.use(authenticateSocket);

// Initialize managers
const roomManager = new RoomManager();
const gameStateManager = new GameStateManager();
const matchmakingService = new MatchmakingService(roomManager);

// Authentication endpoints
app.post('/auth/refresh', rateLimiters.auth, refreshToken);

// Health check endpoint
app.get('/health', rateLimiters.streaming, (req, res) => {
  const status = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    rooms: roomManager.getRoomCount(),
    connections: io.engine.clientsCount
  };
  res.json(status);
});

// Server stats endpoint (with optional authentication)
app.get('/stats', rateLimiters.sensitive, optionalAuthenticateJWT, (req, res) => {
  const stats = {
    rooms: roomManager.getAllRooms().map(room => ({
      id: room.id,
      playerCount: room.players.length,
      status: room.status,
      createdAt: room.createdAt
    })),
    totalPlayers: roomManager.getTotalPlayerCount(),
    activeRooms: roomManager.getActiveRoomCount()
  };
  res.json(stats);
});

// Socket.io connection handling
io.on('connection', (socket) => {
  console.log(`[Server] Player connected: ${socket.id}`);
  
  // Store player info on socket
  socket.player = {
    id: socket.id,
    username: null,
    roomId: null,
    isReady: false,
    isAI: false,
    connectionTime: Date.now()
  };

  // Handle player authentication/registration
  socket.on('REGISTER_PLAYER', (data) => {
    try {
      const { username, avatar } = data;
      // Use authenticated username if available, otherwise use provided username
      socket.player.username = socket.user?.username || username || `Player_${socket.id.slice(0, 6)}`;
      socket.player.avatar = avatar || 'default';
      socket.player.isAuthenticated = !socket.user?.isGuest;
      
      console.log(`[Server] Player registered: ${socket.player.username} (${socket.id})`);
      
      socket.emit('PLAYER_REGISTERED', {
        playerId: socket.id,
        username: socket.player.username,
        avatar: socket.player.avatar
      });
    } catch (error) {
      console.error('[Server] Error registering player:', error);
      socket.emit('ERROR', { message: 'Failed to register player' });
    }
  });

  // Handle room creation
  socket.on('CREATE_ROOM', (data = {}) => {
    try {
      const { maxPlayers = 6, gameMode = 'racing', mapId = 'classic' } = data;
      
      if (!socket.player.username) {
        socket.emit('ERROR', { message: 'Please register first' });
        return;
      }

      const room = roomManager.createRoom({
        hostId: socket.id,
        maxPlayers,
        gameMode,
        mapId
      });

      const success = roomManager.addPlayerToRoom(room.id, socket.player);
      
      if (success) {
        socket.player.roomId = room.id;
        socket.join(room.id);
        
        console.log(`[Server] Room created: ${room.id} by ${socket.player.username}`);
        
        socket.emit('ROOM_CREATED', {
          room: roomManager.getRoomData(room.id),
          playerId: socket.id
        });
        
        // Notify room about new player
        socket.to(room.id).emit('PLAYER_JOINED', {
          player: socket.player,
          room: roomManager.getRoomData(room.id)
        });
      } else {
        socket.emit('ERROR', { message: 'Failed to create room' });
      }
    } catch (error) {
      console.error('[Server] Error creating room:', error);
      socket.emit('ERROR', { message: 'Failed to create room' });
    }
  });

  // Handle joining room by code
  socket.on('JOIN_ROOM', (data) => {
    try {
      const { roomCode } = data;
      
      if (!socket.player.username) {
        socket.emit('ERROR', { message: 'Please register first' });
        return;
      }

      if (socket.player.roomId) {
        socket.emit('ERROR', { message: 'Already in a room' });
        return;
      }

      const room = roomManager.findRoomByCode(roomCode);
      if (!room) {
        socket.emit('ERROR', { message: 'Room not found' });
        return;
      }

      const success = roomManager.addPlayerToRoom(room.id, socket.player);
      
      if (success) {
        socket.player.roomId = room.id;
        socket.join(room.id);
        
        console.log(`[Server] Player ${socket.player.username} joined room: ${room.code}`);
        
        socket.emit('ROOM_JOINED', {
          room: roomManager.getRoomData(room.id),
          playerId: socket.id
        });
        
        // Notify room about new player
        socket.to(room.id).emit('PLAYER_JOINED', {
          player: socket.player,
          room: roomManager.getRoomData(room.id)
        });
        
        // Fill remaining slots with AI if needed
        roomManager.fillWithAI(room.id);
        
        // Update room state for all players
        io.to(room.id).emit('ROOM_UPDATED', {
          room: roomManager.getRoomData(room.id)
        });
      } else {
        socket.emit('ERROR', { message: 'Cannot join room (full or not available)' });
      }
    } catch (error) {
      console.error('[Server] Error joining room:', error);
      socket.emit('ERROR', { message: 'Failed to join room' });
    }
  });

  // Handle quick play matchmaking
  socket.on('QUICK_PLAY', () => {
    try {
      if (!socket.player.username) {
        socket.emit('ERROR', { message: 'Please register first' });
        return;
      }

      if (socket.player.roomId) {
        socket.emit('ERROR', { message: 'Already in a room' });
        return;
      }

      const room = matchmakingService.findOrCreateRoom(socket.player);
      
      if (room) {
        socket.player.roomId = room.id;
        socket.join(room.id);
        
        console.log(`[Server] Quick play: ${socket.player.username} matched to room ${room.code}`);
        
        socket.emit('ROOM_JOINED', {
          room: roomManager.getRoomData(room.id),
          playerId: socket.id
        });
        
        // Notify room about new player
        socket.to(room.id).emit('PLAYER_JOINED', {
          player: socket.player,
          room: roomManager.getRoomData(room.id)
        });
        
        // Check if room is full enough to start
        if (room.players.length >= 2) {
          roomManager.fillWithAI(room.id);
          io.to(room.id).emit('ROOM_UPDATED', {
            room: roomManager.getRoomData(room.id)
          });
        }
      } else {
        socket.emit('ERROR', { message: 'No available rooms' });
      }
    } catch (error) {
      console.error('[Server] Error with quick play:', error);
      socket.emit('ERROR', { message: 'Quick play failed' });
    }
  });

  // Handle player ready state
  socket.on('PLAYER_READY', (data) => {
    try {
      const { isReady } = data;
      
      if (!socket.player.roomId) {
        socket.emit('ERROR', { message: 'Not in a room' });
        return;
      }

      socket.player.isReady = isReady;
      roomManager.updatePlayerReady(socket.player.roomId, socket.id, isReady);
      
      const room = roomManager.getRoom(socket.player.roomId);
      
      console.log(`[Server] Player ${socket.player.username} ready: ${isReady}`);
      
      // Notify room about ready state change
      io.to(room.id).emit('PLAYER_READY_CHANGED', {
        playerId: socket.id,
        isReady,
        room: roomManager.getRoomData(room.id)
      });
      
      // Check if all players are ready to start game
      if (roomManager.areAllPlayersReady(room.id)) {
        startGame(room);
      }
    } catch (error) {
      console.error('[Server] Error updating ready state:', error);
      socket.emit('ERROR', { message: 'Failed to update ready state' });
    }
  });

  // Handle game state updates during race
  socket.on('GAME_UPDATE', (data) => {
    try {
      if (!socket.player.roomId) return;
      
      const { position, velocity, direction, timestamp } = data;
      
      gameStateManager.updatePlayerState(socket.player.roomId, socket.id, {
        position,
        velocity,
        direction,
        timestamp
      });
      
      // Broadcast to other players in room
      socket.to(socket.player.roomId).emit('PLAYER_UPDATE', {
        playerId: socket.id,
        position,
        velocity,
        direction,
        timestamp
      });
    } catch (error) {
      console.error('[Server] Error updating game state:', error);
    }
  });

  // Handle race completion
  socket.on('RACE_FINISHED', (data) => {
    try {
      if (!socket.player.roomId) return;
      
      const { finishTime, position } = data;
      const room = roomManager.getRoom(socket.player.roomId);
      
      console.log(`[Server] Player ${socket.player.username} finished race: position ${position}`);
      
      gameStateManager.recordFinish(room.id, socket.id, finishTime, position);
      
      // Notify room about finish
      io.to(room.id).emit('PLAYER_FINISHED', {
        playerId: socket.id,
        username: socket.player.username,
        finishTime,
        position
      });
      
      // Check if race is complete
      const results = gameStateManager.checkRaceCompletion(room.id);
      if (results) {
        finishRace(room, results);
      }
    } catch (error) {
      console.error('[Server] Error handling race finish:', error);
    }
  });

  // Handle leaving room
  socket.on('LEAVE_ROOM', () => {
    handlePlayerLeave(socket);
  });

  // Handle disconnection
  socket.on('disconnect', () => {
    console.log(`[Server] Player disconnected: ${socket.id}`);
    handlePlayerLeave(socket);
  });

  // Helper function to start game
  function startGame(room) {
    try {
      console.log(`[Server] Starting game in room: ${room.code}`);
      
      roomManager.setRoomStatus(room.id, 'racing');
      gameStateManager.initializeRace(room.id, room.players);
      
      const gameData = {
        roomId: room.id,
        players: room.players,
        mapId: room.settings.mapId,
        startTime: Date.now(),
        raceTimer: 300000 // 5 minutes
      };
      
      io.to(room.id).emit('GAME_STARTED', gameData);
      
      // Start race timer
      setTimeout(() => {
        if (roomManager.getRoom(room.id)?.status === 'racing') {
          timeoutRace(room);
        }
      }, gameData.raceTimer);
    } catch (error) {
      console.error('[Server] Error starting game:', error);
    }
  }

  // Helper function to finish race
  function finishRace(room, results) {
    try {
      console.log(`[Server] Race finished in room: ${room.code}`);
      
      roomManager.setRoomStatus(room.id, 'finished');
      
      io.to(room.id).emit('RACE_FINISHED', {
        roomId: room.id,
        results,
        timestamp: Date.now()
      });
      
      // Reset room after delay
      setTimeout(() => {
        resetRoom(room);
      }, 10000); // 10 second delay
    } catch (error) {
      console.error('[Server] Error finishing race:', error);
    }
  }

  // Helper function to handle race timeout
  function timeoutRace(room) {
    try {
      console.log(`[Server] Race timed out in room: ${room.code}`);
      
      const results = gameStateManager.getTimeoutResults(room.id);
      roomManager.setRoomStatus(room.id, 'finished');
      
      io.to(room.id).emit('RACE_TIMEOUT', {
        roomId: room.id,
        results,
        message: 'Time\'s up! All players lose - M token not reached in time.',
        timestamp: Date.now()
      });
      
      setTimeout(() => {
        resetRoom(room);
      }, 10000);
    } catch (error) {
      console.error('[Server] Error handling race timeout:', error);
    }
  }

  // Helper function to reset room
  function resetRoom(room) {
    try {
      roomManager.setRoomStatus(room.id, 'waiting');
      roomManager.resetPlayerReady(room.id);
      gameStateManager.cleanupRace(room.id);
      
      io.to(room.id).emit('ROOM_RESET', {
        room: roomManager.getRoomData(room.id)
      });
    } catch (error) {
      console.error('[Server] Error resetting room:', error);
    }
  }

  // Helper function to handle player leaving
  function handlePlayerLeave(socket) {
    try {
      if (socket.player.roomId) {
        const room = roomManager.getRoom(socket.player.roomId);
        
        if (room) {
          roomManager.removePlayerFromRoom(room.id, socket.id);
          socket.leave(room.id);
          
          console.log(`[Server] Player ${socket.player.username} left room: ${room.code}`);
          
          // Notify room about player leaving
          socket.to(room.id).emit('PLAYER_LEFT', {
            playerId: socket.id,
            username: socket.player.username,
            room: roomManager.getRoomData(room.id)
          });
          
          // If room is empty, schedule cleanup
          if (room.players.length === 0) {
            setTimeout(() => {
              roomManager.removeRoom(room.id);
              console.log(`[Server] Removed empty room: ${room.code}`);
            }, 30000); // 30 seconds grace period
          }
        }
        
        socket.player.roomId = null;
      }
    } catch (error) {
      console.error('[Server] Error handling player leave:', error);
    }
  }
});

// Error handling
process.on('uncaughtException', (error) => {
  console.error('[Server] Uncaught Exception:', error);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('[Server] Unhandled Rejection at:', promise, 'reason:', reason);
});

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('[Server] Shutting down gracefully...');
  server.close(() => {
    console.log('[Server] Server closed');
    process.exit(0);
  });
});

// Start server
const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`[Server] Memex Racing Game server running on port ${PORT}`);
  console.log(`[Server] Health check: http://localhost:${PORT}/health`);
  console.log(`[Server] Stats endpoint: http://localhost:${PORT}/stats`);
});

export { io, roomManager, gameStateManager, matchmakingService };