/**
 * TrackEditor.js - Track Design and Drawing Interface Component
 * 
 * A comprehensive track editor allowing users to design custom race tracks for Memex Racing.
 * Features painting tools, zoom/pan controls, template loading, and real-time preview.
 * Follows the white pixel = track, transparent = walls system used by the game.
 */

import { TrackPreview } from './TrackPreview.js';
import { TrackValidator } from '../../game/systems/TrackValidator.js';

export class TrackEditor {
    constructor(uiManager) {
        this.uiManager = uiManager;
        this.isVisible = false;
        this.isEditing = false;
        
        // Canvas and drawing state
        this.canvas = null;
        this.ctx = null;
        this.previewCanvas = null;
        this.previewCtx = null;
        this.miniMapCanvas = null;
        this.miniMapCtx = null;
        
        // Track dimensions (fixed for Memex Racing)
        this.trackWidth = 4000;
        this.trackHeight = 2000;
        this.canvasScale = 0.25; // Display scale for editing
        
        // Viewport control
        this.viewport = {
            x: 0,
            y: 0,
            zoom: 1.0,
            minZoom: 0.1,
            maxZoom: 4.0
        };
        
        // Drawing tools
        this.currentTool = 'brush';
        this.brushSize = 32;
        this.isDrawing = false;
        this.lastDrawPoint = null;
        
        // Tool configurations
        this.tools = {
            brush: { name: 'Brush', icon: '🖌️', cursor: 'crosshair' },
            eraser: { name: 'Eraser', icon: '🧽', cursor: 'crosshair' },
            line: { name: 'Line', icon: '📏', cursor: 'crosshair' },
            rectangle: { name: 'Rectangle', icon: '▭', cursor: 'crosshair' },
            fill: { name: 'Fill', icon: '🪣', cursor: 'crosshair' }
        };
        
        this.brushSizes = [16, 32, 64, 128];
        
        // Drawing state
        this.drawing = {
            startPoint: null,
            endPoint: null,
            previewPath: null
        };
        
        // History for undo/redo
        this.history = [];
        this.historyIndex = -1;
        this.maxHistoryStates = 50;
        
        // Settings
        this.settings = {
            showGrid: true,
            gridSize: 100,
            snapToGrid: false,
            showMiniMap: true,
            autoSave: true
        };
        
        // Track metadata
        this.trackMetadata = {
            name: 'Custom Track',
            difficulty: 'medium',
            author: 'Player',
            description: 'A custom race track'
        };
        
        // Track preview system
        this.trackPreview = null;
        
        // Track validation system
        this.trackValidator = null;
        this.validationOverlay = null;
        this.lastValidation = null;
        this.autoValidate = true;
        this.validationDebounceTimer = null;
        
        console.log('[TrackEditor] Track editor initialized');
    }

    /**
     * Initialize the track editor
     */
    async initialize() {
        this.createEditorContent();
        this.setupEventListeners();
        this.initializeCanvas();
        this.setupDragAndDrop();
        
        // Initialize track preview system
        this.trackPreview = new TrackPreview(this);
        await this.trackPreview.initialize();
        
        // Initialize track validation system
        this.trackValidator = new TrackValidator({
            trackWidth: this.trackWidth,
            trackHeight: this.trackHeight
        });
        this.setupValidationUI();
        
        console.log('[TrackEditor] Track editor initialized');
    }

    /**
     * Create track editor content structure
     */
    createEditorContent() {
        const editor = document.getElementById('track-editor-panel');
        if (!editor) return;

        editor.innerHTML = `
            <div class="track-editor-overlay">
                <div class="track-editor-container">
                    <!-- Header -->
                    <div class="editor-header">
                        <div class="editor-title">
                            <span class="title-text pixel-text">TRACK EDITOR</span>
                            <div class="editor-status">
                                <span class="status-indicator" id="editor-status">Ready</span>
                                <span class="track-info" id="track-info">${this.trackMetadata.name}</span>
                            </div>
                        </div>
                        <div class="editor-controls">
                            <button class="control-btn" id="editor-minimize" title="Minimize">📁</button>
                            <button class="control-btn" id="editor-close" title="Close">✕</button>
                        </div>
                    </div>
                    
                    <!-- Toolbar -->
                    <div class="editor-toolbar">
                        <div class="tool-group">
                            <label class="tool-group-label">TOOLS</label>
                            <div class="tool-palette">
                                ${this.generateToolButtons()}
                            </div>
                        </div>
                        
                        <div class="tool-group">
                            <label class="tool-group-label">BRUSH SIZE</label>
                            <div class="brush-size-selector">
                                ${this.generateBrushSizeButtons()}
                            </div>
                        </div>
                        
                        <div class="tool-group">
                            <label class="tool-group-label">VIEW</label>
                            <div class="view-controls">
                                <button class="control-btn zoom-btn" id="zoom-in" title="Zoom In (Wheel Up)">🔍+</button>
                                <span class="zoom-level" id="zoom-level">100%</span>
                                <button class="control-btn zoom-btn" id="zoom-out" title="Zoom Out (Wheel Down)">🔍-</button>
                                <button class="control-btn" id="reset-view" title="Reset View (Space)">🎯</button>
                            </div>
                        </div>
                        
                        <div class="tool-group">
                            <label class="tool-group-label">ACTIONS</label>
                            <div class="action-controls">
                                <button class="control-btn" id="undo-btn" title="Undo (Ctrl+Z)" disabled>↶</button>
                                <button class="control-btn" id="redo-btn" title="Redo (Ctrl+Y)" disabled>↷</button>
                                <button class="control-btn" id="clear-track" title="Clear Track">🗑️</button>
                            </div>
                        </div>
                    </div>
                    
                    <!-- Main Editor Area -->
                    <div class="editor-main">
                        <!-- Canvas Container -->
                        <div class="canvas-container" id="canvas-container">
                            <canvas id="track-editor-canvas" class="editor-canvas"></canvas>
                            <div class="canvas-overlay">
                                <div class="grid-overlay" id="grid-overlay"></div>
                                <div class="crosshair" id="crosshair"></div>
                            </div>
                        </div>
                        
                        <!-- Sidebar -->
                        <div class="editor-sidebar">
                            <!-- Mini Map -->
                            <div class="sidebar-section minimap-section">
                                <div class="section-header">
                                    <span class="section-title">MINI MAP</span>
                                    <button class="toggle-btn" id="toggle-minimap">👁️</button>
                                </div>
                                <div class="minimap-container">
                                    <canvas id="minimap-canvas" class="minimap-canvas"></canvas>
                                    <div class="viewport-indicator" id="viewport-indicator"></div>
                                </div>
                            </div>
                            
                            <!-- Track Properties -->
                            <div class="sidebar-section track-properties">
                                <div class="section-header">
                                    <span class="section-title">TRACK INFO</span>
                                </div>
                                <div class="property-group">
                                    <label class="property-label">Name:</label>
                                    <input type="text" id="track-name" class="property-input" 
                                           value="${this.trackMetadata.name}" maxlength="50">
                                </div>
                                <div class="property-group">
                                    <label class="property-label">Difficulty:</label>
                                    <select id="track-difficulty" class="property-select">
                                        <option value="easy">Easy</option>
                                        <option value="medium" selected>Medium</option>
                                        <option value="hard">Hard</option>
                                        <option value="very-hard">Very Hard</option>
                                    </select>
                                </div>
                                <div class="property-group">
                                    <label class="property-label">Author:</label>
                                    <input type="text" id="track-author" class="property-input" 
                                           value="${this.trackMetadata.author}" maxlength="30">
                                </div>
                                <div class="property-group">
                                    <label class="property-label">Description:</label>
                                    <textarea id="track-description" class="property-textarea" 
                                              maxlength="200">${this.trackMetadata.description}</textarea>
                                </div>
                            </div>
                            
                            <!-- Settings -->
                            <div class="sidebar-section editor-settings">
                                <div class="section-header">
                                    <span class="section-title">SETTINGS</span>
                                </div>
                                <div class="setting-group">
                                    <label class="setting-checkbox">
                                        <input type="checkbox" id="show-grid" ${this.settings.showGrid ? 'checked' : ''}>
                                        <span class="checkbox-custom"></span>
                                        Show Grid
                                    </label>
                                </div>
                                <div class="setting-group">
                                    <label class="setting-checkbox">
                                        <input type="checkbox" id="snap-to-grid" ${this.settings.snapToGrid ? 'checked' : ''}>
                                        <span class="checkbox-custom"></span>
                                        Snap to Grid
                                    </label>
                                </div>
                                <div class="setting-group">
                                    <label class="setting-checkbox">
                                        <input type="checkbox" id="auto-save" ${this.settings.autoSave ? 'checked' : ''}>
                                        <span class="checkbox-custom"></span>
                                        Auto Save
                                    </label>
                                </div>
                                <div class="setting-group">
                                    <label class="setting-checkbox">
                                        <input type="checkbox" id="auto-validate" ${this.autoValidate ? 'checked' : ''}>
                                        <span class="checkbox-custom"></span>
                                        Auto Validate
                                    </label>
                                </div>
                                <div class="setting-group">
                                    <label class="property-label">Validation Preset:</label>
                                    <select id="validation-preset" class="property-select">
                                        <option value="custom">Custom</option>
                                        <option value="racing">Racing Track</option>
                                        <option value="maze">Maze Track</option>
                                        <option value="speed">Speed Track</option>
                                    </select>
                                </div>
                            </div>
                        </div>
                    </div>
                    
                    <!-- Bottom Actions -->
                    <div class="editor-footer">
                        <div class="file-actions">
                            <button class="action-btn primary-btn" id="new-track-btn">
                                <span class="btn-icon">📄</span>
                                NEW TRACK
                            </button>
                            <button class="action-btn" id="load-template-btn">
                                <span class="btn-icon">📂</span>
                                LOAD TEMPLATE
                            </button>
                            <button class="action-btn" id="save-track-btn">
                                <span class="btn-icon">💾</span>
                                SAVE TRACK
                            </button>
                            <button class="action-btn" id="export-track-btn">
                                <span class="btn-icon">📤</span>
                                EXPORT PNG
                            </button>
                        </div>
                        
                        <div class="preview-actions">
                            <button class="action-btn preview-btn" id="preview-track-btn">
                                <span class="btn-icon">👁️</span>
                                PREVIEW TRACK
                            </button>
                            <button class="action-btn test-btn" id="test-track-btn">
                                <span class="btn-icon">🏁</span>
                                TEST RACE
                            </button>
                            <button class="action-btn live-preview-btn" id="live-preview-btn">
                                <span class="btn-icon">🎬</span>
                                LIVE PREVIEW
                            </button>
                            <button class="action-btn validate-btn" id="validate-track-btn">
                                <span class="btn-icon">✓</span>
                                VALIDATE TRACK
                            </button>
                        </div>
                    </div>
                </div>
                
                <!-- Hidden file input for template loading -->
                <input type="file" id="template-file-input" accept="image/*,.json" multiple style="display: none;">
            </div>
        `;
    }

    /**
     * Generate tool palette buttons
     */
    generateToolButtons() {
        return Object.entries(this.tools).map(([key, tool]) => `
            <button class="tool-btn ${key === this.currentTool ? 'active' : ''}" 
                    data-tool="${key}" title="${tool.name}">
                <span class="tool-icon">${tool.icon}</span>
                <span class="tool-name">${tool.name}</span>
            </button>
        `).join('');
    }

    /**
     * Generate brush size buttons
     */
    generateBrushSizeButtons() {
        return this.brushSizes.map(size => `
            <button class="brush-size-btn ${size === this.brushSize ? 'active' : ''}" 
                    data-size="${size}" title="${size}px">
                ${size}
            </button>
        `).join('');
    }

    /**
     * Initialize the main canvas
     */
    initializeCanvas() {
        this.canvas = document.getElementById('track-editor-canvas');
        this.previewCanvas = document.createElement('canvas');
        this.miniMapCanvas = document.getElementById('minimap-canvas');
        
        if (!this.canvas || !this.miniMapCanvas) return;
        
        // Set up main canvas
        this.canvas.width = this.trackWidth * this.canvasScale;
        this.canvas.height = this.trackHeight * this.canvasScale;
        this.ctx = this.canvas.getContext('2d');
        this.ctx.imageSmoothingEnabled = false;
        
        // Set up preview canvas (full resolution)
        this.previewCanvas.width = this.trackWidth;
        this.previewCanvas.height = this.trackHeight;
        this.previewCtx = this.previewCanvas.getContext('2d');
        this.previewCtx.imageSmoothingEnabled = false;
        
        // Set up mini map
        this.miniMapCanvas.width = 200;
        this.miniMapCanvas.height = 100;
        this.miniMapCtx = this.miniMapCanvas.getContext('2d');
        this.miniMapCtx.imageSmoothingEnabled = false;
        
        // Initialize with white background (walls)
        this.clearTrack();
        this.saveHistoryState();
        
        console.log('[TrackEditor] Canvas initialized');
    }

    /**
     * Setup event listeners for track editor interactions
     */
    setupEventListeners() {
        // Tool selection
        document.querySelectorAll('.tool-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const tool = e.currentTarget.dataset.tool;
                this.selectTool(tool);
            });
        });

        // Brush size selection
        document.querySelectorAll('.brush-size-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const size = parseInt(e.currentTarget.dataset.size);
                this.setBrushSize(size);
            });
        });

        // Canvas drawing events
        if (this.canvas) {
            this.canvas.addEventListener('mousedown', (e) => this.handleMouseDown(e));
            this.canvas.addEventListener('mousemove', (e) => this.handleMouseMove(e));
            this.canvas.addEventListener('mouseup', (e) => this.handleMouseUp(e));
            this.canvas.addEventListener('wheel', (e) => this.handleWheel(e));
            this.canvas.addEventListener('contextmenu', (e) => e.preventDefault());
        }

        // Zoom controls
        const zoomInBtn = document.getElementById('zoom-in');
        const zoomOutBtn = document.getElementById('zoom-out');
        const resetViewBtn = document.getElementById('reset-view');
        
        if (zoomInBtn) zoomInBtn.addEventListener('click', () => this.zoomIn());
        if (zoomOutBtn) zoomOutBtn.addEventListener('click', () => this.zoomOut());
        if (resetViewBtn) resetViewBtn.addEventListener('click', () => this.resetView());

        // History controls
        const undoBtn = document.getElementById('undo-btn');
        const redoBtn = document.getElementById('redo-btn');
        
        if (undoBtn) undoBtn.addEventListener('click', () => this.undo());
        if (redoBtn) redoBtn.addEventListener('click', () => this.redo());

        // Clear track
        const clearBtn = document.getElementById('clear-track');
        if (clearBtn) {
            clearBtn.addEventListener('click', () => {
                if (confirm('Clear the entire track? This cannot be undone.')) {
                    this.clearTrack();
                    this.saveHistoryState();
                }
            });
        }

        // File actions
        const newTrackBtn = document.getElementById('new-track-btn');
        const loadTemplateBtn = document.getElementById('load-template-btn');
        const saveTrackBtn = document.getElementById('save-track-btn');
        const exportTrackBtn = document.getElementById('export-track-btn');
        
        if (newTrackBtn) newTrackBtn.addEventListener('click', () => this.newTrack());
        if (loadTemplateBtn) loadTemplateBtn.addEventListener('click', () => this.loadTemplate());
        if (saveTrackBtn) saveTrackBtn.addEventListener('click', () => this.saveTrack());
        if (exportTrackBtn) exportTrackBtn.addEventListener('click', () => this.exportTrack());

        // Preview and test
        const previewBtn = document.getElementById('preview-track-btn');
        const testBtn = document.getElementById('test-track-btn');
        const livePreviewBtn = document.getElementById('live-preview-btn');
        
        if (previewBtn) previewBtn.addEventListener('click', () => this.previewTrack());
        if (testBtn) testBtn.addEventListener('click', () => this.testTrack());
        if (livePreviewBtn) livePreviewBtn.addEventListener('click', () => this.toggleLivePreview());

        // Settings
        const showGridCheck = document.getElementById('show-grid');
        const snapToGridCheck = document.getElementById('snap-to-grid');
        const autoSaveCheck = document.getElementById('auto-save');
        
        if (showGridCheck) {
            showGridCheck.addEventListener('change', (e) => {
                this.settings.showGrid = e.target.checked;
                this.updateGridDisplay();
            });
        }
        
        if (snapToGridCheck) {
            snapToGridCheck.addEventListener('change', (e) => {
                this.settings.snapToGrid = e.target.checked;
            });
        }
        
        if (autoSaveCheck) {
            autoSaveCheck.addEventListener('change', (e) => {
                this.settings.autoSave = e.target.checked;
            });
        }

        // Track metadata inputs
        const trackNameInput = document.getElementById('track-name');
        const trackDifficultySelect = document.getElementById('track-difficulty');
        const trackAuthorInput = document.getElementById('track-author');
        const trackDescriptionInput = document.getElementById('track-description');
        
        if (trackNameInput) {
            trackNameInput.addEventListener('input', (e) => {
                this.trackMetadata.name = e.target.value;
                this.updateTrackInfo();
            });
        }
        
        if (trackDifficultySelect) {
            trackDifficultySelect.addEventListener('change', (e) => {
                this.trackMetadata.difficulty = e.target.value;
            });
        }
        
        if (trackAuthorInput) {
            trackAuthorInput.addEventListener('input', (e) => {
                this.trackMetadata.author = e.target.value;
            });
        }
        
        if (trackDescriptionInput) {
            trackDescriptionInput.addEventListener('input', (e) => {
                this.trackMetadata.description = e.target.value;
            });
        }

        // Close and minimize
        const closeBtn = document.getElementById('editor-close');
        const minimizeBtn = document.getElementById('editor-minimize');
        
        if (closeBtn) closeBtn.addEventListener('click', () => this.hide());
        if (minimizeBtn) minimizeBtn.addEventListener('click', () => this.minimize());

        // File input for templates
        const fileInput = document.getElementById('template-file-input');
        if (fileInput) {
            fileInput.addEventListener('change', (e) => {
                this.handleTemplateFiles(e.target.files);
            });
        }

        // Keyboard shortcuts
        document.addEventListener('keydown', (e) => {
            if (!this.isVisible) return;
            
            switch(e.code) {
                case 'KeyE':
                    if (!this.isInputFocused()) {
                        e.preventDefault();
                        this.toggle();
                    }
                    break;
                case 'KeyB':
                    if (!this.isInputFocused()) {
                        e.preventDefault();
                        this.selectTool('brush');
                    }
                    break;
                case 'KeyG':
                    if (!this.isInputFocused()) {
                        e.preventDefault();
                        this.selectTool('eraser');
                    }
                    break;
                case 'KeyL':
                    if (!this.isInputFocused()) {
                        e.preventDefault();
                        this.selectTool('line');
                    }
                    break;
                case 'KeyR':
                    if (!this.isInputFocused()) {
                        e.preventDefault();
                        this.selectTool('rectangle');
                    }
                    break;
                case 'KeyF':
                    if (!this.isInputFocused()) {
                        e.preventDefault();
                        this.selectTool('fill');
                    }
                    break;
                case 'Space':
                    if (!this.isInputFocused()) {
                        e.preventDefault();
                        this.resetView();
                    }
                    break;
                case 'KeyZ':
                    if (e.ctrlKey || e.metaKey) {
                        e.preventDefault();
                        if (e.shiftKey) {
                            this.redo();
                        } else {
                            this.undo();
                        }
                    }
                    break;
                case 'KeyY':
                    if (e.ctrlKey || e.metaKey) {
                        e.preventDefault();
                        this.redo();
                    }
                    break;
                case 'KeyS':
                    if (e.ctrlKey || e.metaKey) {
                        e.preventDefault();
                        this.saveTrack();
                    }
                    break;
                case 'Escape':
                    this.hide();
                    break;
            }
        });
    }

    /**
     * Setup drag and drop for template loading
     */
    setupDragAndDrop() {
        const canvasContainer = document.getElementById('canvas-container');
        if (!canvasContainer) return;

        ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
            canvasContainer.addEventListener(eventName, (e) => {
                e.preventDefault();
                e.stopPropagation();
            });
        });

        ['dragenter', 'dragover'].forEach(eventName => {
            canvasContainer.addEventListener(eventName, () => {
                canvasContainer.classList.add('drag-over');
            });
        });

        ['dragleave', 'drop'].forEach(eventName => {
            canvasContainer.addEventListener(eventName, () => {
                canvasContainer.classList.remove('drag-over');
            });
        });

        canvasContainer.addEventListener('drop', (e) => {
            const files = e.dataTransfer.files;
            if (files.length > 0) {
                this.handleTemplateFiles(files);
            }
        });
    }

    /**
     * Select drawing tool
     */
    selectTool(toolName) {
        if (!this.tools[toolName]) return;
        
        this.currentTool = toolName;
        
        // Update tool button states
        document.querySelectorAll('.tool-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.tool === toolName);
        });
        
        // Update cursor
        if (this.canvas) {
            this.canvas.style.cursor = this.tools[toolName].cursor;
        }
        
        console.log(`[TrackEditor] Selected tool: ${toolName}`);
    }

    /**
     * Set brush size
     */
    setBrushSize(size) {
        this.brushSize = size;
        
        // Update brush size button states
        document.querySelectorAll('.brush-size-btn').forEach(btn => {
            btn.classList.toggle('active', parseInt(btn.dataset.size) === size);
        });
        
        console.log(`[TrackEditor] Brush size set to: ${size}px`);
    }

    /**
     * Handle mouse down events
     */
    handleMouseDown(e) {
        if (!this.canvas) return;
        
        const rect = this.canvas.getBoundingClientRect();
        const x = (e.clientX - rect.left) / this.canvasScale / this.viewport.zoom;
        const y = (e.clientY - rect.top) / this.canvasScale / this.viewport.zoom;
        
        this.isDrawing = true;
        this.drawing.startPoint = { x, y };
        
        switch (this.currentTool) {
            case 'brush':
            case 'eraser':
                this.startFreehandDrawing(x, y);
                break;
            case 'line':
            case 'rectangle':
                // These tools use mouse up for completion
                break;
            case 'fill':
                this.floodFill(x, y);
                this.saveHistoryState();
                break;
        }
    }

    /**
     * Handle mouse move events
     */
    handleMouseMove(e) {
        if (!this.canvas) return;
        
        const rect = this.canvas.getBoundingClientRect();
        const x = (e.clientX - rect.left) / this.canvasScale / this.viewport.zoom;
        const y = (e.clientY - rect.top) / this.canvasScale / this.viewport.zoom;
        
        if (this.isDrawing) {
            this.drawing.endPoint = { x, y };
            
            switch (this.currentTool) {
                case 'brush':
                case 'eraser':
                    this.continueFreehandDrawing(x, y);
                    break;
                case 'line':
                case 'rectangle':
                    this.updatePreview();
                    break;
            }
        }
        
        // Update crosshair position
        this.updateCrosshair(e.clientX - rect.left, e.clientY - rect.top);
    }

    /**
     * Handle mouse up events
     */
    handleMouseUp(e) {
        if (!this.isDrawing) return;
        
        const rect = this.canvas.getBoundingClientRect();
        const x = (e.clientX - rect.left) / this.canvasScale / this.viewport.zoom;
        const y = (e.clientY - rect.top) / this.canvasScale / this.viewport.zoom;
        
        this.drawing.endPoint = { x, y };
        
        switch (this.currentTool) {
            case 'brush':
            case 'eraser':
                this.finishFreehandDrawing();
                break;
            case 'line':
                this.drawLine();
                break;
            case 'rectangle':
                this.drawRectangle();
                break;
        }
        
        this.isDrawing = false;
        this.lastDrawPoint = null;
        this.clearPreview();
        this.saveHistoryState();
        this.updatePreviewCanvas();
        this.updateMiniMap();
        
        // Notify live preview of changes
        if (this.trackPreview && this.trackPreview.isActive) {
            this.trackPreview.updatePreviewFromTrackEditor();
        }
    }

    /**
     * Handle mouse wheel for zooming
     */
    handleWheel(e) {
        e.preventDefault();
        
        const zoomDelta = e.deltaY > 0 ? -0.1 : 0.1;
        const newZoom = Math.max(this.viewport.minZoom, 
                        Math.min(this.viewport.maxZoom, this.viewport.zoom + zoomDelta));
        
        this.setZoom(newZoom);
    }

    /**
     * Start freehand drawing (brush/eraser)
     */
    startFreehandDrawing(x, y) {
        this.lastDrawPoint = { x, y };
        this.drawPixel(x, y);
    }

    /**
     * Continue freehand drawing
     */
    continueFreehandDrawing(x, y) {
        if (this.lastDrawPoint) {
            this.drawLine(this.lastDrawPoint.x, this.lastDrawPoint.y, x, y, false);
        }
        this.lastDrawPoint = { x, y };
    }

    /**
     * Finish freehand drawing
     */
    finishFreehandDrawing() {
        // Drawing is already complete, just clean up
    }

    /**
     * Draw a pixel at coordinates
     */
    drawPixel(x, y) {
        if (!this.ctx) return;
        
        const color = this.currentTool === 'eraser' ? '#FFFFFF' : '#000000';
        const size = this.brushSize;
        
        this.ctx.fillStyle = color;
        this.ctx.fillRect(
            (x - size/2) * this.canvasScale * this.viewport.zoom,
            (y - size/2) * this.canvasScale * this.viewport.zoom,
            size * this.canvasScale * this.viewport.zoom,
            size * this.canvasScale * this.viewport.zoom
        );
    }

    /**
     * Draw a line between two points
     */
    drawLine(x1, y1, x2, y2, isComplete = true) {
        if (!this.ctx) return;
        
        if (isComplete && this.drawing.startPoint && this.drawing.endPoint) {
            x1 = this.drawing.startPoint.x;
            y1 = this.drawing.startPoint.y;
            x2 = this.drawing.endPoint.x;
            y2 = this.drawing.endPoint.y;
        }
        
        const color = this.currentTool === 'eraser' ? '#FFFFFF' : '#000000';
        const size = this.brushSize;
        
        this.ctx.strokeStyle = color;
        this.ctx.lineWidth = size * this.canvasScale * this.viewport.zoom;
        this.ctx.lineCap = 'round';
        
        this.ctx.beginPath();
        this.ctx.moveTo(x1 * this.canvasScale * this.viewport.zoom, y1 * this.canvasScale * this.viewport.zoom);
        this.ctx.lineTo(x2 * this.canvasScale * this.viewport.zoom, y2 * this.canvasScale * this.viewport.zoom);
        this.ctx.stroke();
    }

    /**
     * Draw a rectangle
     */
    drawRectangle() {
        if (!this.ctx || !this.drawing.startPoint || !this.drawing.endPoint) return;
        
        const startX = Math.min(this.drawing.startPoint.x, this.drawing.endPoint.x);
        const startY = Math.min(this.drawing.startPoint.y, this.drawing.endPoint.y);
        const width = Math.abs(this.drawing.endPoint.x - this.drawing.startPoint.x);
        const height = Math.abs(this.drawing.endPoint.y - this.drawing.startPoint.y);
        
        const color = this.currentTool === 'eraser' ? '#FFFFFF' : '#000000';
        
        this.ctx.fillStyle = color;
        this.ctx.fillRect(
            startX * this.canvasScale * this.viewport.zoom,
            startY * this.canvasScale * this.viewport.zoom,
            width * this.canvasScale * this.viewport.zoom,
            height * this.canvasScale * this.viewport.zoom
        );
    }

    /**
     * Flood fill tool
     */
    floodFill(x, y) {
        // Implementation would require pixel-by-pixel flood fill algorithm
        // For now, show a notification that this is a complex feature
        this.showNotification('Flood fill tool coming soon!', 'info');
    }

    /**
     * Update preview for shape tools
     */
    updatePreview() {
        // Clear previous preview and redraw
        this.redrawCanvas();
        
        if (!this.drawing.startPoint || !this.drawing.endPoint) return;
        
        // Draw preview in different color/style
        this.ctx.globalCompositeOperation = 'source-over';
        this.ctx.strokeStyle = '#00FF00';
        this.ctx.lineWidth = 2;
        this.ctx.setLineDash([5, 5]);
        
        if (this.currentTool === 'line') {
            this.ctx.beginPath();
            this.ctx.moveTo(
                this.drawing.startPoint.x * this.canvasScale * this.viewport.zoom,
                this.drawing.startPoint.y * this.canvasScale * this.viewport.zoom
            );
            this.ctx.lineTo(
                this.drawing.endPoint.x * this.canvasScale * this.viewport.zoom,
                this.drawing.endPoint.y * this.canvasScale * this.viewport.zoom
            );
            this.ctx.stroke();
        } else if (this.currentTool === 'rectangle') {
            const startX = Math.min(this.drawing.startPoint.x, this.drawing.endPoint.x);
            const startY = Math.min(this.drawing.startPoint.y, this.drawing.endPoint.y);
            const width = Math.abs(this.drawing.endPoint.x - this.drawing.startPoint.x);
            const height = Math.abs(this.drawing.endPoint.y - this.drawing.startPoint.y);
            
            this.ctx.strokeRect(
                startX * this.canvasScale * this.viewport.zoom,
                startY * this.canvasScale * this.viewport.zoom,
                width * this.canvasScale * this.viewport.zoom,
                height * this.canvasScale * this.viewport.zoom
            );
        }
        
        this.ctx.setLineDash([]);
        this.ctx.globalCompositeOperation = 'source-over';
    }

    /**
     * Clear preview
     */
    clearPreview() {
        this.redrawCanvas();
    }

    /**
     * Redraw the canvas from the preview canvas
     */
    redrawCanvas() {
        if (!this.ctx || !this.previewCanvas) return;
        
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        this.ctx.drawImage(this.previewCanvas, 0, 0, this.canvas.width, this.canvas.height);
    }

    /**
     * Update the full-resolution preview canvas
     */
    updatePreviewCanvas() {
        if (!this.previewCtx || !this.canvas) return;
        
        // Scale up the display canvas to the preview canvas
        this.previewCtx.clearRect(0, 0, this.previewCanvas.width, this.previewCanvas.height);
        this.previewCtx.drawImage(this.canvas, 0, 0, this.previewCanvas.width, this.previewCanvas.height);
    }

    /**
     * Update mini map
     */
    updateMiniMap() {
        if (!this.miniMapCtx || !this.previewCanvas) return;
        
        this.miniMapCtx.clearRect(0, 0, this.miniMapCanvas.width, this.miniMapCanvas.height);
        this.miniMapCtx.drawImage(this.previewCanvas, 0, 0, this.miniMapCanvas.width, this.miniMapCanvas.height);
        
        // Draw viewport indicator
        this.updateViewportIndicator();
    }

    /**
     * Update viewport indicator on mini map
     */
    updateViewportIndicator() {
        const indicator = document.getElementById('viewport-indicator');
        if (!indicator) return;
        
        const viewportWidth = (this.canvas.width / this.trackWidth) * this.miniMapCanvas.width / this.viewport.zoom;
        const viewportHeight = (this.canvas.height / this.trackHeight) * this.miniMapCanvas.height / this.viewport.zoom;
        
        indicator.style.width = `${viewportWidth}px`;
        indicator.style.height = `${viewportHeight}px`;
        indicator.style.left = `${(this.viewport.x / this.trackWidth) * this.miniMapCanvas.width}px`;
        indicator.style.top = `${(this.viewport.y / this.trackHeight) * this.miniMapCanvas.height}px`;
    }

    /**
     * Update crosshair position
     */
    updateCrosshair(x, y) {
        const crosshair = document.getElementById('crosshair');
        if (!crosshair) return;
        
        crosshair.style.left = `${x}px`;
        crosshair.style.top = `${y}px`;
    }

    /**
     * Zoom in
     */
    zoomIn() {
        const newZoom = Math.min(this.viewport.maxZoom, this.viewport.zoom + 0.25);
        this.setZoom(newZoom);
    }

    /**
     * Zoom out
     */
    zoomOut() {
        const newZoom = Math.max(this.viewport.minZoom, this.viewport.zoom - 0.25);
        this.setZoom(newZoom);
    }

    /**
     * Set zoom level
     */
    setZoom(zoom) {
        this.viewport.zoom = zoom;
        this.updateZoomDisplay();
        this.redrawCanvas();
        this.updateViewportIndicator();
    }

    /**
     * Reset view to default
     */
    resetView() {
        this.viewport.x = 0;
        this.viewport.y = 0;
        this.viewport.zoom = 1.0;
        this.updateZoomDisplay();
        this.redrawCanvas();
        this.updateViewportIndicator();
    }

    /**
     * Update zoom level display
     */
    updateZoomDisplay() {
        const zoomLevel = document.getElementById('zoom-level');
        if (zoomLevel) {
            zoomLevel.textContent = `${Math.round(this.viewport.zoom * 100)}%`;
        }
    }

    /**
     * Update grid display
     */
    updateGridDisplay() {
        const gridOverlay = document.getElementById('grid-overlay');
        if (!gridOverlay) return;
        
        if (this.settings.showGrid) {
            gridOverlay.style.display = 'block';
            // Grid implementation would go here
        } else {
            gridOverlay.style.display = 'none';
        }
    }

    /**
     * Save history state for undo/redo
     */
    saveHistoryState() {
        if (!this.previewCanvas) return;
        
        // Remove any states after current index
        this.history = this.history.slice(0, this.historyIndex + 1);
        
        // Add new state
        const imageData = this.previewCtx.getImageData(0, 0, this.previewCanvas.width, this.previewCanvas.height);
        this.history.push(imageData);
        
        // Limit history size
        if (this.history.length > this.maxHistoryStates) {
            this.history.shift();
        } else {
            this.historyIndex++;
        }
        
        this.updateHistoryButtons();
    }

    /**
     * Undo last action
     */
    undo() {
        if (this.historyIndex > 0) {
            this.historyIndex--;
            const imageData = this.history[this.historyIndex];
            this.previewCtx.putImageData(imageData, 0, 0);
            this.redrawCanvas();
            this.updateMiniMap();
            this.updateHistoryButtons();
        }
    }

    /**
     * Redo last undone action
     */
    redo() {
        if (this.historyIndex < this.history.length - 1) {
            this.historyIndex++;
            const imageData = this.history[this.historyIndex];
            this.previewCtx.putImageData(imageData, 0, 0);
            this.redrawCanvas();
            this.updateMiniMap();
            this.updateHistoryButtons();
        }
    }

    /**
     * Update undo/redo button states
     */
    updateHistoryButtons() {
        const undoBtn = document.getElementById('undo-btn');
        const redoBtn = document.getElementById('redo-btn');
        
        if (undoBtn) undoBtn.disabled = this.historyIndex <= 0;
        if (redoBtn) redoBtn.disabled = this.historyIndex >= this.history.length - 1;
    }

    /**
     * Clear track (fill with white)
     */
    clearTrack() {
        if (!this.ctx || !this.previewCtx) return;
        
        // Clear display canvas
        this.ctx.fillStyle = '#FFFFFF';
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
        
        // Clear preview canvas
        this.previewCtx.fillStyle = '#FFFFFF';
        this.previewCtx.fillRect(0, 0, this.previewCanvas.width, this.previewCanvas.height);
        
        this.updateMiniMap();
        this.updateStatus('Track cleared');
    }

    /**
     * Create new track
     */
    newTrack() {
        if (confirm('Create a new track? Any unsaved changes will be lost.')) {
            this.clearTrack();
            this.trackMetadata = {
                name: 'New Track',
                difficulty: 'medium',
                author: 'Player',
                description: 'A custom race track'
            };
            this.updateTrackMetadataInputs();
            this.saveHistoryState();
            this.updateStatus('New track created');
        }
    }

    /**
     * Load template
     */
    loadTemplate() {
        const fileInput = document.getElementById('template-file-input');
        if (fileInput) {
            fileInput.click();
        }
    }

    /**
     * Handle template file loading
     */
    async handleTemplateFiles(files) {
        for (const file of files) {
            try {
                if (file.type.startsWith('image/')) {
                    await this.loadImageTemplate(file);
                } else if (file.type === 'application/json' || file.name.endsWith('.json')) {
                    await this.loadJSONTemplate(file);
                }
            } catch (error) {
                console.error('[TrackEditor] Failed to load template:', error);
                this.showNotification(`Failed to load ${file.name}`, 'error');
            }
        }
    }

    /**
     * Load image template
     */
    loadImageTemplate(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (e) => {
                const img = new Image();
                img.onload = () => {
                    // Draw image to canvas
                    this.previewCtx.clearRect(0, 0, this.previewCanvas.width, this.previewCanvas.height);
                    this.previewCtx.drawImage(img, 0, 0, this.previewCanvas.width, this.previewCanvas.height);
                    this.redrawCanvas();
                    this.updateMiniMap();
                    this.saveHistoryState();
                    this.showNotification(`Template loaded: ${file.name}`, 'success');
                    resolve();
                };
                img.onerror = () => reject(new Error('Failed to load image'));
                img.src = e.target.result;
            };
            reader.onerror = () => reject(new Error('Failed to read file'));
            reader.readAsDataURL(file);
        });
    }

    /**
     * Load JSON template with metadata
     */
    loadJSONTemplate(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (e) => {
                try {
                    const data = JSON.parse(e.target.result);
                    if (data.name) this.trackMetadata.name = data.name;
                    if (data.difficulty) this.trackMetadata.difficulty = data.difficulty;
                    if (data.author) this.trackMetadata.author = data.author;
                    if (data.description) this.trackMetadata.description = data.description;
                    
                    this.updateTrackMetadataInputs();
                    this.showNotification(`Template metadata loaded: ${file.name}`, 'success');
                    resolve();
                } catch (error) {
                    reject(new Error('Invalid JSON format'));
                }
            };
            reader.onerror = () => reject(new Error('Failed to read file'));
            reader.readAsText(file);
        });
    }

    /**
     * Save track
     */
    saveTrack() {
        const trackData = {
            imageData: this.previewCanvas.toDataURL('image/png'),
            metadata: this.trackMetadata,
            timestamp: Date.now()
        };
        
        // Save to localStorage for now (could be extended to server)
        const savedTracks = JSON.parse(localStorage.getItem('memex-custom-tracks') || '[]');
        savedTracks.push(trackData);
        localStorage.setItem('memex-custom-tracks', JSON.stringify(savedTracks));
        
        this.showNotification('Track saved successfully!', 'success');
        this.updateStatus('Track saved');
    }

    /**
     * Export track as PNG
     */
    exportTrack() {
        const link = document.createElement('a');
        link.download = `${this.trackMetadata.name.toLowerCase().replace(/\s+/g, '-')}.png`;
        link.href = this.previewCanvas.toDataURL('image/png');
        link.click();
        
        this.showNotification('Track exported as PNG!', 'success');
    }

    /**
     * Preview track in game
     */
    previewTrack() {
        // Integration with PreviewSystem
        if (this.uiManager && this.uiManager.previewSystem) {
            const trackImageData = this.previewCanvas.toDataURL('image/png');
            this.uiManager.previewSystem.previewCustomTrack(trackImageData, this.trackMetadata);
            this.showNotification('Track preview loaded!', 'success');
        } else {
            this.showNotification('Preview system not available', 'warn');
        }
    }

    /**
     * Test track with AI players
     */
    testTrack() {
        if (this.trackPreview) {
            this.trackPreview.show();
            this.trackPreview.resetPreview();
            this.trackPreview.togglePlayback();
            this.showNotification('Test race started in preview!', 'success');
        } else {
            this.showNotification('Test race feature coming soon!', 'info');
        }
    }

    /**
     * Toggle live preview panel
     */
    toggleLivePreview() {
        if (this.trackPreview) {
            this.trackPreview.toggle();
            const isVisible = this.trackPreview.isVisible;
            this.showNotification(
                isVisible ? 'Live preview enabled' : 'Live preview disabled', 
                'info'
            );
        } else {
            this.showNotification('Live preview not available', 'warn');
        }
    }

    /**
     * Update track metadata inputs
     */
    updateTrackMetadataInputs() {
        const nameInput = document.getElementById('track-name');
        const difficultySelect = document.getElementById('track-difficulty');
        const authorInput = document.getElementById('track-author');
        const descriptionInput = document.getElementById('track-description');
        
        if (nameInput) nameInput.value = this.trackMetadata.name;
        if (difficultySelect) difficultySelect.value = this.trackMetadata.difficulty;
        if (authorInput) authorInput.value = this.trackMetadata.author;
        if (descriptionInput) descriptionInput.value = this.trackMetadata.description;
        
        this.updateTrackInfo();
    }

    /**
     * Update track info display
     */
    updateTrackInfo() {
        const trackInfo = document.getElementById('track-info');
        if (trackInfo) {
            trackInfo.textContent = this.trackMetadata.name;
        }
    }

    /**
     * Update editor status
     */
    updateStatus(message) {
        const status = document.getElementById('editor-status');
        if (status) {
            status.textContent = message;
            
            // Clear status after delay
            setTimeout(() => {
                status.textContent = 'Ready';
            }, 3000);
        }
    }

    /**
     * Check if input element is focused
     */
    isInputFocused() {
        const activeElement = document.activeElement;
        return activeElement && (
            activeElement.tagName === 'INPUT' ||
            activeElement.tagName === 'TEXTAREA' ||
            activeElement.tagName === 'SELECT' ||
            activeElement.contentEditable === 'true'
        );
    }

    /**
     * Show track editor panel
     */
    show() {
        const panel = document.getElementById('track-editor-panel');
        if (panel) {
            panel.style.display = 'block';
            this.isVisible = true;
            this.updateMiniMap();
            this.updateGridDisplay();
            
            // Trigger show event
            this.uiManager?.emit('trackEditorShown');
        }
    }

    /**
     * Hide track editor panel
     */
    hide() {
        const panel = document.getElementById('track-editor-panel');
        if (panel) {
            panel.style.display = 'none';
            this.isVisible = false;
            
            // Trigger hide event
            this.uiManager?.emit('trackEditorHidden');
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
        return document.getElementById('track-editor-panel');
    }

    /**
     * Minimize panel (hide sidebar)
     */
    minimize() {
        const container = document.querySelector('.track-editor-container');
        if (container) {
            container.classList.toggle('minimized');
        }
    }

    /**
     * Show notification message
     */
    showNotification(message, type = 'info') {
        // Create or update notification element
        let notification = document.getElementById('track-editor-notification');
        if (!notification) {
            notification = document.createElement('div');
            notification.id = 'track-editor-notification';
            notification.className = 'notification';
            
            const panel = document.getElementById('track-editor-panel');
            if (panel) {
                panel.appendChild(notification);
            }
        }
        
        notification.textContent = message;
        notification.className = `notification ${type} show`;
        
        // Auto-hide after 3 seconds
        setTimeout(() => {
            notification.classList.remove('show');
        }, 3000);
    }

    /**
     * Get editor state for debugging
     */
    getEditorState() {
        return {
            isVisible: this.isVisible,
            isEditing: this.isEditing,
            currentTool: this.currentTool,
            brushSize: this.brushSize,
            viewport: this.viewport,
            settings: this.settings,
            trackMetadata: this.trackMetadata,
            historyCount: this.history.length,
            historyIndex: this.historyIndex
        };
    }

    /**
     * Destroy the track editor
     */
    destroy() {
        this.hide();
        
        // Destroy track preview
        if (this.trackPreview) {
            this.trackPreview.destroy();
            this.trackPreview = null;
        }
        
        // Clear history
        this.history = [];
        
        // Clean up canvases
        if (this.ctx) this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        if (this.previewCtx) this.previewCtx.clearRect(0, 0, this.previewCanvas.width, this.previewCanvas.height);
        if (this.miniMapCtx) this.miniMapCtx.clearRect(0, 0, this.miniMapCanvas.width, this.miniMapCanvas.height);
        
        console.log('[TrackEditor] Track editor destroyed');
    }
}