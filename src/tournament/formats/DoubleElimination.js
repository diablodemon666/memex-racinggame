/**
 * DoubleElimination.js - Double elimination tournament format for Memex Racing
 * 
 * Full double elimination with winners bracket and losers bracket.
 * Players must lose twice to be eliminated, ensuring more games and fairer results.
 */

import { TournamentFormat } from './TournamentFormat.js';
import { multiplayerEvents } from '../../multiplayer/MultiplayerEvents.js';

/**
 * Double elimination tournament format
 * Players are eliminated after losing two matches (one in winners, one in losers bracket)
 */
export class DoubleElimination extends TournamentFormat {
    constructor(tournamentConfig) {
        super({
            ...tournamentConfig,
            format: 'double_elimination'
        });

        // Double elimination specific data
        this.winnersBracket = [];
        this.losersBracket = [];
        this.bracketSize = 0;
        this.winnersRounds = 0;
        this.losersRounds = 0;
        this.grandFinals = null;
        this.grandFinalsReset = null; // If winner from losers bracket wins first grand final
        
        // Player bracket tracking
        this.playersInWinners = new Set();
        this.playersInLosers = new Set();
        this.playersWithOneLoss = new Map(); // playerId -> loss round info
        
        console.log('[DoubleElimination] Double elimination format initialized');
    }

    /**
     * Initialize the double elimination tournament
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
        
        console.log(`[DoubleElimination] Tournament initialized: ${players.length} players, W:${this.winnersRounds} L:${this.losersRounds} rounds`);
        
        return {
            tournamentId: this.tournamentId,
            format: 'double_elimination',
            bracket,
            winnersRounds: this.winnersRounds,
            losersRounds: this.losersRounds,
            totalRounds: this.winnersRounds + this.losersRounds + 1, // +1 for grand finals
            bracketSize: this.bracketSize,
            firstRoundMatches: this.getMatchesForRound(1, 'winners')
        };
    }

    /**
     * Calculate bracket parameters for double elimination
     */
    calculateBracketParameters() {
        const playerCount = this.participants.size;
        
        // Calculate bracket size (next power of 2)
        this.bracketSize = Math.pow(2, Math.ceil(Math.log2(playerCount)));
        
        // Winners bracket rounds (same as single elimination)
        this.winnersRounds = Math.log2(this.bracketSize);
        
        // Losers bracket rounds (approximately 2n-2 where n is winners rounds)
        this.losersRounds = (this.winnersRounds * 2) - 1;
        
        // Max rounds includes grand finals
        this.maxRounds = this.winnersRounds + this.losersRounds + 1;
        
        // Initialize player tracking
        this.participants.forEach((player, playerId) => {
            this.playersInWinners.add(playerId);
        });
        
        console.log(`[DoubleElimination] Bracket parameters: size=${this.bracketSize}, W=${this.winnersRounds}, L=${this.losersRounds}`);
    }

    /**
     * Generate double elimination bracket structure
     * @returns {Object} Complete bracket structure
     */
    generateBracket() {
        // Initialize bracket structures
        this.winnersBracket = [];
        this.losersBracket = [];
        this.rounds = [];
        this.currentRound = 1;
        
        // Generate winners bracket structure
        for (let round = 1; round <= this.winnersRounds; round++) {
            this.winnersBracket.push({
                round,
                bracket: 'winners',
                matches: [],
                completedMatches: 0,
                totalMatches: 0,
                playersAtStart: this.calculateWinnersPlayersInRound(round),
                playersAdvancing: this.calculateWinnersAdvancing(round)
            });
        }
        
        // Generate losers bracket structure
        for (let round = 1; round <= this.losersRounds; round++) {
            this.losersBracket.push({
                round,
                bracket: 'losers',
                matches: [],
                completedMatches: 0,
                totalMatches: 0,
                playersAtStart: this.calculateLosersPlayersInRound(round),
                playersAdvancing: this.calculateLosersAdvancing(round),
                feedFromWinners: this.shouldFeedFromWinners(round) // Indicates if this round receives players from winners bracket
            });
        }
        
        // Combine into unified rounds array for easier tracking
        this.rounds = [...this.winnersBracket, ...this.losersBracket];
        
        // Add grand finals placeholder
        this.grandFinals = {
            round: this.maxRounds,
            bracket: 'grand_finals',
            matches: [],
            completedMatches: 0,
            totalMatches: 1,
            playersAtStart: 2,
            playersAdvancing: 1
        };
        this.rounds.push(this.grandFinals);
        
        // Generate first round matches
        this.generateFirstRoundMatches();
        
        // Pre-calculate bracket structures
        this.calculateSubsequentRounds();
        
        return {
            winnersBracket: this.winnersBracket,
            losersBracket: this.losersBracket,
            grandFinals: this.grandFinals,
            bracketSize: this.bracketSize,
            totalMatches: this.statistics.totalMatches
        };
    }

    /**
     * Generate first round matches (winners bracket)
     */
    generateFirstRoundMatches() {
        const seededPlayers = this.seedPlayers([...this.participants.values()]);
        const firstRound = this.winnersBracket[0];
        const matches = [];
        
        // Create first round winners bracket matches
        for (let i = 0; i < seededPlayers.length; i += this.tournamentConfig.playersPerRace) {
            const matchPlayers = seededPlayers.slice(i, i + this.tournamentConfig.playersPerRace);
            
            if (matchPlayers.length >= 2) {
                const match = this.createMatch({
                    round: 1,
                    players: matchPlayers,
                    matchType: 'winners',
                    bracket: 'winners'
                });
                
                matches.push(match);
            } else if (matchPlayers.length === 1) {
                // Single player gets bye to next winners round
                this.advancePlayerBye(matchPlayers[0], 2, 'winners');
            }
        }
        
        firstRound.matches = matches;
        firstRound.totalMatches = matches.length;
        
        console.log(`[DoubleElimination] Generated ${matches.length} first round winners bracket matches`);
    }

    /**
     * Calculate subsequent round structures
     */
    calculateSubsequentRounds() {
        // Calculate winners bracket rounds
        for (let round = 2; round <= this.winnersRounds; round++) {
            const roundData = this.winnersBracket[round - 1];
            const expectedPlayers = this.calculateWinnersPlayersInRound(round);
            const expectedMatches = Math.ceil(expectedPlayers / this.tournamentConfig.playersPerRace);
            roundData.totalMatches = expectedMatches;
        }
        
        // Calculate losers bracket rounds
        for (let round = 1; round <= this.losersRounds; round++) {
            const roundData = this.losersBracket[round - 1];
            const expectedPlayers = this.calculateLosersPlayersInRound(round);
            const expectedMatches = Math.ceil(expectedPlayers / this.tournamentConfig.playersPerRace);
            roundData.totalMatches = expectedMatches;
        }
    }

    /**
     * Calculate players in winners bracket round
     * @param {number} round - Round number
     * @returns {number} Number of players in round
     */
    calculateWinnersPlayersInRound(round) {
        return Math.pow(2, this.winnersRounds - round + 1);
    }

    /**
     * Calculate players advancing from winners bracket round
     * @param {number} round - Round number
     * @returns {number} Number of players advancing
     */
    calculateWinnersAdvancing(round) {
        if (round >= this.winnersRounds) return 1; // Winners final produces 1 grand finalist
        return Math.pow(2, this.winnersRounds - round);
    }

    /**
     * Calculate players in losers bracket round
     * @param {number} round - Round number
     * @returns {number} Number of players in round
     */
    calculateLosersPlayersInRound(round) {
        // Losers bracket is more complex due to feeding from winners bracket
        // Approximate calculation - actual numbers depend on match results
        if (round === 1) {
            // First losers round gets eliminations from winners round 1
            return Math.floor(this.participants.size / 2);
        }
        
        // Subsequent rounds alternate between feeding and elimination
        const isFeederRound = this.shouldFeedFromWinners(round);
        if (isFeederRound) {
            // Rounds that receive players from winners bracket
            return Math.pow(2, Math.floor((this.losersRounds - round) / 2) + 1);
        } else {
            // Pure losers bracket elimination rounds
            return Math.pow(2, Math.floor((this.losersRounds - round + 1) / 2));
        }
    }

    /**
     * Calculate players advancing from losers bracket round
     * @param {number} round - Round number
     * @returns {number} Number of players advancing
     */
    calculateLosersAdvancing(round) {
        if (round >= this.losersRounds) return 1; // Losers final produces 1 grand finalist
        return Math.ceil(this.calculateLosersPlayersInRound(round) / 2);
    }

    /**
     * Check if losers bracket round should receive players from winners bracket
     * @param {number} round - Losers bracket round number
     * @returns {boolean} True if should feed from winners
     */
    shouldFeedFromWinners(round) {
        // Even-numbered losers rounds typically receive players from winners bracket
        return round % 2 === 0;
    }

    /**
     * Get the next available match to start
     * @returns {Object|null} Next match to start
     */
    getNextMatch() {
        // Priority: Winners bracket, then losers bracket, then grand finals
        
        // Check current winners bracket round
        if (this.currentRound <= this.winnersRounds) {
            const winnersRound = this.winnersBracket[this.currentRound - 1];
            const nextWinnersMatch = winnersRound.matches.find(m => m.status === 'pending');
            if (nextWinnersMatch) {
                return nextWinnersMatch;
            }
        }
        
        // Check losers bracket rounds that are ready
        for (let round = 1; round <= this.losersRounds; round++) {
            const losersRound = this.losersBracket[round - 1];
            const nextLosersMatch = losersRound.matches.find(m => m.status === 'pending');
            if (nextLosersMatch) {
                return nextLosersMatch;
            }
        }
        
        // Check grand finals
        if (this.grandFinals) {
            const nextGrandFinalsMatch = this.grandFinals.matches.find(m => m.status === 'pending');
            if (nextGrandFinalsMatch) {
                return nextGrandFinalsMatch;
            }
        }
        
        return null;
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
        match.winner = processedResults.winners[0];
        match.losers = processedResults.losers;
        
        // Move from active to completed
        this.activeMatches.delete(matchId);
        this.completedMatches.set(matchId, match);
        
        // Update statistics
        this.statistics.completedMatches++;
        this.statistics.totalRaceTime += match.actualDuration;
        this.statistics.averageMatchDuration = this.statistics.totalRaceTime / this.statistics.completedMatches;
        
        // Handle bracket-specific advancement
        const result = this.handleBracketSpecificAdvancement(match);
        
        console.log(`[DoubleElimination] Match completed: ${matchId} in ${match.bracket} bracket`);
        
        // Emit match completed event
        multiplayerEvents.emit('TOURNAMENT_MATCH_COMPLETED', {
            tournamentId: this.tournamentId,
            match,
            format: 'double_elimination',
            bracket: match.bracket,
            advancedPlayers: processedResults.winners,
            eliminatedPlayers: processedResults.losers.filter(l => l.eliminated)
        });
        
        return {
            match,
            winners: processedResults.winners,
            eliminated: processedResults.losers.filter(l => l.eliminated),
            droppedToLosers: processedResults.losers.filter(l => !l.eliminated),
            tournamentComplete: this.isComplete(),
            ...result
        };
    }

    /**
     * Handle bracket-specific player advancement
     * @param {Object} match - Completed match
     * @returns {Object} Advancement result
     */
    handleBracketSpecificAdvancement(match) {
        const results = match.results;
        
        if (match.bracket === 'winners') {
            return this.handleWinnersBracketMatch(match, results);
        } else if (match.bracket === 'losers') {
            return this.handleLosersBracketMatch(match, results);
        } else if (match.bracket === 'grand_finals') {
            return this.handleGrandFinalsMatch(match, results);
        }
        
        return {};
    }

    /**
     * Handle winners bracket match completion
     * @param {Object} match - Completed match
     * @param {Object} results - Match results
     * @returns {Object} Result
     */
    handleWinnersBracketMatch(match, results) {
        const round = match.round;
        const winnersRound = this.winnersBracket[round - 1];
        winnersRound.completedMatches++;
        
        // Advance winners to next winners round or grand finals
        results.winners.forEach(winner => {
            if (round < this.winnersRounds) {
                this.advanceToWinners(winner, round + 1);
            } else {
                // Winners bracket champion goes to grand finals
                this.advanceToGrandFinals(winner, 'winners_champion');
            }
        });
        
        // Drop losers to losers bracket
        results.losers.forEach(loser => {
            this.dropToLosersBracket(loser, round);
        });
        
        // Check if winners round is complete
        const roundComplete = winnersRound.completedMatches >= winnersRound.totalMatches;
        if (roundComplete) {
            this.completeWinnersRound(round);
        }
        
        return { roundComplete, bracket: 'winners' };
    }

    /**
     * Handle losers bracket match completion
     * @param {Object} match - Completed match
     * @param {Object} results - Match results
     * @returns {Object} Result
     */
    handleLosersBracketMatch(match, results) {
        const round = match.round;
        const losersRound = this.losersBracket[round - 1];
        losersRound.completedMatches++;
        
        // Advance winners to next losers round or grand finals
        results.winners.forEach(winner => {
            if (round < this.losersRounds) {
                this.advanceToLosers(winner, round + 1);
            } else {
                // Losers bracket champion goes to grand finals
                this.advanceToGrandFinals(winner, 'losers_champion');
            }
        });
        
        // Eliminate losers completely
        results.losers.forEach(loser => {
            this.eliminatePlayer(loser, `losers_round_${round}`);
        });
        
        // Check if losers round is complete
        const roundComplete = losersRound.completedMatches >= losersRound.totalMatches;
        if (roundComplete) {
            this.completeLosersRound(round);
        }
        
        return { roundComplete, bracket: 'losers' };
    }

    /**
     * Handle grand finals match completion
     * @param {Object} match - Completed match
     * @param {Object} results - Match results
     * @returns {Object} Result
     */
    handleGrandFinalsMatch(match, results) {
        const winner = results.winners[0];
        const loser = results.losers[0];
        
        // Determine if tournament is complete or needs reset
        const winnersChampion = match.players.find(p => 
            this.getPlayerBracketStatus(p.playerId) === 'winners_champion'
        );
        const losersChampion = match.players.find(p => 
            this.getPlayerBracketStatus(p.playerId) === 'losers_champion'
        );
        
        if (winner.playerId === winnersChampion?.playerId) {
            // Winners bracket champion won - tournament complete
            this.completeDoubleEliminationTournament(winner);
            return { tournamentComplete: true, champion: winner };
        } else {
            // Losers bracket champion won - needs bracket reset
            if (!this.grandFinalsReset) {
                this.createGrandFinalsReset(winner, loser);
                return { bracketReset: true, resetMatch: this.grandFinalsReset };
            } else {
                // Reset match completed - tournament complete
                this.completeDoubleEliminationTournament(winner);
                return { tournamentComplete: true, champion: winner };
            }
        }
    }

    /**
     * Advance player to winners bracket
     * @param {Object} player - Player data
     * @param {number} round - Round to advance to
     */
    advanceToWinners(player, round) {
        const key = `winners_${round}`;
        if (!this.advancedPlayers.has(key)) {
            this.advancedPlayers.set(key, []);
        }
        
        this.advancedPlayers.get(key).push({
            ...player,
            bracket: 'winners',
            advancedVia: 'winners_advancement'
        });
        
        // Update participant tracking
        const participant = this.participants.get(player.playerId);
        if (participant) {
            participant.currentRound = round;
            participant.wins++;
        }
    }

    /**
     * Drop player to losers bracket
     * @param {Object} player - Player data
     * @param {number} fromWinnersRound - Winners round they lost in
     */
    dropToLosersBracket(player, fromWinnersRound) {
        // Calculate which losers bracket round to enter
        const losersRound = this.calculateLosersRoundFromWinners(fromWinnersRound);
        const key = `losers_${losersRound}`;
        
        if (!this.advancedPlayers.has(key)) {
            this.advancedPlayers.set(key, []);
        }
        
        this.advancedPlayers.get(key).push({
            ...player,
            bracket: 'losers',
            advancedVia: 'dropped_from_winners',
            droppedFromRound: fromWinnersRound
        });
        
        // Update player tracking
        this.playersInWinners.delete(player.playerId);
        this.playersInLosers.add(player.playerId);
        this.playersWithOneLoss.set(player.playerId, {
            lostInRound: fromWinnersRound,
            droppedToRound: losersRound
        });
        
        // Update participant
        const participant = this.participants.get(player.playerId);
        if (participant) {
            participant.losses++;
        }
        
        console.log(`[DoubleElimination] Player ${player.playerName} dropped to losers bracket round ${losersRound}`);
    }

    /**
     * Advance player in losers bracket
     * @param {Object} player - Player data
     * @param {number} round - Losers round to advance to
     */
    advanceToLosers(player, round) {
        const key = `losers_${round}`;
        if (!this.advancedPlayers.has(key)) {
            this.advancedPlayers.set(key, []);
        }
        
        this.advancedPlayers.get(key).push({
            ...player,
            bracket: 'losers',
            advancedVia: 'losers_advancement'
        });
        
        // Update participant
        const participant = this.participants.get(player.playerId);
        if (participant) {
            participant.wins++;
        }
    }

    /**
     * Advance player to grand finals
     * @param {Object} player - Player data
     * @param {string} type - 'winners_champion' or 'losers_champion'
     */
    advanceToGrandFinals(player, type) {
        if (!this.advancedPlayers.has('grand_finals')) {
            this.advancedPlayers.set('grand_finals', []);
        }
        
        this.advancedPlayers.get('grand_finals').push({
            ...player,
            bracket: 'grand_finals',
            advancedVia: type
        });
        
        // Create grand finals match when both champions are ready
        this.checkCreateGrandFinals();
    }

    /**
     * Eliminate player completely
     * @param {Object} player - Player data
     * @param {string} eliminatedIn - Where they were eliminated
     */
    eliminatePlayer(player, eliminatedIn) {
        this.eliminatedPlayers.add(player.playerId);
        this.playersInLosers.delete(player.playerId);
        this.statistics.eliminationCount++;
        
        // Update participant
        const participant = this.participants.get(player.playerId);
        if (participant) {
            participant.isEliminated = true;
            participant.losses++;
        }
        
        // Update player stats
        const stats = this.playerStats.get(player.playerId);
        if (stats) {
            stats.eliminatedIn = eliminatedIn;
        }
        
        console.log(`[DoubleElimination] Player ${player.playerName} eliminated in ${eliminatedIn}`);
    }

    /**
     * Calculate which losers round a player enters when dropped from winners
     * @param {number} winnersRound - Winners round they lost in
     * @returns {number} Losers round to enter
     */
    calculateLosersRoundFromWinners(winnersRound) {
        // Complex calculation based on double elimination bracket structure
        // This is a simplified version - real calculation depends on bracket design
        if (winnersRound === 1) {
            return 1; // First round losers go to losers round 1
        }
        
        // Subsequent rounds alternate feeding into losers bracket
        return (winnersRound - 1) * 2;
    }

    /**
     * Check if grand finals match should be created
     */
    checkCreateGrandFinals() {
        const grandFinalists = this.advancedPlayers.get('grand_finals') || [];
        
        if (grandFinalists.length === 2) {
            // Create grand finals match
            const match = this.createMatch({
                round: this.maxRounds,
                players: grandFinalists,
                matchType: 'grand_finals',
                bracket: 'grand_finals'
            });
            
            this.grandFinals.matches = [match];
            this.grandFinals.totalMatches = 1;
            
            console.log('[DoubleElimination] Grand finals match created');
        }
    }

    /**
     * Create grand finals reset match
     * @param {Object} winner - Winner of first grand finals (losers champ)
     * @param {Object} loser - Loser of first grand finals (winners champ)
     */
    createGrandFinalsReset(winner, loser) {
        this.grandFinalsReset = {
            round: this.maxRounds + 1,
            bracket: 'grand_finals_reset',
            matches: [],
            completedMatches: 0,
            totalMatches: 1
        };
        
        const resetMatch = this.createMatch({
            round: this.maxRounds + 1,
            players: [winner, loser],
            matchType: 'grand_finals_reset',
            bracket: 'grand_finals_reset'
        });
        
        this.grandFinalsReset.matches = [resetMatch];
        this.rounds.push(this.grandFinalsReset);
        
        console.log('[DoubleElimination] Grand finals reset match created');
    }

    /**
     * Complete winners bracket round
     * @param {number} round - Round number
     */
    completeWinnersRound(round) {
        console.log(`[DoubleElimination] Winners bracket round ${round} completed`);
        
        // Generate next round matches if not final
        if (round < this.winnersRounds) {
            this.generateWinnersRoundMatches(round + 1);
        }
        
        // Generate corresponding losers bracket matches
        this.generateLosersBracketMatches(round);
    }

    /**
     * Complete losers bracket round
     * @param {number} round - Round number
     */
    completeLosersRound(round) {
        console.log(`[DoubleElimination] Losers bracket round ${round} completed`);
        
        // Generate next losers round matches if not final
        if (round < this.losersRounds) {
            this.generateLosersRoundMatches(round + 1);
        }
    }

    /**
     * Generate winners bracket round matches
     * @param {number} round - Round number
     */
    generateWinnersRoundMatches(round) {
        const key = `winners_${round}`;
        const advancedPlayers = this.advancedPlayers.get(key) || [];
        
        if (advancedPlayers.length === 0) return;
        
        const roundData = this.winnersBracket[round - 1];
        const matches = [];
        
        // Create matches from advanced players
        for (let i = 0; i < advancedPlayers.length; i += this.tournamentConfig.playersPerRace) {
            const matchPlayers = advancedPlayers.slice(i, i + this.tournamentConfig.playersPerRace);
            
            if (matchPlayers.length >= 2) {
                const match = this.createMatch({
                    round,
                    players: matchPlayers,
                    matchType: 'winners',
                    bracket: 'winners'
                });
                
                matches.push(match);
            } else if (matchPlayers.length === 1) {
                // Single player bye
                this.advancePlayerBye(matchPlayers[0], round + 1, 'winners');
            }
        }
        
        roundData.matches = matches;
        roundData.totalMatches = matches.length;
        
        console.log(`[DoubleElimination] Generated ${matches.length} winners bracket round ${round} matches`);
    }

    /**
     * Generate losers bracket round matches
     * @param {number} round - Round number
     */
    generateLosersRoundMatches(round) {
        const key = `losers_${round}`;
        const advancedPlayers = this.advancedPlayers.get(key) || [];
        
        if (advancedPlayers.length === 0) return;
        
        const roundData = this.losersBracket[round - 1];
        const matches = [];
        
        // Create matches from advanced players
        for (let i = 0; i < advancedPlayers.length; i += this.tournamentConfig.playersPerRace) {
            const matchPlayers = advancedPlayers.slice(i, i + this.tournamentConfig.playersPerRace);
            
            if (matchPlayers.length >= 2) {
                const match = this.createMatch({
                    round,
                    players: matchPlayers,
                    matchType: 'losers',
                    bracket: 'losers'
                });
                
                matches.push(match);
            }
        }
        
        roundData.matches = matches;
        roundData.totalMatches = matches.length;
        
        console.log(`[DoubleElimination] Generated ${matches.length} losers bracket round ${round} matches`);
    }

    /**
     * Generate losers bracket matches when winners bracket round completes
     * @param {number} winnersRound - Completed winners round
     */
    generateLosersBracketMatches(winnersRound) {
        const losersRound = this.calculateLosersRoundFromWinners(winnersRound);
        if (losersRound <= this.losersRounds) {
            this.generateLosersRoundMatches(losersRound);
        }
    }

    /**
     * Complete the double elimination tournament
     * @param {Object} champion - Tournament champion
     */
    completeDoubleEliminationTournament(champion) {
        console.log(`[DoubleElimination] Tournament completed, champion: ${champion.playerName}`);
        
        // Update participant data
        const participant = this.participants.get(champion.playerId);
        if (participant) {
            participant.wins++;
        }
        
        // Emit tournament completed event
        multiplayerEvents.emit('TOURNAMENT_COMPLETED', {
            tournamentId: this.tournamentId,
            format: 'double_elimination',
            champion,
            finalStandings: this.getFinalStandings()
        });
    }

    /**
     * Advance player via bye
     * @param {Object} player - Player to advance
     * @param {number} toRound - Round to advance to
     * @param {string} bracket - Which bracket ('winners' or 'losers')
     */
    advancePlayerBye(player, toRound, bracket) {
        if (bracket === 'winners') {
            this.advanceToWinners(player, toRound);
        } else {
            this.advanceToLosers(player, toRound);
        }
        
        // Update participant bye count
        const participant = this.participants.get(player.playerId);
        if (participant) {
            participant.byeRounds++;
        }
        
        this.statistics.byeCount++;
        console.log(`[DoubleElimination] Player ${player.playerName} advanced via bye in ${bracket} bracket to round ${toRound}`);
    }

    /**
     * Get player's current bracket status
     * @param {string} playerId - Player ID
     * @returns {string} Bracket status
     */
    getPlayerBracketStatus(playerId) {
        if (this.playersInWinners.has(playerId)) {
            return 'winners';
        } else if (this.playersInLosers.has(playerId)) {
            return 'losers';
        } else if (this.eliminatedPlayers.has(playerId)) {
            return 'eliminated';
        }
        
        // Check if they're grand finalists
        const grandFinalists = this.advancedPlayers.get('grand_finals') || [];
        const grandFinalist = grandFinalists.find(p => p.playerId === playerId);
        if (grandFinalist) {
            return grandFinalist.advancedVia;
        }
        
        return 'unknown';
    }

    /**
     * Check if the tournament is complete
     * @returns {boolean} Tournament completion status
     */
    isComplete() {
        // Tournament is complete when grand finals (and possible reset) are done
        if (this.grandFinals && this.grandFinals.completedMatches >= this.grandFinals.totalMatches) {
            if (this.grandFinalsReset) {
                return this.grandFinalsReset.completedMatches >= this.grandFinalsReset.totalMatches;
            }
            return true;
        }
        return false;
    }

    /**
     * Get final tournament standings
     * @returns {Array} Final standings
     */
    getFinalStandings() {
        const standings = [];
        
        // Find champion from grand finals
        let champion = null;
        if (this.grandFinalsReset && this.grandFinalsReset.matches[0]?.winner) {
            champion = this.grandFinalsReset.matches[0].winner;
        } else if (this.grandFinals.matches[0]?.winner) {
            champion = this.grandFinals.matches[0].winner;
        }
        
        if (champion) {
            standings.push({
                position: 1,
                playerId: champion.playerId,
                playerName: champion.playerName,
                seed: this.participants.get(champion.playerId)?.originalSeed,
                bracket: 'champion',
                eliminated: false,
                losses: this.participants.get(champion.playerId)?.losses || 0,
                stats: this.getPlayerStats(champion.playerId)
            });
        }
        
        // Add runner-up (grand finals loser)
        let runnerUp = null;
        if (this.grandFinalsReset && this.grandFinalsReset.matches[0]?.losers[0]) {
            runnerUp = this.grandFinalsReset.matches[0].losers[0];
        } else if (this.grandFinals.matches[0]?.losers[0]) {
            runnerUp = this.grandFinals.matches[0].losers[0];
        }
        
        if (runnerUp) {
            standings.push({
                position: 2,
                playerId: runnerUp.playerId,
                playerName: runnerUp.playerName,
                seed: this.participants.get(runnerUp.playerId)?.originalSeed,
                bracket: 'finalist',
                eliminated: true,
                eliminatedIn: 'grand_finals',
                losses: this.participants.get(runnerUp.playerId)?.losses || 0,
                stats: this.getPlayerStats(runnerUp.playerId)
            });
        }
        
        // Sort remaining players by elimination order and bracket
        let position = 3;
        
        // Group by elimination location for better standings
        const eliminationGroups = new Map();
        
        this.eliminatedPlayers.forEach(playerId => {
            const stats = this.playerStats.get(playerId);
            const eliminatedIn = stats?.eliminatedIn || 'unknown';
            
            if (!eliminationGroups.has(eliminatedIn)) {
                eliminationGroups.set(eliminatedIn, []);
            }
            
            eliminationGroups.get(eliminatedIn).push({
                playerId,
                playerName: this.participants.get(playerId)?.playerName,
                seed: this.participants.get(playerId)?.originalSeed,
                losses: this.participants.get(playerId)?.losses || 0,
                stats: this.getPlayerStats(playerId)
            });
        });
        
        // Sort elimination groups by bracket depth (later eliminations = better placement)
        const sortedGroups = Array.from(eliminationGroups.entries()).sort((a, b) => {
            // Custom sorting logic for elimination location importance
            const locationValue = (location) => {
                if (location.includes('losers_round_')) {
                    const round = parseInt(location.match(/\d+/)?.[0] || '0');
                    return 1000 + round; // Losers bracket eliminations, later rounds better
                }
                if (location.includes('winners_round_')) {
                    const round = parseInt(location.match(/\d+/)?.[0] || '0');
                    return 2000 + round; // Winners bracket eliminations, later rounds better
                }
                return 0;
            };
            
            return locationValue(b[0]) - locationValue(a[0]);
        });
        
        // Add players to standings
        sortedGroups.forEach(([eliminatedIn, players]) => {
            // Sort players within group by performance
            players.sort((a, b) => {
                if (a.losses !== b.losses) return a.losses - b.losses;
                return (a.stats?.totalPoints || 0) - (b.stats?.totalPoints || 0);
            });
            
            players.forEach(player => {
                standings.push({
                    position: position++,
                    playerId: player.playerId,
                    playerName: player.playerName,
                    seed: player.seed,
                    bracket: eliminatedIn.includes('losers') ? 'losers' : 'winners',
                    eliminated: true,
                    eliminatedIn,
                    losses: player.losses,
                    stats: player.stats
                });
            });
        });
        
        return standings;
    }

    /**
     * Get advancement count for a match (double elimination specific)
     * @param {Object} match - Match data
     * @returns {number} Number of players to advance
     */
    getAdvancementCount(match) {
        // In double elimination, generally advance half the players
        const playerCount = match.players.filter(p => !p.isBye).length;
        return Math.ceil(playerCount / 2);
    }

    /**
     * Determine if a player should be eliminated (double elimination specific)
     * @param {Object} match - Match data
     * @param {Object} result - Player result
     * @returns {boolean} True if player should be eliminated
     */
    shouldEliminatePlayer(match, result) {
        if (match.bracket === 'winners') {
            // In winners bracket, losing doesn't eliminate - you drop to losers
            return false;
        } else if (match.bracket === 'losers') {
            // In losers bracket, losing eliminates you
            return result.finishPosition > this.getAdvancementCount(match);
        } else if (match.bracket === 'grand_finals') {
            // Grand finals elimination depends on bracket source
            return result.finishPosition > 1;
        }
        
        return result.finishPosition > this.getAdvancementCount(match);
    }

    /**
     * Get matches for a specific round and bracket
     * @param {number} round - Round number
     * @param {string} bracket - Bracket name ('winners', 'losers', 'grand_finals')
     * @returns {Array} Matches in the round
     */
    getMatchesForRound(round, bracket = 'winners') {
        if (bracket === 'winners') {
            const roundData = this.winnersBracket.find(r => r.round === round);
            return roundData ? roundData.matches : [];
        } else if (bracket === 'losers') {
            const roundData = this.losersBracket.find(r => r.round === round);
            return roundData ? roundData.matches : [];
        } else if (bracket === 'grand_finals') {
            return this.grandFinals ? this.grandFinals.matches : [];
        }
        
        return [];
    }

    /**
     * Get format-specific display information
     */
    getDisplayName() {
        return 'Double Elimination';
    }

    getDescription() {
        return 'Advanced tournament format with winners and losers brackets. Players must lose twice to be eliminated, ensuring more games and fairer results.';
    }

    getFeatures() {
        return [
            'Winners and losers brackets',
            'Players must lose twice to be eliminated',
            'More games per player',
            'Fairer final rankings',
            'Grand finals with potential bracket reset',
            'Complex but rewarding format'
        ];
    }

    getOptimalPlayerCount() {
        // Power of 2 numbers work best for clean bracket structure
        const powerOf2Options = [8, 16, 32];
        return powerOf2Options.find(n => n >= this.tournamentConfig.minPlayers) || 16;
    }

    estimateDuration() {
        const playerCount = this.participants.size;
        const winnersRounds = Math.ceil(Math.log2(playerCount));
        const losersRounds = (winnersRounds * 2) - 1;
        const totalRounds = winnersRounds + losersRounds + 1; // +1 for grand finals
        const avgMatchesPerRound = Math.ceil(playerCount / this.tournamentConfig.playersPerRace / totalRounds);
        const matchDuration = this.tournamentConfig.raceTimeLimit + 60;
        
        return totalRounds * avgMatchesPerRound * matchDuration * 1000;
    }

    getComplexity() {
        return 'complex';
    }
}