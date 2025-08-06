/**
 * TournamentStreamingIntegration.js - Bridge between tournament system and streaming
 * 
 * Provides seamless integration between the tournament management system and 
 * streaming infrastructure for automated tournament broadcasting with OBS.
 * Handles real-time data flow, scene management, and commentary support.
 */

import { multiplayerEvents } from '../multiplayer/MultiplayerEvents.js';
import TournamentOverlay from '../streaming/TournamentOverlay.js';

/**
 * Tournament streaming states
 */
export const TournamentStreamingStates = {
  OFFLINE: 'offline',
  STANDBY: 'standby',
  REGISTRATION: 'registration',
  BRACKET_PREVIEW: 'bracket_preview',
  MATCH_PREPARATION: 'match_preparation',
  MATCH_ACTIVE: 'match_active',
  MATCH_RESULTS: 'match_results',
  ROUND_TRANSITION: 'round_transition',
  TOURNAMENT_COMPLETE: 'tournament_complete'
};

/**
 * Camera preset configurations for tournament matches
 */
export const TournamentCameraPresets = {
  OVERVIEW: {
    mode: 'overview',
    zoom: 0.7,
    position: { x: 0, y: 0 },
    smooth: true
  },
  
  FOLLOW_LEADER: {
    mode: 'follow_leader',
    options: { dynamicZoom: true, leadMargin: 100 }
  },
  
  DRAMATIC_FINISH: {
    mode: 'token_focus',
    zoom: 1.2,
    options: { trackNearestPlayers: true }
  },
  
  BRACKET_OVERVIEW: {
    mode: 'static',
    zoom: 0.5,
    position: { x: 0, y: 0 }
  }
};

export class TournamentStreamingIntegration {
  constructor(tournamentManager, obsOverlay, gameEngine) {
    this.tournamentManager = tournamentManager;
    this.obsOverlay = obsOverlay;
    this.gameEngine = gameEngine;
    
    // Tournament overlay system
    this.tournamentOverlay = null;
    
    // Streaming state
    this.streamingState = TournamentStreamingStates.OFFLINE;
    this.activeTournament = null;
    this.currentMatch = null;
    this.streamingEnabled = false;
    
    // Commentary support
    this.commentaryData = {
      playerStats: new Map(),
      matchHistory: [],
      predictions: new Map(),
      keyMoments: []
    };
    
    // Auto-switching configuration
    this.autoSwitching = {
      enabled: true,
      sceneTransitionDelay: 2000,
      cameraPresetDelay: 1000,
      celebrationDuration: 5000
    };
    
    // Performance tracking
    this.matchAnalytics = {
      averageMatchDuration: 0,
      totalMatches: 0,
      upsetCount: 0,
      comebackWins: 0
    };
    
    console.log('[TournamentStreamingIntegration] Integration system initialized');
    
    // Initialize when OBS is connected
    this.initializeWhenReady();
  }

  /**
   * Initialize when OBS and tournament systems are ready
   */
  async initializeWhenReady() {
    if (this.obsOverlay.isAuthenticated) {
      await this.initialize();
    } else {
      this.obsOverlay.on('obs-connected', () => this.initialize());
    }
  }

  /**
   * Initialize tournament streaming integration
   */
  async initialize() {
    try {
      console.log('[TournamentStreamingIntegration] Initializing tournament streaming');
      
      // Create tournament overlay system
      this.tournamentOverlay = new TournamentOverlay(this.obsOverlay, this.tournamentManager);
      await this.tournamentOverlay.initialize();
      
      // Setup event listeners
      this.setupEventListeners();
      
      // Initialize WebSocket endpoints for tournament data
      this.setupTournamentWebSocketEndpoints();
      
      // Set initial state
      this.streamingState = TournamentStreamingStates.STANDBY;
      
      console.log('[TournamentStreamingIntegration] Tournament streaming integration ready');
      
    } catch (error) {
      console.error('[TournamentStreamingIntegration] Initialization failed:', error);
      throw error;
    }
  }

  /**
   * Setup event listeners for tournament and streaming events
   */
  setupEventListeners() {
    // Tournament management events
    multiplayerEvents.on('TOURNAMENT_CREATED', (data) => {
      this.handleTournamentCreated(data.tournament);
    });

    multiplayerEvents.on('TOURNAMENT_STARTED', (data) => {
      this.handleTournamentStarted(data.tournament);
    });

    multiplayerEvents.on('TOURNAMENT_PLAYER_REGISTERED', (data) => {
      this.handlePlayerRegistered(data.player, data.tournament);
    });

    multiplayerEvents.on('TOURNAMENT_MATCH_STARTED', (data) => {
      this.handleMatchStarted(data.match, data.tournament);
    });

    multiplayerEvents.on('TOURNAMENT_MATCH_COMPLETED', (data) => {
      this.handleMatchCompleted(data.match, data.tournament);
    });

    multiplayerEvents.on('TOURNAMENT_ROUND_COMPLETED', (data) => {
      this.handleRoundCompleted(data.round, data.tournament);
    });

    multiplayerEvents.on('TOURNAMENT_COMPLETED', (data) => {
      this.handleTournamentCompleted(data.tournament, data.winner);
    });

    // Game state events for race integration
    if (this.gameEngine) {
      this.gameEngine.on?.('race-started', (data) => {
        if (this.currentMatch && data.isTournamentMatch) {
          this.handleRaceStarted(data);
        }
      });

      this.gameEngine.on?.('race-finished', (data) => {
        if (this.currentMatch && data.isTournamentMatch) {
          this.handleRaceFinished(data);
        }
      });

      this.gameEngine.on?.('player-eliminated', (data) => {
        if (this.currentMatch && data.isTournamentMatch) {
          this.handlePlayerEliminated(data);
        }
      });
    }

    // OBS events
    this.obsOverlay.on('scene-changed', (data) => {
      this.handleSceneChanged(data);
    });
  }

  /**
   * Setup WebSocket endpoints for tournament streaming data
   */
  setupTournamentWebSocketEndpoints() {
    // Extend existing streaming WebSocket with tournament data
    if (this.obsOverlay.gameEngine?.streamingWebSocket) {
      const ws = this.obsOverlay.gameEngine.streamingWebSocket;
      
      // Add tournament data streams
      const originalGetCurrentData = ws.getCurrentRaceData?.bind(ws);
      ws.getCurrentTournamentData = () => this.getTournamentStreamingData();
      
      // Add tournament-specific WebSocket events
      ws.io?.on('connection', (socket) => {
        socket.on('tournament-subscribe', (data) => {
          this.handleTournamentSubscription(socket, data);
        });
        
        socket.on('tournament-camera-control', (data) => {
          this.handleTournamentCameraControl(socket, data);
        });
        
        socket.on('tournament-scene-request', (data) => {
          this.handleTournamentSceneRequest(socket, data);
        });
      });
    }
  }

  /**
   * Tournament event handlers
   */
  async handleTournamentCreated(tournament) {
    console.log(`[TournamentStreamingIntegration] Tournament created: ${tournament.tournamentId}`);
    
    this.activeTournament = tournament;
    this.streamingState = TournamentStreamingStates.REGISTRATION;
    
    // Initialize commentary data
    this.initializeCommentaryData(tournament);
    
    // Switch to registration scene if auto-switching enabled
    if (this.autoSwitching.enabled) {
      await this.switchToTournamentState(TournamentStreamingStates.REGISTRATION);
    }
    
    // Send tournament data to overlays
    this.broadcastTournamentUpdate();
  }

  async handleTournamentStarted(tournament) {
    console.log(`[TournamentStreamingIntegration] Tournament started: ${tournament.tournamentId}`);
    
    this.activeTournament = tournament;
    this.streamingState = TournamentStreamingStates.BRACKET_PREVIEW;
    
    // Switch to bracket overview
    if (this.autoSwitching.enabled) {
      await this.switchToTournamentState(TournamentStreamingStates.BRACKET_PREVIEW);
    }
    
    // Set camera to bracket overview
    await this.setCameraPreset(TournamentCameraPresets.BRACKET_OVERVIEW);
    
    this.broadcastTournamentUpdate();
  }

  async handlePlayerRegistered(player, tournament) {
    // Update commentary data
    this.updatePlayerStats(player);
    
    // Brief notification overlay
    if (this.tournamentOverlay) {
      this.tournamentOverlay.queueAnimation('player_joined', {
        type: 'notification',
        message: `${player.playerName} joined the tournament!`,
        duration: 2000
      });
    }
    
    this.broadcastTournamentUpdate();
  }

  async handleMatchStarted(match, tournament) {
    console.log(`[TournamentStreamingIntegration] Match started: ${match.matchId}`);
    
    this.currentMatch = match;
    this.streamingState = TournamentStreamingStates.MATCH_PREPARATION;
    
    // Generate match predictions
    this.generateMatchPredictions(match);
    
    // Switch to match preparation scene
    if (this.autoSwitching.enabled) {
      await this.switchToTournamentState(TournamentStreamingStates.MATCH_PREPARATION);
      
      // Transition to active match after delay
      setTimeout(async () => {
        await this.switchToTournamentState(TournamentStreamingStates.MATCH_ACTIVE);
      }, this.autoSwitching.sceneTransitionDelay);
    }
    
    // Set camera to overview for match start
    await this.setCameraPreset(TournamentCameraPresets.OVERVIEW);
    
    this.broadcastTournamentUpdate();
  }

  async handleMatchCompleted(match, tournament) {
    console.log(`[TournamentStreamingIntegration] Match completed: ${match.matchId}, winner: ${match.winner}`);
    
    // Update analytics
    this.updateMatchAnalytics(match);
    
    // Add to match history
    this.commentaryData.matchHistory.push({
      match,
      completedAt: Date.now(),
      duration: match.duration,
      wasUpset: this.wasMatchUpset(match)
    });
    
    // Switch to results scene
    this.streamingState = TournamentStreamingStates.MATCH_RESULTS;
    if (this.autoSwitching.enabled) {
      await this.switchToTournamentState(TournamentStreamingStates.MATCH_RESULTS);
    }
    
    // Show celebration animation
    if (this.tournamentOverlay) {
      const winner = this.getPlayerById(match.winner);
      this.tournamentOverlay.queueAnimation('match_winner', {
        type: 'match_winner',
        winner: winner,
        match: match,
        duration: this.autoSwitching.celebrationDuration
      });
    }
    
    // Auto-return to bracket after celebration
    setTimeout(async () => {
      if (this.autoSwitching.enabled) {
        await this.switchToTournamentState(TournamentStreamingStates.BRACKET_PREVIEW);
      }
    }, this.autoSwitching.celebrationDuration + 1000);
    
    this.broadcastTournamentUpdate();
  }

  async handleRoundCompleted(round, tournament) {
    console.log(`[TournamentStreamingIntegration] Round ${round} completed`);
    
    this.streamingState = TournamentStreamingStates.ROUND_TRANSITION;
    
    // Switch to round transition scene
    if (this.autoSwitching.enabled) {
      await this.switchToTournamentState(TournamentStreamingStates.ROUND_TRANSITION);
    }
    
    // Show round completion animation
    if (this.tournamentOverlay) {
      this.tournamentOverlay.queueAnimation('round_complete', {
        type: 'round_transition',
        completedRound: round,
        nextRound: round + 1,
        duration: 4000
      });
    }
    
    this.broadcastTournamentUpdate();
  }

  async handleTournamentCompleted(tournament, winner) {
    console.log(`[TournamentStreamingIntegration] Tournament completed, winner: ${winner?.playerName}`);
    
    this.streamingState = TournamentStreamingStates.TOURNAMENT_COMPLETE;
    
    // Switch to winner ceremony
    if (this.autoSwitching.enabled) {
      await this.switchToTournamentState(TournamentStreamingStates.TOURNAMENT_COMPLETE);
    }
    
    // Extended winner celebration
    if (this.tournamentOverlay) {
      this.tournamentOverlay.queueAnimation('tournament_complete', {
        type: 'tournament_winner',
        winner: winner,
        tournament: tournament,
        duration: 10000
      });
    }
    
    // Update final analytics
    this.finalizeTournamentAnalytics(tournament);
    
    this.broadcastTournamentUpdate();
  }

  /**
   * Race event handlers for tournament matches
   */
  async handleRaceStarted(raceData) {
    // Set camera to follow leader during race
    setTimeout(async () => {
      await this.setCameraPreset(TournamentCameraPresets.FOLLOW_LEADER);
    }, this.autoSwitching.cameraPresetDelay);
    
    // Track key race moments
    this.commentaryData.keyMoments.push({
      type: 'race_start',
      timestamp: Date.now(),
      match: this.currentMatch,
      players: raceData.players
    });
  }

  async handleRaceFinished(raceData) {
    // Switch to dramatic finish camera for final moments
    await this.setCameraPreset(TournamentCameraPresets.DRAMATIC_FINISH);
    
    // Record finish
    this.commentaryData.keyMoments.push({
      type: 'race_finish',
      timestamp: Date.now(),
      match: this.currentMatch,
      winner: raceData.winner,
      duration: raceData.duration
    });
  }

  async handlePlayerEliminated(playerData) {
    // Track elimination for commentary
    this.commentaryData.keyMoments.push({
      type: 'player_eliminated',
      timestamp: Date.now(),
      player: playerData.player,
      match: this.currentMatch
    });
  }

  /**
   * Switch to tournament streaming state
   */
  async switchToTournamentState(state) {
    this.streamingState = state;
    
    const sceneMap = {
      [TournamentStreamingStates.REGISTRATION]: 'tournament_registration',
      [TournamentStreamingStates.BRACKET_PREVIEW]: 'tournament_bracket',
      [TournamentStreamingStates.MATCH_PREPARATION]: 'tournament_match_active',
      [TournamentStreamingStates.MATCH_ACTIVE]: 'tournament_match_active',
      [TournamentStreamingStates.MATCH_RESULTS]: 'tournament_match_results',
      [TournamentStreamingStates.ROUND_TRANSITION]: 'tournament_bracket',
      [TournamentStreamingStates.TOURNAMENT_COMPLETE]: 'tournament_winner'
    };
    
    const obsScene = sceneMap[state];
    if (obsScene) {
      await this.obsOverlay.switchScene(obsScene, true);
    }
    
    console.log(`[TournamentStreamingIntegration] Switched to state: ${state}`);
  }

  /**
   * Camera control for tournament matches
   */
  async setCameraPreset(preset) {
    if (!this.obsOverlay.config.enableCameraControl) return;
    
    try {
      await this.obsOverlay.controlCamera({
        type: 'setPreset',
        presetName: preset.mode,
        ...preset
      });
      
      console.log(`[TournamentStreamingIntegration] Camera preset applied: ${preset.mode}`);
    } catch (error) {
      console.warn('[TournamentStreamingIntegration] Camera control failed:', error);
    }
  }

  /**
   * Commentary and analytics support
   */
  initializeCommentaryData(tournament) {
    this.commentaryData = {
      playerStats: new Map(),
      matchHistory: [],
      predictions: new Map(),
      keyMoments: [],
      tournament: tournament
    };
    
    // Initialize player stats
    tournament.registeredPlayers?.forEach(player => {
      this.commentaryData.playerStats.set(player.playerId, this.calculatePlayerStats(player));
    });
  }

  calculatePlayerStats(player) {
    return {
      playerId: player.playerId,
      playerName: player.playerName,
      seed: player.seed,
      gamesPlayed: player.gamesPlayed || 0,
      wins: player.wins || 0,
      losses: player.losses || 0,
      winRate: player.wins / Math.max(player.wins + player.losses, 1),
      averageFinishPosition: player.averageFinishPosition || 0,
      totalRaceTime: player.totalRaceTime || 0,
      favoriteMap: player.favoriteMap || 'Unknown',
      strongestSkill: player.strongestSkill || 'None'
    };
  }

  generateMatchPredictions(match) {
    if (!match.players || match.players.length < 2) return;
    
    const player1Stats = this.commentaryData.playerStats.get(match.players[0]);
    const player2Stats = this.commentaryData.playerStats.get(match.players[1]);
    
    if (player1Stats && player2Stats) {
      // Simple prediction based on win rates and seeds
      const player1Odds = this.calculateWinProbability(player1Stats, player2Stats);
      const player2Odds = 1 - player1Odds;
      
      this.commentaryData.predictions.set(match.matchId, {
        match: match,
        predictions: [
          { playerId: match.players[0], winProbability: player1Odds, favored: player1Odds > 0.5 },
          { playerId: match.players[1], winProbability: player2Odds, favored: player2Odds > 0.5 }
        ],
        generatedAt: Date.now()
      });
    }
  }

  calculateWinProbability(player1Stats, player2Stats) {
    // Weight factors
    const winRateWeight = 0.4;
    const seedWeight = 0.3;
    const experienceWeight = 0.3;
    
    // Normalize stats
    const winRateDiff = player1Stats.winRate - player2Stats.winRate;
    const seedDiff = (player2Stats.seed - player1Stats.seed) / Math.max(player1Stats.seed, player2Stats.seed, 1);
    const experienceDiff = (player1Stats.gamesPlayed - player2Stats.gamesPlayed) / Math.max(player1Stats.gamesPlayed, player2Stats.gamesPlayed, 1);
    
    // Calculate weighted probability
    const probability = 0.5 + 
      (winRateDiff * winRateWeight) + 
      (seedDiff * seedWeight) + 
      (experienceDiff * experienceWeight);
    
    // Clamp between 0.1 and 0.9
    return Math.max(0.1, Math.min(0.9, probability));
  }

  wasMatchUpset(match) {
    const prediction = this.commentaryData.predictions.get(match.matchId);
    if (!prediction) return false;
    
    const winnerPrediction = prediction.predictions.find(p => p.playerId === match.winner);
    return winnerPrediction && !winnerPrediction.favored;
  }

  updateMatchAnalytics(match) {
    this.matchAnalytics.totalMatches++;
    
    if (match.duration) {
      this.matchAnalytics.averageMatchDuration = 
        (this.matchAnalytics.averageMatchDuration * (this.matchAnalytics.totalMatches - 1) + match.duration) / 
        this.matchAnalytics.totalMatches;
    }
    
    if (this.wasMatchUpset(match)) {
      this.matchAnalytics.upsetCount++;
    }
  }

  updatePlayerStats(player) {
    const existing = this.commentaryData.playerStats.get(player.playerId);
    if (existing) {
      // Update existing stats
      existing.gamesPlayed = player.gamesPlayed || existing.gamesPlayed;
      existing.wins = player.wins || existing.wins;
      existing.losses = player.losses || existing.losses;
      existing.winRate = existing.wins / Math.max(existing.wins + existing.losses, 1);
    } else {
      // Add new player stats
      this.commentaryData.playerStats.set(player.playerId, this.calculatePlayerStats(player));
    }
  }

  finalizeTournamentAnalytics(tournament) {
    const finalAnalytics = {
      ...this.matchAnalytics,
      tournamentId: tournament.tournamentId,
      duration: tournament.duration,
      totalPlayers: tournament.registeredPlayers?.length || 0,
      winner: tournament.winner,
      upsetRate: this.matchAnalytics.upsetCount / Math.max(this.matchAnalytics.totalMatches, 1),
      keyMoments: this.commentaryData.keyMoments,
      completedAt: Date.now()
    };
    
    console.log('[TournamentStreamingIntegration] Final tournament analytics:', finalAnalytics);
    return finalAnalytics;
  }

  /**
   * WebSocket handlers for external streaming tools
   */
  handleTournamentSubscription(socket, data) {
    const { streams } = data;
    
    // Add tournament-specific streams
    if (streams.includes('tournament')) {
      socket.emit('tournament-data', this.getTournamentStreamingData());
    }
    
    if (streams.includes('commentary')) {
      socket.emit('commentary-data', this.getCommentaryData());
    }
    
    if (streams.includes('predictions')) {
      socket.emit('predictions-data', this.getPredictionsData());
    }
  }

  handleTournamentCameraControl(socket, data) {
    const { preset, options } = data;
    
    if (TournamentCameraPresets[preset]) {
      this.setCameraPreset({ ...TournamentCameraPresets[preset], ...options });
      socket.emit('camera-control-success', { preset, applied: true });
    } else {
      socket.emit('camera-control-error', { error: 'Invalid camera preset' });
    }
  }

  handleTournamentSceneRequest(socket, data) {
    const { state } = data;
    
    if (Object.values(TournamentStreamingStates).includes(state)) {
      this.switchToTournamentState(state);
      socket.emit('scene-change-success', { state, applied: true });
    } else {
      socket.emit('scene-change-error', { error: 'Invalid tournament state' });
    }
  }

  /**
   * Data providers for streaming
   */
  getTournamentStreamingData() {
    return {
      tournament: this.activeTournament,
      currentMatch: this.currentMatch,
      streamingState: this.streamingState,
      analytics: this.matchAnalytics,
      timestamp: Date.now()
    };
  }

  getCommentaryData() {
    return {
      playerStats: Object.fromEntries(this.commentaryData.playerStats),
      matchHistory: this.commentaryData.matchHistory.slice(-10), // Last 10 matches
      keyMoments: this.commentaryData.keyMoments.slice(-20), // Last 20 moments
      currentMatch: this.currentMatch,
      timestamp: Date.now()
    };
  }

  getPredictionsData() {
    return {
      predictions: Object.fromEntries(this.commentaryData.predictions),
      analytics: this.matchAnalytics,
      timestamp: Date.now()
    };
  }

  /**
   * Broadcast tournament updates to all connected streaming clients
   */
  broadcastTournamentUpdate() {
    const tournamentData = this.getTournamentStreamingData();
    const commentaryData = this.getCommentaryData();
    
    // Update OBS overlay data
    this.obsOverlay.updateOverlayData('tournamentData', tournamentData);
    
    // Broadcast via WebSocket if available
    if (this.obsOverlay.gameEngine?.streamingWebSocket) {
      const ws = this.obsOverlay.gameEngine.streamingWebSocket;
      ws.broadcastToAll?.('tournament-update', tournamentData);
      ws.broadcastToAll?.('commentary-update', commentaryData);
    }
  }

  /**
   * Utility methods
   */
  getPlayerById(playerId) {
    if (!this.activeTournament || !playerId) return null;
    return this.activeTournament.registeredPlayers?.find(p => p.playerId === playerId);
  }

  handleSceneChanged(data) {
    console.log(`[TournamentStreamingIntegration] Scene changed: ${data.scene}${data.tournamentMode ? ' (Tournament)' : ''}`);
  }

  /**
   * Public API for manual control
   */
  enableAutoSwitching() {
    this.autoSwitching.enabled = true;
    console.log('[TournamentStreamingIntegration] Auto-switching enabled');
  }

  disableAutoSwitching() {
    this.autoSwitching.enabled = false;
    console.log('[TournamentStreamingIntegration] Auto-switching disabled');
  }

  async manualSceneSwitch(state) {
    await this.switchToTournamentState(state);
  }

  async manualCameraPreset(presetName) {
    const preset = TournamentCameraPresets[presetName];
    if (preset) {
      await this.setCameraPreset(preset);
    }
  }

  getStreamingStatus() {
    return {
      streamingEnabled: this.streamingEnabled,
      streamingState: this.streamingState,
      activeTournament: this.activeTournament?.tournamentId || null,
      currentMatch: this.currentMatch?.matchId || null,
      autoSwitching: this.autoSwitching.enabled,
      obsConnected: this.obsOverlay.isAuthenticated,
      overlayActive: !!this.tournamentOverlay
    };
  }

  /**
   * Destroy tournament streaming integration
   */
  destroy() {
    console.log('[TournamentStreamingIntegration] Destroying tournament streaming integration');
    
    this.streamingState = TournamentStreamingStates.OFFLINE;
    this.activeTournament = null;
    this.currentMatch = null;
    
    if (this.tournamentOverlay) {
      this.tournamentOverlay.destroy();
      this.tournamentOverlay = null;
    }
    
    this.commentaryData = {
      playerStats: new Map(),
      matchHistory: [],
      predictions: new Map(),
      keyMoments: []
    };
    
    console.log('[TournamentStreamingIntegration] Tournament streaming integration destroyed');
  }
}

export default TournamentStreamingIntegration;