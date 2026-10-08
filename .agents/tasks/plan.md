# Implementation Plan: Realistic 3D Object Shapes in Warehouse

## Project Context

**Engine capabilities discovered:**
- The WareEngine only supports **box primitives** — no native sphere, cylinder, cone, or irregular shapes
- All geometry is rendered via a single cube mesh (36 vertices) transformed by size, position, and yaw rotation
- The `this.box()` helper in training.js wraps `this.e.add()` to create boxes with size `[x, y, z]`
- Objects support `yaw` rotation (Y-axis rotation only), but no pitch/roll for arbitrary 3D rotation
- Objects have `position [x, y, z]`, `size [x, y, z]`, `color` (hex string), `solid` (collision), `interactive`, `glow`, `kind`
- Overlapping boxes at slightly different y-values can z-fight; offset by at least 0.01 units to avoid

**Build/test approach:**
- This is a localhost Node.js project with no build step or test framework
- Verification: Start the server with `node server.js`, navigate to `http://127.0.0.1:8080`, log in as an employee, enter training mode, and visually inspect each modified object in the 3D warehouse
- No automated tests exist; all verification is manual visual inspection in the browser

**Key patterns from codebase:**
- Hazard objects: created via `this.hazard(id, label, pos, size, color, why, overlap=false)` which wraps `this.box()` and adds hazard-specific properties; the id is registered in `this.hazardIds` array for game logic
- Worker/forklift helpers: `this.worker(x, z, label, phone)` and `this.forklift(x, z)` build multi-box assemblies
- Station signs: `this.stationSign()` creates letter-blocks for 3D text using many small boxes
- Racks: `this.rack()` uses loops to place beams and uprights
- The `_applySaved()` method restores hazard colors from state; decorative boxes must NOT have ids that collide with saved state

**Objective:**
Replace single-box objects with multi-box approximations to create more realistic, organic, and visually believable 3D shapes throughout the warehouse scene.

---

## Priority 1: Oil Spill (Hazard id='spill')

**Goal:** Replace the rectangular oil spill box with 6-9 overlapping elliptical boxes at varying positions, sizes, rotations, and two color shades to simulate an irregular puddle.

**Current code (training.js line ~169):**
```javascript
this.hazard('spill','Oil spill',[5,.035,5],[2.2,.05,1.5],'#4b5c66','Slippery spill left in pedestrian route');
```

**New implementation:**

```javascript
// Main hazard box (interactive, registered in hazardIds)
this.hazard('spill','Oil spill',[5,.035,5],[1.8,.05,1.2],'#3a4b52','Slippery spill left in pedestrian route');

// Decorative puddle blobs to create irregular organic shape
// Dark center blobs
this.box('spillBlob1','Oil puddle decoration',[4.85,.037,5.1],[1.3,.048,.9],'#3a4b52',{glow:false});
this.box('spillBlob2','Oil puddle decoration',[5.3,.034,4.8],[1.5,.046,1.0],'#3a4b52',{yaw:0.4});
this.box('spillBlob3','Oil puddle decoration',[4.6,.032,4.6],[1.0,.047,.7],'#3a4b52',{yaw:-0.3});

// Lighter edge blobs
this.box('spillBlob4','Oil puddle decoration',[6.1,.036,5.2],[1.2,.046,0.8],'#5a6e78',{yaw:0.6});
this.box('spillBlob5','Oil puddle decoration',[4.2,.033,5.5],[1.1,.045,0.9],'#5a6e78',{yaw:-0.5});
this.box('spillBlob6','Oil puddle decoration',[5.4,.038,5.8],[0.9,.046,0.7],'#5a6e78',{yaw:0.2});
this.box('spillBlob7','Oil puddle decoration',[5.8,.035,4.4],[1.0,.047,0.8],'#5a6e78',{yaw:-0.7});
this.box('spillBlob8','Oil puddle decoration',[4.5,.036,5.9],[0.8,.045,0.6],'#5a6e78',{yaw:0.8});
```

**Files to modify:**
- `/Users/awnishmehta/Desktop/WareWiseXR_Final_FullStack_v7/js/training.js` (in the `_build()` method, around line 169)

**Hazard registration:**
- Only the main box with id='spill' is registered as a hazard via `this.hazard()`
- All decorative boxes use `this.box()` with ids 'spillBlob1' through 'spillBlob8'
- `_applySaved()` will not affect these decorative ids

**Z-fighting prevention:**
- Y positions vary between 0.032 and 0.038 (0.006 range) to prevent z-fighting
- Main hazard box at y=0.035 is in the middle of the range

**Verification:**
1. Start server: `node server.js`
2. Navigate to `http://127.0.0.1:8080`
3. Log in as an employee (or create and approve an account)
4. Enter training mode
5. Navigate to position [5, 1.68, 5] (near the oil spill)
6. Confirm the spill now has an irregular, organic puddle shape with dark center and lighter edges
7. Press E to interact with the hazard and confirm it reports correctly
8. Check that after reporting, the entire puddle area turns green (main box + decorative boxes visible)

---

## Priority 2: Safety Cones (Bollards + coneMovable)

**Goal:** Approximate cone shapes by stacking 3-4 boxes of decreasing width with alternating orange and white bands.

**Current code (training.js):**

Bollards at z-loop (~line 147):
```javascript
for(let z=9;z>-34;z-=7){this.box('bollardL'+z,'Safety bollard',[-15.8,.65,z],[.22,1.3,.22],'#f6b900',{solid:true});this.box('bollardR'+z,'Safety bollard',[-18.35,.65,z],[.22,1.3,.22],'#f6b900',{solid:true})}
```

Movable cone (~line 161):
```javascript
['coneMovable','Safety cone • 2 kg',[-13.2,.45,10.0],[.55,.9,.55],'#e66a27']
```

**New implementation:**

Replace the bollard loop code with:
```javascript
for(let z=9;z>-34;z-=7){
  // Left bollard - 4-tier stacked cone
  this.box('bollardL'+z+'_base','Safety bollard',[-15.8,.18,z],[.48,.36,.48],'#e66a27',{solid:true});
  this.box('bollardL'+z+'_band1','Safety bollard',[-15.8,.48,z],[.40,.24,.40],'#f5f5f5',{solid:true});
  this.box('bollardL'+z+'_band2','Safety bollard',[-15.8,.76,z],[.32,.32,.32],'#e66a27',{solid:true});
  this.box('bollardL'+z+'_top','Safety bollard',[-15.8,1.08,z],[.24,.28,.24],'#f5f5f5',{solid:true});

  // Right bollard - 4-tier stacked cone
  this.box('bollardR'+z+'_base','Safety bollard',[-18.35,.18,z],[.48,.36,.48],'#e66a27',{solid:true});
  this.box('bollardR'+z+'_band1','Safety bollard',[-18.35,.48,z],[.40,.24,.40],'#f5f5f5',{solid:true});
  this.box('bollardR'+z+'_band2','Safety bollard',[-18.35,.76,z],[.32,.32,.32],'#e66a27',{solid:true});
  this.box('bollardR'+z+'_top','Safety bollard',[-18.35,1.08,z],[.24,.28,.24],'#f5f5f5',{solid:true});
}
```

For the movable cone, replace the entry in the `movable` array:
```javascript
// Remove this line:
// ['coneMovable','Safety cone • 2 kg',[-13.2,.45,10.0],[.55,.9,.55],'#e66a27'],

// Instead, AFTER the movable.forEach loop, add:
// Movable safety cone - 3-tier stacked approximation
this.box('coneMovable_base','Safety cone base',[-13.2,.16,10.0],[.58,.32,.58],'#e66a27',{solid:true,interactive:false});
this.box('coneMovable_mid','Safety cone middle',[-13.2,.42,10.0],[.42,.28,.42],'#f5f5f5',{solid:true,interactive:false});
this.box('coneMovable','Safety cone • 2 kg',[-13.2,.68,10.0],[.28,.32,.28],'#e66a27',{solid:true,interactive:true,kind:'movable',movable:true,groundY:.45,glow:true,hitSize:[.75,1.4,.75]});
```

**Files to modify:**
- `/Users/awnishmehta/Desktop/WareWiseXR_Final_FullStack_v7/js/training.js` (in the `_build()` method, around lines 147 and 161)

**Interactive behavior:**
- For static bollards: all segments have `solid:true` for collision, none are interactive
- For movable cone: only the top segment (id='coneMovable') is interactive; the base and mid segments follow the cone when picked up by updating their positions in the `_updateCarry()` method — **actually, the engine doesn't support compound object movement, so this approach won't work for the movable cone**

**Revised approach for movable cone:**
Since the engine's `_updateCarry()` only moves `this.carried`, we must use a single box for the interactive cone. Instead, create a helper method to rebuild the cone tiers when dropped:

```javascript
// In the movable array, keep it simple:
['coneMovable','Safety cone • 2 kg',[-13.2,.45,10.0],[.55,.9,.55],'#e66a27']

// Then in the handleDrop() method, add special handling:
// After the line: o.position[1]=o.groundY??Math.max(.25,o.size[1]/2);
// Add:
if(o.id === 'coneMovable') {
  // Remove old decorative tiers if they exist
  ['coneMovable_base','coneMovable_mid'].forEach(id => this.e.remove(id));
  // Recreate tiers at new position
  const x = o.position[0], z = o.position[2];
  this.box('coneMovable_base','Safety cone base',[x,.16,z],[.72,.32,.72],'#f5f5f5',{solid:false,glow:false});
  this.box('coneMovable_mid','Safety cone middle',[x,.42,z],[.62,.28,.62],'#e66a27',{solid:false,glow:false});
}
```

**Even simpler approach:** Since movable objects are meant to be picked up and moved, and the engine doesn't support compound objects, just improve the STATIC bollards and leave the movable cone as a single orange box. The static bollards provide the visual improvement.

**Final approach for movable cone:** Leave as-is (single box) to avoid complexity. Only improve the static bollards.

**Files to modify:**
- `/Users/awnishmehta/Desktop/WareWiseXR_Final_FullStack_v7/js/training.js` (static bollards only, around line 147)

**Z-fighting prevention:**
- Each tier has a distinct y-center, no overlap

**Verification:**
1. Start server: `node server.js`
2. Navigate to training mode
3. Walk along the pedestrian lane (x ≈ -17, z from 9 to -34)
4. Confirm static bollards now have a stacked cone appearance with orange/white bands
5. Confirm collision still works (player cannot walk through bollards)

---

## Priority 3: Chemical Drum (Hazard id='chemDrum')

**Goal:** Approximate a cylinder with 5-6 stacked thin boxes, each slightly smaller than the one below to create a rounded profile.

**Current code (training.js line ~170):**
```javascript
this.hazard('chemDrum','Unlabelled chemical drum',[17,.7,-19],[1.3,1.4,1.3],'#7f429c','Chemical container has no readable label');
```

**New implementation:**

```javascript
// Drum approximation - 6 horizontal slices with slight taper to suggest roundness
this.box('chemDrumBase','Drum base',[17,.14,-19],[1.32,.28,1.32],'#6a3a85',{solid:true});
this.box('chemDrumSlice1','Drum body',[17,.36,-19],[1.38,.24,1.38],'#7f429c',{solid:true});
this.box('chemDrumSlice2','Drum body',[17,.56,-19],[1.40,.24,1.40],'#7f429c',{solid:true});
this.hazard('chemDrum','Unlabelled chemical drum',[17,.78,-19],[1.40,.28,1.40],'#7f429c','Chemical container has no readable label');
this.box('chemDrumSlice3','Drum body',[17,1.00,-19],[1.38,.24,1.38],'#7f429c',{solid:true});
this.box('chemDrumTop','Drum top',[17,1.20,-19],[1.32,.24,1.32],'#6a3a85',{solid:true});
```

**Files to modify:**
- `/Users/awnishmehta/Desktop/WareWiseXR_Final_FullStack_v7/js/training.js` (in the `_build()` method, around line 170)

**Hazard registration:**
- The middle-height box with id='chemDrum' remains the interactive hazard
- All other slices are decorative and use `this.box()`
- Total height: ~1.44 units (6 slices × 0.24-0.28 height)
- Width tapers: 1.32 (base) → 1.38 → 1.40 (widest at middle) → 1.38 → 1.32 (top)

**Z-fighting prevention:**
- Boxes are vertically stacked with distinct y-centers, no z-fighting risk

**Verification:**
1. Start server and enter training mode
2. Navigate to position [17, 1.68, -19] (chemical drum location)
3. Confirm the drum now has a rounded cylindrical appearance with slight taper
4. Press E to interact and confirm hazard reporting works
5. Confirm the entire drum assembly turns green after reporting (the main hazard box color changes; decorative slices remain their color — this is acceptable)

**Note:** Decorative boxes won't change color when hazard is reported. To fix this, we can add a helper that updates all related boxes. However, for simplicity and to avoid modifying `_applySaved()`, we accept that only the main hazard box changes color. This is a minor visual quirk.

**Enhanced approach with color coordination:**

To make all drum slices turn green when the hazard is reported, add this to the `_applySaved()` method:

```javascript
// In _applySaved(), after the line: if(o){o.color='#3eaf77';o.glow=false;o.interactive=false}
// Add special handling for compound objects:
if(id === 'chemDrum') {
  ['chemDrumBase','chemDrumSlice1','chemDrumSlice2','chemDrumSlice3','chemDrumTop'].forEach(decorId => {
    const deco = this.e.get(decorId);
    if(deco) deco.color = '#3eaf77';
  });
}
```

**Files to modify:**
- `/Users/awnishmehta/Desktop/WareWiseXR_Final_FullStack_v7/js/training.js` (in the `_build()` method around line 170, AND in the `_applySaved()` method around line 183)

**Verification:**
1. Start server and enter training mode
2. Navigate to chemical drum at [17, 1.68, -19]
3. Confirm cylindrical stacked appearance
4. Report the hazard
5. Confirm ALL drum slices turn green (not just the main box)

---

## Priority 4: Pedestrian Lane Bollards (Already Covered in Priority 2)

See Priority 2 for the bollard implementation.

---

## Priority 5: Forklift Wheels

**Goal:** Approximate circular wheels by overlapping 3 rotated boxes at 0°, 60°, 120° to create a more rounded appearance.

**Current code (training.js in the `forklift()` method, line ~204):**
```javascript
for(const dx of [-.82,.82])for(const dz of [-.9,.9])this.box('wheel'+dx+dz,'Forklift wheel',[x+dx,.3,z+dz],[.45,.6,.55],'#151719',{solid:true})
```

**Challenge:** The engine only supports `yaw` (Y-axis rotation). To create a circular cross-section, we need rotation around the X or Z axis, which is not supported.

**Alternative approach:** Use a cross-pattern with 3 overlapping boxes without rotation:
- One tall-thin vertical box [0.2, 0.6, 0.55]
- One wide-thin horizontal box [0.55, 0.6, 0.2]
- One medium-square box [0.38, 0.6, 0.38]

**Revised implementation:**

```javascript
forklift(x,z){
  this.box('forkBody','Forklift',[x,.75,z],[2,1.5,3.1],'#d49c00',{solid:true});
  this.box('forkCab','Forklift cab',[x,1.9,z+.3],[1.7,1.7,1.8],'#36434e',{solid:true});
  this.box('forkMast','Forklift mast',[x,1.7,z-1.55],[1.8,3.3,.22],'#20272c',{solid:true});
  this.box('fork1','Fork tine',[x-.55,.18,z-2.7],[.18,.16,2.4],'#3b4246',{solid:true});
  this.box('fork2','Fork tine',[x+.55,.18,z-2.7],[.18,.16,2.4],'#3b4246',{solid:true});
  
  // Wheels - 3-box cross pattern to approximate roundness
  for(const dx of [-.82,.82]) {
    for(const dz of [-.9,.9]) {
      const wheelX = x+dx, wheelZ = z+dz;
      this.box('wheel'+dx+dz+'_v','Forklift wheel',[wheelX,.3,wheelZ],[.22,.6,.55],'#151719',{solid:true});
      this.box('wheel'+dx+dz+'_h','Forklift wheel',[wheelX,.3,wheelZ],[.55,.6,.22],'#151719',{solid:true});
      this.box('wheel'+dx+dz+'_c','Forklift wheel',[wheelX,.3,wheelZ],[.40,.6,.40],'#151719',{solid:true});
    }
  }
}
```

**Files to modify:**
- `/Users/awnishmehta/Desktop/WareWiseXR_Final_FullStack_v7/js/training.js` (in the `forklift()` method, around line 204)

**Z-fighting prevention:**
- All wheel boxes share the same y-center (0.3), but overlapping in X-Z plane is intentional to create the round appearance
- Minor z-fighting may occur but is acceptable for the visual improvement

**Verification:**
1. Start server and enter training mode
2. Navigate to the forklift at position [4, 1.68, -1]
3. View wheels from multiple angles
4. Confirm wheels appear more rounded than the original single boxes
5. Confirm forklift collision still works

---

## Priority 6: Worker Heads

**Goal:** Round worker heads by adding 4 small beveling boxes on the corners (since the engine doesn't support sphere geometry).

**Current code (training.js in the `worker()` method, line ~205):**
```javascript
worker(x,z,label,phone){
  this.box('workerBody'+x+z,label,[x,1.35,z],[.62,1.4,.45],phone?'#e36c53':'#e9c84a',{solid:true});
  this.box('workerHead'+x+z,label,[x,2.28,z],[.45,.45,.45],'#c88768');
  this.box('workerLeg1'+x+z,label,[x-.17,.48,z],[.22,.9,.24],'#273746');
  this.box('workerLeg2'+x+z,label,[x+.17,.48,z],[.22,.9,.24],'#273746');
  if(phone)this.box('phone'+x+z,'Mobile phone',[x+.38,1.55,z-.2],[.12,.22,.04],'#1b1d21')
}
```

**New implementation:**

```javascript
worker(x,z,label,phone){
  this.box('workerBody'+x+z,label,[x,1.35,z],[.62,1.4,.45],phone?'#e36c53':'#e9c84a',{solid:true});
  
  // Main head box
  this.box('workerHead'+x+z,label,[x,2.28,z],[.45,.45,.45],'#c88768');
  
  // Corner bevels to round the head (8 corners)
  const headColor = '#b57758'; // Slightly darker for bevel
  const bevel = 0.10; // Small bevel size
  const offset = 0.17; // Half of head size (0.45/2) minus half bevel
  this.box('workerHead'+x+z+'_bevel1',label,[x-offset,2.28+offset,z-offset],[bevel,bevel,bevel],headColor);
  this.box('workerHead'+x+z+'_bevel2',label,[x+offset,2.28+offset,z-offset],[bevel,bevel,bevel],headColor);
  this.box('workerHead'+x+z+'_bevel3',label,[x-offset,2.28+offset,z+offset],[bevel,bevel,bevel],headColor);
  this.box('workerHead'+x+z+'_bevel4',label,[x+offset,2.28+offset,z+offset],[bevel,bevel,bevel],headColor);
  this.box('workerHead'+x+z+'_bevel5',label,[x-offset,2.28-offset,z-offset],[bevel,bevel,bevel],headColor);
  this.box('workerHead'+x+z+'_bevel6',label,[x+offset,2.28-offset,z-offset],[bevel,bevel,bevel],headColor);
  this.box('workerHead'+x+z+'_bevel7',label,[x-offset,2.28-offset,z+offset],[bevel,bevel,bevel],headColor);
  this.box('workerHead'+x+z+'_bevel8',label,[x+offset,2.28-offset,z+offset],[bevel,bevel,bevel],headColor);
  
  this.box('workerLeg1'+x+z,label,[x-.17,.48,z],[.22,.9,.24],'#273746');
  this.box('workerLeg2'+x+z,label,[x+.17,.48,z],[.22,.9,.24],'#273746');
  if(phone)this.box('phone'+x+z,'Mobile phone',[x+.38,1.55,z-.2],[.12,.22,.04],'#1b1d21')
}
```

**Files to modify:**
- `/Users/awnishmehta/Desktop/WareWiseXR_Final_FullStack_v7/js/training.js` (in the `worker()` method, around line 205)

**Z-fighting prevention:**
- Bevels are positioned at the corners, not overlapping the main head box faces

**Verification:**
1. Start server and enter training mode
2. Locate worker figures at positions: [1, 1.68, -2.2], [-3, 1.68, -18], [8, 1.68, -18], [-5, 1.68, -30], [2, 1.68, -31]
3. View worker heads from multiple angles
4. Confirm heads appear slightly more rounded with corner bevels
5. Confirm unsafe act interactions still work for the relevant workers

---

## Priority 7: Trailing Cable (Hazard id='looseCable')

**Goal:** Replace the single straight cable box with 5-6 short overlapping segments at slightly varying x-offsets and y-heights to create a wavy, draped appearance.

**Current code (training.js line ~170):**
```javascript
this.hazard('looseCable','Trailing cable',[-2,.06,-8],[4.5,.08,.18],'#d97745','Cable crosses the pedestrian route');
```

**New implementation:**

```javascript
// Cable segments with wavy draping pattern
this.hazard('looseCable','Trailing cable',[-3.8,.06,-8],[1.2,.08,.20],'#d97745','Cable crosses the pedestrian route');
this.box('looseCable_seg2','Cable segment',[-2.7,.062,-8.05],[1.1,.08,.18],'#d97745',{yaw:0.1});
this.box('looseCable_seg3','Cable segment',[-1.6,.058,-8.02],[1.2,.08,.19],'#d97745',{yaw:-0.08});
this.box('looseCable_seg4','Cable segment',[-0.5,.064,-7.98],[1.1,.08,.18],'#d97745',{yaw:0.12});
this.box('looseCable_seg5','Cable segment',[0.6,.061,-8.04],[1.0,.08,.17],'#d97745',{yaw:-0.06});
this.box('looseCable_seg6','Cable segment',[1.5,.059,-8.01],[0.9,.08,.19],'#d97745',{yaw:0.09});
```

**Files to modify:**
- `/Users/awnishmehta/Desktop/WareWiseXR_Final_FullStack_v7/js/training.js` (in the `_build()` method, around line 170)

**Hazard registration:**
- Only the first segment with id='looseCable' is the interactive hazard
- Other segments are decorative

**Z-fighting prevention:**
- Y positions vary between 0.058 and 0.064 to prevent z-fighting
- Z positions vary slightly (±0.05) to create wavy path

**Verification:**
1. Start server and enter training mode
2. Navigate to position [-2, 1.68, -8] (trailing cable location)
3. Confirm the cable now has a wavy, draped appearance across the floor
4. Press E to interact and confirm hazard reporting works
5. Confirm the cable segments remain visible and the main segment turns green after reporting

---

## Priority 8: Damaged Pallet (Hazard id='damagedPallet')

**Goal:** Add 2-3 small "broken board" boxes at the edges of the main pallet, slightly raised and at small angles, to suggest splintered wood.

**Current code (training.js line ~171):**
```javascript
this.hazard('damagedPallet','Damaged pallet',[-2,.25,-24],[2.4,.5,1.8],'#8b5b35','Broken pallet boards and protruding edge');
```

**New implementation:**

```javascript
// Main pallet
this.hazard('damagedPallet','Damaged pallet',[-2,.25,-24],[2.4,.5,1.8],'#8b5b35','Broken pallet boards and protruding edge');

// Broken/splintered board pieces protruding at edges
this.box('damagedPallet_splinter1','Broken board',[-3.15,.38,-24.6],[0.35,.12,.25],'#7a4d28',{yaw:0.4});
this.box('damagedPallet_splinter2','Broken board',[-0.95,.42,-24.85],[0.42,.10,.20],'#7a4d28',{yaw:-0.5});
this.box('damagedPallet_splinter3','Broken board',[-2.8,.35,-23.2],[0.30,.14,.28],'#7a4d28',{yaw:0.6});
```

**Files to modify:**
- `/Users/awnishmehta/Desktop/WareWiseXR_Final_FullStack_v7/js/training.js` (in the `_build()` method, around line 171)

**Hazard registration:**
- Main pallet with id='damagedPallet' is the interactive hazard
- Splinters are decorative

**Z-fighting prevention:**
- Splinters are positioned at edges and raised (y=0.35-0.42 vs main pallet y=0.25)

**Verification:**
1. Start server and enter training mode
2. Navigate to position [-2, 1.68, -24] (damaged pallet location)
3. Confirm small broken board pieces are visible protruding from pallet edges at angles
4. Press E to interact and confirm hazard reporting works
5. Confirm the main pallet turns green after reporting (splinters remain their color)

---

## Priority 9: Unstable Stacked Load (Hazard id='stacking')

**Goal:** Make the stacked load visibly lean by applying a small rotation, or if rotation isn't sufficient, add a wedge suggestion using a thin leaning box.

**Current code (training.js line ~172):**
```javascript
this.hazard('stacking','Unstable stacked load',[-14,3,-20],[2.8,4.5,2.4],'#c47435','Load is leaning and poorly secured');
```

**Approach 1: Use yaw rotation (limited effectiveness since yaw rotates around Y-axis):**

The engine supports `yaw` which rotates around the vertical Y-axis. This won't create a "leaning" effect (which would require pitch/roll rotation around X or Z axes). 

**Approach 2: Create visual lean with multiple stacked boxes at offset positions:**

```javascript
// Unstable stack - 3 boxes with progressive offset to show lean
this.box('stacking_bottom','Stack bottom',[-14,1.5,-20],[2.8,3.0,2.4],'#b86830',{solid:true});
this.box('stacking_middle','Stack middle',[-14.15,3.5,-20],[2.7,2.5,2.3],'#c47435',{solid:true});
this.hazard('stacking','Unstable stacked load',[-14.35,5.2,-20],[2.5,2.0,2.2],'#d48540','Load is leaning and poorly secured');

// Visual support: a leaning support piece to emphasize instability
this.box('stacking_support','Leaning support',[-15.8,2.8,-20],[0.25,2.8,0.20],'#8b5b35',{yaw:0.15});
```

**Files to modify:**
- `/Users/awnishmehta/Desktop/WareWiseXR_Final_FullStack_v7/js/training.js` (in the `_build()` method, around line 172)

**Hazard registration:**
- The top box with id='stacking' is the interactive hazard
- Bottom and middle boxes are structural
- Support piece is decorative

**Z-fighting prevention:**
- Boxes are vertically stacked with distinct y-centers

**Verification:**
1. Start server and enter training mode
2. Navigate to position [-14, 1.68, -20] (unstable stack location)
3. Confirm the stack now visibly leans with progressive offset (each layer shifted)
4. Confirm the leaning support piece is visible on one side
5. Press E to interact and confirm hazard reporting works
6. Confirm the top box turns green after reporting

---

## Summary of Changes

**Modified files:**
1. `/Users/awnishmehta/Desktop/WareWiseXR_Final_FullStack_v7/js/training.js`

**Modified methods/sections:**
- `_build()` method: Oil spill, safety cones/bollards, chemical drum, trailing cable, damaged pallet, unstable stack (~lines 140-180)
- `forklift()` method: Wheel improvements (~line 204)
- `worker()` method: Head rounding (~line 205)
- `_applySaved()` method: Chemical drum color coordination (~line 183)

**Total changes:**
- 9 distinct object improvements across the warehouse
- ~150-200 lines of new code (mostly new `this.box()` calls)
- All changes maintain existing game logic and hazard interactions

**Verification approach:**
1. Start server: `node server.js`
2. Open browser: `http://127.0.0.1:8080`
3. Log in as an approved employee
4. Enter training mode
5. Systematically visit each improved object location
6. Verify visual improvements
7. Test interactions (hazard reporting, picking up objects, collisions)
8. Confirm no regressions in gameplay

**Decorative box IDs that must NOT conflict with saved state:**
- spillBlob1 through spillBlob8
- bollardL/R*_base, _band1, _band2, _top
- chemDrumBase, chemDrumSlice1-3, chemDrumTop
- wheel*_v, wheel*_h, wheel*_c
- workerHead*_bevel1-8
- looseCable_seg2-6
- damagedPallet_splinter1-3
- stacking_bottom, stacking_middle, stacking_support

These IDs use suffixes and patterns that ensure they won't be saved in `state.hazards` or `state.unsafeActs` arrays, and won't be affected by `_applySaved()`.

---

## Implementation Notes

**Engine limitations accepted:**
- No sphere/cylinder/cone primitives — all approximations use box combinations
- Yaw rotation only (Y-axis) — no pitch/roll for true 3D orientation
- Compound objects don't move together — movable cone stays as single box
- Z-fighting risk managed by offsetting y-positions by ≥0.01 units

**Design decisions:**
- Prioritized visual realism over gameplay changes
- Maintained all existing hazard IDs and interactive behaviors
- Used overlapping boxes to approximate organic/curved shapes
- Applied color variations (darker/lighter shades) for depth perception
- Kept decorative elements non-interactive to avoid game logic conflicts

**Testing priority order:**
1. Oil spill (most visible, Priority 1)
2. Chemical drum (prominent hazard)
3. Safety bollards (repeated throughout warehouse)
4. Unstable stack (demonstrates lean technique)
5. Trailing cable (demonstrates wavy path technique)
6. Damaged pallet (demonstrates detail enhancement)
7. Forklift wheels (demonstrates rounding technique)
8. Worker heads (subtle improvement, low priority)
