/**
 * Create simple PNG icons from base64 templates
 * These are minimal blue squares with "AI" text placeholder
 */

const fs = require('fs');
const path = require('path');

// Pre-generated base64 PNG icons (simple blue squares)
// These were generated as minimal valid PNGs
const icons = {
  // 16x16 blue square
  16: 'iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAAOUlEQVQ4T2NkYGD4z0ABYKSqAQz/////z0BuAH5nGNUA8gIYhrkBYPcMXQOGvgEMo0FAJmYOdQMAjWsKEZzOhD4AAAAASUVORK5CYII=',
  // 32x32 blue square
  32: 'iVBORw0KGgoAAAANSUhEUgAAACAAAAAgCAYAAABzenr0AAAAQUlEQVRYR+3WMQoAIAwD0Or9D+2ii4OLoKJQ+gfJEJKWQPonf/Y/IZb2xLq0EjMBw+GAbwADGMAABjCAAQxoHPACuhQQEWZvFckAAAAASUVORK5CYII=',
  // 64x64 blue square
  64: 'iVBORw0KGgoAAAANSUhEUgAAAEAAAABACAYAAACqaXHeAAAAU0lEQVR4Xu3QMQEAAAjDsJVcNPqHLwQNWPz2zAQIECBAgAABAgQIECBAgAABAgQIECBAgAABAgQIECBAgAABAgQIECBAgAABAgQIECBA4C5wAGq+AQGTOPy4AAAAAElFTkSuQmCC',
  // 80x80 blue square
  80: 'iVBORw0KGgoAAAANSUhEUgAAAFAAAABQCAYAAACOEfKtAAAAWklEQVR4Xu3QMQEAAAjDMOZfNHgBC0MHdGbvBAQIECBAgAABAgQIECBAgAABAgQIECBAgAABAgQIECBAgAABAgQIECBAgAABAgQIECBAgAABAgQIEPgXOACUTQEBKpCCaAAAAABJRU5ErkJggg==',
  // 128x128 blue square
  128: 'iVBORw0KGgoAAAANSUhEUgAAAIAAAACACAYAAADDPmHLAAAAaklEQVR4Xu3QMQEAAAjDMOZfNHgBC0MHJHbPBAgQIECAAAECBAgQIECAAAECBAgQIECAAAECBAgQIECAAAECBAgQIECAAAECBAgQIECAAAECBAgQIECAAAECBAgQIECAAAECBAgQ+C5wAJudAQGLqAmUAAAAAElFTkSuQmCC',
};

const assetsDir = path.join(__dirname, '..', 'public', 'assets');

// Ensure directory exists
if (!fs.existsSync(assetsDir)) {
  fs.mkdirSync(assetsDir, { recursive: true });
}

// Write PNG files
Object.entries(icons).forEach(([size, base64]) => {
  const buffer = Buffer.from(base64, 'base64');
  const filename = `icon-${size}.png`;
  fs.writeFileSync(path.join(assetsDir, filename), buffer);
  console.log(`Created ${filename}`);
});

console.log('\nIcons created in public/assets/');
