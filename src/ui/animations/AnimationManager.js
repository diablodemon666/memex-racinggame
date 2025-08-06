/**
 * AnimationManager.js - Centralized UI Animation System
 * 
 * Provides a comprehensive animation framework for UI elements with:
 * - Panel transitions (slide, fade, zoom, bounce)
 * - Element animations (shake, pulse, glow, spin)
 * - Sequential and parallel animation chains
 * - Easing functions and custom curves
 * - Performance optimization with requestAnimationFrame
 * - Memory management and cleanup
 */

export class AnimationManager {
    constructor() {
        this.activeAnimations = new Map();
        this.animationQueue = new Map();
        this.easingFunctions = this.initializeEasingFunctions();
        this.presets = this.initializePresets();
        this.frameCallbacks = new Set();
        this.isRunning = false;
        
        // Performance optimization
        this.frameId = null;
        this.lastFrameTime = 0;
        this.targetFPS = 60;
        this.frameInterval = 1000 / this.targetFPS;
        
        // Animation state tracking
        this.animationCounter = 0;
        this.completedAnimations = new Set();
        
        console.log('[AnimationManager] Initialized');
    }

    /**
     * Initialize easing functions for smooth animations
     */
    initializeEasingFunctions() {
        return {
            linear: t => t,
            easeInQuad: t => t * t,
            easeOutQuad: t => t * (2 - t),
            easeInOutQuad: t => t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t,
            easeInCubic: t => t * t * t,
            easeOutCubic: t => (--t) * t * t + 1,
            easeInOutCubic: t => t < 0.5 ? 4 * t * t * t : (t - 1) * (2 * t - 2) * (2 * t - 2) + 1,
            easeInQuart: t => t * t * t * t,
            easeOutQuart: t => 1 - (--t) * t * t * t,
            easeInOutQuart: t => t < 0.5 ? 8 * t * t * t * t : 1 - 8 * (--t) * t * t * t,
            easeInQuint: t => t * t * t * t * t,
            easeOutQuint: t => 1 + (--t) * t * t * t * t,
            easeInOutQuint: t => t < 0.5 ? 16 * t * t * t * t * t : 1 + 16 * (--t) * t * t * t * t,
            easeInSine: t => 1 - Math.cos(t * Math.PI / 2),
            easeOutSine: t => Math.sin(t * Math.PI / 2),
            easeInOutSine: t => -(Math.cos(Math.PI * t) - 1) / 2,
            easeInExpo: t => t === 0 ? 0 : Math.pow(2, 10 * t - 10),
            easeOutExpo: t => t === 1 ? 1 : 1 - Math.pow(2, -10 * t),
            easeInOutExpo: t => {
                if (t === 0) return 0;
                if (t === 1) return 1;
                if (t < 0.5) return Math.pow(2, 20 * t - 10) / 2;
                return (2 - Math.pow(2, -20 * t + 10)) / 2;
            },
            easeInCirc: t => 1 - Math.sqrt(1 - Math.pow(t, 2)),
            easeOutCirc: t => Math.sqrt(1 - Math.pow(t - 1, 2)),
            easeInOutCirc: t => {
                if (t < 0.5) return (1 - Math.sqrt(1 - Math.pow(2 * t, 2))) / 2;
                return (Math.sqrt(1 - Math.pow(-2 * t + 2, 2)) + 1) / 2;
            },
            easeInBack: t => {
                const c1 = 1.70158;
                const c3 = c1 + 1;
                return c3 * t * t * t - c1 * t * t;
            },
            easeOutBack: t => {
                const c1 = 1.70158;
                const c3 = c1 + 1;
                return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
            },
            easeInOutBack: t => {
                const c1 = 1.70158;
                const c2 = c1 * 1.525;
                if (t < 0.5) return (Math.pow(2 * t, 2) * ((c2 + 1) * 2 * t - c2)) / 2;
                return (Math.pow(2 * t - 2, 2) * ((c2 + 1) * (t * 2 - 2) + c2) + 2) / 2;
            },
            elasticOut: t => {
                const c4 = (2 * Math.PI) / 3;
                if (t === 0) return 0;
                if (t === 1) return 1;
                return Math.pow(2, -10 * t) * Math.sin((t * 10 - 0.75) * c4) + 1;
            },
            bounceOut: t => {
                const n1 = 7.5625;
                const d1 = 2.75;
                if (t < 1 / d1) return n1 * t * t;
                if (t < 2 / d1) return n1 * (t -= 1.5 / d1) * t + 0.75;
                if (t < 2.5 / d1) return n1 * (t -= 2.25 / d1) * t + 0.9375;
                return n1 * (t -= 2.625 / d1) * t + 0.984375;
            }
        };
    }

    /**
     * Initialize animation presets for common UI patterns
     */
    initializePresets() {
        return {
            // Panel transitions
            fadeIn: {
                properties: { opacity: [0, 1] },
                duration: 300,
                easing: 'easeOutQuad'
            },
            fadeOut: {
                properties: { opacity: [1, 0] },
                duration: 300,
                easing: 'easeInQuad'
            },
            slideInLeft: {
                properties: { 
                    transform: ['translateX(-100%)', 'translateX(0)'],
                    opacity: [0, 1]
                },
                duration: 400,
                easing: 'easeOutCubic'
            },
            slideInRight: {
                properties: { 
                    transform: ['translateX(100%)', 'translateX(0)'],
                    opacity: [0, 1]
                },
                duration: 400,
                easing: 'easeOutCubic'
            },
            slideInTop: {
                properties: { 
                    transform: ['translateY(-100%)', 'translateY(0)'],
                    opacity: [0, 1]
                },
                duration: 400,
                easing: 'easeOutCubic'
            },
            slideInBottom: {
                properties: { 
                    transform: ['translateY(100%)', 'translateY(0)'],
                    opacity: [0, 1]
                },
                duration: 400,
                easing: 'easeOutCubic'
            },
            slideOutLeft: {
                properties: { 
                    transform: ['translateX(0)', 'translateX(-100%)'],
                    opacity: [1, 0]
                },
                duration: 400,
                easing: 'easeInCubic'
            },
            slideOutRight: {
                properties: { 
                    transform: ['translateX(0)', 'translateX(100%)'],
                    opacity: [1, 0]
                },
                duration: 400,
                easing: 'easeInCubic'
            },
            zoomIn: {
                properties: { 
                    transform: ['scale(0)', 'scale(1)'],
                    opacity: [0, 1]
                },
                duration: 350,
                easing: 'easeOutBack'
            },
            zoomOut: {
                properties: { 
                    transform: ['scale(1)', 'scale(0)'],
                    opacity: [1, 0]
                },
                duration: 350,
                easing: 'easeInBack'
            },
            bounceIn: {
                properties: { 
                    transform: ['scale(0.3)', 'scale(1)'],
                    opacity: [0, 1]
                },
                duration: 600,
                easing: 'elasticOut'
            },
            
            // Element animations
            shake: {
                properties: { 
                    transform: [
                        'translateX(0)',
                        'translateX(-10px)',
                        'translateX(10px)',
                        'translateX(-10px)',
                        'translateX(10px)',
                        'translateX(0)'
                    ]
                },
                duration: 500,
                easing: 'linear'
            },
            pulse: {
                properties: { 
                    transform: ['scale(1)', 'scale(1.05)', 'scale(1)']
                },
                duration: 1000,
                easing: 'easeInOutSine',
                loop: true
            },
            glow: {
                properties: { 
                    boxShadow: [
                        '0 0 10px rgba(0, 255, 0, 0.3)',
                        '0 0 30px rgba(0, 255, 0, 0.8)',
                        '0 0 10px rgba(0, 255, 0, 0.3)'
                    ]
                },
                duration: 2000,
                easing: 'easeInOutSine',
                loop: true
            },
            spin: {
                properties: { 
                    transform: ['rotate(0deg)', 'rotate(360deg)']
                },
                duration: 1000,
                easing: 'linear',
                loop: true
            },
            flash: {
                properties: { 
                    opacity: [1, 0, 1, 0, 1]
                },
                duration: 500,
                easing: 'linear'
            },
            rubberBand: {
                properties: { 
                    transform: [
                        'scale(1)',
                        'scale(1.25, 0.75)',
                        'scale(0.75, 1.25)',
                        'scale(1.15, 0.85)',
                        'scale(0.95, 1.05)',
                        'scale(1.05, 0.95)',
                        'scale(1)'
                    ]
                },
                duration: 1000,
                easing: 'easeInOutQuad'
            },
            
            // Special effects
            typewriter: {
                properties: { width: ['0', '100%'] },
                duration: 2000,
                easing: 'linear',
                additionalStyles: {
                    overflow: 'hidden',
                    whiteSpace: 'nowrap',
                    borderRight: '2px solid #00ff00'
                }
            },
            glitch: {
                properties: { 
                    transform: [
                        'translateX(0)',
                        'translateX(2px)',
                        'translateX(-2px)',
                        'translateX(2px)',
                        'translateX(0)'
                    ],
                    filter: [
                        'hue-rotate(0deg)',
                        'hue-rotate(90deg)',
                        'hue-rotate(-90deg)',
                        'hue-rotate(0deg)'
                    ]
                },
                duration: 200,
                easing: 'linear'
            },
            matrixRain: {
                properties: { 
                    background: [
                        'linear-gradient(0deg, transparent, #00ff00)',
                        'linear-gradient(180deg, transparent, #00ff00)'
                    ],
                    opacity: [0.7, 1, 0.7]
                },
                duration: 3000,
                easing: 'linear',
                loop: true
            }
        };
    }

    /**
     * Animate an element with specified properties
     * @param {HTMLElement} element - Element to animate
     * @param {Object} options - Animation options
     * @returns {Promise} Animation completion promise
     */
    animate(element, options = {}) {
        return new Promise((resolve, reject) => {
            if (!element) {
                reject(new Error('Element is required for animation'));
                return;
            }

            const animationId = `anim_${++this.animationCounter}`;
            const startTime = performance.now();
            
            // Parse options
            const {
                properties = {},
                duration = 300,
                easing = 'easeOutQuad',
                delay = 0,
                loop = false,
                loopCount = Infinity,
                onUpdate = null,
                onComplete = null,
                additionalStyles = {}
            } = options;

            // Get easing function
            const easingFunc = typeof easing === 'function' 
                ? easing 
                : this.easingFunctions[easing] || this.easingFunctions.linear;

            // Store initial values
            const initialValues = {};
            const targetValues = {};
            const isKeyframe = {};

            // Process properties
            Object.entries(properties).forEach(([prop, value]) => {
                if (Array.isArray(value)) {
                    // Keyframe animation
                    isKeyframe[prop] = true;
                    initialValues[prop] = value[0];
                    targetValues[prop] = value;
                } else {
                    // Simple animation
                    initialValues[prop] = this.getStyleValue(element, prop);
                    targetValues[prop] = value;
                }
            });

            // Apply additional styles
            Object.entries(additionalStyles).forEach(([prop, value]) => {
                element.style[prop] = value;
            });

            // Animation state
            const animationState = {
                element,
                properties,
                initialValues,
                targetValues,
                isKeyframe,
                duration,
                easingFunc,
                delay,
                loop,
                loopCount,
                currentLoop: 0,
                startTime: startTime + delay,
                onUpdate,
                onComplete,
                resolve,
                reject,
                isPaused: false,
                pausedTime: 0
            };

            // Store animation
            this.activeAnimations.set(animationId, animationState);

            // Start animation loop if not running
            if (!this.isRunning) {
                this.startAnimationLoop();
            }
        });
    }

    /**
     * Animate using a preset
     * @param {HTMLElement} element - Element to animate
     * @param {string} presetName - Name of the preset
     * @param {Object} overrides - Override preset options
     * @returns {Promise} Animation completion promise
     */
    animatePreset(element, presetName, overrides = {}) {
        const preset = this.presets[presetName];
        if (!preset) {
            console.error(`[AnimationManager] Preset '${presetName}' not found`);
            return Promise.reject(new Error(`Preset '${presetName}' not found`));
        }

        const options = { ...preset, ...overrides };
        return this.animate(element, options);
    }

    /**
     * Chain multiple animations sequentially
     * @param {Array} animations - Array of animation configurations
     * @returns {Promise} Chain completion promise
     */
    async chain(animations) {
        for (const anim of animations) {
            await this.animate(anim.element, anim.options);
        }
    }

    /**
     * Run multiple animations in parallel
     * @param {Array} animations - Array of animation configurations
     * @returns {Promise} Parallel completion promise
     */
    parallel(animations) {
        const promises = animations.map(anim => 
            this.animate(anim.element, anim.options)
        );
        return Promise.all(promises);
    }

    /**
     * Stagger animations across multiple elements
     * @param {NodeList|Array} elements - Elements to animate
     * @param {Object} options - Animation options
     * @param {number} staggerDelay - Delay between each element
     * @returns {Promise} Stagger completion promise
     */
    stagger(elements, options, staggerDelay = 50) {
        const animations = Array.from(elements).map((element, index) => ({
            element,
            options: { ...options, delay: (options.delay || 0) + (index * staggerDelay) }
        }));
        return this.parallel(animations);
    }

    /**
     * Main animation loop
     */
    startAnimationLoop() {
        if (this.isRunning) return;
        
        this.isRunning = true;
        
        const animate = (currentTime) => {
            if (!this.isRunning) return;

            // Throttle to target FPS
            const deltaTime = currentTime - this.lastFrameTime;
            if (deltaTime < this.frameInterval) {
                this.frameId = requestAnimationFrame(animate);
                return;
            }

            this.lastFrameTime = currentTime - (deltaTime % this.frameInterval);

            // Process active animations
            const completedAnimations = [];
            
            this.activeAnimations.forEach((state, animationId) => {
                if (state.isPaused) return;

                const elapsed = currentTime - state.startTime;
                
                if (elapsed < 0) return; // Still in delay phase

                let progress = Math.min(elapsed / state.duration, 1);
                
                // Apply easing
                const easedProgress = state.easingFunc(progress);

                // Update properties
                Object.entries(state.properties).forEach(([prop, value]) => {
                    if (state.isKeyframe[prop]) {
                        // Keyframe animation
                        const keyframes = state.targetValues[prop];
                        const segmentCount = keyframes.length - 1;
                        const segmentDuration = 1 / segmentCount;
                        const currentSegment = Math.floor(easedProgress * segmentCount);
                        const segmentProgress = (easedProgress % segmentDuration) / segmentDuration;
                        
                        if (currentSegment < segmentCount) {
                            const from = keyframes[currentSegment];
                            const to = keyframes[currentSegment + 1];
                            const interpolated = this.interpolateValue(from, to, segmentProgress);
                            this.setStyleValue(state.element, prop, interpolated);
                        } else {
                            this.setStyleValue(state.element, prop, keyframes[keyframes.length - 1]);
                        }
                    } else {
                        // Simple animation
                        const interpolated = this.interpolateValue(
                            state.initialValues[prop],
                            state.targetValues[prop],
                            easedProgress
                        );
                        this.setStyleValue(state.element, prop, interpolated);
                    }
                });

                // Call update callback
                if (state.onUpdate) {
                    state.onUpdate(easedProgress, state.element);
                }

                // Check if animation is complete
                if (progress >= 1) {
                    if (state.loop && state.currentLoop < state.loopCount - 1) {
                        // Loop animation
                        state.currentLoop++;
                        state.startTime = currentTime;
                    } else {
                        // Animation complete
                        completedAnimations.push(animationId);
                        if (state.onComplete) {
                            state.onComplete(state.element);
                        }
                        state.resolve();
                    }
                }
            });

            // Remove completed animations
            completedAnimations.forEach(id => {
                this.activeAnimations.delete(id);
                this.completedAnimations.add(id);
            });

            // Continue loop if animations are active
            if (this.activeAnimations.size > 0) {
                this.frameId = requestAnimationFrame(animate);
            } else {
                this.stopAnimationLoop();
            }
        };

        this.frameId = requestAnimationFrame(animate);
    }

    /**
     * Stop animation loop
     */
    stopAnimationLoop() {
        this.isRunning = false;
        if (this.frameId) {
            cancelAnimationFrame(this.frameId);
            this.frameId = null;
        }
    }

    /**
     * Get computed style value
     */
    getStyleValue(element, property) {
        const computed = window.getComputedStyle(element);
        return computed[property] || element.style[property] || '0';
    }

    /**
     * Set style value
     */
    setStyleValue(element, property, value) {
        element.style[property] = value;
    }

    /**
     * Interpolate between two values
     */
    interpolateValue(from, to, progress) {
        // Handle numeric values
        const fromNum = parseFloat(from);
        const toNum = parseFloat(to);
        
        if (!isNaN(fromNum) && !isNaN(toNum)) {
            const interpolated = fromNum + (toNum - fromNum) * progress;
            
            // Preserve units
            const fromUnit = from.toString().replace(/[0-9.-]/g, '');
            const toUnit = to.toString().replace(/[0-9.-]/g, '');
            const unit = fromUnit || toUnit || '';
            
            return interpolated + unit;
        }
        
        // Handle color values
        if (from.includes('rgb') || to.includes('rgb')) {
            return this.interpolateColor(from, to, progress);
        }
        
        // Handle transform values
        if (from.includes('(') && to.includes('(')) {
            return this.interpolateTransform(from, to, progress);
        }
        
        // Fallback to discrete transition
        return progress < 0.5 ? from : to;
    }

    /**
     * Interpolate color values
     */
    interpolateColor(from, to, progress) {
        const parseRGB = (color) => {
            const match = color.match(/\d+/g);
            return match ? match.map(Number) : [0, 0, 0];
        };
        
        const fromRGB = parseRGB(from);
        const toRGB = parseRGB(to);
        
        const r = Math.round(fromRGB[0] + (toRGB[0] - fromRGB[0]) * progress);
        const g = Math.round(fromRGB[1] + (toRGB[1] - fromRGB[1]) * progress);
        const b = Math.round(fromRGB[2] + (toRGB[2] - fromRGB[2]) * progress);
        
        return `rgb(${r}, ${g}, ${b})`;
    }

    /**
     * Interpolate transform values
     */
    interpolateTransform(from, to, progress) {
        const extractValue = (transform) => {
            const match = transform.match(/\((.*?)\)/);
            return match ? match[1] : '0';
        };
        
        const extractFunction = (transform) => {
            const match = transform.match(/^(\w+)/);
            return match ? match[1] : '';
        };
        
        const func = extractFunction(from) || extractFunction(to);
        const fromValue = extractValue(from);
        const toValue = extractValue(to);
        
        const interpolated = this.interpolateValue(fromValue, toValue, progress);
        return `${func}(${interpolated})`;
    }

    /**
     * Pause an animation
     */
    pauseAnimation(animationId) {
        const animation = this.activeAnimations.get(animationId);
        if (animation) {
            animation.isPaused = true;
            animation.pausedTime = performance.now();
        }
    }

    /**
     * Resume an animation
     */
    resumeAnimation(animationId) {
        const animation = this.activeAnimations.get(animationId);
        if (animation && animation.isPaused) {
            const pauseDuration = performance.now() - animation.pausedTime;
            animation.startTime += pauseDuration;
            animation.isPaused = false;
            
            if (!this.isRunning) {
                this.startAnimationLoop();
            }
        }
    }

    /**
     * Stop an animation
     */
    stopAnimation(animationId) {
        const animation = this.activeAnimations.get(animationId);
        if (animation) {
            this.activeAnimations.delete(animationId);
            animation.reject(new Error('Animation stopped'));
        }
    }

    /**
     * Stop all animations
     */
    stopAllAnimations() {
        this.activeAnimations.forEach((animation, id) => {
            this.stopAnimation(id);
        });
        this.stopAnimationLoop();
    }

    /**
     * Get animation statistics
     */
    getStats() {
        return {
            activeAnimations: this.activeAnimations.size,
            completedAnimations: this.completedAnimations.size,
            isRunning: this.isRunning,
            targetFPS: this.targetFPS
        };
    }

    /**
     * Clean up and destroy
     */
    destroy() {
        this.stopAllAnimations();
        this.activeAnimations.clear();
        this.animationQueue.clear();
        this.completedAnimations.clear();
        this.frameCallbacks.clear();
        console.log('[AnimationManager] Destroyed');
    }
}

// Singleton instance
let animationManagerInstance = null;

/**
 * Get or create AnimationManager instance
 */
export function getAnimationManager() {
    if (!animationManagerInstance) {
        animationManagerInstance = new AnimationManager();
    }
    return animationManagerInstance;
}

// Export helper functions for common animations
export const animations = {
    /**
     * Show element with animation
     */
    show: (element, preset = 'fadeIn', options = {}) => {
        element.style.display = 'block';
        return getAnimationManager().animatePreset(element, preset, options);
    },
    
    /**
     * Hide element with animation
     */
    hide: async (element, preset = 'fadeOut', options = {}) => {
        await getAnimationManager().animatePreset(element, preset, options);
        element.style.display = 'none';
    },
    
    /**
     * Attention-seeking animation
     */
    attention: (element, type = 'pulse') => {
        return getAnimationManager().animatePreset(element, type);
    },
    
    /**
     * Error feedback animation
     */
    error: (element) => {
        return getAnimationManager().animatePreset(element, 'shake', {
            duration: 300,
            onComplete: () => {
                element.style.borderColor = '#ff0000';
                setTimeout(() => {
                    element.style.borderColor = '';
                }, 1000);
            }
        });
    },
    
    /**
     * Success feedback animation
     */
    success: (element) => {
        return getAnimationManager().animatePreset(element, 'bounceIn', {
            duration: 500,
            onComplete: () => {
                element.style.borderColor = '#00ff00';
                element.style.boxShadow = '0 0 20px rgba(0, 255, 0, 0.8)';
                setTimeout(() => {
                    element.style.borderColor = '';
                    element.style.boxShadow = '';
                }, 2000);
            }
        });
    }
};

export default AnimationManager;