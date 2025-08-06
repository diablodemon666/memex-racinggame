/**
 * Animation System Index
 * Export all animation-related modules and utilities
 */

export { AnimationManager, getAnimationManager, animations } from './AnimationManager';

// Re-export common animation utilities for convenience
export const AnimationUtils = {
    // Duration constants
    DURATION: {
        INSTANT: 0,
        FAST: 200,
        NORMAL: 300,
        SLOW: 500,
        VERY_SLOW: 1000
    },
    
    // Common easing names
    EASING: {
        LINEAR: 'linear',
        EASE_IN: 'easeInQuad',
        EASE_OUT: 'easeOutQuad',
        EASE_IN_OUT: 'easeInOutQuad',
        EASE_IN_CUBIC: 'easeInCubic',
        EASE_OUT_CUBIC: 'easeOutCubic',
        EASE_IN_OUT_CUBIC: 'easeInOutCubic',
        BOUNCE: 'bounceOut',
        ELASTIC: 'elasticOut',
        BACK: 'easeOutBack'
    },
    
    // Animation presets for game events
    GAME_ANIMATIONS: {
        RACE_START: 'bounceIn',
        RACE_FINISH: 'zoomIn',
        POWER_UP_COLLECT: 'pulse',
        PLAYER_HIT: 'shake',
        COUNTDOWN: 'zoomIn',
        WINNER_CELEBRATION: 'rubberBand'
    }
};