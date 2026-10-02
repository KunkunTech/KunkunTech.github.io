import * as THREE from '../libs/three/three.module.js';
import { GLTFLoader } from '../libs/three/GLTFLoader.js';

// NASA/VTAD meshes and textures; provenance in medias/solar/nasa/sources.json.
// Distances/sizes/time are art-directed, not a real-time ephemeris.
const planets = [
    {
        name: 'mercury',
        radius: 0.42,
        orbit: 34,
        phase: -1.8,
        tilt: 0.034,
        day: 1407.6,
        year: 88
    },
    {
        name: 'venus',
        radius: 0.85,
        orbit: 41,
        phase: -3.5,
        tilt: 177.4,
        day: 5832.5,
        year: 224.7
    },
    {
        name: 'earth',
        radius: 1.25,
        orbit: 49,
        phase: -2.85,
        tilt: 23.4,
        day: 23.9,
        year: 365.3
    },
    {
        name: 'mars',
        radius: 0.67,
        orbit: 58,
        phase: -3.8,
        tilt: 25.2,
        day: 24.6,
        year: 687
    },
    {
        name: 'jupiter',
        radius: 4.25,
        orbit: 74,
        phase: -2.9,
        tilt: 3.1,
        day: 9.9,
        year: 4331
    },
    {
        name: 'saturn',
        radius: 3.3,
        orbit: 91,
        phase: -2.65,
        tilt: 26.7,
        day: 10.7,
        year: 10747
    },
    {
        name: 'uranus',
        radius: 1.85,
        orbit: 110,
        phase: -3.7,
        tilt: 97.8,
        day: 17.2,
        year: 30589
    },
    {
        name: 'neptune',
        radius: 1.8,
        orbit: 128,
        phase: -4.15,
        tilt: 28.3,
        day: 16.1,
        year: 59800
    }
];
const canvas = document.getElementById('homeHero3dCanvas');
const holder = document.querySelector('.home-hero-3d-scene');
const button = document.querySelector('.solar-motion');
const root = document.documentElement;
const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
const assetURL = (name) =>
    new URL(`../medias/solar/nasa/${name}.glb`, import.meta.url).href;

function init() {
    if (!canvas || !holder || navigator.connection?.saveData) return;
    let renderer;
    try {
        renderer = new THREE.WebGLRenderer({
            canvas,
            alpha: true,
            antialias: true,
            powerPreference: 'default'
        });
    } catch (_) {
        root.classList.add('home-hero-3d-fallback');
        return;
    }
    renderer.outputEncoding = THREE.sRGBEncoding;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.1;
    renderer.setClearColor(0x020407, 1);
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(25, 1, 0.5, 900);
    camera.position.set(0, 0, 140);
    const system = new THREE.Group();
    scene.add(system);
    const sunPosition = new THREE.Vector3(42, 15, -10),
        sunRadius = 31;
    const sunAnchor = new THREE.Group();
    sunAnchor.position.copy(sunPosition);
    system.add(sunAnchor);
    const light = new THREE.PointLight(0xfff1dc, 2.7, 0, 0);
    light.position.copy(sunPosition);
    system.add(light, new THREE.AmbientLight(0x98b7e5, 0.09));
    const fill = new THREE.DirectionalLight(0xabcaff, 0.15);
    fill.position.set(-50, 20, 100);
    scene.add(fill);
    const time = { value: 0 },
        bodies = [],
        loader = new GLTFLoader();
    let sunModel,
        elapsed = 0,
        last = 0,
        frame = 0,
        visible = true;
    let paused = motion.matches,
        lost = false,
        disposed = false,
        mobile = false;
    let loaded = 0,
        failureCount = 0,
        ready = false;
    const pointer = new THREE.Vector2();
    const orbitalPlane = new THREE.Quaternion().setFromEuler(
        new THREE.Euler(0.4, 0, 0.18, 'ZXY')
    );
    const vertex = `varying vec2 vUv; varying vec3 vNormal; varying vec3 vView; varying vec3 vLocal;
        void main(){vUv=uv; vLocal=normalize(position); vec4 p=modelViewMatrix*vec4(position,1.);
        vNormal=normalize(normalMatrix*normal); vView=normalize(-p.xyz); gl_Position=projectionMatrix*p;}`;
    const noise = `
        float hash(vec3 p){p=fract(p*.3183099+.1);p*=17.;return fract(p.x*p.y*p.z*(p.x+p.y+p.z));}
        float noise3(vec3 x){vec3 i=floor(x),f=fract(x);f=f*f*(3.-2.*f);
        return mix(mix(mix(hash(i),hash(i+vec3(1,0,0)),f.x),mix(hash(i+vec3(0,1,0)),hash(i+vec3(1,1,0)),f.x),f.y),
        mix(mix(hash(i+vec3(0,0,1)),hash(i+vec3(1,0,1)),f.x),mix(hash(i+vec3(0,1,1)),hash(i+vec3(1,1,1)),f.x),f.y),f.z);}`;
    function sunMaterial(map) {
        return new THREE.ShaderMaterial({
            uniforms: { surface: { value: map }, time },
            vertexShader: vertex,
            fragmentShader: `uniform sampler2D surface;uniform float time;
            varying vec2 vUv;varying vec3 vNormal;varying vec3 vView;varying vec3 vLocal;
            ${noise}
            void main(){
                float flow=noise3(vLocal*18.+vec3(0.,time*.12,time*.08));
                vec2 warp=vec2(sin(flow*6.28+time*.12),cos(flow*6.28-time*.1))*.0012;
                vec3 tex=texture2D(surface,vUv+warp).rgb;
                float heat=clamp(pow(tex.g,1.6)*.82+flow*.16,0.,1.);
                vec3 color=mix(vec3(.18,.002,.0002),vec3(1.45,.075,.002),smoothstep(.08,.55,heat));
                color=mix(color,vec3(2.5,.65,.025),smoothstep(.44,.88,heat));
                color=mix(color,vec3(3.1,1.25,.14),smoothstep(.85,1.,heat));
                float edge=pow(1.-max(dot(normalize(vNormal),normalize(vView)),0.),3.);
                color*=1.-edge*.34; color+=vec3(.8,.14,.004)*pow(edge,4.);
                gl_FragColor=vec4(color,1.);
                #include <tonemapping_fragment>
                #include <encodings_fragment>
            }`
        });
    }
    // Corona follows the physical solar limb; it is not a decorative background blob.
    const corona = new THREE.Mesh(
        new THREE.PlaneGeometry(1, 1),
        new THREE.ShaderMaterial({
            uniforms: { time, limb: { value: 0.365 } },
            transparent: true,
            depthWrite: false,
            blending: THREE.AdditiveBlending,
            vertexShader:
                'varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
            fragmentShader: `uniform float time;uniform float limb;varying vec2 vUv;
        void main(){vec2 p=vUv-.5;float r=length(p),a=atan(p.y,p.x),d=max(r-limb,0.);
        float rays=sin(a*47.+sin(a*13.+time*.23)*1.7)*.5+.5;
        float wisps=sin(a*123.-time*.17+sin(d*140.))*.5+.5;
        float glow=exp(-d*90.)*.9+exp(-d*23.)*.12;
        glow*=smoothstep(limb-.005,limb+.003,r)*(1.-smoothstep(.43,.5,r));
        glow*=.65+rays*.28+wisps*.22;gl_FragColor=vec4(vec3(1.,.32,.045)*glow,glow*.82);}`
        })
    );
    sunAnchor.add(corona);
    corona.visible = false;
    const flares = new THREE.Group();
    sunAnchor.add(flares);
    for (let i = 0; i < 9; i++) {
        const points = [],
            angle = 1.8 + i * 0.35;
        for (let j = 0; j <= 40; j++) {
            const t = j / 40,
                a = angle + (t - 0.5) * 0.13,
                r =
                    sunRadius *
                    (1 + Math.sin(t * Math.PI) * (0.055 + (i % 3) * 0.013));
            points.push(
                new THREE.Vector3(Math.cos(a) * r, Math.sin(a) * r, 0.4)
            );
        }
        flares.add(
            new THREE.Mesh(
                new THREE.TubeGeometry(
                    new THREE.CatmullRomCurve3(points),
                    40,
                    0.035,
                    4,
                    false
                ),
                new THREE.MeshBasicMaterial({
                    color: 0xff6316,
                    transparent: true,
                    opacity: 0.65,
                    blending: THREE.AdditiveBlending,
                    depthWrite: false,
                    toneMapped: false
                })
            )
        );
    }
    flares.visible = false;
    let seed = 721;
    const random = () => {
        seed = (seed * 1664525 + 1013904223) >>> 0;
        return seed / 4294967296;
    };
    const positions = [],
        colors = [];
    for (let i = 0; i < 1600; i++) {
        positions.push(
            (random() - 0.5) * 530,
            (random() - 0.5) * 300,
            -160 - random() * 220
        );
        const c = new THREE.Color(
            i % 7 === 0 ? 0xffd6af : i % 3 === 0 ? 0x90bcd8 : 0xe4e9ef
        ).multiplyScalar(0.22 + Math.pow(random(), 4) * 0.7);
        colors.push(c.r, c.g, c.b);
    }
    const starGeometry = new THREE.BufferGeometry();
    starGeometry.setAttribute(
        'position',
        new THREE.Float32BufferAttribute(positions, 3)
    );
    starGeometry.setAttribute(
        'color',
        new THREE.Float32BufferAttribute(colors, 3)
    );
    const stars = new THREE.Points(
        starGeometry,
        new THREE.PointsMaterial({
            size: 0.34,
            vertexColors: true,
            transparent: true,
            opacity: 0.8,
            depthWrite: false
        })
    );
    scene.add(stars);
    function atmosphere(radius) {
        return new THREE.Mesh(
            new THREE.SphereGeometry(radius * 1.025, 48, 24),
            new THREE.ShaderMaterial({
                transparent: true,
                depthWrite: false,
                blending: THREE.AdditiveBlending,
                vertexShader: vertex,
                fragmentShader: `varying vec3 vNormal;varying vec3 vView;
            void main(){float f=pow(1.-abs(dot(normalize(vNormal),normalize(vView))),4.);gl_FragColor=vec4(vec3(.12,.48,1.)*f,f*.58);}`
            })
        );
    }
    async function loadBody(name, spec) {
        try {
            const gltf = await loader.loadAsync(
                assetURL(name === 'sun' ? 'sun-preview' : name)
            );
            if (disposed) return;
            const model = gltf.scene;
            const globe =
                model.children.find(
                    (child) => child.isMesh && !/ring/i.test(child.name)
                ) || model;
            const box = new THREE.Box3().setFromObject(globe),
                size = box.getSize(new THREE.Vector3());
            const wrapper = new THREE.Group();
            wrapper.scale.setScalar(
                ((spec ? spec.radius : sunRadius) * 2) /
                    Math.max(size.x, size.y, size.z)
            );
            wrapper.add(model);
            model.position.sub(box.getCenter(new THREE.Vector3()));
            model.traverse((mesh) => {
                if (!mesh.isMesh) return;
                const materials = Array.isArray(mesh.material)
                    ? mesh.material
                    : [mesh.material];
                materials.forEach((material) => {
                    for (const map of [material.map, material.emissiveMap])
                        if (map)
                            map.anisotropy = Math.min(
                                4,
                                renderer.capabilities.getMaxAnisotropy()
                            );
                    if (name !== 'sun') {
                        material.metalness = 0;
                        material.roughness = 0.88;
                        material.emissive?.set(0);
                    }
                });
                if (name === 'sun')
                    mesh.material = sunMaterial(
                        materials[0].emissiveMap || materials[0].map
                    );
            });
            if (!spec) {
                sunModel = wrapper;
                sunAnchor.add(wrapper);
                corona.visible = flares.visible = true;
            } else {
                const anchor = new THREE.Group(),
                    axis = new THREE.Group();
                axis.quaternion.copy(orbitalPlane);
                // >90 degree obliquity already encodes retrograde spin. Do not reverse twice.
                axis.rotateZ(THREE.MathUtils.degToRad(spec.tilt));
                axis.add(wrapper);
                anchor.add(axis);
                if (name === 'earth') anchor.add(atmosphere(spec.radius));
                system.add(anchor);
                bodies.push({ ...spec, anchor, wrapper });
            }
            loaded++;
            holder.dataset.models = String(loaded);
            renderStill();
            if (sunModel && bodies.some((b) => b.name === 'earth')) {
                ready = true;
                root.classList.add('home-hero-3d-ready');
                if (!performance.getEntriesByName('solar-ready').length)
                    performance.mark('solar-ready');
            }
            schedule();
        } catch (error) {
            failureCount++;
            holder.dataset.failures = String(failureCount);
            console.warn(`Solar model unavailable: ${name}`, error);
            if (name === 'sun' || name === 'earth')
                root.classList.add('home-hero-3d-fallback');
        }
    }
    function update() {
        time.value = elapsed;
        for (const b of bodies) {
            const phase =
                mobile && b.name === 'jupiter'
                    ? -2.3
                    : mobile && b.name === 'saturn'
                      ? -1.95
                      : b.phase;
            const a = phase + elapsed * 0.065 * Math.pow(88 / b.year, 0.45);
            b.anchor.position
                .set(b.orbit * Math.cos(a), 0, -b.orbit * Math.sin(a))
                .applyQuaternion(orbitalPlane)
                .add(sunPosition);
            b.wrapper.rotation.y = elapsed * 0.18 * Math.pow(24 / b.day, 0.35);
        }
        if (sunModel) sunModel.rotation.y = elapsed * 0.014;
        stars.rotation.y = elapsed * 0.0006 + pointer.x * 0.002;
        stars.rotation.x = pointer.y * 0.001;
        flares.children.forEach((arc, i) => {
            arc.material.opacity = 0.4 + 0.25 * Math.sin(elapsed * 0.35 + i);
        });
        scene.updateMatrixWorld(true);
        const distance = camera.position.distanceTo(
            sunAnchor.getWorldPosition(new THREE.Vector3())
        );
        const radius = sunRadius * system.scale.x;
        corona.scale.setScalar(
            ((radius / Math.sqrt(1 - (radius / distance) ** 2)) * 2.74) /
                system.scale.x
        );
        corona.lookAt(camera.position);
        flares.quaternion.copy(corona.quaternion);
    }
    function renderStill() {
        if (disposed || lost || !visible || document.hidden) return;
        update();
        renderer.render(scene, camera);
    }
    function tick(now) {
        frame = 0;
        if (disposed || lost || !visible || document.hidden || paused) return;
        elapsed += last ? Math.min((now - last) / 1000, 0.08) : 0;
        last = now;
        renderStill();
        schedule();
    }
    function schedule() {
        if (
            !frame &&
            !paused &&
            visible &&
            !document.hidden &&
            !lost &&
            !disposed
        )
            frame = requestAnimationFrame(tick);
    }
    function stop() {
        cancelAnimationFrame(frame);
        frame = 0;
        last = 0;
    }
    function resize() {
        const width = holder.clientWidth,
            height = holder.clientHeight;
        if (!width || !height) return;
        mobile = width < 700;
        renderer.setPixelRatio(
            Math.min(window.devicePixelRatio || 1, mobile ? 1.25 : 1.6)
        );
        renderer.setSize(width, height, false);
        camera.aspect = width / height;
        camera.updateProjectionMatrix();
        const short = mobile && height < 650;
        system.scale.setScalar(mobile ? (short ? 0.42 : 0.48) : 1);
        const halfWidth =
            150 *
            Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) *
            camera.aspect;
        system.position.set(
            mobile ? -7 : halfWidth * 0.98 - sunPosition.x,
            mobile ? (short ? 16 : 10) : 0,
            0
        );
        renderStill();
    }
    function setPaused(value) {
        paused = value;
        button?.setAttribute('aria-pressed', String(!paused));
        button?.setAttribute(
            'aria-label',
            paused ? '播放太阳系动画' : '暂停太阳系动画'
        );
        if (button) {
            button.title = paused ? '播放动画' : '暂停动画';
            button.querySelector('i').className =
                `fas fa-${paused ? 'play' : 'pause'}`;
        }
        stop();
        renderStill();
        schedule();
    }
    button?.addEventListener('click', () => setPaused(!paused));
    motion.addEventListener('change', (e) => setPaused(e.matches));
    const observer = new IntersectionObserver(
        (entries) => {
            visible = entries[0].isIntersecting;
            stop();
            if (visible) {
                renderStill();
                schedule();
            }
        },
        { threshold: 0 }
    );
    observer.observe(holder);
    document.addEventListener('visibilitychange', () => {
        stop();
        if (!document.hidden) {
            renderStill();
            schedule();
        }
    });
    window.addEventListener('resize', resize, { passive: true });
    holder.parentElement.addEventListener(
        'pointermove',
        (e) => {
            if (!paused && e.pointerType === 'mouse')
                pointer.set(
                    e.clientX / window.innerWidth - 0.5,
                    e.clientY / window.innerHeight - 0.5
                );
        },
        { passive: true }
    );
    canvas.addEventListener('webglcontextlost', (e) => {
        e.preventDefault();
        lost = true;
        stop();
        root.classList.remove('home-hero-3d-ready');
        root.classList.add('home-hero-3d-fallback');
    });
    canvas.addEventListener('webglcontextrestored', () => {
        lost = false;
        root.classList.remove('home-hero-3d-fallback');
        if (ready) root.classList.add('home-hero-3d-ready');
        renderStill();
        schedule();
    });
    window.addEventListener('pagehide', (e) => {
        stop();
        if (!e.persisted) {
            disposed = true;
            observer.disconnect();
            scene.traverse((obj) => {
                obj.geometry?.dispose();
                for (const m of obj.material
                    ? Array.isArray(obj.material)
                        ? obj.material
                        : [obj.material]
                    : []) {
                    for (const value of Object.values(m))
                        if (value?.isTexture) value.dispose();
                    m.dispose();
                }
            });
            renderer.dispose();
        }
    });
    window.addEventListener('pageshow', () => {
        last = 0;
        schedule();
    });
    resize();
    setPaused(paused);
    // The first solar texture is small. Upgrade its map without rebuilding the scene.
    async function upgradeSun() {
        try {
            const detail = await loader.loadAsync(assetURL('sun'));
            let map;
            detail.scene.traverse((mesh) => {
                if (!mesh.isMesh) return;
                map = mesh.material.emissiveMap || mesh.material.map || map;
                mesh.geometry.dispose();
                mesh.material.dispose();
            });
            if (!map) return;
            if (disposed) {
                map.dispose();
                return;
            }
            map.anisotropy = Math.min(
                4,
                renderer.capabilities.getMaxAnisotropy()
            );
            sunModel.traverse((mesh) => {
                if (!mesh.isMesh) return;
                mesh.material.uniforms.surface.value.dispose();
                mesh.material.uniforms.surface.value = map;
            });
            holder.dataset.detail = 'ready';
            renderStill();
        } catch (_) {
            // The low-bandwidth solar model remains fully usable if detail fails.
            holder.dataset.detail = 'fallback';
        }
    }
    async function loadLane(names) {
        for (const name of names)
            await loadBody(
                name,
                planets.find((b) => b.name === name)
            );
    }
    async function bootstrap() {
        await Promise.all([
            loadBody('sun'),
            loadBody(
                'earth',
                planets.find((b) => b.name === 'earth')
            )
        ]);
        if (disposed) return;
        if (sunModel) upgradeSun();
        loadLane(['saturn', 'jupiter', 'mercury', 'neptune']);
        loadLane(['mars', 'venus', 'uranus']);
    }
    bootstrap();
    window.__solarHero = {
        capture: () => {
            renderer.render(scene, camera);
            return canvas.toDataURL('image/png');
        },
        snapshot: () => ({
            ready,
            loaded,
            failureCount,
            paused,
            elapsed,
            visible,
            frames: renderer.info.render.frame,
            sun: sunAnchor.getWorldPosition(new THREE.Vector3()).toArray(),
            planets: bodies.map((b) => ({
                name: b.name,
                position: b.anchor.position.toArray(),
                spin: b.wrapper.rotation.y
            }))
        })
    };
}
init();
