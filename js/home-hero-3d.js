import * as THREE from '../libs/three/three.module.js';
import { GLTFLoader } from '../libs/three/GLTFLoader.js';

(function () {
    var canvas = document.getElementById('homeHero3dCanvas');
    var holder = document.querySelector('.home-hero-3d-scene');
    if (!canvas || !holder) {
        document.documentElement.classList.add('home-hero-3d-fallback');
        return;
    }

    var reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    var renderer;
    try {
        renderer = new THREE.WebGLRenderer({
            canvas: canvas,
            antialias: true,
            alpha: true,
            powerPreference: 'high-performance'
        });
    } catch (error) {
        document.documentElement.classList.add('home-hero-3d-fallback');
        return;
    }

    var scene = new THREE.Scene();
    scene.background = new THREE.Color(0x01030a);
    scene.fog = new THREE.FogExp2(0x01030a, 0.022);

    var camera = new THREE.PerspectiveCamera(38, 1, 0.01, 260);
    camera.position.set(0.2, 3.2, 20);

    renderer.setClearColor(0x01030a, 1);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.65));
    renderer.outputEncoding = THREE.sRGBEncoding;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 0.92;

    var ambient = new THREE.AmbientLight(0xb7c3d8, 0.38);
    scene.add(ambient);

    var sunLight = new THREE.PointLight(0xffd6a0, 5.6, 80, 1.4);
    sunLight.position.set(7.6, 1.2, -6.2);
    scene.add(sunLight);

    var rimLight = new THREE.DirectionalLight(0x9cb8ff, 0.45);
    rimLight.position.set(-8, 5, 9);
    scene.add(rimLight);

    var modelRoot = new THREE.Group();
    modelRoot.rotation.x = -0.34;
    modelRoot.rotation.y = -0.18;
    modelRoot.rotation.z = -0.08;
    modelRoot.scale.setScalar(1.16);
    scene.add(modelRoot);

    var mixer = null;
    var loadedModel = null;
    var orbitBodies = [];
    var planetTiming = {
        Mercury: { phase: 0.56, orbitSpeed: 0.58, spinSpeed: 1.6 },
        Venus: { phase: 0.66, orbitSpeed: 0.42, spinSpeed: 1.15 },
        Earth: { phase: 0.58, orbitSpeed: 0.32, spinSpeed: 1.0 },
        Mars: { phase: 0.62, orbitSpeed: 0.25, spinSpeed: 0.9 },
        Jupiter: { phase: 0.58, orbitSpeed: 0.16, spinSpeed: 1.2 },
        Saturn: { phase: 0.52, orbitSpeed: 0.12, spinSpeed: 1.0 },
        Uranus: { phase: 0.68, orbitSpeed: 0.09, spinSpeed: 0.72 },
        Neptune: { phase: 0.62, orbitSpeed: 0.075, spinSpeed: 0.62 },
        Sun: { phase: 0.12, spinSpeed: 0.18 }
    };

    function configureObject(object) {
        function materialTone(name, hasMap) {
            if (hasMap) {
                return 0xffffff;
            }
            if (/Earth/i.test(name)) {
                return 0x4d9fda;
            }
            if (/Mars/i.test(name)) {
                return 0xc86a4c;
            }
            if (/Mercury/i.test(name)) {
                return 0xb8b1a5;
            }
            if (/Venus|Saturn/i.test(name)) {
                return 0xd9b27a;
            }
            if (/Uranus/i.test(name)) {
                return 0x82d7df;
            }
            if (/Neptune/i.test(name)) {
                return 0x557ed8;
            }
            return 0xffffff;
        }

        function makeVisibleMaterial(source, meshName, isSun, isSpace) {
            var hasMap = Boolean(source.map);
            var material = new THREE.MeshBasicMaterial({
                map: hasMap ? source.map : null,
                alphaMap: source.alphaMap || null,
                color: isSpace ? 0x5f6470 : materialTone(meshName + ' ' + source.name, hasMap),
                transparent: source.transparent || Boolean(source.alphaMap),
                opacity: source.opacity === undefined ? 1 : source.opacity,
                side: isSpace ? THREE.BackSide : source.side,
                depthWrite: !isSpace
            });
            if (isSun) {
                material.color.set(0xffffff);
                material.depthWrite = true;
            }
            if (material.map && THREE.sRGBEncoding) {
                material.map.encoding = THREE.sRGBEncoding;
                material.map.anisotropy = renderer.capabilities.getMaxAnisotropy();
            }
            return material;
        }

        object.traverse(function (child) {
            if (child.isCamera || /CameraPath|Camera/i.test(child.name)) {
                child.visible = false;
                return;
            }

            if (!child.isMesh || !child.material) {
                return;
            }

            child.frustumCulled = false;
            var materials = Array.isArray(child.material) ? child.material : [child.material];
            var isSun = /Sun/i.test(child.name);
            var materialNames = materials.map(function (material) {
                return material.name || '';
            }).join(' ');
            var isSpacePlane = /Plane001|Space_Plane|Plane\.001/i.test(child.name + ' ' + materialNames);
            var isSpace = /Space|Sphere/i.test(child.name + ' ' + materialNames);
            if (isSpacePlane) {
                child.visible = false;
                return;
            }
            if (isSun) {
                child.scale.setScalar(4.15);
                child.renderOrder = 5;
            }
            var visibleMaterials = materials.map(function (material) {
                return makeVisibleMaterial(material, child.name, isSun, isSpace);
            });
            child.material = Array.isArray(child.material) ? visibleMaterials : visibleMaterials[0];
        });
    }

    function placeModel(object) {
        var sun = object.getObjectByName('Sun');
        if (!sun) {
            return;
        }
        object.position.set(0, 0, 0);
        modelRoot.updateMatrixWorld(true);
        var currentWorld = sun.getWorldPosition(new THREE.Vector3());
        var targetWorld = new THREE.Vector3(13.6, -0.85, -6.8);
        var currentLocal = modelRoot.worldToLocal(currentWorld.clone());
        var targetLocal = modelRoot.worldToLocal(targetWorld.clone());
        object.position.add(targetLocal.sub(currentLocal));
        modelRoot.updateMatrixWorld(true);
    }

    function timingForClip(clip) {
        var planetName = Object.keys(planetTiming).find(function (name) {
            return clip.name.indexOf(name + '|') === 0;
        });
        return planetName ? planetTiming[planetName] : { phase: 0, speed: 0.24 };
    }

    function setupModelAnimations(gltf) {
        mixer = new THREE.AnimationMixer(loadedModel);
        orbitBodies = [];
        gltf.animations.forEach(function (clip) {
            var timing = timingForClip(clip);
            var tracks = clip.tracks.filter(function (track) {
                return track.name.indexOf('.position') === -1;
            });
            if (!tracks.length) {
                return;
            }
            var spinClip = new THREE.AnimationClip(clip.name + '.spin', clip.duration, tracks);
            var action = mixer.clipAction(spinClip);
            action.reset();
            action.setLoop(THREE.LoopRepeat, Infinity);
            action.clampWhenFinished = false;
            action.enabled = true;
            action.setEffectiveTimeScale(timing.spinSpeed || 1);
            action.setEffectiveWeight(1);
            action.play();
            action.time = (clip.duration || 1) * (timing.phase || 0);
        });
        mixer.update(0);

        Object.keys(planetTiming).forEach(function (name) {
            if (name === 'Sun') {
                return;
            }
            var body = loadedModel.getObjectByName(name);
            var timing = planetTiming[name];
            if (!body || !timing) {
                return;
            }
            var radius = Math.sqrt(body.position.x * body.position.x + body.position.z * body.position.z);
            orbitBodies.push({
                body: body,
                radius: radius,
                baseY: body.position.y,
                phase: timing.phase,
                speed: timing.orbitSpeed,
                xScale: 0.78,
                yScale: 0.035
            });
        });
    }

    function updateOrbits(elapsed) {
        orbitBodies.forEach(function (item) {
            var angle = item.phase * Math.PI * 2 + elapsed * item.speed;
            item.body.position.x = Math.sin(angle) * item.radius * item.xScale;
            item.body.position.z = Math.cos(angle) * item.radius;
            item.body.position.y = item.baseY + Math.sin(angle + Math.PI * 0.18) * item.radius * item.yScale;
        });
    }

    function resize() {
        var width = holder.clientWidth || window.innerWidth;
        var height = holder.clientHeight || window.innerHeight;
        camera.aspect = width / Math.max(height, 1);
        camera.updateProjectionMatrix();
        renderer.setSize(width, height, false);

        if (width < 620) {
            camera.position.set(0.1, 3.4, 22.5);
            modelRoot.scale.setScalar(1.34);
            modelRoot.rotation.x = -0.4;
            modelRoot.rotation.y = -0.2;
        } else {
            camera.position.set(0.2, 3.2, 20);
            modelRoot.scale.setScalar(1.16);
            modelRoot.rotation.x = -0.34;
            modelRoot.rotation.y = -0.18;
        }
        if (loadedModel) {
            placeModel(loadedModel);
        }
    }

    window.addEventListener('resize', resize);
    resize();

    var loader = new GLTFLoader();
    loader.load('/medias/solar/solar_system_360.glb', function (gltf) {
        loadedModel = gltf.scene;
        configureObject(loadedModel);
        modelRoot.add(loadedModel);
        placeModel(loadedModel);
        setupModelAnimations(gltf);

        document.documentElement.classList.add('home-hero-3d-ready');
    }, undefined, function () {
        document.documentElement.classList.add('home-hero-3d-fallback');
    });

    var clock = new THREE.Clock();
    function draw() {
        var delta = Math.min(clock.getDelta(), 0.035);
        var elapsed = clock.elapsedTime;
        camera.lookAt(1.0, -0.15, -5.5);

        if (mixer && !reduceMotion) {
            mixer.update(delta);
            updateOrbits(elapsed);
        } else if (mixer) {
            updateOrbits(0);
        }
        modelRoot.rotation.z = -0.08;

        renderer.render(scene, camera);
        window.requestAnimationFrame(draw);
    }
    draw();
}());
