/**
 * HistoryManager.test.js - Tests for race history and analytics system
 */

import { HistoryManager } from '../../../src/game/systems/HistoryManager.js';

// Mock localStorage for testing
const localStorageMock = {
    getItem: jest.fn(),
    setItem: jest.fn(),
    removeItem: jest.fn(),
    clear: jest.fn(),
};
global.localStorage = localStorageMock;

describe('HistoryManager', () => {
    let historyManager;

    beforeEach(() => {
        localStorageMock.getItem.mockReturnValue(null);
        localStorageMock.setItem.mockClear();
        historyManager = new HistoryManager();
    });

    afterEach(() => {
        if (historyManager) {
            historyManager.destroy();
        }
    });

    describe('Race Recording', () => {
        test('should record race data correctly', () => {
            const raceData = {
                startTime: 1700000000000,
                endTime: 1700000120000,
                map: 'Classic Maze',
                players: [
                    {
                        id: 'player1',
                        name: 'TestPlayer1',
                        finishTime: 120000,
                        averageSpeed: 5.2,
                        skillsUsed: ['thunder', 'fire'],
                        boostersCollected: 2
                    },
                    {
                        id: 'player2',
                        name: 'TestPlayer2',
                        finishTime: 125000,
                        averageSpeed: 4.8,
                        skillsUsed: ['bubble'],
                        boostersCollected: 1
                    }
                ],
                winner: {
                    id: 'player1',
                    name: 'TestPlayer1'
                },
                powerUpsUsed: [
                    { type: 'antenna', effective: true },
                    { type: 'banana', effective: false }
                ]
            };

            const raceId = historyManager.recordRace(raceData);
            
            expect(raceId).toBeDefined();
            expect(raceId).toContain('race-');
            expect(historyManager.raceHistory).toHaveLength(1);
            
            const recordedRace = historyManager.raceHistory[0];
            expect(recordedRace.map).toBe('Classic Maze');
            expect(recordedRace.duration).toBe(120000);
            expect(recordedRace.players).toHaveLength(2);
            expect(recordedRace.players[0].position).toBe(1);
            expect(recordedRace.players[1].position).toBe(2);
        });

        test('should update player histories on race recording', () => {
            const raceData = {
                startTime: 1700000000000,
                endTime: 1700000120000,
                map: 'Speed Circuit',
                players: [
                    {
                        id: 'player1',
                        name: 'TestPlayer1',
                        finishTime: 120000,
                        averageSpeed: 5.2,
                        skillsUsed: ['thunder'],
                        boostersCollected: 2
                    }
                ],
                winner: { id: 'player1', name: 'TestPlayer1' }
            };

            historyManager.recordRace(raceData);
            
            const playerHistory = historyManager.playerHistory.get('player1');
            expect(playerHistory).toBeDefined();
            expect(playerHistory.totalRaces).toBe(1);
            expect(playerHistory.totalWins).toBe(1);
            expect(playerHistory.bestPosition).toBe(1);
            expect(playerHistory.skillUsageStats.get('thunder')).toBe(1);
        });

        test('should update analytics data on race recording', () => {
            const raceData = {
                startTime: 1700000000000,
                endTime: 1700000120000,
                map: 'Grid Lock',
                players: [
                    {
                        id: 'player1',
                        name: 'TestPlayer1',
                        finishTime: 120000,
                        averageSpeed: 5.2
                    }
                ],
                powerUpsUsed: [
                    { type: 'antenna', effective: true }
                ]
            };

            historyManager.recordRace(raceData);
            
            expect(historyManager.analyticsData.totalRaces).toBe(1);
            expect(historyManager.analyticsData.averageRaceTime).toBe(120000);
            expect(historyManager.analyticsData.popularMaps.get('Grid Lock')).toBe(1);
            expect(historyManager.analyticsData.powerUpUsage.get('antenna')).toBe(1);
        });
    });

    describe('Betting Recording', () => {
        test('should record betting data correctly', () => {
            const betData = {
                raceId: 'race-123',
                playerId: 'player1',
                playerName: 'TestPlayer1',
                amount: 100,
                odds: 2.5,
                outcome: 'win',
                actualWin: 250,
                bettorId: 'bettor1'
            };

            const betId = historyManager.recordBet(betData);
            
            expect(betId).toBeDefined();
            expect(betId).toContain('bet-');
            expect(historyManager.bettingHistory).toHaveLength(1);
            
            const recordedBet = historyManager.bettingHistory[0];
            expect(recordedBet.betAmount).toBe(100);
            expect(recordedBet.odds).toBe(2.5);
            expect(recordedBet.potentialWin).toBe(250);
            expect(recordedBet.outcome).toBe('win');
        });

        test('should update betting analytics on bet recording', () => {
            const betData = {
                raceId: 'race-123',
                playerId: 'player1',
                playerName: 'TestPlayer1',
                amount: 100,
                odds: 2.5,
                outcome: 'win',
                actualWin: 250
            };

            historyManager.recordBet(betData);
            
            expect(historyManager.analyticsData.totalBets).toBe(1);
            expect(historyManager.analyticsData.totalBetAmount).toBe(100);
        });
    });

    describe('Analytics Generation', () => {
        beforeEach(() => {
            // Setup test data
            const raceData1 = {
                startTime: 1700000000000,
                endTime: 1700000120000,
                map: 'Classic Maze',
                players: [
                    { id: 'player1', name: 'Player1', finishTime: 120000, averageSpeed: 5.2 },
                    { id: 'player2', name: 'Player2', finishTime: 125000, averageSpeed: 4.8 }
                ],
                winner: { id: 'player1', name: 'Player1' }
            };

            const raceData2 = {
                startTime: 1700000300000,
                endTime: 1700000420000,
                map: 'Speed Circuit',
                players: [
                    { id: 'player1', name: 'Player1', finishTime: 115000, averageSpeed: 5.5 },
                    { id: 'player3', name: 'Player3', finishTime: 118000, averageSpeed: 5.3 }
                ],
                winner: { id: 'player1', name: 'Player1' }
            };

            historyManager.recordRace(raceData1);
            historyManager.recordRace(raceData2);
        });

        test('should generate analytics report correctly', () => {
            const report = historyManager.getAnalyticsReport();
            
            expect(report.summary.totalRaces).toBe(2);
            expect(report.summary.totalPlayers).toBe(3); // player1, player2, player3
            expect(report.summary.averageRaceTime).toBe(120000);
            expect(report.maps).toHaveLength(2);
            expect(report.players).toHaveLength(3);
        });

        test('should get player statistics correctly', () => {
            const playerStats = historyManager.getPlayerStats('player1');
            
            expect(playerStats).toBeDefined();
            expect(playerStats.totalRaces).toBe(2);
            expect(playerStats.totalWins).toBe(2);
            expect(playerStats.winRate).toBe(100);
            expect(playerStats.bestPosition).toBe(1);
        });

        test('should filter data by timeframe', () => {
            const todayRaces = historyManager.getRacesByTimeframe('today');
            const allRaces = historyManager.getRacesByTimeframe('all');
            
            expect(allRaces).toHaveLength(2);
            // Since test races use actual current timestamps, filter them correctly
            expect(todayRaces).toHaveLength(2); // Both races are from "today" (current timestamp)
        });
    });

    describe('Data Export', () => {
        beforeEach(() => {
            // Setup test data
            const raceData = {
                startTime: 1700000000000,
                endTime: 1700000120000,
                map: 'Test Map',
                players: [
                    { id: 'player1', name: 'Player1', finishTime: 120000 }
                ],
                winner: { id: 'player1', name: 'Player1' }
            };
            
            const betData = {
                raceId: 'race-123',
                playerId: 'player1',
                playerName: 'Player1',
                amount: 100,
                odds: 2.0,
                outcome: 'win',
                actualWin: 200
            };

            historyManager.recordRace(raceData);
            historyManager.recordBet(betData);
        });

        test('should export data as JSON', () => {
            const exportData = historyManager.exportData('json', 'all');
            const parsedData = JSON.parse(exportData);
            
            expect(parsedData.metadata.format).toBe('json');
            expect(parsedData.metadata.version).toBe('1.0.0');
            expect(parsedData.raceHistory).toHaveLength(1);
            expect(parsedData.bettingHistory).toHaveLength(1);
            expect(parsedData.analytics).toBeDefined();
        });

        test('should export data as CSV', () => {
            const exportData = historyManager.exportData('csv', 'all');
            
            expect(typeof exportData).toBe('string');
            expect(exportData).toContain('Race History');
            expect(exportData).toContain('Player Statistics');
            expect(exportData).toContain('Betting History');
            expect(exportData).toContain('Analytics Summary');
            expect(exportData).toContain('Race ID,Timestamp,Map');
        });
    });

    describe('Performance Calculations', () => {
        test('should calculate player performance correctly', () => {
            const player = {
                averageSpeed: 5.0,
                skillsUsed: ['thunder', 'fire'],
                boostersCollected: 3,
                timeStuck: 2000,
                collisions: 1
            };
            
            const performance = historyManager.calculatePlayerPerformance(player, 0); // position 1
            
            expect(performance).toBeGreaterThan(0);
            expect(performance).toBeLessThanOrEqual(200); // Max theoretical score
        });

        test('should calculate performance trend correctly', () => {
            const recentPerformances = [90, 85, 80, 75, 70]; // improving (recent first)
            const trend = historyManager.calculatePerformanceTrend(recentPerformances);
            
            expect(trend).toBe('improving');
        });
    });

    describe('Data Persistence', () => {
        test('should save data to localStorage', async () => {
            historyManager.raceHistory = [{ id: 'test-race', timestamp: Date.now() }];
            
            await historyManager.saveToLocalStorage();
            
            expect(localStorageMock.setItem).toHaveBeenCalledWith(
                'memex-race-history',
                expect.any(String)
            );
        });

        test('should load data from localStorage', async () => {
            const mockRaceData = JSON.stringify([{ id: 'test-race', timestamp: Date.now() }]);
            localStorageMock.getItem.mockReturnValue(mockRaceData);
            
            await historyManager.loadFromLocalStorage();
            
            expect(historyManager.raceHistory).toHaveLength(1);
            expect(historyManager.raceHistory[0].id).toBe('test-race');
        });
    });

    describe('Data Cleanup', () => {
        test('should maintain maximum history entries', () => {
            // Temporarily reduce max entries for testing
            historyManager.config.maxHistoryEntries = 2;
            
            for (let i = 0; i < 5; i++) {
                const raceData = {
                    startTime: 1700000000000 + i * 1000,
                    endTime: 1700000120000 + i * 1000,
                    map: `Map${i}`,
                    players: [{ id: `player${i}`, name: `Player${i}` }]
                };
                historyManager.recordRace(raceData);
            }
            
            expect(historyManager.raceHistory).toHaveLength(2);
        });

        test('should clean up old data', () => {
            // Add old race data
            const oldRace = {
                id: 'old-race',
                timestamp: Date.now() - (100 * 24 * 60 * 60 * 1000), // 100 days ago
                startTime: 1600000000000,
                endTime: 1600000120000,
                map: 'Old Map',
                players: []
            };
            
            historyManager.raceHistory.push(oldRace);
            historyManager.cleanupOldData();
            
            expect(historyManager.raceHistory).toHaveLength(0);
        });
    });
});