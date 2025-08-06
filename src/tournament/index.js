/**
 * Tournament System Index - Memex Racing Tournament Management
 * 
 * Exports all tournament-related classes and utilities for easy importing
 * throughout the application.
 */

export { BracketManager } from './BracketManager.js';
export { TournamentManager, tournamentManager } from './TournamentManager.js';
export { TournamentStateManager } from './TournamentStateManager.js';

// Tournament format exports
export { TournamentFormat } from './formats/TournamentFormat.js';
export { SingleElimination } from './formats/SingleElimination.js';
export { DoubleElimination } from './formats/DoubleElimination.js';
export { RoundRobin } from './formats/RoundRobin.js';

// Import for default export
import { TournamentFormat } from './formats/TournamentFormat.js';
import { SingleElimination } from './formats/SingleElimination.js';
import { DoubleElimination } from './formats/DoubleElimination.js';
import { RoundRobin } from './formats/RoundRobin.js';

// Tournament event constants for integration with existing multiplayer events
export const TOURNAMENT_EVENTS = {
    TOURNAMENT_CREATED: 'TOURNAMENT_CREATED',
    TOURNAMENT_STARTED: 'TOURNAMENT_STARTED',
    TOURNAMENT_COMPLETED: 'TOURNAMENT_COMPLETED',
    TOURNAMENT_CANCELLED: 'TOURNAMENT_CANCELLED',
    TOURNAMENT_PLAYER_REGISTERED: 'TOURNAMENT_PLAYER_REGISTERED',
    TOURNAMENT_PLAYER_UNREGISTERED: 'TOURNAMENT_PLAYER_UNREGISTERED',
    TOURNAMENT_SPECTATOR_JOINED: 'TOURNAMENT_SPECTATOR_JOINED',
    TOURNAMENT_MATCH_STARTED: 'TOURNAMENT_MATCH_STARTED',
    TOURNAMENT_MATCH_COMPLETED: 'TOURNAMENT_MATCH_COMPLETED',
    TOURNAMENT_ROUND_COMPLETED: 'TOURNAMENT_ROUND_COMPLETED'
};

// Tournament configuration constants
export const TOURNAMENT_CONFIG = {
    SUPPORTED_FORMATS: ['single_elimination', 'double_elimination', 'round_robin'],
    MIN_PLAYERS: 4,
    MAX_PLAYERS: 64,
    MIN_PLAYERS_PER_RACE: 2,
    MAX_PLAYERS_PER_RACE: 6,
    DEFAULT_RACE_TIME_LIMIT: 300, // 5 minutes
    DEFAULT_REGISTRATION_TIME_LIMIT: 600, // 10 minutes
    MAX_CONCURRENT_TOURNAMENTS: 5,
    DEFAULT_SPECTATOR_LIMIT: 50
};

// Tournament status constants
export const TOURNAMENT_STATUS = {
    REGISTRATION: 'registration',
    ACTIVE: 'active',
    COMPLETED: 'completed',
    CANCELLED: 'cancelled'
};

// Match status constants
export const MATCH_STATUS = {
    PENDING: 'pending',
    ACTIVE: 'active',
    COMPLETED: 'completed',
    CANCELLED: 'cancelled'
};

/**
 * Tournament utility functions
 */
export const TournamentUtils = {
    /**
     * Calculate bracket size for tournament
     * @param {number} playerCount - Number of players
     * @returns {number} Bracket size (next power of 2)
     */
    calculateBracketSize(playerCount) {
        return Math.pow(2, Math.ceil(Math.log2(playerCount)));
    },

    /**
     * Calculate number of rounds needed
     * @param {number} playerCount - Number of players
     * @returns {number} Number of rounds
     */
    calculateRounds(playerCount) {
        return Math.ceil(Math.log2(playerCount));
    },

    /**
     * Validate tournament configuration
     * @param {Object} config - Tournament configuration
     * @returns {Object} Validation result
     */
    validateConfig(config) {
        const errors = [];

        if (!config.format || !TOURNAMENT_CONFIG.SUPPORTED_FORMATS.includes(config.format)) {
            errors.push(`Invalid tournament format: ${config.format}`);
        }

        if (config.maxPlayers < TOURNAMENT_CONFIG.MIN_PLAYERS || config.maxPlayers > TOURNAMENT_CONFIG.MAX_PLAYERS) {
            errors.push(`Max players must be between ${TOURNAMENT_CONFIG.MIN_PLAYERS} and ${TOURNAMENT_CONFIG.MAX_PLAYERS}`);
        }

        if (config.minPlayers < TOURNAMENT_CONFIG.MIN_PLAYERS || config.minPlayers > config.maxPlayers) {
            errors.push(`Min players must be between ${TOURNAMENT_CONFIG.MIN_PLAYERS} and max players`);
        }

        if (config.playersPerRace < TOURNAMENT_CONFIG.MIN_PLAYERS_PER_RACE || 
            config.playersPerRace > TOURNAMENT_CONFIG.MAX_PLAYERS_PER_RACE) {
            errors.push(`Players per race must be between ${TOURNAMENT_CONFIG.MIN_PLAYERS_PER_RACE} and ${TOURNAMENT_CONFIG.MAX_PLAYERS_PER_RACE}`);
        }

        if (config.raceTimeLimit < 60 || config.raceTimeLimit > 900) {
            errors.push('Race time limit must be between 60 and 900 seconds');
        }

        return {
            isValid: errors.length === 0,
            errors
        };
    },

    /**
     * Generate tournament ID
     * @returns {string} Unique tournament ID
     */
    generateTournamentId() {
        return `tournament_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    },

    /**
     * Calculate estimated tournament duration
     * @param {number} playerCount - Number of players
     * @param {number} raceTimeLimit - Race time limit in seconds
     * @param {number} playersPerRace - Players per race
     * @returns {number} Estimated duration in milliseconds
     */
    estimateDuration(playerCount, raceTimeLimit = 300, playersPerRace = 6) {
        const rounds = this.calculateRounds(playerCount);
        const matchesPerRound = Math.ceil(playerCount / playersPerRace);
        const avgMatchesTotal = matchesPerRound * rounds;
        
        // Add buffer time for match setup, results processing, etc.
        const bufferTime = 60; // 1 minute per match
        const totalTime = avgMatchesTotal * (raceTimeLimit + bufferTime);
        
        return totalTime * 1000; // Convert to milliseconds
    },

    /**
     * Format tournament duration for display
     * @param {number} duration - Duration in milliseconds
     * @returns {string} Formatted duration string
     */
    formatDuration(duration) {
        const hours = Math.floor(duration / (1000 * 60 * 60));
        const minutes = Math.floor((duration % (1000 * 60 * 60)) / (1000 * 60));
        const seconds = Math.floor((duration % (1000 * 60)) / 1000);

        if (hours > 0) {
            return `${hours}h ${minutes}m ${seconds}s`;
        } else if (minutes > 0) {
            return `${minutes}m ${seconds}s`;
        } else {
            return `${seconds}s`;
        }
    },

    /**
     * Get tournament status display text
     * @param {string} status - Tournament status
     * @returns {string} Display text
     */
    getStatusDisplayText(status) {
        const statusMap = {
            [TOURNAMENT_STATUS.REGISTRATION]: 'Registration Open',
            [TOURNAMENT_STATUS.ACTIVE]: 'In Progress',
            [TOURNAMENT_STATUS.COMPLETED]: 'Completed',
            [TOURNAMENT_STATUS.CANCELLED]: 'Cancelled'
        };

        return statusMap[status] || 'Unknown';
    },

    /**
     * Check if player can register for tournament
     * @param {Object} tournament - Tournament data
     * @param {string} playerId - Player ID
     * @returns {Object} Registration eligibility
     */
    canPlayerRegister(tournament, playerId) {
        const now = Date.now();
        const reasons = [];

        if (tournament.status !== TOURNAMENT_STATUS.REGISTRATION) {
            reasons.push('Tournament registration is closed');
        }

        if (now > tournament.registrationDeadline) {
            reasons.push('Registration deadline has passed');
        }

        if (tournament.registeredPlayers?.length >= tournament.config?.maxPlayers) {
            reasons.push('Tournament is full');
        }

        if (tournament.registeredPlayers?.some(p => p.playerId === playerId)) {
            reasons.push('Player already registered');
        }

        return {
            canRegister: reasons.length === 0,
            reasons
        };
    }
};

/**
 * Tournament integration helpers
 */
export const TournamentIntegration = {
    /**
     * Initialize tournament system with existing game systems
     * @param {Object} systems - Game system references
     * @returns {Object} Initialized tournament manager
     */
    async initialize(systems = {}) {
        const { authManager, gameEngine, roomManager } = systems;
        
        // Create tournament manager with system integrations
        const manager = new TournamentManager(authManager, gameEngine);
        
        // Initialize the manager
        await manager.initialize();
        
        // Set up room manager integration if provided
        if (roomManager) {
            manager.roomManager = roomManager;
        }
        
        return manager;
    },

    /**
     * Create tournament room configuration for integration
     * @param {Object} tournament - Tournament data
     * @param {Object} match - Match data
     * @returns {Object} Room configuration
     */
    createTournamentRoomConfig(tournament, match) {
        return {
            roomCode: `TOURN_${match.matchId.slice(-8)}`,
            maxPlayers: match.players.length,
            fillWithAI: false,
            gameSettings: {
                raceTimeLimit: tournament.config.raceTimeLimit,
                bettingEnabled: tournament.config.bettingEnabled,
                isTournamentMatch: true,
                tournamentId: tournament.tournamentId,
                matchId: match.matchId,
                tournamentRound: match.round
            },
            isPrivate: false,
            spectatorLimit: tournament.config.spectatorCount,
            tournamentMode: true
        };
    },

    /**
     * Extract tournament results from race results
     * @param {Object} raceResults - Raw race results from game engine
     * @returns {Object} Tournament-formatted results
     */
    formatRaceResultsForTournament(raceResults) {
        return {
            players: raceResults.players?.map(player => ({
                playerId: player.playerId,
                playerName: player.playerName,
                finishPosition: player.finishPosition,
                raceTime: player.raceTime || player.finishTime,
                eliminated: player.eliminated || false
            })) || [],
            duration: raceResults.raceDuration || raceResults.duration || 0,
            map: raceResults.map || raceResults.mapName || 'unknown',
            winner: raceResults.winner,
            completedAt: Date.now()
        };
    }
};

export default {
    BracketManager,
    TournamentManager,
    TournamentStateManager,
    tournamentManager,
    // Tournament formats
    TournamentFormat,
    SingleElimination,
    DoubleElimination,
    RoundRobin,
    // Constants and utilities
    TOURNAMENT_EVENTS,
    TOURNAMENT_CONFIG,
    TOURNAMENT_STATUS,
    MATCH_STATUS,
    TournamentUtils,
    TournamentIntegration
};