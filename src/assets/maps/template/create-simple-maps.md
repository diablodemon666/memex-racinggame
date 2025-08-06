# Creating Simple Example Maps Without Node Canvas

Since the canvas package requires additional dependencies, here are instructions to create the example maps using simple tools:

## Option 1: Using Online Tools

### Recommended Online Image Editors:
1. **Pixlr** (https://pixlr.com/) - Free online image editor
2. **Photopea** (https://www.photopea.com/) - Browser-based, supports PNG
3. **GIMP Online** (https://www.offidocs.com/gimp-online.html)

### Steps:
1. Create new image: 4000x2000 pixels
2. Set background to white (#FFFFFF)
3. Use paintbrush/rectangle tool with black (#000000) for tracks
4. Add colored rectangles for special areas
5. Export as PNG

## Option 2: Using Built-in macOS Tools

### Using Preview App:
1. Open Preview
2. File → New from Clipboard (set size to 4000x2000 first)
3. Tools → Annotate → Rectangle
4. Draw your map layout
5. Save as PNG

## Option 3: Simple Python Script

If you have Python installed, you can use PIL/Pillow:

```python
from PIL import Image, ImageDraw

# Create classic maze map
def create_classic_maze():
    # Create white background
    img = Image.new('RGB', (4000, 2000), 'white')
    draw = ImageDraw.Draw(img)
    
    # Draw main track area (black)
    draw.rectangle([100, 100, 3900, 1900], fill='black')
    
    # Add maze walls (white)
    # Horizontal walls
    for i in range(5):
        y = 400 + (i * 300)
        draw.rectangle([100, y, 1900, y + 100], fill='white')
        draw.rectangle([2300, y, 3900, y + 100], fill='white')
    
    # Vertical walls
    for i in range(8):
        x = 400 + (i * 400)
        draw.rectangle([x, 100, x + 100, 900], fill='white')
        draw.rectangle([x, 1200, x + 100, 1900], fill='white')
    
    # No fixed start/token areas or booster zones - all spawning is random
    
    img.save('classic-maze.png')
    print('Created classic-maze.png')

# Create speed circuit map
def create_speed_circuit():
    # Create white background
    img = Image.new('RGB', (4000, 2000), 'white')
    draw = ImageDraw.Draw(img)
    
    # Draw oval track (simplified rectangular version)
    # Outer track
    draw.rectangle([200, 200, 3800, 500], fill='black')      # Top straight
    draw.rectangle([200, 1500, 3800, 1800], fill='black')    # Bottom straight
    draw.rectangle([200, 200, 600, 1800], fill='black')      # Left side
    draw.rectangle([3400, 200, 3800, 1800], fill='black')    # Right side
    
    # Connect corners
    draw.rectangle([200, 200, 1000, 800], fill='black')      # Top-left
    draw.rectangle([3000, 200, 3800, 800], fill='black')     # Top-right
    draw.rectangle([200, 1200, 1000, 1800], fill='black')    # Bottom-left
    draw.rectangle([3000, 1200, 3800, 1800], fill='black')   # Bottom-right
    
    # Inner barrier
    draw.rectangle([1000, 600, 3000, 1400], fill='white')
    
    # No fixed start/token areas or booster zones - all spawning is random
    
    img.save('speed-circuit.png')
    print('Created speed-circuit.png')

# Run the scripts
if __name__ == '__main__':
    create_classic_maze()
    create_speed_circuit()
```

### To use the Python script:
1. Install Pillow: `pip install Pillow`
2. Save the script as `create_maps.py`
3. Run: `python create_maps.py`

## Manual Creation Tips

When creating maps manually:

1. **Use Grid/Guides**: Set up a grid to ensure consistent track widths
2. **Test Scale**: 128 pixels minimum track width = about 3.2% of total width
3. **Color Picker**: Use exact hex values from map-colors.md
4. **No Anti-aliasing**: Turn off smoothing/anti-aliasing for crisp pixels
5. **Save Settings**: PNG-24 or PNG-32, no compression

## Quick Color Reference
- Track: #000000 (Pure Black)
- Wall: #FFFFFF (Pure White)
- Decor: #808080 (Gray)