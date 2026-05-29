import * as THREE from 'three';
import { SoilProfileCollection } from '../core/SoilProfileCollection';
import { InteractiveRenderOptions } from '../core/types';
import { sanitizeColor, setTooltipContent } from './safety';

export type Render3DCleanup = () => void;

const CONTAINER_CLEANUP = Symbol('soilprofiles.three3d.cleanup');

interface Render3DContainer extends HTMLElement {
    [CONTAINER_CLEANUP]?: Render3DCleanup;
}

export function renderInteractive3D(container: HTMLElement, profiles: SoilProfileCollection, options: InteractiveRenderOptions): Render3DCleanup {
    const renderContainer = container as Render3DContainer;
    renderContainer[CONTAINER_CLEANUP]?.();

    const width = container.clientWidth || 800;
    const height = container.clientHeight || 600;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0xf0f0f0);

    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 1000);
    camera.position.set(0, 50, 150);

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(width, height);
    container.innerHTML = '';
    container.appendChild(renderer.domElement);

    const light = new THREE.DirectionalLight(0xffffff, 1);
    light.position.set(100, 200, 100);
    scene.add(light);
    scene.add(new THREE.AmbientLight(0x404040, 2));

    const profileGroup = new THREE.Group();

    // Box settings
    const boxWidth = 10;
    const boxDepth = 10;

    // Raycaster objects
    const raycastObjects: THREE.Mesh[] = [];

    // Create 3D boxes for horizons
    profiles.profiles.forEach((profile, idx) => {
        const xPos = profile.position ? profile.position.x : (idx * 20 - (profiles.profiles.length * 10));
        const zPos = profile.position ? profile.position.z : 0;
        
        // Use a hillslope Y offset if desired. Assuming position.y is surface elevation
        const baseElevation = profile.position ? profile.position.y : 0;

        profile.horizons.forEach(horizon => {
            const hHeight = horizon.bottom - horizon.top;
            const hCenterY = baseElevation - horizon.top - (hHeight / 2); // Going down

            const geometry = new THREE.BoxGeometry(boxWidth, hHeight, boxDepth);
            const material = new THREE.MeshLambertMaterial({ 
                color: new THREE.Color(sanitizeColor(horizon.color))
            });
            const mesh = new THREE.Mesh(geometry, material);

            mesh.position.set(xPos, hCenterY, zPos);
            mesh.userData = { 
                profileId: profile.id, 
                horizonName: horizon.name,
                depth: `${horizon.top}-${horizon.bottom} cm`
            };

            profileGroup.add(mesh);
            raycastObjects.push(mesh);
        });
    });

    // Move group so it's somewhat centered
    profileGroup.position.y = 50; 
    scene.add(profileGroup);

    // Tooltip logic for 3D
    const tooltip = document.createElement('div');
    tooltip.style.position = 'absolute';
    tooltip.style.backgroundColor = 'rgba(0,0,0,0.8)';
    tooltip.style.color = 'white';
    tooltip.style.padding = '8px';
    tooltip.style.borderRadius = '4px';
    tooltip.style.pointerEvents = 'none';
    tooltip.style.opacity = '0';
    tooltip.style.transition = 'opacity 0.2s';
    tooltip.style.fontSize = '12px';
    container.style.position = 'relative';
    container.appendChild(tooltip);

    const raycaster = new THREE.Raycaster();
    const mouse = new THREE.Vector2();
    let handleMouseMove: ((e: MouseEvent) => void) | undefined;
    let handleMouseLeave: (() => void) | undefined;

    if (options.interactive) {
        handleMouseMove = (e: MouseEvent) => {
            const rect = renderer.domElement.getBoundingClientRect();
            
            // normalized device coords
            mouse.x = ((e.clientX - rect.left) / width) * 2 - 1;
            mouse.y = - ((e.clientY - rect.top) / height) * 2 + 1;

            raycaster.setFromCamera(mouse, camera);
            const intersects = raycaster.intersectObjects(raycastObjects);

            if (intersects.length > 0) {
                const intersect = intersects[0];
                const data = intersect.object.userData;
                setTooltipContent(tooltip, [
                    { label: 'Profile', value: data.profileId },
                    { label: 'Horizon', value: data.horizonName },
                    { label: 'Depth', value: data.depth }
                ]);
                tooltip.style.left = (e.clientX - rect.left + 15) + 'px';
                tooltip.style.top = (e.clientY - rect.top + 15) + 'px';
                tooltip.style.opacity = '1';
                
                // optional highlight
            } else {
                tooltip.style.opacity = '0';
            }
        };
        
        handleMouseLeave = () => {
             tooltip.style.opacity = '0';
        };

        renderer.domElement.addEventListener('mousemove', handleMouseMove);
        renderer.domElement.addEventListener('mouseleave', handleMouseLeave);
    }

    camera.lookAt(scene.position);

    let animationFrameId: number | undefined;
    let disposed = false;

    function animate(): void {
        if (disposed) {
            return;
        }

        animationFrameId = requestAnimationFrame(animate);
        
        // Simple rotation for effect if not entirely interactive
        if (!options.interactive) {
            profileGroup.rotation.y += 0.005;
        }

        renderer.render(scene, camera);
    }

    const cleanup: Render3DCleanup = () => {
        if (disposed) {
            return;
        }

        disposed = true;

        if (animationFrameId !== undefined) {
            cancelAnimationFrame(animationFrameId);
        }

        if (handleMouseMove) {
            renderer.domElement.removeEventListener('mousemove', handleMouseMove);
        }

        if (handleMouseLeave) {
            renderer.domElement.removeEventListener('mouseleave', handleMouseLeave);
        }

        profileGroup.traverse(object => {
            const mesh = object as THREE.Mesh;

            if (!mesh.isMesh) {
                return;
            }

            mesh.geometry.dispose();

            if (Array.isArray(mesh.material)) {
                mesh.material.forEach(material => material.dispose());
            } else {
                mesh.material.dispose();
            }
        });

        renderer.dispose();

        if (tooltip.parentElement === container) {
            container.removeChild(tooltip);
        }

        if (renderer.domElement.parentElement === container) {
            container.removeChild(renderer.domElement);
        }

        if (renderContainer[CONTAINER_CLEANUP] === cleanup) {
            delete renderContainer[CONTAINER_CLEANUP];
        }
    };

    renderContainer[CONTAINER_CLEANUP] = cleanup;
    animate();

    return cleanup;
}