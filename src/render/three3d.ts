import type * as ThreeNamespace from 'three';
import { SoilProfileCollection } from '../core/SoilProfileCollection';
import { InteractiveRenderOptions } from '../core/types';
import { sanitizeColor, setTooltipContent } from './safety';
import { getTextureColor, classifyTextureUSDA } from '../core/texture';
import { munsellToHex } from '../core/munsell';
import { getPhColor } from '../core/phScale';
import { resolveHorizonColor } from '../core/colors';

export type Render3DCleanup = () => void;

const CONTAINER_CLEANUP = Symbol('soilprofiles.three3d.cleanup');

interface Render3DContainer extends HTMLElement {
    [CONTAINER_CLEANUP]?: Render3DCleanup;
}

function getThreeInstance(): typeof ThreeNamespace {
    if (typeof window !== 'undefined' && (window as any).THREE) {
        return (window as any).THREE;
    }
    if (typeof globalThis !== 'undefined' && (globalThis as any).THREE) {
        return (globalThis as any).THREE;
    }
    try {
        return require('three');
    } catch {
        throw new Error('Three.js is required for renderInteractive3D. Please load three.js or install the "three" package.');
    }
}

export function renderInteractive3D(container: HTMLElement, profiles: SoilProfileCollection, options: InteractiveRenderOptions): Render3DCleanup {
    const THREE = getThreeInstance();
    const renderContainer = container as Render3DContainer;
    renderContainer[CONTAINER_CLEANUP]?.();

    const width = container.clientWidth || 800;
    const height = container.clientHeight || 600;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0xf4f6f8);

    // Camera setup with an elevated 3/4 perspective angle
    const camera = new THREE.PerspectiveCamera(40, width / height, 0.1, 2000);
    camera.position.set(0, 70, 220);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(typeof window !== 'undefined' ? window.devicePixelRatio : 1, 2));
    container.innerHTML = '';
    container.appendChild(renderer.domElement);

    // Multi-source lighting for depth and form
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.65);
    scene.add(ambientLight);

    const keyLight = new THREE.DirectionalLight(0xfffaed, 0.85);
    keyLight.position.set(120, 200, 150);
    scene.add(keyLight);

    const fillLight = new THREE.DirectionalLight(0xdde8f5, 0.4);
    fillLight.position.set(-100, 100, -80);
    scene.add(fillLight);

    const topLight = new THREE.DirectionalLight(0xffffff, 0.3);
    topLight.position.set(0, 200, 0);
    scene.add(topLight);

    const profileGroup = new THREE.Group();

    // Hexagonal pedon prism dimensions: radius ~18 for natural soil prism volume
    const hexRadius = 18;
    const profileSpacing = 58;
    const mode = options.mode || 'depth';

    const raycastObjects: ThreeNamespace.Mesh[] = [];
    const numProfiles = profiles.profiles.length;
    const totalSpan = (numProfiles - 1) * profileSpacing;

    // Calculate max depth across profiles for centering
    const maxProfileDepth = profiles.getMaxDepth?.() || 100;

    profiles.profiles.forEach((profile, idx) => {
        const xPos = profile.position ? profile.position.x : (idx * profileSpacing - totalSpan / 2);
        const zPos = profile.position ? profile.position.z : 0;
        const baseElevation = profile.position ? profile.position.y : 0;

        profile.horizons.forEach((horizon, hIdx) => {
            const hHeight = Math.max(horizon.bottom - horizon.top, 0.5);
            const hCenterY = baseElevation - horizon.top - (hHeight / 2);

            // Determine color based on mode and horizon data
            let hexColor = sanitizeColor(horizon.color);
            if (mode === 'properties' && horizon.ph !== undefined) {
                hexColor = getPhColor(horizon.ph);
            } else if (mode === 'texture' && horizon.clay !== undefined) {
                hexColor = getTextureColor(classifyTextureUSDA(horizon));
            } else if (horizon.clay !== undefined) {
                hexColor = getTextureColor(classifyTextureUSDA(horizon));
            } else {
                const munsellColor = munsellToHex(horizon.munsellHue, horizon.munsellValue, horizon.munsellChroma);
                hexColor = resolveHorizonColor(munsellColor, hexColor);
            }

            const threeColor = new THREE.Color(hexColor);
            // 6 radial segments create a regular hexagonal prism
            const geometry = new THREE.CylinderGeometry(hexRadius, hexRadius, hHeight, 6);

            const sideMaterial = new THREE.MeshStandardMaterial({
                color: threeColor,
                roughness: 0.85,
                metalness: 0.05
            });

            const mesh = new THREE.Mesh(geometry, sideMaterial);
            mesh.position.set(xPos, hCenterY, zPos);
            mesh.userData = {
                profileId: profile.id,
                horizonName: horizon.name,
                depth: `${horizon.top}-${horizon.bottom} cm`,
                clay: horizon.clay,
                sand: horizon.sand,
                ph: horizon.ph,
                texture: horizon.texture,
                baseColor: threeColor.getHex()
            };

            profileGroup.add(mesh);
            raycastObjects.push(mesh);

            // Add fine edge line outlining the hexagonal horizons
            const edges = new THREE.EdgesGeometry(geometry, 25);
            const lineMat = new THREE.LineBasicMaterial({
                color: 0x222222,
                linewidth: 1,
                transparent: true,
                opacity: 0.4
            });
            const line = new THREE.LineSegments(edges, lineMat);
            line.position.copy(mesh.position);
            profileGroup.add(line);

            // If top horizon (surface), add a decorative hexagonal organic cap plate
            if (hIdx === 0 && horizon.top === 0) {
                const capGeo = new THREE.CylinderGeometry(hexRadius + 0.8, hexRadius + 0.8, 1.4, 6);
                const capMat = new THREE.MeshStandardMaterial({
                    color: new THREE.Color(0x3e5932), // rich organic surface vegetation hue
                    roughness: 0.95,
                    metalness: 0.0
                });
                const capMesh = new THREE.Mesh(capGeo, capMat);
                capMesh.position.set(xPos, baseElevation + 0.7, zPos);
                profileGroup.add(capMesh);

                const capEdges = new THREE.EdgesGeometry(capGeo, 25);
                const capLine = new THREE.LineSegments(capEdges, lineMat);
                capLine.position.copy(capMesh.position);
                profileGroup.add(capLine);
            }
        });

        // Add hexagonal pedestal platform for realistic soil pit display feel
        const baseHeight = 3.5;
        const baseGeo = new THREE.CylinderGeometry(hexRadius + 2.5, hexRadius + 3.2, baseHeight, 6);
        const baseMat = new THREE.MeshStandardMaterial({
            color: new THREE.Color(0x2d3748),
            roughness: 0.7,
            metalness: 0.1
        });
        const baseMesh = new THREE.Mesh(baseGeo, baseMat);
        const profileBottom = profile.horizons.length > 0 ? profile.horizons[profile.horizons.length - 1].bottom : maxProfileDepth;
        baseMesh.position.set(xPos, baseElevation - profileBottom - baseHeight / 2, zPos);
        profileGroup.add(baseMesh);

        const baseEdges = new THREE.EdgesGeometry(baseGeo, 25);
        const baseLineMat = new THREE.LineBasicMaterial({
            color: 0x111111,
            transparent: true,
            opacity: 0.45
        });
        const baseLine = new THREE.LineSegments(baseEdges, baseLineMat);
        baseLine.position.copy(baseMesh.position);
        profileGroup.add(baseLine);
    });

    // Center the group vertically in view
    profileGroup.position.y = maxProfileDepth / 2 - 10;
    scene.add(profileGroup);

    // Tooltip logic for 3D
    const tooltip = document.createElement('div');
    tooltip.style.position = 'absolute';
    tooltip.style.backgroundColor = 'rgba(23, 32, 42, 0.92)';
    tooltip.style.color = '#ffffff';
    tooltip.style.padding = '8px 12px';
    tooltip.style.borderRadius = '5px';
    tooltip.style.pointerEvents = 'none';
    tooltip.style.opacity = '0';
    tooltip.style.transition = 'opacity 0.15s ease-out';
    tooltip.style.fontSize = '12px';
    tooltip.style.lineHeight = '1.4';
    tooltip.style.boxShadow = '0 4px 12px rgba(0,0,0,0.2)';
    tooltip.style.fontFamily = '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
    container.style.position = 'relative';
    container.appendChild(tooltip);

    const raycaster = new THREE.Raycaster();
    const mouse = new THREE.Vector2();
    let currentHoveredMesh: ThreeNamespace.Mesh | null = null;

    // Smooth Orbit & Drag Rotation Controls
    let isDragging = false;
    let prevMouseX = 0;
    let prevMouseY = 0;
    let targetRotationY = 0;
    let targetRotationX = 0.1;
    let currentRotationY = 0;
    let currentRotationX = 0.1;

    const onMouseDown = (e: MouseEvent) => {
        isDragging = true;
        prevMouseX = e.clientX;
        prevMouseY = e.clientY;
        container.style.cursor = 'grabbing';
    };

    const onMouseUp = () => {
        isDragging = false;
        container.style.cursor = 'grab';
    };

    const onMouseMove = (e: MouseEvent) => {
        const rect = renderer.domElement.getBoundingClientRect();

        if (isDragging) {
            const deltaX = e.clientX - prevMouseX;
            const deltaY = e.clientY - prevMouseY;
            targetRotationY += deltaX * 0.008;
            targetRotationX += deltaY * 0.005;
            targetRotationX = Math.max(-0.4, Math.min(0.6, targetRotationX));
            prevMouseX = e.clientX;
            prevMouseY = e.clientY;
        }

        // Raycasting for horizon detection and tooltips
        mouse.x = ((e.clientX - rect.left) / width) * 2 - 1;
        mouse.y = - ((e.clientY - rect.top) / height) * 2 + 1;

        raycaster.setFromCamera(mouse, camera);
        const intersects = raycaster.intersectObjects(raycastObjects);

        if (intersects.length > 0) {
            const intersect = intersects[0];
            const hitMesh = intersect.object as ThreeNamespace.Mesh;
            const data = hitMesh.userData;

            if (currentHoveredMesh !== hitMesh) {
                if (currentHoveredMesh) {
                    const prevMat = currentHoveredMesh.material as ThreeNamespace.MeshStandardMaterial;
                    prevMat.emissive?.setHex(0x000000);
                }
                currentHoveredMesh = hitMesh;
                const mat = hitMesh.material as ThreeNamespace.MeshStandardMaterial;
                mat.emissive?.setHex(0x333333);
            }

            const items: { label: string; value: string }[] = [
                { label: 'Profile', value: data.profileId },
                { label: 'Horizon', value: data.horizonName },
                { label: 'Depth', value: data.depth }
            ];

            if (data.clay !== undefined) items.push({ label: 'Clay', value: `${data.clay}%` });
            if (data.sand !== undefined) items.push({ label: 'Sand', value: `${data.sand}%` });
            if (data.ph !== undefined) items.push({ label: 'pH', value: `${data.ph}` });

            setTooltipContent(tooltip, items);
            tooltip.style.left = (e.clientX - rect.left + 15) + 'px';
            tooltip.style.top = (e.clientY - rect.top + 15) + 'px';
            tooltip.style.opacity = '1';
        } else {
            if (currentHoveredMesh) {
                const prevMat = currentHoveredMesh.material as ThreeNamespace.MeshStandardMaterial;
                prevMat.emissive?.setHex(0x000000);
                currentHoveredMesh = null;
            }
            tooltip.style.opacity = '0';
        }
    };

    const onMouseLeave = () => {
        isDragging = false;
        container.style.cursor = 'grab';
        if (currentHoveredMesh) {
            const prevMat = currentHoveredMesh.material as ThreeNamespace.MeshStandardMaterial;
            prevMat.emissive?.setHex(0x000000);
            currentHoveredMesh = null;
        }
        tooltip.style.opacity = '0';
    };

    if (options.interactive) {
        container.style.cursor = 'grab';
        renderer.domElement.addEventListener('mousedown', onMouseDown);
        window.addEventListener('mouseup', onMouseUp);
        renderer.domElement.addEventListener('mousemove', onMouseMove);
        renderer.domElement.addEventListener('mouseleave', onMouseLeave);
    }

    camera.lookAt(scene.position);

    let animationFrameId: number | undefined;
    let disposed = false;

    function animate(): void {
        if (disposed) return;

        animationFrameId = requestAnimationFrame(animate);

        // Smooth rotation interpolation
        if (options.interactive) {
            if (!isDragging) {
                targetRotationY += 0.002; // slow gentle idle rotation
            }
            currentRotationY += (targetRotationY - currentRotationY) * 0.08;
            currentRotationX += (targetRotationX - currentRotationX) * 0.08;
            profileGroup.rotation.y = currentRotationY;
            profileGroup.rotation.x = currentRotationX;
        } else {
            profileGroup.rotation.y += 0.005;
        }

        renderer.render(scene, camera);
    }

    const cleanup: Render3DCleanup = () => {
        if (disposed) return;
        disposed = true;

        if (animationFrameId !== undefined) {
            cancelAnimationFrame(animationFrameId);
        }

        if (options.interactive) {
            renderer.domElement.removeEventListener('mousedown', onMouseDown);
            window.removeEventListener('mouseup', onMouseUp);
            renderer.domElement.removeEventListener('mousemove', onMouseMove);
            renderer.domElement.removeEventListener('mouseleave', onMouseLeave);
        }

        profileGroup.traverse(object => {
            const mesh = object as ThreeNamespace.Mesh;
            if (mesh.geometry) {
                mesh.geometry.dispose();
            }
            if (Array.isArray(mesh.material)) {
                mesh.material.forEach((material: ThreeNamespace.Material) => material.dispose());
            } else if (mesh.material) {
                (mesh.material as ThreeNamespace.Material).dispose();
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