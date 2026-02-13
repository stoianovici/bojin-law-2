/**
 * Flipboard Layout Variants
 *
 * 6 layout patterns for 3-tile pages, using CSS Grid.
 * Each layout assigns tiles to grid areas with different sizes.
 *
 * Variant 0 (Hero Top):
 * ┌───────────────────┐
 * │    1 (large)      │
 * │                   │
 * ├─────────┬─────────┤
 * │    2    │    3    │
 * └─────────┴─────────┘
 *
 * Variant 1 (Hero Bottom):
 * ┌─────────┬─────────┐
 * │    1    │    2    │
 * ├─────────┴─────────┤
 * │    3 (large)      │
 * │                   │
 * └───────────────────┘
 *
 * Variant 2 (Hero Left):
 * ┌─────────┬─────────┐
 * │         │    2    │
 * │    1    ├─────────┤
 * │         │    3    │
 * └─────────┴─────────┘
 *
 * Variant 3 (Hero Right):
 * ┌─────────┬─────────┐
 * │    1    │         │
 * ├─────────┤    2    │
 * │    3    │         │
 * └─────────┴─────────┘
 *
 * Variant 4 (Equal Top + Wide Bottom):
 * ┌─────────┬─────────┐
 * │    1    │    2    │
 * ├─────────┴─────────┤
 * │         3         │
 * └───────────────────┘
 *
 * Variant 5 (Thirds - Horizontal):
 * ┌───────────────────┐
 * │         1         │
 * ├───────────────────┤
 * │         2         │
 * ├───────────────────┤
 * │         3         │
 * └───────────────────┘
 */

export type TileSize = 'large' | 'medium' | 'small';

export interface TilePosition {
  gridArea: string;
  size: TileSize;
}

export interface LayoutVariant {
  id: number;
  gridTemplate: string;
  tiles: TilePosition[];
}

// Define the 6 layout variants
export const LAYOUT_VARIANTS: LayoutVariant[] = [
  // Variant 0: Hero Top
  {
    id: 0,
    gridTemplate: `
      "tile1 tile1" 1fr
      "tile2 tile3" 1fr
      / 1fr 1fr
    `,
    tiles: [
      { gridArea: 'tile1', size: 'large' },
      { gridArea: 'tile2', size: 'medium' },
      { gridArea: 'tile3', size: 'medium' },
    ],
  },
  // Variant 1: Hero Bottom
  {
    id: 1,
    gridTemplate: `
      "tile1 tile2" 1fr
      "tile3 tile3" 1fr
      / 1fr 1fr
    `,
    tiles: [
      { gridArea: 'tile1', size: 'medium' },
      { gridArea: 'tile2', size: 'medium' },
      { gridArea: 'tile3', size: 'large' },
    ],
  },
  // Variant 2: Hero Left
  {
    id: 2,
    gridTemplate: `
      "tile1 tile2" 1fr
      "tile1 tile3" 1fr
      / 1fr 1fr
    `,
    tiles: [
      { gridArea: 'tile1', size: 'large' },
      { gridArea: 'tile2', size: 'small' },
      { gridArea: 'tile3', size: 'small' },
    ],
  },
  // Variant 3: Hero Right
  {
    id: 3,
    gridTemplate: `
      "tile1 tile2" 1fr
      "tile3 tile2" 1fr
      / 1fr 1fr
    `,
    tiles: [
      { gridArea: 'tile1', size: 'small' },
      { gridArea: 'tile2', size: 'large' },
      { gridArea: 'tile3', size: 'small' },
    ],
  },
  // Variant 4: Equal Top + Wide Bottom
  {
    id: 4,
    gridTemplate: `
      "tile1 tile2" 1fr
      "tile3 tile3" 0.8fr
      / 1fr 1fr
    `,
    tiles: [
      { gridArea: 'tile1', size: 'medium' },
      { gridArea: 'tile2', size: 'medium' },
      { gridArea: 'tile3', size: 'medium' },
    ],
  },
  // Variant 5: Thirds (Horizontal)
  {
    id: 5,
    gridTemplate: `
      "tile1" 1fr
      "tile2" 1fr
      "tile3" 1fr
      / 1fr
    `,
    tiles: [
      { gridArea: 'tile1', size: 'medium' },
      { gridArea: 'tile2', size: 'medium' },
      { gridArea: 'tile3', size: 'medium' },
    ],
  },
];

/**
 * Get layout variant by index, with fallback
 */
export function getLayoutVariant(index: number): LayoutVariant {
  return LAYOUT_VARIANTS[index % LAYOUT_VARIANTS.length];
}

/**
 * Get next layout variant that's different from the previous
 */
export function getNextLayoutVariant(pageIndex: number, previousVariant?: number): LayoutVariant {
  let variant = pageIndex % LAYOUT_VARIANTS.length;

  // Avoid consecutive same layouts
  if (previousVariant !== undefined && variant === previousVariant) {
    variant = (variant + 1) % LAYOUT_VARIANTS.length;
  }

  return LAYOUT_VARIANTS[variant];
}

/**
 * CSS classes for tile sizes
 */
export const TILE_SIZE_CLASSES: Record<TileSize, string> = {
  large: 'min-h-[200px]',
  medium: 'min-h-[140px]',
  small: 'min-h-[100px]',
};
