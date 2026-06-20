import { SoilProfileCollection } from '../core/SoilProfileCollection';
import { SoilProfile } from '../core/SoilProfile';
import { InteractiveRenderOptions, TooltipLine, RenderAnnotationsOptions } from '../core/types';
import { sanitizeColor, setTooltipContent } from './safety';
import { classifyTexture, textureCodeToName, getTextureColor } from '../core/texture';
import { getPhColor } from '../core/phScale';
import { isDarkMode, THEMES, getTextColorForBackground, resolveHorizonColor } from '../core/colors';
import { munsellToHex } from '../core/munsell';

export function renderInteractive2D(container: HTMLElement, profiles: SoilProfileCollection, options: InteractiveRenderOptions): void {
  const width = container.clientWidth || 800;
  const height = container.clientHeight || 600;
  const padding = 40;
  const mode = options.mode || 'depth';
  const isDark = isDarkMode();
  const theme = isDark ? THEMES.dark : THEMES.light;

  // Create canvas
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  canvas.style.display = 'block';
  canvas.style.background = theme.bgColor;

  // Clean up existing tooltip before clearing container to avoid orphaned DOM elements
  const existingTooltip = container.querySelector('[data-soilprofile-tooltip]');
  if (existingTooltip) {
    existingTooltip.remove();
  }

  container.innerHTML = ''; // clear container
  container.appendChild(canvas);

  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  // Create tooltip element
  const tooltip = document.createElement('div');
  tooltip.setAttribute('data-soilprofile-tooltip', 'true');
  tooltip.style.position = 'absolute';
  tooltip.style.backgroundColor = isDark ? 'rgba(0,0,0,0.9)' : 'rgba(255,255,255,0.9)';
  tooltip.style.color = theme.textColor;
  tooltip.style.border = `1px solid ${theme.borderColor}`;
  tooltip.style.padding = '8px';
  tooltip.style.borderRadius = '4px';
  tooltip.style.pointerEvents = 'none';
  tooltip.style.opacity = '0';
  tooltip.style.transition = 'opacity 0.2s';
  tooltip.style.fontSize = '12px';
  tooltip.style.zIndex = '100';
  tooltip.style.boxShadow = '0 2px 8px rgba(0,0,0,0.2)';
  container.style.position = 'relative'; // Ensure relative positioning for tooltip
  container.appendChild(tooltip);

  const maxDepth = profiles.getMaxDepth() || 100;
  const isThumbnail = mode === 'thumbnail';
  const currentPadding = isThumbnail ? 5 : padding;
  const depthScale = (height - currentPadding * 2) / maxDepth;

  let profileSpacing = 20;
  if (options.annotations?.enabled && options.annotations?.position === 'right') {
      profileSpacing += (options.annotations?.width || 60);
  }

  const profileWidth = isThumbnail 
    ? (width - currentPadding * 2) / Math.max(1, profiles.profiles.length)
    : Math.max(20, (width - padding * 2) / Math.max(1, profiles.profiles.length) - profileSpacing);

  // precalculate drawing regions for hit testing (hovers)
  type HitRegion = { x: number, y: number, w: number, h: number, tooltipLines: TooltipLine[], horizon?: any, profileId?: string, annotation?: any };
  const hitRegions: HitRegion[] = [];

  // Draw background
  ctx.fillStyle = theme.bgColor;
  ctx.fillRect(0, 0, width, height);
  
  // Draw depth scale grid (skip for thumbnail)
  if (!isThumbnail) {
    ctx.strokeStyle = theme.gridColor;
    ctx.lineWidth = 0.5;
    ctx.setLineDash([5, 5]);
    for (let d = 0; d <= maxDepth; d += 20) {
      const y = currentPadding + d * depthScale;
      ctx.beginPath();
      ctx.moveTo(currentPadding, y);
      ctx.lineTo(width - currentPadding, y);
      ctx.stroke();
      
      ctx.fillStyle = theme.textColor;
      ctx.font = '10px Arial';
      ctx.textAlign = 'right';
      ctx.fillText(d.toString(), currentPadding - 5, y + 4);
    }
    ctx.setLineDash([]); // Reset dash
  }

  profiles.profiles.forEach((profile, i) => {
    const xOffset = currentPadding + (i * (isThumbnail ? profileWidth : (profileWidth + profileSpacing)));

    // Draw Profile ID (skip for thumbnail)
    if (!isThumbnail) {
      ctx.fillStyle = theme.textColor;
      ctx.font = 'bold 14px Arial';
      ctx.textAlign = 'center';
      ctx.fillText(profile.id, xOffset + profileWidth / 2, currentPadding - 15);
    }

    profile.horizons.forEach(horizon => {
      const yOffset = currentPadding + (horizon.top * depthScale);
      const hHeight = (horizon.bottom - horizon.top) * depthScale;

      let color = sanitizeColor(horizon.color);

      if (mode === 'properties' && horizon.ph !== undefined) {
        color = getPhColor(horizon.ph);
      } else if (horizon.clay !== undefined && mode !== 'thumbnail') {
        const textureClass = classifyTexture(horizon);
        color = getTextureColor(textureClass);
      } else if ((mode === 'depth' || mode === 'thumbnail') && horizon.clay === undefined) {
        const munsellColor = munsellToHex(horizon.munsellHue, horizon.munsellValue, horizon.munsellChroma);
        color = resolveHorizonColor(munsellColor, color);
      }

      ctx.fillStyle = color;
      ctx.fillRect(xOffset, yOffset, profileWidth, hHeight);
      
      if (!isThumbnail) {
        ctx.strokeStyle = '#333333';
        ctx.lineWidth = 1;
        ctx.strokeRect(xOffset, yOffset, profileWidth, hHeight);
      }

      // Save hit region
      const tooltipLines: TooltipLine[] = [
        { label: 'Profile', value: profile.id },
        { label: 'Horizon', value: horizon.name },
        { label: 'Depth', value: `${horizon.top} - ${horizon.bottom} cm` }
      ];

      if (horizon.clay !== undefined) {
        const textureCode = classifyTexture(horizon);
        if (textureCode) {
          tooltipLines.push({ label: 'Texture', value: textureCodeToName(textureCode) });
        }
        tooltipLines.push({ label: 'Clay', value: `${horizon.clay}%` });
        tooltipLines.push({ label: 'Sand', value: `${horizon.sand}%` });
      } else if (horizon.texture) {
        tooltipLines.push({ label: 'Texture', value: horizon.texture });
      }
      
      if (horizon.ph !== undefined) {
        tooltipLines.push({ label: 'pH', value: horizon.ph.toFixed(1) });
      }
      
      if (horizon.om !== undefined) {
        tooltipLines.push({ label: 'OM', value: `${horizon.om}%` });
      }

      if (horizon.metadata) {
        Object.entries(horizon.metadata).forEach(([k, v]) => {
           tooltipLines.push({ label: k, value: v });
        });
      }

      hitRegions.push({
        x: xOffset,
        y: yOffset,
        w: profileWidth,
        h: hHeight,
        tooltipLines,
        horizon,
        profileId: profile.id
      });

      // Label
      if (isThumbnail) {
        if (hHeight > 8) {
          ctx.fillStyle = getTextColorForBackground(color);
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          const fontSize = Math.min(24, Math.floor(hHeight * 0.8));
          ctx.font = `bold ${fontSize}px Arial`;
          ctx.fillText(horizon.name, xOffset + profileWidth / 2, yOffset + hHeight / 2);
        }
      } else if (hHeight > 15) {
        ctx.fillStyle = getTextColorForBackground(color);
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.font = 'bold 10px Arial';
        ctx.fillText(horizon.name, xOffset + profileWidth / 2, yOffset + hHeight / 2);
      }
    });

    // Add annotations
    if (options.annotations?.enabled && !isThumbnail) {
      renderAnnotationsCanvas(ctx, profile, xOffset, profileWidth, currentPadding, depthScale, options.annotations, theme, hitRegions, profile.id);
    }
  });

  // Draw legend if enabled
  if (options.annotations?.enabled && options.annotations?.showLegend !== false && !isThumbnail) {
    renderAnnotationLegendCanvas(ctx, profiles, 40, height - 35, theme);
  }

  if (options.interactive) {
    let lastHoveredRegion: (typeof hitRegions)[0] | null = null;

    canvas.addEventListener('mousemove', (e) => {
      const rect = canvas.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;

      let hovered = false;
      for (const region of hitRegions) {
        if (mouseX >= region.x && mouseX <= region.x + region.w &&
            mouseY >= region.y && mouseY <= region.y + region.h) {
          hovered = true;

          if (lastHoveredRegion !== region) {
            if (options.onHorizonHover && region.horizon && region.profileId) {
              options.onHorizonHover({
                horizonId: `${region.profileId}_hz_${region.horizon.name.toLowerCase()}`,
                profileId: region.profileId,
                horizon: region.horizon,
                event: e,
                position: { x: mouseX, y: mouseY }
              });
            }
            lastHoveredRegion = region;
          }

          setTooltipContent(tooltip, region.tooltipLines);
          tooltip.style.left = (mouseX + 15) + 'px';
          tooltip.style.top = (mouseY + 15) + 'px';
          tooltip.style.opacity = '1';
          break;
        }
      }

      if (!hovered) {
        tooltip.style.opacity = '0';
        lastHoveredRegion = null;
      }
    });

    canvas.addEventListener('click', (e) => {
      if (!options.onHorizonClick) return;

      const rect = canvas.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;

      for (const region of hitRegions) {
        if (mouseX >= region.x && mouseX <= region.x + region.w &&
            mouseY >= region.y && mouseY <= region.y + region.h) {
          if (region.horizon && region.profileId) {
            options.onHorizonClick({
              horizonId: `${region.profileId}_hz_${region.horizon.name.toLowerCase()}`,
              profileId: region.profileId,
              horizon: region.horizon,
              event: e,
              position: { x: mouseX, y: mouseY }
            });
          }
          break;
        }
      }
    });

    canvas.addEventListener('mouseleave', () => {
        tooltip.style.opacity = '0';
        lastHoveredRegion = null;
    });
  }
}

function renderAnnotationsCanvas(
  ctx: CanvasRenderingContext2D,
  profile: SoilProfile,
  xOffset: number,
  profileWidth: number,
  padding: number,
  depthScale: number,
  options: RenderAnnotationsOptions,
  theme: any,
  hitRegions: any[],
  profileId: string
): void {
  if (!options.enabled) return;

  const annotationWidth = options.width || 60;
  const fontSize = options.labelFontSize || 10;
  const isOverlay = options.position === 'overlay';

  (profile.depthAnnotations ?? []).forEach(ann => {
    let top: number;
    let bottom: number;
    let type = ann.type;

    if (Array.isArray(ann.depth)) {
      top = ann.depth[0];
      bottom = ann.depth[1];
      if (!type) type = 'zone';
    } else {
      top = ann.depth;
      bottom = ann.depth;
      if (!type) type = 'line';
    }

    const yTop = padding + top * depthScale;
    const yBottom = padding + bottom * depthScale;
    const color = ann.color || (theme.isDark ? '#aaa' : '#666');
    const opacity = ann.opacity ?? 0.3;

    const x = isOverlay ? xOffset : xOffset + profileWidth + 5;
    const width = isOverlay ? profileWidth : annotationWidth;

    if (type === 'zone') {
      ctx.save();
      ctx.globalAlpha = opacity;
      ctx.fillStyle = color;
      ctx.fillRect(x, yTop, width, Math.max(yBottom - yTop, 1));
      ctx.globalAlpha = 1.0;
      ctx.strokeStyle = color;
      ctx.lineWidth = 0.5;
      ctx.strokeRect(x, yTop, width, Math.max(yBottom - yTop, 1));
      ctx.restore();

      ctx.fillStyle = theme.textColor;
      ctx.font = `${fontSize}px Arial`;
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      ctx.fillText(ann.label, x + 2, yTop + (yBottom - yTop) / 2);

      hitRegions.push({
        x, y: yTop, w: width, h: Math.max(yBottom - yTop, 1),
        tooltipLines: [
          { label: 'Profile', value: profileId },
          { label: 'Annotation', value: ann.label },
          { label: 'Depth', value: `${top} - ${bottom} cm` }
        ],
        annotation: ann
      });
    } else {
      ctx.save();
      ctx.strokeStyle = color;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(x, yTop);
      ctx.lineTo(x + width, yTop);
      ctx.stroke();
      ctx.restore();

      ctx.fillStyle = theme.textColor;
      ctx.font = `${fontSize}px Arial`;
      ctx.textAlign = 'left';
      ctx.textBaseline = 'bottom';
      const textX = isOverlay ? x + 2 : x + width + 2;
      ctx.fillText(ann.label, textX, yTop - 2);

      hitRegions.push({
        x, y: yTop - 5, w: width, h: 10,
        tooltipLines: [
          { label: 'Profile', value: profileId },
          { label: 'Annotation', value: ann.label },
          { label: 'Depth', value: `${top} cm` }
        ],
        annotation: ann
      });
    }
  });
}

function renderAnnotationLegendCanvas(ctx: CanvasRenderingContext2D, profiles: SoilProfileCollection, x: number, y: number, theme: any): void {
  const uniqueAnnotations = new Map<string, { color: string; type: string }>();

  profiles.profiles.forEach(p => {
    (p.depthAnnotations ?? []).forEach(ann => {
      if (!uniqueAnnotations.has(ann.label)) {
        uniqueAnnotations.set(ann.label, { 
          color: ann.color || (theme.isDark ? '#aaa' : '#666'),
          type: ann.type || (Array.isArray(ann.depth) ? 'zone' : 'line')
        });
      }
    });
  });

  if (uniqueAnnotations.size === 0) return;

  ctx.fillStyle = theme.textColor;
  ctx.font = 'bold 11px Arial';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  ctx.fillText('Legend:', x, y);

  let idx = 0;
  const itemHeight = 15;
  const itemWidth = 120;
  const cols = 3;

  uniqueAnnotations.forEach((val, label) => {
    const col = idx % cols;
    const row = Math.floor(idx / cols);
    const lx = x + col * itemWidth;
    const ly = y + 15 + row * itemHeight;

    if (val.type === 'zone') {
      ctx.save();
      ctx.globalAlpha = 0.4;
      ctx.fillStyle = val.color;
      ctx.fillRect(lx, ly, 10, 10);
      ctx.globalAlpha = 1.0;
      ctx.strokeStyle = val.color;
      ctx.lineWidth = 0.5;
      ctx.strokeRect(lx, ly, 10, 10);
      ctx.restore();
    } else {
      ctx.strokeStyle = val.color;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(lx, ly + 5);
      ctx.lineTo(lx + 10, ly + 5);
      ctx.stroke();
    }
    
    ctx.fillStyle = theme.textColor;
    ctx.font = '10px Arial';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.fillText(label, lx + 15, ly);
    idx++;
  });
}
