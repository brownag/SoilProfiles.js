import { Horizon, TooltipLine } from './types';
import { classifyTexture } from './texture';

export interface FormattedProperty {
  key: string;
  label: string;
  value: string;
}

/**
 * Format horizon properties for display in a tooltip or table.
 *
 * @param horizon Horizon object to format
 * @param options Configuration for formatting
 * @returns Array of formatted properties with label and value
 *
 * @example
 * const props = formatHorizonProperties(horizon, {
 *   properties: ['name', 'clay', 'sand', 'ph'],
 *   customLabels: { clay: 'Clay %' },
 *   customFormatters: { ph: (v) => v.toFixed(1) }
 * });
 */
export function formatHorizonProperties(
  horizon: Horizon,
  options?: {
    properties?: string[];
    customLabels?: Record<string, string>;
    customFormatters?: Record<string, (value: any) => string>;
    includeDepth?: boolean;
  }
): FormattedProperty[] {
  const {
    properties = ['name', 'depth', 'texture', 'clay', 'sand', 'ph', 'om'],
    customLabels = {},
    customFormatters = {},
    includeDepth = true
  } = options || {};

  const formatted: FormattedProperty[] = [];

  properties.forEach(prop => {
    let value: any;
    let key = prop;

    if (prop === 'depth' && includeDepth) {
      value = `${horizon.top}-${horizon.bottom} cm`;
      key = 'depth';
    } else if (prop === 'name') {
      value = horizon.name;
    } else if (prop === 'texture') {
      if (horizon.clay !== undefined) {
        value = classifyTexture(horizon)?.replace(/_/g, ' ') || 'Unknown';
      } else if (horizon.texture) {
        value = horizon.texture;
      } else {
        return; // skip if no texture data
      }
    } else if (prop in horizon) {
      value = (horizon as any)[prop];
      if (value === undefined || value === null) {
        return; // skip undefined properties
      }
    } else {
      return; // skip unknown properties
    }

    // Apply custom formatter if available
    let formattedValue: string;
    if (customFormatters[key]) {
      formattedValue = customFormatters[key](value);
    } else {
      // Default formatting based on value type
      if (typeof value === 'number') {
        formattedValue = Number.isInteger(value)
          ? value.toString()
          : value.toFixed(2);
      } else {
        formattedValue = String(value);
      }
    }

    // Get label - custom label takes precedence
    const label = customLabels[key] || propertyLabel(key);

    formatted.push({
      key,
      label,
      value: formattedValue
    });
  });

  return formatted;
}

/**
 * Get default label for a property key.
 * @internal
 */
function propertyLabel(key: string): string {
  const labels: Record<string, string> = {
    name: 'Horizon',
    depth: 'Depth',
    texture: 'Texture',
    clay: 'Clay %',
    sand: 'Sand %',
    silt: 'Silt %',
    ph: 'pH',
    om: 'Organic Matter %',
    ksat: 'Ksat',
    munsellHue: 'Hue',
    munsellValue: 'Value',
    munsellChroma: 'Chroma'
  };
  return labels[key] || key;
}

/**
 * Create a default HTML tooltip element for a horizon.
 *
 * @param horizon Horizon object to create tooltip for
 * @param options Configuration for formatting
 * @returns HTML div element with formatted horizon properties
 *
 * @example
 * const tooltip = createDefaultTooltip(horizon);
 * container.appendChild(tooltip);
 */
export function createDefaultTooltip(
  horizon: Horizon,
  options?: {
    properties?: string[];
    customLabels?: Record<string, string>;
    customFormatters?: Record<string, (value: any) => string>;
    includeDepth?: boolean;
    className?: string;
    style?: Record<string, string>;
  }
): HTMLElement {
  const {
    className = 'soilprofile-tooltip',
    style = {}
  } = options || {};

  const div = document.createElement('div');
  div.className = className;

  // Set default styles if not provided
  const defaultStyle: Record<string, string> = {
    padding: '8px',
    backgroundColor: 'rgba(0,0,0,0.9)',
    color: '#fff',
    borderRadius: '4px',
    fontSize: '12px',
    fontFamily: 'Arial, sans-serif',
    boxShadow: '0 2px 8px rgba(0,0,0,0.2)',
    maxWidth: '200px',
    ...style
  };

  Object.assign(div.style, defaultStyle);

  // Format and append properties
  const formatted = formatHorizonProperties(horizon, options);

  formatted.forEach((prop, index) => {
    if (index > 0) {
      const br = document.createElement('br');
      div.appendChild(br);
    }

    const label = document.createElement('strong');
    label.textContent = `${prop.label}:`;
    div.appendChild(label);

    div.appendChild(document.createTextNode(` ${prop.value}`));
  });

  return div;
}

/**
 * Parse horizon data from an SVG element's data attributes.
 *
 * @param element SVG element with data-horizon-properties attribute
 * @returns Parsed Horizon object or null if parsing fails
 *
 * @example
 * const element = document.querySelector('[data-horizon-id="profile1_hz_ap"]');
 * const horizon = getHorizonDataFromElement(element);
 */
export function getHorizonDataFromElement(element: Element): Horizon | null {
  if (!element) return null;

  const dataStr = element.getAttribute('data-horizon-properties');
  if (!dataStr) return null;

  try {
    return JSON.parse(dataStr);
  } catch {
    return null;
  }
}

/**
 * Create tooltip lines for a horizon (for compatibility with existing tooltip system).
 *
 * @param horizon Horizon object
 * @param options Configuration for formatting
 * @returns Array of TooltipLine objects
 */
export function createTooltipLines(
  horizon: Horizon,
  options?: {
    properties?: string[];
    customLabels?: Record<string, string>;
    customFormatters?: Record<string, (value: any) => string>;
    includeDepth?: boolean;
  }
): TooltipLine[] {
  const formatted = formatHorizonProperties(horizon, options);
  return formatted.map(prop => ({
    label: prop.label,
    value: prop.value
  }));
}
