/**
 * Returns a hex color string based on the soil pH value.
 * @param pH Soil pH (1:1 water)
 * @returns Hex color string
 */
export function getPhColor(pH: number): string {
  // Color gradient: acidic (red) → neutral (yellow) → alkaline (blue)
  if (pH < 5) return '#d73027';  // very acidic: red
  if (pH < 6) return '#fc8d59';  // acidic: orange
  if (pH < 7) return '#fee090';  // slightly acidic: yellow
  if (pH < 8) return '#91bfdb';  // slightly alkaline: blue
  return '#4575b4'; // alkaline: dark blue
}

/**
 * Clamps a pH value to a specific visual range for rendering.
 * @param pH Soil pH
 * @param min Minimum pH for scale
 * @param max Maximum pH for scale
 * @returns Clamped pH value
 */
export function clampPh(pH: number, min: number = 4, max: number = 8): number {
  return Math.max(min, Math.min(max, pH));
}
