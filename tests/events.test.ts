import {
    Horizon,
    SoilProfile,
    SoilProfileCollection,
    renderStaticToDOM,
    renderComparison,
    attachHorizonEventListeners,
    hasHorizonEventHandlers,
    HorizonEventPayload
} from '../src';

describe('horizon event listeners', () => {
    const horizons: Horizon[] = [
        { top: 0, bottom: 10, name: 'Ap', color: '#8b7355', clay: 18, sand: 45 },
        { top: 10, bottom: 30, name: 'Bt', color: '#a0522d', clay: 32, sand: 30 }
    ];
    const collection = new SoilProfileCollection([new SoilProfile('Test', horizons)]);

    const firstHorizonRect = (container: HTMLElement): SVGElement => {
        const el = container.querySelector('[data-horizon-properties]');
        expect(el).not.toBeNull();
        return el as SVGElement;
    };

    test('hasHorizonEventHandlers detects each callback', () => {
        expect(hasHorizonEventHandlers({})).toBe(false);
        expect(hasHorizonEventHandlers({ onHorizonHover: () => {} })).toBe(true);
        expect(hasHorizonEventHandlers({ onHorizonLeave: () => {} })).toBe(true);
        expect(hasHorizonEventHandlers({ onHorizonClick: () => {} })).toBe(true);
    });

    test('renderStaticToDOM fires hover then leave with matching payloads', () => {
        const container = document.createElement('div');
        const events: Array<{ type: string; payload: HorizonEventPayload }> = [];

        renderStaticToDOM(container, collection, {
            width: 100, height: 200, format: 'svg',
            onHorizonHover: p => events.push({ type: 'hover', payload: p }),
            onHorizonLeave: p => events.push({ type: 'leave', payload: p })
        });

        const rect = firstHorizonRect(container);
        rect.dispatchEvent(new MouseEvent('mouseenter', { bubbles: false }));
        rect.dispatchEvent(new MouseEvent('mouseleave', { bubbles: false }));

        expect(events.map(e => e.type)).toEqual(['hover', 'leave']);
        expect(events[0].payload.horizon.name).toBe(events[1].payload.horizon.name);
        expect(events[0].payload.horizonId).toBe(events[1].payload.horizonId);
        expect(events[0].payload.profileId).toBeTruthy();
    });

    test('renderComparison wires leave-only handlers', () => {
        const container = document.createElement('div');
        const two = new SoilProfileCollection([
            new SoilProfile('A', horizons),
            new SoilProfile('B', horizons)
        ]);
        const left: HorizonEventPayload[] = [];

        renderComparison(container, two, {
            width: 400, height: 300, format: 'svg',
            onHorizonLeave: p => left.push(p)
        });

        const rect = firstHorizonRect(container);
        rect.dispatchEvent(new MouseEvent('mouseleave', { bubbles: false }));

        expect(left).toHaveLength(1);
        expect(left[0].horizon.name).toBe('Ap');
    });

    test('attachHorizonEventListeners works on consumer-injected SVG strings', () => {
        // Consumers like soillite set innerHTML from renderStaticSVG and then
        // attach events themselves; the exported helper must support that.
        const container = document.createElement('div');
        container.innerHTML = `<svg>
            <rect data-horizon-id="p_hz_ap" data-profile-id="p"
                  data-horizon-properties='{"name":"Ap","top":0,"bottom":10}' />
            <rect data-horizon-id="" data-profile-id="p"
                  data-horizon-properties='{"name":"Bt"}' />
        </svg>`;

        const clicks: HorizonEventPayload[] = [];
        const hovers: HorizonEventPayload[] = [];
        attachHorizonEventListeners(container, {
            onHorizonClick: p => clicks.push(p),
            onHorizonHover: p => hovers.push(p)
        });

        const rects = container.querySelectorAll('rect');
        rects[0].dispatchEvent(new MouseEvent('click', { bubbles: false }));
        rects[0].dispatchEvent(new MouseEvent('mouseenter', { bubbles: false }));
        // Second rect is missing data-horizon-id and must be skipped
        rects[1].dispatchEvent(new MouseEvent('click', { bubbles: false }));

        expect(clicks).toHaveLength(1);
        expect(hovers).toHaveLength(1);
        expect(clicks[0].horizonId).toBe('p_hz_ap');
        expect(clicks[0].horizon.top).toBe(0);
    });
});
