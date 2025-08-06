/**
 * PresetManager.js - Game Configuration Preset Management Component
 * 
 * Manages game configuration presets including:
 * - Saving/loading preset configurations
 * - Import/export of preset files (JSON)
 * - Categories for different preset types (game modes, visual themes, difficulty settings)
 * - Preview system for preset effects
 * - Integration with ConfigManager system
 * 
 * Supports categories: Game Mode, Visual Theme, Difficulty, Custom, and Complete Config presets
 */

import { ConfigType } from '../../game/systems/ConfigManager';

export class PresetManager {
    constructor(uiManager) {
        this.uiManager = uiManager;
        this.isVisible = false;
        
        // Preset categories and their associated config types
        this.presetCategories = {
            'game-mode': {
                name: 'Game Mode',
                icon: '🏁',
                description: 'Racing game mode configurations',
                configTypes: [ConfigType.GAME_SETTINGS, ConfigType.MULTIPLAYER_SETTINGS],
                color: '#00ff00'
            },
            'visual-theme': {
                name: 'Visual Theme',
                icon: '🎨',
                description: 'Visual appearance and UI themes',
                configTypes: [ConfigType.VISUAL_SETTINGS, ConfigType.AUDIO_SETTINGS],
                color: '#ff6600'
            },
            'difficulty': {
                name: 'Difficulty',
                icon: '⚡',
                description: 'Game difficulty and challenge settings',
                configTypes: [ConfigType.GAME_SETTINGS, ConfigType.POWER_UP_DEFINITIONS],
                color: '#ffff00'
            },
            'track-setup': {
                name: 'Track Setup',
                icon: '🛣️',
                description: 'Track and map configurations',
                configTypes: [ConfigType.TRACK_CONFIGURATIONS],
                color: '#00ffff'
            },
            'player-config': {
                name: 'Player Config',
                icon: '👤',
                description: 'Player and AI configurations',
                configTypes: [ConfigType.PLAYER_PREFERENCES],
                color: '#ff00ff'
            },
            'complete': {
                name: 'Complete Config',
                icon: '📦',
                description: 'Full game configuration packages',
                configTypes: Object.values(ConfigType),
                color: '#ffffff'
            }
        };
        
        // Current state
        this.currentCategory = 'game-mode';
        this.selectedPreset = null;
        this.presets = new Map(); // Store presets by category
        this.isImporting = false;
        this.isExporting = false;
        
        // File handling
        this.supportedFormats = ['.json', '.preset'];
        this.maxFileSize = 1024 * 1024; // 1MB limit
        
        console.log('[PresetManager] Preset manager initialized');
    }

    /**
     * Initialize the preset manager
     */
    async initialize() {
        this.createPanelContent();
        this.setupEventListeners();
        await this.loadDefaultPresets();
        this.updatePresetDisplay();
        console.log('[PresetManager] Panel initialized');
    }

    /**
     * Create preset manager panel content structure
     */
    createPanelContent() {
        const panel = document.getElementById('preset-manager-panel');
        if (!panel) return;

        panel.innerHTML = `
            <div class="panel-header">
                <div class="panel-title">
                    <span class="title-text">PRESET MANAGER</span>
                    <div class="panel-controls">
                        <button class="control-btn refresh-btn" id="refresh-presets" title="Refresh Presets">
                            🔄
                        </button>
                        <button class="control-btn toggle-btn" id="toggle-preset-manager" title="Toggle">
                            ⚙️
                        </button>
                    </div>
                </div>
            </div>
            
            <div class="panel-body preset-manager-content">
                <div class="preset-categories" id="preset-categories">
                    ${this.renderCategoryTabs()}
                </div>
                
                <div class="current-category-info" id="current-category-info">
                    ${this.renderCategoryInfo()}
                </div>
                
                <div class="preset-list-container">
                    <div class="preset-list" id="preset-list">
                        ${this.renderPresetList()}
                    </div>
                </div>
                
                <div class="preset-actions">
                    <div class="action-group quick-actions">
                        <button class="action-btn create-btn" id="create-preset">
                            <span class="btn-icon">➕</span>
                            Create New
                        </button>
                        <button class="action-btn save-btn" id="save-current" disabled>
                            <span class="btn-icon">💾</span>
                            Save Current
                        </button>
                        <button class="action-btn load-btn" id="load-preset" disabled>
                            <span class="btn-icon">📁</span>
                            Load Selected
                        </button>
                    </div>
                    
                    <div class="action-group file-actions">
                        <button class="action-btn import-btn" id="import-preset">
                            <span class="btn-icon">📥</span>
                            Import File
                        </button>
                        <button class="action-btn export-btn" id="export-preset" disabled>
                            <span class="btn-icon">📤</span>
                            Export Selected
                        </button>
                    </div>
                </div>
                
                <div class="preset-preview-section" id="preset-preview-section" style="display: none;">
                    <div class="preview-header">
                        <span class="preview-title">PRESET PREVIEW</span>
                        <button class="preview-close-btn" id="close-preview">✕</button>
                    </div>
                    <div class="preview-content" id="preview-content">
                        <!-- Preview content will be dynamically populated -->
                    </div>
                </div>
                
                <div class="preset-creation-modal" id="preset-creation-modal" style="display: none;">
                    <div class="modal-content">
                        <div class="modal-header">
                            <h3>Create New Preset</h3>
                            <button class="close-btn" id="close-creation-modal">✕</button>
                        </div>
                        <div class="modal-body">
                            <div class="form-group">
                                <label for="preset-name-input">Preset Name:</label>
                                <input type="text" id="preset-name-input" class="form-input" 
                                       placeholder="Enter preset name" maxlength="32">
                            </div>
                            <div class="form-group">
                                <label for="preset-description-input">Description:</label>
                                <textarea id="preset-description-input" class="form-textarea" 
                                          placeholder="Enter preset description" maxlength="200" rows="3"></textarea>
                            </div>
                            <div class="form-group">
                                <label>Configuration Source:</label>
                                <div class="config-source-options">
                                    <label class="radio-option">
                                        <input type="radio" name="config-source" value="current" checked>
                                        <span>Current Game Settings</span>
                                    </label>
                                    <label class="radio-option">
                                        <input type="radio" name="config-source" value="default">
                                        <span>Default Settings</span>
                                    </label>
                                    <label class="radio-option">
                                        <input type="radio" name="config-source" value="custom">
                                        <span>Custom Configuration</span>
                                    </label>
                                </div>
                            </div>
                        </div>
                        <div class="modal-actions">
                            <button class="action-btn cancel-btn" id="cancel-creation">Cancel</button>
                            <button class="action-btn confirm-btn" id="confirm-creation">Create Preset</button>
                        </div>
                    </div>
                </div>
                
                <input type="file" id="preset-file-input" accept=".json,.preset" style="display: none;">
            </div>
        `;
    }

    /**
     * Render category tabs
     */
    renderCategoryTabs() {
        return Object.entries(this.presetCategories).map(([key, category]) => `
            <button class="category-tab ${key === this.currentCategory ? 'active' : ''}" 
                    data-category="${key}" style="border-color: ${category.color}33; color: ${category.color}">
                <span class="tab-icon">${category.icon}</span>
                <span class="tab-name">${category.name}</span>
            </button>
        `).join('');
    }

    /**
     * Render current category information
     */
    renderCategoryInfo() {
        const category = this.presetCategories[this.currentCategory];
        return `
            <div class="category-header">
                <span class="category-icon">${category.icon}</span>
                <span class="category-name">${category.name}</span>
            </div>
            <div class="category-description">${category.description}</div>
            <div class="category-stats">
                <span class="preset-count">${this.getPresetCount(this.currentCategory)} presets</span>
                <span class="config-types">${category.configTypes.length} config types</span>
            </div>
        `;
    }

    /**
     * Render preset list for current category
     */
    renderPresetList() {
        const categoryPresets = this.presets.get(this.currentCategory) || [];
        
        if (categoryPresets.length === 0) {
            return `
                <div class="empty-preset-list">
                    <div class="empty-icon">📂</div>
                    <div class="empty-text">No presets in this category</div>
                    <div class="empty-subtitle">Create your first preset to get started</div>
                </div>
            `;
        }

        return categoryPresets.map(preset => `
            <div class="preset-item ${preset.id === this.selectedPreset?.id ? 'selected' : ''}" 
                 data-preset-id="${preset.id}">
                <div class="preset-header">
                    <div class="preset-icon">${this.presetCategories[this.currentCategory].icon}</div>
                    <div class="preset-info">
                        <div class="preset-name">${preset.name}</div>
                        <div class="preset-meta">
                            <span class="preset-author">${preset.author || 'Unknown'}</span>
                            <span class="preset-date">${this.formatDate(preset.createdAt)}</span>
                        </div>
                    </div>
                    <div class="preset-actions">
                        <button class="preset-action-btn preview-btn" data-action="preview" 
                                title="Preview Preset">👁️</button>
                        <button class="preset-action-btn edit-btn" data-action="edit" 
                                title="Edit Preset">✏️</button>
                        <button class="preset-action-btn delete-btn" data-action="delete" 
                                title="Delete Preset">🗑️</button>
                    </div>
                </div>
                <div class="preset-description">${preset.description || 'No description available'}</div>
                <div class="preset-tags">
                    ${(preset.tags || []).map(tag => `<span class="preset-tag">${tag}</span>`).join('')}
                </div>
            </div>
        `).join('');
    }

    /**
     * Setup event listeners for preset manager interactions
     */
    setupEventListeners() {
        // Category tabs
        document.addEventListener('click', (e) => {
            if (e.target.matches('.category-tab, .category-tab *')) {
                const tab = e.target.closest('.category-tab');
                const category = tab.dataset.category;
                this.switchCategory(category);
            }
        });

        // Preset list interactions
        document.addEventListener('click', (e) => {
            if (e.target.matches('.preset-item, .preset-item .preset-info, .preset-item .preset-info *')) {
                const item = e.target.closest('.preset-item');
                const presetId = item.dataset.presetId;
                this.selectPreset(presetId);
            }
        });

        // Preset action buttons
        document.addEventListener('click', (e) => {
            if (e.target.matches('.preset-action-btn')) {
                const action = e.target.dataset.action;
                const presetId = e.target.closest('.preset-item').dataset.presetId;
                this.handlePresetAction(action, presetId);
            }
        });

        // Main action buttons
        const createBtn = document.getElementById('create-preset');
        if (createBtn) {
            createBtn.addEventListener('click', () => this.showCreatePresetModal());
        }

        const saveBtn = document.getElementById('save-current');
        if (saveBtn) {
            saveBtn.addEventListener('click', () => this.saveCurrentAsPreset());
        }

        const loadBtn = document.getElementById('load-preset');
        if (loadBtn) {
            loadBtn.addEventListener('click', () => this.loadSelectedPreset());
        }

        const importBtn = document.getElementById('import-preset');
        if (importBtn) {
            importBtn.addEventListener('click', () => this.showImportDialog());
        }

        const exportBtn = document.getElementById('export-preset');
        if (exportBtn) {
            exportBtn.addEventListener('click', () => this.exportSelectedPreset());
        }

        const refreshBtn = document.getElementById('refresh-presets');
        if (refreshBtn) {
            refreshBtn.addEventListener('click', () => this.refreshPresets());
        }

        // Toggle button
        const toggleBtn = document.getElementById('toggle-preset-manager');
        if (toggleBtn) {
            toggleBtn.addEventListener('click', () => this.toggle());
        }

        // File input
        const fileInput = document.getElementById('preset-file-input');
        if (fileInput) {
            fileInput.addEventListener('change', (e) => this.handleFileImport(e.target.files[0]));
        }

        // Modal interactions
        this.setupModalEventListeners();

        // Preview section
        const closePreview = document.getElementById('close-preview');
        if (closePreview) {
            closePreview.addEventListener('click', () => this.hidePreview());
        }
    }

    /**
     * Setup modal event listeners
     */
    setupModalEventListeners() {
        const closeModalBtn = document.getElementById('close-creation-modal');
        if (closeModalBtn) {
            closeModalBtn.addEventListener('click', () => this.hideCreatePresetModal());
        }

        const cancelBtn = document.getElementById('cancel-creation');
        if (cancelBtn) {
            cancelBtn.addEventListener('click', () => this.hideCreatePresetModal());
        }

        const confirmBtn = document.getElementById('confirm-creation');
        if (confirmBtn) {
            confirmBtn.addEventListener('click', () => this.createPresetFromModal());
        }

        // Close modal on outside click
        document.addEventListener('click', (e) => {
            const modal = document.getElementById('preset-creation-modal');
            if (e.target === modal) {
                this.hideCreatePresetModal();
            }
        });
    }

    /**
     * Load default presets
     */
    async loadDefaultPresets() {
        try {
            // Initialize preset storage for each category
            Object.keys(this.presetCategories).forEach(category => {
                this.presets.set(category, []);
            });

            // Create some default presets
            await this.createDefaultPresets();
            
            console.log('[PresetManager] Default presets loaded');
        } catch (error) {
            console.error('[PresetManager] Failed to load default presets:', error);
            this.showNotification('Failed to load default presets', 'error');
        }
    }

    /**
     * Create default presets
     */
    async createDefaultPresets() {
        const defaultPresets = [
            {
                category: 'game-mode',
                name: 'Classic Racing',
                description: 'Traditional racing mode with balanced settings',
                author: 'System',
                tags: ['classic', 'balanced'],
                config: {
                    [ConfigType.GAME_SETTINGS]: {
                        game: { maxPlayers: 6, raceTimeLimit: 300 },
                        movement: { baseSpeed: 100, maxSpeed: 300 }
                    }
                }
            },
            {
                category: 'game-mode',
                name: 'Speed Demon',
                description: 'High-speed racing with increased player speeds',
                author: 'System',
                tags: ['fast', 'intense'],
                config: {
                    [ConfigType.GAME_SETTINGS]: {
                        game: { maxPlayers: 6, raceTimeLimit: 180 },
                        movement: { baseSpeed: 200, maxSpeed: 500 }
                    }
                }
            },
            {
                category: 'difficulty',
                name: 'Easy Mode',
                description: 'Beginner-friendly settings with extra time',
                author: 'System',
                tags: ['easy', 'beginner'],
                config: {
                    [ConfigType.GAME_SETTINGS]: {
                        game: { raceTimeLimit: 480 },
                        movement: { stuckTimeoutFrames: 60 }
                    }
                }
            },
            {
                category: 'visual-theme',
                name: 'Retro Green',
                description: 'Classic terminal green theme',
                author: 'System',
                tags: ['retro', 'classic'],
                config: {
                    [ConfigType.VISUAL_SETTINGS]: {
                        theme: 'terminal-green',
                        pixelArt: true
                    }
                }
            }
        ];

        for (const presetData of defaultPresets) {
            const preset = this.createPresetObject(presetData);
            const categoryPresets = this.presets.get(presetData.category) || [];
            categoryPresets.push(preset);
            this.presets.set(presetData.category, categoryPresets);
        }
    }

    /**
     * Create preset object with metadata
     */
    createPresetObject(data) {
        return {
            id: this.generatePresetId(),
            name: data.name,
            description: data.description,
            author: data.author || 'Unknown',
            tags: data.tags || [],
            category: data.category,
            config: data.config,
            createdAt: Date.now(),
            modifiedAt: Date.now(),
            version: '1.0.0'
        };
    }

    /**
     * Generate unique preset ID
     */
    generatePresetId() {
        return `preset_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    /**
     * Switch to different category
     */
    switchCategory(category) {
        if (category === this.currentCategory) return;
        
        this.currentCategory = category;
        this.selectedPreset = null;
        this.updateCategoryDisplay();
        this.updatePresetDisplay();
        this.updateActionButtons();
        this.hidePreview();
        
        console.log(`[PresetManager] Switched to category: ${category}`);
    }

    /**
     * Update category display
     */
    updateCategoryDisplay() {
        // Update tab states
        document.querySelectorAll('.category-tab').forEach(tab => {
            tab.classList.toggle('active', tab.dataset.category === this.currentCategory);
        });

        // Update category info
        const categoryInfo = document.getElementById('current-category-info');
        if (categoryInfo) {
            categoryInfo.innerHTML = this.renderCategoryInfo();
        }
    }

    /**
     * Update preset list display
     */
    updatePresetDisplay() {
        const presetList = document.getElementById('preset-list');
        if (presetList) {
            presetList.innerHTML = this.renderPresetList();
        }
    }

    /**
     * Select a preset
     */
    selectPreset(presetId) {
        const categoryPresets = this.presets.get(this.currentCategory) || [];
        this.selectedPreset = categoryPresets.find(p => p.id === presetId);
        
        this.updatePresetDisplay();
        this.updateActionButtons();
        
        if (this.selectedPreset) {
            console.log(`[PresetManager] Selected preset: ${this.selectedPreset.name}`);
        }
    }

    /**
     * Update action button states
     */
    updateActionButtons() {
        const saveBtn = document.getElementById('save-current');
        const loadBtn = document.getElementById('load-preset');
        const exportBtn = document.getElementById('export-preset');
        
        const hasSelection = !!this.selectedPreset;
        const hasConfigManager = this.uiManager?.game?.configManager;
        
        if (saveBtn) saveBtn.disabled = !hasConfigManager;
        if (loadBtn) loadBtn.disabled = !hasSelection || !hasConfigManager;
        if (exportBtn) exportBtn.disabled = !hasSelection;
    }

    /**
     * Handle preset actions (preview, edit, delete)
     */
    handlePresetAction(action, presetId) {
        const categoryPresets = this.presets.get(this.currentCategory) || [];
        const preset = categoryPresets.find(p => p.id === presetId);
        
        if (!preset) return;
        
        switch (action) {
            case 'preview':
                this.showPresetPreview(preset);
                break;
            case 'edit':
                this.editPreset(preset);
                break;
            case 'delete':
                this.deletePreset(preset);
                break;
        }
    }

    /**
     * Show preset preview
     */
    showPresetPreview(preset) {
        const previewSection = document.getElementById('preset-preview-section');
        const previewContent = document.getElementById('preview-content');
        
        if (!previewSection || !previewContent) return;
        
        previewContent.innerHTML = `
            <div class="preview-preset-info">
                <h4>${preset.name}</h4>
                <p class="preview-description">${preset.description}</p>
                <div class="preview-meta">
                    <span class="preview-author">By: ${preset.author}</span>
                    <span class="preview-date">Created: ${this.formatDate(preset.createdAt)}</span>
                </div>
            </div>
            <div class="preview-config-summary">
                <h5>Configuration Summary:</h5>
                <div class="config-items">
                    ${this.renderConfigSummary(preset.config)}
                </div>
            </div>
            <div class="preview-actions">
                <button class="action-btn apply-btn" id="apply-preview-preset">
                    Apply This Preset
                </button>
            </div>
        `;
        
        previewSection.style.display = 'block';
        
        // Setup apply button
        const applyBtn = document.getElementById('apply-preview-preset');
        if (applyBtn) {
            applyBtn.addEventListener('click', () => {
                this.applyPreset(preset);
                this.hidePreview();
            });
        }
    }

    /**
     * Render configuration summary
     */
    renderConfigSummary(config) {
        const items = [];
        
        Object.entries(config).forEach(([configType, configData]) => {
            const category = this.presetCategories[this.currentCategory];
            if (category.configTypes.includes(configType)) {
                items.push(`
                    <div class="config-item">
                        <span class="config-type">${configType}</span>
                        <span class="config-changes">${Object.keys(configData).length} settings</span>
                    </div>
                `);
            }
        });
        
        return items.join('') || '<div class="no-config">No configuration data</div>';
    }

    /**
     * Hide preset preview
     */
    hidePreview() {
        const previewSection = document.getElementById('preset-preview-section');
        if (previewSection) {
            previewSection.style.display = 'none';
        }
    }

    /**
     * Show create preset modal
     */
    showCreatePresetModal() {
        const modal = document.getElementById('preset-creation-modal');
        if (modal) {
            modal.style.display = 'flex';
            
            // Clear form
            const nameInput = document.getElementById('preset-name-input');
            const descInput = document.getElementById('preset-description-input');
            if (nameInput) nameInput.value = '';
            if (descInput) descInput.value = '';
            
            // Focus name input
            if (nameInput) nameInput.focus();
        }
    }

    /**
     * Hide create preset modal
     */
    hideCreatePresetModal() {
        const modal = document.getElementById('preset-creation-modal');
        if (modal) {
            modal.style.display = 'none';
        }
    }

    /**
     * Create preset from modal form
     */
    async createPresetFromModal() {
        const nameInput = document.getElementById('preset-name-input');
        const descInput = document.getElementById('preset-description-input');
        const sourceRadios = document.querySelectorAll('input[name="config-source"]');
        
        const name = nameInput?.value.trim();
        const description = descInput?.value.trim();
        const source = Array.from(sourceRadios).find(r => r.checked)?.value || 'current';
        
        if (!name) {
            this.showNotification('Please enter a preset name', 'error');
            return;
        }
        
        try {
            let config = {};
            
            // Get configuration based on source
            switch (source) {
                case 'current':
                    config = await this.getCurrentGameConfig();
                    break;
                case 'default':
                    config = await this.getDefaultConfig();
                    break;
                case 'custom':
                    // For now, use current config - could extend for custom editor
                    config = await this.getCurrentGameConfig();
                    break;
            }
            
            const preset = this.createPresetObject({
                category: this.currentCategory,
                name,
                description: description || `Custom ${this.presetCategories[this.currentCategory].name} preset`,
                author: 'User',
                tags: ['custom'],
                config
            });
            
            // Add to presets
            const categoryPresets = this.presets.get(this.currentCategory) || [];
            categoryPresets.push(preset);
            this.presets.set(this.currentCategory, categoryPresets);
            
            // Update display
            this.updatePresetDisplay();
            this.selectPreset(preset.id);
            this.hideCreatePresetModal();
            
            this.showNotification(`Preset "${name}" created successfully`, 'success');
            
        } catch (error) {
            console.error('[PresetManager] Failed to create preset:', error);
            this.showNotification('Failed to create preset', 'error');
        }
    }

    /**
     * Get current game configuration
     */
    async getCurrentGameConfig() {
        if (!this.uiManager?.game?.configManager) {
            throw new Error('ConfigManager not available');
        }
        
        const configManager = this.uiManager.game.configManager;
        const category = this.presetCategories[this.currentCategory];
        const config = {};
        
        for (const configType of category.configTypes) {
            try {
                const configData = configManager.getConfiguration(configType);
                if (configData) {
                    config[configType] = configData;
                }
            } catch (error) {
                console.warn(`[PresetManager] Could not get config for ${configType}:`, error);
            }
        }
        
        return config;
    }

    /**
     * Get default configuration
     */
    async getDefaultConfig() {
        // Return default/baseline configuration
        const category = this.presetCategories[this.currentCategory];
        const config = {};
        
        // Basic defaults - in real implementation, would load from default files
        for (const configType of category.configTypes) {
            switch (configType) {
                case ConfigType.GAME_SETTINGS:
                    config[configType] = {
                        game: { maxPlayers: 6, raceTimeLimit: 300 },
                        movement: { baseSpeed: 100, maxSpeed: 300 }
                    };
                    break;
                case ConfigType.VISUAL_SETTINGS:
                    config[configType] = {
                        theme: 'default',
                        pixelArt: true
                    };
                    break;
                // Add other defaults as needed
            }
        }
        
        return config;
    }

    /**
     * Apply preset to game
     */
    async applyPreset(preset) {
        if (!this.uiManager?.game?.configManager) {
            this.showNotification('ConfigManager not available', 'error');
            return;
        }
        
        try {
            const configManager = this.uiManager.game.configManager;
            
            for (const [configType, configData] of Object.entries(preset.config)) {
                await configManager.updateConfiguration(configType, configData, {
                    validate: true,
                    merge: true
                });
            }
            
            this.showNotification(`Preset "${preset.name}" applied successfully`, 'success');
            
        } catch (error) {
            console.error('[PresetManager] Failed to apply preset:', error);
            this.showNotification('Failed to apply preset', 'error');
        }
    }

    /**
     * Load selected preset
     */
    async loadSelectedPreset() {
        if (!this.selectedPreset) return;
        await this.applyPreset(this.selectedPreset);
    }

    /**
     * Save current configuration as preset
     */
    async saveCurrentAsPreset() {
        try {
            const config = await this.getCurrentGameConfig();
            const timestamp = new Date().toLocaleTimeString();
            
            const preset = this.createPresetObject({
                category: this.currentCategory,
                name: `Current Settings ${timestamp}`,
                description: `Saved configuration from ${new Date().toLocaleDateString()}`,
                author: 'User',
                tags: ['saved', 'current'],
                config
            });
            
            const categoryPresets = this.presets.get(this.currentCategory) || [];
            categoryPresets.push(preset);
            this.presets.set(this.currentCategory, categoryPresets);
            
            this.updatePresetDisplay();
            this.selectPreset(preset.id);
            
            this.showNotification('Current settings saved as preset', 'success');
            
        } catch (error) {
            console.error('[PresetManager] Failed to save current settings:', error);
            this.showNotification('Failed to save current settings', 'error');
        }
    }

    /**
     * Show import dialog
     */
    showImportDialog() {
        const fileInput = document.getElementById('preset-file-input');
        if (fileInput) {
            fileInput.click();
        }
    }

    /**
     * Handle file import
     */
    async handleFileImport(file) {
        if (!file) return;
        
        // Validate file
        if (file.size > this.maxFileSize) {
            this.showNotification('File too large (max 1MB)', 'error');
            return;
        }
        
        const extension = file.name.toLowerCase().substring(file.name.lastIndexOf('.'));
        if (!this.supportedFormats.includes(extension)) {
            this.showNotification('Unsupported file format', 'error');
            return;
        }
        
        try {
            this.isImporting = true;
            this.updateImportButton(true);
            
            const text = await this.readFileAsText(file);
            const presetData = JSON.parse(text);
            
            // Validate preset data
            if (!this.validatePresetData(presetData)) {
                throw new Error('Invalid preset file format');
            }
            
            // Import preset
            const preset = this.createPresetObject({
                ...presetData,
                category: this.currentCategory, // Force current category
                author: presetData.author || 'Imported'
            });
            
            const categoryPresets = this.presets.get(this.currentCategory) || [];
            categoryPresets.push(preset);
            this.presets.set(this.currentCategory, categoryPresets);
            
            this.updatePresetDisplay();
            this.selectPreset(preset.id);
            
            this.showNotification(`Preset imported: ${preset.name}`, 'success');
            
        } catch (error) {
            console.error('[PresetManager] Import failed:', error);
            this.showNotification('Failed to import preset file', 'error');
        } finally {
            this.isImporting = false;
            this.updateImportButton(false);
        }
    }

    /**
     * Read file as text
     */
    readFileAsText(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (e) => resolve(e.target.result);
            reader.onerror = (e) => reject(new Error('Failed to read file'));
            reader.readAsText(file);
        });
    }

    /**
     * Validate preset data structure
     */
    validatePresetData(data) {
        if (typeof data !== 'object' || !data) return false;
        if (!data.name || typeof data.name !== 'string') return false;
        if (!data.config || typeof data.config !== 'object') return false;
        return true;
    }

    /**
     * Export selected preset
     */
    async exportSelectedPreset() {
        if (!this.selectedPreset) return;
        
        try {
            this.isExporting = true;
            this.updateExportButton(true);
            
            const exportData = {
                name: this.selectedPreset.name,
                description: this.selectedPreset.description,
                author: this.selectedPreset.author,
                tags: this.selectedPreset.tags,
                category: this.selectedPreset.category,
                config: this.selectedPreset.config,
                version: this.selectedPreset.version,
                exportedAt: Date.now()
            };
            
            const json = JSON.stringify(exportData, null, 2);
            const blob = new Blob([json], { type: 'application/json' });
            
            // Create download link
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `${this.selectedPreset.name.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.preset`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
            
            this.showNotification(`Preset exported: ${this.selectedPreset.name}`, 'success');
            
        } catch (error) {
            console.error('[PresetManager] Export failed:', error);
            this.showNotification('Failed to export preset', 'error');
        } finally {
            this.isExporting = false;
            this.updateExportButton(false);
        }
    }

    /**
     * Delete preset
     */
    deletePreset(preset) {
        if (!confirm(`Delete preset "${preset.name}"? This action cannot be undone.`)) {
            return;
        }
        
        const categoryPresets = this.presets.get(this.currentCategory) || [];
        const index = categoryPresets.findIndex(p => p.id === preset.id);
        
        if (index > -1) {
            categoryPresets.splice(index, 1);
            this.presets.set(this.currentCategory, categoryPresets);
            
            if (this.selectedPreset?.id === preset.id) {
                this.selectedPreset = null;
            }
            
            this.updatePresetDisplay();
            this.updateActionButtons();
            this.hidePreview();
            
            this.showNotification(`Preset "${preset.name}" deleted`, 'info');
        }
    }

    /**
     * Refresh presets
     */
    async refreshPresets() {
        try {
            // In a real implementation, this would reload from persistent storage
            this.updatePresetDisplay();
            this.showNotification('Presets refreshed', 'success');
        } catch (error) {
            console.error('[PresetManager] Refresh failed:', error);
            this.showNotification('Failed to refresh presets', 'error');
        }
    }

    /**
     * Update import button state
     */
    updateImportButton(isImporting) {
        const importBtn = document.getElementById('import-preset');
        if (importBtn) {
            importBtn.disabled = isImporting;
            importBtn.innerHTML = isImporting ? 
                '<span class="btn-icon">⏳</span>Importing...' : 
                '<span class="btn-icon">📥</span>Import File';
        }
    }

    /**
     * Update export button state
     */
    updateExportButton(isExporting) {
        const exportBtn = document.getElementById('export-preset');
        if (exportBtn) {
            exportBtn.disabled = isExporting || !this.selectedPreset;
            exportBtn.innerHTML = isExporting ? 
                '<span class="btn-icon">⏳</span>Exporting...' : 
                '<span class="btn-icon">📤</span>Export Selected';
        }
    }

    /**
     * Get preset count for category
     */
    getPresetCount(category) {
        const categoryPresets = this.presets.get(category);
        return categoryPresets ? categoryPresets.length : 0;
    }

    /**
     * Format date for display
     */
    formatDate(timestamp) {
        const date = new Date(timestamp);
        return date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], { 
            hour: '2-digit', 
            minute: '2-digit' 
        });
    }

    /**
     * Show preset manager panel
     */
    show() {
        const panel = document.getElementById('preset-manager-panel');
        if (panel) {
            panel.classList.remove('hidden');
            this.isVisible = true;
            this.updatePresetDisplay();
        }
    }

    /**
     * Hide preset manager panel
     */
    hide() {
        const panel = document.getElementById('preset-manager-panel');
        if (panel) {
            panel.classList.add('hidden');
            this.isVisible = false;
        }
    }

    /**
     * Toggle panel visibility
     */
    toggle() {
        if (this.isVisible) {
            this.hide();
        } else {
            this.show();
        }
    }

    /**
     * Get the DOM element for this component
     * Required for AnimationManager integration
     */
    getElement() {
        return document.getElementById('preset-manager-panel');
    }

    /**
     * Show notification message
     */
    showNotification(message, type = 'info') {
        // Create or update notification element
        let notification = document.getElementById('preset-manager-notification');
        if (!notification) {
            notification = document.createElement('div');
            notification.id = 'preset-manager-notification';
            notification.className = 'notification';
            document.getElementById('preset-manager-panel').appendChild(notification);
        }
        
        notification.textContent = message;
        notification.className = `notification ${type} show`;
        
        // Auto-hide after 3 seconds
        setTimeout(() => {
            notification.classList.remove('show');
        }, 3000);
    }

    /**
     * Destroy the preset manager
     */
    destroy() {
        this.presets.clear();
        console.log('[PresetManager] Preset manager destroyed');
    }
}