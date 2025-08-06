/**
 * SingleElimination.js - Single elimination tournament format for Memex Racing
 * 
 * Classic single elimination bracket where players are eliminated after one loss.
 * Features bye rounds for non-power-of-2 player counts and supports multiple players per race.
 */

import { TournamentFormat } from './TournamentFormat.js';
import { multiplayerEvents } from '../../multiplayer/MultiplayerEvents.js';

/**
 * Single elimination tournament format
 * Players are eliminated after losing one match
 */
export class SingleElimination extends TournamentFormat {
    constructor(tournamentConfig) {
        super({
            ...tournamentConfig,
            format: 'single_elimination'
        });

        // Single elimination specific data
        this.bracketSize = 0; // Next power of 2 from player count
        this.byePlayers = []; // Players who get byes in first round
        this.roundSchedule = []; // Planned rounds and match counts
        
        console.log('[SingleElimination] Single elimination format initialized');
    }

    /**
     * Initialize the single elimination tournament
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
        
        // Calculate bracket parameters
        this.calculateBracketParameters();
        
        // Generate bracket structure
        const bracket = this.generateBracket();
        
        console.log(`[SingleElimination] Tournament initialized: ${players.length} players, ${this.maxRounds} rounds`);
        
        return {
            tournamentId: this.tournamentId,
            format: 'single_elimination',
            bracket,
            totalRounds: this.maxRounds,
            bracketSize: this.bracketSize,
            byeCount: this.byePlayers.length,
            firstRoundMatches: this.getMatchesForRound(1)
        };
    }

    /**
     * Calculate bracket parameters
     */
    calculateBracketParameters() {
        const playerCount = this.participants.size;
        
        // Calculate bracket size (next power of 2)
        this.bracketSize = Math.pow(2, Math.ceil(Math.log2(playerCount)));
        this.maxRounds = Math.log2(this.bracketSize);
        
        // Calculate bye count and identify bye players
        const byeCount = this.bracketSize - playerCount;
        this.byePlayers = [];
        
        if (byeCount > 0) {
            // Give byes to top seeded players
            const seededPlayers = this.seedPlayers([...this.participants.values()]);
            this.byePlayers = seededPlayers.slice(0, byeCount);
        }
        
        console.log(`[SingleElimination] Bracket parameters: size=${this.bracketSize}, rounds=${this.maxRounds}, byes=${byeCount}`);
    }

    /**
     * Generate single elimination bracket structure
     * @returns {Object} Complete bracket structure
     */
    generateBracket() {
        this.rounds = [];
        this.currentRound = 1;
        
        // Generate all rounds structure
        for (let round = 1; round <= this.maxRounds; round++) {
            this.rounds.push({
                round,
                matches: [],
                completedMatches: 0,
                totalMatches: 0,
                playersAtStart: this.calculatePlayersInRound(round),
                playersAdvancing: this.calculatePlayersAdvancing(round)
            });
        }
        
        // Generate first round matches
        this.generateFirstRoundMatches();
        
        // Pre-calculate subsequent rounds (structure only)
        this.calculateSubsequentRounds();
        
        return {
            rounds: this.rounds,
            bracketSize: this.bracketSize,
            totalMatches: this.statistics.totalMatches,
            byePlayers: this.byePlayers.map(p => ({
                playerId: p.playerId,
                playerName: p.playerName,
                seed: p.seed
            }))
        };
    }

    /**
     * Generate first round matches
     */
    generateFirstRoundMatches() {
        const seededPlayers = this.seedPlayers([...this.participants.values()]);
        const firstRoundPlayers = seededPlayers.filter(p => 
            !this.byePlayers.some(bye => bye.playerId === p.playerId)
        );
        
        const firstRound = this.rounds[0];
        const matches = [];
        
        // Create matches with configured players per race
        for (let i = 0; i < firstRoundPlayers.length; i += this.tournamentConfig.playersPerRace) {
            const matchPlayers = firstRoundPlayers.slice(i, i + this.tournamentConfig.playersPerRace);
            
            // If last match has fewer players, it's still valid (minimum 2 players checked elsewhere)
            if (matchPlayers.length >= 2) {
                const match = this.createMatch({
                    round: 1,
                    players: matchPlayers,
                    matchType: 'elimination',
                    bracket: 'main'
                });
                
                matches.push(match);
            }
        }
        
        firstRound.matches = matches;
        firstRound.totalMatches = matches.length;
        
        // Handle bye players - advance them automatically to round 2
        if (this.byePlayers.length > 0) {
            this.advanceByePlayers();
        }
        
        console.log(`[SingleElimination] Generated ${matches.length} first round matches with ${firstRoundPlayers.length} players`);
    }

    /**
     * Advance bye players to the next round
     */
    advanceByePlayers() {
        if (!this.advancedPlayers.has(2)) {
            this.advancedPlayers.set(2, []);
        }
        
        this.byePlayers.forEach(player => {
            this.advancedPlayers.get(2).push({
                playerId: player.playerId,
                playerName: player.playerName,
                seed: player.seed,
                advancedVia: 'bye'
            });
            
            // Update participant data
            const participant = this.participants.get(player.playerId);
            if (participant) {
                participant.currentRound = 2;
                participant.byeRounds++;
            }
        });
        
        console.log(`[SingleElimination] Advanced ${this.byePlayers.length} bye players to round 2`);
    }

    /**
     * Calculate subsequent round structures
     */
    calculateSubsequentRounds() {
        for (let round = 2; round <= this.maxRounds; round++) {
            const roundData = this.rounds[round - 1];
            const expectedPlayers = this.calculatePlayersInRound(round);
            const expectedMatches = Math.ceil(expectedPlayers / this.tournamentConfig.playersPerRace);
            
            roundData.totalMatches = expectedMatches;
        }
    }

    /**
     * Calculate players in a specific round
     * @param {number} round - Round number
     * @returns {number} Number of players in round
     */
    calculatePlayersInRound(round) {
        return Math.pow(2, this.maxRounds - round + 1);
    }

    /**
     * Calculate players advancing from a round
     * @param {number} round - Round number
     * @returns {number} Number of players advancing
     */
    calculatePlayersAdvancing(round) {
        if (round >= this.maxRounds) return 1; // Final round has 1 winner
        return Math.pow(2, this.maxRounds - round);
    }

    /**
     * Get the next available match to start
     * @returns {Object|null} Next match to start
     */
    getNextMatch() {
        // Find the first pending match in the current round
        const currentRoundData = this.rounds[this.currentRound - 1];
        if (!currentRoundData) {
            return null;
        }
        
        const nextMatch = currentRoundData.matches.find(match => match.status === 'pending');
        return nextMatch || null;
    }

    /**
     * Complete a match and handle player advancement/elimination
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
        match.winner = processedResults.winners[0]; // First winner
        match.losers = processedResults.losers;
        
        // Move from active to completed
        this.activeMatches.delete(matchId);
        this.completedMatches.set(matchId, match);
        
        // Update round progress
        const roundData = this.rounds[match.round - 1];
        roundData.completedMatches++;
        
        // Update statistics
        this.statistics.completedMatches++;
        this.statistics.totalRaceTime += match.actualDuration;
        this.statistics.averageMatchDuration = this.statistics.totalRaceTime / this.statistics.completedMatches;
        
        // Handle player advancement and elimination
        this.handlePlayerAdvancement(match);
        
        console.log(`[SingleElimination] Match completed: ${matchId}, winner: ${match.winner.playerName}`);
        
        // Emit match completed event
        multiplayerEvents.emit('TOURNAMENT_MATCH_COMPLETED', {
            tournamentId: this.tournamentId,
            match,
            format: 'single_elimination',
            advancedPlayers: processedResults.winners,
            eliminatedPlayers: processedResults.losers.filter(l => l.eliminated)
        });

        // Check if round is complete
        if (roundData.completedMatches >= roundData.totalMatches) {
            this.completeRound(match.round);
        }
        
        return {
            match,
            winners: processedResults.winners,
            eliminated: processedResults.losers.filter(l => l.eliminated),
            roundComplete: roundData.completedMatches >= roundData.totalMatches,
            tournamentComplete: this.isComplete()
        };
    }

    /**
     * Handle player advancement and elimination after match completion
     * @param {Object} match - Completed match
     */
    handlePlayerAdvancement(match) {
        const results = match.results;
        
        // Handle eliminated players
        results.losers.forEach(loser => {
            if (loser.eliminated) {
                this.eliminatedPlayers.add(loser.playerId);
                this.statistics.eliminationCount++;
                
                // Update participant data
                const participant = this.participants.get(loser.playerId);
                if (participant) {
                    participant.isEliminated = true;
                    participant.losses++;
                }
                
                // Update player stats
                const stats = this.playerStats.get(loser.playerId);
                if (stats) {
                    stats.eliminatedIn = match.round;
                }
                
                console.log(`[SingleElimination] Player eliminated: ${loser.playerName} in round ${match.round}`);
            }
        });
        
        // Handle advancing players
        if (match.round < this.maxRounds) {
            const nextRound = match.round + 1;
            
            if (!this.advancedPlayers.has(nextRound)) {
                this.advancedPlayers.set(nextRound, []);
            }
            
            results.winners.forEach(winner => {
                this.advancedPlayers.get(nextRound).push({
                    playerId: winner.playerId,
                    playerName: winner.playerName,
                    seed: this.participants.get(winner.playerId)?.seed,
                    advancedVia: 'race_win',
                    fromMatch: match.matchId
                });
                
                // Update participant data
                const participant = this.participants.get(winner.playerId);
                if (participant) {
                    participant.currentRound = nextRound;
                    participant.wins++;
                }
            });
        }
    }

    /**
     * Complete a tournament round
     * @param {number} round - Completed round number
     */
    completeRound(round) {
        console.log(`[SingleElimination] Round ${round} completed`);
        
        // Emit round completed event
        multiplayerEvents.emit('TOURNAMENT_ROUND_COMPLETED', {
            tournamentId: this.tournamentId,
            round,
            format: 'single_elimination',
            advancedPlayers: this.advancedPlayers.get(round + 1) || [],
            eliminatedCount: this.eliminatedPlayers.size,
            totalRounds: this.maxRounds
        });

        // Check if tournament is complete
        if (this.isComplete()) {
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
            console.warn(`[SingleElimination] No players advanced to round ${round}`);
            return;
        }

        const roundData = this.rounds[round - 1];
        const matches = [];
        
        // Create matches from advanced players
        for (let i = 0; i < advancedPlayers.length; i += this.tournamentConfig.playersPerRace) {
            const matchPlayers = advancedPlayers.slice(i, i + this.tournamentConfig.playersPerRace);
            
            // Ensure minimum 2 players per match
            if (matchPlayers.length >= 2) {
                const match = this.createMatch({
                    round,
                    players: matchPlayers,
                    matchType: 'elimination',
                    bracket: 'main'
                });
                
                matches.push(match);
            } else if (matchPlayers.length === 1) {
                // Single player gets a bye to next round
                const player = matchPlayers[0];
                if (round < this.maxRounds) {
                    this.advancePlayerBye(player, round + 1);
                }
            }
        }
        
        roundData.matches = matches;
        roundData.totalMatches = matches.length;
        
        console.log(`[SingleElimination] Generated ${matches.length} matches for round ${round}`);
    }

    /**
     * Advance a single player via bye
     * @param {Object} player - Player to advance
     * @param {number} toRound - Round to advance to
     */
    advancePlayerBye(player, toRound) {
        if (!this.advancedPlayers.has(toRound)) {
            this.advancedPlayers.set(toRound, []);
        }
        
        this.advancedPlayers.get(toRound).push({
            ...player,
            advancedVia: 'bye'
        });
        
        // Update participant data
        const participant = this.participants.get(player.playerId);
        if (participant) {
            participant.currentRound = toRound;
            participant.byeRounds++;
        }
        
        this.statistics.byeCount++;
        console.log(`[SingleElimination] Player ${player.playerName} advanced via bye to round ${toRound}`);
    }

    /**
     * Check if the tournament is complete
     * @returns {boolean} Tournament completion status
     */
    isComplete() {
        // Tournament is complete when we have a winner (final round completed)
        const finalRound = this.rounds[this.maxRounds - 1];
        return finalRound && finalRound.completedMatches >= finalRound.totalMatches;
    }

    /**
     * Get final tournament standings
     * @returns {Array} Final standings ordered by elimination round and performance
     */
    getFinalStandings() {
        const standings = [];
        
        // Find tournament winner
        const finalRound = this.rounds[this.maxRounds - 1];
        const finalMatch = finalRound?.matches[0];
        
        if (finalMatch && finalMatch.winner) {
            standings.push({
                position: 1,
                playerId: finalMatch.winner.playerId,
                playerName: finalMatch.winner.playerName,
                seed: this.participants.get(finalMatch.winner.playerId)?.originalSeed,
                eliminated: false,
                eliminatedIn: null,
                wins: this.participants.get(finalMatch.winner.playerId)?.wins || 0,
                losses: this.participants.get(finalMatch.winner.playerId)?.losses || 0,
                stats: this.getPlayerStats(finalMatch.winner.playerId)
            });
        }
        
        // Add other players based on elimination round (later eliminations = better placement)
        let position = 2;
        
        for (let round = this.maxRounds; round >= 1; round--) {
            const roundMatches = this.rounds[round - 1]?.matches || [];
            
            // Group eliminated players by round
            const eliminatedInRound = [];
            
            roundMatches.forEach(match => {
                if (match.results?.losers) {
                    match.results.losers.forEach(loser => {
                        if (loser.eliminated) {
                            eliminatedInRound.push({
                                playerId: loser.playerId,
                                playerName: loser.playerName,
                                finishPosition: loser.finishPosition,
                                raceTime: loser.raceTime,
                                points: loser.points
                            });
                        }
                    });
                }
            });
            
            // Sort eliminated players by performance in their elimination round
            eliminatedInRound.sort((a, b) => {
                // Better finish position = better standing
                if (a.finishPosition !== b.finishPosition) {
                    return a.finishPosition - b.finishPosition;
                }
                // Faster race time as tiebreaker
                return (a.raceTime || Infinity) - (b.raceTime || Infinity);
            });
            
            // Add to standings
            eliminatedInRound.forEach(player => {
                const participant = this.participants.get(player.playerId);
                standings.push({
                    position: position++,
                    playerId: player.playerId,
                    playerName: player.playerName,
                    seed: participant?.originalSeed,
                    eliminated: true,
                    eliminatedIn: round,
                    wins: participant?.wins || 0,
                    losses: participant?.losses || 0,
                    finalFinishPosition: player.finishPosition,
                    finalRaceTime: player.raceTime,
                    stats: this.getPlayerStats(player.playerId)
                });
            });
        }
        
        return standings;
    }

    /**
     * Get advancement count for a match
     * @param {Object} match - Match data
     * @returns {number} Number of players to advance
     */
    getAdvancementCount(match) {
        // In single elimination, advance roughly half the players
        // For races with 6 players, advance top 3
        // For races with fewer players, advance roughly half
        return Math.ceil(match.players.filter(p => !p.isBye).length / 2);
    }

    /**
     * Determine if a player should be eliminated
     * @param {Object} match - Match data
     * @param {Object} result - Player result
     * @returns {boolean} True if player should be eliminated
     */
    shouldEliminatePlayer(match, result) {
        // In single elimination, eliminate if not advancing
        return result.finishPosition > this.getAdvancementCount(match);
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
     * Get format-specific display information
     */
    getDisplayName() {
        return 'Single Elimination';
    }

    getDescription() {
        return 'Classic tournament format where players are eliminated after one loss. Fast-paced with clear progression to determine a single winner.';
    }

    getFeatures() {
        return [
            'Single elimination - one loss and you\'re out',
            'Bye rounds for non-power-of-2 player counts',
            'Multiple players per race support',
            'Fast tournament completion',
            'Clear bracket progression'
        ];
    }

    getOptimalPlayerCount() {
        // Power of 2 numbers work best (no byes needed)
        const powerOf2Options = [8, 16, 32, 64];
        return powerOf2Options.find(n => n >= this.tournamentConfig.minPlayers) || 16;
    }

    estimateDuration() {
        const playerCount = this.participants.size;
        const rounds = Math.ceil(Math.log2(playerCount));
        const avgMatchesPerRound = Math.ceil(playerCount / this.tournamentConfig.playersPerRace / rounds);
        const matchDuration = this.tournamentConfig.raceTimeLimit + 60; // Race time + setup
        
        return rounds * avgMatchesPerRound * matchDuration * 1000;
    }

    getComplexity() {
        return 'simple';
    }
}