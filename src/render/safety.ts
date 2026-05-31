const SVG_TEXT_ESCAPE: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;'
};

const SVG_ATTRIBUTE_ESCAPE: Record<string, string> = {
  ...SVG_TEXT_ESCAPE,
  '"': '&quot;',
  "'": '&#39;'
};

const HEX_COLOR_PATTERN = /^#(?:[0-9a-fA-F]{3,4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/;
const CSS_FUNCTION_COLOR_PATTERN = /^(?:rgb|rgba|hsl|hsla)\(\s*[\d.\s,%+-]+\)$/i;
const CSS_IDENTIFIER_PATTERN = /^[a-zA-Z][a-zA-Z0-9-]*$/;

export const DEFAULT_RENDER_COLOR = '#cccccc';

export interface TooltipLine {
  label: string;
  value: unknown;
}

export function formatDisplayValue(value: unknown): string {
  if (value === null || value === undefined) {
    return '';
  }

  return String(value);
}

export function escapeSvgText(value: unknown): string {
  return formatDisplayValue(value).replace(/[&<>]/g, character => SVG_TEXT_ESCAPE[character]);
}

export function escapeSvgAttribute(value: unknown): string {
  return formatDisplayValue(value).replace(/[&<>"']/g, character => SVG_ATTRIBUTE_ESCAPE[character]);
}

export function sanitizeColor(value: unknown, fallback = DEFAULT_RENDER_COLOR): string {
  const color = formatDisplayValue(value).trim();

  if (
    HEX_COLOR_PATTERN.test(color) ||
    CSS_FUNCTION_COLOR_PATTERN.test(color) ||
    CSS_IDENTIFIER_PATTERN.test(color)
  ) {
    return color;
  }

  return fallback;
}

export function finiteNumber(value: unknown, fallback: number): number {
  const numericValue = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(numericValue) ? numericValue : fallback;
}

export function setTooltipContent(tooltip: HTMLElement, lines: TooltipLine[]): void {
  tooltip.replaceChildren();

  lines.forEach((line, index) => {
    if (index > 0) {
      tooltip.appendChild(document.createElement('br'));
    }

    const label = document.createElement('strong');
    label.textContent = `${line.label}:`;

    tooltip.appendChild(label);
    tooltip.appendChild(document.createTextNode(` ${formatDisplayValue(line.value)}`));
  });
}

export function generateHorizonId(profileId: string, horizonName: string, index: number): string {
  // Sanitize to only allow safe characters (alphanumeric, underscore, hyphen)
  const safeName = (str: string) => str.toLowerCase().replace(/[^a-z0-9_-]/g, '_');
  return `${safeName(profileId)}_hz_${safeName(horizonName)}_${index}`;
}

export function serializeHorizonData(horizon: any): string {
  try {
    // Exclude color field to avoid storing potentially unsafe attribute values
    const {color, ...safe} = horizon;
    return JSON.stringify(safe);
  } catch {
    return '{}';
  }
}
