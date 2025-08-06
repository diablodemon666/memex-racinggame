/**
 * TournamentOverlay.js - Tournament-specific OBS overlays for Memex Racing
 * 
 * Provides specialized overlays for tournament streaming including bracket views,
 * match information, player statistics, standings, and winner celebrations.
 * Integrates with existing OBS infrastructure for seamless tournament broadcasting.
 */

import { OBSSourceTypes } from './OBSOverlay.js';

/**
 * Tournament overlay types for OBS scene management
 */
export const TournamentOverlayTypes = {
  BRACKET: 'tournament_bracket',
  CURRENT_MATCH: 'tournament_current_match',
  STANDINGS: 'tournament_standings',
  SCHEDULE: 'tournament_schedule',
  WINNER_CELEBRATION: 'tournament_winner',
  PLAYER_PROFILES: 'tournament_player_profiles',
  MATCH_PREVIEW: 'tournament_match_preview',
  STATISTICS: 'tournament_statistics'
};

/**
 * Tournament scene presets for different tournament phases
 */
export const TournamentScenePresets = {
  REGISTRATION: 'tournament_registration',
  BRACKET_OVERVIEW: 'tournament_bracket_overview',
  MATCH_ACTIVE: 'tournament_match_active',
  MATCH_RESULTS: 'tournament_match_results',
  ROUND_TRANSITION: 'tournament_round_transition',
  FINALS: 'tournament_finals',
  WINNER_CEREMONY: 'tournament_winner_ceremony',
  AWARDS: 'tournament_awards'
};

export class TournamentOverlay {
  constructor(obsOverlay, tournamentManager) {
    this.obsOverlay = obsOverlay;
    this.tournamentManager = tournamentManager;
    
    // Tournament overlay configuration
    this.config = {
      overlayBaseUrl: 'http://localhost:3001/tournament/overlay',
      bracketWidth: 1920,
      bracketHeight: 1080,
      matchWidth: 1280,
      matchHeight: 720,
      standingsWidth: 800,
      standingsHeight: 600,
      animationDuration: 2000,
      updateInterval: 1000,
      
      // Visual styling
      retro: {
        pixelPerfect: true,
        fontSize: 16,
        primaryColor: '#00ff00',
        secondaryColor: '#ffff00',
        backgroundColor: '#000000',
        accentColor: '#ff00ff'
      }
    };

    // Active tournament tracking
    this.activeTournament = null;
    this.currentMatch = null;
    this.lastBracketState = null;
    this.overlayStates = new Map();
    
    // Update timers
    this.updateTimers = new Map();
    
    // Animation queues
    this.animationQueue = [];
    this.isAnimating = false;
    
    console.log('[TournamentOverlay] Tournament overlay system initialized');
    
    // Initialize tournament event listeners
    this.setupTournamentEventListeners();
  }

  /**
   * Initialize tournament overlay system
   */
  async initialize() {
    if (!this.obsOverlay.isAuthenticated) {
      console.warn('[TournamentOverlay] OBS not connected, waiting for connection');
      this.obsOverlay.on('obs-connected', () => this.setupTournamentOverlays());
      return;
    }

    await this.setupTournamentOverlays();
    this.startUpdateLoops();
    
    console.log('[TournamentOverlay] Tournament overlay system ready');
  }

  /**
   * Setup tournament-specific OBS overlays
   */
  async setupTournamentOverlays() {
    try {
      console.log('[TournamentOverlay] Setting up tournament overlays');
      
      // Create tournament scenes
      await this.createTournamentScenes();
      
      // Create tournament overlay sources
      await this.createTournamentSources();
      
      // Setup overlay sources in scenes
      await this.configureTournamentScenes();
      
      console.log('[TournamentOverlay] Tournament overlays setup complete');
      
    } catch (error) {
      console.error('[TournamentOverlay] Failed to setup tournament overlays:', error);
      throw error;
    }
  }

  /**
   * Create tournament-specific scenes
   */
  async createTournamentScenes() {
    const tournamentScenes = [
      { name: 'Tournament - Registration', preset: TournamentScenePresets.REGISTRATION },
      { name: 'Tournament - Bracket Overview', preset: TournamentScenePresets.BRACKET_OVERVIEW },
      { name: 'Tournament - Match Active', preset: TournamentScenePresets.MATCH_ACTIVE },
      { name: 'Tournament - Match Results', preset: TournamentScenePresets.MATCH_RESULTS },
      { name: 'Tournament - Round Transition', preset: TournamentScenePresets.ROUND_TRANSITION },
      { name: 'Tournament - Finals', preset: TournamentScenePresets.FINALS },
      { name: 'Tournament - Winner Ceremony', preset: TournamentScenePresets.WINNER_CEREMONY },
      { name: 'Tournament - Awards', preset: TournamentScenePresets.AWARDS }
    ];

    for (const scene of tournamentScenes) {
      try {
        // Check if scene exists
        const sceneExists = this.obsOverlay.availableScenes.includes(scene.name);
        
        if (!sceneExists) {
          await this.obsOverlay.obs.call('CreateScene', { sceneName: scene.name });
          this.obsOverlay.availableScenes.push(scene.name);
          console.log(`[TournamentOverlay] Created scene: ${scene.name}`);
        }
      } catch (error) {
        console.warn(`[TournamentOverlay] Failed to create scene ${scene.name}:`, error);
      }
    }
  }

  /**
   * Create tournament overlay sources
   */
  async createTournamentSources() {
    const overlayConfigs = [
      // Tournament bracket overlay
      {
        sourceName: 'Tournament Bracket',
        sourceKind: OBSSourceTypes.BROWSER_SOURCE,
        settings: {
          url: `${this.config.overlayBaseUrl}/bracket`,
          width: this.config.bracketWidth,
          height: this.config.bracketHeight,
          fps: 30,
          restart_when_active: true,
          shutdown: true
        }
      },
      
      // Current match overlay
      {
        sourceName: 'Tournament Current Match',
        sourceKind: OBSSourceTypes.BROWSER_SOURCE,
        settings: {
          url: `${this.config.overlayBaseUrl}/current-match`,
          width: this.config.matchWidth,
          height: this.config.matchHeight,
          fps: 60,
          restart_when_active: false,
          shutdown: false
        }
      },
      
      // Tournament standings
      {
        sourceName: 'Tournament Standings',
        sourceKind: OBSSourceTypes.BROWSER_SOURCE,
        settings: {
          url: `${this.config.overlayBaseUrl}/standings`,
          width: this.config.standingsWidth,
          height: this.config.standingsHeight,
          fps: 5,
          restart_when_active: true,
          shutdown: true
        }
      },
      
      // Match schedule
      {
        sourceName: 'Tournament Schedule',
        sourceKind: OBSSourceTypes.BROWSER_SOURCE,
        settings: {
          url: `${this.config.overlayBaseUrl}/schedule`,
          width: 600,
          height: 800,
          fps: 5,
          restart_when_active: true,
          shutdown: true
        }
      },
      
      // Winner celebration
      {
        sourceName: 'Tournament Winner',
        sourceKind: OBSSourceTypes.BROWSER_SOURCE,
        settings: {
          url: `${this.config.overlayBaseUrl}/winner`,
          width: 1920,
          height: 1080,
          fps: 30,
          restart_when_active: true,
          shutdown: true
        }
      },
      
      // Player profiles
      {
        sourceName: 'Tournament Player Profiles',
        sourceKind: OBSSourceTypes.BROWSER_SOURCE,
        settings: {
          url: `${this.config.overlayBaseUrl}/player-profiles`,
          width: 800,
          height: 600,
          fps: 10,
          restart_when_active: true,
          shutdown: true
        }
      },
      
      // Tournament title
      {
        sourceName: 'Tournament Title',
        sourceKind: OBSSourceTypes.TEXT_SOURCE,
        settings: {
          text: 'MEMEX RACING TOURNAMENT',
          font: {
            face: 'Courier New',
            size: 48,
            style: 'Bold'
          },
          color: 0x00FF00,
          outline: true,
          outline_size: 3,
          outline_color: 0x000000
        }
      },
      
      // Round indicator
      {
        sourceName: 'Tournament Round',
        sourceKind: OBSSourceTypes.TEXT_SOURCE,
        settings: {
          text: 'ROUND 1',
          font: {
            face: 'Courier New',
            size: 36,
            style: 'Bold'
          },
          color: 0xFFFF00,
          outline: true,
          outline_size: 2,
          outline_color: 0x000000
        }
      },
      
      // Match indicator
      {
        sourceName: 'Tournament Match Info',
        sourceKind: OBSSourceTypes.TEXT_SOURCE,
        settings: {
          text: 'MATCH 1',
          font: {
            face: 'Courier New',
            size: 32,
            style: 'Bold'
          },
          color: 0xFF00FF,
          outline: true,
          outline_size: 2,
          outline_color: 0x000000
        }
      }
    ];

    for (const config of overlayConfigs) {
      try {
        // Check if source already exists
        const sourceExists = await this.obsOverlay.checkSourceExists(config.sourceName);
        
        if (!sourceExists) {
          await this.obsOverlay.obs.call('CreateSource', {
            sourceName: config.sourceName,
            sourceKind: config.sourceKind,
            sourceSettings: config.settings
          });
          
          console.log(`[TournamentOverlay] Created source: ${config.sourceName}`);
        }
        
      } catch (error) {
        console.warn(`[TournamentOverlay] Failed to create source ${config.sourceName}:`, error);
      }
    }
  }

  /**
   * Configure tournament scenes with appropriate sources
   */
  async configureTournamentScenes() {
    const sceneConfigurations = {
      'Tournament - Registration': [
        'Tournament Title',
        'Tournament Standings'
      ],
      'Tournament - Bracket Overview': [
        'Tournament Title',
        'Tournament Bracket',
        'Tournament Round'
      ],
      'Tournament - Match Active': [
        'Tournament Current Match',
        'Tournament Match Info',
        'Tournament Round',
        'Racing Game Overlay'
      ],
      'Tournament - Match Results': [
        'Tournament Current Match',
        'Tournament Winner',
        'Tournament Bracket'
      ],
      'Tournament - Round Transition': [
        'Tournament Bracket',
        'Tournament Round',
        'Tournament Schedule'
      ],
      'Tournament - Finals': [
        'Tournament Current Match',
        'Tournament Player Profiles',
        'Tournament Match Info'
      ],
      'Tournament - Winner Ceremony': [
        'Tournament Winner',
        'Tournament Title',
        'Tournament Standings'
      ],
      'Tournament - Awards': [
        'Tournament Winner',
        'Tournament Standings',
        'Tournament Title'
      ]
    };

    for (const [sceneName, sources] of Object.entries(sceneConfigurations)) {
      for (const sourceName of sources) {
        await this.addSourceToScene(sceneName, sourceName);
      }
    }
  }

  /**
   * Add source to scene with proper positioning
   */
  async addSourceToScene(sceneName, sourceName) {
    try {
      if (!this.obsOverlay.availableScenes.includes(sceneName)) {
        return;
      }

      await this.obsOverlay.obs.call('CreateSceneSource', {
        sceneName,
        sourceName,
        sceneItemEnabled: true
      });

      // Position sources appropriately
      await this.positionTournamentSource(sceneName, sourceName);
      
    } catch (error) {
      // Source might already exist in scene, which is fine
      if (!error.message.includes('already exists')) {
        console.warn(`[TournamentOverlay] Failed to add ${sourceName} to ${sceneName}:`, error);
      }
    }
  }

  /**
   * Position tournament sources in scenes
   */
  async positionTournamentSource(sceneName, sourceName) {
    try {
      const positionMap = {
        'Tournament Title': { x: 960, y: 50, alignment: 5 }, // Top center
        'Tournament Round': { x: 100, y: 100, alignment: 7 }, // Top left
        'Tournament Match Info': { x: 1820, y: 100, alignment: 9 }, // Top right
        'Tournament Bracket': { x: 960, y: 540, alignment: 5 }, // Center
        'Tournament Current Match': { x: 960, y: 540, alignment: 5 }, // Center
        'Tournament Standings': { x: 1520, y: 540, alignment: 9 }, // Right center
        'Tournament Schedule': { x: 400, y: 540, alignment: 7 }, // Left center
        'Tournament Winner': { x: 960, y: 540, alignment: 5 }, // Center
        'Tournament Player Profiles': { x: 100, y: 540, alignment: 7 } // Left center
      };

      const position = positionMap[sourceName];
      if (position) {
        // Get the scene item ID first
        const sceneItems = await this.obsOverlay.obs.call('GetSceneItemList', { sceneName });
        const sceneItem = sceneItems.sceneItems.find(item => item.sourceName === sourceName);
        
        if (sceneItem) {
          await this.obsOverlay.obs.call('SetSceneItemTransform', {
            sceneName,
            sceneItemId: sceneItem.sceneItemId,
            sceneItemTransform: {
              positionX: position.x,
              positionY: position.y,
              alignment: position.alignment
            }
          });
        }
      }
    } catch (error) {
      console.warn(`[TournamentOverlay] Failed to position ${sourceName} in ${sceneName}:`, error);
    }
  }

  /**
   * Setup tournament event listeners
   */
  setupTournamentEventListeners() {
    if (!this.tournamentManager) return;

    // Tournament created
    this.tournamentManager.on?.('TOURNAMENT_CREATED', (data) => {
      this.handleTournamentCreated(data.tournament);
    });

    // Tournament started
    this.tournamentManager.on?.('TOURNAMENT_STARTED', (data) => {
      this.handleTournamentStarted(data.tournament);
    });

    // Tournament match started
    this.tournamentManager.on?.('TOURNAMENT_MATCH_STARTED', (data) => {
      this.handleMatchStarted(data.match, data.tournament);
    });

    // Tournament match completed
    this.tournamentManager.on?.('TOURNAMENT_MATCH_COMPLETED', (data) => {
      this.handleMatchCompleted(data.match, data.tournament);
    });

    // Tournament round completed
    this.tournamentManager.on?.('TOURNAMENT_ROUND_COMPLETED', (data) => {
      this.handleRoundCompleted(data.round, data.tournament);
    });

    // Tournament completed
    this.tournamentManager.on?.('TOURNAMENT_COMPLETED', (data) => {
      this.handleTournamentCompleted(data.tournament, data.winner);
    });

    // Player registered
    this.tournamentManager.on?.('TOURNAMENT_PLAYER_REGISTERED', (data) => {
      this.handlePlayerRegistered(data.player, data.tournament);
    });
  }

  /**
   * Handle tournament creation
   */
  async handleTournamentCreated(tournament) {
    this.activeTournament = tournament;
    
    // Update tournament title
    await this.updateTournamentTitle(tournament.name || 'MEMEX RACING TOURNAMENT');
    
    // Switch to registration scene
    await this.switchToTournamentScene(TournamentScenePresets.REGISTRATION);
    
    // Start updating tournament data
    this.startTournamentUpdates();
    
    console.log(`[TournamentOverlay] Tournament created: ${tournament.tournamentId}`);
  }

  /**
   * Handle tournament start
   */
  async handleTournamentStarted(tournament) {
    this.activeTournament = tournament;
    
    // Show bracket overview
    await this.switchToTournamentScene(TournamentScenePresets.BRACKET_OVERVIEW);
    
    // Update round indicator
    await this.updateRoundIndicator(tournament.currentRound, tournament.totalRounds);
    
    // Queue celebration animation
    this.queueAnimation('tournament_start', {
      type: 'celebration',
      message: 'TOURNAMENT BEGINS!',
      duration: 3000
    });
    
    console.log(`[TournamentOverlay] Tournament started: ${tournament.tournamentId}`);
  }

  /**
   * Handle match start
   */
  async handleMatchStarted(match, tournament) {
    this.currentMatch = match;
    
    // Switch to match active scene
    await this.switchToTournamentScene(TournamentScenePresets.MATCH_ACTIVE);
    
    // Update match information
    await this.updateMatchInfo(match);
    
    // Update player profiles
    await this.updatePlayerProfiles(match.players);
    
    console.log(`[TournamentOverlay] Match started: ${match.matchId}`);
  }

  /**
   * Handle match completion
   */
  async handleMatchCompleted(match, tournament) {
    // Switch to match results scene
    await this.switchToTournamentScene(TournamentScenePresets.MATCH_RESULTS);
    
    // Show winner celebration
    await this.showMatchWinner(match);
    
    // Update bracket
    await this.updateBracket(tournament);
    
    // Queue transition back to bracket after celebration
    setTimeout(() => {
      this.switchToTournamentScene(TournamentScenePresets.BRACKET_OVERVIEW);
    }, 5000);
    
    console.log(`[TournamentOverlay] Match completed: ${match.matchId}, winner: ${match.winner}`);
  }

  /**
   * Handle round completion
   */
  async handleRoundCompleted(round, tournament) {
    // Switch to round transition scene
    await this.switchToTournamentScene(TournamentScenePresets.ROUND_TRANSITION);
    
    // Update round indicator
    await this.updateRoundIndicator(tournament.currentRound, tournament.totalRounds);
    
    // Show round completion animation
    this.queueAnimation('round_complete', {
      type: 'round_transition',
      round: round,
      duration: 4000
    });
    
    console.log(`[TournamentOverlay] Round ${round} completed`);
  }

  /**
   * Handle tournament completion
   */
  async handleTournamentCompleted(tournament, winner) {
    // Switch to winner ceremony
    await this.switchToTournamentScene(TournamentScenePresets.WINNER_CEREMONY);
    
    // Show tournament winner
    await this.showTournamentWinner(winner, tournament);
    
    // Update final standings
    await this.updateFinalStandings(tournament.finalStandings);
    
    // Extended celebration
    this.queueAnimation('tournament_complete', {
      type: 'tournament_winner',
      winner: winner,
      duration: 10000
    });
    
    console.log(`[TournamentOverlay] Tournament completed, winner: ${winner?.playerName}`);
  }

  /**
   * Handle player registration
   */
  async handlePlayerRegistered(player, tournament) {
    // Update standings
    await this.updateStandings(tournament);
    
    // Brief registration notification
    this.queueAnimation('player_registered', {
      type: 'notification',
      message: `${player.playerName} joined!`,
      duration: 2000
    });
  }

  /**
   * Switch to tournament scene
   */
  async switchToTournamentScene(scenePreset) {
    const sceneMap = {
      [TournamentScenePresets.REGISTRATION]: 'Tournament - Registration',
      [TournamentScenePresets.BRACKET_OVERVIEW]: 'Tournament - Bracket Overview',
      [TournamentScenePresets.MATCH_ACTIVE]: 'Tournament - Match Active',
      [TournamentScenePresets.MATCH_RESULTS]: 'Tournament - Match Results',
      [TournamentScenePresets.ROUND_TRANSITION]: 'Tournament - Round Transition',
      [TournamentScenePresets.FINALS]: 'Tournament - Finals',
      [TournamentScenePresets.WINNER_CEREMONY]: 'Tournament - Winner Ceremony',
      [TournamentScenePresets.AWARDS]: 'Tournament - Awards'
    };

    const sceneName = sceneMap[scenePreset];
    if (sceneName && this.obsOverlay.availableScenes.includes(sceneName)) {
      try {
        await this.obsOverlay.obs.call('SetCurrentProgramScene', { sceneName });
        this.obsOverlay.currentScene = sceneName;
        console.log(`[TournamentOverlay] Switched to scene: ${sceneName}`);
        
        this.obsOverlay.emit('tournament-scene-changed', { scene: sceneName, preset: scenePreset });
      } catch (error) {
        console.error(`[TournamentOverlay] Failed to switch to scene ${sceneName}:`, error);
      }
    }
  }

  /**
   * Update tournament-specific text sources
   */
  async updateTournamentTitle(title) {
    await this.obsOverlay.updateTextSource('Tournament Title', title);
  }

  async updateRoundIndicator(currentRound, totalRounds) {
    const text = `ROUND ${currentRound} / ${totalRounds}`;
    await this.obsOverlay.updateTextSource('Tournament Round', text);
  }

  async updateMatchInfo(match) {
    const player1 = this.getPlayerName(match.players[0]);
    const player2 = this.getPlayerName(match.players[1]);
    const text = `${player1} VS ${player2}`;
    await this.obsOverlay.updateTextSource('Tournament Match Info', text);
  }

  /**
   * Update overlay data for tournament browser sources
   */
  async updateBracket(tournament) {
    const bracketData = {
      tournament: tournament,
      bracket: tournament.bracket,
      currentRound: tournament.currentRound,
      totalRounds: tournament.totalRounds,
      players: tournament.registeredPlayers,
      timestamp: Date.now()
    };

    this.overlayStates.set('bracket', bracketData);
    this.obsOverlay.updateOverlayData('tournamentBracket', bracketData);
  }

  async updateStandings(tournament) {
    const standingsData = {
      players: tournament.registeredPlayers.sort((a, b) => {
        if (b.wins !== a.wins) return b.wins - a.wins;
        const aWinRate = a.wins / Math.max(a.wins + a.losses, 1);
        const bWinRate = b.wins / Math.max(b.wins + b.losses, 1);
        return bWinRate - aWinRate;
      }),
      tournament: tournament,
      timestamp: Date.now()
    };

    this.overlayStates.set('standings', standingsData);
    this.obsOverlay.updateOverlayData('tournamentStandings', standingsData);
  }

  async updatePlayerProfiles(playerIds) {
    const profiles = playerIds.map(playerId => {
      const player = this.activeTournament?.registeredPlayers.find(p => p.playerId === playerId);
      return player ? {
        id: player.playerId,
        name: player.playerName,
        seed: player.seed,
        wins: player.wins || 0,
        losses: player.losses || 0,
        winRate: player.wins / Math.max(player.wins + player.losses, 1),
        stats: player.tournamentStats || {}
      } : null;
    }).filter(Boolean);

    const profileData = {
      profiles,
      timestamp: Date.now()
    };

    this.overlayStates.set('playerProfiles', profileData);
    this.obsOverlay.updateOverlayData('tournamentPlayerProfiles', profileData);
  }

  async showMatchWinner(match) {
    const winner = this.activeTournament?.registeredPlayers.find(p => p.playerId === match.winner);
    
    if (winner) {
      const winnerData = {
        match: match,
        winner: winner,
        timestamp: Date.now()
      };

      this.overlayStates.set('matchWinner', winnerData);
      this.obsOverlay.updateOverlayData('tournamentMatchWinner', winnerData);
    }
  }

  async showTournamentWinner(winner, tournament) {
    const winnerData = {
      tournament: tournament,
      winner: winner,
      finalStandings: tournament.finalStandings,
      timestamp: Date.now()
    };

    this.overlayStates.set('tournamentWinner', winnerData);
    this.obsOverlay.updateOverlayData('tournamentWinner', winnerData);
  }

  async updateFinalStandings(standings) {
    const standingsData = {
      standings: standings,
      isFinal: true,
      timestamp: Date.now()
    };

    this.overlayStates.set('finalStandings', standingsData);
    this.obsOverlay.updateOverlayData('tournamentFinalStandings', standingsData);
  }

  /**
   * Animation system
   */
  queueAnimation(id, animationData) {
    this.animationQueue.push({ id, ...animationData });
    
    if (!this.isAnimating) {
      this.processAnimationQueue();
    }
  }

  async processAnimationQueue() {
    if (this.animationQueue.length === 0) {
      this.isAnimating = false;
      return;
    }

    this.isAnimating = true;
    const animation = this.animationQueue.shift();
    
    try {
      await this.playAnimation(animation);
    } catch (error) {
      console.error('[TournamentOverlay] Animation error:', error);
    }
    
    // Process next animation
    setTimeout(() => {
      this.processAnimationQueue();
    }, 500);
  }

  async playAnimation(animation) {
    console.log(`[TournamentOverlay] Playing animation: ${animation.type}`);
    
    // Send animation data to overlay
    this.obsOverlay.updateOverlayData('tournamentAnimation', {
      type: animation.type,
      data: animation,
      timestamp: Date.now()
    });
    
    // Wait for animation duration
    return new Promise(resolve => {
      setTimeout(resolve, animation.duration || 2000);
    });
  }

  /**
   * Start tournament update loops
   */
  startTournamentUpdates() {
    this.stopTournamentUpdates();
    
    this.updateTimers.set('tournament', setInterval(() => {
      this.updateTournamentData();
    }, this.config.updateInterval));
  }

  stopTournamentUpdates() {
    this.updateTimers.forEach((timer, name) => {
      clearInterval(timer);
    });
    this.updateTimers.clear();
  }

  async updateTournamentData() {
    if (!this.activeTournament) return;
    
    try {
      // Get latest tournament data
      const latestTournament = this.tournamentManager?.getTournamentDetails?.(this.activeTournament.tournamentId);
      
      if (latestTournament) {
        this.activeTournament = latestTournament;
        
        // Update all overlays
        await this.updateBracket(latestTournament);
        await this.updateStandings(latestTournament);
        
        // Update current match if active
        if (latestTournament.currentMatch) {
          this.currentMatch = latestTournament.currentMatch;
          await this.updatePlayerProfiles(latestTournament.currentMatch.players);
        }
      }
    } catch (error) {
      console.error('[TournamentOverlay] Error updating tournament data:', error);
    }
  }

  /**
   * Start update loops
   */
  startUpdateLoops() {
    // Main tournament data update loop
    this.updateTimers.set('main', setInterval(() => {
      if (this.activeTournament) {
        this.updateTournamentData();
      }
    }, 5000)); // Update every 5 seconds
  }

  /**
   * Get player name by ID
   */
  getPlayerName(playerId) {
    if (!this.activeTournament || !playerId) return 'TBD';
    
    const player = this.activeTournament.registeredPlayers.find(p => p.playerId === playerId);
    return player ? player.playerName : `Player ${playerId}`;
  }

  /**
   * Get tournament overlay data for external access
   */
  getTournamentOverlayData() {
    return {
      activeTournament: this.activeTournament,
      currentMatch: this.currentMatch,
      overlayStates: Object.fromEntries(this.overlayStates),
      isAnimating: this.isAnimating,
      timestamp: Date.now()
    };
  }

  /**
   * Manual scene switching for commentary control
   */
  async switchToRegistration() {
    await this.switchToTournamentScene(TournamentScenePresets.REGISTRATION);
  }

  async switchToBracket() {
    await this.switchToTournamentScene(TournamentScenePresets.BRACKET_OVERVIEW);
  }

  async switchToMatch() {
    await this.switchToTournamentScene(TournamentScenePresets.MATCH_ACTIVE);
  }

  async switchToResults() {
    await this.switchToTournamentScene(TournamentScenePresets.MATCH_RESULTS);
  }

  async switchToWinner() {
    await this.switchToTournamentScene(TournamentScenePresets.WINNER_CEREMONY);
  }

  /**
   * Destroy tournament overlay system
   */
  destroy() {
    console.log('[TournamentOverlay] Destroying tournament overlay system');
    
    this.stopTournamentUpdates();
    this.animationQueue = [];
    this.isAnimating = false;
    this.overlayStates.clear();
    this.activeTournament = null;
    this.currentMatch = null;
    
    console.log('[TournamentOverlay] Tournament overlay system destroyed');
  }
}

export default TournamentOverlay;