/**
 * TournamentBracket.js - Tournament Bracket Visualization Component
 * 
 * Interactive bracket display for all tournament formats with single/double elimination
 * bracket trees, round robin standings, match results, and live updates.
 */

export class TournamentBracket {
    constructor(uiManager) {
        this.uiManager = uiManager;
        this.isVisible = false;
        this.currentTournament = null;
        this.bracketType = 'single_elimination'; // single_elimination, double_elimination, round_robin
        
        // Bracket visualization state
        this.zoomLevel = 1.0;
        this.panX = 0;
        this.panY = 0;
        this.isDragging = false;
        this.dragStartX = 0;
        this.dragStartY = 0;
        
        // Match states
        this.selectedMatch = null;
        this.hoveredMatch = null;
        this.animatedMatches = new Set();
        
        // Bracket dimensions
        this.matchWidth = 180;
        this.matchHeight = 60;
        this.roundSpacing = 240;
        this.matchSpacing = 80;
        
        console.log('[TournamentBracket] Tournament bracket component initialized');
    }

    /**
     * Initialize the tournament bracket panel
     */
    async initialize() {
        this.createPanelContent();
        this.setupEventListeners();
        console.log('[TournamentBracket] Panel initialized');
    }

    /**
     * Create tournament bracket panel content structure
     */
    createPanelContent() {
        const panel = document.getElementById('tournament-bracket-panel');
        if (!panel) return;

        panel.innerHTML = `
            <div class="tournament-bracket-overlay">
                <div class="tournament-bracket-modal">
                    <div class="panel-header">
                        <div class="panel-title">
                            <span class="title-text pixel-text">TOURNAMENT BRACKET</span>
                            <div class="bracket-controls">
                                <button class="control-btn zoom-out-btn" id="zoom-out-btn" title="Zoom Out">
                                    <span class="btn-icon">🔍-</span>
                                </button>
                                <button class="control-btn zoom-in-btn" id="zoom-in-btn" title="Zoom In">
                                    <span class="btn-icon">🔍+</span>
                                </button>
                                <button class="control-btn center-btn" id="center-bracket-btn" title="Center View">
                                    <span class="btn-icon">🎯</span>
                                </button>
                            </div>
                        </div>
                    </div>
                    
                    <div class="panel-body bracket-content">
                        <div class="tournament-info" id="tournament-info">
                            <div class="tournament-status" id="tournament-status">
                                <span class="status-label">STATUS:</span>
                                <span class="status-value">NO TOURNAMENT</span>
                            </div>
                            <div class="tournament-progress" id="tournament-progress">
                                <span class="progress-label">ROUND:</span>
                                <span class="progress-value">- / -</span>
                            </div>
                            <div class="tournament-participants" id="tournament-participants">
                                <span class="participants-label">PLAYERS:</span>
                                <span class="participants-value">0</span>
                            </div>
                        </div>
                        
                        <div class="bracket-format-tabs" id="bracket-format-tabs">
                            <button class="format-tab active" data-format="bracket" id="bracket-tab">
                                <span class="tab-icon">🏆</span>
                                BRACKET
                            </button>
                            <button class="format-tab" data-format="standings" id="standings-tab">
                                <span class="tab-icon">📊</span>
                                STANDINGS
                            </button>
                            <button class="format-tab" data-format="matches" id="matches-tab">
                                <span class="tab-icon">⚔️</span>
                                MATCHES
                            </button>
                        </div>
                        
                        <div class="bracket-container" id="bracket-container">
                            <div class="bracket-viewport" id="bracket-viewport">
                                <div class="bracket-canvas" id="bracket-canvas">
                                    <!-- Bracket visualization will be rendered here -->
                                </div>
                            </div>
                        </div>
                        
                        <div class="standings-container hidden" id="standings-container">
                            <div class="standings-table-wrapper">
                                <table class="standings-table" id="standings-table">
                                    <thead>
                                        <tr>
                                            <th>RANK</th>
                                            <th>PLAYER</th>
                                            <th>WINS</th>
                                            <th>LOSSES</th>
                                            <th>WIN%</th>
                                            <th>STATUS</th>
                                        </tr>
                                    </thead>
                                    <tbody id="standings-tbody">
                                        <!-- Standings rows will be generated -->
                                    </tbody>
                                </table>
                            </div>
                        </div>
                        
                        <div class="matches-container hidden" id="matches-container">
                            <div class="matches-list" id="matches-list">
                                <!-- Match history will be generated -->
                            </div>
                        </div>
                        
                        <div class="match-details-panel" id="match-details-panel">
                            <div class="match-header">
                                <span class="match-title" id="match-title">MATCH DETAILS</span>
                                <button class="close-details-btn" id="close-details-btn">✕</button>
                            </div>
                            <div class="match-info" id="match-info">
                                <!-- Match details will be populated -->
                            </div>
                        </div>
                    </div>
                    
                    <div class="panel-footer">
                        <div class="bracket-legend">
                            <div class="legend-item">
                                <div class="legend-color pending"></div>
                                <span>PENDING</span>
                            </div>
                            <div class="legend-item">
                                <div class="legend-color active"></div>
                                <span>ACTIVE</span>
                            </div>
                            <div class="legend-item">
                                <div class="legend-color completed"></div>
                                <span>COMPLETED</span>
                            </div>
                        </div>
                        <button class="action-btn close-btn" id="close-bracket-btn">
                            <span class="btn-icon">✕</span>
                            CLOSE
                        </button>
                    </div>
                </div>
            </div>
        `;
    }

    /**
     * Setup event listeners for bracket interactions
     */
    setupEventListeners() {
        // Close button
        const closeBtn = document.getElementById('close-bracket-btn');
        if (closeBtn) {
            closeBtn.addEventListener('click', () => this.hide());
        }

        // Zoom controls
        const zoomInBtn = document.getElementById('zoom-in-btn');
        const zoomOutBtn = document.getElementById('zoom-out-btn');
        const centerBtn = document.getElementById('center-bracket-btn');

        if (zoomInBtn) zoomInBtn.addEventListener('click', () => this.zoomIn());
        if (zoomOutBtn) zoomOutBtn.addEventListener('click', () => this.zoomOut());
        if (centerBtn) centerBtn.addEventListener('click', () => this.centerView());

        // Format tabs
        document.querySelectorAll('.format-tab').forEach(tab => {
            tab.addEventListener('click', (e) => {
                const format = e.target.closest('[data-format]').dataset.format;
                this.switchFormat(format);
            });
        });

        // Close match details
        const closeDetailsBtn = document.getElementById('close-details-btn');
        if (closeDetailsBtn) {
            closeDetailsBtn.addEventListener('click', () => this.hideMatchDetails());
        }

        // Bracket viewport interactions
        const viewport = document.getElementById('bracket-viewport');
        if (viewport) {
            // Pan and zoom with mouse
            viewport.addEventListener('mousedown', (e) => this.startDrag(e));
            viewport.addEventListener('mousemove', (e) => this.handleDrag(e));
            viewport.addEventListener('mouseup', () => this.endDrag());
            viewport.addEventListener('mouseleave', () => this.endDrag());
            
            // Zoom with mouse wheel
            viewport.addEventListener('wheel', (e) => {
                e.preventDefault();
                if (e.deltaY < 0) {
                    this.zoomIn();
                } else {
                    this.zoomOut();
                }
            });
        }

        // Keyboard shortcuts
        document.addEventListener('keydown', (e) => {
            if (!this.isVisible) return;
            
            switch(e.key) {
                case 'Escape':
                    this.hide();
                    break;
                case '+':
                case '=':
                    this.zoomIn();
                    break;
                case '-':
                    this.zoomOut();
                    break;
                case '0':
                    this.centerView();
                    break;
                case '1':
                    this.switchFormat('bracket');
                    break;
                case '2':
                    this.switchFormat('standings');
                    break;
                case '3':
                    this.switchFormat('matches');
                    break;
            }
        });

        // Close on overlay click
        const overlay = document.querySelector('.tournament-bracket-overlay');
        if (overlay) {
            overlay.addEventListener('click', (e) => {
                if (e.target === overlay) {
                    this.hide();
                }
            });
        }
    }

    /**
     * Show tournament bracket panel
     */
    show() {
        const panel = document.getElementById('tournament-bracket-panel');
        if (panel) {
            panel.style.display = 'block';
            this.isVisible = true;
            
            // Load current tournament if available
            this.loadCurrentTournament();
            
            console.log('[TournamentBracket] Panel shown');
        }
    }

    /**
     * Hide tournament bracket panel
     */
    hide() {
        const panel = document.getElementById('tournament-bracket-panel');
        if (panel) {
            panel.style.display = 'none';
            this.isVisible = false;
            this.hideMatchDetails();
            console.log('[TournamentBracket] Panel hidden');
        }
    }

    /**
     * Toggle panel visibility
     */
    toggle() {
        if (this.isVisible) {
            this.hide();
        } else {
            this.show();
        }
    }

    /**
     * Get the DOM element for this component
     * Required for AnimationManager integration
     */
    getElement() {
        return document.getElementById('tournament-bracket-panel');
    }

    /**
     * Load and display tournament data
     */
    async loadCurrentTournament() {
        try {
            // Get current tournament from tournament manager
            const tournamentManager = window.tournamentManager;
            if (!tournamentManager) {
                this.showNoTournament();
                return;
            }

            // For demo purposes, create a sample tournament
            // In real implementation, this would come from the tournament manager
            const tournaments = tournamentManager.listActiveTournaments();
            const currentTournament = tournaments.length > 0 ? tournaments[0] : null;

            if (currentTournament) {
                this.setTournament(currentTournament);
            } else {
                this.createSampleTournament();
            }
            
        } catch (error) {
            console.error('[TournamentBracket] Error loading tournament:', error);
            this.showNoTournament();
        }
    }

    /**
     * Create sample tournament for demonstration
     */
    createSampleTournament() {
        const sampleTournament = {
            tournamentId: 'sample-tournament',
            name: 'Memex Racing Championship',
            format: 'single_elimination',
            status: 'active',
            currentRound: 2,
            totalRounds: 3,
            maxPlayers: 8,
            currentPlayers: 8,
            registeredPlayers: [
                { playerId: 'p1', playerName: 'SpeedRacer', seed: 1, wins: 2, losses: 0 },
                { playerId: 'p2', playerName: 'TurboMax', seed: 2, wins: 1, losses: 1 },
                { playerId: 'p3', playerName: 'RaceKing', seed: 3, wins: 1, losses: 1 },
                { playerId: 'p4', playerName: 'VelocityX', seed: 4, wins: 2, losses: 0 },
                { playerId: 'p5', playerName: 'NitroBlast', seed: 5, wins: 0, losses: 1 },
                { playerId: 'p6', playerName: 'QuickShift', seed: 6, wins: 0, losses: 1 },
                { playerId: 'p7', playerName: 'ZoomMaster', seed: 7, wins: 0, losses: 1 },
                { playerId: 'p8', playerName: 'RushHour', seed: 8, wins: 1, losses: 1 }
            ],
            bracket: {
                rounds: [
                    // Round 1 (Quarterfinals)
                    [
                        { matchId: '1-1', players: ['p1', 'p8'], winner: 'p1', status: 'completed', round: 1 },
                        { matchId: '1-2', players: ['p4', 'p5'], winner: 'p4', status: 'completed', round: 1 },
                        { matchId: '1-3', players: ['p2', 'p7'], winner: 'p2', status: 'completed', round: 1 },
                        { matchId: '1-4', players: ['p3', 'p6'], winner: 'p3', status: 'completed', round: 1 }
                    ],
                    // Round 2 (Semifinals)
                    [
                        { matchId: '2-1', players: ['p1', 'p4'], winner: null, status: 'active', round: 2 },
                        { matchId: '2-2', players: ['p2', 'p3'], winner: null, status: 'pending', round: 2 }
                    ],
                    // Round 3 (Final)
                    [
                        { matchId: '3-1', players: [null, null], winner: null, status: 'pending', round: 3 }
                    ]
                ]
            }
        };

        this.setTournament(sampleTournament);
    }

    /**
     * Set tournament data and update display
     */
    setTournament(tournament) {
        this.currentTournament = tournament;
        this.bracketType = tournament.format || 'single_elimination';
        
        this.updateTournamentInfo();
        this.renderBracket();
        this.updateStandings();
        this.updateMatches();
    }

    /**
     * Update tournament information display
     */
    updateTournamentInfo() {
        if (!this.currentTournament) return;

        const statusEl = document.querySelector('#tournament-status .status-value');
        const progressEl = document.querySelector('#tournament-progress .progress-value');
        const participantsEl = document.querySelector('#tournament-participants .participants-value');

        if (statusEl) {
            statusEl.textContent = this.currentTournament.status.toUpperCase();
            statusEl.className = `status-value status-${this.currentTournament.status}`;
        }

        if (progressEl) {
            progressEl.textContent = `${this.currentTournament.currentRound || 0} / ${this.currentTournament.totalRounds || 0}`;
        }

        if (participantsEl) {
            participantsEl.textContent = this.currentTournament.currentPlayers || 0;
        }
    }

    /**
     * Render tournament bracket visualization
     */
    renderBracket() {
        const canvas = document.getElementById('bracket-canvas');
        if (!canvas || !this.currentTournament) return;

        canvas.innerHTML = '';
        
        if (this.bracketType === 'round_robin') {
            this.renderRoundRobin(canvas);
        } else {
            this.renderEliminationBracket(canvas);
        }
    }

    /**
     * Render elimination bracket (single or double)
     */
    renderEliminationBracket(canvas) {
        const { bracket } = this.currentTournament;
        if (!bracket || !bracket.rounds) return;

        let maxWidth = 0;
        let totalHeight = 0;

        // Calculate dimensions
        bracket.rounds.forEach((round, roundIndex) => {
            const roundWidth = roundIndex * this.roundSpacing + this.matchWidth;
            const roundHeight = round.length * (this.matchHeight + this.matchSpacing);
            
            maxWidth = Math.max(maxWidth, roundWidth);
            totalHeight = Math.max(totalHeight, roundHeight);
        });

        // Set canvas size
        canvas.style.width = `${maxWidth + 100}px`;
        canvas.style.height = `${totalHeight + 100}px`;

        // Render rounds
        bracket.rounds.forEach((round, roundIndex) => {
            this.renderRound(canvas, round, roundIndex);
        });

        // Render connecting lines
        this.renderConnectingLines(canvas, bracket.rounds);
    }

    /**
     * Render a single round
     */
    renderRound(canvas, matches, roundIndex) {
        const roundContainer = document.createElement('div');
        roundContainer.className = 'bracket-round';
        roundContainer.style.position = 'absolute';
        roundContainer.style.left = `${roundIndex * this.roundSpacing + 50}px`;
        roundContainer.style.top = '50px';

        matches.forEach((match, matchIndex) => {
            const matchElement = this.createMatchElement(match, matchIndex);
            matchElement.style.top = `${matchIndex * (this.matchHeight + this.matchSpacing)}px`;
            roundContainer.appendChild(matchElement);
        });

        canvas.appendChild(roundContainer);
    }

    /**
     * Create match element
     */
    createMatchElement(match, matchIndex) {
        const matchEl = document.createElement('div');
        matchEl.className = `bracket-match status-${match.status}`;
        matchEl.dataset.matchId = match.matchId;
        matchEl.style.width = `${this.matchWidth}px`;
        matchEl.style.height = `${this.matchHeight}px`;
        matchEl.style.position = 'absolute';

        const player1 = this.getPlayerById(match.players[0]);
        const player2 = this.getPlayerById(match.players[1]);

        matchEl.innerHTML = `
            <div class="match-header">
                <span class="match-id">${match.matchId}</span>
                <span class="match-status ${match.status}">${match.status.toUpperCase()}</span>
            </div>
            <div class="match-players">
                <div class="match-player ${match.winner === match.players[0] ? 'winner' : ''}">
                    <span class="player-name">${player1?.playerName || 'TBD'}</span>
                    ${match.winner === match.players[0] ? '<span class="winner-icon">👑</span>' : ''}
                </div>
                <div class="match-vs">VS</div>
                <div class="match-player ${match.winner === match.players[1] ? 'winner' : ''}">
                    <span class="player-name">${player2?.playerName || 'TBD'}</span>
                    ${match.winner === match.players[1] ? '<span class="winner-icon">👑</span>' : ''}
                </div>
            </div>
        `;

        // Add click handler
        matchEl.addEventListener('click', () => this.showMatchDetails(match));
        
        // Add hover effects
        matchEl.addEventListener('mouseenter', () => {
            this.hoveredMatch = match.matchId;
            matchEl.classList.add('hovered');
        });
        
        matchEl.addEventListener('mouseleave', () => {
            this.hoveredMatch = null;
            matchEl.classList.remove('hovered');
        });

        return matchEl;
    }

    /**
     * Render connecting lines between matches
     */
    renderConnectingLines(canvas, rounds) {
        const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        svg.style.position = 'absolute';
        svg.style.top = '0';
        svg.style.left = '0';
        svg.style.width = '100%';
        svg.style.height = '100%';
        svg.style.pointerEvents = 'none';
        svg.style.zIndex = '1';

        for (let roundIndex = 0; roundIndex < rounds.length - 1; roundIndex++) {
            const currentRound = rounds[roundIndex];
            const nextRound = rounds[roundIndex + 1];

            for (let i = 0; i < nextRound.length; i++) {
                const match1Index = i * 2;
                const match2Index = i * 2 + 1;

                if (match1Index < currentRound.length && match2Index < currentRound.length) {
                    this.drawConnectingLine(svg, roundIndex, match1Index, match2Index, i);
                }
            }
        }

        canvas.appendChild(svg);
    }

    /**
     * Draw connecting line between matches
     */
    drawConnectingLine(svg, roundIndex, match1Index, match2Index, nextMatchIndex) {
        const x1 = roundIndex * this.roundSpacing + 50 + this.matchWidth;
        const y1 = 50 + match1Index * (this.matchHeight + this.matchSpacing) + this.matchHeight / 2;
        const y2 = 50 + match2Index * (this.matchHeight + this.matchSpacing) + this.matchHeight / 2;
        const x2 = (roundIndex + 1) * this.roundSpacing + 50;
        const y3 = 50 + nextMatchIndex * (this.matchHeight + this.matchSpacing) + this.matchHeight / 2;

        const midX = x1 + (x2 - x1) / 2;

        const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        path.setAttribute('d', `M ${x1} ${y1} L ${midX} ${y1} L ${midX} ${y2} L ${x1} ${y2} M ${midX} ${(y1 + y2) / 2} L ${x2} ${y3}`);
        path.setAttribute('stroke', '#00ff00');
        path.setAttribute('stroke-width', '2');
        path.setAttribute('fill', 'none');
        path.setAttribute('opacity', '0.6');

        svg.appendChild(path);
    }

    /**
     * Switch between bracket view formats
     */
    switchFormat(format) {
        // Update tab states
        document.querySelectorAll('.format-tab').forEach(tab => {
            tab.classList.remove('active');
        });
        document.querySelector(`[data-format="${format}"]`).classList.add('active');

        // Show/hide containers
        document.getElementById('bracket-container').classList.toggle('hidden', format !== 'bracket');
        document.getElementById('standings-container').classList.toggle('hidden', format !== 'standings');
        document.getElementById('matches-container').classList.toggle('hidden', format !== 'matches');

        console.log(`[TournamentBracket] Switched to ${format} view`);
    }

    /**
     * Update standings table
     */
    updateStandings() {
        const tbody = document.getElementById('standings-tbody');
        if (!tbody || !this.currentTournament) return;

        tbody.innerHTML = '';

        // Sort players by wins, then by win percentage
        const sortedPlayers = [...this.currentTournament.registeredPlayers].sort((a, b) => {
            if (b.wins !== a.wins) return b.wins - a.wins;
            const aWinRate = a.wins / Math.max(a.wins + a.losses, 1);
            const bWinRate = b.wins / Math.max(b.wins + b.losses, 1);
            return bWinRate - aWinRate;
        });

        sortedPlayers.forEach((player, index) => {
            const winRate = Math.round((player.wins / Math.max(player.wins + player.losses, 1)) * 100);
            const status = this.getPlayerStatus(player.playerId);

            const row = document.createElement('tr');
            row.className = `standings-row status-${status}`;
            row.innerHTML = `
                <td class="rank-cell">${index + 1}</td>
                <td class="player-cell">
                    <span class="player-name">${player.playerName}</span>
                    <span class="player-seed">Seed: ${player.seed}</span>
                </td>
                <td class="wins-cell">${player.wins}</td>
                <td class="losses-cell">${player.losses}</td>
                <td class="winrate-cell">${winRate}%</td>
                <td class="status-cell">
                    <span class="status-badge status-${status}">${status.toUpperCase()}</span>
                </td>
            `;

            tbody.appendChild(row);
        });
    }

    /**
     * Update matches list
     */
    updateMatches() {
        const matchesList = document.getElementById('matches-list');
        if (!matchesList || !this.currentTournament) return;

        matchesList.innerHTML = '';

        // Flatten all matches from all rounds
        const allMatches = [];
        if (this.currentTournament.bracket && this.currentTournament.bracket.rounds) {
            this.currentTournament.bracket.rounds.forEach(round => {
                allMatches.push(...round);
            });
        }

        // Sort by round and match ID
        allMatches.sort((a, b) => {
            if (a.round !== b.round) return a.round - b.round;
            return a.matchId.localeCompare(b.matchId);
        });

        allMatches.forEach(match => {
            const matchEl = this.createMatchListItem(match);
            matchesList.appendChild(matchEl);
        });
    }

    /**
     * Create match list item
     */
    createMatchListItem(match) {
        const player1 = this.getPlayerById(match.players[0]);
        const player2 = this.getPlayerById(match.players[1]);

        const matchEl = document.createElement('div');
        matchEl.className = `match-item status-${match.status}`;
        matchEl.innerHTML = `
            <div class="match-item-header">
                <span class="match-item-id">${match.matchId}</span>
                <span class="match-item-round">Round ${match.round}</span>
                <span class="match-item-status status-${match.status}">${match.status.toUpperCase()}</span>
            </div>
            <div class="match-item-players">
                <div class="match-item-player ${match.winner === match.players[0] ? 'winner' : ''}">
                    ${player1?.playerName || 'TBD'}
                    ${match.winner === match.players[0] ? ' 👑' : ''}
                </div>
                <span class="match-item-vs">VS</span>
                <div class="match-item-player ${match.winner === match.players[1] ? 'winner' : ''}">
                    ${player2?.playerName || 'TBD'}
                    ${match.winner === match.players[1] ? ' 👑' : ''}
                </div>
            </div>
        `;

        matchEl.addEventListener('click', () => this.showMatchDetails(match));

        return matchEl;
    }

    /**
     * Show match details panel
     */
    showMatchDetails(match) {
        const panel = document.getElementById('match-details-panel');
        const title = document.getElementById('match-title');
        const info = document.getElementById('match-info');

        if (!panel || !title || !info) return;

        const player1 = this.getPlayerById(match.players[0]);
        const player2 = this.getPlayerById(match.players[1]);

        title.textContent = `MATCH ${match.matchId} - ROUND ${match.round}`;

        info.innerHTML = `
            <div class="match-detail-row">
                <span class="detail-label">STATUS:</span>
                <span class="detail-value status-${match.status}">${match.status.toUpperCase()}</span>
            </div>
            <div class="match-detail-row">
                <span class="detail-label">PLAYERS:</span>
                <div class="detail-players">
                    <div class="detail-player ${match.winner === match.players[0] ? 'winner' : ''}">
                        ${player1?.playerName || 'TBD'}
                        ${match.winner === match.players[0] ? ' (WINNER)' : ''}
                    </div>
                    <div class="detail-vs">VS</div>
                    <div class="detail-player ${match.winner === match.players[1] ? 'winner' : ''}">
                        ${player2?.playerName || 'TBD'}
                        ${match.winner === match.players[1] ? ' (WINNER)' : ''}
                    </div>
                </div>
            </div>
            ${match.duration ? `
            <div class="match-detail-row">
                <span class="detail-label">DURATION:</span>
                <span class="detail-value">${Math.round(match.duration / 1000)}s</span>
            </div>
            ` : ''}
            ${match.roomCode ? `
            <div class="match-detail-row">
                <span class="detail-label">ROOM:</span>
                <span class="detail-value">${match.roomCode}</span>
            </div>
            ` : ''}
        `;

        panel.classList.add('visible');
        this.selectedMatch = match.matchId;
    }

    /**
     * Hide match details panel
     */
    hideMatchDetails() {
        const panel = document.getElementById('match-details-panel');
        if (panel) {
            panel.classList.remove('visible');
        }
        this.selectedMatch = null;
    }

    /**
     * Pan and zoom controls
     */
    startDrag(e) {
        this.isDragging = true;
        this.dragStartX = e.clientX - this.panX;
        this.dragStartY = e.clientY - this.panY;
    }

    handleDrag(e) {
        if (!this.isDragging) return;
        
        this.panX = e.clientX - this.dragStartX;
        this.panY = e.clientY - this.dragStartY;
        this.updateTransform();
    }

    endDrag() {
        this.isDragging = false;
    }

    zoomIn() {
        this.zoomLevel = Math.min(this.zoomLevel * 1.2, 3.0);
        this.updateTransform();
    }

    zoomOut() {
        this.zoomLevel = Math.max(this.zoomLevel / 1.2, 0.3);
        this.updateTransform();
    }

    centerView() {
        this.zoomLevel = 1.0;
        this.panX = 0;
        this.panY = 0;
        this.updateTransform();
    }

    updateTransform() {
        const canvas = document.getElementById('bracket-canvas');
        if (canvas) {
            canvas.style.transform = `translate(${this.panX}px, ${this.panY}px) scale(${this.zoomLevel})`;
        }
    }

    /**
     * Utility methods
     */
    getPlayerById(playerId) {
        if (!this.currentTournament || !playerId) return null;
        return this.currentTournament.registeredPlayers.find(p => p.playerId === playerId);
    }

    getPlayerStatus(playerId) {
        // Determine player status based on current tournament state
        if (!this.currentTournament.bracket) return 'active';
        
        // Check if player is eliminated
        const allMatches = [];
        this.currentTournament.bracket.rounds.forEach(round => {
            allMatches.push(...round);
        });

        const playerMatches = allMatches.filter(match => 
            match.players.includes(playerId) && match.status === 'completed'
        );

        const hasWon = playerMatches.some(match => match.winner === playerId);
        const hasLost = playerMatches.some(match => match.winner && match.winner !== playerId);

        if (hasLost && !hasWon) return 'eliminated';
        if (hasWon && !hasLost) return 'advancing';
        return 'active';
    }

    showNoTournament() {
        const statusEl = document.querySelector('#tournament-status .status-value');
        if (statusEl) {
            statusEl.textContent = 'NO ACTIVE TOURNAMENT';
            statusEl.className = 'status-value status-none';
        }
        
        // Clear displays
        const canvas = document.getElementById('bracket-canvas');
        if (canvas) canvas.innerHTML = '<div class="no-tournament-message">No tournament data available</div>';
        
        const tbody = document.getElementById('standings-tbody');
        if (tbody) tbody.innerHTML = '<tr><td colspan="6" class="no-data">No tournament data</td></tr>';
        
        const matchesList = document.getElementById('matches-list');
        if (matchesList) matchesList.innerHTML = '<div class="no-matches">No matches available</div>';
    }

    /**
     * Update bracket with live tournament data
     */
    updateTournamentData(tournamentData) {
        if (this.currentTournament && tournamentData.tournamentId === this.currentTournament.tournamentId) {
            this.setTournament(tournamentData);
            
            // Animate updated matches
            this.animateUpdatedMatches(tournamentData);
        }
    }

    /**
     * Animate updated matches
     */
    animateUpdatedMatches(tournamentData) {
        // Find newly completed matches and animate them
        const newlyCompleted = [];
        
        if (tournamentData.bracket && tournamentData.bracket.rounds) {
            tournamentData.bracket.rounds.forEach(round => {
                round.forEach(match => {
                    if (match.status === 'completed' && !this.animatedMatches.has(match.matchId)) {
                        newlyCompleted.push(match.matchId);
                        this.animatedMatches.add(match.matchId);
                    }
                });
            });
        }

        // Animate newly completed matches
        newlyCompleted.forEach(matchId => {
            const matchEl = document.querySelector(`[data-match-id="${matchId}"]`);
            if (matchEl) {
                matchEl.classList.add('newly-completed');
                setTimeout(() => {
                    matchEl.classList.remove('newly-completed');
                }, 2000);
            }
        });
    }

    /**
     * Destroy the tournament bracket panel
     */
    destroy() {
        this.hide();
        this.currentTournament = null;
        this.animatedMatches.clear();
        console.log('[TournamentBracket] Panel destroyed');
    }
}