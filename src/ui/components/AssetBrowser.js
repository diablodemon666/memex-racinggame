/**
 * AssetBrowser.js - Drag-and-Drop Asset Browser Component
 * 
 * A comprehensive asset browser that allows users to browse, preview, and apply
 * game assets including sprites, boosters, skills, tokens, and custom uploads.
 * Features drag-and-drop functionality, search/filter capabilities, and real-time
 * asset customization for the Memex Racing game.
 */

import { AssetManager, AssetType, AssetState } from '../../game/systems/AssetManager.js';

export class AssetBrowser {
    constructor(uiManager) {
        this.uiManager = uiManager;
        this.isVisible = false;
        
        // Asset categories and their file paths
        this.assetCategories = {
            players: {
                name: 'Player Sprites',
                icon: '🏎️',
                basePath: 'assets/sprites/players/default/',
                assets: [
                    'Smoking_pug.png',
                    'chips bu.png',
                    'cool_pug.png',
                    'ice.png',
                    'intern.png',
                    'lv4pug.png',
                    'pug banana toilet.png',
                    'spike monster.png'
                ]
            },
            boosters: {
                name: 'Power-up Boosters',
                icon: '⚡',
                basePath: 'assets/sprites/boosters/',
                assets: [
                    'Crik-cutout2.png',
                    'banana.png',
                    'diamondfist.png',
                    'shit2.png',
                    'toilet-paper.png'
                ]
            },
            skills: {
                name: 'Player Skills',
                icon: '🔮',
                basePath: 'assets/sprites/skills/',
                assets: [
                    'bubble.png',
                    'fire.png',
                    'magnet.png',
                    'teleport.png',
                    'thuner.png'
                ]
            },
            tokens: {
                name: 'Game Tokens',
                icon: '💎',
                basePath: 'assets/ui/icons/',
                assets: [
                    'M token.png'
                ]
            },
            custom: {
                name: 'Custom Assets',
                icon: '📁',
                basePath: 'custom/',
                assets: []
            }
        };
        
        // Browser state
        this.currentCategory = 'players';
        this.selectedAsset = null;
        this.searchQuery = '';
        this.draggedAsset = null;
        this.loadedAssets = new Map();
        this.previewCanvas = null;
        
        // AssetManager integration
        this.assetManager = null;
        
        console.log('[AssetBrowser] Asset browser initialized');
    }

    /**
     * Initialize the asset browser
     */
    async initialize() {
        this.createBrowserContent();
        this.setupEventListeners();
        await this.loadAssetPreviews();
        console.log('[AssetBrowser] Asset browser initialized');
    }

    /**
     * Set AssetManager reference for integration
     */
    setAssetManager(assetManager) {
        this.assetManager = assetManager;
    }

    /**
     * Create asset browser content structure
     */
    createBrowserContent() {
        const browser = document.getElementById('asset-browser-panel');
        if (!browser) return;

        browser.innerHTML = `
            <div class="panel-header">
                <div class="panel-title">
                    <span class="title-text">ASSET BROWSER</span>
                    <div class="panel-controls">
                        <button class="control-btn refresh-btn" id="refresh-assets" title="Refresh Assets">
                            🔄
                        </button>
                        <button class="control-btn toggle-btn" id="toggle-asset-browser" title="Toggle">
                            📁
                        </button>
                    </div>
                </div>
            </div>
            
            <div class="panel-body asset-browser-content">
                <div class="browser-toolbar">
                    <div class="category-tabs" id="category-tabs">
                        ${this.generateCategoryTabs()}
                    </div>
                    
                    <div class="search-section">
                        <input 
                            type="text" 
                            id="asset-search" 
                            class="search-input" 
                            placeholder="Search assets..." 
                            value="${this.searchQuery}"
                        >
                        <button class="search-clear-btn" id="clear-search" title="Clear Search">
                            ✕
                        </button>
                    </div>
                </div>
                
                <div class="asset-grid-container">
                    <div class="category-info" id="category-info">
                        <div class="category-header">
                            <span class="category-icon">${this.assetCategories[this.currentCategory].icon}</span>
                            <span class="category-name">${this.assetCategories[this.currentCategory].name}</span>
                        </div>
                        <div class="asset-count" id="asset-count">
                            Loading assets...
                        </div>
                    </div>
                    
                    <div class="asset-grid" id="asset-grid">
                        <div class="loading-placeholder">
                            <div class="loading-spinner"></div>
                            <div class="loading-text">Loading assets...</div>
                        </div>
                    </div>
                </div>
                
                <div class="asset-preview-section" id="asset-preview-section" style="display: none;">
                    <div class="preview-header">
                        <span class="preview-title">ASSET PREVIEW</span>
                        <button class="preview-close-btn" id="close-preview" title="Close Preview">✕</button>
                    </div>
                    
                    <div class="preview-content">
                        <div class="preview-canvas-container">
                            <canvas id="asset-preview-canvas" class="preview-canvas"></canvas>
                        </div>
                        
                        <div class="asset-details" id="asset-details">
                            <div class="detail-row">
                                <span class="label">NAME:</span>
                                <span class="value" id="asset-name">-</span>
                            </div>
                            <div class="detail-row">
                                <span class="label">SIZE:</span>
                                <span class="value" id="asset-size">-</span>
                            </div>
                            <div class="detail-row">
                                <span class="label">TYPE:</span>
                                <span class="value" id="asset-type">-</span>
                            </div>
                        </div>
                        
                        <div class="preview-actions">
                            <button class="action-btn apply-btn" id="apply-asset" disabled>
                                <span class="btn-icon">✅</span>
                                APPLY TO GAME
                            </button>
                            <button class="action-btn export-btn" id="export-asset" disabled>
                                <span class="btn-icon">💾</span>
                                EXPORT
                            </button>
                        </div>
                    </div>
                </div>
                
                <div class="upload-section">
                    <div class="upload-area" id="upload-area">
                        <div class="upload-icon">📤</div>
                        <div class="upload-text">
                            <div class="upload-title">Drag & Drop Custom Assets</div>
                            <div class="upload-subtitle">or click to browse files</div>
                        </div>
                        <input type="file" id="custom-asset-input" accept="image/*" multiple style="display: none;">
                    </div>
                    
                    <div class="upload-hints">
                        <div class="hint-item">📷 Supports PNG, JPG, GIF formats</div>
                        <div class="hint-item">📐 Optimal size: 32x32 or 64x64 pixels</div>
                        <div class="hint-item">🎯 Drag directly onto game elements to apply</div>
                    </div>
                </div>
            </div>
        `;
    }

    /**
     * Generate category tabs HTML
     */
    generateCategoryTabs() {
        return Object.entries(this.assetCategories).map(([key, category]) => `
            <button class="category-tab ${key === this.currentCategory ? 'active' : ''}" 
                    data-category="${key}">
                <span class="tab-icon">${category.icon}</span>
                <span class="tab-name">${category.name}</span>
            </button>
        `).join('');
    }

    /**
     * Setup event listeners for asset browser interactions
     */
    setupEventListeners() {
        // Category tab switching
        const categoryTabs = document.querySelectorAll('.category-tab');
        categoryTabs.forEach(tab => {
            tab.addEventListener('click', (e) => {
                const category = e.currentTarget.dataset.category;
                this.switchCategory(category);
            });
        });

        // Search functionality
        const searchInput = document.getElementById('asset-search');
        if (searchInput) {
            searchInput.addEventListener('input', (e) => {
                this.handleSearch(e.target.value);
            });
        }

        const clearSearchBtn = document.getElementById('clear-search');
        if (clearSearchBtn) {
            clearSearchBtn.addEventListener('click', () => {
                this.clearSearch();
            });
        }

        // Control buttons
        const refreshBtn = document.getElementById('refresh-assets');
        if (refreshBtn) {
            refreshBtn.addEventListener('click', () => {
                this.refreshAssets();
            });
        }

        const toggleBtn = document.getElementById('toggle-asset-browser');
        if (toggleBtn) {
            toggleBtn.addEventListener('click', () => {
                this.toggle();
            });
        }

        // Preview controls
        const closePreviewBtn = document.getElementById('close-preview');
        if (closePreviewBtn) {
            closePreviewBtn.addEventListener('click', () => {
                this.closePreview();
            });
        }

        const applyBtn = document.getElementById('apply-asset');
        if (applyBtn) {
            applyBtn.addEventListener('click', () => {
                this.applySelectedAsset();
            });
        }

        const exportBtn = document.getElementById('export-asset');
        if (exportBtn) {
            exportBtn.addEventListener('click', () => {
                this.exportSelectedAsset();
            });
        }

        // File upload
        const uploadArea = document.getElementById('upload-area');
        const fileInput = document.getElementById('custom-asset-input');
        
        if (uploadArea) {
            uploadArea.addEventListener('click', () => {
                fileInput.click();
            });
            
            this.setupDragAndDrop(uploadArea);
        }

        if (fileInput) {
            fileInput.addEventListener('change', (e) => {
                this.handleFileUpload(e.target.files);
            });
        }
    }

    /**
     * Setup drag and drop functionality
     */
    setupDragAndDrop(element) {
        ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
            element.addEventListener(eventName, (e) => {
                e.preventDefault();
                e.stopPropagation();
            });
        });

        ['dragenter', 'dragover'].forEach(eventName => {
            element.addEventListener(eventName, () => {
                element.classList.add('drag-over');
            });
        });

        ['dragleave', 'drop'].forEach(eventName => {
            element.addEventListener(eventName, () => {
                element.classList.remove('drag-over');
            });
        });

        element.addEventListener('drop', (e) => {
            const files = e.dataTransfer.files;
            if (files.length > 0) {
                this.handleFileUpload(files);
            }
        });
    }

    /**
     * Load asset previews for current category
     */
    async loadAssetPreviews() {
        const assetGrid = document.getElementById('asset-grid');
        const assetCount = document.getElementById('asset-count');
        
        if (!assetGrid) return;

        // Show loading state
        assetGrid.innerHTML = `
            <div class="loading-placeholder">
                <div class="loading-spinner"></div>
                <div class="loading-text">Loading ${this.assetCategories[this.currentCategory].name}...</div>
            </div>
        `;

        try {
            const category = this.assetCategories[this.currentCategory];
            const assets = await this.loadCategoryAssets(category);
            
            // Filter assets based on search query
            const filteredAssets = this.filterAssets(assets);
            
            // Update asset count
            if (assetCount) {
                assetCount.textContent = `${filteredAssets.length} asset${filteredAssets.length !== 1 ? 's' : ''} found`;
            }
            
            // Generate asset grid
            assetGrid.innerHTML = this.generateAssetGrid(filteredAssets);
            
            // Setup asset item event listeners
            this.setupAssetItemListeners();
            
        } catch (error) {
            console.error('[AssetBrowser] Failed to load assets:', error);
            assetGrid.innerHTML = `
                <div class="error-placeholder">
                    <div class="error-icon">⚠️</div>
                    <div class="error-text">Failed to load assets</div>
                    <button class="retry-btn" onclick="this.loadAssetPreviews()">Retry</button>
                </div>
            `;
        }
    }

    /**
     * Load assets for a specific category
     */
    async loadCategoryAssets(category) {
        const assets = [];
        
        for (const assetFile of category.assets) {
            const assetPath = category.basePath + assetFile;
            const assetKey = this.generateAssetKey(category, assetFile);
            
            try {
                // Check if already loaded
                if (this.loadedAssets.has(assetKey)) {
                    assets.push(this.loadedAssets.get(assetKey));
                    continue;
                }
                
                // Load asset preview
                const asset = await this.loadAssetPreview(assetPath, assetFile);
                asset.category = this.currentCategory;
                asset.key = assetKey;
                
                this.loadedAssets.set(assetKey, asset);
                assets.push(asset);
                
            } catch (error) {
                console.warn(`[AssetBrowser] Failed to load asset ${assetFile}:`, error);
                // Add placeholder for failed assets
                assets.push({
                    name: assetFile,
                    path: assetPath,
                    key: assetKey,
                    category: this.currentCategory,
                    error: true,
                    errorMessage: error.message
                });
            }
        }
        
        return assets;
    }

    /**
     * Load individual asset preview
     */
    async loadAssetPreview(path, filename) {
        return new Promise((resolve, reject) => {
            const img = new Image();
            
            img.onload = () => {
                // Create preview canvas
                const canvas = document.createElement('canvas');
                const ctx = canvas.getContext('2d');
                
                // Set canvas size (thumbnail size)
                const maxSize = 64;
                const scale = Math.min(maxSize / img.width, maxSize / img.height);
                canvas.width = img.width * scale;
                canvas.height = img.height * scale;
                
                // Draw scaled image
                ctx.imageSmoothingEnabled = false;
                ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
                
                resolve({
                    name: filename.replace(/\.[^/.]+$/, ""), // Remove extension
                    filename: filename,
                    path: path,
                    image: img,
                    preview: canvas,
                    width: img.width,
                    height: img.height,
                    size: `${img.width}x${img.height}`,
                    type: this.getAssetTypeFromPath(path)
                });
            };
            
            img.onerror = () => {
                reject(new Error(`Failed to load image: ${path}`));
            };
            
            img.src = path;
        });
    }

    /**
     * Generate asset grid HTML
     */
    generateAssetGrid(assets) {
        if (assets.length === 0) {
            return `
                <div class="empty-placeholder">
                    <div class="empty-icon">📁</div>
                    <div class="empty-text">No assets found</div>
                    <div class="empty-subtitle">Try a different search or category</div>
                </div>
            `;
        }
        
        return assets.map(asset => `
            <div class="asset-item ${asset.error ? 'error' : ''}" 
                 data-asset-key="${asset.key}"
                 draggable="${!asset.error}">
                <div class="asset-thumbnail">
                    ${asset.error ? 
                        `<div class="error-thumbnail">
                            <div class="error-icon">⚠️</div>
                        </div>` :
                        `<canvas class="thumbnail-canvas" 
                                width="${asset.preview.width}" 
                                height="${asset.preview.height}"></canvas>`
                    }
                </div>
                
                <div class="asset-info">
                    <div class="asset-name" title="${asset.name}">${asset.name}</div>
                    <div class="asset-meta">
                        ${asset.error ? 
                            `<span class="error-text">Load Error</span>` :
                            `<span class="asset-dimensions">${asset.size}</span>`
                        }
                    </div>
                </div>
                
                <div class="asset-actions">
                    ${!asset.error ? `
                        <button class="asset-action-btn preview-btn" title="Preview">👁️</button>
                        <button class="asset-action-btn apply-btn" title="Apply">✅</button>
                    ` : `
                        <button class="asset-action-btn retry-btn" title="Retry">🔄</button>
                    `}
                </div>
            </div>
        `).join('');
    }

    /**
     * Setup event listeners for asset items
     */
    setupAssetItemListeners() {
        // Render thumbnails
        const assetItems = document.querySelectorAll('.asset-item:not(.error)');
        assetItems.forEach(item => {
            const assetKey = item.dataset.assetKey;
            const asset = this.loadedAssets.get(assetKey);
            
            if (asset && asset.preview) {
                const canvas = item.querySelector('.thumbnail-canvas');
                if (canvas) {
                    const ctx = canvas.getContext('2d');
                    ctx.drawImage(asset.preview, 0, 0);
                }
            }
        });

        // Asset item interactions
        document.querySelectorAll('.asset-item').forEach(item => {
            const assetKey = item.dataset.assetKey;
            
            // Click to select
            item.addEventListener('click', () => {
                this.selectAsset(assetKey);
            });
            
            // Double-click to preview
            item.addEventListener('dblclick', () => {
                this.previewAsset(assetKey);
            });
            
            // Drag start
            item.addEventListener('dragstart', (e) => {
                this.handleDragStart(e, assetKey);
            });
        });

        // Action buttons
        document.querySelectorAll('.preview-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const assetKey = e.currentTarget.closest('.asset-item').dataset.assetKey;
                this.previewAsset(assetKey);
            });
        });

        document.querySelectorAll('.asset-actions .apply-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const assetKey = e.currentTarget.closest('.asset-item').dataset.assetKey;
                this.applyAsset(assetKey);
            });
        });

        document.querySelectorAll('.retry-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const assetKey = e.currentTarget.closest('.asset-item').dataset.assetKey;
                this.retryAssetLoad(assetKey);
            });
        });
    }

    /**
     * Switch to different asset category
     */
    async switchCategory(categoryKey) {
        if (categoryKey === this.currentCategory) return;
        
        this.currentCategory = categoryKey;
        this.selectedAsset = null;
        this.closePreview();
        
        // Update category tabs
        document.querySelectorAll('.category-tab').forEach(tab => {
            tab.classList.toggle('active', tab.dataset.category === categoryKey);
        });
        
        // Update category info
        const categoryInfo = document.getElementById('category-info');
        if (categoryInfo) {
            const category = this.assetCategories[categoryKey];
            categoryInfo.querySelector('.category-icon').textContent = category.icon;
            categoryInfo.querySelector('.category-name').textContent = category.name;
        }
        
        // Reload assets for new category
        await this.loadAssetPreviews();
    }

    /**
     * Handle search input
     */
    handleSearch(query) {
        this.searchQuery = query.toLowerCase();
        this.loadAssetPreviews(); // Reload with filter
    }

    /**
     * Clear search
     */
    clearSearch() {
        const searchInput = document.getElementById('asset-search');
        if (searchInput) {
            searchInput.value = '';
            this.searchQuery = '';
            this.loadAssetPreviews();
        }
    }

    /**
     * Filter assets based on search query
     */
    filterAssets(assets) {
        if (!this.searchQuery) return assets;
        
        return assets.filter(asset => 
            asset.name.toLowerCase().includes(this.searchQuery) ||
            asset.filename.toLowerCase().includes(this.searchQuery)
        );
    }

    /**
     * Select an asset
     */
    selectAsset(assetKey) {
        // Remove previous selection
        document.querySelectorAll('.asset-item.selected').forEach(item => {
            item.classList.remove('selected');
        });
        
        // Add selection to current item
        const assetItem = document.querySelector(`[data-asset-key="${assetKey}"]`);
        if (assetItem) {
            assetItem.classList.add('selected');
            this.selectedAsset = assetKey;
        }
    }

    /**
     * Preview an asset
     */
    previewAsset(assetKey) {
        const asset = this.loadedAssets.get(assetKey);
        if (!asset || asset.error) return;
        
        this.selectAsset(assetKey);
        
        // Show preview section
        const previewSection = document.getElementById('asset-preview-section');
        if (previewSection) {
            previewSection.style.display = 'block';
            
            // Update preview canvas
            const previewCanvas = document.getElementById('asset-preview-canvas');
            if (previewCanvas && asset.image) {
                previewCanvas.width = Math.min(asset.width, 256);
                previewCanvas.height = Math.min(asset.height, 256);
                
                const ctx = previewCanvas.getContext('2d');
                ctx.imageSmoothingEnabled = false;
                ctx.drawImage(asset.image, 0, 0, previewCanvas.width, previewCanvas.height);
            }
            
            // Update asset details
            document.getElementById('asset-name').textContent = asset.name;
            document.getElementById('asset-size').textContent = asset.size;
            document.getElementById('asset-type').textContent = asset.type;
            
            // Enable action buttons
            document.getElementById('apply-asset').disabled = false;
            document.getElementById('export-asset').disabled = false;
        }
    }

    /**
     * Close asset preview
     */
    closePreview() {
        const previewSection = document.getElementById('asset-preview-section');
        if (previewSection) {
            previewSection.style.display = 'none';
        }
        
        // Disable action buttons
        document.getElementById('apply-asset').disabled = true;
        document.getElementById('export-asset').disabled = true;
    }

    /**
     * Apply selected asset to game
     */
    applySelectedAsset() {
        if (!this.selectedAsset) return;
        this.applyAsset(this.selectedAsset);
    }

    /**
     * Apply asset to game
     */
    applyAsset(assetKey) {
        const asset = this.loadedAssets.get(assetKey);
        if (!asset || asset.error) return;
        
        // Determine application based on asset category
        switch (asset.category) {
            case 'players':
                this.applyPlayerAsset(asset);
                break;
            case 'boosters':
                this.applyBoosterAsset(asset);
                break;
            case 'skills':
                this.applySkillAsset(asset);
                break;
            case 'tokens':
                this.applyTokenAsset(asset);
                break;
            default:
                this.showNotification(`Applied ${asset.name} to game`, 'success');
        }
        
        // Notify game systems
        this.notifyGameOfAssetChange(asset);
    }

    /**
     * Apply player asset
     */
    applyPlayerAsset(asset) {
        // Integration with PlayerSetupPanel
        if (this.uiManager && this.uiManager.playerSetupPanel) {
            // Create canvas from asset
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            canvas.width = 128;
            canvas.height = 128;
            
            // Scale and draw asset to 128x128
            ctx.imageSmoothingEnabled = false;
            const scale = Math.min(128 / asset.width, 128 / asset.height);
            const width = asset.width * scale;
            const height = asset.height * scale;
            const x = (128 - width) / 2;
            const y = (128 - height) / 2;
            
            ctx.drawImage(asset.image, x, y, width, height);
            
            // Apply to current player
            const playerIndex = this.uiManager.playerSetupPanel.currentPlayerIndex;
            this.uiManager.playerSetupPanel.playerCustomImages[playerIndex] = canvas;
            this.uiManager.playerSetupPanel.updateImagePreview(canvas.toDataURL());
            
            this.showNotification(`${asset.name} applied to player ${playerIndex + 1}`, 'success');
        }
    }

    /**
     * Apply booster asset
     */
    applyBoosterAsset(asset) {
        // This could integrate with game's booster system
        this.showNotification(`${asset.name} booster style applied`, 'success');
    }

    /**
     * Apply skill asset
     */
    applySkillAsset(asset) {
        // This could integrate with game's skill system
        this.showNotification(`${asset.name} skill style applied`, 'success');
    }

    /**
     * Apply token asset
     */
    applyTokenAsset(asset) {
        // This could integrate with game's token system
        this.showNotification(`${asset.name} token style applied`, 'success');
    }

    /**
     * Export selected asset
     */
    exportSelectedAsset() {
        if (!this.selectedAsset) return;
        
        const asset = this.loadedAssets.get(this.selectedAsset);
        if (!asset || asset.error) return;
        
        // Create download link
        const link = document.createElement('a');
        link.download = asset.filename;
        link.href = asset.image.src;
        link.click();
        
        this.showNotification(`${asset.name} exported`, 'success');
    }

    /**
     * Handle file upload
     */
    async handleFileUpload(files) {
        const uploadArea = document.getElementById('upload-area');
        uploadArea.classList.add('uploading');
        
        try {
            for (const file of files) {
                if (!file.type.startsWith('image/')) {
                    this.showNotification(`${file.name} is not an image file`, 'error');
                    continue;
                }
                
                await this.processCustomAsset(file);
            }
            
            // Switch to custom category and refresh
            this.switchCategory('custom');
            
        } catch (error) {
            console.error('[AssetBrowser] Upload error:', error);
            this.showNotification('Upload failed', 'error');
        } finally {
            uploadArea.classList.remove('uploading');
        }
    }

    /**
     * Process custom uploaded asset
     */
    async processCustomAsset(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            
            reader.onload = async (e) => {
                try {
                    const asset = await this.loadAssetPreview(e.target.result, file.name);
                    asset.category = 'custom';
                    asset.key = this.generateAssetKey({ name: 'custom' }, file.name);
                    asset.isCustom = true;
                    
                    // Add to custom assets
                    this.assetCategories.custom.assets.push(file.name);
                    this.loadedAssets.set(asset.key, asset);
                    
                    this.showNotification(`${asset.name} uploaded successfully`, 'success');
                    resolve(asset);
                    
                } catch (error) {
                    reject(error);
                }
            };
            
            reader.onerror = () => reject(new Error('Failed to read file'));
            reader.readAsDataURL(file);
        });
    }

    /**
     * Handle drag start for asset items
     */
    handleDragStart(e, assetKey) {
        const asset = this.loadedAssets.get(assetKey);
        if (!asset || asset.error) {
            e.preventDefault();
            return;
        }
        
        this.draggedAsset = asset;
        
        // Set drag data
        e.dataTransfer.setData('text/plain', assetKey);
        e.dataTransfer.setData('application/x-memex-asset', JSON.stringify({
            key: assetKey,
            name: asset.name,
            category: asset.category,
            type: asset.type
        }));
        
        // Visual feedback
        e.dataTransfer.effectAllowed = 'copy';
        e.currentTarget.classList.add('dragging');
        
        setTimeout(() => {
            e.currentTarget.classList.remove('dragging');
        }, 100);
    }

    /**
     * Refresh assets in current category
     */
    async refreshAssets() {
        // Clear loaded assets cache for current category
        const categoryPrefix = this.currentCategory + '_';
        for (const [key, asset] of this.loadedAssets) {
            if (key.startsWith(categoryPrefix)) {
                this.loadedAssets.delete(key);
            }
        }
        
        // Reload assets
        await this.loadAssetPreviews();
        this.showNotification('Assets refreshed', 'success');
    }

    /**
     * Retry loading a failed asset
     */
    async retryAssetLoad(assetKey) {
        const asset = this.loadedAssets.get(assetKey);
        if (!asset) return;
        
        try {
            // Remove failed asset
            this.loadedAssets.delete(assetKey);
            
            // Reload asset
            const newAsset = await this.loadAssetPreview(asset.path, asset.filename);
            newAsset.category = asset.category;
            newAsset.key = assetKey;
            
            this.loadedAssets.set(assetKey, newAsset);
            
            // Refresh grid
            await this.loadAssetPreviews();
            
            this.showNotification(`${asset.name} loaded successfully`, 'success');
            
        } catch (error) {
            this.showNotification(`Failed to reload ${asset.name}`, 'error');
        }
    }

    /**
     * Generate unique asset key
     */
    generateAssetKey(category, filename) {
        return `${category.name || category}_${filename.replace(/[^a-zA-Z0-9]/g, '_')}`;
    }

    /**
     * Get asset type from path
     */
    getAssetTypeFromPath(path) {
        const ext = path.split('.').pop().toLowerCase();
        switch (ext) {
            case 'png':
            case 'jpg':
            case 'jpeg':
            case 'gif':
                return 'Image';
            default:
                return 'Unknown';
        }
    }

    /**
     * Notify game systems of asset changes
     */
    notifyGameOfAssetChange(asset) {
        if (this.uiManager && this.uiManager.game && this.uiManager.game.events) {
            this.uiManager.game.events.emit('assetChanged', {
                asset: asset,
                category: asset.category,
                appliedAt: Date.now()
            });
        }
    }

    /**
     * Show asset browser panel
     */
    show() {
        const panel = document.getElementById('asset-browser-panel');
        if (panel) {
            panel.classList.remove('hidden');
            this.isVisible = true;
        }
    }

    /**
     * Hide asset browser panel
     */
    hide() {
        const panel = document.getElementById('asset-browser-panel');
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
        return document.getElementById('asset-browser-panel');
    }

    /**
     * Show notification message
     */
    showNotification(message, type = 'info') {
        // Create or update notification element
        let notification = document.getElementById('asset-browser-notification');
        if (!notification) {
            notification = document.createElement('div');
            notification.id = 'asset-browser-notification';
            notification.className = 'notification';
            document.getElementById('asset-browser-panel').appendChild(notification);
        }
        
        notification.textContent = message;
        notification.className = `notification ${type} show`;
        
        // Auto-hide after 3 seconds
        setTimeout(() => {
            notification.classList.remove('show');
        }, 3000);
    }

    /**
     * Get current browser state
     */
    getBrowserState() {
        return {
            currentCategory: this.currentCategory,
            selectedAsset: this.selectedAsset,
            searchQuery: this.searchQuery,
            loadedAssetsCount: this.loadedAssets.size,
            isVisible: this.isVisible
        };
    }

    /**
     * Destroy the asset browser
     */
    destroy() {
        // Clear loaded assets
        this.loadedAssets.clear();
        
        // Clean up any intervals or listeners
        console.log('[AssetBrowser] Asset browser destroyed');
    }
}