/**
 * CameraManager.js - Professional Camera System for Memex Racing
 * 
 * Advanced camera management system designed for streaming and content creation.
 * Provides multiple camera modes, smooth interpolation, and professional controls.
 * 
 * Key Features:
 * - Multiple camera modes (free cam, follow player, cinematic views)
 * - Smooth pan control with middle-click drag
 * - Zoom control with scroll wheel and smooth transitions
 * - Spectator presets and cinematic camera paths
 * - Professional interpolation system for smooth movements
 * - Integration with existing GameEngine and configuration system
 * - Performance optimized for 60 FPS operation
 * - Hot-reload configuration support
 */

/**
 * Camera Modes
 */
export const CameraMode = {
  FREE_CAM: 'free_cam',           // Manual camera control
  FOLLOW_PLAYER: 'follow_player',  // Follow specific player
  FOLLOW_ACTION: 'follow_action',  // Follow race action automatically
  OVERVIEW: 'overview',           // Fixed overview of entire track
  CINEMATIC: 'cinematic',         // Cinematic camera paths
  SPECTATOR_1: 'spectator_1',     // Preset spectator view 1
  SPECTATOR_2: 'spectator_2',     // Preset spectator view 2
  SPECTATOR_3: 'spectator_3',     // Preset spectator view 3
  BROADCAST: 'broadcast'          // Auto-switching broadcast mode
};

/**
 * Camera Transition Types
 */
export const TransitionType = {
  INSTANT: 'instant',
  LINEAR: 'linear',
  EASE_IN: 'ease_in',
  EASE_OUT: 'ease_out',
  EASE_IN_OUT: 'ease_in_out',
  ELASTIC: 'elastic',
  BOUNCE: 'bounce'
};

/**
 * Interpolation utility for smooth camera movements
 */
class CameraInterpolator {
  constructor() {
    this.transitions = new Map();
  }

  /**
   * Ease in-out cubic interpolation
   */
  easeInOutCubic(t) {
    return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
  }

  /**
   * Ease in cubic interpolation
   */
  easeInCubic(t) {
    return t * t * t;
  }

  /**
   * Ease out cubic interpolation
   */
  easeOutCubic(t) {
    return 1 - Math.pow(1 - t, 3);
  }

  /**
   * Elastic ease out
   */
  easeOutElastic(t) {
    const c4 = (2 * Math.PI) / 3;
    return t === 0 ? 0 : t === 1 ? 1 : Math.pow(2, -10 * t) * Math.sin((t * 10 - 0.75) * c4) + 1;
  }

  /**
   * Bounce ease out
   */
  easeOutBounce(t) {
    const n1 = 7.5625;
    const d1 = 2.75;

    if (t < 1 / d1) {
      return n1 * t * t;
    } else if (t < 2 / d1) {
      return n1 * (t -= 1.5 / d1) * t + 0.75;
    } else if (t < 2.5 / d1) {
      return n1 * (t -= 2.25 / d1) * t + 0.9375;
    } else {
      return n1 * (t -= 2.625 / d1) * t + 0.984375;
    }
  }

  /**
   * Get interpolation function by type
   */
  getEasingFunction(type) {
    switch (type) {
      case TransitionType.LINEAR:
        return (t) => t;
      case TransitionType.EASE_IN:
        return this.easeInCubic;
      case TransitionType.EASE_OUT:
        return this.easeOutCubic;
      case TransitionType.EASE_IN_OUT:
        return this.easeInOutCubic;
      case TransitionType.ELASTIC:
        return this.easeOutElastic;
      case TransitionType.BOUNCE:
        return this.easeOutBounce;
      default:
        return (t) => t;
    }
  }

  /**
   * Interpolate between two values
   */
  interpolate(start, end, progress, easingType = TransitionType.EASE_IN_OUT) {
    if (progress <= 0) return start;
    if (progress >= 1) return end;

    const easingFunc = this.getEasingFunction(easingType);
    const t = easingFunc(progress);
    
    return start + (end - start) * t;
  }

  /**
   * Interpolate between two 2D points
   */
  interpolatePoint(startPoint, endPoint, progress, easingType = TransitionType.EASE_IN_OUT) {
    return {
      x: this.interpolate(startPoint.x, endPoint.x, progress, easingType),
      y: this.interpolate(startPoint.y, endPoint.y, progress, easingType)
    };
  }
}

/**
 * Camera Bounds for constraining camera movement
 */
class CameraBounds {
  constructor(x = 0, y = 0, width = 1920, height = 1080) {
    this.x = x;
    this.y = y;
    this.width = width;
    this.height = height;
    this.enabled = true;
  }

  /**
   * Constrain point within bounds
   */
  constrain(point, cameraWidth, cameraHeight) {
    if (!this.enabled) return point;

    const minX = this.x + cameraWidth / 2;
    const maxX = this.x + this.width - cameraWidth / 2;
    const minY = this.y + cameraHeight / 2;
    const maxY = this.y + this.height - cameraHeight / 2;

    return {
      x: Math.max(minX, Math.min(maxX, point.x)),
      y: Math.max(minY, Math.min(maxY, point.y))
    };
  }

  /**
   * Check if point is within bounds
   */
  contains(point) {
    return point.x >= this.x && 
           point.x <= this.x + this.width &&
           point.y >= this.y && 
           point.y <= this.y + this.height;
  }
}

/**
 * Camera Preset for storing predefined camera positions
 */
class CameraPreset {
  constructor(name, position, zoom, rotation = 0, description = '') {
    this.name = name;
    this.position = { ...position };
    this.zoom = zoom;
    this.rotation = rotation;
    this.description = description;
    this.createdAt = Date.now();
  }

  /**
   * Apply this preset to a camera
   */
  applyTo(camera, transitionType = TransitionType.EASE_IN_OUT, duration = 1000) {
    return camera.transitionTo(this.position, this.zoom, {
      transitionType,
      duration,
      rotation: this.rotation
    });
  }
}

/**
 * Professional Camera Management System
 */
export class CameraManager {
  constructor(gameEngine, config = {}) {
    this.gameEngine = gameEngine;
    this.scene = null;
    this.camera = null;

    // Camera configuration with professional defaults
    this.config = {
      // Movement settings
      panSpeed: 1.2,
      zoomSpeed: 0.05,
      followSmoothing: 0.12,
      maxZoom: 4.0,
      minZoom: 0.2,
      
      // Transition settings
      defaultTransitionDuration: 800,
      defaultTransitionType: TransitionType.EASE_IN_OUT,
      
      // Input settings
      panButton: 1, // Middle mouse button
      enableScrollZoom: true,
      enableKeyboardControls: true,
      enableTouchControls: true,
      
      // Performance settings
      interpolationFrameRate: 60,
      updateThreshold: 0.1,
      
      // Bounds settings
      respectBounds: true,
      boundsMargin: 50,
      
      // Debug settings
      showDebugInfo: false,
      showBounds: false,
      
      ...config
    };

    // Camera state
    this.state = {
      mode: CameraMode.OVERVIEW,
      position: { x: 960, y: 540 },
      targetPosition: { x: 960, y: 540 },
      zoom: 1.0,
      targetZoom: 1.0,
      rotation: 0,
      targetRotation: 0,
      followTarget: null,
      isTransitioning: false,
      isPanning: false,
      lastUpdateTime: 0
    };

    // Input handling
    this.input = {
      mouse: { x: 0, y: 0, startX: 0, startY: 0, deltaX: 0, deltaY: 0 },
      keys: new Set(),
      pointers: new Map()
    };

    // Camera systems
    this.interpolator = new CameraInterpolator();
    this.bounds = new CameraBounds();
    this.presets = new Map();
    this.transitions = [];

    // Performance tracking
    this.performance = {
      frameCount: 0,
      lastFPSCheck: Date.now(),
      currentFPS: 0,
      averageFrameTime: 16.67 // 60 FPS
    };

    // Event handlers
    this.eventHandlers = new Map();

    console.log('[CameraManager] Initialized with professional camera system');
    
    // Load camera configuration from ConfigManager
    this.loadCameraConfiguration();
    
    // Setup default presets
    this.setupDefaultPresets();
  }

  /**
   * Load camera configuration from ConfigManager
   */
  async loadCameraConfiguration() {
    try {
      const visualSettings = this.gameEngine.getVisualSetting('camera');
      if (visualSettings) {
        this.config = { ...this.config, ...visualSettings };
        console.log('[CameraManager] Loaded camera configuration from ConfigManager');
      }

      // Listen for configuration updates
      this.gameEngine.on('configuration-updated', (data) => {
        if (data.type === 'visual-settings') {
          this.handleConfigurationUpdate();
        }
      });

    } catch (error) {
      console.warn('[CameraManager] Could not load camera configuration:', error.message);
    }
  }

  /**
   * Handle configuration updates from hot-reload
   */
  handleConfigurationUpdate() {
    const newCameraConfig = this.gameEngine.getVisualSetting('camera');
    if (newCameraConfig) {
      const oldConfig = { ...this.config };
      this.config = { ...this.config, ...newCameraConfig };
      
      // Handle debug UI visibility changes
      if (oldConfig.debug?.showDebugInfo !== this.config.debug?.showDebugInfo) {
        if (this.config.debug?.showDebugInfo) {
          this.createDebugUI();
        } else if (this.debugUI) {
          this.debugUI.destroy();
          this.debugUI = null;
          this.debugText = null;
        }
      }
      
      console.log('[CameraManager] Camera configuration updated');
      this.emit('configuration-updated', { oldConfig, newConfig: this.config });
    }
  }

  /**
   * Setup default camera presets
   */
  setupDefaultPresets() {
    // Overview preset - shows entire track
    this.addPreset(new CameraPreset(
      'overview',
      { x: 960, y: 540 },
      0.8,
      0,
      'Full track overview for race monitoring'
    ));

    // Start line preset
    this.addPreset(new CameraPreset(
      'start_line',
      { x: 200, y: 300 },
      1.5,
      0,
      'Close-up of race start area'
    ));

    // Finish line preset
    this.addPreset(new CameraPreset(
      'finish_line',
      { x: 1720, y: 300 },
      1.5,
      0,
      'Close-up of finish line area'
    ));

    // Action zone preset
    this.addPreset(new CameraPreset(
      'action_zone',
      { x: 960, y: 540 },
      1.2,
      0,
      'Dynamic action following preset'
    ));

    console.log('[CameraManager] Default presets configured');
  }

  /**
   * Initialize camera with scene
   */
  initialize(scene) {
    this.scene = scene;
    this.camera = scene.cameras.main;

    // Set initial camera properties
    this.camera.setZoom(this.state.zoom);
    this.camera.centerOn(this.state.position.x, this.state.position.y);

    // Setup camera bounds based on game world
    this.setupCameraBounds();

    // Setup input handlers
    this.setupInputHandlers();

    // Initialize with overview mode
    this.setMode(CameraMode.OVERVIEW);

    // Create debug UI if enabled
    if (this.config.debug?.showDebugInfo) {
      this.createDebugUI();
    }

    console.log('[CameraManager] Camera system initialized');
    this.emit('initialized', { camera: this.camera, mode: this.state.mode });

    return this;
  }

  /**
   * Setup camera movement bounds
   */
  setupCameraBounds() {
    // Set bounds based on track dimensions or game world
    const trackConfig = this.gameEngine.getTrackConfig();
    
    if (trackConfig && trackConfig.dimensions) {
      this.bounds = new CameraBounds(
        -this.config.boundsMargin,
        -this.config.boundsMargin,
        trackConfig.dimensions.width + (this.config.boundsMargin * 2),
        trackConfig.dimensions.height + (this.config.boundsMargin * 2)
      );
    } else {
      // Default bounds for standard track size
      this.bounds = new CameraBounds(
        -this.config.boundsMargin,
        -this.config.boundsMargin,
        1920 + (this.config.boundsMargin * 2),
        1080 + (this.config.boundsMargin * 2)
      );
    }

    this.bounds.enabled = this.config.respectBounds;
    console.log('[CameraManager] Camera bounds configured:', this.bounds);
  }

  /**
   * Setup input event handlers
   */
  setupInputHandlers() {
    if (!this.scene) return;

    // Mouse/pointer input
    this.scene.input.on('pointerdown', this.handlePointerDown.bind(this));
    this.scene.input.on('pointermove', this.handlePointerMove.bind(this));
    this.scene.input.on('pointerup', this.handlePointerUp.bind(this));
    this.scene.input.on('wheel', this.handleWheel.bind(this));

    // Keyboard input
    if (this.config.enableKeyboardControls) {
      this.scene.input.keyboard.on('keydown', this.handleKeyDown.bind(this));
      this.scene.input.keyboard.on('keyup', this.handleKeyUp.bind(this));
    }

    // Camera mode shortcuts
    this.setupCameraModeShortcuts();

    console.log('[CameraManager] Input handlers configured');
  }

  /**
   * Setup keyboard shortcuts for camera modes
   */
  setupCameraModeShortcuts() {
    // C - Cycle through camera modes
    this.scene.input.keyboard.on('keydown-C', () => {
      this.cycleMode();
    });

    // F - Follow mode
    this.scene.input.keyboard.on('keydown-F', () => {
      this.setMode(CameraMode.FOLLOW_ACTION);
    });

    // O - Overview mode
    this.scene.input.keyboard.on('keydown-O', () => {
      this.setMode(CameraMode.OVERVIEW);
    });

    // Numbers 1-3 for spectator presets
    for (let i = 1; i <= 3; i++) {
      this.scene.input.keyboard.on(`keydown-${i}`, () => {
        this.setMode(`spectator_${i}`);
      });
    }

    // R - Reset camera to default position
    this.scene.input.keyboard.on('keydown-R', () => {
      this.resetToDefault();
    });
  }

  /**
   * Handle pointer/mouse down events
   */
  handlePointerDown(pointer) {
    // Middle click for panning
    if (pointer.button === this.config.panButton) {
      this.startPanning(pointer);
    }
  }

  /**
   * Handle pointer/mouse move events  
   */
  handlePointerMove(pointer) {
    this.input.mouse.x = pointer.x;
    this.input.mouse.y = pointer.y;

    if (this.state.isPanning) {
      this.updatePanning(pointer);
    }
  }

  /**
   * Handle pointer/mouse up events
   */
  handlePointerUp(pointer) {
    if (pointer.button === this.config.panButton && this.state.isPanning) {
      this.stopPanning();
    }
  }

  /**
   * Handle mouse wheel for zooming
   */
  handleWheel(pointer, gameObjects, deltaX, deltaY, deltaZ) {
    if (!this.config.enableScrollZoom) return;

    const zoomDelta = -deltaY * this.config.zoomSpeed;
    const newZoom = Math.max(this.config.minZoom, 
                   Math.min(this.config.maxZoom, this.state.targetZoom + zoomDelta));
    
    this.setZoom(newZoom, {
      centerOnPointer: true,
      pointerX: pointer.x,
      pointerY: pointer.y
    });
  }

  /**
   * Handle keyboard down events
   */
  handleKeyDown(event) {
    this.input.keys.add(event.code);

    // Arrow keys for fine camera movement
    if (this.state.mode === CameraMode.FREE_CAM) {
      const moveSpeed = 5;
      let moveX = 0, moveY = 0;

      if (this.input.keys.has('ArrowLeft')) moveX = -moveSpeed;
      if (this.input.keys.has('ArrowRight')) moveX = moveSpeed;
      if (this.input.keys.has('ArrowUp')) moveY = -moveSpeed;
      if (this.input.keys.has('ArrowDown')) moveY = moveSpeed;

      if (moveX !== 0 || moveY !== 0) {
        this.moveBy(moveX, moveY);
      }
    }
  }

  /**
   * Handle keyboard up events
   */
  handleKeyUp(event) {
    this.input.keys.delete(event.code);
  }

  /**
   * Start panning operation
   */
  startPanning(pointer) {
    this.state.isPanning = true;
    this.input.mouse.startX = pointer.x;
    this.input.mouse.startY = pointer.y;
    
    // Change to free cam mode when manually panning
    if (this.state.mode !== CameraMode.FREE_CAM) {
      this.setMode(CameraMode.FREE_CAM);
    }

    this.emit('pan-start', { position: this.state.position });
  }

  /**
   * Update panning based on mouse movement
   */
  updatePanning(pointer) {
    if (!this.state.isPanning) return;

    const deltaX = (pointer.x - this.input.mouse.startX) * this.config.panSpeed;
    const deltaY = (pointer.y - this.input.mouse.startY) * this.config.panSpeed;

    // Invert movement for natural feel
    this.moveBy(-deltaX / this.state.zoom, -deltaY / this.state.zoom);

    // Update start position for continuous panning
    this.input.mouse.startX = pointer.x;
    this.input.mouse.startY = pointer.y;
  }

  /**
   * Stop panning operation
   */
  stopPanning() {
    this.state.isPanning = false;
    this.emit('pan-end', { position: this.state.position });
  }

  /**
   * Move camera by offset
   */
  moveBy(deltaX, deltaY) {
    const newPosition = {
      x: this.state.targetPosition.x + deltaX,
      y: this.state.targetPosition.y + deltaY
    };

    this.setPosition(newPosition);
  }

  /**
   * Set camera position with bounds checking
   */
  setPosition(position, options = {}) {
    const setOptions = {
      respectBounds: this.config.respectBounds,
      smooth: false,
      ...options
    };

    let targetPos = { ...position };

    // Apply bounds if enabled
    if (setOptions.respectBounds && this.bounds.enabled) {
      const viewWidth = this.scene.cameras.main.width / this.state.zoom;
      const viewHeight = this.scene.cameras.main.height / this.state.zoom;
      targetPos = this.bounds.constrain(targetPos, viewWidth, viewHeight);
    }

    if (setOptions.smooth) {
      this.state.targetPosition = targetPos;
    } else {
      this.state.position = targetPos;
      this.state.targetPosition = targetPos;
      this.camera.centerOn(targetPos.x, targetPos.y);
    }

    this.emit('position-changed', { position: targetPos, smooth: setOptions.smooth });
  }

  /**
   * Set camera zoom level
   */
  setZoom(zoom, options = {}) {
    const zoomOptions = {
      smooth: false,
      centerOnPointer: false,
      ...options
    };

    const newZoom = Math.max(this.config.minZoom, Math.min(this.config.maxZoom, zoom));

    if (zoomOptions.centerOnPointer && zoomOptions.pointerX !== undefined && zoomOptions.pointerY !== undefined) {
      // Zoom towards pointer position
      const worldPoint = this.camera.getWorldPoint(zoomOptions.pointerX, zoomOptions.pointerY);
      const zoomDelta = newZoom / this.state.zoom;
      
      // Calculate new center to zoom towards pointer
      const newCenterX = worldPoint.x - (worldPoint.x - this.state.position.x) / zoomDelta;
      const newCenterY = worldPoint.y - (worldPoint.y - this.state.position.y) / zoomDelta;
      
      this.setPosition({ x: newCenterX, y: newCenterY }, { smooth: zoomOptions.smooth });
    }

    if (zoomOptions.smooth) {
      this.state.targetZoom = newZoom;
    } else {
      this.state.zoom = newZoom;
      this.state.targetZoom = newZoom;
      this.camera.setZoom(newZoom);
    }

    this.emit('zoom-changed', { zoom: newZoom, smooth: zoomOptions.smooth });
  }

  /**
   * Set camera mode
   */
  setMode(mode, options = {}) {
    const modeOptions = {
      transition: true,
      transitionDuration: this.config.defaultTransitionDuration,
      transitionType: this.config.defaultTransitionType,
      ...options
    };

    const oldMode = this.state.mode;
    this.state.mode = mode;

    console.log(`[CameraManager] Camera mode changed: ${oldMode} -> ${mode}`);

    // Apply mode-specific behavior
    switch (mode) {
      case CameraMode.FREE_CAM:
        this.applyFreeCamMode(modeOptions);
        break;
      case CameraMode.FOLLOW_PLAYER:
        this.applyFollowPlayerMode(modeOptions);
        break;
      case CameraMode.FOLLOW_ACTION:
        this.applyFollowActionMode(modeOptions);
        break;
      case CameraMode.OVERVIEW:
        this.applyOverviewMode(modeOptions);
        break;
      case CameraMode.CINEMATIC:
        this.applyCinematicMode(modeOptions);
        break;
      case CameraMode.SPECTATOR_1:
      case CameraMode.SPECTATOR_2:
      case CameraMode.SPECTATOR_3:
        this.applySpectatorMode(mode, modeOptions);
        break;
      case CameraMode.BROADCAST:
        this.applyBroadcastMode(modeOptions);
        break;
    }

    this.emit('mode-changed', { oldMode, newMode: mode, options: modeOptions });
  }

  /**
   * Apply free camera mode
   */
  applyFreeCamMode(options) {
    // Free cam allows manual control - no automatic behavior
    this.state.followTarget = null;
  }

  /**
   * Apply follow player mode
   */
  applyFollowPlayerMode(options) {
    // Find a player to follow
    const players = this.gameEngine.players;
    if (players && players.length > 0) {
      // Follow first active player or player specified in options
      const targetPlayer = options.playerId !== undefined ? 
        players[options.playerId] : 
        players.find(p => p && p.active) || players[0];
        
      this.setFollowTarget(targetPlayer, options);
    }
  }

  /**
   * Apply follow action mode
   */
  applyFollowActionMode(options) {
    // Follow the most interesting action (closest to token, leader, etc.)
    this.updateActionTarget();
  }

  /**
   * Apply overview mode
   */
  applyOverviewMode(options) {
    const preset = this.getPreset('overview');
    if (preset) {
      preset.applyTo(this, options.transitionType, options.transitionDuration);
    } else {
      // Fallback overview position
      this.transitionTo({ x: 960, y: 540 }, 0.8, options);
    }
    this.state.followTarget = null;
  }

  /**
   * Apply cinematic mode
   */
  applyCinematicMode(options) {
    // Start cinematic camera path if available
    this.startCinematicSequence(options);
  }

  /**
   * Apply spectator mode
   */
  applySpectatorMode(mode, options) {
    const presetName = mode; // spectator_1, spectator_2, spectator_3
    const preset = this.getPreset(presetName);
    
    if (preset) {
      preset.applyTo(this, options.transitionType, options.transitionDuration);
    } else {
      console.warn(`[CameraManager] Spectator preset not found: ${presetName}`);
    }
    
    this.state.followTarget = null;
  }

  /**
   * Apply broadcast mode
   */
  applyBroadcastMode(options) {
    // Automatic camera switching for broadcast-style coverage
    this.startBroadcastSequence(options);
  }

  /**
   * Set follow target (player or object)
   */
  setFollowTarget(target, options = {}) {
    this.state.followTarget = target;
    
    if (target) {
      console.log(`[CameraManager] Following target:`, target.id || 'unnamed');
      this.emit('follow-target-set', { target });
    }
  }

  /**
   * Update action target for follow action mode
   */
  updateActionTarget() {
    const players = this.gameEngine.players;
    if (!players || players.length === 0) return;

    // Find most interesting target based on various factors
    let bestTarget = null;
    let bestScore = -1;

    players.forEach(player => {
      if (!player || !player.active) return;

      let score = 0;

      // Proximity to M token
      if (this.gameEngine.mToken) {
        const distanceToToken = Phaser.Math.Distance.Between(
          player.x, player.y,
          this.gameEngine.mToken.x, this.gameEngine.mToken.y
        );
        score += Math.max(0, 1000 - distanceToToken); // Closer = higher score
      }

      // Player velocity (more action = higher score)
      if (player.body) {
        const velocity = Math.sqrt(player.body.velocity.x ** 2 + player.body.velocity.y ** 2);
        score += velocity * 10;
      }

      // Player effects (boosted, skilled players more interesting)
      if (player.boosted) score += 500;
      if (player.magnetized) score += 800;
      if (player.bubbleProtected) score += 300;

      if (score > bestScore) {
        bestScore = score;
        bestTarget = player;
      }
    });

    if (bestTarget && bestTarget !== this.state.followTarget) {
      this.setFollowTarget(bestTarget);
    }
  }

  /**
   * Transition to position and zoom smoothly
   */
  transitionTo(position, zoom, options = {}) {
    const transitionOptions = {
      duration: this.config.defaultTransitionDuration,
      transitionType: this.config.defaultTransitionType,
      rotation: this.state.rotation,
      onComplete: null,
      ...options
    };

    // Create transition data
    const transition = {
      id: Date.now(),
      startTime: Date.now(),
      duration: transitionOptions.duration,
      transitionType: transitionOptions.transitionType,
      startPosition: { ...this.state.position },
      endPosition: { ...position },
      startZoom: this.state.zoom,
      endZoom: zoom,
      startRotation: this.state.rotation,
      endRotation: transitionOptions.rotation,
      onComplete: transitionOptions.onComplete,
      active: true
    };

    this.transitions.push(transition);
    this.state.isTransitioning = true;

    console.log(`[CameraManager] Starting transition to (${position.x}, ${position.y}) zoom: ${zoom}`);
    this.emit('transition-start', { transition });

    return transition;
  }

  /**
   * Cycle through camera modes
   */
  cycleMode() {
    const modes = [
      CameraMode.OVERVIEW,
      CameraMode.FOLLOW_ACTION,
      CameraMode.FOLLOW_PLAYER,
      CameraMode.SPECTATOR_1,
      CameraMode.SPECTATOR_2,
      CameraMode.SPECTATOR_3,
      CameraMode.FREE_CAM
    ];

    const currentIndex = modes.indexOf(this.state.mode);
    const nextIndex = (currentIndex + 1) % modes.length;
    this.setMode(modes[nextIndex]);
  }

  /**
   * Reset camera to default position
   */
  resetToDefault() {
    this.setMode(CameraMode.OVERVIEW, { transition: true });
  }

  /**
   * Add camera preset
   */
  addPreset(preset) {
    this.presets.set(preset.name, preset);
    console.log(`[CameraManager] Added camera preset: ${preset.name}`);
  }

  /**
   * Get camera preset by name
   */
  getPreset(name) {
    return this.presets.get(name);
  }

  /**
   * Remove camera preset
   */
  removePreset(name) {
    const removed = this.presets.delete(name);
    if (removed) {
      console.log(`[CameraManager] Removed camera preset: ${name}`);
    }
    return removed;
  }

  /**
   * Start cinematic sequence
   */
  startCinematicSequence(options = {}) {
    // Implementation for cinematic camera paths
    console.log('[CameraManager] Starting cinematic sequence');
    // This would involve predefined camera paths, keyframes, etc.
  }

  /**
   * Start broadcast sequence
   */
  startBroadcastSequence(options = {}) {
    // Implementation for automatic broadcast-style camera switching
    console.log('[CameraManager] Starting broadcast sequence');
    // This would cycle through different views automatically
  }

  /**
   * Main update loop
   */
  update(time, delta) {
    const deltaTime = delta / 1000; // Convert to seconds
    this.state.lastUpdateTime = time;

    // Update performance tracking
    this.updatePerformanceTracking(time, delta);

    // Update transitions
    this.updateTransitions(time);

    // Update smooth movements
    this.updateSmoothMovement(deltaTime);

    // Update follow behavior
    this.updateFollowBehavior(deltaTime);

    // Update broadcast mode if active
    if (this.state.mode === CameraMode.BROADCAST) {
      this.updateBroadcastMode(time, deltaTime);
    }

    // Update action target if in follow action mode
    if (this.state.mode === CameraMode.FOLLOW_ACTION) {
      // Update every 500ms to avoid performance impact
      if (time % 500 < delta) {
        this.updateActionTarget();
      }
    }

    // Update debug UI if enabled
    if (this.config.debug?.showDebugInfo && this.debugText) {
      // Update debug UI less frequently for performance
      if (time % 200 < delta) {
        this.updateDebugUI();
      }
    }
  }

  /**
   * Update performance tracking
   */
  updatePerformanceTracking(time, delta) {
    this.performance.frameCount++;
    
    if (time - this.performance.lastFPSCheck >= 1000) {
      this.performance.currentFPS = this.performance.frameCount;
      this.performance.frameCount = 0;
      this.performance.lastFPSCheck = time;
    }
    
    // Running average of frame time
    this.performance.averageFrameTime = 
      this.performance.averageFrameTime * 0.9 + delta * 0.1;
  }

  /**
   * Update camera transitions
   */
  updateTransitions(time) {
    if (this.transitions.length === 0) {
      this.state.isTransitioning = false;
      return;
    }

    this.transitions = this.transitions.filter(transition => {
      if (!transition.active) return false;

      const elapsed = time - transition.startTime;
      const progress = Math.min(elapsed / transition.duration, 1);

      if (progress >= 1) {
        // Transition complete
        this.state.position = { ...transition.endPosition };
        this.state.zoom = transition.endZoom;
        this.state.rotation = transition.endRotation;
        
        // Apply final values to camera
        this.camera.centerOn(this.state.position.x, this.state.position.y);
        this.camera.setZoom(this.state.zoom);
        this.camera.setRotation(this.state.rotation);

        if (transition.onComplete) {
          transition.onComplete(transition);
        }

        this.emit('transition-complete', { transition });
        return false; // Remove transition
      }

      // Interpolate values
      this.state.position = this.interpolator.interpolatePoint(
        transition.startPosition,
        transition.endPosition,
        progress,
        transition.transitionType
      );

      this.state.zoom = this.interpolator.interpolate(
        transition.startZoom,
        transition.endZoom,
        progress,
        transition.transitionType
      );

      this.state.rotation = this.interpolator.interpolate(
        transition.startRotation,
        transition.endRotation,
        progress,
        transition.transitionType
      );

      // Apply to camera
      this.camera.centerOn(this.state.position.x, this.state.position.y);
      this.camera.setZoom(this.state.zoom);
      this.camera.setRotation(this.state.rotation);

      return true; // Keep transition
    });

    if (this.transitions.length === 0) {
      this.state.isTransitioning = false;
    }
  }

  /**
   * Update smooth camera movement
   */
  updateSmoothMovement(deltaTime) {
    if (this.state.isTransitioning) return; // Don't interfere with transitions

    const smoothing = this.config.followSmoothing;
    const threshold = this.config.updateThreshold;

    // Smooth position
    const positionDelta = {
      x: this.state.targetPosition.x - this.state.position.x,
      y: this.state.targetPosition.y - this.state.position.y
    };

    if (Math.abs(positionDelta.x) > threshold || Math.abs(positionDelta.y) > threshold) {
      this.state.position.x += positionDelta.x * smoothing;
      this.state.position.y += positionDelta.y * smoothing;
      this.camera.centerOn(this.state.position.x, this.state.position.y);
    }

    // Smooth zoom
    const zoomDelta = this.state.targetZoom - this.state.zoom;
    if (Math.abs(zoomDelta) > 0.01) {
      this.state.zoom += zoomDelta * smoothing;
      this.camera.setZoom(this.state.zoom);
    }

    // Smooth rotation
    const rotationDelta = this.state.targetRotation - this.state.rotation;
    if (Math.abs(rotationDelta) > 0.01) {
      this.state.rotation += rotationDelta * smoothing;
      this.camera.setRotation(this.state.rotation);
    }
  }

  /**
   * Update follow behavior
   */
  updateFollowBehavior(deltaTime) {
    if (!this.state.followTarget || this.state.isTransitioning) return;

    const target = this.state.followTarget;
    
    // Update target position based on follow target
    if (target.x !== undefined && target.y !== undefined) {
      this.state.targetPosition.x = target.x;
      this.state.targetPosition.y = target.y;
    }
  }

  /**
   * Update broadcast mode
   */
  updateBroadcastMode(time, deltaTime) {
    // Implement automatic camera switching logic for broadcast mode
    // This could cycle through different players, action points, etc.
  }

  /**
   * Get current camera information
   */
  getCameraInfo() {
    return {
      mode: this.state.mode,
      position: { ...this.state.position },
      zoom: this.state.zoom,
      rotation: this.state.rotation,
      followTarget: this.state.followTarget ? this.state.followTarget.id : null,
      isTransitioning: this.state.isTransitioning,
      isPanning: this.state.isPanning,
      performance: { ...this.performance },
      presets: Array.from(this.presets.keys()),
      activeTransitions: this.transitions.length
    };
  }

  /**
   * Create debug UI for camera information
   */
  createDebugUI() {
    if (!this.scene || !this.config.debug?.showDebugInfo) return;

    // Remove existing debug UI
    if (this.debugUI) {
      this.debugUI.destroy();
    }

    const graphics = this.scene.add.graphics();
    const debugContainer = this.scene.add.container(10, 120);

    // Background panel
    graphics.fillStyle(0x000000, 0.7);
    graphics.fillRect(0, 0, 300, 180);
    graphics.lineStyle(2, 0x00ff00, 1);
    graphics.strokeRect(0, 0, 300, 180);

    debugContainer.add(graphics);

    // Title
    const title = this.scene.add.text(10, 10, 'CAMERA DEBUG', {
      fontSize: '14px',
      fontFamily: 'Courier New',
      color: '#00ff00',
      fontStyle: 'bold'
    });
    debugContainer.add(title);

    // Debug text
    this.debugText = this.scene.add.text(10, 30, '', {
      fontSize: '11px',
      fontFamily: 'Courier New',
      color: '#ffffff',
      lineSpacing: 2
    });
    debugContainer.add(this.debugText);

    this.debugUI = debugContainer;
    this.updateDebugUI();

    console.log('[CameraManager] Debug UI created');
  }

  /**
   * Update debug UI with current camera information
   */
  updateDebugUI() {
    if (!this.debugText || !this.config.debug?.showDebugInfo) return;

    const info = this.getCameraInfo();
    const debugText = [
      `Mode: ${info.mode}`,
      `Position: (${Math.round(info.position.x)}, ${Math.round(info.position.y)})`,
      `Zoom: ${info.zoom.toFixed(2)}x`,
      `Rotation: ${(info.rotation * 180 / Math.PI).toFixed(1)}°`,
      `Follow: ${info.followTarget || 'none'}`,
      `Transitioning: ${info.isTransitioning ? 'YES' : 'NO'}`,
      `Panning: ${info.isPanning ? 'YES' : 'NO'}`,
      `Transitions: ${info.activeTransitions}`,
      `FPS: ${info.performance.currentFPS}`,
      `Frame Time: ${info.performance.averageFrameTime.toFixed(1)}ms`,
      `Presets: ${info.presets.length}`,
      '',
      'Controls:',
      'C - Cycle modes',
      'Middle-click - Pan',
      'Scroll - Zoom'
    ].join('\n');

    this.debugText.setText(debugText);
  }

  /**
   * Event system
   */
  on(eventName, handler) {
    if (!this.eventHandlers.has(eventName)) {
      this.eventHandlers.set(eventName, []);
    }
    this.eventHandlers.get(eventName).push(handler);
  }

  off(eventName, handler) {
    const handlers = this.eventHandlers.get(eventName);
    if (handlers) {
      const index = handlers.indexOf(handler);
      if (index > -1) {
        handlers.splice(index, 1);
      }
    }
  }

  emit(eventName, data = {}) {
    const handlers = this.eventHandlers.get(eventName);
    if (handlers) {
      handlers.forEach(handler => {
        try {
          handler(data);
        } catch (error) {
          console.error(`[CameraManager] Event handler error for '${eventName}':`, error);
        }
      });
    }

    // Log events in development
    if (process.env.NODE_ENV === 'development' && this.config.showDebugInfo) {
      console.log(`[CameraManager] Event: ${eventName}`, data);
    }
  }

  /**
   * Cleanup camera system
   */
  destroy() {
    // Clear transitions
    this.transitions = [];
    
    // Clear event handlers
    this.eventHandlers.clear();
    
    // Clear presets
    this.presets.clear();
    
    // Destroy debug UI
    if (this.debugUI) {
      this.debugUI.destroy();
      this.debugUI = null;
      this.debugText = null;
    }
    
    // Reset state
    this.state.isTransitioning = false;
    this.state.isPanning = false;
    this.state.followTarget = null;
    
    console.log('[CameraManager] Camera system destroyed');
  }
}

export default CameraManager;