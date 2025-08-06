/**
 * TrackValidator.js - Comprehensive Track Validation System for Memex Racing
 * 
 * Validates track designs to ensure they are playable, fair, and meet game requirements.
 * Provides real-time feedback, visual indicators, and detailed validation reports.
 * Integrates with TrackEditor to guide users in creating high-quality tracks.
 */

export class TrackValidator {
    constructor(options = {}) {
        // Configuration
        this.config = {
            // Track requirements
            minTrackWidth: 128,           // Minimum track width in pixels (4 * 32px player size)
            maxTrackWidth: 800,           // Maximum track width to prevent overly wide areas
            minTrackCoverage: 0.05,       // Minimum 5% of total area must be track
            maxTrackCoverage: 0.80,       // Maximum 80% to ensure challenge
            minPathLength: 1000,          // Minimum path length from start to finish
            maxPathLength: 15000,         // Maximum path length to prevent overly long tracks
            
            // Player requirements
            maxPlayers: 6,                // Maximum players per race
            playerSize: 32,               // Player sprite size in pixels
            playerSpacing: 48,            // Minimum spacing between players at start
            minStartAreaRadius: 80,       // Minimum start area radius
            minTokenAreaRadius: 64,       // Minimum token spawn area radius
            
            // Performance requirements
            maxComplexityScore: 1000,     // Maximum complexity for performance
            maxRenderObjects: 500,        // Maximum objects that can be rendered
            
            // Map dimensions
            trackWidth: 4000,
            trackHeight: 2000,
            
            // Validation thresholds
            strictMode: false,            // Enable stricter validation rules
            allowIsolatedSections: false, // Allow isolated track sections
            
            ...options
        };

        // Validation state
        this.lastValidation = null;
        this.validationCache = new Map();
        this.isValidating = false;
        
        // Analysis data
        this.analysisData = {
            pixelData: null,
            trackPixels: [],
            wallPixels: [],
            connectedRegions: [],
            pathNetwork: null,
            widthMap: null,
            complexityMetrics: {}
        };

        // Validation presets for different track types
        this.presets = {
            racing: {
                name: 'Racing Track',
                minTrackWidth: 160,
                maxTrackWidth: 400,
                minTrackCoverage: 0.15,
                maxTrackCoverage: 0.60,
                minPathLength: 2000,
                requiresLoop: true,
                allowDeadEnds: false
            },
            maze: {
                name: 'Maze Track',
                minTrackWidth: 96,
                maxTrackWidth: 200,
                minTrackCoverage: 0.08,
                maxTrackCoverage: 0.45,
                minPathLength: 3000,
                requiresLoop: false,
                allowDeadEnds: true,
                allowIsolatedSections: false
            },
            speed: {
                name: 'Speed Track',
                minTrackWidth: 200,
                maxTrackWidth: 600,
                minTrackCoverage: 0.20,
                maxTrackCoverage: 0.70,
                minPathLength: 1500,
                requiresLoop: true,
                allowDeadEnds: false,
                maxTurns: 10
            },
            custom: {
                name: 'Custom Track',
                minTrackWidth: 128,
                maxTrackWidth: 800,
                minTrackCoverage: 0.05,
                maxTrackCoverage: 0.80,
                minPathLength: 1000,
                requiresLoop: false,
                allowDeadEnds: true,
                allowIsolatedSections: true
            }
        };

        console.log('[TrackValidator] Track validation system initialized');
    }

    /**
     * Validate a track from image data or canvas
     * @param {ImageData|HTMLCanvasElement|HTMLImageElement} source - Track source
     * @param {Object} options - Validation options
     * @returns {Promise<Object>} Validation result
     */
    async validateTrack(source, options = {}) {
        if (this.isValidating) {
            console.warn('[TrackValidator] Validation already in progress');
            return this.lastValidation;
        }

        this.isValidating = true;
        const startTime = performance.now();

        try {
            // Extract pixel data from source
            const pixelData = await this.extractPixelData(source);
            
            // Cache key for validation results
            const cacheKey = this.generateCacheKey(pixelData, options);
            
            // Check cache first
            if (this.validationCache.has(cacheKey) && !options.force) {
                this.isValidating = false;
                return this.validationCache.get(cacheKey);
            }

            // Apply preset if specified
            const config = options.preset ? 
                { ...this.config, ...this.presets[options.preset] } : 
                this.config;

            // Perform validation analysis
            const validation = {
                isValid: false,
                errors: [],
                warnings: [],
                suggestions: [],
                metrics: {},
                analysis: {},
                visualData: {},
                performance: {
                    validationTime: 0,
                    complexity: 0
                },
                timestamp: Date.now()
            };

            // Store analysis data
            this.analysisData.pixelData = pixelData;
            
            // Run validation checks
            await this.analyzeTrackStructure(pixelData, validation, config);
            await this.validateConnectivity(validation, config);
            await this.validateTrackWidth(validation, config);
            await this.validateStartAreas(validation, config, options.startAreas);
            await this.validateTokenAreas(validation, config, options.tokenAreas);
            await this.validateTrackCoverage(validation, config);
            await this.validatePathLength(validation, config, options.routes);
            await this.validatePerformance(validation, config);
            await this.analyzeGameplayBalance(validation, config);

            // Generate suggestions for improvements
            this.generateSuggestions(validation, config);
            
            // Calculate final validity
            validation.isValid = validation.errors.length === 0;
            validation.performance.validationTime = performance.now() - startTime;
            
            // Cache results
            this.validationCache.set(cacheKey, validation);
            this.lastValidation = validation;

            console.log(`[TrackValidator] Validation completed in ${validation.performance.validationTime.toFixed(2)}ms`);
            return validation;

        } catch (error) {
            console.error('[TrackValidator] Validation failed:', error);
            this.isValidating = false;
            throw error;
        } finally {
            this.isValidating = false;
        }
    }

    /**
     * Extract pixel data from various source types
     * @param {*} source - Image source
     * @returns {Promise<ImageData>} Pixel data
     */
    async extractPixelData(source) {
        if (source instanceof ImageData) {
            return source;
        }

        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        
        canvas.width = this.config.trackWidth;
        canvas.height = this.config.trackHeight;

        if (source instanceof HTMLCanvasElement) {
            ctx.drawImage(source, 0, 0, canvas.width, canvas.height);
        } else if (source instanceof HTMLImageElement) {
            await this.waitForImageLoad(source);
            ctx.drawImage(source, 0, 0, canvas.width, canvas.height);
        } else if (typeof source === 'string') {
            // URL or data URL
            const img = new Image();
            img.src = source;
            await this.waitForImageLoad(img);
            ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        } else {
            throw new Error('Unsupported source type for pixel data extraction');
        }

        return ctx.getImageData(0, 0, canvas.width, canvas.height);
    }

    /**
     * Wait for image to load
     * @param {HTMLImageElement} img - Image element
     * @returns {Promise<void>}
     */
    waitForImageLoad(img) {
        return new Promise((resolve, reject) => {
            if (img.complete) {
                resolve();
            } else {
                img.onload = () => resolve();
                img.onerror = () => reject(new Error('Failed to load image'));
            }
        });
    }

    /**
     * Generate cache key for validation results
     * @param {ImageData} pixelData - Pixel data
     * @param {Object} options - Options
     * @returns {string} Cache key
     */
    generateCacheKey(pixelData, options) {
        // Create hash of pixel data and options
        const dataHash = this.hashPixelData(pixelData);
        const optionsHash = this.hashObject(options);
        return `${dataHash}_${optionsHash}`;
    }

    /**
     * Create hash of pixel data for caching
     * @param {ImageData} pixelData - Pixel data
     * @returns {string} Hash
     */
    hashPixelData(pixelData) {
        // Sample pixels at regular intervals for hash
        let hash = 0;
        const step = Math.floor(pixelData.data.length / 1000); // Sample 1000 pixels
        
        for (let i = 0; i < pixelData.data.length; i += step) {
            hash = ((hash << 5) - hash + pixelData.data[i]) & 0xffffffff;
        }
        
        return hash.toString(36);
    }

    /**
     * Create hash of object for caching
     * @param {Object} obj - Object to hash
     * @returns {string} Hash
     */
    hashObject(obj) {
        return JSON.stringify(obj).split('').reduce((hash, char) => {
            return ((hash << 5) - hash + char.charCodeAt(0)) & 0xffffffff;
        }, 0).toString(36);
    }

    /**
     * Analyze track structure and identify track/wall pixels
     * @param {ImageData} pixelData - Pixel data
     * @param {Object} validation - Validation result object
     * @param {Object} config - Configuration
     */
    async analyzeTrackStructure(pixelData, validation, config) {
        const { data, width, height } = pixelData;
        const trackPixels = [];
        const wallPixels = [];
        
        let totalPixels = 0;
        let trackPixelCount = 0;

        // Analyze each pixel
        for (let y = 0; y < height; y++) {
            for (let x = 0; x < width; x++) {
                const index = (y * width + x) * 4;
                const alpha = data[index + 3];
                const red = data[index];
                const green = data[index + 1];
                const blue = data[index + 2];
                
                totalPixels++;
                
                // Track pixels are white with high alpha, or transparent areas in collision maps
                const isTrack = (alpha > 128 && red > 200 && green > 200 && blue > 200) || 
                               (alpha < 128); // Transparent = wall in collision maps
                
                if (isTrack) {
                    trackPixels.push({ x, y });
                    trackPixelCount++;
                } else {
                    wallPixels.push({ x, y });
                }
            }
        }

        // Store analysis data
        this.analysisData.trackPixels = trackPixels;
        this.analysisData.wallPixels = wallPixels;
        
        // Calculate metrics
        validation.metrics.totalPixels = totalPixels;
        validation.metrics.trackPixels = trackPixelCount;
        validation.metrics.wallPixels = totalPixels - trackPixelCount;
        validation.metrics.trackCoverage = trackPixelCount / totalPixels;
        
        validation.analysis.structure = {
            trackPixelCount,
            wallPixelCount: totalPixels - trackPixelCount,
            coverage: validation.metrics.trackCoverage
        };

        console.log(`[TrackValidator] Analyzed ${totalPixels} pixels: ${trackPixelCount} track, ${totalPixels - trackPixelCount} walls`);
    }

    /**
     * Validate track connectivity using flood fill algorithm
     * @param {Object} validation - Validation result object
     * @param {Object} config - Configuration
     */
    async validateConnectivity(validation, config) {
        const trackPixels = this.analysisData.trackPixels;
        const width = config.trackWidth;
        const height = config.trackHeight;
        
        if (trackPixels.length === 0) {
            validation.errors.push({
                type: 'connectivity',
                severity: 'critical',
                message: 'No track pixels found - track appears to be entirely walls',
                details: 'The track must have white pixels indicating navigable areas'
            });
            return;
        }

        // Create grid for flood fill
        const trackGrid = new Array(height).fill(null).map(() => new Array(width).fill(false));
        
        // Mark track pixels in grid
        trackPixels.forEach(({ x, y }) => {
            trackGrid[y][x] = true;
        });

        // Find connected regions using flood fill
        const visited = new Array(height).fill(null).map(() => new Array(width).fill(false));
        const connectedRegions = [];
        
        for (let y = 0; y < height; y++) {
            for (let x = 0; x < width; x++) {
                if (trackGrid[y][x] && !visited[y][x]) {
                    const region = this.floodFill(trackGrid, visited, x, y, width, height);
                    if (region.length > 0) {
                        connectedRegions.push(region);
                    }
                }
            }
        }

        // Store analysis data
        this.analysisData.connectedRegions = connectedRegions;
        
        // Validate connectivity
        validation.metrics.connectedRegions = connectedRegions.length;
        validation.metrics.largestRegionSize = Math.max(...connectedRegions.map(r => r.length));
        validation.metrics.isolatedPixels = connectedRegions.filter(r => r.length < 10).length;

        if (connectedRegions.length === 0) {
            validation.errors.push({
                type: 'connectivity',
                severity: 'critical',
                message: 'No connected track regions found',
                details: 'Track pixels must form connected navigable areas'
            });
        } else if (connectedRegions.length > 1 && !config.allowIsolatedSections) {
            const mainRegionSize = validation.metrics.largestRegionSize;
            const totalTrackPixels = validation.metrics.trackPixels;
            const isolatedRatio = (totalTrackPixels - mainRegionSize) / totalTrackPixels;
            
            if (isolatedRatio > 0.05) { // More than 5% of track is isolated
                validation.errors.push({
                    type: 'connectivity',
                    severity: 'major',
                    message: `Track has ${connectedRegions.length} disconnected regions`,
                    details: `${(isolatedRatio * 100).toFixed(1)}% of track area is isolated from the main path`,
                    data: { regions: connectedRegions.length, isolatedRatio }
                });
            } else {
                validation.warnings.push({
                    type: 'connectivity',
                    message: `Track has ${connectedRegions.length} disconnected regions`,
                    details: 'Small isolated sections detected but within acceptable limits'
                });
            }
        }

        validation.analysis.connectivity = {
            totalRegions: connectedRegions.length,
            largestRegion: validation.metrics.largestRegionSize,
            isolatedSections: connectedRegions.length - 1,
            connectivity: connectedRegions.length === 1 ? 'fully_connected' : 'fragmented'
        };

        console.log(`[TrackValidator] Found ${connectedRegions.length} connected regions`);
    }

    /**
     * Flood fill algorithm for finding connected regions
     * @param {Array} grid - 2D boolean grid
     * @param {Array} visited - 2D visited grid
     * @param {number} x - Starting X coordinate
     * @param {number} y - Starting Y coordinate
     * @param {number} width - Grid width
     * @param {number} height - Grid height
     * @returns {Array} Connected pixels
     */
    floodFill(grid, visited, x, y, width, height) {
        const region = [];
        const stack = [{ x, y }];
        
        while (stack.length > 0) {
            const { x: cx, y: cy } = stack.pop();
            
            if (cx < 0 || cx >= width || cy < 0 || cy >= height || 
                visited[cy][cx] || !grid[cy][cx]) {
                continue;
            }
            
            visited[cy][cx] = true;
            region.push({ x: cx, y: cy });
            
            // Add adjacent pixels to stack
            stack.push(
                { x: cx + 1, y: cy },
                { x: cx - 1, y: cy },
                { x: cx, y: cy + 1 },
                { x: cx, y: cy - 1 }
            );
        }
        
        return region;
    }

    /**
     * Validate track width using distance transform algorithm
     * @param {Object} validation - Validation result object
     * @param {Object} config - Configuration
     */
    async validateTrackWidth(validation, config) {
        const trackPixels = this.analysisData.trackPixels;
        const width = config.trackWidth;
        const height = config.trackHeight;
        
        if (trackPixels.length === 0) return;

        // Create distance transform to find width at each point
        const distanceMap = this.calculateDistanceTransform(trackPixels, width, height);
        this.analysisData.widthMap = distanceMap;

        // Analyze width distribution
        const widths = [];
        const narrowPoints = [];
        const widePoints = [];
        
        trackPixels.forEach(({ x, y }) => {
            const distance = distanceMap[y][x];
            const actualWidth = distance * 2; // Diameter
            widths.push(actualWidth);
            
            if (actualWidth < config.minTrackWidth) {
                narrowPoints.push({ x, y, width: actualWidth });
            } else if (actualWidth > config.maxTrackWidth) {
                widePoints.push({ x, y, width: actualWidth });
            }
        });

        // Calculate statistics
        widths.sort((a, b) => a - b);
        const minWidth = widths[0] || 0;
        const maxWidth = widths[widths.length - 1] || 0;
        const avgWidth = widths.reduce((sum, w) => sum + w, 0) / widths.length;
        const medianWidth = widths[Math.floor(widths.length / 2)] || 0;

        validation.metrics.minTrackWidth = minWidth;
        validation.metrics.maxTrackWidth = maxWidth;
        validation.metrics.avgTrackWidth = avgWidth;
        validation.metrics.medianTrackWidth = medianWidth;
        validation.metrics.narrowPoints = narrowPoints.length;
        validation.metrics.widePoints = widePoints.length;

        // Validate width requirements
        if (minWidth < config.minTrackWidth) {
            validation.errors.push({
                type: 'width',
                severity: narrowPoints.length > trackPixels.length * 0.1 ? 'critical' : 'major',
                message: `Track too narrow: minimum width ${minWidth.toFixed(1)}px (required: ${config.minTrackWidth}px)`,
                details: `${narrowPoints.length} points narrower than ${config.minTrackWidth}px`,
                data: { minWidth, narrowPoints: narrowPoints.slice(0, 10) } // Limit data size
            });
        }

        if (maxWidth > config.maxTrackWidth) {
            validation.warnings.push({
                type: 'width',
                message: `Track very wide: maximum width ${maxWidth.toFixed(1)}px (recommended max: ${config.maxTrackWidth}px)`,
                details: `${widePoints.length} points wider than ${config.maxTrackWidth}px`,
                data: { maxWidth, widePoints: widePoints.slice(0, 10) }
            });
        }

        // Check for width consistency
        const widthVariance = this.calculateVariance(widths);
        if (widthVariance > avgWidth * 0.5) {
            validation.warnings.push({
                type: 'width',
                message: 'High width variation detected',
                details: 'Track width varies significantly, which may affect gameplay balance',
                data: { variance: widthVariance, avgWidth }
            });
        }

        validation.analysis.width = {
            min: minWidth,
            max: maxWidth,
            average: avgWidth,
            median: medianWidth,
            variance: widthVariance,
            narrowPointCount: narrowPoints.length,
            widePointCount: widePoints.length
        };

        // Store visual data for debugging
        validation.visualData.narrowPoints = narrowPoints;
        validation.visualData.widePoints = widePoints;

        console.log(`[TrackValidator] Width analysis: ${minWidth.toFixed(1)}-${maxWidth.toFixed(1)}px (avg: ${avgWidth.toFixed(1)}px)`);
    }

    /**
     * Calculate distance transform for track width analysis
     * @param {Array} trackPixels - Track pixel coordinates
     * @param {number} width - Image width
     * @param {number} height - Image height
     * @returns {Array} 2D distance map
     */
    calculateDistanceTransform(trackPixels, width, height) {
        // Initialize distance map with infinity
        const distanceMap = new Array(height).fill(null)
            .map(() => new Array(width).fill(Infinity));
        
        // Create track grid
        const trackGrid = new Array(height).fill(null)
            .map(() => new Array(width).fill(false));
        
        trackPixels.forEach(({ x, y }) => {
            trackGrid[y][x] = true;
        });

        // Initialize distance map - walls have distance 0
        for (let y = 0; y < height; y++) {
            for (let x = 0; x < width; x++) {
                if (!trackGrid[y][x]) {
                    distanceMap[y][x] = 0;
                }
            }
        }

        // Forward pass
        for (let y = 1; y < height; y++) {
            for (let x = 1; x < width; x++) {
                if (trackGrid[y][x]) {
                    distanceMap[y][x] = Math.min(
                        distanceMap[y][x],
                        distanceMap[y-1][x] + 1,
                        distanceMap[y][x-1] + 1,
                        distanceMap[y-1][x-1] + Math.sqrt(2)
                    );
                }
            }
        }

        // Backward pass
        for (let y = height - 2; y >= 0; y--) {
            for (let x = width - 2; x >= 0; x--) {
                if (trackGrid[y][x]) {
                    distanceMap[y][x] = Math.min(
                        distanceMap[y][x],
                        distanceMap[y+1][x] + 1,
                        distanceMap[y][x+1] + 1,
                        distanceMap[y+1][x+1] + Math.sqrt(2)
                    );
                }
            }
        }

        return distanceMap;
    }

    /**
     * Calculate variance of an array of numbers
     * @param {Array} values - Array of numbers
     * @returns {number} Variance
     */
    calculateVariance(values) {
        if (values.length === 0) return 0;
        const mean = values.reduce((sum, val) => sum + val, 0) / values.length;
        const squaredDiffs = values.map(val => Math.pow(val - mean, 2));
        return squaredDiffs.reduce((sum, diff) => sum + diff, 0) / values.length;
    }

    /**
     * Validate starting areas for players
     * @param {Object} validation - Validation result object
     * @param {Object} config - Configuration
     * @param {Array} startAreas - Defined start areas
     */
    async validateStartAreas(validation, config, startAreas = []) {
        const trackPixels = this.analysisData.trackPixels;
        
        if (!startAreas || startAreas.length === 0) {
            // Auto-detect potential start areas
            startAreas = this.detectPotentialStartAreas(trackPixels, config);
            validation.warnings.push({
                type: 'start_areas',
                message: 'No start areas defined - auto-detected potential locations',
                details: `Found ${startAreas.length} potential start locations`,
                data: { autoDetected: true, areas: startAreas }
            });
        }

        validation.metrics.startAreas = startAreas.length;
        const validStartAreas = [];
        const invalidStartAreas = [];

        // Validate each start area
        for (const area of startAreas) {
            const validation_result = this.validateStartArea(area, trackPixels, config);
            
            if (validation_result.isValid) {
                validStartAreas.push({ ...area, ...validation_result });
            } else {
                invalidStartAreas.push({ ...area, ...validation_result });
            }
        }

        validation.metrics.validStartAreas = validStartAreas.length;
        validation.metrics.invalidStartAreas = invalidStartAreas.length;

        // Check if we have enough valid start areas
        const requiredStartAreas = Math.ceil(config.maxPlayers / 2); // Allow some overlap
        
        if (validStartAreas.length === 0) {
            validation.errors.push({
                type: 'start_areas',
                severity: 'critical',
                message: 'No valid start areas found',
                details: 'Track must have at least one suitable starting location for players'
            });
        } else if (validStartAreas.length < requiredStartAreas) {
            validation.warnings.push({
                type: 'start_areas',
                message: `Limited start areas: ${validStartAreas.length} valid (recommended: ${requiredStartAreas})`,
                details: 'Additional start areas would improve player distribution'
            });
        }

        // Check start area distribution
        if (validStartAreas.length > 1) {
            const distribution = this.analyzeStartAreaDistribution(validStartAreas, config);
            if (distribution.minDistance < config.playerSpacing * 2) {
                validation.warnings.push({
                    type: 'start_areas',
                    message: 'Start areas too close together',
                    details: `Minimum distance: ${distribution.minDistance.toFixed(1)}px (recommended: ${config.playerSpacing * 2}px)`
                });
            }
        }

        validation.analysis.startAreas = {
            total: startAreas.length,
            valid: validStartAreas.length,
            invalid: invalidStartAreas.length,
            validAreas: validStartAreas,
            invalidAreas: invalidStartAreas
        };

        console.log(`[TrackValidator] Start areas: ${validStartAreas.length}/${startAreas.length} valid`);
    }

    /**
     * Detect potential starting areas automatically
     * @param {Array} trackPixels - Track pixel coordinates
     * @param {Object} config - Configuration
     * @returns {Array} Potential start areas
     */
    detectPotentialStartAreas(trackPixels, config) {
        if (trackPixels.length === 0) return [];

        const areas = [];
        const minRadius = config.minStartAreaRadius;
        const step = minRadius * 2; // Sample grid

        // Sample potential locations across the track
        for (let y = minRadius; y < config.trackHeight - minRadius; y += step) {
            for (let x = minRadius; x < config.trackWidth - minRadius; x += step) {
                // Check if this point is on the track
                const isOnTrack = trackPixels.some(p => 
                    Math.abs(p.x - x) < 10 && Math.abs(p.y - y) < 10);
                
                if (isOnTrack) {
                    // Count track pixels in radius
                    const pixelsInRadius = trackPixels.filter(p => {
                        const dist = Math.sqrt((p.x - x) ** 2 + (p.y - y) ** 2);
                        return dist <= minRadius;
                    }).length;

                    // If area has good coverage, consider it a potential start
                    const requiredPixels = Math.PI * minRadius * minRadius * 0.7; // 70% coverage
                    if (pixelsInRadius >= requiredPixels) {
                        areas.push({
                            x, y,
                            radius: minRadius,
                            coverage: pixelsInRadius / (Math.PI * minRadius * minRadius),
                            autoDetected: true
                        });
                    }
                }
            }
        }

        // Sort by coverage and return best candidates
        return areas
            .sort((a, b) => b.coverage - a.coverage)
            .slice(0, 8); // Max 8 potential start areas
    }

    /**
     * Validate a single start area
     * @param {Object} area - Start area definition
     * @param {Array} trackPixels - Track pixel coordinates
     * @param {Object} config - Configuration
     * @returns {Object} Validation result
     */
    validateStartArea(area, trackPixels, config) {
        const { x, y, radius = config.minStartAreaRadius } = area;
        const result = {
            isValid: false,
            errors: [],
            warnings: [],
            metrics: {}
        };

        // Check if center is on track
        const centerOnTrack = trackPixels.some(p => 
            Math.abs(p.x - x) <= 5 && Math.abs(p.y - y) <= 5);
        
        if (!centerOnTrack) {
            result.errors.push('Start area center is not on track');
        }

        // Count track pixels within radius
        const pixelsInRadius = trackPixels.filter(p => {
            const dist = Math.sqrt((p.x - x) ** 2 + (p.y - y) ** 2);
            return dist <= radius;
        });

        const coverage = pixelsInRadius.length / (Math.PI * radius * radius);
        result.metrics.coverage = coverage;
        result.metrics.pixelCount = pixelsInRadius.length;

        // Check coverage
        if (coverage < 0.6) {
            result.errors.push(`Insufficient track coverage: ${(coverage * 100).toFixed(1)}% (required: 60%)`);
        } else if (coverage < 0.8) {
            result.warnings.push(`Low track coverage: ${(coverage * 100).toFixed(1)}%`);
        }

        // Check radius
        if (radius < config.minStartAreaRadius) {
            result.errors.push(`Start area too small: ${radius}px (minimum: ${config.minStartAreaRadius}px)`);
        }

        // Check if area can accommodate multiple players
        const maxPlayersInArea = Math.floor(coverage * Math.PI * radius * radius / (config.playerSpacing ** 2));
        result.metrics.maxPlayers = maxPlayersInArea;

        if (maxPlayersInArea < 2) {
            result.warnings.push('Start area may only accommodate one player');
        }

        result.isValid = result.errors.length === 0;
        return result;
    }

    /**
     * Analyze distribution of start areas
     * @param {Array} startAreas - Valid start areas
     * @param {Object} config - Configuration
     * @returns {Object} Distribution analysis
     */
    analyzeStartAreaDistribution(startAreas, config) {
        const distances = [];
        
        for (let i = 0; i < startAreas.length; i++) {
            for (let j = i + 1; j < startAreas.length; j++) {
                const area1 = startAreas[i];
                const area2 = startAreas[j];
                const dist = Math.sqrt((area1.x - area2.x) ** 2 + (area1.y - area2.y) ** 2);
                distances.push(dist);
            }
        }

        return {
            minDistance: Math.min(...distances),
            maxDistance: Math.max(...distances),
            avgDistance: distances.reduce((sum, d) => sum + d, 0) / distances.length,
            distances
        };
    }

    /**
     * Validate token spawn areas
     * @param {Object} validation - Validation result object
     * @param {Object} config - Configuration
     * @param {Array} tokenAreas - Defined token areas
     */
    async validateTokenAreas(validation, config, tokenAreas = []) {
        const trackPixels = this.analysisData.trackPixels;
        
        if (!tokenAreas || tokenAreas.length === 0) {
            // Auto-detect potential token areas (far from start areas)
            const startAreas = validation.analysis.startAreas?.validAreas || [];
            tokenAreas = this.detectPotentialTokenAreas(trackPixels, startAreas, config);
            
            validation.warnings.push({
                type: 'token_areas',
                message: 'No token areas defined - auto-detected potential locations',
                details: `Found ${tokenAreas.length} potential token spawn locations`
            });
        }

        validation.metrics.tokenAreas = tokenAreas.length;
        const validTokenAreas = [];
        const invalidTokenAreas = [];

        // Validate each token area
        for (const area of tokenAreas) {
            const validation_result = this.validateTokenArea(area, trackPixels, config);
            
            if (validation_result.isValid) {
                validTokenAreas.push({ ...area, ...validation_result });
            } else {
                invalidTokenAreas.push({ ...area, ...validation_result });
            }
        }

        validation.metrics.validTokenAreas = validTokenAreas.length;
        validation.metrics.invalidTokenAreas = invalidTokenAreas.length;

        // Check if we have enough valid token areas
        if (validTokenAreas.length === 0) {
            validation.errors.push({
                type: 'token_areas',
                severity: 'critical',
                message: 'No valid token spawn areas found',
                details: 'Track must have suitable locations for token placement'
            });
        } else if (validTokenAreas.length < 3) {
            validation.warnings.push({
                type: 'token_areas',
                message: `Limited token areas: ${validTokenAreas.length} valid (recommended: 3+)`,
                details: 'More token areas provide better gameplay variety'
            });
        }

        validation.analysis.tokenAreas = {
            total: tokenAreas.length,
            valid: validTokenAreas.length,
            invalid: invalidTokenAreas.length,
            validAreas: validTokenAreas,
            invalidAreas: invalidTokenAreas
        };

        console.log(`[TrackValidator] Token areas: ${validTokenAreas.length}/${tokenAreas.length} valid`);
    }

    /**
     * Detect potential token spawn areas
     * @param {Array} trackPixels - Track pixel coordinates
     * @param {Array} startAreas - Start areas to avoid
     * @param {Object} config - Configuration
     * @returns {Array} Potential token areas
     */
    detectPotentialTokenAreas(trackPixels, startAreas, config) {
        if (trackPixels.length === 0) return [];

        const areas = [];
        const minRadius = config.minTokenAreaRadius;
        const step = minRadius * 3; // Larger step for token areas
        const avoidDistance = 500; // Stay away from start areas

        // Sample potential locations
        for (let y = minRadius; y < config.trackHeight - minRadius; y += step) {
            for (let x = minRadius; x < config.trackWidth - minRadius; x += step) {
                // Check if point is on track
                const isOnTrack = trackPixels.some(p => 
                    Math.abs(p.x - x) < 10 && Math.abs(p.y - y) < 10);
                
                if (!isOnTrack) continue;

                // Check distance from start areas
                const tooCloseToStart = startAreas.some(start => {
                    const dist = Math.sqrt((start.x - x) ** 2 + (start.y - y) ** 2);
                    return dist < avoidDistance;
                });

                if (tooCloseToStart) continue;

                // Count track pixels in radius
                const pixelsInRadius = trackPixels.filter(p => {
                    const dist = Math.sqrt((p.x - x) ** 2 + (p.y - y) ** 2);
                    return dist <= minRadius;
                }).length;

                const requiredPixels = Math.PI * minRadius * minRadius * 0.6; // 60% coverage
                if (pixelsInRadius >= requiredPixels) {
                    areas.push({
                        x, y,
                        radius: minRadius,
                        coverage: pixelsInRadius / (Math.PI * minRadius * minRadius),
                        autoDetected: true
                    });
                }
            }
        }

        // Sort by distance from center (prefer corners/edges for variety)
        const centerX = config.trackWidth / 2;
        const centerY = config.trackHeight / 2;
        
        return areas
            .map(area => ({
                ...area,
                distanceFromCenter: Math.sqrt((area.x - centerX) ** 2 + (area.y - centerY) ** 2)
            }))
            .sort((a, b) => b.distanceFromCenter - a.distanceFromCenter)
            .slice(0, 6); // Max 6 token areas
    }

    /**
     * Validate a single token area
     * @param {Object} area - Token area definition
     * @param {Array} trackPixels - Track pixel coordinates
     * @param {Object} config - Configuration
     * @returns {Object} Validation result
     */
    validateTokenArea(area, trackPixels, config) {
        const { x, y, radius = config.minTokenAreaRadius } = area;
        const result = {
            isValid: false,
            errors: [],
            warnings: [],
            metrics: {}
        };

        // Check if center is on track
        const centerOnTrack = trackPixels.some(p => 
            Math.abs(p.x - x) <= 5 && Math.abs(p.y - y) <= 5);
        
        if (!centerOnTrack) {
            result.errors.push('Token area center is not on track');
        }

        // Count track pixels within radius
        const pixelsInRadius = trackPixels.filter(p => {
            const dist = Math.sqrt((p.x - x) ** 2 + (p.y - y) ** 2);
            return dist <= radius;
        });

        const coverage = pixelsInRadius.length / (Math.PI * radius * radius);
        result.metrics.coverage = coverage;
        result.metrics.pixelCount = pixelsInRadius.length;

        // Check coverage
        if (coverage < 0.5) {
            result.errors.push(`Insufficient track coverage: ${(coverage * 100).toFixed(1)}% (required: 50%)`);
        }

        // Check radius
        if (radius < config.minTokenAreaRadius) {
            result.errors.push(`Token area too small: ${radius}px (minimum: ${config.minTokenAreaRadius}px)`);
        }

        result.isValid = result.errors.length === 0;
        return result;
    }

    /**
     * Validate track coverage percentage
     * @param {Object} validation - Validation result object
     * @param {Object} config - Configuration
     */
    async validateTrackCoverage(validation, config) {
        const coverage = validation.metrics.trackCoverage;

        if (coverage < config.minTrackCoverage) {
            validation.errors.push({
                type: 'coverage',
                severity: 'major',
                message: `Track coverage too low: ${(coverage * 100).toFixed(1)}% (minimum: ${(config.minTrackCoverage * 100).toFixed(1)}%)`,
                details: 'Increase track area or reduce wall sections',
                data: { coverage, required: config.minTrackCoverage }
            });
        } else if (coverage > config.maxTrackCoverage) {
            validation.warnings.push({
                type: 'coverage',
                message: `Track coverage very high: ${(coverage * 100).toFixed(1)}% (recommended max: ${(config.maxTrackCoverage * 100).toFixed(1)}%)`,
                details: 'High coverage may reduce gameplay challenge',
                data: { coverage, recommended: config.maxTrackCoverage }
            });
        }

        validation.analysis.coverage = {
            percentage: coverage,
            status: coverage < config.minTrackCoverage ? 'too_low' : 
                   coverage > config.maxTrackCoverage ? 'too_high' : 'optimal',
            trackPixels: validation.metrics.trackPixels,
            totalPixels: validation.metrics.totalPixels
        };

        console.log(`[TrackValidator] Coverage: ${(coverage * 100).toFixed(1)}%`);
    }

    /**
     * Validate path length and routing
     * @param {Object} validation - Validation result object
     * @param {Object} config - Configuration
     * @param {Array} routes - Predefined routes
     */
    async validatePathLength(validation, config, routes = []) {
        const connectedRegions = this.analysisData.connectedRegions;
        
        if (connectedRegions.length === 0) {
            validation.errors.push({
                type: 'path_length',
                severity: 'critical',
                message: 'Cannot calculate path length - no connected track regions'
            });
            return;
        }

        // Use the largest connected region for path analysis
        const mainRegion = connectedRegions.reduce((largest, region) => 
            region.length > largest.length ? region : largest, connectedRegions[0]);

        // Calculate approximate path network
        const pathNetwork = this.buildPathNetwork(mainRegion);
        this.analysisData.pathNetwork = pathNetwork;

        // Estimate path lengths
        const pathLengths = this.calculatePathLengths(pathNetwork, validation.analysis.startAreas?.validAreas, validation.analysis.tokenAreas?.validAreas);
        
        validation.metrics.shortestPath = pathLengths.shortest;
        validation.metrics.longestPath = pathLengths.longest;
        validation.metrics.averagePath = pathLengths.average;
        validation.metrics.pathVariance = pathLengths.variance;

        // Validate path length requirements
        if (pathLengths.shortest < config.minPathLength) {
            validation.errors.push({
                type: 'path_length',
                severity: 'major',
                message: `Shortest path too short: ${pathLengths.shortest.toFixed(0)}px (minimum: ${config.minPathLength}px)`,
                details: 'Track may be too easy or direct',
                data: { shortest: pathLengths.shortest, required: config.minPathLength }
            });
        }

        if (pathLengths.longest > config.maxPathLength) {
            validation.warnings.push({
                type: 'path_length',
                message: `Longest path very long: ${pathLengths.longest.toFixed(0)}px (recommended max: ${config.maxPathLength}px)`,
                details: 'Very long paths may lead to extended race times',
                data: { longest: pathLengths.longest, recommended: config.maxPathLength }
            });
        }

        // Check path diversity
        if (pathLengths.variance < pathLengths.average * 0.1) {
            validation.warnings.push({
                type: 'path_length',
                message: 'Low path diversity detected',
                details: 'All paths are similar length - consider adding variety',
                data: { variance: pathLengths.variance, average: pathLengths.average }
            });
        }

        validation.analysis.pathLength = {
            shortest: pathLengths.shortest,
            longest: pathLengths.longest,
            average: pathLengths.average,
            variance: pathLengths.variance,
            diversity: pathLengths.variance / pathLengths.average,
            networkSize: pathNetwork.nodes.length
        };

        console.log(`[TrackValidator] Path lengths: ${pathLengths.shortest.toFixed(0)}-${pathLengths.longest.toFixed(0)}px (avg: ${pathLengths.average.toFixed(0)}px)`);
    }

    /**
     * Build path network from track pixels
     * @param {Array} trackPixels - Connected track pixels
     * @returns {Object} Path network with nodes and edges
     */
    buildPathNetwork(trackPixels) {
        // Simplified path network - sample points across the track
        const nodes = [];
        const edges = [];
        const step = 50; // Sample every 50 pixels

        // Create nodes by sampling track pixels
        for (const pixel of trackPixels) {
            if (pixel.x % step === 0 && pixel.y % step === 0) {
                nodes.push({ id: nodes.length, x: pixel.x, y: pixel.y });
            }
        }

        // Connect nearby nodes
        const maxConnectionDistance = step * 1.5;
        for (let i = 0; i < nodes.length; i++) {
            for (let j = i + 1; j < nodes.length; j++) {
                const node1 = nodes[i];
                const node2 = nodes[j];
                const dist = Math.sqrt((node1.x - node2.x) ** 2 + (node1.y - node2.y) ** 2);
                
                if (dist <= maxConnectionDistance) {
                    edges.push({ from: i, to: j, weight: dist });
                }
            }
        }

        return { nodes, edges };
    }

    /**
     * Calculate path lengths in the network
     * @param {Object} pathNetwork - Path network
     * @param {Array} startAreas - Start areas
     * @param {Array} tokenAreas - Token areas
     * @returns {Object} Path length statistics
     */
    calculatePathLengths(pathNetwork, startAreas = [], tokenAreas = []) {
        const lengths = [];
        
        // If no specific areas defined, use sample points
        if (startAreas.length === 0 || tokenAreas.length === 0) {
            // Sample random pairs of nodes
            for (let i = 0; i < Math.min(100, pathNetwork.nodes.length); i++) {
                const start = Math.floor(Math.random() * pathNetwork.nodes.length);
                const end = Math.floor(Math.random() * pathNetwork.nodes.length);
                if (start !== end) {
                    const length = this.estimatePathLength(pathNetwork, start, end);
                    if (length > 0) lengths.push(length);
                }
            }
        } else {
            // Calculate paths between start and token areas
            for (const startArea of startAreas) {
                for (const tokenArea of tokenAreas) {
                    const startNode = this.findNearestNode(pathNetwork, startArea.x, startArea.y);
                    const endNode = this.findNearestNode(pathNetwork, tokenArea.x, tokenArea.y);
                    
                    if (startNode !== -1 && endNode !== -1) {
                        const length = this.estimatePathLength(pathNetwork, startNode, endNode);
                        if (length > 0) lengths.push(length);
                    }
                }
            }
        }

        if (lengths.length === 0) {
            return { shortest: 0, longest: 0, average: 0, variance: 0 };
        }

        lengths.sort((a, b) => a - b);
        const shortest = lengths[0];
        const longest = lengths[lengths.length - 1];
        const average = lengths.reduce((sum, len) => sum + len, 0) / lengths.length;
        const variance = this.calculateVariance(lengths);

        return { shortest, longest, average, variance };
    }

    /**
     * Find nearest network node to coordinates
     * @param {Object} pathNetwork - Path network
     * @param {number} x - X coordinate
     * @param {number} y - Y coordinate
     * @returns {number} Node index or -1 if not found
     */
    findNearestNode(pathNetwork, x, y) {
        let nearest = -1;
        let minDistance = Infinity;

        for (let i = 0; i < pathNetwork.nodes.length; i++) {
            const node = pathNetwork.nodes[i];
            const dist = Math.sqrt((node.x - x) ** 2 + (node.y - y) ** 2);
            if (dist < minDistance) {
                minDistance = dist;
                nearest = i;
            }
        }

        return nearest;
    }

    /**
     * Estimate path length between two nodes (simplified)
     * @param {Object} pathNetwork - Path network
     * @param {number} startNode - Start node index
     * @param {number} endNode - End node index
     * @returns {number} Estimated path length
     */
    estimatePathLength(pathNetwork, startNode, endNode) {
        // Simplified: return Euclidean distance * complexity factor
        const start = pathNetwork.nodes[startNode];
        const end = pathNetwork.nodes[endNode];
        
        if (!start || !end) return 0;
        
        const euclideanDistance = Math.sqrt((end.x - start.x) ** 2 + (end.y - start.y) ** 2);
        
        // Apply complexity factor based on network density
        const networkDensity = pathNetwork.edges.length / (pathNetwork.nodes.length * (pathNetwork.nodes.length - 1) / 2);
        const complexityFactor = 1 + (1 - networkDensity) * 0.5; // More complex = longer paths
        
        return euclideanDistance * complexityFactor;
    }

    /**
     * Validate performance impact
     * @param {Object} validation - Validation result object
     * @param {Object} config - Configuration
     */
    async validatePerformance(validation, config) {
        const trackPixels = validation.metrics.trackPixels;
        const wallPixels = validation.metrics.wallPixels;
        
        // Calculate complexity score
        let complexityScore = 0;
        
        // Pixel count contributes to complexity
        complexityScore += (trackPixels + wallPixels) / 10000; // Normalize by 10k pixels
        
        // Connected regions add complexity
        complexityScore += validation.metrics.connectedRegions * 10;
        
        // Width variation adds complexity
        if (validation.metrics.avgTrackWidth && validation.analysis.width?.variance) {
            const widthComplexity = validation.analysis.width.variance / validation.metrics.avgTrackWidth;
            complexityScore += widthComplexity * 100;
        }
        
        // Path network complexity
        if (this.analysisData.pathNetwork) {
            const networkComplexity = this.analysisData.pathNetwork.edges.length / 100;
            complexityScore += networkComplexity;
        }

        validation.metrics.complexityScore = complexityScore;
        validation.performance.complexity = complexityScore;

        // Validate against limits
        if (complexityScore > config.maxComplexityScore) {
            validation.warnings.push({
                type: 'performance',
                message: `High complexity score: ${complexityScore.toFixed(1)} (max recommended: ${config.maxComplexityScore})`,
                details: 'Complex tracks may impact game performance on slower devices',
                data: { complexity: complexityScore, limit: config.maxComplexityScore }
            });
        }

        // Estimate render objects
        const estimatedRenderObjects = Math.ceil(complexityScore / 2);
        validation.metrics.estimatedRenderObjects = estimatedRenderObjects;

        if (estimatedRenderObjects > config.maxRenderObjects) {
            validation.warnings.push({
                type: 'performance',
                message: `High render object count: ~${estimatedRenderObjects} (max: ${config.maxRenderObjects})`,
                details: 'May cause rendering performance issues'
            });
        }

        validation.analysis.performance = {
            complexityScore,
            estimatedRenderObjects,
            performanceRating: complexityScore < config.maxComplexityScore * 0.5 ? 'excellent' :
                             complexityScore < config.maxComplexityScore * 0.8 ? 'good' :
                             complexityScore < config.maxComplexityScore ? 'acceptable' : 'poor'
        };

        console.log(`[TrackValidator] Performance: complexity ${complexityScore.toFixed(1)}, ~${estimatedRenderObjects} render objects`);
    }

    /**
     * Analyze gameplay balance and fairness
     * @param {Object} validation - Validation result object
     * @param {Object} config - Configuration
     */
    async analyzeGameplayBalance(validation, config) {
        const analysis = {
            fairness: 'unknown',
            difficulty: 'unknown',
            variety: 'unknown',
            balance: 'unknown'
        };

        // Analyze fairness based on start area distribution
        if (validation.analysis.startAreas?.validAreas?.length > 1) {
            const startDistribution = this.analyzeStartAreaDistribution(validation.analysis.startAreas.validAreas, config);
            const fairnessScore = Math.min(startDistribution.minDistance / (config.playerSpacing * 2), 1);
            analysis.fairness = fairnessScore > 0.8 ? 'excellent' : fairnessScore > 0.6 ? 'good' : 'poor';
            analysis.fairnessScore = fairnessScore;
        }

        // Analyze difficulty based on track properties
        let difficultyFactors = 0;
        if (validation.metrics.avgTrackWidth < config.minTrackWidth * 1.5) difficultyFactors += 1; // Narrow tracks
        if (validation.metrics.connectedRegions > 1) difficultyFactors += 1; // Multiple regions
        if (validation.analysis.width?.variance > validation.metrics.avgTrackWidth * 0.3) difficultyFactors += 1; // Width variation
        if (validation.metrics.shortestPath > config.minPathLength * 2) difficultyFactors += 1; // Long paths

        analysis.difficulty = difficultyFactors === 0 ? 'very_easy' :
                             difficultyFactors === 1 ? 'easy' :
                             difficultyFactors === 2 ? 'medium' :
                             difficultyFactors === 3 ? 'hard' : 'very_hard';
        analysis.difficultyScore = difficultyFactors / 4;

        // Analyze variety based on path diversity and areas
        let varietyScore = 0;
        if (validation.analysis.pathLength?.diversity > 0.2) varietyScore += 0.3; // Path diversity
        if (validation.metrics.validTokenAreas > 2) varietyScore += 0.3; // Multiple token areas
        if (validation.analysis.width?.variance > 0) varietyScore += 0.2; // Width variety
        if (validation.metrics.connectedRegions === 1) varietyScore += 0.2; // Connected but complex

        analysis.variety = varietyScore > 0.8 ? 'excellent' : varietyScore > 0.6 ? 'good' : varietyScore > 0.4 ? 'moderate' : 'low';
        analysis.varietyScore = varietyScore;

        // Overall balance score
        const balanceScore = (
            (analysis.fairnessScore || 0.5) * 0.4 +
            (1 - Math.abs(analysis.difficultyScore - 0.5) * 2) * 0.3 + // Prefer medium difficulty
            analysis.varietyScore * 0.3
        );

        analysis.balance = balanceScore > 0.8 ? 'excellent' : balanceScore > 0.6 ? 'good' : balanceScore > 0.4 ? 'fair' : 'poor';
        analysis.balanceScore = balanceScore;

        validation.analysis.gameplay = analysis;

        // Add recommendations based on balance
        if (analysis.fairness === 'poor') {
            validation.suggestions.push({
                type: 'gameplay',
                priority: 'high',
                message: 'Improve start area distribution',
                details: 'Spread start areas more evenly to ensure fair player positioning'
            });
        }

        if (analysis.variety === 'low') {
            validation.suggestions.push({
                type: 'gameplay',
                priority: 'medium',
                message: 'Add more gameplay variety',
                details: 'Consider adding more token spawn areas or varying track width'
            });
        }

        console.log(`[TrackValidator] Gameplay balance: ${analysis.balance} (${(balanceScore * 100).toFixed(0)}%)`);
    }

    /**
     * Generate suggestions for track improvements
     * @param {Object} validation - Validation result object
     * @param {Object} config - Configuration
     */
    generateSuggestions(validation, config) {
        const suggestions = validation.suggestions || [];

        // Suggestions based on errors
        validation.errors.forEach(error => {
            switch (error.type) {
                case 'width':
                    suggestions.push({
                        type: 'improvement',
                        priority: 'high',
                        message: 'Widen narrow track sections',
                        details: `Use a larger brush size or the rectangle tool to expand areas narrower than ${config.minTrackWidth}px`,
                        action: 'expand_narrow_areas'
                    });
                    break;
                case 'connectivity':
                    suggestions.push({
                        type: 'improvement',
                        priority: 'critical',
                        message: 'Connect isolated track sections',
                        details: 'Use the brush or line tool to create bridges between disconnected areas',
                        action: 'connect_regions'
                    });
                    break;
                case 'coverage':
                    if (validation.metrics.trackCoverage < config.minTrackCoverage) {
                        suggestions.push({
                            type: 'improvement',
                            priority: 'high',
                            message: 'Increase track coverage',
                            details: 'Add more track area or reduce wall sections to meet minimum coverage requirements',
                            action: 'increase_coverage'
                        });
                    }
                    break;
            }
        });

        // Suggestions based on warnings
        validation.warnings.forEach(warning => {
            switch (warning.type) {
                case 'start_areas':
                    suggestions.push({
                        type: 'optimization',
                        priority: 'medium',
                        message: 'Add more starting positions',
                        details: 'Create additional wide areas near the track start for better player distribution',
                        action: 'add_start_areas'
                    });
                    break;
                case 'token_areas':
                    suggestions.push({
                        type: 'optimization',
                        priority: 'medium',
                        message: 'Add more token spawn locations',
                        details: 'Create wider areas at different track locations for token placement variety',
                        action: 'add_token_areas'
                    });
                    break;
            }
        });

        // General improvement suggestions
        if (validation.metrics.connectedRegions === 1 && validation.analysis.gameplay?.variety === 'low') {
            suggestions.push({
                type: 'enhancement',
                priority: 'low',
                message: 'Consider adding alternative paths',
                details: 'Create branches or shortcuts to increase strategic options',
                action: 'add_branches'
            });
        }

        if (validation.analysis.performance?.performanceRating === 'poor') {
            suggestions.push({
                type: 'optimization',
                priority: 'medium',
                message: 'Simplify track design for better performance',
                details: 'Reduce complexity by creating smoother curves and fewer small sections',
                action: 'simplify_design'
            });
        }

        validation.suggestions = suggestions;
    }

    /**
     * Get validation preset configuration
     * @param {string} presetName - Preset name
     * @returns {Object} Preset configuration
     */
    getPreset(presetName) {
        return this.presets[presetName] || this.presets.custom;
    }

    /**
     * Get available preset names
     * @returns {Array} Preset names
     */
    getPresetNames() {
        return Object.keys(this.presets);
    }

    /**
     * Update validation configuration
     * @param {Object} newConfig - New configuration
     */
    updateConfig(newConfig) {
        this.config = { ...this.config, ...newConfig };
        this.clearCache(); // Clear cache when config changes
        console.log('[TrackValidator] Configuration updated');
    }

    /**
     * Clear validation cache
     */
    clearCache() {
        this.validationCache.clear();
        console.log('[TrackValidator] Validation cache cleared');
    }

    /**
     * Get validation statistics
     * @returns {Object} Statistics
     */
    getStats() {
        return {
            cacheSize: this.validationCache.size,
            lastValidation: this.lastValidation?.timestamp,
            isValidating: this.isValidating,
            totalValidations: this.validationCache.size,
            presets: Object.keys(this.presets),
            config: this.config
        };
    }

    /**
     * Generate visual data for problem areas
     * @param {Object} validation - Validation result
     * @returns {Object} Visual data for rendering
     */
    generateVisualFeedback(validation) {
        const visualData = {
            problemAreas: [],
            suggestions: [],
            overlays: []
        };

        // Mark narrow areas
        if (validation.visualData?.narrowPoints) {
            visualData.problemAreas.push({
                type: 'narrow',
                points: validation.visualData.narrowPoints,
                color: '#ff6b6b',
                message: 'Track too narrow'
            });
        }

        // Mark wide areas
        if (validation.visualData?.widePoints) {
            visualData.problemAreas.push({
                type: 'wide',
                points: validation.visualData.widePoints,
                color: '#ffd93d',
                message: 'Track very wide'
            });
        }

        // Mark invalid start areas
        if (validation.analysis.startAreas?.invalidAreas) {
            validation.analysis.startAreas.invalidAreas.forEach(area => {
                visualData.problemAreas.push({
                    type: 'invalid_start',
                    x: area.x,
                    y: area.y,
                    radius: area.radius || this.config.minStartAreaRadius,
                    color: '#ff4757',
                    message: 'Invalid start area'
                });
            });
        }

        // Mark invalid token areas
        if (validation.analysis.tokenAreas?.invalidAreas) {
            validation.analysis.tokenAreas.invalidAreas.forEach(area => {
                visualData.problemAreas.push({
                    type: 'invalid_token',
                    x: area.x,
                    y: area.y,
                    radius: area.radius || this.config.minTokenAreaRadius,
                    color: '#ff6348',
                    message: 'Invalid token area'
                });
            });
        }

        // Mark valid areas for reference
        if (validation.analysis.startAreas?.validAreas) {
            validation.analysis.startAreas.validAreas.forEach(area => {
                visualData.overlays.push({
                    type: 'valid_start',
                    x: area.x,
                    y: area.y,
                    radius: area.radius || this.config.minStartAreaRadius,
                    color: '#2ed573',
                    message: 'Valid start area'
                });
            });
        }

        if (validation.analysis.tokenAreas?.validAreas) {
            validation.analysis.tokenAreas.validAreas.forEach(area => {
                visualData.overlays.push({
                    type: 'valid_token',
                    x: area.x,
                    y: area.y,
                    radius: area.radius || this.config.minTokenAreaRadius,
                    color: '#1e90ff',
                    message: 'Valid token area'
                });
            });
        }

        return visualData;
    }

    /**
     * Create validation report for export
     * @param {Object} validation - Validation result
     * @returns {Object} Formatted report
     */
    createValidationReport(validation) {
        const report = {
            summary: {
                isValid: validation.isValid,
                errors: validation.errors.length,
                warnings: validation.warnings.length,
                suggestions: validation.suggestions.length,
                overallScore: this.calculateOverallScore(validation),
                validationTime: validation.performance.validationTime
            },
            metrics: validation.metrics,
            analysis: validation.analysis,
            issues: {
                errors: validation.errors,
                warnings: validation.warnings
            },
            improvements: validation.suggestions,
            timestamp: validation.timestamp,
            validator: {
                version: '1.0.0',
                config: this.config
            }
        };

        return report;
    }

    /**
     * Calculate overall validation score
     * @param {Object} validation - Validation result
     * @returns {number} Score from 0-100
     */
    calculateOverallScore(validation) {
        let score = 100;

        // Deduct for errors
        validation.errors.forEach(error => {
            switch (error.severity) {
                case 'critical':
                    score -= 30;
                    break;
                case 'major':
                    score -= 20;
                    break;
                case 'minor':
                    score -= 10;
                    break;
                default:
                    score -= 15;
            }
        });

        // Deduct for warnings
        score -= validation.warnings.length * 5;

        // Bonus for good gameplay balance
        if (validation.analysis.gameplay?.balanceScore) {
            score += validation.analysis.gameplay.balanceScore * 10;
        }

        return Math.max(0, Math.min(100, score));
    }

    /**
     * Destroy the validator and cleanup resources
     */
    destroy() {
        this.clearCache();
        this.analysisData = {
            pixelData: null,
            trackPixels: [],
            wallPixels: [],
            connectedRegions: [],
            pathNetwork: null,
            widthMap: null,
            complexityMetrics: {}
        };
        this.lastValidation = null;
        this.isValidating = false;
        
        console.log('[TrackValidator] Track validator destroyed');
    }
}

export default TrackValidator;