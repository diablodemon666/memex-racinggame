/**
 * Custom Jest Matchers for Memex Racing Game
 * 
 * Provides specialized matchers for testing game-specific functionality
 * including Phaser.js objects, UI components, and game state.
 */

/**
 * Matcher to check if a DOM element has a specific CSS class
 */
function toHaveClass(received, className) {
  const pass = received.classList && received.classList.contains(className);
  
  if (pass) {
    return {
      message: () => `expected element not to have class "${className}"`,
      pass: true,
    };
  } else {
    return {
      message: () => `expected element to have class "${className}"`,
      pass: false,
    };
  }
}

/**
 * Matcher to check if a DOM element is visible
 */
function toBeVisible(received) {
  const pass = received.offsetHeight > 0 && 
               received.offsetWidth > 0 && 
               !received.classList.contains('hidden') &&
               getComputedStyle(received).display !== 'none' &&
               getComputedStyle(received).visibility !== 'hidden';
  
  if (pass) {
    return {
      message: () => `expected element not to be visible`,
      pass: true,
    };
  } else {
    return {
      message: () => `expected element to be visible`,
      pass: false,
    };
  }
}

/**
 * Matcher to check if a DOM element is hidden
 */
function toBeHidden(received) {
  const pass = received.offsetHeight === 0 || 
               received.offsetWidth === 0 || 
               received.classList.contains('hidden') ||
               getComputedStyle(received).display === 'none' ||
               getComputedStyle(received).visibility === 'hidden';
  
  if (pass) {
    return {
      message: () => `expected element not to be hidden`,
      pass: true,
    };
  } else {
    return {
      message: () => `expected element to be hidden`,
      pass: false,
    };
  }
}

/**
 * Matcher to check if a Phaser game object has been created properly
 */
function toBePhaserGameObject(received) {
  const pass = received && 
               typeof received === 'object' &&
               received.scene &&
               received.sound &&
               received.tweens &&
               received.time;
  
  if (pass) {
    return {
      message: () => `expected object not to be a Phaser game object`,
      pass: true,
    };
  } else {
    return {
      message: () => `expected object to be a Phaser game object with scene, sound, tweens, and time properties`,
      pass: false,
    };
  }
}

/**
 * Matcher to check if a Phaser scene has required properties
 */
function toBePhaserScene(received) {
  const pass = received && 
               typeof received === 'object' &&
               received.add &&
               received.physics &&
               received.tweens &&
               received.time &&
               received.game;
  
  if (pass) {
    return {
      message: () => `expected object not to be a Phaser scene`,
      pass: true,
    };
  } else {
    return {
      message: () => `expected object to be a Phaser scene with add, physics, tweens, time, and game properties`,
      pass: false,
    };
  }
}

/**
 * Matcher to check if a betting system has valid state
 */
function toHaveValidBettingState(received) {
  const pass = received && 
               typeof received === 'object' &&
               typeof received.isActive === 'boolean' &&
               typeof received.timeRemaining === 'number' &&
               typeof received.userBalance === 'number' &&
               received.userBalance >= 0;
  
  if (pass) {
    return {
      message: () => `expected object not to have valid betting state`,
      pass: true,
    };
  } else {
    return {
      message: () => `expected object to have valid betting state with isActive (boolean), timeRemaining (number), and userBalance (number >= 0)`,
      pass: false,
    };
  }
}

/**
 * Matcher to check if a player object has required properties
 */
function toBeValidPlayer(received) {
  const pass = received && 
               typeof received === 'object' &&
               typeof received.id === 'string' &&
               typeof received.name === 'string' &&
               typeof received.wins === 'number' &&
               typeof received.winRate === 'number' &&
               received.wins >= 0 &&
               received.winRate >= 0 &&
               received.winRate <= 100;
  
  if (pass) {
    return {
      message: () => `expected object not to be a valid player`,
      pass: true,
    };
  } else {
    return {
      message: () => `expected object to be a valid player with id (string), name (string), wins (number >= 0), and winRate (0-100)`,
      pass: false,
    };
  }
}

/**
 * Matcher to check if a game state object is valid
 */
function toHaveValidGameState(received) {
  const validPhases = ['menu', 'lobby', 'betting', 'racing', 'finished'];
  const pass = received && 
               typeof received === 'object' &&
               typeof received.phase === 'string' &&
               validPhases.includes(received.phase) &&
               Array.isArray(received.players) &&
               Array.isArray(received.raceResults);
  
  if (pass) {
    return {
      message: () => `expected object not to have valid game state`,
      pass: true,
    };
  } else {
    return {
      message: () => `expected object to have valid game state with phase (valid string), players (array), and raceResults (array)`,
      pass: false,
    };
  }
}

/**
 * Matcher to check if a UI panel has proper initialization
 */
function toBeInitializedUIPanel(received) {
  const pass = received && 
               typeof received === 'object' &&
               typeof received.initialize === 'function' &&
               typeof received.show === 'function' &&
               typeof received.hide === 'function' &&
               typeof received.toggle === 'function' &&
               typeof received.destroy === 'function';
  
  if (pass) {
    return {
      message: () => `expected object not to be an initialized UI panel`,
      pass: true,
    };
  } else {
    return {
      message: () => `expected object to be an initialized UI panel with initialize, show, hide, toggle, and destroy methods`,
      pass: false,
    };
  }
}

/**
 * Matcher to check if multiplayer manager has proper connection state
 */
function toHaveValidConnectionState(received) {
  const pass = received && 
               typeof received === 'object' &&
               typeof received.isConnected === 'boolean' &&
               typeof received.connect === 'function' &&
               typeof received.disconnect === 'function' &&
               Array.isArray(received.players);
  
  if (pass) {
    return {
      message: () => `expected object not to have valid connection state`,
      pass: true,
    };
  } else {
    return {
      message: () => `expected object to have valid connection state with isConnected (boolean), connect/disconnect functions, and players array`,
      pass: false,
    };
  }
}

/**
 * Matcher to check if Socket.IO socket is properly mocked
 */
function toBeMockSocket(received) {
  const pass = received && 
               typeof received === 'object' &&
               typeof received.emit === 'function' &&
               typeof received.on === 'function' &&
               typeof received.off === 'function' &&
               typeof received.connected === 'boolean';
  
  if (pass) {
    return {
      message: () => `expected object not to be a mock socket`,
      pass: true,
    };
  } else {
    return {
      message: () => `expected object to be a mock socket with emit, on, off functions and connected boolean`,
      pass: false,
    };
  }
}

// Register all custom matchers with Jest
expect.extend({
  toHaveClass,
  toBeVisible,
  toBeHidden,
  toBePhaserGameObject,
  toBePhaserScene,
  toHaveValidBettingState,
  toBeValidPlayer,
  toHaveValidGameState,
  toBeInitializedUIPanel,
  toHaveValidConnectionState,
  toBeMockSocket,
});

// Export matchers for potential direct use
module.exports = {
  toHaveClass,
  toBeVisible,
  toBeHidden,
  toBePhaserGameObject,
  toBePhaserScene,
  toHaveValidBettingState,
  toBeValidPlayer,
  toHaveValidGameState,
  toBeInitializedUIPanel,
  toHaveValidConnectionState,
  toBeMockSocket,
};