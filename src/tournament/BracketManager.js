/**
 * BracketManager.js - Core tournament bracket management for Memex Racing
 * 
 * Manages tournament creation, bracket generation, match scheduling, and progression.
 * Integrates with existing room and race systems for seamless tournament gameplay.
 * Now uses pluggable tournament format system for different tournament types.
 */

import { multiplayerEvents, MULTIPLAYER_EVENTS } from '../multiplayer/MultiplayerEvents.js';
import { SingleElimination } from './formats/SingleElimination.js';
import { DoubleElimination } from './formats/DoubleElimination.js';
import { RoundRobin } from './formats/RoundRobin.js';

/**
 * Tournament bracket management class
 * Handles bracket generation, match progression, and tournament state
 */
export class BracketManager {
    constructor() {
        // Tournament configuration
        this.tournamentId = null;
        this.tournamentConfig = null;
        this.tournamentFormat = null; // Active tournament format instance
        
        // Legacy bracket data (maintained for compatibility)
        this.bracket = [];
        this.currentRound = 0;
        this.maxRounds = 0;
        
        // Tournament state
        this.isActive = false;
        this.isComplete = false;
        this.startTime = null;
        this.endTime = null;
        
        // Integration with existing systems
        this.roomManager = null; // Will be set by TournamentManager
        this.gameEngine = null; // Will be set by TournamentManager
        
        // Format registry
        this.formatRegistry = new Map([
            ['single_elimination', SingleElimination],
            ['double_elimination', DoubleElimination],
            ['round_robin', RoundRobin]
        ]);
        
        console.log('[BracketManager] Initialized with format system');
        this.setupEventListeners();
    }

    /**
     * Create a new tournament bracket
     * @param {Object} config - Tournament configuration
     * @param {Array} players - List of participating players
     * @returns {Object} Tournament data
     */
    async createTournament(config, players) {
        if (this.isActive) {
            throw new Error('Tournament already active');
        }

        // Validate configuration
        this.validateTournamentConfig(config);
        
        // Validate player count
        this.validatePlayerCount(players.length);
        
        // Generate unique tournament ID
        this.tournamentId = this.generateTournamentId();
        this.tournamentConfig = {
            name: config.name || `Tournament ${this.tournamentId}`,
            format: config.format || 'single_elimination',
            maxPlayers: config.maxPlayers || 64,
            minPlayers: config.minPlayers || 4,
            raceTimeLimit: config.raceTimeLimit || 300, // 5 minutes
            playersPerRace: config.playersPerRace || 6,
            bettingEnabled: config.bettingEnabled !== false,
            spectatorCount: config.spectatorCount || 50,
            prizePool: config.prizePool || 0,
            ...config
        };

        // Create tournament format instance
        this.createTournamentFormat();
        
        // Initialize tournament with the format
        const formatResult = await this.tournamentFormat.initialize(this.tournamentId, players);
        
        // Update legacy bracket data for compatibility
        this.updateLegacyBracketData(formatResult);
        
        // Mark tournament as active
        this.isActive = true;
        this.startTime = Date.now();
        
        console.log(`[BracketManager] Tournament created: ${this.tournamentId} with ${players.length} players using ${this.tournamentConfig.format} format`);
        
        // Emit tournament created event
        multiplayerEvents.emit('TOURNAMENT_CREATED', {
            tournamentId: this.tournamentId,
            config: this.tournamentConfig,
            playerCount: players.length,
            bracket: this.getBracketSummary(),
            format: this.tournamentConfig.format
        });

        return {
            tournamentId: this.tournamentId,
            config: this.tournamentConfig,
            bracket: formatResult.bracket,
            totalRounds: formatResult.totalRounds || this.maxRounds,
            firstRoundMatches: this.getMatchesForRound(1),
            format: this.tournamentConfig.format,
            formatData: formatResult
        };
    }

    /**
     * Create tournament format instance
     */
    createTournamentFormat() {
        const FormatClass = this.formatRegistry.get(this.tournamentConfig.format);
        if (!FormatClass) {
            throw new Error(`Unsupported tournament format: ${this.tournamentConfig.format}`);
        }
        
        this.tournamentFormat = new FormatClass(this.tournamentConfig);
        console.log(`[BracketManager] Created ${this.tournamentConfig.format} format instance`);
    }

    /**
     * Update legacy bracket data for backward compatibility
     * @param {Object} formatResult - Result from format initialization
     */
    updateLegacyBracketData(formatResult) {
        this.maxRounds = formatResult.totalRounds || formatResult.winnersRounds || 1;
        this.currentRound = 1;
        
        // Convert format bracket to legacy format
        if (formatResult.bracket) {
            if (formatResult.bracket.rounds) {
                // Round robin or simple bracket format
                this.bracket = formatResult.bracket.rounds;
            } else if (formatResult.bracket.winnersBracket) {
                // Double elimination format
                this.bracket = [
                    ...formatResult.bracket.winnersBracket,
                    ...formatResult.bracket.losersBracket,
                    formatResult.bracket.grandFinals
                ].filter(round => round);
            } else {
                // Single elimination or other format
                this.bracket = Array.isArray(formatResult.bracket) ? formatResult.bracket : [];
            }
        }
    }

    /**
     * Generate single elimination bracket
     * @param {number} playerCount - Number of players
     */
    generateSingleEliminationBracket(playerCount) {
        // Calculate bracket size (next power of 2)
        const bracketSize = Math.pow(2, Math.ceil(Math.log2(playerCount)));
        this.maxRounds = Math.log2(bracketSize);
        
        // Seed players (shuffle for randomness or use ranking)
        const seededPlayers = this.seedPlayers([...this.participants.values()]);
        
        // Generate first round matches
        this.bracket = [];
        const firstRoundMatches = [];
        
        // If we need byes, calculate them
        const byeCount = bracketSize - playerCount;
        const playersWithByes = seededPlayers.slice(0, byeCount);
        const playersInFirstRound = seededPlayers.slice(byeCount);
        
        // Handle byes - advance directly to second round
        if (byeCount > 0) {
            playersWithByes.forEach(player => {
                this.addPlayerToAdvanced(2, player);
            });
        }
        
        // Create first round matches
        for (let i = 0; i < playersInFirstRound.length; i += this.tournamentConfig.playersPerRace) {
            const matchPlayers = playersInFirstRound.slice(i, i + this.tournamentConfig.playersPerRace);
            
            const match = this.createMatch(1, matchPlayers);
            firstRoundMatches.push(match);
            this.pendingMatches.set(match.matchId, match);
        }
        
        this.bracket.push({
            round: 1,
            matches: firstRoundMatches,
            completedMatches: 0,
            totalMatches: firstRoundMatches.length
        });
        
        // Generate subsequent round structure
        for (let round = 2; round <= this.maxRounds; round++) {
            this.bracket.push({
                round,
                matches: [],
                completedMatches: 0,
                totalMatches: Math.ceil(Math.pow(2, this.maxRounds - round + 1) / this.tournamentConfig.playersPerRace)
            });
        }
        
        this.currentRound = 1;
        console.log(`[BracketManager] Generated single elimination bracket: ${this.maxRounds} rounds, ${firstRoundMatches.length} first round matches`);
    }

    /**
     * Generate double elimination bracket (placeholder for future implementation)
     * @param {number} playerCount - Number of players
     */
    generateDoubleEliminationBracket(playerCount) {
        // For now, use single elimination with additional loser's bracket
        console.warn('[BracketManager] Double elimination not fully implemented, using single elimination');
        this.generateSingleEliminationBracket(playerCount);
    }

    /**
     * Generate round robin bracket (placeholder for future implementation)
     * @param {number} playerCount - Number of players
     */
    generateRoundRobinBracket(playerCount) {
        console.warn('[BracketManager] Round robin not implemented, using single elimination');
        this.generateSingleEliminationBracket(playerCount);
    }

    /**
     * Create a match object
     * @param {number} round - Round number
     * @param {Array} players - Players in the match
     * @returns {Object} Match data
     */
    createMatch(round, players) {
        const matchId = `${this.tournamentId}_r${round}_m${Date.now()}`;
        
        return {
            matchId,
            tournamentId: this.tournamentId,
            round,
            players: players.map(player => ({
                playerId: player.playerId,
                playerName: player.playerName,
                seed: player.seed,
                isEliminated: false
            })),
            status: 'pending',
            startTime: null,
            endTime: null,
            results: null,
            winner: null,
            roomCode: null,
            spectators: []
        };
    }

    /**
     * Start the next available match
     * @returns {Object|null} Started match data
     */
    startNextMatch() {
        if (!this.isActive || this.isComplete) {
            console.warn('[BracketManager] Cannot start match - tournament not active');
            return null;
        }

        if (!this.tournamentFormat) {
            console.warn('[BracketManager] No tournament format available');
            return null;
        }

        // Use format to get next match
        const nextMatch = this.tournamentFormat.getNextMatch();
        if (!nextMatch) {
            console.log('[BracketManager] No pending matches available');
            return null;
        }

        // Start the match using format
        const startedMatch = this.tournamentFormat.startMatch(nextMatch.matchId);
        
        console.log(`[BracketManager] Starting match: ${startedMatch.matchId} in round ${startedMatch.round}`);
        
        // Emit match started event
        multiplayerEvents.emit('TOURNAMENT_MATCH_STARTED', {
            tournamentId: this.tournamentId,
            match: startedMatch,
            round: startedMatch.round,
            format: this.tournamentConfig.format
        });

        return startedMatch;
    }

    /**
     * Complete a match with results
     * @param {string} matchId - Match ID
     * @param {Object} raceResults - Race results from the game engine
     */
    completeMatch(matchId, raceResults) {
        if (!this.tournamentFormat) {
            console.warn(`[BracketManager] No tournament format available for match: ${matchId}`);
            return;
        }

        try {
            // Use format to complete match
            const completionResult = this.tournamentFormat.completeMatch(matchId, raceResults);
            
            // Update tournament state
            this.updateTournamentState();
            
            console.log(`[BracketManager] Match completed: ${matchId} using ${this.tournamentConfig.format} format`);
            
            // Emit match completed event
            multiplayerEvents.emit('TOURNAMENT_MATCH_COMPLETED', {
                tournamentId: this.tournamentId,
                match: completionResult.match,
                format: this.tournamentConfig.format,
                ...completionResult
            });

            // Check if tournament is complete
            if (this.tournamentFormat.isComplete()) {
                this.completeTournament();
            }
            
            return completionResult;
            
        } catch (error) {
            console.error(`[BracketManager] Error completing match ${matchId}:`, error);
            throw error;
        }
    }

    /**
     * Process race results into tournament format
     * @param {Object} match - Match data
     * @param {Object} raceResults - Raw race results
     * @returns {Object} Processed results
     */
    processRaceResults(match, raceResults) {
        // Sort players by race finish position
        const sortedResults = raceResults.players.sort((a, b) => a.finishPosition - b.finishPosition);
        
        // Determine advancement based on tournament format
        const advancementCount = this.getAdvancementCount(match.round);
        const advanced = sortedResults.slice(0, advancementCount);
        const eliminated = sortedResults.slice(advancementCount);
        
        return {
            winner: advanced[0], // First place winner
            advanced: advanced.map(result => ({
                playerId: result.playerId,
                playerName: result.playerName,
                finishPosition: result.finishPosition,
                raceTime: result.raceTime,
                eliminated: false
            })),
            eliminated: eliminated.map(result => ({
                playerId: result.playerId,
                playerName: result.playerName,
                finishPosition: result.finishPosition,
                raceTime: result.raceTime,
                eliminated: true
            })),
            raceStats: {
                duration: raceResults.raceDuration,
                map: raceResults.map,
                totalPlayers: raceResults.players.length
            }
        };
    }

    /**
     * Handle match completion - advance/eliminate players
     * @param {Object} match - Completed match
     */
    handleMatchCompletion(match) {
        const results = match.results;
        
        // Add eliminated players to eliminated set
        results.eliminated.forEach(player => {
            this.eliminatedPlayers.add(player.playerId);
            console.log(`[BracketManager] Player eliminated: ${player.playerName}`);
        });
        
        // Add advanced players to next round
        if (match.round < this.maxRounds) {
            results.advanced.forEach(player => {
                this.addPlayerToAdvanced(match.round + 1, player);
            });
        }
    }

    /**
     * Complete a tournament round
     * @param {number} round - Completed round number
     */
    completeRound(round) {
        console.log(`[BracketManager] Round ${round} completed`);
        
        // Emit round completed event
        multiplayerEvents.emit('TOURNAMENT_ROUND_COMPLETED', {
            tournamentId: this.tournamentId,
            round,
            advancedPlayers: this.advancedPlayers.get(round + 1) || [],
            eliminatedCount: this.eliminatedPlayers.size
        });

        // Check if tournament is complete
        if (round >= this.maxRounds) {
            this.completeTournament();
            return;
        }

        // Generate next round matches
        this.generateNextRoundMatches(round + 1);
        this.currentRound = round + 1;
    }

    /**
     * Generate matches for the next round
     * @param {number} round - Round number to generate
     */
    generateNextRoundMatches(round) {
        const advancedPlayers = this.advancedPlayers.get(round) || [];
        
        if (advancedPlayers.length === 0) {
            console.warn(`[BracketManager] No players advanced to round ${round}`);
            return;
        }

        const roundData = this.bracket[round - 1];
        const matches = [];
        
        // Create matches from advanced players
        for (let i = 0; i < advancedPlayers.length; i += this.tournamentConfig.playersPerRace) {
            const matchPlayers = advancedPlayers.slice(i, i + this.tournamentConfig.playersPerRace);
            
            const match = this.createMatch(round, matchPlayers);
            matches.push(match);
            this.pendingMatches.set(match.matchId, match);
        }
        
        roundData.matches = matches;
        roundData.totalMatches = matches.length;
        
        console.log(`[BracketManager] Generated ${matches.length} matches for round ${round}`);
    }

    /**
     * Complete the tournament
     */
    completeTournament() {
        this.isActive = false;
        this.isComplete = true;
        this.endTime = Date.now();
        
        // Get final standings from format
        const finalStandings = this.tournamentFormat ? this.tournamentFormat.getFinalStandings() : [];
        const tournamentWinner = finalStandings[0] || null;
        
        const tournamentResults = {
            tournamentId: this.tournamentId,
            format: this.tournamentConfig.format,
            winner: tournamentWinner,
            totalPlayers: this.tournamentFormat ? this.tournamentFormat.participants.size : 0,
            totalMatches: this.tournamentFormat ? this.tournamentFormat.statistics.completedMatches : 0,
            duration: this.endTime - this.startTime,
            bracket: this.getBracketSummary(),
            finalStandings,
            statistics: this.tournamentFormat ? this.tournamentFormat.getStatistics() : {}
        };
        
        console.log(`[BracketManager] Tournament completed: ${this.tournamentId}, winner: ${tournamentWinner?.playerName}, format: ${this.tournamentConfig.format}`);
        
        // Emit tournament completed event
        multiplayerEvents.emit('TOURNAMENT_COMPLETED', tournamentResults);
    }

    /**
     * Generate final tournament standings
     * @returns {Array} Final standings
     */
    generateFinalStandings() {
        const standings = [];
        
        // Add tournament winner
        const finalMatch = this.bracket[this.maxRounds - 1]?.matches[0];
        if (finalMatch?.winner) {
            standings.push({
                position: 1,
                playerId: finalMatch.winner.playerId,
                playerName: finalMatch.winner.playerName,
                eliminated: false,
                eliminatedIn: null
            });
        }
        
        // Add other players based on elimination round
        let position = 2;
        for (let round = this.maxRounds; round >= 1; round--) {
            const roundMatches = this.bracket[round - 1]?.matches || [];
            
            roundMatches.forEach(match => {
                if (match.results?.eliminated) {
                    match.results.eliminated.forEach(player => {
                        standings.push({
                            position: position++,
                            playerId: player.playerId,
                            playerName: player.playerName,
                            eliminated: true,
                            eliminatedIn: round
                        });
                    });
                }
            });
        }
        
        return standings.sort((a, b) => a.position - b.position);
    }

    /**
     * Get advancement count for a round
     * @param {number} round - Round number
     * @returns {number} Number of players to advance
     */
    getAdvancementCount(round) {
        // For single elimination, typically advance 1 player per race
        // But for races with multiple slots, advance top performers
        if (this.tournamentConfig.format === 'single_elimination') {
            return Math.ceil(this.tournamentConfig.playersPerRace / 2);
        }
        
        return 1; // Default to 1 advancement
    }

    // Utility methods

    /**
     * Validate tournament configuration
     * @param {Object} config - Configuration to validate
     */
    validateTournamentConfig(config) {
        if (!config || typeof config !== 'object') {
            throw new Error('Tournament configuration is required');
        }
        
        if (config.maxPlayers && (config.maxPlayers < 4 || config.maxPlayers > 64)) {
            throw new Error('Max players must be between 4 and 64');
        }
        
        if (config.playersPerRace && (config.playersPerRace < 2 || config.playersPerRace > 6)) {
            throw new Error('Players per race must be between 2 and 6');
        }
    }

    /**
     * Validate player count
     * @param {number} playerCount - Number of players
     */
    validatePlayerCount(playerCount) {
        if (playerCount < 4) {
            throw new Error('Minimum 4 players required for tournament');
        }
        
        if (playerCount > 64) {
            throw new Error('Maximum 64 players allowed for tournament');
        }
    }

    /**
     * Initialize tournament participants
     * @param {Array} players - Player list
     */
    initializeParticipants(players) {
        this.participants.clear();
        this.eliminatedPlayers.clear();
        this.advancedPlayers.clear();
        
        players.forEach((player, index) => {
            const participant = {
                ...player,
                seed: index + 1,
                tournamentStats: {
                    matchesPlayed: 0,
                    matchesWon: 0,
                    totalRaceTime: 0,
                    averageFinishPosition: 0
                }
            };
            
            this.participants.set(player.playerId, participant);
        });
    }

    /**
     * Seed players for bracket generation
     * @param {Array} players - Players to seed
     * @returns {Array} Seeded players
     */
    seedPlayers(players) {
        // For now, use random seeding
        // In future, could use ranking system
        return this.shuffleArray([...players]);
    }

    /**
     * Add player to advanced list for next round
     * @param {number} round - Round number
     * @param {Object} player - Player data
     */
    addPlayerToAdvanced(round, player) {
        if (!this.advancedPlayers.has(round)) {
            this.advancedPlayers.set(round, []);
        }
        
        this.advancedPlayers.get(round).push(player);
    }

    /**
     * Generate unique tournament ID
     * @returns {string} Tournament ID
     */
    generateTournamentId() {
        return `tournament_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    /**
     * Shuffle array utility
     * @param {Array} array - Array to shuffle
     * @returns {Array} Shuffled array
     */
    shuffleArray(array) {
        for (let i = array.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [array[i], array[j]] = [array[j], array[i]];
        }
        return array;
    }

    /**
     * Get matches for a specific round
     * @param {number} round - Round number
     * @returns {Array} Matches in the round
     */
    getMatchesForRound(round) {
        const roundData = this.bracket.find(r => r.round === round);
        return roundData ? roundData.matches : [];
    }

    /**
     * Get bracket summary for display
     * @returns {Object} Bracket summary
     */
    getBracketSummary() {
        if (this.tournamentFormat) {
            return {
                ...this.tournamentFormat.getBracketSummary(),
                format: this.tournamentConfig.format,
                config: this.tournamentFormat.getFormatConfig()
            };
        }
        
        // Fallback for legacy compatibility
        return {
            tournamentId: this.tournamentId,
            format: this.tournamentConfig?.format || 'unknown',
            totalRounds: this.maxRounds,
            currentRound: this.currentRound,
            totalPlayers: 0,
            remainingPlayers: 0,
            completedMatches: 0,
            activeMatches: 0,
            pendingMatches: 0
        };
    }

    /**
     * Get tournament status
     * @returns {Object} Tournament status
     */
    getStatus() {
        const formatSummary = this.tournamentFormat ? this.tournamentFormat.getBracketSummary() : {};
        const formatStats = this.tournamentFormat ? this.tournamentFormat.getStatistics() : {};
        
        return {
            tournamentId: this.tournamentId,
            format: this.tournamentConfig?.format || 'unknown',
            isActive: this.isActive,
            isComplete: this.isComplete,
            currentRound: formatSummary.currentRound || this.currentRound,
            maxRounds: formatSummary.totalRounds || this.maxRounds,
            participantCount: formatSummary.totalPlayers || 0,
            eliminatedCount: formatSummary.eliminationCount || 0,
            activeMatches: formatSummary.activeMatches || 0,
            pendingMatches: formatSummary.pendingMatches || 0,
            completedMatches: formatSummary.completedMatches || 0,
            startTime: this.startTime,
            duration: this.startTime ? Date.now() - this.startTime : 0,
            statistics: formatStats
        };
    }

    /**
     * Setup event listeners for integration
     */
    setupEventListeners() {
        // Listen for race completion events from the game engine
        multiplayerEvents.on(MULTIPLAYER_EVENTS.RACE_FINISHED, (data) => {
            // Check if this race is part of our tournament
            const matchId = data.matchId || data.roomCode;
            if (matchId && this.activeMatches.has(matchId)) {
                this.completeMatch(matchId, data.results || data);
            }
        });
    }

    /**
     * Update tournament state from format
     */
    updateTournamentState() {
        if (!this.tournamentFormat) return;
        
        const summary = this.tournamentFormat.getBracketSummary();
        this.currentRound = summary.currentRound || 1;
        this.maxRounds = summary.totalRounds || 1;
        
        // Update legacy data for compatibility
        const formatData = this.tournamentFormat;
        if (formatData.rounds) {
            this.bracket = formatData.rounds;
        }
    }

    /**
     * Get matches for a specific round
     * @param {number} round - Round number
     * @param {string} bracket - Bracket type (for double elimination)
     * @returns {Array} Matches in the round
     */
    getMatchesForRound(round, bracket = 'main') {
        if (this.tournamentFormat && typeof this.tournamentFormat.getMatchesForRound === 'function') {
            return this.tournamentFormat.getMatchesForRound(round, bracket);
        }
        
        // Fallback to legacy method
        const roundData = this.bracket.find(r => r.round === round);
        return roundData ? roundData.matches : [];
    }

    /**
     * Get player statistics
     * @param {string} playerId - Player ID
     * @returns {Object} Player statistics
     */
    getPlayerStats(playerId) {
        if (this.tournamentFormat && typeof this.tournamentFormat.getPlayerStats === 'function') {
            return this.tournamentFormat.getPlayerStats(playerId);
        }
        
        return null;
    }

    /**
     * Get current standings (for round robin)
     * @returns {Array} Current standings
     */
    getCurrentStandings() {
        if (this.tournamentFormat && typeof this.tournamentFormat.getCurrentStandings === 'function') {
            return this.tournamentFormat.getCurrentStandings();
        }
        
        return [];
    }

    /**
     * Get head-to-head record (for round robin)
     * @param {string} playerId1 - First player ID
     * @param {string} playerId2 - Second player ID
     * @returns {Object} Head-to-head record
     */
    getHeadToHeadRecord(playerId1, playerId2) {
        if (this.tournamentFormat && typeof this.tournamentFormat.getHeadToHeadRecord === 'function') {
            return this.tournamentFormat.getHeadToHeadRecord(playerId1, playerId2);
        }
        
        return null;
    }

    /**
     * Get available tournament formats
     * @returns {Array} Available formats with their configurations
     */
    getAvailableFormats() {
        return Array.from(this.formatRegistry.entries()).map(([key, FormatClass]) => {
            const tempInstance = new FormatClass({ format: key });
            return {
                key,
                ...tempInstance.getFormatConfig()
            };
        });
    }

    /**
     * Validate format-specific configuration
     * @param {Object} config - Tournament configuration
     * @returns {Object} Validation result
     */
    validateFormatConfig(config) {
        const FormatClass = this.formatRegistry.get(config.format);
        if (!FormatClass) {
            return {
                isValid: false,
                errors: [`Unsupported format: ${config.format}`]
            };
        }
        
        try {
            const tempInstance = new FormatClass(config);
            tempInstance.initializeParticipants(Array(config.maxPlayers || 16).fill(0).map((_, i) => ({ 
                playerId: `player_${i}`, 
                playerName: `Player ${i + 1}` 
            })));
            
            const validation = tempInstance.validateStart();
            return validation;
        } catch (error) {
            return {
                isValid: false,
                errors: [error.message]
            };
        }
    }

    /**
     * Cleanup bracket manager
     */
    cleanup() {
        if (this.tournamentFormat) {
            this.tournamentFormat.cleanup();
            this.tournamentFormat = null;
        }
        
        this.bracket = [];
        this.isActive = false;
        this.isComplete = false;
        this.tournamentId = null;
        this.tournamentConfig = null;
        
        console.log('[BracketManager] Cleaned up');
    }

    /**
     * Destroy the bracket manager
     */
    destroy() {
        this.cleanup();
        this.formatRegistry.clear();
        console.log('[BracketManager] Destroyed');
    }
}