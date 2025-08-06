/**
 * Mock AnimationManager for testing
 */

export class AnimationManager {
  constructor() {
    this.activeAnimations = new Map();
    this.animationQueue = new Map();
    this.isRunning = false;
    this.animationCounter = 0;
  }

  animate = jest.fn().mockImplementation(() => Promise.resolve());
  animatePreset = jest.fn().mockImplementation(() => Promise.resolve());
  chain = jest.fn().mockImplementation(() => Promise.resolve());
  parallel = jest.fn().mockImplementation(() => Promise.resolve());
  stagger = jest.fn().mockImplementation(() => Promise.resolve());
  pauseAnimation = jest.fn();
  resumeAnimation = jest.fn();
  stopAnimation = jest.fn();
  stopAllAnimations = jest.fn();
  
  getStats() {
    return {
      activeAnimations: this.activeAnimations.size,
      completedAnimations: 0,
      isRunning: this.isRunning,
      targetFPS: 60
    };
  }
  
  destroy() {
    this.activeAnimations.clear();
    this.animationQueue.clear();
    this.isRunning = false;
  }
}

let mockInstance = null;

export function getAnimationManager() {
  if (!mockInstance) {
    mockInstance = new AnimationManager();
  }
  return mockInstance;
}

export const animations = {
  show: jest.fn().mockImplementation(() => Promise.resolve()),
  hide: jest.fn().mockImplementation(() => Promise.resolve()),
  attention: jest.fn().mockImplementation(() => Promise.resolve()),
  error: jest.fn().mockImplementation(() => Promise.resolve()),
  success: jest.fn().mockImplementation(() => Promise.resolve())
};

export default AnimationManager;