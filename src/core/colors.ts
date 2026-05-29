/**
 * Calculates the appropriate text color (black or white) for a given background hex color
 * based on WCAG luminance formula.
 * 
 * @param hexColor Background color in hex format (e.g., "#ffffff")
 * @returns "#1a1a1a" for light backgrounds, "#ffffff" for dark backgrounds
 */
export function getTextColorForBackground(hexColor: string): string {
  const hex = hexColor.replace('#', '');
  
  // Handle 3-digit hex
  const r = parseInt(hex.length === 3 ? hex[0] + hex[0] : hex.substring(0, 2), 16);
  const g = parseInt(hex.length === 3 ? hex[1] + hex[1] : hex.substring(2, 4), 16);
  const b = parseInt(hex.length === 3 ? hex[2] + hex[2] : hex.substring(4, 6), 16);

  // WCAG luminance formula
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;

  return luminance > 0.5 ? '#1a1a1a' : '#ffffff';
}

/**
 * Detects if the current document is in dark mode.
 * Checks for data-theme="dark" on the html element or prefers-color-scheme.
 * 
 * @returns true if dark mode is detected
 */
export function isDarkMode(): boolean {
  if (typeof document === 'undefined') return false;
  
  const theme = document.documentElement.getAttribute('data-theme');
  if (theme === 'dark') return true;
  
  return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
}

/**
 * Shared color palettes for different themes
 */
export const THEMES = {
  light: {
    bgColor: '#f5f5f5',
    textColor: '#333333',
    borderColor: '#cccccc',
    gridColor: '#dddddd',
    dimColor: '#aaaaaa'
  },
  dark: {
    bgColor: '#1a1c20',
    textColor: '#e8eaf0',
    borderColor: '#333333',
    gridColor: '#333333',
    dimColor: '#666666'
  }
};
