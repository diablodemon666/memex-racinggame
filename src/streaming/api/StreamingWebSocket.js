/**
 * StreamingWebSocket.js - WebSocket server for real-time streaming data
 * 
 * Provides live updates for race data, betting information, and player statistics
 * via WebSocket connections for streaming overlays and external tools.
 */

import { Server as SocketIOServer } from 'socket.io';

export class StreamingWebSocket {
  constructor(server, gameEngine) {
    this.server = server;
    this.gameEngine = gameEngine;
    this.io = null;
    this.clients = new Map();
    
    // Update intervals
    this.updateIntervals = new Map();
    this.defaultUpdateRate = 30; // 30 FPS for race data
    this.bettingUpdateRate = 5; // 5 updates per second for betting
    this.leaderboardUpdateRate = 1; // 1 update per second for leaderboard
    
    // Data cache for efficient updates
    this.lastData = {
      race: null,
      betting: null,
      players: null,
      leaderboard: null,
      camera: null
    };
    
    // Client subscriptions
    this.subscriptions = new Map();
    
    console.log('[StreamingWebSocket] WebSocket server initialized');
  }

  /**
   * Get allowed origins based on environment
   */
  getAllowedOrigins() {
    const defaultOrigins = [
      'http://localhost:3000',
      'http://localhost:3001',
      'http://127.0.0.1:3000',
      'http://127.0.0.1:3001'
    ];

    // Production origins
    const productionOrigins = process.env.ALLOWED_ORIGINS 
      ? process.env.ALLOWED_ORIGINS.split(',').map(origin => origin.trim())
      : [];

    // Development mode allows additional origins
    if (process.env.NODE_ENV === 'development') {
      return [...defaultOrigins, ...productionOrigins];
    }

    // Production mode is more restrictive
    return productionOrigins.length > 0 ? productionOrigins : defaultOrigins;
  }

  /**
   * Initialize WebSocket server
   */
  initialize() {
    // SECURITY FIX: Environment-based CORS configuration
    const allowedOrigins = this.getAllowedOrigins();
    
    this.io = new SocketIOServer(this.server, {
      cors: {
        origin: (origin, callback) => {
          // Allow requests with no origin (mobile apps, etc.)
          if (!origin) return callback(null, true);
          
          if (allowedOrigins.includes(origin)) {
            return callback(null, true);
          }
          
          console.warn(`[StreamingWebSocket] CORS blocked origin: ${origin}`);
          return callback(new Error('Not allowed by CORS policy'), false);
        },
        methods: ["GET", "POST"],
        credentials: false
      },
      path: '/streaming-socket',
      pingTimeout: 60000,
      pingInterval: 25000
    });

    this.setupEventHandlers();
    this.startUpdateLoops();
    
    console.log('[StreamingWebSocket] WebSocket server started on /streaming-socket');
    return this;
  }

  /**
   * Setup WebSocket event handlers
   */
  setupEventHandlers() {
    this.io.on('connection', (socket) => {
      console.log(`[StreamingWebSocket] Client connected: ${socket.id}`);
      
      // Initialize client data
      this.clients.set(socket.id, {
        socket,
        subscriptions: new Set(),
        joinedAt: Date.now(),
        lastPing: Date.now()
      });

      // Handle client subscription to data streams
      socket.on('subscribe', (data) => {
        this.handleSubscription(socket, data);
      });

      // Handle client unsubscription
      socket.on('unsubscribe', (data) => {
        this.handleUnsubscription(socket, data);
      });

      // Handle camera control requests
      socket.on('camera-control', (data) => {
        this.handleCameraControl(socket, data);
      });

      // Handle overlay configuration
      socket.on('configure-overlay', (data) => {
        this.handleOverlayConfiguration(socket, data);
      });

      // Handle ping for connection health
      socket.on('ping', () => {
        const client = this.clients.get(socket.id);
        if (client) {
          client.lastPing = Date.now();
          socket.emit('pong', { timestamp: Date.now() });
        }
      });

      // Send initial data to new client
      this.sendInitialData(socket);

      // Handle disconnection
      socket.on('disconnect', (reason) => {
        console.log(`[StreamingWebSocket] Client disconnected: ${socket.id} (${reason})`);
        this.clients.delete(socket.id);
      });

      // Handle errors
      socket.on('error', (error) => {
        console.error(`[StreamingWebSocket] Socket error for ${socket.id}:`, error);
      });
    });
  }

  /**
   * Handle client subscription to data streams
   */
  handleSubscription(socket, data) {
    const client = this.clients.get(socket.id);
    if (!client) return;

    const { streams, updateRate } = data;
    
    if (Array.isArray(streams)) {
      streams.forEach(stream => {
        if (this.isValidStream(stream)) {
          client.subscriptions.add(stream);
          console.log(`[StreamingWebSocket] Client ${socket.id} subscribed to ${stream}`);
        }
      });
    }

    // Set custom update rate if provided
    if (updateRate && typeof updateRate === 'number' && updateRate > 0) {
      client.customUpdateRate = Math.min(updateRate, 60); // Max 60 FPS
    }

    // Send current data for subscribed streams
    this.sendSubscribedData(socket, client.subscriptions);

    socket.emit('subscription-confirmed', {
      streams: Array.from(client.subscriptions),
      updateRate: client.customUpdateRate || this.defaultUpdateRate
    });
  }

  /**
   * Handle client unsubscription
   */
  handleUnsubscription(socket, data) {
    const client = this.clients.get(socket.id);
    if (!client) return;

    const { streams } = data;
    
    if (Array.isArray(streams)) {
      streams.forEach(stream => {
        client.subscriptions.delete(stream);
        console.log(`[StreamingWebSocket] Client ${socket.id} unsubscribed from ${stream}`);
      });
    } else if (streams === 'all') {
      client.subscriptions.clear();
      console.log(`[StreamingWebSocket] Client ${socket.id} unsubscribed from all streams`);
    }

    socket.emit('unsubscription-confirmed', {
      streams: Array.from(client.subscriptions)
    });
  }

  /**
   * Handle camera control requests
   */
  handleCameraControl(socket, data) {
    try {
      if (!this.gameEngine || !this.gameEngine.cameraManager) {
        socket.emit('camera-control-error', { error: 'Camera manager not available' });
        return;
      }

      const cameraManager = this.gameEngine.cameraManager;
      let result = null;

      switch (data.command) {
        case 'setMode':
          cameraManager.setMode(data.mode, data.options);
          result = { mode: data.mode };
          break;

        case 'followPlayer':
          cameraManager.setMode('follow_player', { playerId: data.playerId });
          result = { following: data.playerId };
          break;

        case 'setPreset':
          const preset = cameraManager.getPreset(data.presetName);
          if (preset) {
            preset.applyTo(cameraManager);
            result = { preset: data.presetName };
          } else {
            throw new Error(`Preset not found: ${data.presetName}`);
          }
          break;

        case 'setPosition':
          cameraManager.setPosition(data.position, { smooth: data.smooth || true });
          result = { position: data.position };
          break;

        case 'setZoom':
          cameraManager.setZoom(data.zoom, { smooth: data.smooth || true });
          result = { zoom: data.zoom };
          break;

        default:
          throw new Error(`Unknown camera command: ${data.command}`);
      }

      socket.emit('camera-control-success', {
        command: data.command,
        result,
        timestamp: Date.now()
      });

      console.log(`[StreamingWebSocket] Camera control by ${socket.id}: ${data.command}`);

    } catch (error) {
      console.error(`[StreamingWebSocket] Camera control error:`, error);
      socket.emit('camera-control-error', {
        error: error.message,
        command: data.command
      });
    }
  }

  /**
   * Handle overlay configuration
   */
  handleOverlayConfiguration(socket, data) {
    const client = this.clients.get(socket.id);
    if (!client) return;

    // Store overlay configuration for this client
    client.overlayConfig = {
      ...data,
      updatedAt: Date.now()
    };

    console.log(`[StreamingWebSocket] Overlay configured for ${socket.id}:`, data);
    
    socket.emit('overlay-configuration-saved', {
      config: client.overlayConfig,
      timestamp: Date.now()
    });
  }

  /**
   * Send initial data to new client
   */
  sendInitialData(socket) {
    const initialData = {
      race: this.getCurrentRaceData(),
      betting: this.getCurrentBettingData(),
      players: this.getPlayerData(),
      leaderboard: this.getLeaderboardData(),
      camera: this.getCameraData(),
      gameStatus: this.getGameStatus()
    };

    socket.emit('initial-data', {
      data: initialData,
      timestamp: Date.now(),
      serverInfo: {
        version: '1.0.0',
        updateRates: {
          race: this.defaultUpdateRate,
          betting: this.bettingUpdateRate,
          leaderboard: this.leaderboardUpdateRate
        }
      }
    });
  }

  /**
   * Send data for subscribed streams
   */
  sendSubscribedData(socket, subscriptions) {
    const data = {};
    
    subscriptions.forEach(stream => {
      switch (stream) {
        case 'race':
          data.race = this.getCurrentRaceData();
          break;
        case 'betting':
          data.betting = this.getCurrentBettingData();
          break;
        case 'players':
          data.players = this.getPlayerData();
          break;
        case 'leaderboard':
          data.leaderboard = this.getLeaderboardData();
          break;
        case 'camera':
          data.camera = this.getCameraData();
          break;
        case 'gameStatus':
          data.gameStatus = this.getGameStatus();
          break;
        case 'tournament':
          data.tournament = this.getTournamentData();
          break;
        case 'tournamentBracket':
          data.tournamentBracket = this.getTournamentBracketData();
          break;
        case 'tournamentStandings':
          data.tournamentStandings = this.getTournamentStandingsData();
          break;
        case 'tournamentMatch':
          data.tournamentMatch = this.getCurrentTournamentMatchData();
          break;
        case 'tournamentCommentary':
          data.tournamentCommentary = this.getTournamentCommentaryData();
          break;
      }
    });

    if (Object.keys(data).length > 0) {
      socket.emit('data-update', {
        data,
        timestamp: Date.now()
      });
    }
  }

  /**
   * Start update loops for different data types
   */
  startUpdateLoops() {
    // Race data update loop (high frequency)
    this.updateIntervals.set('race', setInterval(() => {
      this.broadcastRaceData();
    }, 1000 / this.defaultUpdateRate));

    // Betting data update loop (medium frequency)
    this.updateIntervals.set('betting', setInterval(() => {
      this.broadcastBettingData();
    }, 1000 / this.bettingUpdateRate));

    // Leaderboard update loop (low frequency)
    this.updateIntervals.set('leaderboard', setInterval(() => {
      this.broadcastLeaderboardData();
    }, 1000 / this.leaderboardUpdateRate));

    // Camera data update loop (high frequency)
    this.updateIntervals.set('camera', setInterval(() => {
      this.broadcastCameraData();
    }, 1000 / this.defaultUpdateRate));

    console.log('[StreamingWebSocket] Update loops started');
  }

  /**
   * Broadcast race data to subscribed clients
   */
  broadcastRaceData() {
    const raceData = this.getCurrentRaceData();
    
    // Only broadcast if data has changed
    if (JSON.stringify(raceData) !== JSON.stringify(this.lastData.race)) {
      this.lastData.race = raceData;
      
      this.clients.forEach((client, socketId) => {
        if (client.subscriptions.has('race')) {
          client.socket.emit('race-update', {
            data: raceData,
            timestamp: Date.now()
          });
        }
      });
    }
  }

  /**
   * Broadcast betting data to subscribed clients
   */
  broadcastBettingData() {
    const bettingData = this.getCurrentBettingData();
    
    if (JSON.stringify(bettingData) !== JSON.stringify(this.lastData.betting)) {
      this.lastData.betting = bettingData;
      
      this.clients.forEach((client, socketId) => {
        if (client.subscriptions.has('betting')) {
          client.socket.emit('betting-update', {
            data: bettingData,
            timestamp: Date.now()
          });
        }
      });
    }
  }

  /**
   * Broadcast leaderboard data to subscribed clients
   */
  broadcastLeaderboardData() {
    const leaderboardData = this.getLeaderboardData();
    
    if (JSON.stringify(leaderboardData) !== JSON.stringify(this.lastData.leaderboard)) {
      this.lastData.leaderboard = leaderboardData;
      
      this.clients.forEach((client, socketId) => {
        if (client.subscriptions.has('leaderboard')) {
          client.socket.emit('leaderboard-update', {
            data: leaderboardData,
            timestamp: Date.now()
          });
        }
      });
    }
  }

  /**
   * Broadcast camera data to subscribed clients
   */
  broadcastCameraData() {
    const cameraData = this.getCameraData();
    
    if (JSON.stringify(cameraData) !== JSON.stringify(this.lastData.camera)) {
      this.lastData.camera = cameraData;
      
      this.clients.forEach((client, socketId) => {
        if (client.subscriptions.has('camera')) {
          client.socket.emit('camera-update', {
            data: cameraData,
            timestamp: Date.now()
          });
        }
      });
    }
  }

  /**
   * Get current race data
   */
  getCurrentRaceData() {
    if (!this.gameEngine) return null;

    const raceData = {
      isActive: false,
      phase: 'waiting',
      timeRemaining: 0,
      raceNumber: 0,
      currentMap: null,
      players: [],
      mTokenPosition: null,
      raceProgress: 0
    };

    if (this.gameEngine.currentRace) {
      const race = this.gameEngine.currentRace;
      
      raceData.isActive = race.isActive || false;
      raceData.phase = race.phase || 'waiting';
      raceData.timeRemaining = race.timeRemaining || 300;
      raceData.raceNumber = race.raceNumber || 0;
      raceData.currentMap = race.currentMap || null;
      raceData.raceProgress = race.progress || 0;

      if (this.gameEngine.players) {
        raceData.players = this.gameEngine.players.map(player => ({
          id: player.id,
          name: player.name || player.username,
          position: { x: player.x || 0, y: player.y || 0 },
          isActive: player.active || false,
          effects: {
            boosted: player.boosted || false,
            magnetized: player.magnetized || false,
            bubbleProtected: player.bubbleProtected || false,
            stunned: player.stunned || false
          },
          distanceToToken: player.distanceToToken || 0,
          rank: player.currentRank || 0
        }));
      }

      if (this.gameEngine.mToken) {
        raceData.mTokenPosition = {
          x: this.gameEngine.mToken.x || 0,
          y: this.gameEngine.mToken.y || 0
        };
      }
    }

    return raceData;
  }

  /**
   * Get current betting data
   */
  getCurrentBettingData() {
    if (!this.gameEngine || !this.gameEngine.bettingSystem) return null;

    const betting = this.gameEngine.bettingSystem;
    
    return {
      isActive: betting.isActive || false,
      timeRemaining: betting.timeRemaining || 0,
      totalPool: betting.getTotalPool?.() || 0,
      playerOdds: Array.from(betting.playerOdds?.entries() || []).map(([playerId, odds]) => ({
        playerId,
        odds,
        playerName: this.getPlayerNameById(playerId),
        totalBets: betting.totalBets?.get(playerId) || 0
      })),
      recentBets: (betting.recentBets || []).slice(-5).map(bet => ({
        playerId: bet.playerId,
        playerName: bet.playerName,
        amount: bet.amount,
        odds: bet.odds,
        timestamp: bet.timestamp
      }))
    };
  }

  /**
   * Get player data
   */
  getPlayerData() {
    if (!this.gameEngine || !this.gameEngine.players) return [];

    return this.gameEngine.players.map(player => ({
      id: player.id,
      name: player.name || player.username,
      isActive: player.active || false,
      isAI: player.isAI || false,
      statistics: {
        wins: player.wins || 0,
        gamesPlayed: player.gamesPlayed || 0,
        winRate: player.winRate || 0,
        totalEarnings: player.totalEarnings || 0
      },
      currentPosition: { x: player.x || 0, y: player.y || 0 },
      effects: {
        boosted: player.boosted || false,
        magnetized: player.magnetized || false,
        bubbleProtected: player.bubbleProtected || false,
        stunned: player.stunned || false
      }
    }));
  }

  /**
   * Get leaderboard data
   */
  getLeaderboardData() {
    if (!this.gameEngine || !this.gameEngine.leaderboard) return null;

    const lb = this.gameEngine.leaderboard;
    
    return {
      topPlayers: (lb.getTopPlayers?.(10) || []).map(player => ({
        id: player.id,
        name: player.name,
        wins: player.wins || 0,
        points: player.points || 0,
        winRate: player.winRate || 0,
        rank: player.rank || 0
      })),
      recentWinners: (lb.getRecentWinners?.(5) || []).map(winner => ({
        playerId: winner.playerId,
        playerName: winner.playerName,
        raceNumber: winner.raceNumber,
        timestamp: winner.timestamp,
        earnings: winner.earnings || 0
      }))
    };
  }

  /**
   * Get camera data
   */
  getCameraData() {
    if (!this.gameEngine || !this.gameEngine.cameraManager) return null;
    return this.gameEngine.cameraManager.getCameraInfo();
  }

  /**
   * Get game status
   */
  getGameStatus() {
    return {
      isRunning: !!this.gameEngine,
      currentScene: this.gameEngine?.currentScene?.scene?.key || 'unknown',
      connectedPlayers: this.gameEngine?.players?.length || 0,
      gameMode: this.gameEngine?.gameMode || 'standard',
      performance: {
        fps: this.gameEngine?.game?.loop?.actualFps || 0,
        frameTime: this.gameEngine?.game?.loop?.delta || 0
      }
    };
  }

  /**
   * Get tournament data
   */
  getTournamentData() {
    if (!this.gameEngine?.tournamentManager) return null;

    try {
      const tournaments = this.gameEngine.tournamentManager.listActiveTournaments();
      return tournaments.length > 0 ? tournaments[0] : null;
    } catch (error) {
      console.error('[StreamingWebSocket] Error getting tournament data:', error);
      return null;
    }
  }

  /**
   * Get tournament bracket data
   */
  getTournamentBracketData() {
    const tournament = this.getTournamentData();
    if (!tournament) return null;

    return {
      tournamentId: tournament.tournamentId,
      name: tournament.name,
      format: tournament.format,
      bracket: tournament.bracket,
      currentRound: tournament.currentRound,
      totalRounds: tournament.totalRounds,
      players: tournament.registeredPlayers
    };
  }

  /**
   * Get tournament standings data
   */
  getTournamentStandingsData() {
    const tournament = this.getTournamentData();
    if (!tournament) return null;

    const players = tournament.registeredPlayers || [];
    const sortedPlayers = [...players].sort((a, b) => {
      if (b.wins !== a.wins) return b.wins - a.wins;
      const aWinRate = a.wins / Math.max(a.wins + a.losses, 1);
      const bWinRate = b.wins / Math.max(b.wins + b.losses, 1);
      return bWinRate - aWinRate;
    });

    return {
      tournamentId: tournament.tournamentId,
      standings: sortedPlayers.map((player, index) => ({
        rank: index + 1,
        playerId: player.playerId,
        playerName: player.playerName,
        seed: player.seed,
        wins: player.wins || 0,
        losses: player.losses || 0,
        winRate: Math.round((player.wins / Math.max(player.wins + player.losses, 1)) * 100)
      }))
    };
  }

  /**
   * Get current tournament match data
   */
  getCurrentTournamentMatchData() {
    const tournament = this.getTournamentData();
    if (!tournament || !tournament.currentMatch) return null;

    return {
      match: tournament.currentMatch,
      tournament: {
        id: tournament.tournamentId,
        name: tournament.name,
        round: tournament.currentRound
      }
    };
  }

  /**
   * Get tournament commentary data
   */
  getTournamentCommentaryData() {
    const tournament = this.getTournamentData();
    if (!tournament) return null;

    // Get streaming integration commentary if available
    const streamingIntegration = this.gameEngine?.tournamentStreamingIntegration;
    if (streamingIntegration) {
      return streamingIntegration.getCommentaryData();
    }

    // Basic commentary data
    return {
      tournament: tournament,
      currentMatch: tournament.currentMatch,
      playerCount: tournament.registeredPlayers?.length || 0,
      completedMatches: this.getCompletedMatchCount(tournament),
      timestamp: Date.now()
    };
  }

  /**
   * Get completed match count
   */
  getCompletedMatchCount(tournament) {
    if (!tournament.bracket || !tournament.bracket.rounds) return 0;

    let completed = 0;
    tournament.bracket.rounds.forEach(round => {
      round.forEach(match => {
        if (match.status === 'completed') completed++;
      });
    });

    return completed;
  }

  /**
   * Get player name by ID
   */
  getPlayerNameById(playerId) {
    if (!this.gameEngine || !this.gameEngine.players) return `Player ${playerId}`;
    
    const player = this.gameEngine.players.find(p => p.id === playerId);
    return player ? (player.name || player.username) : `Player ${playerId}`;
  }

  /**
   * Check if stream name is valid
   */
  isValidStream(stream) {
    const validStreams = [
      'race', 'betting', 'players', 'leaderboard', 'camera', 'gameStatus',
      'tournament', 'tournamentBracket', 'tournamentStandings', 'tournamentMatch', 'tournamentCommentary'
    ];
    return validStreams.includes(stream);
  }

  /**
   * Get connected clients info
   */
  getClientsInfo() {
    const clientsInfo = [];
    
    this.clients.forEach((client, socketId) => {
      clientsInfo.push({
        id: socketId,
        subscriptions: Array.from(client.subscriptions),
        joinedAt: client.joinedAt,
        lastPing: client.lastPing,
        overlayConfig: client.overlayConfig || null,
        customUpdateRate: client.customUpdateRate || null
      });
    });

    return clientsInfo;
  }

  /**
   * Broadcast message to all clients
   */
  broadcastToAll(event, data) {
    this.io.emit(event, {
      data,
      timestamp: Date.now()
    });
  }

  /**
   * Stop all update loops
   */
  stopUpdateLoops() {
    this.updateIntervals.forEach((interval, name) => {
      clearInterval(interval);
      console.log(`[StreamingWebSocket] Stopped ${name} update loop`);
    });
    this.updateIntervals.clear();
  }

  /**
   * Destroy WebSocket server
   */
  destroy() {
    console.log('[StreamingWebSocket] Destroying WebSocket server');
    
    this.stopUpdateLoops();
    
    // Disconnect all clients
    this.clients.forEach((client) => {
      client.socket.disconnect(true);
    });
    this.clients.clear();
    
    if (this.io) {
      this.io.close();
      this.io = null;
    }
    
    console.log('[StreamingWebSocket] WebSocket server destroyed');
  }
}

export default StreamingWebSocket;