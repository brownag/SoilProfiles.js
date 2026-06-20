export interface TooltipLine {
  label: string;
  value: unknown;
}

export interface TooltipConfig {
  properties?: (keyof Horizon)[];
  customLabels?: Record<string, string>;
  customFormatters?: Record<string, (value: any) => string>;
  includeDepth?: boolean;
}

export interface RenderTooltipOptions {
  enabled?: boolean;
  mode?: 'native' | 'custom' | 'data-only';
  defaultProperties?: string[];
  positioning?: 'right' | 'left' | 'auto';
}

export interface HorizonEventPayload {
  horizonId: string;
  profileId: string;
  horizon: Horizon;
  event: MouseEvent;
  position: { x: number; y: number };
}

export interface Horizon {
  top: number;
  bottom: number;
  name: string;
  color: string;
  texture?: string;
  metadata?: Record<string, any>;
  tooltipConfig?: TooltipConfig;

  // Standardized soil properties
  clay?: number;    // clay percentage
  sand?: number;    // sand percentage
  silt?: number;    // silt percentage
  ph?: number;      // pH (1:1 water)
  om?: number;       // organic matter %
  ksat?: number;     // saturated hydraulic conductivity

  // Munsell color system
  munsellHue?: string;    // e.g., "10YR", "5R"
  munsellValue?: number;  // Value component (0-10)
  munsellChroma?: number; // Chroma component
}

export interface PropertyMap {
  clay?: string;
  sand?: string;
  silt?: string;
  ph?: string;
  om?: string;
  ksat?: string;
  name?: string;
  munsellHue?: string;
  munsellValue?: string;
  munsellChroma?: string;
}

export interface Position {
  x: number;
  y: number;
  z: number;
}

export type RenderMode = 'depth' | 'texture' | 'properties' | 'thumbnail';

export interface DepthAnnotation {
  depth: number | [number, number];  // single depth or range [top, bottom]
  label: string;                      // e.g., "Restriction", "Water Table", "Fragipan"
  color?: string;                     // optional thematic color (hex or CSS)
  type?: 'line' | 'zone' | 'marker';  // visualization type (default: 'zone' for ranges, 'line' for single)
  opacity?: number;                   // 0-1, default 0.3 for zones
}

export interface RenderAnnotationsOptions {
  enabled?: boolean;
  position?: 'right' | 'overlay';  // 'right' uses annotation area, 'overlay' overlays on profile
  width?: number;                   // width in pixels (default: 60)
  labelFontSize?: number;           // default: 10
  showLegend?: boolean;             // show annotation legend (default: true)
}

export const ANNOTATION_PRESETS: Record<string, Partial<DepthAnnotation>> = {
  'restriction': { color: '#8B4513', label: 'Restriction' },
  'water_table': { color: '#4169E1', label: 'Water Table' },
  'diagnostic_feature': { color: '#FF6347', label: 'Diagnostic' },
  'solum': { color: '#DAA520', label: 'Solum' },
  'parent_material': { color: '#A9A9A9', label: 'Parent Material' },
};

export interface StaticRenderOptions {
  width: number;
  height: number;
  format: 'png' | 'svg';
  mode?: RenderMode;
  tooltips?: RenderTooltipOptions;
  annotations?: RenderAnnotationsOptions;
  onHorizonHover?: (payload: HorizonEventPayload) => void;
  onHorizonClick?: (payload: HorizonEventPayload) => void;
  tooltipRenderer?: (horizon: Horizon) => HTMLElement;
}

export interface InteractiveRenderOptions {
  interactive: boolean;
  arrangement: '2d' | '3d';
  mode?: RenderMode;
  tooltips?: RenderTooltipOptions;
  annotations?: RenderAnnotationsOptions;
  onHorizonHover?: (payload: HorizonEventPayload) => void;
  onHorizonClick?: (payload: HorizonEventPayload) => void;
  tooltipRenderer?: (horizon: Horizon) => HTMLElement;
}

/**
 * Renders a side-by-side comparison of soil profiles with optional thematic coloring.
 * Supports rendering modes:
 * - 'depth': Renders using Munsell or stored colors
 * - 'texture': Colors horizons by USDA texture class, includes texture legend
 * - 'properties': Colors horizons by pH value, includes pH legend
 *
 * Use showThematicLegend to control legend visibility for texture and properties modes.
 */
export interface ComparisonRenderOptions extends StaticRenderOptions {
  profileWidth?: number;
  centered?: boolean;
  profileMaxWidth?: number;
  showThematicLegend?: boolean;  // Whether to show texture/pH legend (default: true)
}
