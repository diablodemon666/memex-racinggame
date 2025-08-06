/**
 * TournamentBasic.test.js - Basic Tournament System Tests
 * 
 * Simple tests to verify the tournament system is working correctly
 * with proper mocking and module resolution
 */

describe('Tournament System Basic Tests', () => {
  // Test that the tournament files can be imported
  it('should import TournamentManager', async () => {
    const { TournamentManager } = await import('../TournamentManager.js');
    expect(TournamentManager).toBeDefined();
    expect(typeof TournamentManager).toBe('function');
  });

  it('should import BracketManager', async () => {
    const { BracketManager } = await import('../BracketManager.js');
    expect(BracketManager).toBeDefined();
    expect(typeof BracketManager).toBe('function');
  });

  it('should import TournamentStateManager', async () => {
    const { TournamentStateManager } = await import('../TournamentStateManager.js');
    expect(TournamentStateManager).toBeDefined();
    expect(typeof TournamentStateManager).toBe('function');
  });

  it('should import tournament formats', async () => {
    const { TournamentFormat } = await import('../formats/TournamentFormat.js');
    const { SingleElimination } = await import('../formats/SingleElimination.js');
    const { DoubleElimination } = await import('../formats/DoubleElimination.js');
    const { RoundRobin } = await import('../formats/RoundRobin.js');
    
    expect(TournamentFormat).toBeDefined();
    expect(SingleElimination).toBeDefined();
    expect(DoubleElimination).toBeDefined();
    expect(RoundRobin).toBeDefined();
  });

  it('should create tournament manager instance', () => {
    // Mock the dependencies first
    const mockAuthManager = {
      validateUser: jest.fn().mockResolvedValue(true)
    };
    const mockGameEngine = {
      isRunning: true
    };

    // Import and create instance
    const { TournamentManager } = require('../TournamentManager.js');
    
    expect(() => {
      new TournamentManager(mockAuthManager, mockGameEngine);
    }).not.toThrow();
  });

  it('should create bracket manager instance', () => {
    const { BracketManager } = require('../BracketManager.js');
    
    expect(() => {
      new BracketManager();
    }).not.toThrow();
  });

  it('should create tournament state manager instance', () => {
    const { TournamentStateManager } = require('../TournamentStateManager.js');
    
    expect(() => {
      new TournamentStateManager();
    }).not.toThrow();
  });

  it('should create tournament format instances', () => {
    const { TournamentFormat } = require('../formats/TournamentFormat.js');
    const { SingleElimination } = require('../formats/SingleElimination.js');
    const { DoubleElimination } = require('../formats/DoubleElimination.js');
    const { RoundRobin } = require('../formats/RoundRobin.js');
    
    const config = { format: 'test', maxPlayers: 16, minPlayers: 4 };
    
    expect(() => new TournamentFormat(config)).not.toThrow();
    expect(() => new SingleElimination(config)).not.toThrow();
    expect(() => new DoubleElimination(config)).not.toThrow();
    expect(() => new RoundRobin(config)).not.toThrow();
  });
});