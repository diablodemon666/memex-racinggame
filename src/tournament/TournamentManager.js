/**
 * TournamentManager.js - High-level tournament orchestration for Memex Racing
 * 
 * Manages tournament lifecycle, player registration, seeding, and integration
 * with existing authentication and room management systems.
 */

import { BracketManager } from './BracketManager.js';
import { TournamentStateManager } from './TournamentStateManager.js';
import { multiplayerEvents, MULTIPLAYER_EVENTS } from '../multiplayer/MultiplayerEvents.js';
import { roomManager } from '../multiplayer/RoomManager.js';

/**
 * Tournament orchestration and lifecycle management
 */
export class TournamentManager {
    constructor(authManager = null, gameEngine = null) {
        // Core managers
        this.bracketManager = new BracketManager();
        this.stateManager = new TournamentStateManager();
        
        // System integrations
        this.authManager = authManager;
        this.gameEngine = gameEngine;
        this.roomManager = roomManager;
        
        // Tournament registry
        this.activeTournaments = new Map(); // tournamentId -> tournament data
        this.playerRegistrations = new Map(); // tournamentId -> Set of playerIds
        this.spectators = new Map(); // tournamentId -> Set of spectatorIds
        
        // Configuration
        this.config = {
            maxConcurrentTournaments: 5,
            defaultTournamentSettings: {
                format: 'single_elimination',
                maxPlayers: 32,
                minPlayers: 4,
                raceTimeLimit: 300,
                playersPerRace: 6,
                bettingEnabled: true,
                spectatorCount: 50,
                registrationTimeLimit: 600, // 10 minutes
                prizePool: 0
            },
            supportedFormats: ['single_elimination', 'double_elimination', 'round_robin']
        };
        
        // State tracking
        this.isInitialized = false;
        
        console.log('[TournamentManager] Initialized');
        this.initialize();
    }

    /**
     * Initialize the tournament manager
     */
    async initialize() {
        if (this.isInitialized) {
            return;
        }

        try {
            // Initialize state manager
            await this.stateManager.initialize();
            
            // Set up bracket manager integrations
            this.bracketManager.roomManager = this.roomManager;
            this.bracketManager.gameEngine = this.gameEngine;
            
            // Setup event listeners
            this.setupEventListeners();
            
            // Restore any active tournaments
            await this.restoreActiveTournaments();
            
            this.isInitialized = true;
            console.log('[TournamentManager] Successfully initialized');
            
        } catch (error) {
            console.error('[TournamentManager] Initialization failed:', error);
            throw error;
        }
    }

    /**
     * Create a new tournament
     * @param {Object} tournamentConfig - Tournament configuration
     * @param {string} creatorId - ID of the tournament creator
     * @returns {Object} Tournament creation result
     */
    async createTournament(tournamentConfig, creatorId) {
        if (!this.isInitialized) {
            throw new Error('TournamentManager not initialized');
        }

        // Check concurrent tournament limit
        if (this.activeTournaments.size >= this.config.maxConcurrentTournaments) {
            throw new Error('Maximum concurrent tournaments reached');
        }

        // Validate creator authentication
        if (this.authManager && creatorId) {
            const isValidUser = await this.validateUser(creatorId);
            if (!isValidUser) {
                throw new Error('Invalid tournament creator');
            }
        }

        // Merge with default settings
        const finalConfig = {
            ...this.config.defaultTournamentSettings,
            ...tournamentConfig,
            creatorId,
            createdAt: Date.now(),
            status: 'registration',
            registrationDeadline: Date.now() + (tournamentConfig.registrationTimeLimit || this.config.defaultTournamentSettings.registrationTimeLimit) * 1000
        };

        // Validate tournament configuration
        this.validateTournamentConfig(finalConfig);

        // Create tournament with bracket manager
        const tournamentData = this.bracketManager.createTournament(finalConfig, []);
        
        // Store tournament data
        const tournament = {
            ...tournamentData,
            creatorId,
            status: 'registration',
            registeredPlayers: [],
            spectators: [],
            createdAt: finalConfig.createdAt,
            registrationDeadline: finalConfig.registrationDeadline,
            currentMatch: null,
            stats: {
                totalRegistrations: 0,
                totalSpectators: 0,
                totalMatches: 0,
                averageMatchDuration: 0
            }
        };

        // Add to active tournaments
        this.activeTournaments.set(tournament.tournamentId, tournament);
        this.playerRegistrations.set(tournament.tournamentId, new Set());
        this.spectators.set(tournament.tournamentId, new Set());

        // Save tournament state
        await this.stateManager.saveTournamentState(tournament);

        console.log(`[TournamentManager] Tournament created: ${tournament.tournamentId} by ${creatorId}`);

        // Emit tournament created event
        multiplayerEvents.emit('TOURNAMENT_CREATED', {
            tournament,
            creatorId
        });

        return {
            success: true,
            tournament,
            registrationUrl: `/tournament/${tournament.tournamentId}/register`
        };
    }

    /**
     * Register player for tournament
     * @param {string} tournamentId - Tournament ID
     * @param {Object} playerData - Player registration data
     * @returns {Object} Registration result
     */
    async registerPlayer(tournamentId, playerData) {
        const tournament = this.activeTournaments.get(tournamentId);
        if (!tournament) {
            throw new Error('Tournament not found');
        }

        // Check tournament status
        if (tournament.status !== 'registration') {
            throw new Error('Tournament registration is closed');
        }

        // Check registration deadline
        if (Date.now() > tournament.registrationDeadline) {
            throw new Error('Registration deadline has passed');
        }

        // Check if player is already registered
        const registrations = this.playerRegistrations.get(tournamentId);
        if (registrations.has(playerData.playerId)) {
            throw new Error('Player already registered for this tournament');
        }

        // Check tournament capacity
        if (registrations.size >= tournament.config.maxPlayers) {
            throw new Error('Tournament is full');
        }

        // Validate player authentication
        if (this.authManager) {
            const isValidUser = await this.validateUser(playerData.playerId);
            if (!isValidUser) {
                throw new Error('Invalid player credentials');
            }
        }

        // Add player to registration
        const registrationData = {
            ...playerData,
            registeredAt: Date.now(),
            seed: registrations.size + 1,
            tournamentStats: {
                matchesPlayed: 0,
                matchesWon: 0,
                totalRaceTime: 0,
                averageFinishPosition: 0
            }
        };

        registrations.add(playerData.playerId);
        tournament.registeredPlayers.push(registrationData);
        tournament.stats.totalRegistrations++;

        // Update tournament state
        await this.stateManager.saveTournamentState(tournament);

        console.log(`[TournamentManager] Player registered: ${playerData.playerName} for tournament ${tournamentId}`);

        // Emit player registered event
        multiplayerEvents.emit('TOURNAMENT_PLAYER_REGISTERED', {
            tournamentId,
            tournament,
            player: registrationData,
            totalRegistrations: registrations.size
        });

        // Check if we can start the tournament
        if (registrations.size >= tournament.config.minPlayers) {
            this.checkTournamentStart(tournamentId);
        }

        return {
            success: true,
            registration: registrationData,
            tournament: this.getTournamentPublicData(tournament),
            position: registrations.size
        };
    }

    /**
     * Unregister player from tournament
     * @param {string} tournamentId - Tournament ID
     * @param {string} playerId - Player ID
     * @returns {Object} Unregistration result
     */
    async unregisterPlayer(tournamentId, playerId) {
        const tournament = this.activeTournaments.get(tournamentId);
        if (!tournament) {
            throw new Error('Tournament not found');
        }

        // Check tournament status
        if (tournament.status !== 'registration') {
            throw new Error('Cannot unregister after tournament has started');
        }

        const registrations = this.playerRegistrations.get(tournamentId);
        if (!registrations.has(playerId)) {
            throw new Error('Player not registered for this tournament');
        }

        // Remove player from registration
        registrations.delete(playerId);
        tournament.registeredPlayers = tournament.registeredPlayers.filter(p => p.playerId !== playerId);

        // Update tournament state
        await this.stateManager.saveTournamentState(tournament);

        console.log(`[TournamentManager] Player unregistered: ${playerId} from tournament ${tournamentId}`);

        // Emit player unregistered event
        multiplayerEvents.emit('TOURNAMENT_PLAYER_UNREGISTERED', {
            tournamentId,
            playerId,
            totalRegistrations: registrations.size
        });

        return {
            success: true,
            totalRegistrations: registrations.size
        };
    }

    /**
     * Add spectator to tournament
     * @param {string} tournamentId - Tournament ID
     * @param {Object} spectatorData - Spectator data
     * @returns {Object} Spectator result
     */
    async addSpectator(tournamentId, spectatorData) {
        const tournament = this.activeTournaments.get(tournamentId);
        if (!tournament) {
            throw new Error('Tournament not found');
        }

        const spectatorSet = this.spectators.get(tournamentId);
        if (spectatorSet.has(spectatorData.spectatorId)) {
            return { success: true, message: 'Already spectating' };
        }

        // Check spectator capacity
        if (spectatorSet.size >= tournament.config.spectatorCount) {
            throw new Error('Tournament spectator capacity reached');
        }

        // Add spectator
        spectatorSet.add(spectatorData.spectatorId);
        tournament.spectators.push({
            ...spectatorData,
            joinedAt: Date.now()
        });
        tournament.stats.totalSpectators++;

        console.log(`[TournamentManager] Spectator added: ${spectatorData.spectatorName} to tournament ${tournamentId}`);

        // Emit spectator joined event
        multiplayerEvents.emit('TOURNAMENT_SPECTATOR_JOINED', {
            tournamentId,
            spectator: spectatorData,
            totalSpectators: spectatorSet.size
        });

        return {
            success: true,
            spectator: spectatorData,
            totalSpectators: spectatorSet.size
        };
    }

    /**
     * Start tournament if conditions are met
     * @param {string} tournamentId - Tournament ID
     */
    async checkTournamentStart(tournamentId) {
        const tournament = this.activeTournaments.get(tournamentId);
        if (!tournament || tournament.status !== 'registration') {
            return;
        }

        const registrations = this.playerRegistrations.get(tournamentId);
        const canStart = registrations.size >= tournament.config.minPlayers &&
                        (registrations.size >= tournament.config.maxPlayers ||
                         Date.now() >= tournament.registrationDeadline);

        if (canStart) {
            await this.startTournament(tournamentId);
        }
    }

    /**
     * Start tournament
     * @param {string} tournamentId - Tournament ID
     */
    async startTournament(tournamentId) {
        const tournament = this.activeTournaments.get(tournamentId);
        if (!tournament) {
            throw new Error('Tournament not found');
        }

        if (tournament.status !== 'registration') {
            throw new Error('Tournament cannot be started');
        }

        // Update tournament status
        tournament.status = 'active';
        tournament.startedAt = Date.now();

        // Create bracket with registered players
        const tournamentData = this.bracketManager.createTournament(
            tournament.config,
            tournament.registeredPlayers
        );

        // Update tournament with bracket data
        tournament.bracket = tournamentData.bracket;
        tournament.totalRounds = tournamentData.totalRounds;
        tournament.currentRound = 1;

        // Save tournament state
        await this.stateManager.saveTournamentState(tournament);

        console.log(`[TournamentManager] Tournament started: ${tournamentId} with ${tournament.registeredPlayers.length} players`);

        // Emit tournament started event
        multiplayerEvents.emit('TOURNAMENT_STARTED', {
            tournamentId,
            tournament: this.getTournamentPublicData(tournament),
            firstRoundMatches: tournamentData.firstRoundMatches
        });

        // Start first matches
        await this.startNextMatches(tournamentId);
    }

    /**
     * Start next available matches in tournament
     * @param {string} tournamentId - Tournament ID
     */
    async startNextMatches(tournamentId) {
        const tournament = this.activeTournaments.get(tournamentId);
        if (!tournament || tournament.status !== 'active') {
            return;
        }

        // Start matches using bracket manager
        const match = this.bracketManager.startNextMatch();
        if (!match) {
            console.log(`[TournamentManager] No matches to start for tournament ${tournamentId}`);
            return;
        }

        // Create room for the match
        const roomData = await this.createMatchRoom(tournament, match);
        match.roomCode = roomData.roomCode;

        // Update tournament current match
        tournament.currentMatch = match;
        tournament.stats.totalMatches++;

        // Save tournament state
        await this.stateManager.saveTournamentState(tournament);

        console.log(`[TournamentManager] Match started: ${match.matchId} in room ${roomData.roomCode}`);

        return match;
    }

    /**
     * Create room for tournament match
     * @param {Object} tournament - Tournament data
     * @param {Object} match - Match data
     * @returns {Object} Room data
     */
    async createMatchRoom(tournament, match) {
        const roomConfig = {
            roomCode: `TOURN_${match.matchId.slice(-8)}`,
            maxPlayers: match.players.length,
            fillWithAI: false, // Tournament matches are player-only
            gameSettings: {
                raceTimeLimit: tournament.config.raceTimeLimit,
                bettingEnabled: tournament.config.bettingEnabled,
                isTournamentMatch: true,
                tournamentId: tournament.tournamentId,
                matchId: match.matchId
            },
            isPrivate: false, // Allow spectators
            spectatorLimit: tournament.config.spectatorCount
        };

        // Initialize room with match players
        this.roomManager.initializeRoom(roomConfig);

        // Add tournament players to room
        match.players.forEach(player => {
            this.roomManager.addPlayer({
                playerId: player.playerId,
                playerName: player.playerName,
                isTournamentPlayer: true,
                tournamentSeed: player.seed
            });
        });

        return {
            roomCode: roomConfig.roomCode,
            maxPlayers: roomConfig.maxPlayers,
            spectatorLimit: roomConfig.spectatorLimit
        };
    }

    /**
     * Handle tournament match completion
     * @param {string} tournamentId - Tournament ID
     * @param {string} matchId - Match ID
     * @param {Object} results - Match results
     */
    async handleMatchCompletion(tournamentId, matchId, results) {
        const tournament = this.activeTournaments.get(tournamentId);
        if (!tournament) {
            console.warn(`[TournamentManager] Tournament not found: ${tournamentId}`);
            return;
        }

        // Update tournament stats
        tournament.stats.averageMatchDuration = 
            (tournament.stats.averageMatchDuration * (tournament.stats.totalMatches - 1) + 
             results.duration) / tournament.stats.totalMatches;

        // Clear current match
        tournament.currentMatch = null;

        // Save tournament state
        await this.stateManager.saveTournamentState(tournament);

        // Check if tournament is complete
        if (this.bracketManager.isComplete) {
            await this.completeTournament(tournamentId);
        } else {
            // Start next matches
            setTimeout(() => {
                this.startNextMatches(tournamentId);
            }, 5000); // 5 second delay between matches
        }
    }

    /**
     * Complete tournament
     * @param {string} tournamentId - Tournament ID
     */
    async completeTournament(tournamentId) {
        const tournament = this.activeTournaments.get(tournamentId);
        if (!tournament) {
            return;
        }

        // Update tournament status
        tournament.status = 'completed';
        tournament.completedAt = Date.now();
        tournament.duration = tournament.completedAt - tournament.startedAt;

        // Get final results from bracket manager
        const finalStandings = this.bracketManager.generateFinalStandings();
        tournament.finalStandings = finalStandings;
        tournament.winner = finalStandings[0];

        // Save final tournament state
        await this.stateManager.saveTournamentState(tournament);

        // Archive the tournament
        await this.stateManager.archiveTournament(tournament);

        // Remove from active tournaments
        this.activeTournaments.delete(tournamentId);
        this.playerRegistrations.delete(tournamentId);
        this.spectators.delete(tournamentId);

        console.log(`[TournamentManager] Tournament completed: ${tournamentId}, winner: ${tournament.winner?.playerName}`);

        // Emit tournament completed event
        multiplayerEvents.emit('TOURNAMENT_COMPLETED', {
            tournamentId,
            tournament: this.getTournamentPublicData(tournament),
            winner: tournament.winner,
            finalStandings
        });
    }

    /**
     * Cancel tournament
     * @param {string} tournamentId - Tournament ID
     * @param {string} reason - Cancellation reason
     */
    async cancelTournament(tournamentId, reason = 'Tournament cancelled by organizer') {
        const tournament = this.activeTournaments.get(tournamentId);
        if (!tournament) {
            throw new Error('Tournament not found');
        }

        // Update tournament status
        tournament.status = 'cancelled';
        tournament.cancelledAt = Date.now();
        tournament.cancellationReason = reason;

        // Save tournament state
        await this.stateManager.saveTournamentState(tournament);

        // Clean up bracket manager
        this.bracketManager.cleanup();

        // Remove from active tournaments
        this.activeTournaments.delete(tournamentId);
        this.playerRegistrations.delete(tournamentId);
        this.spectators.delete(tournamentId);

        console.log(`[TournamentManager] Tournament cancelled: ${tournamentId}, reason: ${reason}`);

        // Emit tournament cancelled event
        multiplayerEvents.emit('TOURNAMENT_CANCELLED', {
            tournamentId,
            reason,
            registeredPlayers: tournament.registeredPlayers.length
        });
    }

    /**
     * Get public tournament data (without sensitive information)
     * @param {Object} tournament - Tournament data
     * @returns {Object} Public tournament data
     */
    getTournamentPublicData(tournament) {
        return {
            tournamentId: tournament.tournamentId,
            name: tournament.config.name,
            format: tournament.config.format,
            status: tournament.status,
            maxPlayers: tournament.config.maxPlayers,
            minPlayers: tournament.config.minPlayers,
            currentPlayers: tournament.registeredPlayers.length,
            spectatorCount: tournament.spectators.length,
            maxSpectators: tournament.config.spectatorCount,
            createdAt: tournament.createdAt,
            startedAt: tournament.startedAt,
            registrationDeadline: tournament.registrationDeadline,
            currentRound: tournament.currentRound,
            totalRounds: tournament.totalRounds,
            bettingEnabled: tournament.config.bettingEnabled,
            prizePool: tournament.config.prizePool,
            stats: tournament.stats
        };
    }

    /**
     * Get tournament details for registered player
     * @param {string} tournamentId - Tournament ID
     * @param {string} playerId - Player ID
     * @returns {Object} Tournament details
     */
    getTournamentDetails(tournamentId, playerId = null) {
        const tournament = this.activeTournaments.get(tournamentId);
        if (!tournament) {
            throw new Error('Tournament not found');
        }

        const publicData = this.getTournamentPublicData(tournament);
        
        // Add additional details for registered players
        if (playerId && this.playerRegistrations.get(tournamentId)?.has(playerId)) {
            const playerData = tournament.registeredPlayers.find(p => p.playerId === playerId);
            publicData.playerData = playerData;
            publicData.bracket = tournament.bracket;
            publicData.currentMatch = tournament.currentMatch;
        }

        return publicData;
    }

    /**
     * List active tournaments
     * @returns {Array} List of active tournaments
     */
    listActiveTournaments() {
        return Array.from(this.activeTournaments.values()).map(tournament => 
            this.getTournamentPublicData(tournament)
        );
    }

    // Utility and validation methods

    /**
     * Validate tournament configuration
     * @param {Object} config - Configuration to validate
     */
    validateTournamentConfig(config) {
        if (!config.format || !this.config.supportedFormats.includes(config.format)) {
            throw new Error(`Unsupported tournament format: ${config.format}`);
        }

        if (config.maxPlayers < config.minPlayers) {
            throw new Error('Max players cannot be less than min players');
        }

        if (config.playersPerRace < 2 || config.playersPerRace > 6) {
            throw new Error('Players per race must be between 2 and 6');
        }

        if (config.raceTimeLimit < 60 || config.raceTimeLimit > 900) {
            throw new Error('Race time limit must be between 60 and 900 seconds');
        }
    }

    /**
     * Validate user authentication
     * @param {string} userId - User ID to validate
     * @returns {boolean} Validation result
     */
    async validateUser(userId) {
        if (!this.authManager) {
            return true; // Skip validation if no auth manager
        }

        try {
            // Use existing auth manager to validate user
            return await this.authManager.validateUser(userId);
        } catch (error) {
            console.error('[TournamentManager] User validation failed:', error);
            return false;
        }
    }

    /**
     * Setup event listeners for system integration
     */
    setupEventListeners() {
        // Listen for tournament match completions
        multiplayerEvents.on('TOURNAMENT_MATCH_COMPLETED', (data) => {
            this.handleMatchCompletion(data.tournamentId, data.match.matchId, data.match.results);
        });

        // Listen for bracket manager events
        multiplayerEvents.on('TOURNAMENT_COMPLETED', (data) => {
            if (this.activeTournaments.has(data.tournamentId)) {
                this.completeTournament(data.tournamentId);
            }
        });

        // Listen for room events to integrate with tournament matches
        multiplayerEvents.on(MULTIPLAYER_EVENTS.RACE_FINISHED, (data) => {
            if (data.isTournamentMatch && data.tournamentId) {
                // Tournament match completed - bracket manager will handle it
                console.log(`[TournamentManager] Tournament race finished: ${data.tournamentId}`);
            }
        });
    }

    /**
     * Restore active tournaments from saved state
     */
    async restoreActiveTournaments() {
        try {
            const activeTournaments = await this.stateManager.loadActiveTournaments();
            
            for (const tournament of activeTournaments) {
                if (tournament.status === 'active' || tournament.status === 'registration') {
                    this.activeTournaments.set(tournament.tournamentId, tournament);
                    
                    // Restore registration sets
                    const registrations = new Set(tournament.registeredPlayers.map(p => p.playerId));
                    this.playerRegistrations.set(tournament.tournamentId, registrations);
                    
                    const spectators = new Set(tournament.spectators.map(s => s.spectatorId));
                    this.spectators.set(tournament.tournamentId, spectators);
                    
                    console.log(`[TournamentManager] Restored tournament: ${tournament.tournamentId}`);
                }
            }
            
        } catch (error) {
            console.error('[TournamentManager] Failed to restore tournaments:', error);
        }
    }

    /**
     * Get tournament statistics
     * @returns {Object} Tournament statistics
     */
    getStatistics() {
        const activeTournaments = Array.from(this.activeTournaments.values());
        
        return {
            activeTournaments: activeTournaments.length,
            totalRegistrations: activeTournaments.reduce((sum, t) => sum + t.registeredPlayers.length, 0),
            totalSpectators: activeTournaments.reduce((sum, t) => sum + t.spectators.length, 0),
            tournamentsByStatus: {
                registration: activeTournaments.filter(t => t.status === 'registration').length,
                active: activeTournaments.filter(t => t.status === 'active').length,
                completed: activeTournaments.filter(t => t.status === 'completed').length
            },
            averagePlayersPerTournament: activeTournaments.length > 0 
                ? activeTournaments.reduce((sum, t) => sum + t.registeredPlayers.length, 0) / activeTournaments.length 
                : 0
        };
    }

    /**
     * Cleanup tournament manager
     */
    cleanup() {
        this.activeTournaments.clear();
        this.playerRegistrations.clear();
        this.spectators.clear();
        this.bracketManager.cleanup();
        
        console.log('[TournamentManager] Cleaned up');
    }

    /**
     * Destroy tournament manager
     */
    destroy() {
        this.cleanup();
        this.bracketManager.destroy();
        this.stateManager.destroy();
        
        console.log('[TournamentManager] Destroyed');
    }
}

// Create singleton instance for global use
export const tournamentManager = new TournamentManager();