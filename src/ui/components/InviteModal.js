/**
 * InviteModal.js - Friend Invitation Modal Component
 * 
 * Displays room code prominently, copy link functionality, QR code generation,
 * and social media sharing buttons for inviting friends to the racing game.
 */

export class InviteModal {
    constructor(uiManager) {
        this.uiManager = uiManager;
        this.isVisible = false;
        this.roomCode = null;
        this.shareUrl = null;
        this.qrCodeCanvas = null;
        
        console.log('[InviteModal] Invite modal initialized');
    }

    /**
     * Initialize the invite modal
     */
    async initialize() {
        this.createModalContent();
        this.setupEventListeners();
        console.log('[InviteModal] Modal initialized');
    }

    /**
     * Create modal content structure
     */
    createModalContent() {
        const modal = document.getElementById('invite-modal');
        if (!modal) return;

        modal.innerHTML = `
            <div class="modal-content invite-content">
                <div class="modal-header">
                    <h2>INVITE FRIENDS</h2>
                    <button class="close-btn" id="invite-close-btn">&times;</button>
                </div>
                
                <div class="modal-body">
                    <div class="room-code-section">
                        <h3>ROOM CODE</h3>
                        <div class="room-code-display">
                            <span id="room-code-text">WAITING...</span>
                            <button id="copy-code-btn" class="copy-btn" title="Copy Room Code">
                                <span class="copy-icon">📋</span>
                                COPY
                            </button>
                        </div>
                    </div>
                    
                    <div class="share-link-section">
                        <h3>SHARE LINK</h3>
                        <div class="share-link-display">
                            <input type="text" id="share-link-input" readonly placeholder="Generating link...">
                            <button id="copy-link-btn" class="copy-btn" title="Copy Share Link">
                                <span class="copy-icon">🔗</span>
                                COPY LINK
                            </button>
                        </div>
                    </div>
                    
                    <div class="qr-code-section">
                        <h3>QR CODE</h3>
                        <div class="qr-code-container">
                            <canvas id="qr-code-canvas" width="200" height="200"></canvas>
                            <div class="qr-code-placeholder" id="qr-placeholder">
                                <div class="loading-spinner"></div>
                                <p>Generating QR Code...</p>
                            </div>
                        </div>
                    </div>
                    
                    <div class="social-share-section">
                        <h3>SHARE ON SOCIAL</h3>
                        <div class="social-buttons">
                            <button class="social-btn twitter-btn" id="share-twitter">
                                <span class="social-icon">🐦</span>
                                TWITTER
                            </button>
                            <button class="social-btn discord-btn" id="share-discord">
                                <span class="social-icon">🎮</span>
                                DISCORD
                            </button>
                            <button class="social-btn whatsapp-btn" id="share-whatsapp">
                                <span class="social-icon">💬</span>
                                WHATSAPP
                            </button>
                            <button class="social-btn email-btn" id="share-email">
                                <span class="social-icon">📧</span>
                                EMAIL
                            </button>
                        </div>
                    </div>
                    
                    <div class="quick-actions">
                        <button class="action-btn" id="refresh-room-btn">
                            <span class="action-icon">🔄</span>
                            REFRESH
                        </button>
                        <button class="action-btn" id="start-game-btn" disabled>
                            <span class="action-icon">▶️</span>
                            START GAME
                        </button>
                    </div>
                </div>
            </div>
        `;
    }

    /**
     * Setup event listeners for modal interactions
     */
    setupEventListeners() {
        // Close button
        const closeBtn = document.getElementById('invite-close-btn');
        if (closeBtn) {
            closeBtn.addEventListener('click', () => this.hide());
        }

        // Copy room code button
        const copyCodeBtn = document.getElementById('copy-code-btn');
        if (copyCodeBtn) {
            copyCodeBtn.addEventListener('click', () => this.copyRoomCode());
        }

        // Copy share link button
        const copyLinkBtn = document.getElementById('copy-link-btn');
        if (copyLinkBtn) {
            copyLinkBtn.addEventListener('click', () => this.copyShareLink());
        }

        // Social share buttons
        document.getElementById('share-twitter')?.addEventListener('click', () => this.shareOnTwitter());
        document.getElementById('share-discord')?.addEventListener('click', () => this.shareOnDiscord());
        document.getElementById('share-whatsapp')?.addEventListener('click', () => this.shareOnWhatsApp());
        document.getElementById('share-email')?.addEventListener('click', () => this.shareViaEmail());

        // Quick action buttons
        document.getElementById('refresh-room-btn')?.addEventListener('click', () => this.refreshRoom());
        document.getElementById('start-game-btn')?.addEventListener('click', () => this.startGame());

        // Close modal when clicking outside
        const modal = document.getElementById('invite-modal');
        if (modal) {
            modal.addEventListener('click', (event) => {
                if (event.target === modal) {
                    this.hide();
                }
            });
        }

        // Escape key handler
        document.addEventListener('keydown', (event) => {
            if (event.key === 'Escape' && this.isVisible) {
                this.hide();
            }
        });
    }

    /**
     * Show the invite modal
     */
    show(roomCode = null) {
        const modal = document.getElementById('invite-modal');
        if (!modal) return;

        if (roomCode) {
            this.updateRoomCode(roomCode);
        }

        modal.classList.remove('hidden');
        this.isVisible = true;
        
        // Focus on the modal for accessibility
        modal.focus();
        
        console.log('[InviteModal] Modal shown');
    }

    /**
     * Hide the invite modal
     */
    hide() {
        const modal = document.getElementById('invite-modal');
        if (!modal) return;

        modal.classList.add('hidden');
        this.isVisible = false;
        
        console.log('[InviteModal] Modal hidden');
    }

    /**
     * Toggle modal visibility
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
        return document.getElementById('invite-modal');
    }

    /**
     * Update room code and generate share links
     */
    updateRoomCode(roomCode) {
        this.roomCode = roomCode;
        
        // Update room code display
        const roomCodeText = document.getElementById('room-code-text');
        if (roomCodeText) {
            roomCodeText.textContent = roomCode;
        }

        // Generate share URL
        this.generateShareUrl();
        
        // Generate QR code
        this.generateQRCode();
        
        // Enable start game button if we have players
        this.updateStartGameButton();
        
        console.log('[InviteModal] Room code updated:', roomCode);
    }

    /**
     * Generate share URL for the room
     */
    generateShareUrl() {
        if (!this.roomCode) return;
        
        const baseUrl = window.location.origin + window.location.pathname;
        this.shareUrl = `${baseUrl}?room=${this.roomCode}`;
        
        // Update share link input
        const shareLinkInput = document.getElementById('share-link-input');
        if (shareLinkInput) {
            shareLinkInput.value = this.shareUrl;
        }
    }

    /**
     * Generate QR code for the share URL
     */
    generateQRCode() {
        if (!this.shareUrl) return;
        
        const canvas = document.getElementById('qr-code-canvas');
        const placeholder = document.getElementById('qr-placeholder');
        
        if (!canvas) return;
        
        // Simple QR code generation (in a real app, you'd use a QR code library)
        // For now, we'll create a placeholder pattern
        this.createQRCodePlaceholder(canvas);
        
        // Hide placeholder, show canvas
        if (placeholder) placeholder.style.display = 'none';
        canvas.style.display = 'block';
    }

    /**
     * Create a simple QR code placeholder pattern
     * In production, use a proper QR code library like qrcode.js
     */
    createQRCodePlaceholder(canvas) {
        const ctx = canvas.getContext('2d');
        const size = 200;
        const moduleSize = 10;
        const modules = size / moduleSize;
        
        // Clear canvas
        ctx.clearRect(0, 0, size, size);
        
        // Create a pattern that looks like a QR code
        ctx.fillStyle = '#000000';
        
        // Generate a pseudo-random pattern based on room code
        const seed = this.roomCode ? this.hashCode(this.roomCode) : 12345;
        
        for (let y = 0; y < modules; y++) {
            for (let x = 0; x < modules; x++) {
                // Create deterministic "random" pattern
                const hash = (seed + x * 31 + y * 97) % 1000;
                if (hash % 3 === 0) { // Fill roughly 1/3 of squares
                    ctx.fillRect(x * moduleSize, y * moduleSize, moduleSize, moduleSize);
                }
            }
        }
        
        // Add corner markers to make it look more like a QR code
        this.drawCornerMarker(ctx, 0, 0, moduleSize);
        this.drawCornerMarker(ctx, size - 7 * moduleSize, 0, moduleSize);
        this.drawCornerMarker(ctx, 0, size - 7 * moduleSize, moduleSize);
    }

    /**
     * Draw QR code corner marker
     */
    drawCornerMarker(ctx, x, y, moduleSize) {
        ctx.fillStyle = '#000000';
        // Outer square (7x7)
        ctx.fillRect(x, y, 7 * moduleSize, 7 * moduleSize);
        // Inner white square (5x5)
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(x + moduleSize, y + moduleSize, 5 * moduleSize, 5 * moduleSize);
        // Center black square (3x3)
        ctx.fillStyle = '#000000';
        ctx.fillRect(x + 2 * moduleSize, y + 2 * moduleSize, 3 * moduleSize, 3 * moduleSize);
    }

    /**
     * Simple hash function for generating deterministic patterns
     */
    hashCode(str) {
        let hash = 0;
        for (let i = 0; i < str.length; i++) {
            const char = str.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash; // Convert to 32-bit integer
        }
        return Math.abs(hash);
    }

    /**
     * Copy room code to clipboard
     */
    async copyRoomCode() {
        if (!this.roomCode) {
            this.showCopyFeedback('copy-code-btn', 'No room code available', false);
            return;
        }

        try {
            await navigator.clipboard.writeText(this.roomCode);
            this.showCopyFeedback('copy-code-btn', 'Room code copied!', true);
        } catch (error) {
            console.error('Failed to copy room code:', error);
            this.showCopyFeedback('copy-code-btn', 'Copy failed', false);
        }
    }

    /**
     * Copy share link to clipboard
     */
    async copyShareLink() {
        if (!this.shareUrl) {
            this.showCopyFeedback('copy-link-btn', 'No share link available', false);
            return;
        }

        try {
            await navigator.clipboard.writeText(this.shareUrl);
            this.showCopyFeedback('copy-link-btn', 'Link copied!', true);
        } catch (error) {
            console.error('Failed to copy share link:', error);
            this.showCopyFeedback('copy-link-btn', 'Copy failed', false);
        }
    }

    /**
     * Show copy feedback animation
     */
    showCopyFeedback(buttonId, message, success) {
        const button = document.getElementById(buttonId);
        if (!button) return;

        const originalText = button.innerHTML;
        button.innerHTML = `<span class="copy-icon">${success ? '✓' : '✗'}</span>${message}`;
        button.classList.add(success ? 'copy-success' : 'copy-error');

        setTimeout(() => {
            button.innerHTML = originalText;
            button.classList.remove('copy-success', 'copy-error');
        }, 2000);
    }

    /**
     * Share on Twitter
     */
    shareOnTwitter() {
        if (!this.shareUrl) return;
        
        const text = `Join my Memex Racing game! Room code: ${this.roomCode}`;
        const twitterUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(this.shareUrl)}`;
        
        window.open(twitterUrl, '_blank', 'width=600,height=400');
    }

    /**
     * Share on Discord (copy to clipboard with formatting)
     */
    async shareOnDiscord() {
        if (!this.shareUrl) return;
        
        const discordMessage = `🏎️ **Memex Racing Game!** 🏎️\n\n` +
                              `Join my racing room with code: \`${this.roomCode}\`\n` +
                              `Or click here: ${this.shareUrl}\n\n` +
                              `Let's race! 🏁`;
        
        try {
            await navigator.clipboard.writeText(discordMessage);
            this.showNotification('Discord message copied to clipboard!', 'success');
        } catch (error) {
            console.error('Failed to copy Discord message:', error);
            this.showNotification('Failed to copy Discord message', 'error');
        }
    }

    /**
     * Share on WhatsApp
     */
    shareOnWhatsApp() {
        if (!this.shareUrl) return;
        
        const message = `🏎️ Join my Memex Racing game!\n\nRoom code: ${this.roomCode}\nLink: ${this.shareUrl}`;
        const whatsappUrl = `https://wa.me/?text=${encodeURIComponent(message)}`;
        
        window.open(whatsappUrl, '_blank');
    }

    /**
     * Share via email
     */
    shareViaEmail() {
        if (!this.shareUrl) return;
        
        const subject = 'Join my Memex Racing game!';
        const body = `Hey!\n\nI'm playing Memex Racing and wanted to invite you to join my game.\n\n` +
                    `Room Code: ${this.roomCode}\n` +
                    `Direct Link: ${this.shareUrl}\n\n` +
                    `It's a fun multiplayer racing game where you can bet on AI races!\n\n` +
                    `See you on the track! 🏁`;
        
        const mailtoUrl = `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
        window.location.href = mailtoUrl;
    }

    /**
     * Refresh room (regenerate room code)
     */
    refreshRoom() {
        // This would typically call the multiplayer system to create a new room
        console.log('[InviteModal] Refreshing room...');
        this.showNotification('Refreshing room...', 'info');
        
        // Simulate room refresh (in real implementation, this would call multiplayer API)
        setTimeout(() => {
            const newRoomCode = this.generateRoomCode();
            this.updateRoomCode(newRoomCode);
            this.showNotification('Room refreshed!', 'success');
        }, 1000);
    }

    /**
     * Start the game
     */
    startGame() {
        if (!this.roomCode) return;
        
        console.log('[InviteModal] Starting game...');
        this.showNotification('Starting game...', 'info');
        
        // This would call the multiplayer system to start the game
        // For now, just close the modal
        this.hide();
    }

    /**
     * Update start game button state
     */
    updateStartGameButton() {
        const startBtn = document.getElementById('start-game-btn');
        if (!startBtn) return;
        
        const playerCount = this.uiManager.gameData.players.length;
        const canStart = playerCount >= 2; // Minimum 2 players to start
        
        startBtn.disabled = !canStart;
        startBtn.title = canStart ? 'Start the game' : `Need at least 2 players (${playerCount}/6)`;
        
        if (canStart) {
            startBtn.classList.add('enabled');
        } else {
            startBtn.classList.remove('enabled');
        }
    }

    /**
     * Generate a random room code
     */
    generateRoomCode() {
        const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // Excluding confusing characters
        let result = 'RACE-';
        for (let i = 0; i < 4; i++) {
            result += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        return result;
    }

    /**
     * Show notification message
     */
    showNotification(message, type = 'info') {
        // Create or update notification element
        let notification = document.getElementById('invite-notification');
        if (!notification) {
            notification = document.createElement('div');
            notification.id = 'invite-notification';
            notification.className = 'notification';
            document.getElementById('invite-modal').appendChild(notification);
        }
        
        notification.textContent = message;
        notification.className = `notification ${type} show`;
        
        // Auto-hide after 3 seconds
        setTimeout(() => {
            notification.classList.remove('show');
        }, 3000);
    }

    /**
     * Destroy the invite modal
     */
    destroy() {
        // Clean up any intervals or event listeners if needed
        console.log('[InviteModal] Modal destroyed');
    }
}