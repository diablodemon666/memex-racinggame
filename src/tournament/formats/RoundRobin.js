/**
 * RoundRobin.js - Round robin tournament format for Memex Racing
 * 
 * Round robin format where every player plays against every other player.
 * Results in comprehensive head-to-head records and fair final standings.
 */

import { TournamentFormat } from './TournamentFormat.js';
import { multiplayerEvents } from '../../multiplayer/MultiplayerEvents.js';

/**
 * Round robin tournament format
 * Every player plays against every other player
 */
export class RoundRobin extends TournamentFormat {
    constructor(tournamentConfig) {
        super({
            ...tournamentConfig,
            format: 'round_robin'
        });

        // Round robin specific data
        this.schedule = []; // Complete match schedule
        this.playerMatchups = new Map(); // playerId -> Map(opponentId -> matchId)
        this.playerRecords = new Map(); // playerId -> wins/losses/points
        this.standings = []; // Current standings
        this.roundsScheduled = 0;
        this.balancedScheduling = true; // Attempt to balance matches per round
        
        console.log('[RoundRobin] Round robin format initialized');
    }

    /**
     * Initialize the round robin tournament
     * @param {string} tournamentId - Tournament ID
     * @param {Array} players - List of participating players
     * @returns {Object} Tournament initialization data
     */
    async initialize(tournamentId, players) {
        this.tournamentId = tournamentId;
        
        // Validate player count
        const validation = this.validateStart();
        if (!validation.isValid) {
            throw new Error(`Tournament validation failed: ${validation.errors.join(', ')}`);
        }

        // Initialize participants
        this.initializeParticipants(players);
        
        // Initialize player records
        this.initializePlayerRecords();
        
        // Calculate tournament parameters
        this.calculateTournamentParameters();
        
        // Generate complete tournament schedule
        const bracket = this.generateBracket();
        
        console.log(`[RoundRobin] Tournament initialized: ${players.length} players, ${this.statistics.totalMatches} total matches`);
        
        return {
            tournamentId: this.tournamentId,
            format: 'round_robin',
            bracket,
            totalRounds: this.maxRounds,
            totalMatches: this.statistics.totalMatches,
            matchesPerPlayer: this.calculateMatchesPerPlayer(),
            estimatedDuration: this.estimateDuration()
        };
    }

    /**
     * Initialize player records for round robin tracking
     */
    initializePlayerRecords() {
        this.participants.forEach((player, playerId) => {
            this.playerRecords.set(playerId, {
                playerId,
                playerName: player.playerName,
                seed: player.seed,
                matchesPlayed: 0,
                wins: 0,
                losses: 0,
                points: 0,
                averageFinishPosition: 0,
                totalFinishPositions: 0,
                bestFinishPosition: Infinity,
                worstFinishPosition: 0,
                totalRaceTime: 0,
                averageRaceTime: 0,
                headToHeadRecord: new Map(), // opponentId -> {wins, losses, points}
                matchHistory: [] // Array of match results
            });
            
            this.playerMatchups.set(playerId, new Map());
        });
    }

    /**
     * Calculate tournament parameters
     */
    calculateTournamentParameters() {
        const playerCount = this.participants.size;
        
        // In round robin, we need to ensure every player plays every other player
        // With races supporting multiple players, we need to create a balanced schedule
        
        // Calculate total unique pairings needed
        const totalPairings = (playerCount * (playerCount - 1)) / 2;
        
        // Calculate matches needed based on players per race
        const playersPerRace = this.tournamentConfig.playersPerRace;
        
        if (playersPerRace >= playerCount) {
            // Single race with all players
            this.maxRounds = 1;
            this.statistics.totalMatches = 1;
        } else {
            // Multiple races needed - use scheduling algorithm
            this.generateRoundRobinSchedule();
        }
        
        console.log(`[RoundRobin] Tournament parameters: ${playerCount} players, ${this.statistics.totalMatches} matches, ${this.maxRounds} rounds`);
    }

    /**
     * Generate complete round robin schedule
     */
    generateRoundRobinSchedule() {
        const players = Array.from(this.participants.values());
        const playerCount = players.length;
        const playersPerRace = this.tournamentConfig.playersPerRace;
        
        // For round robin, we want to ensure every player plays against every other player
        // We'll use a combination approach: some races with mixed players, tracking head-to-head
        
        if (playersPerRace >= playerCount) {
            // Single match with all players
            this.maxRounds = 1;
            this.schedule = [{
                round: 1,
                matches: [{
                    players: players,
                    matchType: 'round_robin_all'
                }]
            }];
            this.statistics.totalMatches = 1;
            return;
        }
        
        // Use round-robin tournament scheduling algorithm
        // Create balanced schedule where players face each other fairly
        this.schedule = this.createBalancedSchedule(players, playersPerRace);
    }

    /**
     * Create balanced round robin schedule
     * @param {Array} players - Players to schedule
     * @param {number} playersPerRace - Players per race
     * @returns {Array} Complete schedule
     */
    createBalancedSchedule(players, playersPerRace) {
        const playerCount = players.length;
        const schedule = [];
        let currentRound = 1;
        let totalMatches = 0;
        
        // Track how many times each pair has faced each other
        const pairingsCount = new Map();
        
        // Initialize pairings tracking
        for (let i = 0; i < playerCount; i++) {
            for (let j = i + 1; j < playerCount; j++) {
                const pairKey = `${players[i].playerId}_${players[j].playerId}`;
                pairingsCount.set(pairKey, 0);
            }
        }
        
        // Generate rounds until we have sufficient coverage
        const minPairings = Math.ceil((playerCount - 1) / (playersPerRace - 1));
        let maxPairings = 0;
        
        while (maxPairings < minPairings) {
            const roundMatches = this.generateRoundMatches(players, playersPerRace, pairingsCount);
            
            if (roundMatches.length > 0) {
                schedule.push({
                    round: currentRound,
                    matches: roundMatches
                });
                
                totalMatches += roundMatches.length;
                currentRound++;
            }
            
            // Update max pairings count
            maxPairings = Math.max(...Array.from(pairingsCount.values()));
            
            // Safety break to prevent infinite loop
            if (currentRound > playerCount * 2) {
                console.warn('[RoundRobin] Schedule generation safety break activated');
                break;
            }
        }
        
        this.maxRounds = currentRound - 1;
        this.statistics.totalMatches = totalMatches;
        
        console.log(`[RoundRobin] Generated schedule: ${this.maxRounds} rounds, ${totalMatches} matches`);
        return schedule;
    }

    /**
     * Generate matches for a single round
     * @param {Array} players - All players
     * @param {number} playersPerRace - Players per race
     * @param {Map} pairingsCount - Current pairings count
     * @returns {Array} Matches for the round
     */
    generateRoundMatches(players, playersPerRace, pairingsCount) {
        const matches = [];
        const usedPlayers = new Set();
        const playerCount = players.length;
        
        // Try to create matches that minimize repeated pairings
        const availablePlayers = players.filter(p => !usedPlayers.has(p.playerId));
        
        while (availablePlayers.length >= playersPerRace) {
            // Find best combination of players for next match
            const matchPlayers = this.findBestMatchCombination(
                availablePlayers, 
                playersPerRace, 
                pairingsCount
            );
            
            if (matchPlayers.length >= 2) {
                matches.push({
                    players: [...matchPlayers],
                    matchType: 'round_robin'
                });
                
                // Mark players as used and update pairings count
                matchPlayers.forEach(player => {
                    usedPlayers.add(player.playerId);
                    availablePlayers.splice(availablePlayers.findIndex(p => p.playerId === player.playerId), 1);
                });
                
                // Update pairings count
                for (let i = 0; i < matchPlayers.length; i++) {
                    for (let j = i + 1; j < matchPlayers.length; j++) {
                        const pairKey = this.getPairKey(matchPlayers[i].playerId, matchPlayers[j].playerId);
                        pairingsCount.set(pairKey, (pairingsCount.get(pairKey) || 0) + 1);
                    }
                }
            } else {
                break; // Can't form more matches
            }
        }
        
        return matches;
    }

    /**
     * Find best combination of players for a match
     * @param {Array} availablePlayers - Available players
     * @param {number} playersPerRace - Players per race
     * @param {Map} pairingsCount - Current pairings count
     * @returns {Array} Best player combination
     */
    findBestMatchCombination(availablePlayers, playersPerRace, pairingsCount) {
        if (availablePlayers.length < playersPerRace) {
            return availablePlayers; // Return all available if not enough
        }
        
        // Simple greedy approach: take first available players and check for minimal repeat pairings
        const combination = availablePlayers.slice(0, playersPerRace);
        
        // Could implement more sophisticated optimization here
        // For now, use simple approach to avoid complexity
        
        return combination;
    }

    /**
     * Get standardized pair key for tracking
     * @param {string} playerId1 - First player ID
     * @param {string} playerId2 - Second player ID
     * @returns {string} Pair key
     */
    getPairKey(playerId1, playerId2) {
        return playerId1 < playerId2 ? `${playerId1}_${playerId2}` : `${playerId2}_${playerId1}`;
    }

    /**
     * Generate round robin bracket structure
     * @returns {Object} Complete bracket structure
     */
    generateBracket() {
        this.rounds = [];
        this.currentRound = 1;
        
        // Convert schedule to bracket format
        this.schedule.forEach(scheduleRound => {
            const matches = scheduleRound.matches.map(matchData => {
                return this.createMatch({
                    round: scheduleRound.round,
                    players: matchData.players,
                    matchType: matchData.matchType,
                    bracket: 'round_robin'
                });
            });
            
            this.rounds.push({
                round: scheduleRound.round,
                bracket: 'round_robin',
                matches,
                completedMatches: 0,
                totalMatches: matches.length,
                playersInRound: this.getPlayersInRound(scheduleRound.round)
            });
        });
        
        console.log(`[RoundRobin] Generated bracket with ${this.rounds.length} rounds`);
        
        return {
            rounds: this.rounds,
            totalMatches: this.statistics.totalMatches,
            schedule: this.schedule,
            playerRecords: Array.from(this.playerRecords.values())
        };
    }

    /**
     * Get players participating in a specific round
     * @param {number} round - Round number
     * @returns {Array} Players in round
     */
    getPlayersInRound(round) {
        const scheduleRound = this.schedule.find(r => r.round === round);
        if (!scheduleRound) return [];
        
        const playersInRound = new Set();
        scheduleRound.matches.forEach(match => {
            match.players.forEach(player => {
                playersInRound.add(player.playerId);
            });
        });
        
        return Array.from(playersInRound);
    }

    /**
     * Get the next available match to start
     * @returns {Object|null} Next match to start
     */
    getNextMatch() {
        // Find first pending match in any round (round robin allows parallel execution)
        for (const roundData of this.rounds) {
            const nextMatch = roundData.matches.find(match => match.status === 'pending');
            if (nextMatch) {
                return nextMatch;
            }
        }
        
        return null;
    }

    /**
     * Complete a match and handle results
     * @param {string} matchId - Match ID
     * @param {Object} raceResults - Race results from the game engine
     * @returns {Object} Match completion result
     */
    completeMatch(matchId, raceResults) {
        const match = this.activeMatches.get(matchId);
        if (!match) {
            throw new Error(`Match not found or not active: ${matchId}`);
        }

        // Process race results
        const processedResults = this.processMatchResults(match, raceResults);
        
        // Update match data
        match.status = 'completed';
        match.endTime = Date.now();
        match.actualDuration = match.endTime - match.startTime;
        match.results = processedResults;
        match.winner = processedResults.winners[0];
        match.allResults = processedResults.winners.concat(processedResults.losers);
        
        // Move from active to completed
        this.activeMatches.delete(matchId);
        this.completedMatches.set(matchId, match);
        
        // Update round progress
        const roundData = this.rounds.find(r => r.matches.some(m => m.matchId === matchId));
        if (roundData) {
            roundData.completedMatches++;
        }
        
        // Update statistics
        this.statistics.completedMatches++;
        this.statistics.totalRaceTime += match.actualDuration;
        this.statistics.averageMatchDuration = this.statistics.totalRaceTime / this.statistics.completedMatches;
        
        // Update player records
        this.updatePlayerRecords(match);
        
        // Update standings
        this.updateStandings();
        
        console.log(`[RoundRobin] Match completed: ${matchId}, updating records and standings`);
        
        // Emit match completed event
        multiplayerEvents.emit('TOURNAMENT_MATCH_COMPLETED', {
            tournamentId: this.tournamentId,
            match,
            format: 'round_robin',
            standings: this.getCurrentStandings(),
            remainingMatches: this.getRemainingMatchCount()
        });
        
        return {
            match,
            allResults: match.allResults,
            standings: this.getCurrentStandings(),
            tournamentComplete: this.isComplete()
        };
    }

    /**
     * Update player records after match completion
     * @param {Object} match - Completed match
     */
    updatePlayerRecords(match) {
        const allResults = match.allResults;
        
        allResults.forEach(result => {
            const record = this.playerRecords.get(result.playerId);
            if (!record) return;
            
            // Update basic stats
            record.matchesPlayed++;
            record.points += result.points || 0;
            record.totalFinishPositions += result.finishPosition;
            record.averageFinishPosition = record.totalFinishPositions / record.matchesPlayed;
            record.bestFinishPosition = Math.min(record.bestFinishPosition, result.finishPosition);
            record.worstFinishPosition = Math.max(record.worstFinishPosition, result.finishPosition);
            record.totalRaceTime += result.raceTime || 0;
            record.averageRaceTime = record.totalRaceTime / record.matchesPlayed;
            
            // Determine win/loss (top half of finishers are "winners")
            const isWin = result.finishPosition <= Math.ceil(allResults.length / 2);
            if (isWin) {
                record.wins++;
            } else {
                record.losses++;
            }
            
            // Update head-to-head records
            allResults.forEach(opponent => {
                if (opponent.playerId !== result.playerId) {
                    if (!record.headToHeadRecord.has(opponent.playerId)) {
                        record.headToHeadRecord.set(opponent.playerId, {
                            wins: 0,
                            losses: 0,
                            points: 0,
                            matches: 0
                        });
                    }
                    
                    const h2h = record.headToHeadRecord.get(opponent.playerId);
                    h2h.matches++;
                    h2h.points += result.points || 0;
                    
                    if (result.finishPosition < opponent.finishPosition) {
                        h2h.wins++;
                    } else if (result.finishPosition > opponent.finishPosition) {
                        h2h.losses++;
                    }
                    // Ties don't count as wins or losses
                }
            });
            
            // Add to match history
            record.matchHistory.push({
                matchId: match.matchId,
                round: match.round,
                finishPosition: result.finishPosition,
                raceTime: result.raceTime,
                points: result.points,
                opponents: allResults.filter(r => r.playerId !== result.playerId).map(r => ({
                    playerId: r.playerId,
                    playerName: r.playerName,
                    finishPosition: r.finishPosition
                }))
            });
        });
    }

    /**
     * Update tournament standings
     */
    updateStandings() {
        const records = Array.from(this.playerRecords.values());
        
        // Sort by multiple criteria for fair standings
        records.sort((a, b) => {
            // Primary: Total points (higher is better)
            if (a.points !== b.points) {
                return b.points - a.points;
            }
            
            // Secondary: Win rate (higher is better)
            const aWinRate = a.matchesPlayed > 0 ? a.wins / a.matchesPlayed : 0;
            const bWinRate = b.matchesPlayed > 0 ? b.wins / b.matchesPlayed : 0;
            if (aWinRate !== bWinRate) {
                return bWinRate - aWinRate;
            }
            
            // Tertiary: Average finish position (lower is better)
            if (a.averageFinishPosition !== b.averageFinishPosition) {
                return a.averageFinishPosition - b.averageFinishPosition;
            }
            
            // Quaternary: Best finish position (lower is better)
            if (a.bestFinishPosition !== b.bestFinishPosition) {
                return a.bestFinishPosition - b.bestFinishPosition;
            }
            
            // Quinary: Head-to-head if they've played
            const h2h = a.headToHeadRecord.get(b.playerId);
            if (h2h && h2h.matches > 0) {
                if (h2h.wins !== h2h.losses) {
                    return h2h.losses - h2h.wins; // More wins against this opponent = better
                }
            }
            
            // Final: Average race time (lower is better)
            return a.averageRaceTime - b.averageRaceTime;
        });
        
        // Assign positions
        this.standings = records.map((record, index) => ({
            position: index + 1,
            ...record,
            winRate: record.matchesPlayed > 0 ? (record.wins / record.matchesPlayed) * 100 : 0,
            pointsPerMatch: record.matchesPlayed > 0 ? record.points / record.matchesPlayed : 0
        }));
    }

    /**
     * Get current standings
     * @returns {Array} Current tournament standings
     */
    getCurrentStandings() {
        return [...this.standings];
    }

    /**
     * Get remaining match count
     * @returns {number} Number of matches remaining
     */
    getRemainingMatchCount() {
        return this.statistics.totalMatches - this.statistics.completedMatches;
    }

    /**
     * Check if the tournament is complete
     * @returns {boolean} Tournament completion status
     */
    isComplete() {
        return this.statistics.completedMatches >= this.statistics.totalMatches;
    }

    /**
     * Get final tournament standings
     * @returns {Array} Final standings
     */
    getFinalStandings() {
        if (!this.isComplete()) {
            return this.getCurrentStandings();
        }
        
        // Final standings are the same as current standings for round robin
        return this.standings.map(standing => ({
            position: standing.position,
            playerId: standing.playerId,
            playerName: standing.playerName,
            seed: standing.seed,
            eliminated: false, // No one is eliminated in round robin
            matchesPlayed: standing.matchesPlayed,
            wins: standing.wins,
            losses: standing.losses,
            points: standing.points,
            winRate: standing.winRate,
            averageFinishPosition: standing.averageFinishPosition,
            bestFinishPosition: standing.bestFinishPosition,
            averageRaceTime: standing.averageRaceTime,
            pointsPerMatch: standing.pointsPerMatch,
            stats: this.getPlayerStats(standing.playerId)
        }));
    }

    /**
     * Calculate matches per player
     * @returns {number} Average matches per player
     */
    calculateMatchesPerPlayer() {
        const playerCount = this.participants.size;
        const totalPlayerSlots = this.statistics.totalMatches * this.tournamentConfig.playersPerRace;
        return Math.floor(totalPlayerSlots / playerCount);
    }

    /**
     * Get advancement count (not applicable to round robin)
     * @param {Object} match - Match data
     * @returns {number} All players continue
     */
    getAdvancementCount(match) {
        // In round robin, all players continue (no elimination)
        return match.players.length;
    }

    /**
     * Determine if a player should be eliminated (not applicable to round robin)
     * @param {Object} match - Match data
     * @param {Object} result - Player result
     * @returns {boolean} Always false for round robin
     */
    shouldEliminatePlayer(match, result) {
        // No elimination in round robin
        return false;
    }

    /**
     * Get matches for a specific round
     * @param {number} round - Round number
     * @returns {Array} Matches in the round
     */
    getMatchesForRound(round) {
        const roundData = this.rounds.find(r => r.round === round);
        return roundData ? roundData.matches : [];
    }

    /**
     * Get detailed head-to-head record between two players
     * @param {string} playerId1 - First player ID
     * @param {string} playerId2 - Second player ID
     * @returns {Object} Head-to-head record
     */
    getHeadToHeadRecord(playerId1, playerId2) {
        const record1 = this.playerRecords.get(playerId1);
        const record2 = this.playerRecords.get(playerId2);
        
        if (!record1 || !record2) {
            return null;
        }
        
        const h2h1 = record1.headToHeadRecord.get(playerId2);
        const h2h2 = record2.headToHeadRecord.get(playerId1);
        
        if (!h2h1 || !h2h2) {
            return {
                player1: { playerId: playerId1, playerName: record1.playerName, wins: 0, losses: 0, matches: 0 },
                player2: { playerId: playerId2, playerName: record2.playerName, wins: 0, losses: 0, matches: 0 },
                totalMatches: 0
            };
        }
        
        return {
            player1: {
                playerId: playerId1,
                playerName: record1.playerName,
                wins: h2h1.wins,
                losses: h2h1.losses,
                matches: h2h1.matches,
                points: h2h1.points
            },
            player2: {
                playerId: playerId2,
                playerName: record2.playerName,
                wins: h2h2.wins,
                losses: h2h2.losses,
                matches: h2h2.matches,
                points: h2h2.points
            },
            totalMatches: h2h1.matches
        };
    }

    /**
     * Get player's match history
     * @param {string} playerId - Player ID
     * @returns {Array} Match history
     */
    getPlayerMatchHistory(playerId) {
        const record = this.playerRecords.get(playerId);
        return record ? record.matchHistory : [];
    }

    /**
     * Get format-specific display information
     */
    getDisplayName() {
        return 'Round Robin';
    }

    getDescription() {
        return 'Comprehensive format where every player competes against every other player. Results in detailed head-to-head records and fair final standings based on overall performance.';
    }

    getFeatures() {
        return [
            'Every player plays every other player',
            'No elimination - all players compete in full tournament',
            'Comprehensive head-to-head records',
            'Fair standings based on multiple criteria',
            'Detailed performance statistics',
            'Points-based ranking system'
        ];
    }

    getOptimalPlayerCount() {
        // Round robin works well with moderate player counts
        // Too many players = too many matches
        if (this.tournamentConfig.maxPlayers <= 16) {
            return 12;
        } else if (this.tournamentConfig.maxPlayers <= 32) {
            return 16;
        } else {
            return 20;
        }
    }

    estimateDuration() {
        const playerCount = this.participants.size;
        const matchesPerPlayer = this.calculateMatchesPerPlayer();
        const totalMatches = this.statistics.totalMatches;
        const matchDuration = this.tournamentConfig.raceTimeLimit + 60; // Race time + setup
        
        // Round robin can run matches in parallel, so estimate based on rounds
        const parallelMatches = Math.floor(playerCount / this.tournamentConfig.playersPerRace);
        const sequentialRounds = Math.ceil(totalMatches / parallelMatches);
        
        return sequentialRounds * matchDuration * 1000;
    }

    getComplexity() {
        const playerCount = this.participants.size;
        
        if (playerCount <= 8) {
            return 'simple';
        } else if (playerCount <= 16) {
            return 'moderate';
        } else {
            return 'complex';
        }
    }

    /**
     * Validate tournament can start (override for round robin specific limits)
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

        // Round robin specific validation
        if (playerCount > 32) {
            errors.push('Round robin format recommended for 32 or fewer players due to match count');
        }

        const estimatedMatches = this.estimateMatchCount(playerCount);
        if (estimatedMatches > 200) {
            errors.push(`Too many matches required (${estimatedMatches}). Consider fewer players or different format.`);
        }

        return {
            isValid: errors.length === 0,
            errors,
            playerCount,
            estimatedMatches
        };
    }

    /**
     * Estimate total match count for player count
     * @param {number} playerCount - Number of players
     * @returns {number} Estimated match count
     */
    estimateMatchCount(playerCount) {
        const playersPerRace = this.tournamentConfig.playersPerRace;
        
        if (playersPerRace >= playerCount) {
            return 1; // Single race with all players
        }
        
        // Rough estimate: each player should play roughly (playerCount-1) matches
        // But in races with multiple players, they face multiple opponents per race
        const matchesPerPlayer = Math.ceil((playerCount - 1) / (playersPerRace - 1));
        return Math.ceil((playerCount * matchesPerPlayer) / playersPerRace);
    }
}