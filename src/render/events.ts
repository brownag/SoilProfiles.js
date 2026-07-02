import { HorizonEventPayload } from '../core/types';

/**
 * The horizon event callbacks shared by every render options interface.
 * Consumers who inject a rendered SVG string into the DOM themselves can pass
 * these directly to attachHorizonEventListeners().
 */
export interface HorizonEventHandlers {
    onHorizonHover?: (payload: HorizonEventPayload) => void;
    onHorizonLeave?: (payload: HorizonEventPayload) => void;
    onHorizonClick?: (payload: HorizonEventPayload) => void;
}

export function hasHorizonEventHandlers(handlers: HorizonEventHandlers): boolean {
    return !!(handlers.onHorizonHover || handlers.onHorizonLeave || handlers.onHorizonClick);
}

/**
 * Wires hover/leave/click listeners onto every element in `container` carrying
 * the data-horizon-* attributes emitted by the SVG/HTML renderers.
 *
 * Hover fires on mouseenter and leave on mouseleave of the same element, so a
 * tooltip shown from onHorizonHover can always be hidden from onHorizonLeave.
 */
export function attachHorizonEventListeners(container: HTMLElement, handlers: HorizonEventHandlers): void {
    const elements = container.querySelectorAll('[data-horizon-properties]');
    let skippedCount = 0;

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
        } catch {
            // Skip elements with invalid JSON
        }
    });

    if (skippedCount > 0) {
        console.warn(`SoilProfiles: ${skippedCount} horizon element(s) were skipped because they were missing required data-profile-id, data-horizon-id, or data-horizon-properties attributes. This may indicate an SVG was generated with an older version or by external code.`);
    }
}
