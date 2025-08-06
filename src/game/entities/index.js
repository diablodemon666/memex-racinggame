/**
 * Game Entities Index
 * 
 * Exports all game entities for easy importing throughout the application.
 */

export { Player } from './Player.js';
export { Booster } from './Booster.js';
export { Skill } from './Skill.js';
export { MToken } from './MToken.js';
export { PowerUpManager, PowerUpEffect, PowerUpEffectType, PowerUpState, PowerUpValidationResult, SpeedBoostEffect, ParalysisEffect, RainbowBoostEffect } from './PowerUpManager.js';

// Import for internal use in factory
import { PowerUpManager } from './PowerUpManager.js';

// Entity factory functions for convenience
export const EntityFactory = {
  /**
   * Create a player entity
   */
  createPlayer(scene, x, y, texture, frame, config = {}) {
    return new Player(scene, x, y, texture, frame, config);
  },

  /**
   * Create a booster entity
   */
  createBooster(scene, x, y, config = {}) {
    return new Booster(scene, x, y, config);
  },

  /**
   * Create a skill entity
   */
  createSkill(scene, x, y, config = {}) {
    return new Skill(scene, x, y, config);
  },

  /**
   * Create an M Token entity
   */
  createMToken(scene, x, y, config = {}) {
    return new MToken(scene, x, y, config);
  },

  /**
   * Create booster at random position
   */
  createRandomBooster(scene, physicsManager, config = {}) {
    return Booster.createAtRandomPosition(scene, physicsManager, config);
  },

  /**
   * Create skill at random position
   */
  createRandomSkill(scene, physicsManager, config = {}) {
    return Skill.createAtRandomPosition(scene, physicsManager, config);
  },

  /**
   * Create M Token at farthest position from start
   */
  createMTokenAtFarthestPosition(scene, startPosition, physicsManager, config = {}) {
    return MToken.createAtFarthestPosition(scene, startPosition, physicsManager, config);
  },

  /**
   * Create a PowerUpManager instance
   */
  createPowerUpManager(scene, config = {}) {
    return new PowerUpManager(scene, config);
  }
};

// Entity type constants
export const EntityTypes = {
  PLAYER: 'player',
  BOOSTER: 'booster',
  SKILL: 'skill',
  MTOKEN: 'mtoken'
};

// Entity state constants
export const EntityStates = {
  ACTIVE: 'active',
  COLLECTED: 'collected',
  EXPIRED: 'expired',
  DESTROYED: 'destroyed'
};

// Booster type constants
export const BoosterTypes = {
  ANTENNA_BOOSTER: 'antenna_booster',
  TWITTER_POST: 'twitter_post',
  MEMEX_TAG: 'memex_tag',
  POO: 'poo',
  TOILET_PAPER: 'toilet_paper',
  TOILET: 'toilet',
  BANANA: 'banana',
  KING_KONG: 'king_kong'
};

// Skill type constants
export const SkillTypes = {
  THUNDER: 'thunder',
  FIRE: 'fire',
  BUBBLE_PROTECTION: 'bubble_protection',
  MAGNETIZED_SHOES: 'magnetized_shoes',
  RANDOM_TELEPORT_TWITCH: 'random_teleport_twitch'
};

// Rarity constants
export const Rarities = {
  COMMON: 'common',
  UNCOMMON: 'uncommon',
  RARE: 'rare',
  LEGENDARY: 'legendary'
};