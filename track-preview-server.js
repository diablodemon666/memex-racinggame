/**
 * Simple HTTP server for track preview
 * Run with: node track-preview-server.js
 * Then open: http://localhost:8080
 */

const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = 8080;

const mimeTypes = {
    '.html': 'text/html',
    '.js': 'text/javascript',
    '.css': 'text/css',
    '.json': 'application/json',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.gif': 'image/gif',
    '.svg': 'image/svg+xml'
};

const server = http.createServer((req, res) => {
    console.log(`Request: ${req.url}`);
    
    // Default to track-preview.html
    let filePath = req.url === '/' ? '/track-preview.html' : req.url;
    filePath = path.join(__dirname, filePath);
    
    // Security check - prevent directory traversal
    if (!filePath.startsWith(__dirname)) {
        res.writeHead(403);
        res.end('Forbidden');
        return;
    }
    
    fs.readFile(filePath, (err, content) => {
        if (err) {
            if (err.code === 'ENOENT') {
                res.writeHead(404);
                res.end('File not found');
            } else {
                res.writeHead(500);
                res.end('Server error');
            }
            return;
        }
        
        // Get file extension and set content type
        const ext = path.extname(filePath).toLowerCase();
        const contentType = mimeTypes[ext] || 'application/octet-stream';
        
        res.writeHead(200, { 
            'Content-Type': contentType,
            'Access-Control-Allow-Origin': '*' // Allow CORS
        });
        res.end(content);
    });
});

server.listen(PORT, () => {
    console.log(`
🏁 Memex Racing Track Preview Server 🏁
=======================================
Server running at: http://localhost:${PORT}
Press Ctrl+C to stop

Preview page will open automatically...
    `);
    
    // Try to open browser automatically
    const { exec } = require('child_process');
    const url = `http://localhost:${PORT}`;
    
    switch (process.platform) {
        case 'darwin': // macOS
            exec(`open ${url}`);
            break;
        case 'win32': // Windows
            exec(`start ${url}`);
            break;
        default: // Linux and others
            exec(`xdg-open ${url}`);
    }
});

// Handle graceful shutdown
process.on('SIGTERM', () => {
    server.close(() => {
        console.log('Server stopped');
    });
});