import { HorizonEventPayload } from '../core/types';
import { createDefaultTooltip } from '../core/tooltipUtils';

/**
 * The horizon event callbacks shared by every render options interface.
 * Consumers who inject a rendered SVG string into the DOM themselves can pass
 * these directly to attachHorizonEventListeners().
 */
export interface HorizonEventHandlers {
    onHorizonHover?: (payload: HorizonEventPayload) => void;
    onHorizonLeave?: (payload: HorizonEventPayload) => void;
    onHorizonClick?: (payload: HorizonEventPayload) => void;
    tooltipRenderer?: (horizon: any) => HTMLElement;
    tooltips?: { mode?: 'native' | 'custom' | 'data-only' };
}

export function hasHorizonEventHandlers(handlers: HorizonEventHandlers): boolean {
    return !!(handlers.onHorizonHover || handlers.onHorizonLeave || handlers.onHorizonClick || handlers.tooltipRenderer || handlers.tooltips?.mode === 'custom');
}

/**
 * Wires hover/leave/click listeners onto every element in `container` carrying
 * the data-horizon-* attributes emitted by the SVG/HTML renderers.
 *
 * Automatically mounts a custom floating tooltip if tooltipRenderer is provided
 * or if tooltips.mode is 'custom' (without custom event handlers).
 */
export function attachHorizonEventListeners(container: HTMLElement, handlers: HorizonEventHandlers): void {
    const elements = container.querySelectorAll('[data-horizon-properties]');
    let skippedCount = 0;

    // Set up DOM tooltip element if tooltipRenderer is provided or mode is custom
    let tooltipEl: HTMLElement | null = null;
    const isCustomMode = handlers.tooltips?.mode === 'custom';
    if (handlers.tooltipRenderer || isCustomMode) {
        container.style.position = container.style.position || 'relative';
        tooltipEl = document.createElement('div');
        tooltipEl.setAttribute('data-soilprofile-tooltip', 'true');
        tooltipEl.style.position = 'absolute';
        tooltipEl.style.pointerEvents = 'none';
        tooltipEl.style.opacity = '0';
        tooltipEl.style.transition = 'opacity 0.15s ease-out';
        tooltipEl.style.zIndex = '1000';
        container.appendChild(tooltipEl);
    }

    elements.forEach(element => {
        if (!(element instanceof SVGElement)) return;

        const horizonId = element.getAttribute('data-horizon-id');
        const horizonDataStr = element.getAttribute('data-horizon-properties');
        const profileId = element.getAttribute('data-profile-id');

        if (!horizonId || !horizonDataStr || !profileId) {
            skippedCount++;
            return;
        }

        try {
            const horizon = JSON.parse(horizonDataStr);

            const payloadFor = (event: MouseEvent): HorizonEventPayload => {
                const rect = (element as SVGElement).getBoundingClientRect();
                return {
                    horizonId,
                    profileId,
                    horizon,
                    event,
                    position: { x: event.clientX - rect.left, y: event.clientY - rect.top }
                };
            };

            if (handlers.onHorizonClick) {
                element.addEventListener('click', (event) => {
                    handlers.onHorizonClick!(payloadFor(event as MouseEvent));
                });
            }

            if (handlers.onHorizonHover) {
                element.addEventListener('mouseenter', (event) => {
                    handlers.onHorizonHover!(payloadFor(event as MouseEvent));
                });
            }

            if (handlers.onHorizonLeave) {
                element.addEventListener('mouseleave', (event) => {
                    handlers.onHorizonLeave!(payloadFor(event as MouseEvent));
                });
            }

            // Automatic floating tooltip handling if tooltipRenderer is provided
            if (tooltipEl) {
                element.addEventListener('mouseenter', (event) => {
                    const mouseEv = event as MouseEvent;
                    const containerRect = container.getBoundingClientRect();
                    tooltipEl!.replaceChildren();
                    if (handlers.tooltipRenderer) {
                        const customEl = handlers.tooltipRenderer(horizon);
                        tooltipEl!.appendChild(customEl);
                    } else if (isCustomMode) {
                        const defaultEl = createDefaultTooltip(horizon);
                        tooltipEl!.appendChild(defaultEl);
                    }
                    tooltipEl!.style.left = (mouseEv.clientX - containerRect.left + 15) + 'px';
                    tooltipEl!.style.top = (mouseEv.clientY - containerRect.top + 15) + 'px';
                    tooltipEl!.style.opacity = '1';
                });

                element.addEventListener('mousemove', (event) => {
                    const mouseEv = event as MouseEvent;
                    const containerRect = container.getBoundingClientRect();
                    tooltipEl!.style.left = (mouseEv.clientX - containerRect.left + 15) + 'px';
                    tooltipEl!.style.top = (mouseEv.clientY - containerRect.top + 15) + 'px';
                });

                element.addEventListener('mouseleave', () => {
                    tooltipEl!.style.opacity = '0';
                });
            }
        } catch {
            // Skip elements with invalid JSON
        }
    });

    if (skippedCount > 0) {
        console.warn(`SoilProfiles: ${skippedCount} horizon element(s) were skipped because they were missing required data-profile-id, data-horizon-id, or data-horizon-properties attributes. This may indicate an SVG was generated with an older version or by external code.`);
    }
}
