/**
 * TournamentFormat.js - Base class for all tournament formats in Memex Racing
 * 
 * Provides common functionality and interface for tournament formats including
 * bracket generation, match scheduling, player advancement, and statistics tracking.
 */

import { multiplayerEvents } from '../../multiplayer/MultiplayerEvents.js';
import { MersenneTwister } from '../../utils/MersenneTwister.js';

/**
 * Base tournament format class
 * All specific tournament formats should extend this class
 */
export class TournamentFormat {
    constructor(tournamentConfig) {
        this.tournamentConfig = {
            name: 'Base Tournament',
            format: 'unknown',
            maxPlayers: 64,
            minPlayers: 4,
            raceTimeLimit: 300,
            playersPerRace: 6,
            bettingEnabled: true,
            spectatorCount: 50,
            prizePool: 0,
            ...tournamentConfig
        };

        // Tournament state
        this.tournamentId = null;
        this.participants = new Map(); // playerId -> player data
        this.matches = new Map(); // matchId -> match data
        this.rounds = [];
        this.currentRound = 0;
        this.maxRounds = 0;
        
        // Match tracking
        this.activeMatches = new Map();
        this.completedMatches = new Map();
        this.pendingMatches = new Map();
        
        // Player state tracking
        this.eliminatedPlayers = new Set();
        this.advancedPlayers = new Map(); // round -> players[]
        this.playerStats = new Map(); // playerId -> stats
        
        // Format-specific data
        this.formatData = {};
        
        // Seeding and randomization
        this.randomizer = new MersenneTwister();
        
        // Tournament statistics
        this.statistics = {
            totalMatches: 0,
            completedMatches: 0,
            averageMatchDuration: 0,
            totalRaceTime: 0,
            byeCount: 0,
            eliminationCount: 0
        };

        console.log(`[TournamentFormat] Base format initialized: ${this.tournamentConfig.format}`);
    }

    /**
     * Initialize the tournament format with players
     * Must be implemented by subclasses
     * @param {string} tournamentId - Tournament ID
     * @param {Array} players - List of participating players
     * @returns {Object} Tournament initialization data
     */
    async initialize(tournamentId, players) {
        throw new Error('initialize() must be implemented by subclass');
    }

    /**
     * Generate bracket structure for the tournament format
     * Must be implemented by subclasses
     * @returns {Object} Bracket structure
     */
    generateBracket() {
        throw new Error('generateBracket() must be implemented by subclass');
    }

    /**
     * Get the next available match to start
     * Must be implemented by subclasses
     * @returns {Object|null} Next match to start
     */
    getNextMatch() {
        throw new Error('getNextMatch() must be implemented by subclass');
    }

    /**
     * Complete a match and handle player advancement/elimination
     * Must be implemented by subclasses
     * @param {string} matchId - Match ID
     * @param {Object} results - Match results
     * @returns {Object} Match completion result
     */
    completeMatch(matchId, results) {
        throw new Error('completeMatch() must be implemented by subclass');
    }

    /**
     * Check if the tournament is complete
     * Must be implemented by subclasses
     * @returns {boolean} Tournament completion status
     */
    isComplete() {
        throw new Error('isComplete() must be implemented by subclass');
    }

    /**
     * Get final tournament standings
     * Must be implemented by subclasses
     * @returns {Array} Final standings
     */
    getFinalStandings() {
        throw new Error('getFinalStandings() must be implemented by subclass');
    }

    // Common utility methods available to all formats

    /**
     * Initialize tournament participants
     * @param {Array} players - Player list
     */
    initializeParticipants(players) {
        this.participants.clear();
        this.playerStats.clear();
        this.eliminatedPlayers.clear();
        this.advancedPlayers.clear();

        players.forEach((player, index) => {
            const participant = {
                ...player,
                seed: index + 1,
                originalSeed: index + 1,
                currentRound: 1,
                isEliminated: false,
                byeRounds: 0,
                wins: 0,
                losses: 0
            };

            this.participants.set(player.playerId, participant);
            this.playerStats.set(player.playerId, {
                matchesPlayed: 0,
                matchesWon: 0,
                matchesLost: 0,
                totalRaceTime: 0,
                averageFinishPosition: 0,
                bestFinishPosition: Infinity,
                worstFinishPosition: 0,
                totalPoints: 0,
                eliminatedIn: null,
                advancementHistory: []
            });
        });

        console.log(`[TournamentFormat] Initialized ${players.length} participants`);
    }

    /**
     * Create a match object
     * @param {Object} matchConfig - Match configuration
     * @returns {Object} Match data
     */
    createMatch(matchConfig) {
        const {
            round,
            players,
            matchType = 'standard',
            bracket = 'main',
            dependency = null
        } = matchConfig;

        const matchId = this.generateMatchId(round, matchType, bracket);
        
        const match = {
            matchId,
            tournamentId: this.tournamentId,
            round,
            matchType,
            bracket,
            dependency,
            players: players.map(player => ({
                playerId: player.playerId,
                playerName: player.playerName,
                seed: player.seed || player.originalSeed,
                isEliminated: false,
                isBye: player.isBye || false
            })),
            status: 'pending',
            startTime: null,
            endTime: null,
            results: null,
            winner: null,
            losers: [],
            roomCode: null,
            spectators: [],
            expectedDuration: this.tournamentConfig.raceTimeLimit,
            actualDuration: null,
            createdAt: Date.now()
        };

        this.matches.set(matchId, match);
        this.pendingMatches.set(matchId, match);
        this.statistics.totalMatches++;

        return match;
    }

    /**
     * Start a match
     * @param {string} matchId - Match ID
     * @returns {Object} Started match
     */
    startMatch(matchId) {
        const match = this.pendingMatches.get(matchId);
        if (!match) {
            throw new Error(`Match not found or not in pending state: ${matchId}`);
        }

        // Handle bye matches automatically
        if (this.isMatchBye(match)) {
            return this.completeBye(match);
        }

        match.status = 'active';
        match.startTime = Date.now();

        this.pendingMatches.delete(matchId);
        this.activeMatches.set(matchId, match);

        console.log(`[TournamentFormat] Match started: ${matchId} in round ${match.round}`);

        multiplayerEvents.emit('TOURNAMENT_MATCH_STARTED', {
            tournamentId: this.tournamentId,
            match,
            round: match.round,
            format: this.tournamentConfig.format
        });

        return match;
    }

    /**
     * Process match results into tournament format
     * @param {Object} match - Match data
     * @param {Object} raceResults - Raw race results
     * @returns {Object} Processed results
     */
    processMatchResults(match, raceResults) {
        // Sort players by race finish position
        const sortedResults = raceResults.players.sort((a, b) => a.finishPosition - b.finishPosition);
        
        // Determine advancement based on format-specific rules
        const advancementCount = this.getAdvancementCount(match);
        const winners = sortedResults.slice(0, advancementCount);
        const losers = sortedResults.slice(advancementCount);
        
        // Update player statistics
        this.updatePlayerStats(match, sortedResults);

        return {
            matchId: match.matchId,
            winners: winners.map(result => ({
                playerId: result.playerId,
                playerName: result.playerName,
                finishPosition: result.finishPosition,
                raceTime: result.raceTime,
                points: this.calculatePoints(result.finishPosition, sortedResults.length),
                eliminated: false
            })),
            losers: losers.map(result => ({
                playerId: result.playerId,
                playerName: result.playerName,
                finishPosition: result.finishPosition,
                raceTime: result.raceTime,
                points: this.calculatePoints(result.finishPosition, sortedResults.length),
                eliminated: this.shouldEliminatePlayer(match, result)
            })),
            raceStats: {
                duration: raceResults.raceDuration || raceResults.duration,
                map: raceResults.map || raceResults.mapName,
                totalPlayers: raceResults.players.length,
                averageTime: this.calculateAverageRaceTime(sortedResults),
                fastestTime: sortedResults[0]?.raceTime || 0
            }
        };
    }

    /**
     * Update player statistics after match completion
     * @param {Object} match - Match data
     * @param {Array} results - Match results
     */
    updatePlayerStats(match, results) {
        results.forEach(result => {
            const stats = this.playerStats.get(result.playerId);
            if (!stats) return;

            stats.matchesPlayed++;
            stats.totalRaceTime += result.raceTime || 0;
            stats.averageFinishPosition = 
                (stats.averageFinishPosition * (stats.matchesPlayed - 1) + result.finishPosition) / stats.matchesPlayed;
            stats.bestFinishPosition = Math.min(stats.bestFinishPosition, result.finishPosition);
            stats.worstFinishPosition = Math.max(stats.worstFinishPosition, result.finishPosition);
            stats.totalPoints += this.calculatePoints(result.finishPosition, results.length);

            // Track advancement
            stats.advancementHistory.push({
                round: match.round,
                finishPosition: result.finishPosition,
                advanced: result.finishPosition <= this.getAdvancementCount(match),
                matchId: match.matchId
            });

            if (result.finishPosition <= this.getAdvancementCount(match)) {
                stats.matchesWon++;
            } else {
                stats.matchesLost++;
            }
        });
    }

    /**
     * Handle bye match completion
     * @param {Object} match - Bye match
     * @returns {Object} Completed bye match
     */
    completeBye(match) {
        const byePlayer = match.players.find(p => !p.isBye);
        if (!byePlayer) {
            throw new Error('Bye match must have exactly one real player');
        }

        match.status = 'completed';
        match.startTime = Date.now();
        match.endTime = Date.now();
        match.winner = byePlayer;
        match.results = {
            matchId: match.matchId,
            winners: [byePlayer],
            losers: [],
            raceStats: {
                duration: 0,
                map: 'bye',
                totalPlayers: 1,
                averageTime: 0,
                fastestTime: 0
            }
        };

        this.pendingMatches.delete(match.matchId);
        this.completedMatches.set(match.matchId, match);
        this.statistics.completedMatches++;
        this.statistics.byeCount++;

        // Update player bye count
        const participant = this.participants.get(byePlayer.playerId);
        if (participant) {
            participant.byeRounds++;
        }

        console.log(`[TournamentFormat] Bye completed: ${match.matchId} for player ${byePlayer.playerName}`);

        return match;
    }

    /**
     * Check if a match is a bye match
     * @param {Object} match - Match data
     * @returns {boolean} True if bye match
     */
    isMatchBye(match) {
        return match.players.length === 1 || 
               match.players.some(p => p.isBye) && match.players.filter(p => !p.isBye).length === 1;
    }

    /**
     * Get advancement count for a match (format-specific)
     * @param {Object} match - Match data
     * @returns {number} Number of players to advance
     */
    getAdvancementCount(match) {
        // Default implementation - can be overridden by formats
        return Math.ceil(match.players.length / 2);
    }

    /**
     * Determine if a player should be eliminated based on format rules
     * @param {Object} match - Match data
     * @param {Object} result - Player result
     * @returns {boolean} True if player should be eliminated
     */
    shouldEliminatePlayer(match, result) {
        // Default implementation - eliminate if not advancing
        return result.finishPosition > this.getAdvancementCount(match);
    }

    /**
     * Calculate points for a finish position
     * @param {number} position - Finish position
     * @param {number} totalPlayers - Total players in race
     * @returns {number} Points earned
     */
    calculatePoints(position, totalPlayers) {
        // Points system: first place gets totalPlayers points, last gets 1
        return Math.max(1, totalPlayers - position + 1);
    }

    /**
     * Calculate average race time from results
     * @param {Array} results - Race results
     * @returns {number} Average race time
     */
    calculateAverageRaceTime(results) {
        const validTimes = results.filter(r => r.raceTime > 0);
        if (validTimes.length === 0) return 0;
        
        return validTimes.reduce((sum, r) => sum + r.raceTime, 0) / validTimes.length;
    }

    /**
     * Seed players for bracket generation
     * @param {Array} players - Players to seed
     * @param {string} seedingMethod - Seeding method ('random', 'ranked', 'balanced')
     * @returns {Array} Seeded players
     */
    seedPlayers(players, seedingMethod = 'random') {
        const playersCopy = [...players];
        
        switch (seedingMethod) {
            case 'random':
                return this.randomizePlayers(playersCopy);
            case 'ranked':
                return this.rankPlayers(playersCopy);
            case 'balanced':
                return this.balanceSeeds(playersCopy);
            default:
                return this.randomizePlayers(playersCopy);
        }
    }

    /**
     * Randomize player order using Mersenne Twister
     * @param {Array} players - Players to randomize
     * @returns {Array} Randomized players
     */
    randomizePlayers(players) {
        for (let i = players.length - 1; i > 0; i--) {
            const j = Math.floor(this.randomizer.random() * (i + 1));
            [players[i], players[j]] = [players[j], players[i]];
        }
        return players;
    }

    /**
     * Rank players by existing statistics (placeholder)
     * @param {Array} players - Players to rank
     * @returns {Array} Ranked players
     */
    rankPlayers(players) {
        // Placeholder for ranking system integration
        // Could integrate with existing leaderboard/stats system
        return players.sort((a, b) => (b.rating || 0) - (a.rating || 0));
    }

    /**
     * Balance seeds to create competitive brackets
     * @param {Array} players - Players to balance
     * @returns {Array} Balanced players
     */
    balanceSeeds(players) {
        // Implement bracket balancing algorithm
        // For now, use alternating seeding pattern
        const sorted = this.rankPlayers([...players]);
        const balanced = [];
        
        for (let i = 0; i < sorted.length; i += 2) {
            balanced.push(sorted[i]);
            if (i + 1 < sorted.length) {
                balanced.push(sorted[sorted.length - 1 - i]);
            }
        }
        
        return balanced;
    }

    /**
     * Generate unique match ID
     * @param {number} round - Round number
     * @param {string} matchType - Match type
     * @param {string} bracket - Bracket name
     * @returns {string} Match ID
     */
    generateMatchId(round, matchType = 'standard', bracket = 'main') {
        return `${this.tournamentId}_${bracket}_r${round}_${matchType}_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`;
    }

    /**
     * Get bracket summary for display
     * @returns {Object} Bracket summary
     */
    getBracketSummary() {
        return {
            tournamentId: this.tournamentId,
            format: this.tournamentConfig.format,
            totalRounds: this.maxRounds,
            currentRound: this.currentRound,
            totalPlayers: this.participants.size,
            remainingPlayers: this.participants.size - this.eliminatedPlayers.size,
            totalMatches: this.statistics.totalMatches,
            completedMatches: this.statistics.completedMatches,
            activeMatches: this.activeMatches.size,
            pendingMatches: this.pendingMatches.size,
            byeCount: this.statistics.byeCount,
            eliminationCount: this.statistics.eliminationCount
        };
    }

    /**
     * Get tournament statistics
     * @returns {Object} Tournament statistics
     */
    getStatistics() {
        return {
            ...this.statistics,
            participantCount: this.participants.size,
            eliminatedCount: this.eliminatedPlayers.size,
            averageMatchDuration: this.statistics.completedMatches > 0 
                ? this.statistics.totalRaceTime / this.statistics.completedMatches 
                : 0,
            completionPercentage: this.statistics.totalMatches > 0 
                ? (this.statistics.completedMatches / this.statistics.totalMatches) * 100 
                : 0
        };
    }

    /**
     * Get player statistics
     * @param {string} playerId - Player ID
     * @returns {Object} Player statistics
     */
    getPlayerStats(playerId) {
        const stats = this.playerStats.get(playerId);
        const participant = this.participants.get(playerId);
        
        if (!stats || !participant) {
            return null;
        }

        return {
            ...stats,
            seed: participant.seed,
            originalSeed: participant.originalSeed,
            currentRound: participant.currentRound,
            isEliminated: participant.isEliminated,
            byeRounds: participant.byeRounds,
            wins: participant.wins,
            losses: participant.losses,
            winRate: stats.matchesPlayed > 0 ? (stats.matchesWon / stats.matchesPlayed) * 100 : 0,
            averageRaceTime: stats.matchesPlayed > 0 ? stats.totalRaceTime / stats.matchesPlayed : 0
        };
    }

    /**
     * Validate tournament can start
     * @returns {Object} Validation result
     */
    validateStart() {
        const errors = [];
        const playerCount = this.participants.size;

        if (playerCount < this.tournamentConfig.minPlayers) {
            errors.push(`Minimum ${this.tournamentConfig.minPlayers} players required`);
        }

        if (playerCount > this.tournamentConfig.maxPlayers) {
            errors.push(`Maximum ${this.tournamentConfig.maxPlayers} players allowed`);
        }

        return {
            isValid: errors.length === 0,
            errors,
            playerCount
        };
    }

    /**
     * Cleanup tournament format
     */
    cleanup() {
        this.participants.clear();
        this.matches.clear();
        this.rounds = [];
        this.activeMatches.clear();
        this.completedMatches.clear();
        this.pendingMatches.clear();
        this.eliminatedPlayers.clear();
        this.advancedPlayers.clear();
        this.playerStats.clear();
        this.formatData = {};
        
        console.log(`[TournamentFormat] Cleaned up ${this.tournamentConfig.format} format`);
    }

    /**
     * Get format-specific configuration
     * @returns {Object} Format configuration
     */
    getFormatConfig() {
        return {
            name: this.tournamentConfig.format,
            displayName: this.getDisplayName(),
            description: this.getDescription(),
            features: this.getFeatures(),
            playerLimits: {
                min: this.tournamentConfig.minPlayers,
                max: this.tournamentConfig.maxPlayers,
                optimal: this.getOptimalPlayerCount()
            },
            estimatedDuration: this.estimateDuration(),
            complexity: this.getComplexity()
        };
    }

    /**
     * Get display name for format (override in subclasses)
     * @returns {string} Display name
     */
    getDisplayName() {
        return 'Unknown Format';
    }

    /**
     * Get format description (override in subclasses)
     * @returns {string} Description
     */
    getDescription() {
        return 'Base tournament format';
    }

    /**
     * Get format features (override in subclasses)
     * @returns {Array} Feature list
     */
    getFeatures() {
        return ['Base functionality'];
    }

    /**
     * Get optimal player count (override in subclasses)
     * @returns {number} Optimal player count
     */
    getOptimalPlayerCount() {
        return 16;
    }

    /**
     * Estimate tournament duration (override in subclasses)
     * @returns {number} Estimated duration in milliseconds
     */
    estimateDuration() {
        return 3600000; // 1 hour default
    }

    /**
     * Get format complexity level (override in subclasses)
     * @returns {string} Complexity level ('simple', 'moderate', 'complex')
     */
    getComplexity() {
        return 'moderate';
    }
}