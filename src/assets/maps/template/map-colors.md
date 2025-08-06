# Memex Racing Map Color Reference Guide

## Visual Color Reference

This document provides a visual reference for the color coding system used in Memex Racing maps. Each color has a specific meaning that affects gameplay.

## Core Colors

### 🟦 Track Areas - Black (#000000)
```
████████████████████████
████████████████████████
████████████████████████
```
- **Purpose**: Valid movement areas where players can race
- **Behavior**: No collision, free movement
- **Design Tips**: Make tracks at least 128 pixels wide

### ⬜ Walls/Boundaries - White (#FFFFFF)
```
████████████████████████
████████████████████████
████████████████████████
```
- **Purpose**: Solid barriers that block player movement
- **Behavior**: Full collision, players bounce off
- **Design Tips**: Use for track edges and obstacles

### 🌫️ Decorative Elements - Gray (#808080)
```
████████████████████████
████████████████████████
████████████████████████
```
- **Purpose**: Visual elements with no gameplay impact
- **Behavior**: No collision, purely aesthetic
- **Design Tips**: Use for track markings, scenery

## Color Usage Examples

### Simple Track Section
```
⬜⬜⬜⬜⬜⬜⬜⬜⬜⬜⬜⬜
⬜⬛⬛⬛⬛⬛⬛⬛⬛⬛⬛⬜
⬜⬛⬛⬛⬛⬛⬛⬛⬛⬛⬛⬜
⬜⬛⬛⬛⬛⬛⬛⬛⬛⬛⬛⬜
⬜⬜⬜⬜⬜⬜⬜⬜⬜⬜⬜⬜
```

## Advanced Color Techniques

### Gradient Transitions
While not required, you can use color gradients for visual appeal:
- Track edges can fade from black to gray
- Decorative elements can use multiple gray shades
- Keep core gameplay colors pure for proper detection

### Testing Your Colors
1. Use exact hex codes - avoid similar shades
2. Test in different image editors to ensure consistency
3. Verify colors aren't altered by compression

## Color Picker Values

For easy copying in image editors:

| Color | RGB Values | HSL Values |
|-------|------------|------------|
| Black | R:0 G:0 B:0 | H:0° S:0% L:0% |
| White | R:255 G:255 B:255 | H:0° S:0% L:100% |
| Gray | R:128 G:128 B:128 | H:0° S:0% L:50% |

## Common Mistakes to Avoid

1. **Anti-aliasing**: Disable when drawing to avoid color bleeding
2. **Compression**: Use PNG format to preserve exact colors
3. **Transparency**: Avoid using transparent pixels in gameplay areas
4. **Similar Colors**: Don't use colors close to the defined values
5. **JPEG Format**: Never save as JPEG - it alters colors

## Quick Reference Card

Save this for quick access while creating maps:

```
Track:     #FFFFFF ⬜
Wall:      #000000 ⬛
Decor:     #808080 🌫️
```