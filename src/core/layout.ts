/**
 * Utility to stack labels vertically with a minimum spacing constraint.
 * Uses a greedy top-to-bottom placement algorithm.
 * 
 * @param yPositions Original Y positions of labels
 * @param minSpacing Minimum vertical distance between labels
 * @returns Adjusted Y positions
 */
export function stackLabels(yPositions: number[], minSpacing: number): number[] {
  const sorted = yPositions.map((y, i) => ({ y, i })).sort((a, b) => a.y - b.y);
  const result = new Array(yPositions.length);

  for (const { y, i } of sorted) {
    let finalY = y;
    // Check if this position conflicts with any already placed label
    for (const other of sorted) {
      if (other.i >= i) break;
      const otherY = result[other.i];
      if (otherY !== undefined && Math.abs(finalY - otherY) < minSpacing) {
        finalY = otherY + minSpacing;
      }
    }
    result[i] = finalY;
  }
  return result;
}
