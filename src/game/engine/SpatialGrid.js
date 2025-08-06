/**
 * SpatialGrid.js - Spatial Partitioning System for Collision Optimization
 * 
 * Implements a spatial grid to optimize collision detection from O(n²) to O(n).
 * This reduces the collision detection complexity for the Memex Racing game
 * by only checking objects within the same or adjacent grid cells.
 */

/**
 * Spatial Grid for efficient collision detection
 * Divides the game world into a grid to reduce collision checks
 */
export class SpatialGrid {
    constructor(worldWidth, worldHeight, cellSize = 64) {
        this.worldWidth = worldWidth;
        this.worldHeight = worldHeight;
        this.cellSize = cellSize;
        
        // Calculate grid dimensions
        this.gridWidth = Math.ceil(worldWidth / cellSize);
        this.gridHeight = Math.ceil(worldHeight / cellSize);
        
        // Grid to hold objects in each cell
        this.grid = [];
        this.initializeGrid();
        
        // Cache for nearby cells to avoid recalculation
        this.nearbyCache = new Map();
        
        console.log(`[SpatialGrid] Initialized ${this.gridWidth}x${this.gridHeight} grid with ${cellSize}px cells`);
    }
    
    /**
     * Initialize empty grid
     */
    initializeGrid() {
        this.grid = [];
        for (let i = 0; i < this.gridWidth * this.gridHeight; i++) {
            this.grid[i] = [];
        }
    }
    
    /**
     * Clear all objects from grid
     * Call this at the start of each frame before repopulating
     */
    clear() {
        for (let i = 0; i < this.grid.length; i++) {
            this.grid[i].length = 0; // Clear array efficiently
        }
    }
    
    /**
     * Get grid cell index for world coordinates
     */
    getCellIndex(x, y) {
        const gridX = Math.floor(x / this.cellSize);
        const gridY = Math.floor(y / this.cellSize);
        
        // Clamp to grid bounds
        const clampedX = Math.max(0, Math.min(gridX, this.gridWidth - 1));
        const clampedY = Math.max(0, Math.min(gridY, this.gridHeight - 1));
        
        return clampedY * this.gridWidth + clampedX;
    }
    
    /**
     * Insert object into appropriate grid cell
     */
    insert(object, x, y, radius = 0) {
        // If object has radius, it might span multiple cells
        if (radius > 0) {
            this.insertWithRadius(object, x, y, radius);
        } else {
            const cellIndex = this.getCellIndex(x, y);
            this.grid[cellIndex].push(object);
        }
    }
    
    /**
     * Insert object that spans multiple cells due to radius
     */
    insertWithRadius(object, x, y, radius) {
        const minX = Math.floor((x - radius) / this.cellSize);
        const maxX = Math.floor((x + radius) / this.cellSize);
        const minY = Math.floor((y - radius) / this.cellSize);
        const maxY = Math.floor((y + radius) / this.cellSize);
        
        for (let gridY = Math.max(0, minY); gridY <= Math.min(this.gridHeight - 1, maxY); gridY++) {
            for (let gridX = Math.max(0, minX); gridX <= Math.min(this.gridWidth - 1, maxX); gridX++) {
                const cellIndex = gridY * this.gridWidth + gridX;
                this.grid[cellIndex].push(object);
            }
        }
    }
    
    /**
     * Get all nearby objects for collision checking
     * Returns objects in the same cell and adjacent cells
     */
    getNearbyObjects(x, y, radius = 0) {
        const nearbyObjects = [];
        const cellsToCheck = this.getNearbyCells(x, y, radius);
        
        for (const cellIndex of cellsToCheck) {
            if (cellIndex >= 0 && cellIndex < this.grid.length) {
                nearbyObjects.push(...this.grid[cellIndex]);
            }
        }
        
        return nearbyObjects;
    }
    
    /**
     * Get indices of nearby cells to check
     * Uses caching to avoid recalculation for the same position
     */
    getNearbyCells(x, y, radius = 0) {
        const cacheKey = `${Math.floor(x / this.cellSize)},${Math.floor(y / this.cellSize)},${Math.floor(radius / this.cellSize)}`;
        
        if (this.nearbyCache.has(cacheKey)) {
            return this.nearbyCache.get(cacheKey);
        }
        
        const cells = [];
        const cellRadius = Math.ceil(radius / this.cellSize);
        const centerX = Math.floor(x / this.cellSize);
        const centerY = Math.floor(y / this.cellSize);
        
        // Check 3x3 grid around the center cell (or larger if radius requires it)
        const checkRadius = Math.max(1, cellRadius);
        
        for (let dy = -checkRadius; dy <= checkRadius; dy++) {
            for (let dx = -checkRadius; dx <= checkRadius; dx++) {
                const gridX = centerX + dx;
                const gridY = centerY + dy;
                
                if (gridX >= 0 && gridX < this.gridWidth && gridY >= 0 && gridY < this.gridHeight) {
                    cells.push(gridY * this.gridWidth + gridX);
                }
            }
        }
        
        // Cache result for future use
        this.nearbyCache.set(cacheKey, cells);
        
        return cells;
    }
    
    /**
     * Get all objects within a specific rectangular area
     */
    getObjectsInArea(minX, minY, maxX, maxY) {
        const objects = [];
        const minCellX = Math.floor(minX / this.cellSize);
        const maxCellX = Math.floor(maxX / this.cellSize);
        const minCellY = Math.floor(minY / this.cellSize);
        const maxCellY = Math.floor(maxY / this.cellSize);
        
        for (let gridY = Math.max(0, minCellY); gridY <= Math.min(this.gridHeight - 1, maxCellY); gridY++) {
            for (let gridX = Math.max(0, minCellX); gridX <= Math.min(this.gridWidth - 1, maxCellX); gridX++) {
                const cellIndex = gridY * this.gridWidth + gridX;
                objects.push(...this.grid[cellIndex]);
            }
        }
        
        return objects;
    }
    
    /**
     * Debug: Get grid statistics
     */
    getStats() {
        const stats = {
            totalCells: this.grid.length,
            occupiedCells: 0,
            totalObjects: 0,
            maxObjectsPerCell: 0,
            averageObjectsPerCell: 0
        };
        
        for (const cell of this.grid) {
            if (cell.length > 0) {
                stats.occupiedCells++;
                stats.totalObjects += cell.length;
                stats.maxObjectsPerCell = Math.max(stats.maxObjectsPerCell, cell.length);
            }
        }
        
        stats.averageObjectsPerCell = stats.totalObjects / Math.max(stats.occupiedCells, 1);
        
        return stats;
    }
    
    /**
     * Debug: Visualize grid (for development purposes)
     */
    debugDraw(graphics) {
        if (!graphics) return;
        
        graphics.clear();
        graphics.lineStyle(1, 0x444444, 0.3);
        
        // Draw grid lines
        for (let x = 0; x <= this.worldWidth; x += this.cellSize) {
            graphics.moveTo(x, 0);
            graphics.lineTo(x, this.worldHeight);
        }
        
        for (let y = 0; y <= this.worldHeight; y += this.cellSize) {
            graphics.moveTo(0, y);
            graphics.lineTo(this.worldWidth, y);
        }
        
        // Highlight occupied cells
        graphics.fillStyle(0xff0000, 0.1);
        for (let y = 0; y < this.gridHeight; y++) {
            for (let x = 0; x < this.gridWidth; x++) {
                const cellIndex = y * this.gridWidth + x;
                if (this.grid[cellIndex].length > 0) {
                    graphics.fillRect(
                        x * this.cellSize, 
                        y * this.cellSize, 
                        this.cellSize, 
                        this.cellSize
                    );
                }
            }
        }
    }
    
    /**
     * Update grid size if world dimensions change
     */
    resize(newWidth, newHeight) {
        if (newWidth !== this.worldWidth || newHeight !== this.worldHeight) {
            this.worldWidth = newWidth;
            this.worldHeight = newHeight;
            this.gridWidth = Math.ceil(newWidth / this.cellSize);
            this.gridHeight = Math.ceil(newHeight / this.cellSize);
            
            this.initializeGrid();
            this.nearbyCache.clear();
            
            console.log(`[SpatialGrid] Resized to ${this.gridWidth}x${this.gridHeight} grid`);
        }
    }
    
    /**
     * Clear the nearby cache when needed
     */
    clearCache() {
        this.nearbyCache.clear();
    }
}