export interface TooltipLine {
  label: string;
  value: unknown;
}

export interface Horizon {
  top: number;
  bottom: number;
  name: string;
  color: string;
  texture?: string;
  metadata?: Record<string, any>;

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

export interface StaticRenderOptions {
  width: number;
  height: number;
  format: 'png' | 'svg';
  mode?: RenderMode;
}

export interface InteractiveRenderOptions {
  interactive: boolean;
  arrangement: '2d' | '3d';
  mode?: RenderMode;
}

export interface ComparisonRenderOptions extends StaticRenderOptions {
  profileWidth?: number;
}
