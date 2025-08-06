# Memex Racing Game - Specialized Agents

This directory contains specialized AI agents designed to assist with various aspects of the Memex Racing game development. Each agent has specific expertise aligned with the project's unique requirements.

## Agent Organization

Agents are organized by domain to make it easy to find the right specialist for your task:

### 🎮 Game Development Domain (`/game-development`)
- **game-engine-developer** - Phaser.js 3.x specialist for pixel-perfect rendering and 60 FPS performance
- **randomization-specialist** - Advanced randomization architect using Mersenne Twister and chaos theory
- **multiplayer-backend-specialist** - Socket.io expert for real-time 6-player racing with sub-50ms latency

### 🎨 UI/UX and Frontend Domain (`/ui-frontend`)
- **pixel-ui-designer** - Retro pixel art UI specialist for betting interfaces and HUD
- **asset-integration-specialist** - Sprite management expert for 64x64/128x128 validation

### ✅ Quality Assurance Domain (`/quality-assurance`)
- **game-performance-tester** - Performance validation for 60 FPS and multiplayer load testing
- **randomness-validator** - Statistical analysis expert for movement patterns and game balance

### 🚀 Infrastructure Domain (`/infrastructure`)
- **game-deployment-engineer** - Node.js deployment specialist for scaling multiplayer infrastructure
- **security-auditor** - Anti-cheat and betting system security expert

### 📊 Data and Analytics Domain (`/data-analytics`)
- **betting-algorithm-specialist** - Mathematical models for odds calculation and leaderboards
- **game-analytics-specialist** - Player behavior analysis and game balance optimization

### 🔍 Specialized Testing Domain (`/specialized-testing`)
- **browser-checker** - Cross-browser compatibility for pixel-perfect rendering
- **visual-regression-tester** - Automated screenshot comparison for pixel accuracy
- **system-architect-reviewer** - Overall architecture coordination and validation

## How to Use These Agents

Each agent has a JSON configuration file with:
- **name**: The agent's identifier
- **role**: Brief description of the agent's specialization
- **whenToUse**: Specific scenarios where this agent should be engaged
- **systemPrompt**: Detailed instructions for the agent's behavior and expertise

### Example Usage

When you need help with a specific aspect of the game:

1. Identify the domain of your task
2. Review the agents in that domain
3. Choose the agent whose **whenToUse** scenarios match your needs
4. Use the agent's **systemPrompt** to guide interactions

### Key Project Requirements

All agents are configured to support:
- **Sprite Dimensions**: 64x64 and 128x128 pixel art
- **Performance**: 60 FPS rendering, sub-50ms multiplayer latency
- **Player Capacity**: Up to 6 simultaneous players per race
- **Tech Stack**: Phaser.js 3.x, Socket.io, Express.js, Mersenne Twister
- **Visual Style**: Retro 8-bit/16-bit pixel art aesthetic

## Agent Coordination

For complex features requiring multiple specialists:
- Use **system-architect-reviewer** to coordinate cross-domain work
- Agents are designed to work together harmoniously
- Each maintains their domain expertise while supporting overall project goals

## Updates and Maintenance

- Agent configurations reflect current project requirements
- Sprite dimensions updated to 64x64/128x128 throughout
- All agents aligned with CLAUDE.md specifications