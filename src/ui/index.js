/**
 * UI Module Index - Memex Racing
 * 
 * Exports all UI components and utilities for the racing game interface.
 * Provides a unified entry point for UI system initialization and management.
 */

// Import CSS styles
import './styles/game-ui.css';

// Main UI Manager
export { UIManager, createUIManager, getUIManager } from './UIManager';

// UI Components
export { InviteModal } from './components/InviteModal';
export { BettingPanel } from './components/BettingPanel';
export { LeaderboardPanel } from './components/LeaderboardPanel';
export { PlayerSetupPanel } from './components/PlayerSetupPanel';
export { PresetManager } from './components/PresetManager';
export { TrackEditor } from './components/TrackEditor';
export { TrackPreview } from './components/TrackPreview';

// UI Utilities and helpers
export const UI_CONSTANTS = {
    // Panel positions
    PANELS: {
        PLAYER_INFO: 'player-info',
        PLAYER_SETUP: 'player-setup',
        BETTING: 'betting',
        LEADERBOARD: 'leaderboard',
        DEBUG: 'debug',
        INVITE: 'invite',
        PRESET_MANAGER: 'preset-manager',
        TRACK_EDITOR: 'track-editor',
        TRACK_PREVIEW: 'track-preview'
    },
    
    // Keyboard shortcuts
    SHORTCUTS: {
        INVITE: 'KeyI',
        PLAYER_SETUP: 'KeyP',
        BETTING: 'KeyB',
        LEADERBOARD: 'KeyL',
        DEBUG: 'KeyD',
        PRESET_MANAGER: 'KeyR',
        TRACK_EDITOR: 'KeyE',
        ESCAPE: 'Escape'
    },
    
    // Animation durations
    ANIMATIONS: {
        PANEL_TRANSITION: 300,
        NOTIFICATION_DURATION: 3000,
        COUNTDOWN_URGENT_THRESHOLD: 10,
        COUNTDOWN_WARNING_THRESHOLD: 20
    },
    
    // Colors (matching CSS)
    COLORS: {
        PRIMARY: '#00ff00',
        BACKGROUND: '#000000',
        WARNING: '#ffff00',
        ERROR: '#ff0000',
        SUCCESS: '#00ff00',
        INFO: '#00ffff'
    }
};

/**
 * Initialize the complete UI system
 * @param {Phaser.Game} game - The Phaser game instance
 * @returns {Promise<UIManager>} The initialized UI manager
 */
export async function initializeUI(game) {
    const uiManager = createUIManager(game);
    await uiManager.initialize();
    return uiManager;
}

/**
 * UI Event Types for communication between UI components and game
 */
export const UI_EVENTS = {
    // Panel events
    PANEL_OPENED: 'ui:panel:opened',
    PANEL_CLOSED: 'ui:panel:closed',
    
    // Betting events
    BET_PLACED: 'ui:bet:placed',
    BET_CLEARED: 'ui:bet:cleared',
    BETTING_PHASE_STARTED: 'ui:betting:started',
    BETTING_PHASE_ENDED: 'ui:betting:ended',
    
    // Invite events
    ROOM_CODE_COPIED: 'ui:invite:code_copied',
    SHARE_LINK_COPIED: 'ui:invite:link_copied',
    SOCIAL_SHARE_CLICKED: 'ui:invite:social_share',
    
    // Leaderboard events
    LEADERBOARD_UPDATED: 'ui:leaderboard:updated',
    LEADERBOARD_SORTED: 'ui:leaderboard:sorted',
    
    // Player Setup events
    PLAYER_NAME_CHANGED: 'ui:player:name_changed',
    PLAYER_IMAGE_UPLOADED: 'ui:player:image_uploaded',
    PLAYER_JOINED_RACE: 'ui:player:joined_race',
    PLAYER_SWITCHED: 'ui:player:switched',
    
    // Preset Manager events
    PRESET_CREATED: 'ui:preset:created',
    PRESET_LOADED: 'ui:preset:loaded',
    PRESET_DELETED: 'ui:preset:deleted',
    PRESET_IMPORTED: 'ui:preset:imported',
    PRESET_EXPORTED: 'ui:preset:exported',
    
    // Track Editor events
    TRACK_EDITOR_OPENED: 'ui:track_editor:opened',
    TRACK_EDITOR_CLOSED: 'ui:track_editor:closed',
    TRACK_SAVED: 'ui:track:saved',
    TRACK_LOADED: 'ui:track:loaded',
    TRACK_CLEARED: 'ui:track:cleared',
    TRACK_EXPORTED: 'ui:track:exported',
    
    // Track Preview events
    TRACK_PREVIEW_OPENED: 'ui:track_preview:opened',
    TRACK_PREVIEW_CLOSED: 'ui:track_preview:closed',
    TRACK_PREVIEW_STARTED: 'ui:track_preview:started',
    TRACK_PREVIEW_STOPPED: 'ui:track_preview:stopped',
    TRACK_VALIDATION_UPDATED: 'ui:track:validation_updated',
    
    // General UI events
    NOTIFICATION_SHOWN: 'ui:notification:shown',
    KEYBOARD_SHORTCUT_PRESSED: 'ui:shortcut:pressed'
};

/**
 * UI State Management
 * Centralized state for UI components
 */
export class UIState {
    constructor() {
        this.state = {
            isInitialized: false,
            currentGameState: 'menu',
            visiblePanels: new Set(),
            activeModals: new Set(),
            notifications: [],
            gameData: {
                currentUser: null,
                roomCode: null,
                players: [],
                raceResults: [],
                bettingPhase: false,
                raceTimer: 0
            }
        };
        
        this.listeners = new Map();
    }
    
    /**
     * Subscribe to state changes
     */
    subscribe(callback) {
        const id = Date.now().toString();
        this.listeners.set(id, callback);
        return () => this.listeners.delete(id);
    }
    
    /**
     * Update state and notify listeners
     */
    updateState(updates) {
        const oldState = { ...this.state };
        this.state = { ...this.state, ...updates };
        
        // Notify listeners
        this.listeners.forEach(callback => {
            try {
                callback(this.state, oldState);
            } catch (error) {
                console.error('[UIState] Error in state listener:', error);
            }
        });
    }
    
    /**
     * Get current state
     */
    getState() {
        return { ...this.state };
    }
    
    /**
     * Update game data
     */
    updateGameData(gameData) {
        this.updateState({
            gameData: { ...this.state.gameData, ...gameData }
        });
    }
    
    /**
     * Set panel visibility
     */
    setPanelVisible(panelName, visible) {
        const visiblePanels = new Set(this.state.visiblePanels);
        if (visible) {
            visiblePanels.add(panelName);
        } else {
            visiblePanels.delete(panelName);
        }
        this.updateState({ visiblePanels });
    }
    
    /**
     * Set modal active state
     */
    setModalActive(modalName, active) {
        const activeModals = new Set(this.state.activeModals);
        if (active) {
            activeModals.add(modalName);
        } else {
            activeModals.delete(modalName);
        }
        this.updateState({ activeModals });
    }
    
    /**
     * Add notification
     */
    addNotification(notification) {
        const notifications = [...this.state.notifications, {
            id: Date.now().toString(),
            timestamp: Date.now(),
            ...notification
        }];
        
        // Keep only last 10 notifications
        if (notifications.length > 10) {
            notifications.splice(0, notifications.length - 10);
        }
        
        this.updateState({ notifications });
    }
    
    /**
     * Clear notifications
     */
    clearNotifications() {
        this.updateState({ notifications: [] });
    }
}

// Global UI state instance
export const uiState = new UIState();

/**
 * UI Utility Functions
 */
export const UIUtils = {
    /**
     * Format time for display (seconds to MM:SS)
     */
    formatTime(seconds) {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    },
    
    /**
     * Format currency for display
     */
    formatCurrency(amount) {
        return `$${amount.toLocaleString()}`;
    },
    
    /**
     * Format percentage for display
     */
    formatPercentage(value, decimals = 1) {
        return `${value.toFixed(decimals)}%`;
    },
    
    /**
     * Get relative time string (e.g., "2 minutes ago")
     */
    getRelativeTime(timestamp) {
        const now = Date.now();
        const diff = now - timestamp;
        
        if (diff < 60000) return 'Just now';
        if (diff < 3600000) return `${Math.floor(diff / 60000)} min ago`;
        if (diff < 86400000) return `${Math.floor(diff / 3600000)} hours ago`;
        return `${Math.floor(diff / 86400000)} days ago`;
    },
    
    /**
     * Generate a random room code
     */
    generateRoomCode() {
        const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
        let result = 'RACE-';
        for (let i = 0; i < 4; i++) {
            result += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        return result;
    },
    
    /**
     * Validate room code format
     */
    isValidRoomCode(code) {
        return /^RACE-[A-Z0-9]{4}$/.test(code);
    },
    
    /**
     * Copy text to clipboard
     */
    async copyToClipboard(text) {
        try {
            await navigator.clipboard.writeText(text);
            return true;
        } catch (error) {
            console.error('Failed to copy to clipboard:', error);
            return false;
        }
    },
    
    /**
     * Show browser notification (if permitted)
     */
    async showBrowserNotification(title, options = {}) {
        if (!('Notification' in window)) {
            return false;
        }
        
        if (Notification.permission === 'granted') {
            new Notification(title, {
                icon: '/favicon.ico',
                badge: '/favicon.ico',
                ...options
            });
            return true;
        } else if (Notification.permission !== 'denied') {
            const permission = await Notification.requestPermission();
            if (permission === 'granted') {
                new Notification(title, {
                    icon: '/favicon.ico',
                    badge: '/favicon.ico',
                    ...options
                });
                return true;
            }
        }
        
        return false;
    },
    
    /**
     * Debounce function calls
     */
    debounce(func, wait) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    },
    
    /**
     * Throttle function calls
     */
    throttle(func, limit) {
        let inThrottle;
        return function executedFunction(...args) {
            if (!inThrottle) {
                func.apply(this, args);
                inThrottle = true;
                setTimeout(() => inThrottle = false, limit);
            }
        };
    }
};

/**
 * Accessibility helpers
 */
export const A11yUtils = {
    /**
     * Set focus trap for modal
     */
    trapFocus(element) {
        const focusableElements = element.querySelectorAll(
            'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        );
        
        const firstElement = focusableElements[0];
        const lastElement = focusableElements[focusableElements.length - 1];
        
        const handleTabKey = (e) => {
            if (e.key === 'Tab') {
                if (e.shiftKey) {
                    if (document.activeElement === firstElement) {
                        lastElement.focus();
                        e.preventDefault();
                    }
                } else {
                    if (document.activeElement === lastElement) {
                        firstElement.focus();
                        e.preventDefault();
                    }
                }
            }
        };
        
        element.addEventListener('keydown', handleTabKey);
        
        // Return cleanup function
        return () => {
            element.removeEventListener('keydown', handleTabKey);
        };
    },
    
    /**
     * Announce to screen readers
     */
    announce(message, priority = 'polite') {
        const announcer = document.createElement('div');
        announcer.setAttribute('aria-live', priority);
        announcer.setAttribute('aria-atomic', 'true');
        announcer.className = 'sr-only';
        announcer.textContent = message;
        
        document.body.appendChild(announcer);
        
        setTimeout(() => {
            document.body.removeChild(announcer);
        }, 1000);
    }
};

// Development helpers
if (process.env.NODE_ENV === 'development') {
    // Make UI system available globally for debugging
    window.UISystem = {
        UIManager,
        UIState,
        uiState,
        UIUtils,
        A11yUtils,
        UI_CONSTANTS,
        UI_EVENTS
    };
    
    console.log('[UI System] Development mode - UI system available at window.UISystem');
}