import { SoilProfileCollection } from '../core/SoilProfileCollection';
import { InteractiveRenderOptions, TooltipLine } from '../core/types';
import { sanitizeColor, setTooltipContent } from './safety';
import { classifyTexture, getTextureColor } from '../core/texture';
import { getPhColor } from '../core/phScale';
import { isDarkMode, THEMES, getTextColorForBackground } from '../core/colors';

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
  const profileWidth = isThumbnail 
    ? (width - currentPadding * 2) / Math.max(1, profiles.profiles.length)
    : Math.max(20, (width - padding * 2) / Math.max(1, profiles.profiles.length) - 20);

  // precalculate drawing regions for hit testing (hovers)
  type HitRegion = { x: number, y: number, w: number, h: number, tooltipLines: TooltipLine[] };
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
    const xOffset = currentPadding + (i * (isThumbnail ? profileWidth : (profileWidth + 20)));

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
        const textureClass = classifyTexture(horizon);
        if (textureClass) {
          tooltipLines.push({ label: 'Texture', value: textureClass.replace(/_/g, ' ') });
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
        tooltipLines
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

  });

  if (options.interactive) {
    canvas.addEventListener('mousemove', (e) => {
      const rect = canvas.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;

      let hovered = false;
      for (const region of hitRegions) {
        if (mouseX >= region.x && mouseX <= region.x + region.w &&
            mouseY >= region.y && mouseY <= region.y + region.h) {
          hovered = true;
          setTooltipContent(tooltip, region.tooltipLines);
          tooltip.style.left = (mouseX + 15) + 'px';
          tooltip.style.top = (mouseY + 15) + 'px';
          tooltip.style.opacity = '1';
          break;
        }
      }

      if (!hovered) {
        tooltip.style.opacity = '0';
      }
    });

    canvas.addEventListener('mouseleave', () => {
        tooltip.style.opacity = '0';
    });
  }
}
