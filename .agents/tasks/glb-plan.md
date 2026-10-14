# Implementation Plan: Add GLB Model Support to WareWise XR

## Overview
Add Three.js GLB model loading to the existing custom WebGL1 engine and replace two box objects (oil spill and chemical drum) with real 3D models while preserving all existing gameplay, raycasting, collision, VR, and training logic.

## Architecture Decision
**Hybrid rendering approach**: The existing WebGL1 engine continues to render all boxes using its custom shader pipeline. A separate Three.js WebGLRenderer is added to render GLB models on top of the box layer, sharing the same canvas and depth information. This minimizes disruption to the proven engine while adding model capability.

## Files to Modify

### 1. warehouse-training.html
**What**: Add Three.js r165 and GLTFLoader from CDN as global UMD scripts before training-loader.js  
**Why**: Engine.js needs Three.js available as a global when it initializes the model subsystem  
**CDN URLs**:
- Three.js: `https://cdn.jsdelivr.net/npm/three@0.165.0/build/three.min.js`
- GLTFLoader: `https://cdn.jsdelivr.net/npm/three@0.165.0/examples/js/loaders/GLTFLoader.js`

**Changes**: In the `<head>` section, after the existing `<script src="js/browser-compat.js"></script>` line and before the closing `</head>` tag, add:

```html
<!-- Three.js r165 UMD build for GLB model support -->
<script src="https://cdn.jsdelivr.net/npm/three@0.165.0/build/three.min.js"></script>
<script src="https://cdn.jsdelivr.net/npm/three@0.165.0/examples/js/loaders/GLTFLoader.js"></script>
```

The existing `<script src="js/training-loader.js"></script>` at the end of `<body>` remains unchanged. training-loader.js already loads math3d.js, engine.js, training.js, and app.js sequentially, so Three.js will be available before engine.js runs.

**Verify**: Open browser console after page load and check `console.log(window.THREE)` returns an object, not undefined.

---

### 2. js/engine.js
**What**: Add Three.js renderer, GLTFLoader, model storage, `addModel()` method, hybrid render integration, raycasting for models, and color/glow updates  
**Why**: Engine must manage both box and model objects using a unified interface for training.js

#### 2.1 Constructor additions
After `this.byId=new Map();` add:

```javascript
this.models = new Map(); // id -> model object
this.threeRenderer = null;
this.threeScene = null;
this.threeCamera = null;
this.gltfLoader = null;
```

#### 2.2 init() additions
At the end of `init()`, before `return true`, add Three.js setup:

```javascript
// Three.js renderer for GLB models (hybrid rendering)
if (typeof THREE !== 'undefined') {
  try {
    this.threeRenderer = new THREE.WebGLRenderer({
      canvas: this.canvas,
      alpha: true,
      antialias: true,
      context: this.gl // Share WebGL context
    });
    this.threeRenderer.autoClear = false; // Don't clear between box and model passes
    this.threeRenderer.setSize(this.canvas.width, this.canvas.height);
    this.threeRenderer.setPixelRatio(1); // We manage DPR in resize()
    
    this.threeScene = new THREE.Scene();
    this.threeCamera = new THREE.PerspectiveCamera(60, this.canvas.width / this.canvas.height, 0.05, 100);
    
    this.gltfLoader = new THREE.GLTFLoader();
    console.log('[ENGINE] Three.js renderer initialized for GLB models');
  } catch (err) {
    console.warn('[ENGINE] Three.js init failed, models will render as boxes:', err);
    this.threeRenderer = null;
  }
}
```

#### 2.3 New addModel() method
Add after the `add()` method:

```javascript
addModel(opts) {
  const o = {
    id: opts.id || 'model' + this.models.size,
    label: opts.label || 'Model',
    position: opts.position || [0, 0, 0],
    size: opts.size || [1, 1, 1], // AABB for collision
    yaw: opts.yaw || 0,
    color: opts.color || '#888888',
    baseColor: opts.color || '#888888',
    solid: opts.solid !== undefined ? opts.solid : false,
    interactive: opts.interactive !== undefined ? opts.interactive : false,
    visible: opts.visible !== false,
    kind: opts.kind || 'prop',
    hazardWhy: opts.hazardWhy || '',
    glow: opts.glow || false,
    overlap: opts.overlap || false,
    modelPath: opts.modelPath || '',
    scale: opts.scale || [1, 1, 1],
    rotation: opts.rotation || [0, 0, 0],
    _threeGroup: null, // Will hold the loaded Three.js Group
    _loading: true
  };
  
  this.models.set(o.id, o);
  this.byId.set(o.id, o);
  this.objects.push(o); // So collision, get(), remove() work unchanged
  
  // Load the GLB
  if (this.gltfLoader && o.modelPath) {
    this.gltfLoader.load(
      o.modelPath,
      (gltf) => {
        const group = new THREE.Group();
        group.add(gltf.scene);
        group.position.set(o.position[0], o.position[1], o.position[2]);
        group.scale.set(o.scale[0], o.scale[1], o.scale[2]);
        group.rotation.set(o.rotation[0], o.rotation[1], o.rotation[2]);
        o._threeGroup = group;
        o._loading = false;
        this.threeScene.add(group);
        console.log(`[ENGINE] Model loaded: ${o.id} from ${o.modelPath}`);
      },
      undefined,
      (err) => {
        console.warn(`[ENGINE] Model load failed for ${o.id}:`, err);
        o._loading = false;
        // Fallback: render as a box in the existing pipeline (no _threeGroup)
      }
    );
  } else {
    o._loading = false;
  }
  
  return o;
}
```

#### 2.4 Update remove() to handle models
Replace the existing `remove(id)` method body:

```javascript
remove(id) {
  const o = this.get(id);
  if (!o) return;
  this.objects = this.objects.filter(x => x !== o);
  this.byId.delete(id);
  if (this.models.has(id)) {
    const model = this.models.get(id);
    if (model._threeGroup && this.threeScene) {
      this.threeScene.remove(model._threeGroup);
    }
    this.models.delete(id);
  }
}
```

#### 2.5 Update clear() to handle models
Replace the existing `clear()` method body:

```javascript
clear() {
  this.objects = [];
  this.byId.clear();
  for (const [id, model] of this.models.entries()) {
    if (model._threeGroup && this.threeScene) {
      this.threeScene.remove(model._threeGroup);
    }
  }
  this.models.clear();
  this.carried = null;
}
```

#### 2.6 Update resize() to sync Three.js renderer
Replace the `resize()` method body:

```javascript
resize() {
  const d = Math.min(devicePixelRatio || 1, 1.7),
        w = Math.max(1, innerWidth),
        h = Math.max(1, innerHeight);
  this.canvas.width = Math.round(w * d);
  this.canvas.height = Math.round(h * d);
  if (this.gl && !this.xrSession) {
    this.gl.viewport(0, 0, this.canvas.width, this.canvas.height);
  }
  if (this.threeRenderer && !this.xrSession) {
    this.threeRenderer.setSize(this.canvas.width, this.canvas.height, false);
  }
  if (this.threeCamera) {
    this.threeCamera.aspect = this.canvas.width / this.canvas.height;
    this.threeCamera.updateProjectionMatrix();
  }
}
```

#### 2.7 Raycasting integration
Replace the existing `raycast()` method body to add Three.js raycasting after box checks:

```javascript
raycast(origin, dir, maxDist = 5.8) {
  let best = null, bd = maxDist;
  
  // Check boxes first
  for (const o of this.objects) {
    if (!o.visible || !o.interactive || o === this.carried || o._threeGroup) continue; // skip models
    const hit = o.hitSize ? {...o, size: o.hitSize} : o;
    const t = M.rayAABB(origin, dir, hit, maxDist);
    if (t !== null && t < bd) {
      bd = t;
      best = o;
    }
  }
  
  // Check Three.js models
  if (this.threeRenderer && this.threeScene) {
    const raycaster = new THREE.Raycaster(
      new THREE.Vector3(origin[0], origin[1], origin[2]),
      new THREE.Vector3(dir[0], dir[1], dir[2])
    );
    raycaster.far = maxDist;
    
    const intersects = raycaster.intersectObjects(this.threeScene.children, true);
    for (const hit of intersects) {
      if (hit.distance < bd) {
        // Find the model object that owns this mesh
        let obj = hit.object;
        while (obj.parent && obj.parent !== this.threeScene) {
          obj = obj.parent;
        }
        // Match against stored models
        for (const model of this.models.values()) {
          if (model._threeGroup === obj && model.visible && model.interactive && model !== this.carried) {
            bd = hit.distance;
            best = model;
            break;
          }
        }
      }
    }
  }
  
  return best;
}
```

#### 2.8 Helper: sync Three.js camera from custom matrices
Add new helper method after `_view()`:

```javascript
_syncThreeCamera(proj, view) {
  if (!this.threeCamera) return;
  
  // Convert custom projection matrix to THREE.Matrix4
  const projMat = new THREE.Matrix4();
  projMat.fromArray(proj);
  this.threeCamera.projectionMatrix.copy(projMat);
  this.threeCamera.projectionMatrixInverse.copy(projMat).invert();
  
  // Convert custom view matrix to world transform
  const viewMat = new THREE.Matrix4();
  viewMat.fromArray(view);
  const worldMat = new THREE.Matrix4();
  worldMat.copy(viewMat).invert();
  this.threeCamera.matrix.copy(worldMat);
  this.threeCamera.matrixWorld.copy(worldMat);
  this.threeCamera.matrixWorldInverse.copy(viewMat);
}
```

#### 2.9 Helper: apply color/glow to model materials
Add new helper method after `_syncThreeCamera()`:

```javascript
_applyModelColor(model) {
  if (!model._threeGroup) return;
  
  const rgb = this._color(model.color);
  const color = new THREE.Color(rgb[0], rgb[1], rgb[2]);
  const emissive = model.glow ? new THREE.Color(0.95, 0.72, 0.08) : new THREE.Color(0, 0, 0);
  
  model._threeGroup.traverse((child) => {
    if (child.isMesh && child.material) {
      if (Array.isArray(child.material)) {
        child.material.forEach(mat => {
          mat.color.copy(color);
          mat.emissive.copy(emissive);
          mat.emissiveIntensity = model.glow ? 0.25 : 0;
        });
      } else {
        child.material.color.copy(color);
        child.material.emissive.copy(emissive);
        child.material.emissiveIntensity = model.glow ? 0.25 : 0;
      }
    }
  });
}
```

#### 2.10 Update render() to include Three.js pass
Replace the existing `render()` method body (keep the signature):

```javascript
render(proj, view, viewport) {
  const gl = this.gl;
  if (viewport) gl.viewport(viewport.x, viewport.y, viewport.width, viewport.height);
  
  gl.enable(gl.DEPTH_TEST);
  gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
  gl.useProgram(this.program);
  gl.uniformMatrix4fv(this.loc.view, false, view);
  gl.uniformMatrix4fv(this.loc.proj, false, proj);
  
  // Render boxes (existing logic unchanged)
  for (const o of this.objects) {
    if (!o.visible || o._threeGroup) continue; // skip models in box pass
    const drawSize = (o === this.carried && !this.xrSession) ? o.size.map(v => v * 0.68) : o.size;
    const model = o.matrix || M.model(o.position, drawSize, o.yaw || 0),
          c = this._color(o.color);
    gl.uniformMatrix4fv(this.loc.model, false, model);
    gl.uniform3fv(this.loc.color, c);
    gl.uniform1f(this.loc.glow, (o === this.hovered || o.glow) ? 0.25 : 0);
    gl.drawArrays(gl.TRIANGLES, 0, this.vertexCount);
  }
  
  // Hand models (existing logic)
  if (this.carried && !this.xrSession) {
    const f = this.forward(), r = M.normalize([-f[2], 0, f[0]]), p = this.camera.position;
    for (const side of [-1, 1]) {
      const hp = [p[0] + f[0] * 0.88 + r[0] * side * 0.42, p[1] - 0.52 + f[1] * 0.2, p[2] + f[2] * 0.88 + r[2] * side * 0.42];
      gl.uniformMatrix4fv(this.loc.model, false, M.model(hp, [0.22, 0.16, 0.34], this.camera.yaw));
      gl.uniform3fv(this.loc.color, [0.96, 0.72, 0.05]);
      gl.uniform1f(this.loc.glow, 0.08);
      gl.drawArrays(gl.TRIANGLES, 0, this.vertexCount);
    }
  }
  
  if (this.xrControllerRay) this._renderXRRay(proj, view);
  
  // Three.js model pass (hybrid rendering)
  if (this.threeRenderer && this.threeScene) {
    this._syncThreeCamera(proj, view);
    
    // Update model positions and colors
    for (const model of this.models.values()) {
      if (model._threeGroup && model.visible) {
        model._threeGroup.position.set(model.position[0], model.position[1], model.position[2]);
        model._threeGroup.rotation.y = model.yaw || 0;
        this._applyModelColor(model);
        model._threeGroup.visible = true;
      } else if (model._threeGroup) {
        model._threeGroup.visible = false;
      }
    }
    
    this.threeRenderer.render(this.threeScene, this.threeCamera);
  }
}
```

#### 2.11 VR: Update _onXRFrame() to render Three.js models per view
Find the line `this.render(view.projectionMatrix, view.transform.inverse.matrix, vp)` inside the `for (const view of pose.views)` loop and add immediately after it:

```javascript
// Three.js VR render pass
if (this.threeRenderer && this.threeScene) {
  this._syncThreeCamera(view.projectionMatrix, view.transform.inverse.matrix);
  this.threeRenderer.render(this.threeScene, this.threeCamera);
}
```

**Verify**: Run `node server.js`, open the training, check the browser console for `[ENGINE] Three.js renderer initialized for GLB models`, and confirm no errors on page load. Test that existing boxes still render.

---

### 3. js/training.js
**What**: Replace two `this.hazard()` calls with `this.addModel()` calls and add a tiny `addModel()` helper that delegates to engine and tracks hazardIds  
**Why**: Oil spill and chemical drum must become GLB models while still participating in hazard gameplay

#### 3.1 Add addModel() helper
Add this method after the `hazard()` method (around line 56):

```javascript
addModel(opts) {
  const o = this.e.addModel(opts);
  if (opts.kind === 'hazard') {
    this.hazardIds.push(opts.id);
  }
  return o;
}
```

#### 3.2 Replace 'spill' hazard
Find the line (around line 116):
```javascript
this.hazard('spill','Oil spill',[5,.035,5],[2.2,.05,1.5],'#4b5c66','Slippery spill left in pedestrian route');
```

Replace with:
```javascript
this.addModel({
  id: 'spill',
  label: 'Oil spill',
  modelPath: 'models/oil_spill_container.glb',
  position: [5, 0.035, 5],
  size: [2.5, 0.1, 2.0], // AABB for collision
  scale: [1, 1, 1],
  rotation: [0, 0, 0],
  color: '#4b5c66',
  interactive: true,
  kind: 'hazard',
  hazardWhy: 'Slippery spill left in pedestrian route',
  glow: true,
  solid: false,
  overlap: false
});
```

#### 3.3 Replace 'chemDrum' hazard
Find the line (around line 120):
```javascript
this.hazard('chemDrum','Unlabelled chemical drum',[17,.7,-19],[1.3,1.4,1.3],'#7f429c','Chemical container has no readable label');
```

Replace with:
```javascript
this.addModel({
  id: 'chemDrum',
  label: 'Unlabelled chemical drum',
  modelPath: 'models/Unlabelled_chemical_drum.glb',
  position: [17, 0.7, -19],
  size: [1.3, 1.4, 1.3], // AABB for collision
  scale: [1, 1, 1],
  rotation: [0, 0, 0],
  color: '#7f429c',
  interactive: true,
  kind: 'hazard',
  hazardWhy: 'Chemical container has no readable label',
  glow: true,
  solid: true, // chemDrum is solid per original logic
  overlap: false
});
```

**Note**: The existing `_applySaved()`, `reportHazard()`, `duelHit()`, and all other methods already call `this.e.get(id)` and mutate `o.color`, `o.glow`, `o.interactive` — these work unchanged because model objects are in `this.e.byId`.

**Verify**: Run the training, navigate to the oil spill and chemical drum locations, confirm GLB models render in place of the boxes, and interact with them to report the hazards. Check that color changes to green and glow turns off when reported.

---

## Camera Sync Math (Custom → THREE.Matrix4)

The custom engine uses Float32Array column-major 4×4 matrices for projection and view. Three.js Matrix4 also uses column-major layout, so `THREE.Matrix4.fromArray(mat)` directly copies the 16 floats. The view matrix inverse gives the camera's world transform. This is handled in `_syncThreeCamera()` above.

## Raycasting Merge Strategy

1. Loop through `this.objects` and check boxes with existing `M.rayAABB()` (skip objects with `_threeGroup` set)
2. Create a `THREE.Raycaster` from the origin/dir
3. Call `raycaster.intersectObjects(this.threeScene.children, true)`
4. For each hit, walk up the parent chain to find the root group in the scene, then match it against `this.models` entries by comparing `model._threeGroup === obj`
5. Return the closest hit (box or model) by comparing distances

## Color/Glow Update Strategy

When `reportHazard()` or `_applySaved()` sets `o.color = '#3eaf77'` and `o.glow = false`:
1. The model object in `this.byId` is updated directly (same as boxes)
2. Inside the Three.js render pass (inside `render()` method), call `this._applyModelColor(model)` for each visible model
3. `_applyModelColor()` traverses `model._threeGroup` and sets `mesh.material.color` and `mesh.material.emissive` from the current `model.color` / `model.glow` values
4. This happens every frame, so changes are applied immediately

## VR Render Pass Additions

In `_onXRFrame()`, after the existing `this.render(view.projectionMatrix, view.transform.inverse.matrix, vp)` call inside the per-view loop, add:
```javascript
if (this.threeRenderer && this.threeScene) {
  this._syncThreeCamera(view.projectionMatrix, view.transform.inverse.matrix);
  this.threeRenderer.render(this.threeScene, this.threeCamera);
}
```

This renders the Three.js scene once per eye using the same camera matrices.

## Before/After Diffs for training.js

### Oil spill (line ~116)

**Before:**
```javascript
this.hazard('spill','Oil spill',[5,.035,5],[2.2,.05,1.5],'#4b5c66','Slippery spill left in pedestrian route');
```

**After:**
```javascript
this.addModel({
  id: 'spill',
  label: 'Oil spill',
  modelPath: 'models/oil_spill_container.glb',
  position: [5, 0.035, 5],
  size: [2.5, 0.1, 2.0],
  scale: [1, 1, 1],
  rotation: [0, 0, 0],
  color: '#4b5c66',
  interactive: true,
  kind: 'hazard',
  hazardWhy: 'Slippery spill left in pedestrian route',
  glow: true,
  solid: false,
  overlap: false
});
```

### Chemical drum (line ~120)

**Before:**
```javascript
this.hazard('chemDrum','Unlabelled chemical drum',[17,.7,-19],[1.3,1.4,1.3],'#7f429c','Chemical container has no readable label');
```

**After:**
```javascript
this.addModel({
  id: 'chemDrum',
  label: 'Unlabelled chemical drum',
  modelPath: 'models/Unlabelled_chemical_drum.glb',
  position: [17, 0.7, -19],
  size: [1.3, 1.4, 1.3],
  scale: [1, 1, 1],
  rotation: [0, 0, 0],
  color: '#7f429c',
  interactive: true,
  kind: 'hazard',
  hazardWhy: 'Chemical container has no readable label',
  glow: true,
  solid: true,
  overlap: false
});
```

## Three.js CDN URLs (r165 stable)

- **Three.js core (UMD)**: `https://cdn.jsdelivr.net/npm/three@0.165.0/build/three.min.js`
- **GLTFLoader (UMD)**: `https://cdn.jsdelivr.net/npm/three@0.165.0/examples/js/loaders/GLTFLoader.js`

These must be loaded as `<script>` tags in the HTML `<head>` before training-loader.js runs. They expose `window.THREE` and `window.THREE.GLTFLoader` as globals.

## GLB Model Files

The GLB files are already present in the project:
- `/Users/awnishmehta/Desktop/WareWiseXR_Final_FullStack_v7/models/oil_spill_container.glb`
- `/Users/awnishmehta/Desktop/WareWiseXR_Final_FullStack_v7/models/Unlabelled_chemical_drum.glb`

No file moves required; the `modelPath` option in `addModel()` is relative to the HTML file (warehouse-training.html is in the root, so `models/` works).

## Hybrid Render Approach (Step by Step)

1. **WebGL1 box pass**: Engine's existing `render()` draws all boxes (skip objects with `_threeGroup` set) into the framebuffer using the custom shader. Depth buffer is written.
2. **Three.js model pass**: After box drawing, call `_syncThreeCamera(proj, view)` to copy custom matrices into `this.threeCamera.projectionMatrix` and `this.threeCamera.matrixWorld`. Set `threeRenderer.autoClear = false` so Three.js doesn't clear the depth buffer. Call `threeRenderer.render(threeScene, threeCamera)` to draw models on top, respecting depth from the box pass.
3. **VR**: In `_onXRFrame()`, after each per-view `this.render(...)` call, repeat the Three.js pass with the same XR view matrices.

## No Console Errors

Wrap Three.js initialization in a try-catch. If `window.THREE` is undefined or initialization fails, log a warning and set `this.threeRenderer = null`. In `addModel()`, if `this.gltfLoader` is null, set `o._loading = false` and skip loading. In `render()`, only call Three.js code if `this.threeRenderer && this.threeScene` is truthy. Models that fail to load will have `_threeGroup = null` and render as boxes in the fallback path (though training.js currently replaces the hazard() calls, so there's no box fallback unless you add one).

For production-grade fallback: add a `_showPlaceholder` flag in addModel error handler and check it in render() to draw a colored box if the model failed.

## Testing Checklist

1. **CDN load**: Open browser console, check `window.THREE` and `window.THREE.GLTFLoader` are defined
2. **Engine init**: Check console for `[ENGINE] Three.js renderer initialized for GLB models`
3. **Model load**: Navigate to oil spill (position [5, 0.035, 5]) and chemical drum (position [17, 0.7, -19]), confirm 3D models visible
4. **Raycasting**: Aim crosshair at models, confirm interaction prompt appears
5. **Hazard report**: Press E on each model, confirm hazard modal opens, score increases, model turns green and glow turns off
6. **Collision**: Walk into the chemical drum (solid:true), confirm player is blocked
7. **Saved state**: Report a hazard, refresh the page, confirm the model stays green and non-interactive
8. **VR (if available)**: Enter VR mode, confirm models render in both eyes
9. **Other boxes**: Confirm crates, walls, floor, workers, forklift all still render and work
10. **No errors**: Check console for GL errors or Three.js warnings

## Implementation Order

1. Add Three.js CDN scripts to warehouse-training.html (verify in console)
2. Modify engine.js constructor to add model storage (verify no syntax errors)
3. Modify engine.js init() to initialize Three.js renderer (verify console log)
4. Add addModel() method to engine.js (verify by calling `engine.addModel({id:'test'})` in console)
5. Update remove() and clear() in engine.js (verify no errors on page load)
6. Update resize() in engine.js (verify resize event doesn't break)
7. Add _syncThreeCamera() helper to engine.js
8. Add _applyModelColor() helper to engine.js
9. Update render() to add Three.js pass (verify boxes still render)
10. Update raycast() to check models (verify by aiming at a test model)
11. Update _onXRFrame() to add Three.js VR pass
12. Add addModel() helper to training.js (verify no syntax errors)
13. Replace 'spill' hazard call in training.js (verify model loads at [5, 0.035, 5])
14. Replace 'chemDrum' hazard call in training.js (verify model loads at [17, 0.7, -19])
15. Test interaction, color change, glow, collision, saved state

## Completion Criteria

- [ ] Three.js r165 and GLTFLoader load from CDN without errors
- [ ] Engine initializes Three.js renderer and logs success message
- [ ] Oil spill GLB model renders at [5, 0.035, 5] in place of the box
- [ ] Chemical drum GLB model renders at [17, 0.7, -19] in place of the box
- [ ] Crosshair turns red and interaction prompt appears when aiming at models
- [ ] Pressing E on models opens hazard report modal and increases score
- [ ] Reported models turn green and lose glow effect
- [ ] Player collision blocks movement into solid chemical drum
- [ ] Saved hazard state persists across page refresh (model stays green)
- [ ] All other warehouse objects (boxes, crates, workers, forklift, walls) render and work unchanged
- [ ] No console errors or WebGL warnings
- [ ] (If VR available) Models render correctly in immersive VR mode

## Estimated Effort

- HTML changes: 5 minutes
- engine.js changes: 60 minutes (careful integration with existing render loop)
- training.js changes: 10 minutes
- Testing and refinement: 30 minutes

**Total**: ~2 hours for a developer familiar with Three.js and the existing codebase.

## Notes

- The hybrid rendering approach was chosen over full Three.js migration because the custom WebGL1 engine is proven, performant, and deeply integrated with VR, collision, and gameplay logic. Adding Three.js only for models minimizes risk.
- Model scale and rotation are configurable in addModel() options if the GLB import scale is incorrect.
- The AABB `size` parameter is critical for collision — measure the bounding box of the loaded model if collision feels wrong.
- GLB materials may not respond perfectly to color tinting if they use PBR textures. For best results, the GLB should use simple diffuse materials or the tinting logic should be extended to modify texture base color.
- Future enhancement: implement a visible box fallback when GLB load fails, so gameplay continues even if the CDN or model file is unavailable.
