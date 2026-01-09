/**
 * Generate placeholder icons for the Word add-in
 * Run with: node scripts/generate-icons.js
 */

const fs = require('fs');
const path = require('path');

// Simple SVG template for a legal/AI icon (scales symbol)
const createSvgIcon = (size) => `<?xml version="1.0" encoding="UTF-8"?>
<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" xmlns="http://www.w3.org/2000/svg">
  <rect width="${size}" height="${size}" rx="${size * 0.15}" fill="#0078D4"/>
  <text x="50%" y="55%" dominant-baseline="middle" text-anchor="middle"
        font-family="Segoe UI, sans-serif" font-weight="bold"
        font-size="${size * 0.5}px" fill="white">AI</text>
</svg>`;

// Create public/assets directory
const assetsDir = path.join(__dirname, '..', 'public', 'assets');
if (!fs.existsSync(assetsDir)) {
  fs.mkdirSync(assetsDir, { recursive: true });
}

// Generate icons in different sizes
const sizes = [16, 32, 64, 80, 128];
sizes.forEach((size) => {
  const svg = createSvgIcon(size);
  // Write as SVG (can be served directly)
  fs.writeFileSync(path.join(assetsDir, `icon-${size}.svg`), svg);
  console.log(`Created icon-${size}.svg`);
});

// Also create PNG versions using base64 encoding of a simple colored square
// (Word requires PNGs, but SVGs work for some cases)
console.log('\nNote: For production, convert SVGs to PNGs using:');
console.log('  npx svgexport public/assets/icon-32.svg public/assets/icon-32.png 32:32');
console.log('\nFor dev, you can also use the SVG files directly.');
