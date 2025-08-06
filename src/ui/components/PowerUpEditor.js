/**
 * PowerUpEditor.js - Interactive Power-up Configuration Interface
 * 
 * Provides a user-friendly interface for creating, editing, and managing
 * custom power-ups with real-time validation and preview capabilities.
 * 
 * Key Features:
 * - Visual power-up creation interface
 * - Real-time validation feedback
 * - Effect preview system
 * - Import/export functionality  
 * - Integration with PowerUpManager
 * - Template system for common effects
 * - Asset browser integration
 */

import { PowerUpManager, PowerUpValidationResult } from '@game/entities/PowerUpManager';
import { AssetManager } from '@game/systems/AssetManager';

/**
 * Power-up Editor Interface
 */
export class PowerUpEditor {
  constructor(container, options = {}) {
    this.container = typeof container === 'string' ? document.getElementById(container) : container;
    
    this.options = {
      powerUpManager: null,
      assetManager: null,
      onSave: null,
      onCancel: null,
      enablePreview: true,
      showAdvanced: false,
      ...options
    };

    // Current power-up being edited
    this.currentPowerUp = this.createDefaultPowerUp();
    this.isEditing = false;
    this.validationResult = null;

    // Templates for common power-up types
    this.templates = this.createPowerUpTemplates();

    // UI state
    this.uiState = {
      activeTab: 'basic',
      showValidation: true,
      previewEnabled: this.options.enablePreview
    };

    this.initializeUI();
    this.bindEvents();
    
    console.log('[PowerUpEditor] Initialized');
  }

  /**
   * Create default power-up structure
   */
  createDefaultPowerUp() {
    return {
      id: '',
      name: '',
      description: '',
      rarity: 'common',
      effects: {
        speedMultiplier: 1.5,
        duration: 5000,
        visualEffect: 'default'
      },
      spawnWeight: 0.1,
      glowColor: '#00ff00',
      icon: '',
      customEffect: null
    };
  }

  /**
   * Create power-up templates
   */
  createPowerUpTemplates() {
    return {
      speed_boost: {
        name: 'Speed Boost',
        description: 'Increases player speed temporarily',
        rarity: 'common',
        effects: {
          speedMultiplier: 1.8,
          duration: 4000,
          visualEffect: 'speed_lines'
        },
        spawnWeight: 0.15,
        glowColor: '#00ff00'
      },
      mega_boost: {
        name: 'Mega Boost',
        description: 'Massive speed increase with spectacular effects',
        rarity: 'rare',
        effects: {
          speedMultiplier: 3.0,
          duration: 2500,
          visualEffect: 'mega_explosion'
        },
        spawnWeight: 0.05,
        glowColor: '#ff0000'
      },
      rainbow_trail: {
        name: 'Rainbow Trail',
        description: 'Colorful speed boost with rainbow particles',
        rarity: 'uncommon',
        effects: {
          speedMultiplier: 2.0,
          duration: 3500,
          visualEffect: 'rainbow_trail'
        },
        spawnWeight: 0.08,
        glowColor: '#ff69b4',
        customEffect: {
          type: 'rainbow_boost',
          trailColors: ['#ff0000', '#ff7f00', '#ffff00', '#00ff00', '#0000ff', '#4b0082', '#9400d3'],
          particleCount: 12
        }
      },
      paralysis_bomb: {
        name: 'Paralysis Bomb',
        description: 'Temporarily paralyzes nearby opponents',
        rarity: 'uncommon',
        effects: {
          type: 'paralysis',
          targets: 'nearby',
          duration: 4000,
          radius: 100,
          visualEffect: 'electric_shock'
        },
        spawnWeight: 0.1,
        glowColor: '#ffff00'
      }
    };
  }

  /**
   * Initialize the UI
   */
  initializeUI() {
    this.container.innerHTML = `
      <div class="power-up-editor">
        <div class="editor-header">
          <h2>Power-up Editor</h2>
          <div class="editor-actions">
            <button class="btn-secondary" id="loadTemplate">Load Template</button>
            <button class="btn-secondary" id="importPowerUp">Import</button>
            <button class="btn-secondary" id="exportPowerUp">Export</button>
            <button class="btn-primary" id="savePowerUp">Save Power-up</button>
            <button class="btn-secondary" id="cancelEdit">Cancel</button>
          </div>
        </div>

        <div class="editor-content">
          <!-- Navigation Tabs -->
          <div class="editor-tabs">
            <button class="tab-button active" data-tab="basic">Basic Info</button>
            <button class="tab-button" data-tab="effects">Effects</button>
            <button class="tab-button" data-tab="visual">Visual</button>
            <button class="tab-button" data-tab="advanced">Advanced</button>
            <button class="tab-button" data-tab="preview">Preview</button>
          </div>

          <!-- Basic Info Tab -->
          <div class="tab-content active" id="tab-basic">
            <div class="form-section">
              <h3>Basic Information</h3>
              
              <div class="form-group">
                <label for="powerUpId">Power-up ID</label>
                <input type="text" id="powerUpId" placeholder="unique_power_up_id" required>
                <small>Unique identifier (lowercase, underscores only)</small>
              </div>

              <div class="form-group">
                <label for="powerUpName">Name</label>
                <input type="text" id="powerUpName" placeholder="Power-up Name" required>
              </div>

              <div class="form-group">
                <label for="powerUpDescription">Description</label>
                <textarea id="powerUpDescription" placeholder="Describe what this power-up does..."></textarea>
              </div>

              <div class="form-row">
                <div class="form-group">
                  <label for="powerUpRarity">Rarity</label>
                  <select id="powerUpRarity">
                    <option value="common">Common</option>
                    <option value="uncommon">Uncommon</option>
                    <option value="rare">Rare</option>
                    <option value="legendary">Legendary</option>
                  </select>
                </div>

                <div class="form-group">
                  <label for="spawnWeight">Spawn Weight</label>
                  <input type="number" id="spawnWeight" min="0" max="1" step="0.01" value="0.1">
                  <small>Probability of spawning (0-1)</small>
                </div>
              </div>
            </div>
          </div>

          <!-- Effects Tab -->
          <div class="tab-content" id="tab-effects">
            <div class="form-section">
              <h3>Power-up Effects</h3>
              
              <div class="effect-type-selector">
                <label>Effect Type</label>
                <div class="radio-group">
                  <label><input type="radio" name="effectType" value="speed_boost" checked> Speed Boost</label>
                  <label><input type="radio" name="effectType" value="paralysis"> Paralysis</label>
                  <label><input type="radio" name="effectType" value="custom"> Custom Effect</label>
                </div>
              </div>

              <!-- Speed Boost Effects -->
              <div class="effect-config active" id="config-speed_boost">
                <div class="form-row">
                  <div class="form-group">
                    <label for="speedMultiplier">Speed Multiplier</label>
                    <input type="number" id="speedMultiplier" min="0.1" max="10" step="0.1" value="1.5">
                    <small>How much faster (1.0 = normal speed)</small>
                  </div>

                  <div class="form-group">
                    <label for="effectDuration">Duration (ms)</label>
                    <input type="number" id="effectDuration" min="100" max="60000" step="100" value="5000">
                    <small>How long the effect lasts</small>
                  </div>
                </div>
              </div>

              <!-- Paralysis Effects -->
              <div class="effect-config" id="config-paralysis">
                <div class="form-row">
                  <div class="form-group">
                    <label for="paralysisTargets">Targets</label>
                    <select id="paralysisTargets">
                      <option value="self">Self</option>
                      <option value="nearest">Nearest Player</option>
                      <option value="random">Random Players</option>
                      <option value="all">All Players</option>
                    </select>
                  </div>

                  <div class="form-group">
                    <label for="paralysisDuration">Duration (ms)</label>
                    <input type="number" id="paralysisDuration" min="500" max="10000" step="100" value="3000">
                  </div>
                </div>
              </div>

              <!-- Custom Effects -->
              <div class="effect-config" id="config-custom">
                <div class="form-group">
                  <label for="customEffectType">Custom Effect Type</label>
                  <input type="text" id="customEffectType" placeholder="rainbow_boost">
                  <small>Must match a registered effect plugin</small>
                </div>

                <div class="form-group">
                  <label for="customEffectConfig">Custom Effect Configuration</label>
                  <textarea id="customEffectConfig" placeholder='{"trailColors": ["#ff0000", "#00ff00"], "particleCount": 10}'></textarea>
                  <small>JSON configuration for the custom effect</small>
                </div>
              </div>
            </div>
          </div>

          <!-- Visual Tab -->
          <div class="tab-content" id="tab-visual">
            <div class="form-section">
              <h3>Visual Settings</h3>
              
              <div class="form-row">
                <div class="form-group">
                  <label for="glowColor">Glow Color</label>
                  <input type="color" id="glowColor" value="#00ff00">
                </div>

                <div class="form-group">
                  <label for="visualEffect">Visual Effect</label>
                  <select id="visualEffect">
                    <option value="default">Default</option>
                    <option value="speed_lines">Speed Lines</option>
                    <option value="particles">Particle Explosion</option>
                    <option value="rainbow_trail">Rainbow Trail</option>
                    <option value="electric_shock">Electric Shock</option>
                    <option value="custom">Custom</option>
                  </select>
                </div>
              </div>

              <div class="form-group">
                <label for="powerUpIcon">Icon</label>
                <div class="icon-selector">
                  <input type="text" id="powerUpIcon" placeholder="sprites/boosters/custom_icon.png">
                  <button type="button" id="browseIcon">Browse Assets</button>
                </div>
                <div class="icon-preview" id="iconPreview"></div>
              </div>
            </div>
          </div>

          <!-- Advanced Tab -->
          <div class="tab-content" id="tab-advanced">
            <div class="form-section">
              <h3>Advanced Settings</h3>
              
              <div class="form-group">
                <label for="powerUpLifetime">Power-up Lifetime (ms)</label>
                <input type="number" id="powerUpLifetime" min="5000" max="120000" step="1000" value="30000">
                <small>How long the power-up stays on the track</small>
              </div>

              <div class="form-group">
                <label for="collectionRadius">Collection Radius</label>
                <input type="number" id="collectionRadius" min="16" max="64" step="4" value="32">
                <small>How close players need to be to collect</small>
              </div>

              <div class="form-group">
                <label>Special Properties</label>
                <div class="checkbox-group">
                  <label><input type="checkbox" id="stackable"> Stackable with other effects</label>
                  <label><input type="checkbox" id="removeOnUse"> Remove immediately on use</label>
                  <label><input type="checkbox" id="affectsAllPlayers"> Affects all players when collected</label>
                </div>
              </div>

              <div class="form-group">
                <label for="soundEffect">Sound Effect</label>
                <select id="soundEffect">
                  <option value="">No Sound</option>
                  <option value="collect_boost">Collect Boost</option>
                  <option value="collect_rare">Collect Rare</option>
                  <option value="collect_legendary">Collect Legendary</option>
                  <option value="custom">Custom Sound</option>
                </select>
              </div>
            </div>
          </div>

          <!-- Preview Tab -->
          <div class="tab-content" id="tab-preview">
            <div class="form-section">
              <h3>Power-up Preview</h3>
              
              <div class="preview-container">
                <div class="preview-visual">
                  <canvas id="previewCanvas" width="200" height="200"></canvas>
                  <div class="preview-info">
                    <h4 id="previewName">Power-up Name</h4>
                    <p id="previewDescription">Description will appear here</p>
                    <div class="preview-stats">
                      <span class="stat"><strong>Rarity:</strong> <span id="previewRarity">Common</span></span>
                      <span class="stat"><strong>Duration:</strong> <span id="previewDuration">5.0s</span></span>
                      <span class="stat"><strong>Effect:</strong> <span id="previewEffect">Speed x1.5</span></span>
                    </div>
                  </div>
                </div>
                
                <div class="json-export">
                  <h4>JSON Configuration</h4>
                  <textarea id="jsonPreview" readonly></textarea>
                  <button type="button" id="copyJson">Copy to Clipboard</button>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Validation Panel -->
        <div class="validation-panel" id="validationPanel">
          <h4>Validation Results</h4>
          <div class="validation-content"></div>
        </div>
      </div>
    `;

    this.applyStyles();
  }

  /**
   * Apply CSS styles
   */
  applyStyles() {
    const style = document.createElement('style');
    style.textContent = `
      .power-up-editor {
        max-width: 800px;
        margin: 0 auto;
        padding: 20px;
        background: #2a2a2a;
        border-radius: 12px;
        color: #ffffff;
        font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
      }

      .editor-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 20px;
        padding-bottom: 15px;
        border-bottom: 2px solid #444;
      }

      .editor-header h2 {
        margin: 0;
        color: #00ff00;
        font-size: 24px;
      }

      .editor-actions {
        display: flex;
        gap: 10px;
      }

      .btn-primary, .btn-secondary {
        padding: 8px 16px;
        border: none;
        border-radius: 6px;
        cursor: pointer;
        font-size: 14px;
        transition: all 0.2s;
      }

      .btn-primary {
        background: #00ff00;
        color: #000;
      }

      .btn-primary:hover {
        background: #00cc00;
        transform: translateY(-1px);
      }

      .btn-secondary {
        background: #555;
        color: #fff;
      }

      .btn-secondary:hover {
        background: #666;
        transform: translateY(-1px);
      }

      .editor-tabs {
        display: flex;
        margin-bottom: 20px;
        border-bottom: 2px solid #444;
      }

      .tab-button {
        padding: 12px 20px;
        background: none;
        border: none;
        color: #ccc;
        cursor: pointer;
        border-bottom: 2px solid transparent;
        transition: all 0.2s;
      }

      .tab-button:hover {
        color: #fff;
        background: #333;
      }

      .tab-button.active {
        color: #00ff00;
        border-bottom-color: #00ff00;
      }

      .tab-content {
        display: none;
      }

      .tab-content.active {
        display: block;
      }

      .form-section {
        background: #333;
        padding: 20px;
        border-radius: 8px;
        margin-bottom: 15px;
      }

      .form-section h3 {
        margin: 0 0 20px 0;
        color: #00ff00;
        font-size: 18px;
      }

      .form-group {
        margin-bottom: 15px;
      }

      .form-row {
        display: flex;
        gap: 15px;
      }

      .form-row .form-group {
        flex: 1;
      }

      .form-group label {
        display: block;
        margin-bottom: 5px;
        color: #ccc;
        font-weight: 500;
      }

      .form-group input,
      .form-group select,
      .form-group textarea {
        width: 100%;
        padding: 8px 12px;
        background: #222;
        border: 1px solid #555;
        border-radius: 4px;
        color: #fff;
        font-size: 14px;
      }

      .form-group input:focus,
      .form-group select:focus,
      .form-group textarea:focus {
        outline: none;
        border-color: #00ff00;
        box-shadow: 0 0 0 2px rgba(0, 255, 0, 0.2);
      }

      .form-group small {
        display: block;
        margin-top: 3px;
        color: #999;
        font-size: 12px;
      }

      .form-group textarea {
        min-height: 80px;
        resize: vertical;
      }

      .radio-group {
        display: flex;
        gap: 15px;
        flex-wrap: wrap;
      }

      .radio-group label {
        display: flex;
        align-items: center;
        gap: 5px;
        cursor: pointer;
      }

      .checkbox-group {
        display: flex;
        flex-direction: column;
        gap: 8px;
      }

      .checkbox-group label {
        display: flex;
        align-items: center;
        gap: 8px;
        cursor: pointer;
      }

      .effect-config {
        display: none;
        margin-top: 15px;
        padding: 15px;
        background: #2a2a2a;
        border-radius: 6px;
      }

      .effect-config.active {
        display: block;
      }

      .icon-selector {
        display: flex;
        gap: 10px;
        align-items: center;
      }

      .icon-selector input {
        flex: 1;
      }

      .icon-preview {
        margin-top: 10px;
        min-height: 64px;
        background: #222;
        border: 1px solid #555;
        border-radius: 4px;
        display: flex;
        align-items: center;
        justify-content: center;
      }

      .preview-container {
        display: flex;
        gap: 20px;
      }

      .preview-visual {
        flex: 1;
      }

      .preview-visual canvas {
        background: #222;
        border: 2px solid #555;
        border-radius: 8px;
      }

      .preview-info {
        margin-top: 15px;
      }

      .preview-info h4 {
        margin: 0 0 8px 0;
        color: #00ff00;
      }

      .preview-stats {
        display: flex;
        flex-direction: column;
        gap: 5px;
        margin-top: 10px;
      }

      .preview-stats .stat {
        font-size: 14px;
      }

      .json-export {
        flex: 1;
      }

      .json-export h4 {
        margin: 0 0 10px 0;
        color: #00ff00;
      }

      .json-export textarea {
        min-height: 200px;
        font-family: 'Courier New', monospace;
        font-size: 12px;
      }

      .validation-panel {
        margin-top: 20px;
        padding: 15px;
        background: #333;
        border-radius: 8px;
        border-left: 4px solid #00ff00;
      }

      .validation-panel h4 {
        margin: 0 0 10px 0;
        color: #00ff00;
      }

      .validation-content {
        font-size: 14px;
      }

      .validation-error {
        color: #ff4444;
        margin: 5px 0;
      }

      .validation-warning {
        color: #ffaa00;
        margin: 5px 0;
      }

      .validation-success {
        color: #00ff00;
        margin: 5px 0;
      }

      @media (max-width: 768px) {
        .power-up-editor {
          padding: 15px;
        }

        .editor-header {
          flex-direction: column;
          gap: 15px;
          align-items: stretch;
        }

        .editor-actions {
          justify-content: center;
          flex-wrap: wrap;
        }

        .form-row {
          flex-direction: column;
        }

        .preview-container {
          flex-direction: column;
        }

        .editor-tabs {
          overflow-x: auto;
          white-space: nowrap;
        }
      }
    `;

    document.head.appendChild(style);
  }

  /**
   * Bind event listeners
   */
  bindEvents() {
    // Tab navigation
    this.container.querySelectorAll('.tab-button').forEach(button => {
      button.addEventListener('click', (e) => {
        this.switchTab(e.target.dataset.tab);
      });
    });

    // Form inputs
    this.bindFormEvents();

    // Action buttons
    this.bindActionEvents();

    // Effect type selection
    this.bindEffectTypeEvents();
  }

  /**
   * Bind form input events
   */
  bindFormEvents() {
    const inputs = [
      'powerUpId', 'powerUpName', 'powerUpDescription', 'powerUpRarity',
      'spawnWeight', 'speedMultiplier', 'effectDuration', 'glowColor',
      'visualEffect', 'powerUpIcon'
    ];

    inputs.forEach(inputId => {
      const element = this.container.querySelector(`#${inputId}`);
      if (element) {
        element.addEventListener('input', () => {
          this.updateCurrentPowerUp();
          this.validatePowerUp();
          this.updatePreview();
        });
      }
    });
  }

  /**
   * Bind action button events
   */
  bindActionEvents() {
    const actions = {
      'loadTemplate': () => this.showTemplateSelector(),
      'importPowerUp': () => this.importPowerUp(),
      'exportPowerUp': () => this.exportPowerUp(),
      'savePowerUp': () => this.savePowerUp(),
      'cancelEdit': () => this.cancelEdit(),
      'browseIcon': () => this.browseAssets(),
      'copyJson': () => this.copyJsonToClipboard()
    };

    Object.entries(actions).forEach(([id, handler]) => {
      const element = this.container.querySelector(`#${id}`);
      if (element) {
        element.addEventListener('click', handler);
      }
    });
  }

  /**
   * Bind effect type selection events
   */
  bindEffectTypeEvents() {
    this.container.querySelectorAll('input[name="effectType"]').forEach(radio => {
      radio.addEventListener('change', (e) => {
        this.switchEffectConfig(e.target.value);
        this.updateCurrentPowerUp();
        this.validatePowerUp();
        this.updatePreview();
      });
    });
  }

  /**
   * Switch to a different tab
   */
  switchTab(tabName) {
    // Update tab buttons
    this.container.querySelectorAll('.tab-button').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.tab === tabName);
    });

    // Update tab content
    this.container.querySelectorAll('.tab-content').forEach(content => {
      content.classList.toggle('active', content.id === `tab-${tabName}`);
    });

    this.uiState.activeTab = tabName;

    // Update preview when switching to preview tab
    if (tabName === 'preview') {
      this.updatePreview();
    }
  }

  /**
   * Switch effect configuration panel
   */
  switchEffectConfig(effectType) {
    this.container.querySelectorAll('.effect-config').forEach(config => {
      config.classList.toggle('active', config.id === `config-${effectType}`);
    });
  }

  /**
   * Update current power-up from form values
   */
  updateCurrentPowerUp() {
    const getValue = (id) => {
      const element = this.container.querySelector(`#${id}`);
      return element ? element.value : '';
    };

    const getChecked = (id) => {
      const element = this.container.querySelector(`#${id}`);
      return element ? element.checked : false;
    };

    // Basic info
    this.currentPowerUp.id = getValue('powerUpId');
    this.currentPowerUp.name = getValue('powerUpName');
    this.currentPowerUp.description = getValue('powerUpDescription');
    this.currentPowerUp.rarity = getValue('powerUpRarity');
    this.currentPowerUp.spawnWeight = parseFloat(getValue('spawnWeight')) || 0.1;
    this.currentPowerUp.glowColor = getValue('glowColor');
    this.currentPowerUp.icon = getValue('powerUpIcon');

    // Effects based on selected type
    const effectType = this.container.querySelector('input[name="effectType"]:checked')?.value || 'speed_boost';
    
    switch (effectType) {
      case 'speed_boost':
        this.currentPowerUp.effects = {
          speedMultiplier: parseFloat(getValue('speedMultiplier')) || 1.5,
          duration: parseInt(getValue('effectDuration')) || 5000,
          visualEffect: getValue('visualEffect') || 'default'
        };
        this.currentPowerUp.customEffect = null;
        break;

      case 'paralysis':
        this.currentPowerUp.effects = {
          type: 'paralysis',
          targets: getValue('paralysisTargets') || 'random',
          duration: parseInt(getValue('paralysisDuration')) || 3000,
          visualEffect: getValue('visualEffect') || 'electric_shock'
        };
        this.currentPowerUp.customEffect = null;
        break;

      case 'custom':
        try {
          const customConfig = getValue('customEffectConfig');
          this.currentPowerUp.customEffect = customConfig ? JSON.parse(customConfig) : null;
          if (this.currentPowerUp.customEffect) {
            this.currentPowerUp.customEffect.type = getValue('customEffectType');
          }
        } catch (error) {
          console.warn('[PowerUpEditor] Invalid JSON in custom effect config');
          this.currentPowerUp.customEffect = null;
        }
        break;
    }
  }

  /**
   * Validate current power-up
   */
  validatePowerUp() {
    if (this.options.powerUpManager) {
      this.validationResult = this.options.powerUpManager.validateCustomPowerUp(this.currentPowerUp);
    } else {
      // Basic validation without PowerUpManager
      this.validationResult = new PowerUpValidationResult(true);
      
      if (!this.currentPowerUp.id) {
        this.validationResult.addError('Power-up ID is required');
      }
      
      if (!this.currentPowerUp.name) {
        this.validationResult.addError('Power-up name is required');
      }
    }

    this.updateValidationDisplay();
  }

  /**
   * Update validation display
   */
  updateValidationDisplay() {
    const validationContent = this.container.querySelector('.validation-content');
    if (!validationContent) return;

    if (!this.validationResult) {
      validationContent.innerHTML = '<div class="validation-success">Ready to validate...</div>';
      return;
    }

    let html = '';

    if (this.validationResult.valid) {
      html += '<div class="validation-success">✓ Power-up configuration is valid!</div>';
    }

    this.validationResult.errors.forEach(error => {
      html += `<div class="validation-error">✗ Error: ${error}</div>`;
    });

    this.validationResult.warnings.forEach(warning => {
      html += `<div class="validation-warning">⚠ Warning: ${warning}</div>`;
    });

    validationContent.innerHTML = html;
  }

  /**
   * Update preview display
   */
  updatePreview() {
    // Update preview info
    const previewName = this.container.querySelector('#previewName');
    const previewDescription = this.container.querySelector('#previewDescription');
    const previewRarity = this.container.querySelector('#previewRarity');
    const previewDuration = this.container.querySelector('#previewDuration');
    const previewEffect = this.container.querySelector('#previewEffect');

    if (previewName) previewName.textContent = this.currentPowerUp.name || 'Unnamed Power-up';
    if (previewDescription) previewDescription.textContent = this.currentPowerUp.description || 'No description';
    if (previewRarity) previewRarity.textContent = this.currentPowerUp.rarity || 'common';
    
    const duration = this.currentPowerUp.effects?.duration || 5000;
    if (previewDuration) previewDuration.textContent = `${(duration / 1000).toFixed(1)}s`;
    
    let effectText = 'Unknown Effect';
    if (this.currentPowerUp.effects?.speedMultiplier) {
      effectText = `Speed x${this.currentPowerUp.effects.speedMultiplier}`;
    } else if (this.currentPowerUp.effects?.type === 'paralysis') {
      effectText = 'Paralysis Effect';
    } else if (this.currentPowerUp.customEffect) {
      effectText = `Custom: ${this.currentPowerUp.customEffect.type || 'Unknown'}`;
    }
    if (previewEffect) previewEffect.textContent = effectText;

    // Update JSON preview
    this.updateJsonPreview();

    // Update visual preview (canvas)
    this.updateCanvasPreview();
  }

  /**
   * Update JSON preview
   */
  updateJsonPreview() {
    const jsonPreview = this.container.querySelector('#jsonPreview');
    if (jsonPreview) {
      jsonPreview.value = JSON.stringify(this.currentPowerUp, null, 2);
    }
  }

  /**
   * Update canvas preview
   */
  updateCanvasPreview() {
    const canvas = this.container.querySelector('#previewCanvas');
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Draw a simple representation of the power-up
    const centerX = canvas.width / 2;
    const centerY = canvas.height / 2;
    const radius = 30;

    // Glow effect
    const glowColor = this.currentPowerUp.glowColor || '#00ff00';
    const gradient = ctx.createRadialGradient(centerX, centerY, 0, centerX, centerY, radius + 20);
    gradient.addColorStop(0, glowColor + '80');
    gradient.addColorStop(1, glowColor + '00');
    
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Main power-up circle
    ctx.beginPath();
    ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
    ctx.fillStyle = glowColor;
    ctx.fill();
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2;
    ctx.stroke();

    // Rarity indicator
    const rarityColors = {
      common: '#cccccc',
      uncommon: '#00ff00',
      rare: '#0066ff',
      legendary: '#ff6600'
    };
    
    ctx.beginPath();
    ctx.arc(centerX, centerY, radius - 5, 0, Math.PI * 2);
    ctx.strokeStyle = rarityColors[this.currentPowerUp.rarity] || '#cccccc';
    ctx.lineWidth = 3;
    ctx.stroke();

    // Effect type indicator
    ctx.fillStyle = '#ffffff';
    ctx.font = '12px Arial';
    ctx.textAlign = 'center';
    let effectSymbol = '?';
    
    if (this.currentPowerUp.effects?.speedMultiplier) {
      effectSymbol = '»';
    } else if (this.currentPowerUp.effects?.type === 'paralysis') {
      effectSymbol = '⚡';
    } else if (this.currentPowerUp.customEffect) {
      effectSymbol = '★';
    }
    
    ctx.fillText(effectSymbol, centerX, centerY + 4);
  }

  /**
   * Load power-up from template
   */
  showTemplateSelector() {
    const templateOptions = Object.keys(this.templates).map(key => 
      `<option value="${key}">${this.templates[key].name}</option>`
    ).join('');

    const templateSelect = prompt('Select a template:\n' + Object.keys(this.templates).map((key, index) => 
      `${index + 1}. ${this.templates[key].name}`
    ).join('\n') + '\n\nEnter template number:');

    if (templateSelect) {
      const templateIndex = parseInt(templateSelect) - 1;
      const templateKeys = Object.keys(this.templates);
      
      if (templateIndex >= 0 && templateIndex < templateKeys.length) {
        const templateKey = templateKeys[templateIndex];
        this.loadTemplate(templateKey);
      }
    }
  }

  /**
   * Load a specific template
   */
  loadTemplate(templateKey) {
    const template = this.templates[templateKey];
    if (!template) return;

    // Generate unique ID based on template
    const uniqueId = `${templateKey}_${Date.now()}`;
    
    this.currentPowerUp = {
      id: uniqueId,
      ...template
    };

    this.populateFormFromPowerUp();
    this.validatePowerUp();
    this.updatePreview();

    console.log(`[PowerUpEditor] Loaded template: ${templateKey}`);
  }

  /**
   * Populate form from current power-up
   */
  populateFormFromPowerUp() {
    const setValue = (id, value) => {
      const element = this.container.querySelector(`#${id}`);
      if (element) element.value = value || '';
    };

    const setChecked = (id, checked) => {
      const element = this.container.querySelector(`#${id}`);
      if (element) element.checked = checked || false;
    };

    setValue('powerUpId', this.currentPowerUp.id);
    setValue('powerUpName', this.currentPowerUp.name);
    setValue('powerUpDescription', this.currentPowerUp.description);
    setValue('powerUpRarity', this.currentPowerUp.rarity);
    setValue('spawnWeight', this.currentPowerUp.spawnWeight);
    setValue('glowColor', this.currentPowerUp.glowColor);
    setValue('powerUpIcon', this.currentPowerUp.icon);

    // Set effect type and values
    if (this.currentPowerUp.customEffect) {
      this.container.querySelector('input[name="effectType"][value="custom"]').checked = true;
      setValue('customEffectType', this.currentPowerUp.customEffect.type);
      setValue('customEffectConfig', JSON.stringify(this.currentPowerUp.customEffect, null, 2));
      this.switchEffectConfig('custom');
    } else if (this.currentPowerUp.effects?.type === 'paralysis') {
      this.container.querySelector('input[name="effectType"][value="paralysis"]').checked = true;
      setValue('paralysisTargets', this.currentPowerUp.effects.targets);
      setValue('paralysisDuration', this.currentPowerUp.effects.duration);
      this.switchEffectConfig('paralysis');
    } else {
      this.container.querySelector('input[name="effectType"][value="speed_boost"]').checked = true;
      setValue('speedMultiplier', this.currentPowerUp.effects?.speedMultiplier);
      setValue('effectDuration', this.currentPowerUp.effects?.duration);
      this.switchEffectConfig('speed_boost');
    }

    setValue('visualEffect', this.currentPowerUp.effects?.visualEffect);
  }

  /**
   * Import power-up from JSON
   */
  importPowerUp() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    
    input.onchange = (e) => {
      const file = e.target.files[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const powerUpData = JSON.parse(e.target.result);
          this.currentPowerUp = powerUpData;
          this.populateFormFromPowerUp();
          this.validatePowerUp();
          this.updatePreview();
          
          console.log('[PowerUpEditor] Imported power-up from file');
        } catch (error) {
          alert('Error importing power-up: Invalid JSON file');
          console.error('[PowerUpEditor] Import error:', error);
        }
      };
      reader.readAsText(file);
    };

    input.click();
  }

  /**
   * Export power-up to JSON
   */
  exportPowerUp() {
    const dataStr = JSON.stringify(this.currentPowerUp, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    
    const link = document.createElement('a');
    link.href = URL.createObjectURL(dataBlob);
    link.download = `${this.currentPowerUp.id || 'power_up'}.json`;
    link.click();
    
    console.log('[PowerUpEditor] Exported power-up to file');
  }

  /**
   * Save power-up
   */
  savePowerUp() {
    this.updateCurrentPowerUp();
    this.validatePowerUp();

    if (!this.validationResult?.valid) {
      alert('Cannot save power-up: Please fix validation errors first');
      return;
    }

    if (this.options.powerUpManager) {
      try {
        this.options.powerUpManager.addCustomPowerUp(this.currentPowerUp);
        console.log('[PowerUpEditor] Power-up saved to manager');
      } catch (error) {
        alert(`Error saving power-up: ${error.message}`);
        return;
      }
    }

    if (this.options.onSave) {
      this.options.onSave(this.currentPowerUp);
    }

    alert(`Power-up "${this.currentPowerUp.name}" saved successfully!`);
  }

  /**
   * Cancel editing
   */
  cancelEdit() {
    if (this.options.onCancel) {
      this.options.onCancel();
    } else {
      this.container.style.display = 'none';
    }
  }

  /**
   * Browse assets (placeholder)
   */
  browseAssets() {
    // This would integrate with AssetBrowser in a real implementation
    alert('Asset browser integration would go here');
  }

  /**
   * Copy JSON to clipboard
   */
  async copyJsonToClipboard() {
    const jsonPreview = this.container.querySelector('#jsonPreview');
    if (jsonPreview) {
      try {
        await navigator.clipboard.writeText(jsonPreview.value);
        alert('JSON copied to clipboard!');
      } catch (error) {
        console.error('[PowerUpEditor] Failed to copy to clipboard:', error);
        // Fallback selection method
        jsonPreview.select();
        document.execCommand('copy');
      }
    }
  }

  /**
   * Show the editor
   */
  show() {
    this.container.style.display = 'block';
    this.updatePreview();
  }

  /**
   * Hide the editor
   */
  hide() {
    this.container.style.display = 'none';
  }

  /**
   * Toggle editor visibility
   */
  toggle() {
    if (this.container.style.display === 'none') {
      this.show();
    } else {
      this.hide();
    }
  }

  /**
   * Get the DOM element for this component
   * Required for AnimationManager integration
   */
  getElement() {
    return this.container;
  }

  /**
   * Load existing power-up for editing
   */
  editPowerUp(powerUpData) {
    this.currentPowerUp = { ...powerUpData };
    this.isEditing = true;
    this.populateFormFromPowerUp();
    this.validatePowerUp();
    this.updatePreview();
    this.show();
  }

  /**
   * Create new power-up
   */
  createNew() {
    this.currentPowerUp = this.createDefaultPowerUp();
    this.isEditing = false;
    this.populateFormFromPowerUp();
    this.validatePowerUp();
    this.updatePreview();
    this.show();
  }

  /**
   * Destroy the editor
   */
  destroy() {
    this.container.innerHTML = '';
    console.log('[PowerUpEditor] Power-up editor destroyed');
  }
}

export default PowerUpEditor;