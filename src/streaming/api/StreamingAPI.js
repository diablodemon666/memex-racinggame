/**
 * StreamingAPI.js - REST API endpoints for streaming data
 * 
 * Provides HTTP endpoints for race data, betting information, and player statistics
 * for external streaming tools and OBS browser sources.
 */

import express from 'express';
import cors from 'cors';
import { rateLimiters, securityHeaders, validateInput } from '../../server/middleware/security.js';
import { optionalAuthenticateJWT } from '../../server/middleware/auth.js';

export class StreamingAPI {
  constructor(gameEngine, port = 3001) {
    this.gameEngine = gameEngine;
    this.port = port;
    this.app = express();
    this.server = null;
    
    // Data cache
    this.dataCache = {
      race: null,
      betting: null,
      players: null,
      leaderboard: null,
      lastUpdated: Date.now()
    };
    
    this.cacheTimeout = 1000; // 1 second cache
    
    // Setup middleware
    this.setupMiddleware();
    
    // Setup routes
    this.setupRoutes();
    
    console.log('[StreamingAPI] Streaming API initialized');
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
   * Setup Express middleware
   */
  setupMiddleware() {
    // SECURITY FIX: Environment-based CORS configuration
    const allowedOrigins = this.getAllowedOrigins();
    
    this.app.use(cors({
      origin: (origin, callback) => {
        // Allow requests with no origin (mobile apps, etc.)
        if (!origin) return callback(null, true);
        
        if (allowedOrigins.includes(origin)) {
          return callback(null, true);
        }
        
        console.warn(`[StreamingAPI] CORS blocked origin: ${origin}`);
        return callback(new Error('Not allowed by CORS policy'), false);
      },
      methods: ['GET', 'POST', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
      credentials: false,
      maxAge: 86400 // 24 hours
    }));

    // Security middleware
    this.app.use(securityHeaders);
    this.app.use(validateInput);
    this.app.use(rateLimiters.streaming);

    // Parse JSON requests
    this.app.use(express.json({ limit: '1mb' }));

    // Request logging middleware
    this.app.use((req, res, next) => {
      console.log(`[StreamingAPI] ${req.method} ${req.path} - ${req.ip}`);
      next();
    });

    // Error handling middleware
    this.app.use((error, req, res, next) => {
      console.error('[StreamingAPI] Request error:', error);
      res.status(500).json({
        error: 'Internal server error',
        message: error.message
      });
    });
  }

  /**
   * Setup API routes
   */
  setupRoutes() {
    // Health check endpoint
    this.app.get('/health', (req, res) => {
      res.json({
        status: 'healthy',
        timestamp: Date.now(),
        uptime: process.uptime(),
        gameConnected: !!this.gameEngine
      });
    });

    // Current race data
    this.app.get('/api/race/current', optionalAuthenticateJWT, (req, res) => {
      try {
        const raceData = this.getCurrentRaceData();
        res.json({
          success: true,
          data: raceData,
          timestamp: Date.now()
        });
      } catch (error) {
        res.status(500).json({
          success: false,
          error: error.message
        });
      }
    });

    // Race statistics
    this.app.get('/api/race/stats', optionalAuthenticateJWT, (req, res) => {
      try {
        const stats = this.getRaceStatistics();
        res.json({
          success: true,
          data: stats,
          timestamp: Date.now()
        });
      } catch (error) {
        res.status(500).json({
          success: false,
          error: error.message
        });
      }
    });

    // Current betting information
    this.app.get('/api/betting/current', optionalAuthenticateJWT, (req, res) => {
      try {
        const bettingData = this.getCurrentBettingData();
        res.json({
          success: true,
          data: bettingData,
          timestamp: Date.now()
        });
      } catch (error) {
        res.status(500).json({
          success: false,
          error: error.message
        });
      }
    });

    // Player information
    this.app.get('/api/players', (req, res) => {
      try {
        const players = this.getPlayerData();
        res.json({
          success: true,
          data: players,
          timestamp: Date.now()
        });
      } catch (error) {
        res.status(500).json({
          success: false,
          error: error.message
        });
      }
    });

    // Specific player data
    this.app.get('/api/players/:playerId', (req, res) => {
      try {
        const player = this.getPlayerById(req.params.playerId);
        if (!player) {
          return res.status(404).json({
            success: false,
            error: 'Player not found'
          });
        }

        res.json({
          success: true,
          data: player,
          timestamp: Date.now()
        });
      } catch (error) {
        res.status(500).json({
          success: false,
          error: error.message
        });
      }
    });

    // Leaderboard data
    this.app.get('/api/leaderboard', (req, res) => {
      try {
        const leaderboard = this.getLeaderboardData();
        res.json({
          success: true,
          data: leaderboard,
          timestamp: Date.now()
        });
      } catch (error) {
        res.status(500).json({
          success: false,
          error: error.message
        });
      }
    });

    // Game status
    this.app.get('/api/game/status', (req, res) => {
      try {
        const status = this.getGameStatus();
        res.json({
          success: true,
          data: status,
          timestamp: Date.now()
        });
      } catch (error) {
        res.status(500).json({
          success: false,
          error: error.message
        });
      }
    });

    // Camera information
    this.app.get('/api/camera/info', (req, res) => {
      try {
        const cameraInfo = this.getCameraInfo();
        res.json({
          success: true,
          data: cameraInfo,
          timestamp: Date.now()
        });
      } catch (error) {
        res.status(500).json({
          success: false,
          error: error.message
        });
      }
    });

    // Camera control endpoint (requires authentication)
    this.app.post('/api/camera/control', rateLimiters.sensitive, optionalAuthenticateJWT, (req, res) => {
      try {
        const result = this.controlCamera(req.body);
        res.json({
          success: true,
          data: result,
          timestamp: Date.now()
        });
      } catch (error) {
        res.status(400).json({
          success: false,
          error: error.message
        });
      }
    });

    // All streaming data in one endpoint (for overlay efficiency)
    this.app.get('/api/streaming/all', (req, res) => {
      try {
        const allData = this.getAllStreamingData();
        res.json({
          success: true,
          data: allData,
          timestamp: Date.now()
        });
      } catch (error) {
        res.status(500).json({
          success: false,
          error: error.message
        });
      }
    });

    // Tournament API endpoints
    this.app.get('/api/tournament/current', (req, res) => {
      try {
        const tournamentData = this.getCurrentTournamentData();
        res.json({
          success: true,
          data: tournamentData,
          timestamp: Date.now()
        });
      } catch (error) {
        res.status(500).json({
          success: false,
          error: error.message
        });
      }
    });

    this.app.get('/api/tournament/bracket', (req, res) => {
      try {
        const bracketData = this.getTournamentBracketData();
        res.json({
          success: true,
          data: bracketData,
          timestamp: Date.now()
        });
      } catch (error) {
        res.status(500).json({
          success: false,
          error: error.message
        });
      }
    });

    this.app.get('/api/tournament/standings', (req, res) => {
      try {
        const standingsData = this.getTournamentStandingsData();
        res.json({
          success: true,
          data: standingsData,
          timestamp: Date.now()
        });
      } catch (error) {
        res.status(500).json({
          success: false,
          error: error.message
        });
      }
    });

    this.app.get('/api/tournament/match/:matchId', (req, res) => {
      try {
        const matchData = this.getTournamentMatchData(req.params.matchId);
        if (!matchData) {
          return res.status(404).json({
            success: false,
            error: 'Match not found'
          });
        }
        res.json({
          success: true,
          data: matchData,
          timestamp: Date.now()
        });
      } catch (error) {
        res.status(500).json({
          success: false,
          error: error.message
        });
      }
    });

    this.app.get('/api/tournament/commentary', (req, res) => {
      try {
        const commentaryData = this.getTournamentCommentaryData();
        res.json({
          success: true,
          data: commentaryData,
          timestamp: Date.now()
        });
      } catch (error) {
        res.status(500).json({
          success: false,
          error: error.message
        });
      }
    });

    // Tournament overlay endpoints
    this.app.get('/tournament/overlay/bracket', (req, res) => {
      res.sendFile('tournament-bracket.html', { root: './src/streaming/overlays' });
    });

    this.app.get('/tournament/overlay/current-match', (req, res) => {
      res.sendFile('tournament-match.html', { root: './src/streaming/overlays' });
    });

    this.app.get('/tournament/overlay/standings', (req, res) => {
      res.sendFile('tournament-standings.html', { root: './src/streaming/overlays' });
    });

    this.app.get('/tournament/overlay/schedule', (req, res) => {
      res.sendFile('tournament-schedule.html', { root: './src/streaming/overlays' });
    });

    this.app.get('/tournament/overlay/winner', (req, res) => {
      res.sendFile('tournament-winner.html', { root: './src/streaming/overlays' });
    });

    this.app.get('/tournament/overlay/player-profiles', (req, res) => {
      res.sendFile('tournament-player-profiles.html', { root: './src/streaming/overlays' });
    });

    // Static overlay files
    this.app.get('/streaming/overlay', (req, res) => {
      res.sendFile('overlay.html', { root: './src/streaming/overlays' });
    });

    this.app.get('/streaming/overlay/styles.css', (req, res) => {
      res.sendFile('styles.css', { root: './src/streaming/overlays' });
    });

    this.app.get('/streaming/overlay/script.js', (req, res) => {
      res.sendFile('script.js', { root: './src/streaming/overlays' });
    });
  }

  /**
   * Get current race data
   */
  getCurrentRaceData() {
    // Check cache first
    if (this.dataCache.race && (Date.now() - this.dataCache.lastUpdated < this.cacheTimeout)) {
      return this.dataCache.race;
    }

    const raceData = {
      isActive: false,
      phase: 'waiting', // waiting, betting, racing, finished
      timeRemaining: 0,
      raceNumber: 0,
      currentMap: null,
      players: [],
      mTokenPosition: null,
      raceProgress: 0
    };

    if (this.gameEngine && this.gameEngine.currentRace) {
      const race = this.gameEngine.currentRace;
      
      raceData.isActive = race.isActive || false;
      raceData.phase = race.phase || 'waiting';
      raceData.timeRemaining = race.timeRemaining || 300; // 5 minutes default
      raceData.raceNumber = race.raceNumber || 0;
      raceData.currentMap = race.currentMap || null;
      raceData.raceProgress = race.progress || 0;

      // Get player positions
      if (this.gameEngine.players) {
        raceData.players = this.gameEngine.players.map(player => ({
          id: player.id,
          name: player.name || player.username,
          position: {
            x: player.x || 0,
            y: player.y || 0
          },
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

      // Get M token position
      if (this.gameEngine.mToken) {
        raceData.mTokenPosition = {
          x: this.gameEngine.mToken.x || 0,
          y: this.gameEngine.mToken.y || 0
        };
      }
    }

    // Cache the result
    this.dataCache.race = raceData;
    this.dataCache.lastUpdated = Date.now();

    return raceData;
  }

  /**
   * Get race statistics
   */
  getRaceStatistics() {
    return {
      totalRaces: this.gameEngine?.statistics?.totalRaces || 0,
      averageRaceTime: this.gameEngine?.statistics?.averageRaceTime || 0,
      fastestRace: this.gameEngine?.statistics?.fastestRace || 0,
      slowestRace: this.gameEngine?.statistics?.slowestRace || 0,
      totalBetsPlaced: this.gameEngine?.statistics?.totalBets || 0,
      totalMoneyWagered: this.gameEngine?.statistics?.totalWagered || 0
    };
  }

  /**
   * Get current betting data
   */
  getCurrentBettingData() {
    // Check cache first
    if (this.dataCache.betting && (Date.now() - this.dataCache.lastUpdated < this.cacheTimeout)) {
      return this.dataCache.betting;
    }

    const bettingData = {
      isActive: false,
      timeRemaining: 0,
      totalPool: 0,
      playerOdds: [],
      topBets: [],
      recentBets: []
    };

    // Get betting information from UI manager or betting system
    if (this.gameEngine && this.gameEngine.bettingSystem) {
      const betting = this.gameEngine.bettingSystem;
      
      bettingData.isActive = betting.isActive || false;
      bettingData.timeRemaining = betting.timeRemaining || 0;
      bettingData.totalPool = betting.getTotalPool?.() || 0;

      // Get player odds
      if (betting.playerOdds) {
        bettingData.playerOdds = Array.from(betting.playerOdds.entries()).map(([playerId, odds]) => ({
          playerId,
          odds,
          playerName: this.getPlayerNameById(playerId),
          totalBets: betting.totalBets?.get(playerId) || 0
        }));
      }

      // Get recent bets (if available)
      if (betting.recentBets) {
        bettingData.recentBets = betting.recentBets.slice(-10).map(bet => ({
          playerId: bet.playerId,
          playerName: bet.playerName,
          amount: bet.amount,
          odds: bet.odds,
          timestamp: bet.timestamp
        }));
      }
    }

    // Cache the result
    this.dataCache.betting = bettingData;
    this.dataCache.lastUpdated = Date.now();

    return bettingData;
  }

  /**
   * Get player data
   */
  getPlayerData() {
    if (!this.gameEngine || !this.gameEngine.players) {
      return [];
    }

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
      currentPosition: {
        x: player.x || 0,
        y: player.y || 0
      },
      effects: {
        boosted: player.boosted || false,
        magnetized: player.magnetized || false,
        bubbleProtected: player.bubbleProtected || false,
        stunned: player.stunned || false
      }
    }));
  }

  /**
   * Get player by ID
   */
  getPlayerById(playerId) {
    if (!this.gameEngine || !this.gameEngine.players) {
      return null;
    }

    const player = this.gameEngine.players.find(p => p.id === playerId);
    if (!player) return null;

    return {
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
      currentPosition: {
        x: player.x || 0,
        y: player.y || 0
      },
      effects: {
        boosted: player.boosted || false,
        magnetized: player.magnetized || false,
        bubbleProtected: player.bubbleProtected || false,
        stunned: player.stunned || false
      }
    };
  }

  /**
   * Get player name by ID
   */
  getPlayerNameById(playerId) {
    const player = this.getPlayerById(playerId);
    return player ? player.name : `Player ${playerId}`;
  }

  /**
   * Get leaderboard data
   */
  getLeaderboardData() {
    // Check cache first
    if (this.dataCache.leaderboard && (Date.now() - this.dataCache.lastUpdated < this.cacheTimeout)) {
      return this.dataCache.leaderboard;
    }

    const leaderboard = {
      topPlayers: [],
      recentWinners: [],
      biggestWins: []
    };

    if (this.gameEngine && this.gameEngine.leaderboard) {
      const lb = this.gameEngine.leaderboard;
      
      // Top players by points/wins
      leaderboard.topPlayers = (lb.getTopPlayers?.(10) || []).map(player => ({
        id: player.id,
        name: player.name,
        wins: player.wins || 0,
        points: player.points || 0,
        winRate: player.winRate || 0,
        rank: player.rank || 0
      }));

      // Recent race winners
      leaderboard.recentWinners = (lb.getRecentWinners?.(5) || []).map(winner => ({
        playerId: winner.playerId,
        playerName: winner.playerName,
        raceNumber: winner.raceNumber,
        timestamp: winner.timestamp,
        earnings: winner.earnings || 0
      }));

      // Biggest betting wins
      leaderboard.biggestWins = (lb.getBiggestWins?.(5) || []).map(win => ({
        playerId: win.playerId,
        playerName: win.playerName,
        amount: win.amount,
        odds: win.odds,
        timestamp: win.timestamp
      }));
    }

    // Cache the result
    this.dataCache.leaderboard = leaderboard;
    this.dataCache.lastUpdated = Date.now();

    return leaderboard;
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
      version: this.gameEngine?.version || '1.0.0',
      uptime: process.uptime(),
      memoryUsage: process.memoryUsage(),
      performance: {
        fps: this.gameEngine?.game?.loop?.actualFps || 0,
        frameTime: this.gameEngine?.game?.loop?.delta || 0
      }
    };
  }

  /**
   * Get camera information
   */
  getCameraInfo() {
    if (!this.gameEngine || !this.gameEngine.cameraManager) {
      return null;
    }

    return this.gameEngine.cameraManager.getCameraInfo();
  }

  /**
   * Control camera
   */
  controlCamera(command) {
    if (!this.gameEngine || !this.gameEngine.cameraManager) {
      throw new Error('Camera manager not available');
    }

    const cameraManager = this.gameEngine.cameraManager;

    switch (command.type) {
      case 'setMode':
        cameraManager.setMode(command.mode, command.options);
        return { success: true, mode: command.mode };

      case 'followPlayer':
        if (!command.playerId) {
          throw new Error('Player ID required for followPlayer command');
        }
        cameraManager.setMode('follow_player', { playerId: command.playerId });
        return { success: true, following: command.playerId };

      case 'setPreset':
        if (!command.presetName) {
          throw new Error('Preset name required for setPreset command');
        }
        const preset = cameraManager.getPreset(command.presetName);
        if (!preset) {
          throw new Error(`Preset not found: ${command.presetName}`);
        }
        preset.applyTo(cameraManager);
        return { success: true, preset: command.presetName };

      case 'setPosition':
        if (!command.position || typeof command.position.x !== 'number' || typeof command.position.y !== 'number') {
          throw new Error('Valid position coordinates required');
        }
        cameraManager.setPosition(command.position, { smooth: command.smooth || true });
        return { success: true, position: command.position };

      case 'setZoom':
        if (typeof command.zoom !== 'number') {
          throw new Error('Valid zoom level required');
        }
        cameraManager.setZoom(command.zoom, { smooth: command.smooth || true });
        return { success: true, zoom: command.zoom };

      default:
        throw new Error(`Unknown camera command: ${command.type}`);
    }
  }

  /**
   * Get current tournament data
   */
  getCurrentTournamentData() {
    if (!this.gameEngine?.tournamentManager) {
      return null;
    }

    try {
      const tournaments = this.gameEngine.tournamentManager.listActiveTournaments();
      const activeTournament = tournaments.length > 0 ? tournaments[0] : null;

      if (!activeTournament) {
        return null;
      }

      return {
        tournament: activeTournament,
        status: activeTournament.status,
        currentRound: activeTournament.currentRound,
        totalRounds: activeTournament.totalRounds,
        players: activeTournament.registeredPlayers?.length || 0,
        maxPlayers: activeTournament.maxPlayers,
        currentMatch: activeTournament.currentMatch,
        bracket: activeTournament.bracket
      };
    } catch (error) {
      console.error('[StreamingAPI] Error getting tournament data:', error);
      return null;
    }
  }

  /**
   * Get tournament bracket data
   */
  getTournamentBracketData() {
    const tournamentData = this.getCurrentTournamentData();
    if (!tournamentData) return null;

    return {
      tournamentId: tournamentData.tournament.tournamentId,
      name: tournamentData.tournament.name,
      format: tournamentData.tournament.format,
      bracket: tournamentData.bracket,
      currentRound: tournamentData.currentRound,
      totalRounds: tournamentData.totalRounds,
      players: tournamentData.tournament.registeredPlayers,
      matches: this.getAllTournamentMatches(tournamentData.bracket)
    };
  }

  /**
   * Get tournament standings data
   */
  getTournamentStandingsData() {
    const tournamentData = this.getCurrentTournamentData();
    if (!tournamentData) return null;

    const players = tournamentData.tournament.registeredPlayers || [];
    
    // Sort players by wins, then by win rate
    const sortedPlayers = [...players].sort((a, b) => {
      if (b.wins !== a.wins) return b.wins - a.wins;
      const aWinRate = a.wins / Math.max(a.wins + a.losses, 1);
      const bWinRate = b.wins / Math.max(b.wins + b.losses, 1);
      return bWinRate - aWinRate;
    });

    return {
      tournamentId: tournamentData.tournament.tournamentId,
      standings: sortedPlayers.map((player, index) => ({
        rank: index + 1,
        playerId: player.playerId,
        playerName: player.playerName,
        seed: player.seed,
        wins: player.wins || 0,
        losses: player.losses || 0,
        winRate: Math.round((player.wins / Math.max(player.wins + player.losses, 1)) * 100),
        status: this.getPlayerTournamentStatus(player, tournamentData.tournament)
      })),
      lastUpdated: Date.now()
    };
  }

  /**
   * Get tournament match data
   */
  getTournamentMatchData(matchId) {
    const tournamentData = this.getCurrentTournamentData();
    if (!tournamentData || !tournamentData.bracket) return null;

    // Find match in bracket
    let match = null;
    tournamentData.bracket.rounds?.forEach(round => {
      const foundMatch = round.find(m => m.matchId === matchId);
      if (foundMatch) match = foundMatch;
    });

    if (!match) return null;

    return {
      match: match,
      players: match.players.map(playerId => {
        const player = tournamentData.tournament.registeredPlayers?.find(p => p.playerId === playerId);
        return player ? {
          playerId: player.playerId,
          playerName: player.playerName,
          seed: player.seed,
          stats: player.tournamentStats || {}
        } : { playerId, playerName: `Player ${playerId}`, seed: 0, stats: {} };
      }),
      predictions: this.getMatchPredictions(match, tournamentData.tournament),
      history: this.getPlayerHistory(match.players, tournamentData.tournament)
    };
  }

  /**
   * Get tournament commentary data
   */
  getTournamentCommentaryData() {
    const tournamentData = this.getCurrentTournamentData();
    if (!tournamentData) return null;

    // Get tournament streaming integration if available
    const streamingIntegration = this.gameEngine?.tournamentStreamingIntegration;
    
    if (streamingIntegration) {
      return streamingIntegration.getCommentaryData();
    }

    // Fallback basic commentary data
    return {
      tournament: tournamentData.tournament,
      currentMatch: tournamentData.currentMatch,
      playerStats: this.generateBasicPlayerStats(tournamentData.tournament.registeredPlayers),
      recentMatches: this.getRecentMatches(tournamentData.bracket),
      keyStatistics: this.generateTournamentStatistics(tournamentData.tournament)
    };
  }

  /**
   * Get all tournament matches from bracket
   */
  getAllTournamentMatches(bracket) {
    if (!bracket || !bracket.rounds) return [];

    const allMatches = [];
    bracket.rounds.forEach((round, roundIndex) => {
      round.forEach(match => {
        allMatches.push({
          ...match,
          roundIndex: roundIndex + 1,
          roundName: this.getRoundName(roundIndex, bracket.rounds.length)
        });
      });
    });

    return allMatches;
  }

  /**
   * Get round name based on round index and total rounds
   */
  getRoundName(roundIndex, totalRounds) {
    const remaining = totalRounds - roundIndex;
    
    if (remaining === 1) return 'Final';
    if (remaining === 2) return 'Semifinals';
    if (remaining === 3) return 'Quarterfinals';
    return `Round ${roundIndex + 1}`;
  }

  /**
   * Get player tournament status
   */
  getPlayerTournamentStatus(player, tournament) {
    if (!tournament.bracket) return 'active';

    // Check player's current status in tournament
    const allMatches = this.getAllTournamentMatches(tournament.bracket);
    const playerMatches = allMatches.filter(match => match.players.includes(player.playerId));
    
    const completedMatches = playerMatches.filter(match => match.status === 'completed');
    const activeMatches = playerMatches.filter(match => match.status === 'active');
    const pendingMatches = playerMatches.filter(match => match.status === 'pending');

    if (activeMatches.length > 0) return 'active';
    if (pendingMatches.length > 0) return 'waiting';
    
    // Check if eliminated
    const lastMatch = completedMatches[completedMatches.length - 1];
    if (lastMatch && lastMatch.winner !== player.playerId) return 'eliminated';
    
    return 'advancing';
  }

  /**
   * Generate basic player stats for commentary
   */
  generateBasicPlayerStats(players) {
    if (!players) return [];

    return players.map(player => ({
      playerId: player.playerId,
      playerName: player.playerName,
      seed: player.seed,
      wins: player.wins || 0,
      losses: player.losses || 0,
      winRate: (player.wins || 0) / Math.max((player.wins || 0) + (player.losses || 0), 1),
      averageFinishPosition: player.averageFinishPosition || 0,
      strongestSkill: player.strongestSkill || 'Unknown',
      favoriteMap: player.favoriteMap || 'Unknown'
    }));
  }

  /**
   * Get recent matches from bracket
   */
  getRecentMatches(bracket) {
    if (!bracket || !bracket.rounds) return [];

    const recentMatches = [];
    bracket.rounds.forEach(round => {
      round.forEach(match => {
        if (match.status === 'completed') {
          recentMatches.push({
            ...match,
            completedAt: match.completedAt || Date.now()
          });
        }
      });
    });

    return recentMatches
      .sort((a, b) => (b.completedAt || 0) - (a.completedAt || 0))
      .slice(0, 10);
  }

  /**
   * Generate tournament statistics
   */
  generateTournamentStatistics(tournament) {
    const stats = {
      totalPlayers: tournament.registeredPlayers?.length || 0,
      totalMatches: 0,
      completedMatches: 0,
      averageMatchDuration: 0,
      upsets: 0,
      dominantPlayer: null
    };

    if (tournament.bracket && tournament.bracket.rounds) {
      tournament.bracket.rounds.forEach(round => {
        round.forEach(match => {
          stats.totalMatches++;
          if (match.status === 'completed') {
            stats.completedMatches++;
            if (match.duration) {
              stats.averageMatchDuration = 
                (stats.averageMatchDuration * (stats.completedMatches - 1) + match.duration) / 
                stats.completedMatches;
            }
          }
        });
      });
    }

    return stats;
  }

  /**
   * Get match predictions (basic implementation)
   */
  getMatchPredictions(match, tournament) {
    if (!match.players || match.players.length < 2) return null;

    const player1 = tournament.registeredPlayers?.find(p => p.playerId === match.players[0]);
    const player2 = tournament.registeredPlayers?.find(p => p.playerId === match.players[1]);

    if (!player1 || !player2) return null;

    // Simple prediction based on seeds and win rates
    const player1WinRate = (player1.wins || 0) / Math.max((player1.wins || 0) + (player1.losses || 0), 1);
    const player2WinRate = (player2.wins || 0) / Math.max((player2.wins || 0) + (player2.losses || 0), 1);

    const seedFactor = (player2.seed - player1.seed) / Math.max(player1.seed, player2.seed);
    const winRateFactor = player1WinRate - player2WinRate;

    const player1Probability = Math.max(0.1, Math.min(0.9, 0.5 + (seedFactor * 0.3) + (winRateFactor * 0.7)));

    return {
      matchId: match.matchId,
      predictions: [
        {
          playerId: player1.playerId,
          probability: player1Probability,
          favored: player1Probability > 0.5
        },
        {
          playerId: player2.playerId,
          probability: 1 - player1Probability,
          favored: player1Probability < 0.5
        }
      ]
    };
  }

  /**
   * Get player history
   */
  getPlayerHistory(playerIds, tournament) {
    if (!playerIds || !tournament.bracket) return [];

    const history = [];
    const allMatches = this.getAllTournamentMatches(tournament.bracket);

    playerIds.forEach(playerId => {
      const playerMatches = allMatches
        .filter(match => match.players.includes(playerId) && match.status === 'completed')
        .sort((a, b) => (b.completedAt || 0) - (a.completedAt || 0));

      history.push({
        playerId,
        recentMatches: playerMatches.slice(0, 5),
        wins: playerMatches.filter(match => match.winner === playerId).length,
        losses: playerMatches.filter(match => match.winner && match.winner !== playerId).length
      });
    });

    return history;
  }

  /**
   * Get all streaming data in one call (updated with tournament data)
   */
  getAllStreamingData() {
    return {
      race: this.getCurrentRaceData(),
      betting: this.getCurrentBettingData(),
      players: this.getPlayerData(),
      leaderboard: this.getLeaderboardData(),
      gameStatus: this.getGameStatus(),
      camera: this.getCameraInfo(),
      tournament: this.getCurrentTournamentData(),
      tournamentBracket: this.getTournamentBracketData(),
      tournamentStandings: this.getTournamentStandingsData(),
      tournamentCommentary: this.getTournamentCommentaryData()
    };
  }

  /**
   * Start the API server
   */
  async start() {
    return new Promise((resolve, reject) => {
      try {
        this.server = this.app.listen(this.port, () => {
          console.log(`[StreamingAPI] Server started on port ${this.port}`);
          resolve(true);
        });

        this.server.on('error', (error) => {
          console.error('[StreamingAPI] Server error:', error);
          reject(error);
        });

      } catch (error) {
        console.error('[StreamingAPI] Failed to start server:', error);
        reject(error);
      }
    });
  }

  /**
   * Stop the API server
   */
  async stop() {
    return new Promise((resolve) => {
      if (this.server) {
        this.server.close(() => {
          console.log('[StreamingAPI] Server stopped');
          this.server = null;
          resolve(true);
        });
      } else {
        resolve(true);
      }
    });
  }

  /**
   * Clear data cache
   */
  clearCache() {
    this.dataCache = {
      race: null,
      betting: null,
      players: null,
      leaderboard: null,
      lastUpdated: Date.now()
    };
    console.log('[StreamingAPI] Data cache cleared');
  }

  /**
   * Get server status
   */
  getServerStatus() {
    return {
      isRunning: !!this.server,
      port: this.port,
      cacheTimeout: this.cacheTimeout,
      lastCacheUpdate: this.dataCache.lastUpdated
    };
  }

  /**
   * Destroy the streaming API
   */
  async destroy() {
    console.log('[StreamingAPI] Destroying streaming API');
    await this.stop();
    this.clearCache();
    this.gameEngine = null;
    console.log('[StreamingAPI] Streaming API destroyed');
  }
}

export default StreamingAPI;