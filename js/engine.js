(function () {
  "use strict";
  const M = window.WWMath;
  class WareEngine {
    constructor(canvas) {
      this.canvas = canvas;
      this.gl = null;
      this.program = null;
      this.objects = [];
      this.byId = new Map();
      this.textures = new Map();
      this.textureProgram = null;
      this.planeBuffer = null;
      this.planeVertexCount = 0;
      this.camera = { position: [0, 1.68, 13], yaw: 0, pitch: 0 };
      this.keys = {};
      this.pointerLocked = false;
      this.hovered = null;
      this.carried = null;
      this.running = false;
      this.last = 0;
      this.speed = 4.2;
      this.onInteract = () => {};
      this.onHover = () => {};
      this.onDrop = () => {};
      this.onVRState = () => {};
      this.xrSession = null;
      this.xrBaseRef = null;
      this.xrRef = null;
      this.xrFrame = null;
      this.xrOffset = [0, 0, 0];
      this.xrControllerRay = null;
      this.xrInput = null;
      this._raf = this._frame.bind(this);
      this._xrFrame = this._onXRFrame.bind(this);
    }
    init() {
      const gl = this.canvas.getContext("webgl", {
        antialias: true,
        alpha: false,
        preserveDrawingBuffer: false,
      });
      if (!gl) return false;
      this.gl = gl;
      const vs = `attribute vec3 aPos;attribute vec3 aNormal;uniform mat4 uModel,uView,uProj;varying vec3 vN;varying vec3 vW;void main(){vec4 w=uModel*vec4(aPos,1.0);vW=w.xyz;vN=normalize(mat3(uModel)*aNormal);gl_Position=uProj*uView*w;}`;
      const fs = `precision mediump float;uniform vec3 uColor;uniform float uGlow;varying vec3 vN;varying vec3 vW;void main(){vec3 n=normalize(vN);vec3 ld=normalize(vec3(-0.35,0.9,0.25));float d=max(dot(n,ld),0.0);float amb=0.45;vec3 c=uColor*(amb+d*0.65);c+=uGlow*vec3(0.95,0.72,0.08);float fog=clamp((length(vW.xz)-24.0)/38.0,0.0,0.50);c=mix(c,vec3(0.48,0.52,0.56),fog);gl_FragColor=vec4(c,1.0);}`;
      this.program = this._program(vs, fs);
      gl.useProgram(this.program);
      this.loc = {
        pos: gl.getAttribLocation(this.program, "aPos"),
        normal: gl.getAttribLocation(this.program, "aNormal"),
        model: gl.getUniformLocation(this.program, "uModel"),
        view: gl.getUniformLocation(this.program, "uView"),
        proj: gl.getUniformLocation(this.program, "uProj"),
        color: gl.getUniformLocation(this.program, "uColor"),
        glow: gl.getUniformLocation(this.program, "uGlow"),
      };

      const tvs = `attribute vec3 aPos;attribute vec3 aNormal;attribute vec2 aUV;uniform mat4 uModel,uView,uProj;varying vec2 vUV;varying vec3 vN;varying vec3 vW;void main(){vec4 w=uModel*vec4(aPos,1.0);vW=w.xyz;vN=normalize(mat3(uModel)*aNormal);gl_Position=uProj*uView*w;vUV=aUV;}`;
      const tfs = `precision mediump float;uniform sampler2D uTexture;uniform float uGlow;varying vec2 vUV;varying vec3 vN;varying vec3 vW;void main(){vec4 tex=texture2D(uTexture,vUV);if(tex.a<0.05)discard;vec3 n=normalize(vN);vec3 ld=normalize(vec3(-0.35,0.9,0.25));float d=max(dot(n,ld),0.0);float amb=0.58;vec3 c=tex.rgb*(amb+d*0.52);c+=uGlow*vec3(0.95,0.72,0.08);float fog=clamp((length(vW.xz)-24.0)/38.0,0.0,0.50);c=mix(c,vec3(0.48,0.52,0.56),fog);gl_FragColor=vec4(c,tex.a);}`;
      this.textureProgram = this._program(tvs, tfs);

      this._makeCube();
      this._makeTexturedCube();
      this._makeTexturedPlane();
      this._makeTexturedVerticalPlane();
      this._loadTexture("models/oil_spill_image.png").catch((err) =>
        console.error(err),
      );
      this._loadTexture("models/Unlabelled_chemical_drum.png").catch((err) =>
        console.error(err),
      );
      this._loadTexture("models/trailing_cable.png").catch((err) =>
        console.error(err),
      );
      this._loadTexture("models/damaged_pallet.png").catch((err) =>
        console.error(err),
      );
      this._loadTexture("models/medium_topside.png?v=2").catch((err) =>
        console.error(err),
      );
      this._loadTexture("models/medium_longside.png?v=2").catch((err) =>
        console.error(err),
      );
      this._loadTexture("models/medium_widthside.png?v=2").catch((err) =>
        console.error(err),
      );
      this._loadTexture("models/large_topside.png?v=1").catch((err) =>
        console.error(err),
      );
      this._loadTexture("models/large_longside.png?v=1").catch((err) =>
        console.error(err),
      );
      this._loadTexture("models/large_widthside.png?v=1").catch((err) =>
        console.error(err),
      );
      this._loadTexture("models/small_topside.png?v=1").catch((err) =>
        console.error(err),
      );
      this._loadTexture("models/small_longside.png?v=1").catch((err) =>
        console.error(err),
      );
      this._loadTexture("models/small_widthside.png?v=1").catch((err) =>
        console.error(err),
      );

      gl.enable(gl.DEPTH_TEST);
      gl.enable(gl.CULL_FACE);
      gl.clearColor(0.42, 0.46, 0.5, 1);
      this._bindInputs();
      this.resize();
      addEventListener("resize", () => this.resize());
      return true;
    }
    _shader(type, src) {
      const gl = this.gl,
        s = gl.createShader(type);
      gl.shaderSource(s, src);
      gl.compileShader(s);
      if (!gl.getShaderParameter(s, gl.COMPILE_STATUS))
        throw new Error(gl.getShaderInfoLog(s));
      return s;
    }
    _program(vs, fs) {
      const gl = this.gl,
        p = gl.createProgram();
      gl.attachShader(p, this._shader(gl.VERTEX_SHADER, vs));
      gl.attachShader(p, this._shader(gl.FRAGMENT_SHADER, fs));
      gl.linkProgram(p);
      if (!gl.getProgramParameter(p, gl.LINK_STATUS))
        throw new Error(gl.getProgramInfoLog(p));
      return p;
    }
    _makeCube() {
      const p = [
        -0.5, -0.5, 0.5, 0, 0, 1, 0.5, -0.5, 0.5, 0, 0, 1, 0.5, 0.5, 0.5, 0, 0,
        1, -0.5, -0.5, 0.5, 0, 0, 1, 0.5, 0.5, 0.5, 0, 0, 1, -0.5, 0.5, 0.5, 0,
        0, 1, 0.5, -0.5, -0.5, 0, 0, -1, -0.5, -0.5, -0.5, 0, 0, -1, -0.5, 0.5,
        -0.5, 0, 0, -1, 0.5, -0.5, -0.5, 0, 0, -1, -0.5, 0.5, -0.5, 0, 0, -1,
        0.5, 0.5, -0.5, 0, 0, -1, -0.5, 0.5, 0.5, 0, 1, 0, 0.5, 0.5, 0.5, 0, 1,
        0, 0.5, 0.5, -0.5, 0, 1, 0, -0.5, 0.5, 0.5, 0, 1, 0, 0.5, 0.5, -0.5, 0,
        1, 0, -0.5, 0.5, -0.5, 0, 1, 0, -0.5, -0.5, -0.5, 0, -1, 0, 0.5, -0.5,
        -0.5, 0, -1, 0, 0.5, -0.5, 0.5, 0, -1, 0, -0.5, -0.5, -0.5, 0, -1, 0,
        0.5, -0.5, 0.5, 0, -1, 0, -0.5, -0.5, 0.5, 0, -1, 0, 0.5, -0.5, 0.5, 1,
        0, 0, 0.5, -0.5, -0.5, 1, 0, 0, 0.5, 0.5, -0.5, 1, 0, 0, 0.5, -0.5, 0.5,
        1, 0, 0, 0.5, 0.5, -0.5, 1, 0, 0, 0.5, 0.5, 0.5, 1, 0, 0, -0.5, -0.5,
        -0.5, -1, 0, 0, -0.5, -0.5, 0.5, -1, 0, 0, -0.5, 0.5, 0.5, -1, 0, 0,
        -0.5, -0.5, -0.5, -1, 0, 0, -0.5, 0.5, 0.5, -1, 0, 0, -0.5, 0.5, -0.5,
        -1, 0, 0,
      ];
      const gl = this.gl;
      this.cubeBuffer = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, this.cubeBuffer);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(p), gl.STATIC_DRAW);
      const stride = 24;
      gl.enableVertexAttribArray(this.loc.pos);
      gl.vertexAttribPointer(this.loc.pos, 3, gl.FLOAT, false, stride, 0);
      gl.enableVertexAttribArray(this.loc.normal);
      gl.vertexAttribPointer(this.loc.normal, 3, gl.FLOAT, false, stride, 12);
      this.vertexCount = 36;
    }
    _makeTexturedCube() {
      const p = [
        // Front (+Z): vertices 0..5 -> texLong
        -0.5, -0.5, 0.5, 0, 0, 1, 0, 0, 0.5, -0.5, 0.5, 0, 0, 1, 1, 0, 0.5, 0.5,
        0.5, 0, 0, 1, 1, 1, -0.5, -0.5, 0.5, 0, 0, 1, 0, 0, 0.5, 0.5, 0.5, 0, 0,
        1, 1, 1, -0.5, 0.5, 0.5, 0, 0, 1, 0, 1,

        // Back (-Z): vertices 6..11 -> texLong
        0.5, -0.5, -0.5, 0, 0, -1, 0, 0, -0.5, -0.5, -0.5, 0, 0, -1, 1, 0, -0.5,
        0.5, -0.5, 0, 0, -1, 1, 1, 0.5, -0.5, -0.5, 0, 0, -1, 0, 0, -0.5, 0.5,
        -0.5, 0, 0, -1, 1, 1, 0.5, 0.5, -0.5, 0, 0, -1, 0, 1,

        // Top (+Y): vertices 12..17 -> texTop
        -0.5, 0.5, 0.5, 0, 1, 0, 0, 0, 0.5, 0.5, 0.5, 0, 1, 0, 1, 0, 0.5, 0.5,
        -0.5, 0, 1, 0, 1, 1, -0.5, 0.5, 0.5, 0, 1, 0, 0, 0, 0.5, 0.5, -0.5, 0,
        1, 0, 1, 1, -0.5, 0.5, -0.5, 0, 1, 0, 0, 1,

        // Bottom (-Y): vertices 18..23 -> texTop
        -0.5, -0.5, -0.5, 0, -1, 0, 0, 0, 0.5, -0.5, -0.5, 0, -1, 0, 1, 0, 0.5,
        -0.5, 0.5, 0, -1, 0, 1, 1, -0.5, -0.5, -0.5, 0, -1, 0, 0, 0, 0.5, -0.5,
        0.5, 0, -1, 0, 1, 1, -0.5, -0.5, 0.5, 0, -1, 0, 0, 1,

        // Right (+X): vertices 24..29 -> texWidth
        0.5, -0.5, 0.5, 1, 0, 0, 0, 0, 0.5, -0.5, -0.5, 1, 0, 0, 1, 0, 0.5, 0.5,
        -0.5, 1, 0, 0, 1, 1, 0.5, -0.5, 0.5, 1, 0, 0, 0, 0, 0.5, 0.5, -0.5, 1,
        0, 0, 1, 1, 0.5, 0.5, 0.5, 1, 0, 0, 0, 1,

        // Left (-X): vertices 30..35 -> texWidth
        -0.5, -0.5, -0.5, -1, 0, 0, 0, 0, -0.5, -0.5, 0.5, -1, 0, 0, 1, 0, -0.5,
        0.5, 0.5, -1, 0, 0, 1, 1, -0.5, -0.5, -0.5, -1, 0, 0, 0, 0, -0.5, 0.5,
        0.5, -1, 0, 0, 1, 1, -0.5, 0.5, -0.5, -1, 0, 0, 0, 1,
      ];
      const gl = this.gl;
      this.texturedCubeBuffer = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, this.texturedCubeBuffer);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(p), gl.STATIC_DRAW);
    }
    _makeTexturedPlane() {
      const vertices = new Float32Array([
        -0.5, 0, 0.5, 0, 1, 0, 0, 1, 0.5, 0, 0.5, 0, 1, 0, 1, 1, 0.5, 0, -0.5,
        0, 1, 0, 1, 0, -0.5, 0, 0.5, 0, 1, 0, 0, 1, 0.5, 0, -0.5, 0, 1, 0, 1, 0,
        -0.5, 0, -0.5, 0, 1, 0, 0, 0,
      ]);
      const gl = this.gl;
      this.planeBuffer = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, this.planeBuffer);
      gl.bufferData(gl.ARRAY_BUFFER, vertices, gl.STATIC_DRAW);
      this.planeVertexCount = 6;
    }
    _makeTexturedVerticalPlane() {
      // Upright vertical plane in XY plane facing +Z (front)
      const vertices = new Float32Array([
        -0.5, -0.5, 0, 0, 0, 1, 0, 0, 0.5, -0.5, 0, 0, 0, 1, 1, 0, 0.5, 0.5, 0,
        0, 0, 1, 1, 1, -0.5, -0.5, 0, 0, 0, 1, 0, 0, 0.5, 0.5, 0, 0, 0, 1, 1, 1,
        -0.5, 0.5, 0, 0, 0, 1, 0, 1,
      ]);
      const gl = this.gl;
      this.verticalPlaneBuffer = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, this.verticalPlaneBuffer);
      gl.bufferData(gl.ARRAY_BUFFER, vertices, gl.STATIC_DRAW);
    }
    _loadTexture(path) {
      return new Promise((resolve, reject) => {
        const gl = this.gl;
        const image = new Image();
        image.onload = () => {
          const texture = gl.createTexture();
          gl.bindTexture(gl.TEXTURE_2D, texture);
          gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
          gl.texImage2D(
            gl.TEXTURE_2D,
            0,
            gl.RGBA,
            gl.RGBA,
            gl.UNSIGNED_BYTE,
            image,
          );
          gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
          gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
          // NPOT textures in WebGL 1 cannot use mipmaps
          const pot = (v) => (v & (v - 1)) === 0;
          if (pot(image.width) && pot(image.height)) {
            gl.texParameteri(
              gl.TEXTURE_2D,
              gl.TEXTURE_MIN_FILTER,
              gl.LINEAR_MIPMAP_LINEAR,
            );
            gl.generateMipmap(gl.TEXTURE_2D);
          } else {
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
          }
          gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
          this.textures.set(path, texture);
          this.textures.set(path.split("?")[0], texture);
          console.log(
            "[ENGINE] Texture loaded:",
            path,
            image.width + "x" + image.height,
          );
          resolve(texture);
        };
        image.onerror = () =>
          reject(new Error(`Failed to load texture: ${path}`));
        image.src = path;
      });
    }
    _bindInputs() {
      document.addEventListener("keydown", (e) => {
        this.keys[e.code] = true;
        if (e.code === "KeyE" && (this.pointerLocked || this.xrSession))
          this.interact();
        if (e.code === "KeyG" && (this.pointerLocked || this.xrSession))
          this.drop();
      });
      document.addEventListener("keyup", (e) => {
        this.keys[e.code] = false;
      });
      this.canvas.addEventListener("click", () => {
        if (!this.xrSession && !this.pointerLocked)
          this.canvas.requestPointerLock?.();
      });
      this.canvas.addEventListener("mousedown", (e) => {
        if (e.button === 0 && this.pointerLocked && !this.xrSession)
          this.interact();
      });
      document.addEventListener("pointerlockchange", () => {
        this.pointerLocked = document.pointerLockElement === this.canvas;
      });
      document.addEventListener("mousemove", (e) => {
        if (this.pointerLocked) {
          this.camera.yaw += e.movementX * 0.0022;
          this.camera.pitch -= e.movementY * 0.0022;
          this.camera.pitch = Math.max(
            -1.35,
            Math.min(1.35, this.camera.pitch),
          );
        }
      });
      let touch = null;
      this.canvas.addEventListener(
        "touchstart",
        (e) => {
          if (e.touches.length === 1)
            touch = [e.touches[0].clientX, e.touches[0].clientY];
        },
        { passive: true },
      );
      this.canvas.addEventListener(
        "touchmove",
        (e) => {
          if (touch && e.touches.length === 1) {
            const t = e.touches[0];
            this.camera.yaw += (t.clientX - touch[0]) * 0.005;
            this.camera.pitch -= (t.clientY - touch[1]) * 0.005;
            this.camera.pitch = Math.max(
              -1.35,
              Math.min(1.35, this.camera.pitch),
            );
            touch = [t.clientX, t.clientY];
          }
        },
        { passive: true },
      );
      this.canvas.addEventListener("touchend", () => (touch = null), {
        passive: true,
      });
    }
    resize() {
      const d = Math.min(devicePixelRatio || 1, 1.7),
        w = Math.max(1, innerWidth),
        h = Math.max(1, innerHeight);
      this.canvas.width = Math.round(w * d);
      this.canvas.height = Math.round(h * d);
      if (this.gl && !this.xrSession)
        this.gl.viewport(0, 0, this.canvas.width, this.canvas.height);
    }
    add(o) {
      o = {
        id: "obj" + this.objects.length,
        label: "Object",
        position: [0, 0, 0],
        size: [1, 1, 1],
        yaw: 0,
        color: "#888888",
        solid: false,
        interactive: false,
        kind: "prop",
        ...o,
      };
      o.baseColor = o.color;
      o.visible = o.visible !== false;
      this.objects.push(o);
      this.byId.set(o.id, o);
      return o;
    }
    get(id) {
      return this.byId.get(id);
    }
    remove(id) {
      const o = this.get(id);
      if (!o) return;
      this.objects = this.objects.filter((x) => x !== o);
      this.byId.delete(id);
    }
    clear() {
      this.objects = [];
      this.byId.clear();
      this.carried = null;
    }
    forward() {
      const c = Math.cos(this.camera.pitch);
      return [
        Math.sin(this.camera.yaw) * c,
        Math.sin(this.camera.pitch),
        -Math.cos(this.camera.yaw) * c,
      ];
    }
    flatForward() {
      return M.normalize([
        Math.sin(this.camera.yaw),
        0,
        -Math.cos(this.camera.yaw),
      ]);
    }
    _move(dt) {
      if (!this.pointerLocked || this.xrSession) return;
      let x = 0,
        z = 0;
      if (this.keys.KeyW) z += 1;
      if (this.keys.KeyS) z -= 1;
      if (this.keys.KeyA) x -= 1;
      if (this.keys.KeyD) x += 1;
      if (!x && !z) return;
      const f = this.flatForward(),
        r = [-f[2], 0, f[0]],
        len = Math.hypot(x, z) || 1;
      const dx = ((f[0] * z + r[0] * x) / len) * this.speed * dt,
        dz = ((f[2] * z + r[2] * x) / len) * this.speed * dt;
      const np = [
        this.camera.position[0] + dx,
        this.camera.position[1],
        this.camera.position[2] + dz,
      ];
      if (!this._blocked(np)) this.camera.position = np;
    }
    _blocked(p) {
      if (Math.abs(p[0]) > 19.1 || p[2] > 13.8 || p[2] < -38.5) return true;
      const rad = 0.36,
        feet = p[1] - 1.62,
        head = p[1] + 0.08;
      for (const o of this.objects) {
        if (!o.visible || !o.solid || o === this.carried) continue;
        const minY = o.position[1] - o.size[1] / 2,
          maxY = o.position[1] + o.size[1] / 2;
        if (maxY < feet || minY > head) continue;
        const dx = Math.abs(p[0] - o.position[0]),
          dz = Math.abs(p[2] - o.position[2]);
        if (dx < o.size[0] / 2 + rad && dz < o.size[2] / 2 + rad) return true;
      }
      return false;
    }
    raycast(origin, dir, maxDist = 5.8) {
      let best = null,
        bd = maxDist;
      for (const o of this.objects) {
        if (!o.visible || !o.interactive || o === this.carried) continue;
        const hit = o.hitSize ? { ...o, size: o.hitSize } : o;
        const t = M.rayAABB(origin, dir, hit, maxDist);
        if (t !== null && t < bd) {
          bd = t;
          best = o;
        }
      }
      return best;
    }
    interact(source = "desktop") {
      let o;
      if (source === "vr" && this.xrControllerRay)
        o = this.raycast(
          this.xrControllerRay.origin,
          this.xrControllerRay.dir,
          6.5,
        );
      else o = this.hovered;
      if (o) this.onInteract(o, source);
    }
    pickup(o) {
      if (this.carried || !o) return false;
      this.carried = o;
      o.solid = false;
      o.interactive = false;
      return true;
    }
    drop() {
      if (!this.carried) return;
      const o = this.carried;
      this.carried = null;
      o.solid = true;
      o.interactive = true;
      this.onDrop(o);
    }
    _updateCarry() {
      if (!this.carried) return;
      if (this.xrSession && this.xrControllerRay) {
        const r = this.xrControllerRay;
        this.carried.position = [
          r.origin[0] + r.dir[0] * 1.1,
          r.origin[1] + r.dir[1] * 1.1,
          r.origin[2] + r.dir[2] * 1.1,
        ];
      } else {
        const f = this.forward();
        this.carried.position = [
          this.camera.position[0] + f[0] * 1.85,
          this.camera.position[1] - 0.72 + f[1] * 0.42,
          this.camera.position[2] + f[2] * 1.85,
        ];
        this.carried.yaw = this.camera.yaw;
      }
    }
    _view() {
      const f = this.forward(),
        p = this.camera.position;
      return M.lookAt(p, [p[0] + f[0], p[1] + f[1], p[2] + f[2]]);
    }
    _color(hex) {
      hex = hex.replace("#", "");
      if (hex.length === 3)
        hex = hex
          .split("")
          .map((x) => x + x)
          .join("");
      const n = parseInt(hex, 16);
      return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
    }
    _renderTexturedObject(o, proj, view) {
      const gl = this.gl;
      const texture = this.textures.get(o.texture);
      const isVertical =
        o.planeOrientation === "vertical" || o.vertical === true;
      const buf = isVertical ? this.verticalPlaneBuffer : this.planeBuffer;
      if (!texture) {
        // Texture not loaded yet, render as colored plane fallback
        gl.useProgram(this.program);
        gl.bindBuffer(gl.ARRAY_BUFFER, buf);
        const stride = 32;
        gl.enableVertexAttribArray(this.loc.pos);
        gl.vertexAttribPointer(this.loc.pos, 3, gl.FLOAT, false, stride, 0);
        gl.enableVertexAttribArray(this.loc.normal);
        gl.vertexAttribPointer(this.loc.normal, 3, gl.FLOAT, false, stride, 12);
        gl.uniformMatrix4fv(this.loc.view, false, view);
        gl.uniformMatrix4fv(this.loc.proj, false, proj);
        gl.uniformMatrix4fv(
          this.loc.model,
          false,
          M.model(o.position, o.size, o.yaw || 0),
        );
        const c = this._color(o.color);
        gl.uniform3fv(this.loc.color, c);
        gl.uniform1f(this.loc.glow, o === this.hovered || o.glow ? 0.25 : 0);
        gl.disable(gl.CULL_FACE);
        gl.drawArrays(gl.TRIANGLES, 0, this.planeVertexCount);
        gl.enable(gl.CULL_FACE);
        return;
      }

      // Render with the actual texture using the textureProgram shader
      const prog = this.textureProgram;
      gl.useProgram(prog);

      // Cache uniform/attribute locations for the texture program
      if (!this._texLoc) {
        this._texLoc = {
          pos: gl.getAttribLocation(prog, "aPos"),
          normal: gl.getAttribLocation(prog, "aNormal"),
          uv: gl.getAttribLocation(prog, "aUV"),
          model: gl.getUniformLocation(prog, "uModel"),
          view: gl.getUniformLocation(prog, "uView"),
          proj: gl.getUniformLocation(prog, "uProj"),
          tex: gl.getUniformLocation(prog, "uTexture"),
          glow: gl.getUniformLocation(prog, "uGlow"),
        };
      }
      const loc = this._texLoc;

      gl.bindBuffer(gl.ARRAY_BUFFER, buf);
      // Plane vertex layout: pos(3) normal(3) uv(2) = 8 floats = 32 bytes stride
      const stride = 32;
      gl.enableVertexAttribArray(loc.pos);
      gl.vertexAttribPointer(loc.pos, 3, gl.FLOAT, false, stride, 0);
      if (loc.normal >= 0) {
        gl.enableVertexAttribArray(loc.normal);
        gl.vertexAttribPointer(loc.normal, 3, gl.FLOAT, false, stride, 12);
      }
      gl.enableVertexAttribArray(loc.uv);
      gl.vertexAttribPointer(loc.uv, 2, gl.FLOAT, false, stride, 24);

      gl.uniformMatrix4fv(loc.view, false, view);
      gl.uniformMatrix4fv(loc.proj, false, proj);
      gl.uniform1f(loc.glow, o === this.hovered || o.glow ? 0.25 : 0);

      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, texture);
      gl.uniform1i(loc.tex, 0);

      gl.disable(gl.CULL_FACE);
      gl.enable(gl.BLEND);
      gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

      if (isVertical && o.crossPlane !== false) {
        // Render cross-quad (two vertical planes at 90 deg) for 3D visibility from all camera angles
        const baseYaw = o.yaw || 0;
        gl.uniformMatrix4fv(
          loc.model,
          false,
          M.model(o.position, o.size, baseYaw),
        );
        gl.drawArrays(gl.TRIANGLES, 0, this.planeVertexCount);
        gl.uniformMatrix4fv(
          loc.model,
          false,
          M.model(o.position, o.size, baseYaw + Math.PI / 2),
        );
        gl.drawArrays(gl.TRIANGLES, 0, this.planeVertexCount);
      } else {
        gl.uniformMatrix4fv(
          loc.model,
          false,
          M.model(o.position, o.size, o.yaw || 0),
        );
        if (!isVertical) gl.depthMask(false);
        gl.drawArrays(gl.TRIANGLES, 0, this.planeVertexCount);
        if (!isVertical) gl.depthMask(true);
      }

      gl.disable(gl.BLEND);
      gl.enable(gl.CULL_FACE);
      // Clean up: disable UV attrib so it doesn't bleed into cube draws
      gl.disableVertexAttribArray(loc.uv);
    }
    _renderTexturedBox(o, proj, view) {
      const gl = this.gl;
      const tf = o.texturedFaces;
      if (!tf) return;
      const getTex = (p) => {
        if (!p) return null;
        return this.textures.get(p) || this.textures.get(p.split("?")[0]);
      };
      const texLong = getTex(tf.long || tf.front || tf.side);
      const texTop = getTex(tf.top);
      const texWidth = getTex(tf.width || tf.side);

      // If textures haven't loaded yet, fallback to solid colored cube
      if (!texLong || !texTop || !texWidth) {
        gl.useProgram(this.program);
        gl.bindBuffer(gl.ARRAY_BUFFER, this.cubeBuffer);
        const cStride = 24;
        gl.enableVertexAttribArray(this.loc.pos);
        gl.vertexAttribPointer(this.loc.pos, 3, gl.FLOAT, false, cStride, 0);
        gl.enableVertexAttribArray(this.loc.normal);
        gl.vertexAttribPointer(
          this.loc.normal,
          3,
          gl.FLOAT,
          false,
          cStride,
          12,
        );
        gl.uniformMatrix4fv(this.loc.view, false, view);
        gl.uniformMatrix4fv(this.loc.proj, false, proj);
        const drawSize =
          o === this.carried && !this.xrSession
            ? o.size.map((v) => v * 0.68)
            : o.size;
        const model = o.matrix || M.model(o.position, drawSize, o.yaw || 0),
          c = this._color(o.color);
        gl.uniformMatrix4fv(this.loc.model, false, model);
        gl.uniform3fv(this.loc.color, c);
        gl.uniform1f(this.loc.glow, o === this.hovered || o.glow ? 0.25 : 0);
        gl.drawArrays(gl.TRIANGLES, 0, this.vertexCount);
        return;
      }

      // Render the 3D cube with the 6 cardboard textured faces
      const prog = this.textureProgram;
      gl.useProgram(prog);

      if (!this._texLoc) {
        this._texLoc = {
          pos: gl.getAttribLocation(prog, "aPos"),
          normal: gl.getAttribLocation(prog, "aNormal"),
          uv: gl.getAttribLocation(prog, "aUV"),
          model: gl.getUniformLocation(prog, "uModel"),
          view: gl.getUniformLocation(prog, "uView"),
          proj: gl.getUniformLocation(prog, "uProj"),
          tex: gl.getUniformLocation(prog, "uTexture"),
          glow: gl.getUniformLocation(prog, "uGlow"),
        };
      }
      const loc = this._texLoc;

      gl.bindBuffer(gl.ARRAY_BUFFER, this.texturedCubeBuffer);
      const stride = 32;
      gl.enableVertexAttribArray(loc.pos);
      gl.vertexAttribPointer(loc.pos, 3, gl.FLOAT, false, stride, 0);
      if (loc.normal >= 0) {
        gl.enableVertexAttribArray(loc.normal);
        gl.vertexAttribPointer(loc.normal, 3, gl.FLOAT, false, stride, 12);
      }
      gl.enableVertexAttribArray(loc.uv);
      gl.vertexAttribPointer(loc.uv, 2, gl.FLOAT, false, stride, 24);

      const drawSize =
        o === this.carried && !this.xrSession
          ? o.size.map((v) => v * 0.68)
          : o.size;
      const model = o.matrix || M.model(o.position, drawSize, o.yaw || 0);
      gl.uniformMatrix4fv(loc.model, false, model);
      gl.uniformMatrix4fv(loc.view, false, view);
      gl.uniformMatrix4fv(loc.proj, false, proj);
      gl.uniform1f(loc.glow, o === this.hovered || o.glow ? 0.25 : 0);

      gl.activeTexture(gl.TEXTURE0);
      gl.uniform1i(loc.tex, 0);

      // Long sides (Front + Back faces along +/-Z): 12 vertices
      gl.bindTexture(gl.TEXTURE_2D, texLong);
      gl.drawArrays(gl.TRIANGLES, 0, 12);

      // Top & Bottom sides (faces along +/-Y): 12 vertices
      gl.bindTexture(gl.TEXTURE_2D, texTop);
      gl.drawArrays(gl.TRIANGLES, 12, 12);

      // Width sides (Left & Right faces along +/-X): 12 vertices
      gl.bindTexture(gl.TEXTURE_2D, texWidth);
      gl.drawArrays(gl.TRIANGLES, 24, 12);

      gl.disableVertexAttribArray(loc.uv);
    }
    render(proj, view, viewport) {
      const gl = this.gl;
      if (viewport)
        gl.viewport(viewport.x, viewport.y, viewport.width, viewport.height);
      gl.enable(gl.DEPTH_TEST);
      gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

      for (const o of this.objects) {
        if (!o.visible) continue;
        if (o.texturedFaces) {
          this._renderTexturedBox(o, proj, view);
          continue;
        }
        if (o.texture) {
          this._renderTexturedObject(o, proj, view);
          continue;
        }

        gl.useProgram(this.program);
        gl.bindBuffer(gl.ARRAY_BUFFER, this.cubeBuffer);
        const stride = 24;
        gl.enableVertexAttribArray(this.loc.pos);
        gl.vertexAttribPointer(this.loc.pos, 3, gl.FLOAT, false, stride, 0);
        gl.enableVertexAttribArray(this.loc.normal);
        gl.vertexAttribPointer(this.loc.normal, 3, gl.FLOAT, false, stride, 12);
        gl.uniformMatrix4fv(this.loc.view, false, view);
        gl.uniformMatrix4fv(this.loc.proj, false, proj);
        const drawSize =
          o === this.carried && !this.xrSession
            ? o.size.map((v) => v * 0.68)
            : o.size;
        const model = o.matrix || M.model(o.position, drawSize, o.yaw || 0),
          c = this._color(o.color);
        gl.uniformMatrix4fv(this.loc.model, false, model);
        gl.uniform3fv(this.loc.color, c);
        gl.uniform1f(this.loc.glow, o === this.hovered || o.glow ? 0.25 : 0);
        gl.drawArrays(gl.TRIANGLES, 0, this.vertexCount);
      }

      if (this.carried && !this.xrSession) {
        gl.useProgram(this.program);
        gl.bindBuffer(gl.ARRAY_BUFFER, this.cubeBuffer);
        const stride = 24;
        gl.enableVertexAttribArray(this.loc.pos);
        gl.vertexAttribPointer(this.loc.pos, 3, gl.FLOAT, false, stride, 0);
        gl.enableVertexAttribArray(this.loc.normal);
        gl.vertexAttribPointer(this.loc.normal, 3, gl.FLOAT, false, stride, 12);
        gl.uniformMatrix4fv(this.loc.view, false, view);
        gl.uniformMatrix4fv(this.loc.proj, false, proj);
        const f = this.forward(),
          r = M.normalize([-f[2], 0, f[0]]),
          p = this.camera.position;
        for (const side of [-1, 1]) {
          const hp = [
            p[0] + f[0] * 0.88 + r[0] * side * 0.42,
            p[1] - 0.52 + f[1] * 0.2,
            p[2] + f[2] * 0.88 + r[2] * side * 0.42,
          ];
          gl.uniformMatrix4fv(
            this.loc.model,
            false,
            M.model(hp, [0.22, 0.16, 0.34], this.camera.yaw),
          );
          gl.uniform3fv(this.loc.color, [0.96, 0.72, 0.05]);
          gl.uniform1f(this.loc.glow, 0.08);
          gl.drawArrays(gl.TRIANGLES, 0, this.vertexCount);
        }
      }
      if (this.xrControllerRay) this._renderXRRay(proj, view);
    }
    _renderXRRay(proj, view) {
      const r = this.xrControllerRay;
      if (!r) return;
      const mid = [
        r.origin[0] + r.dir[0] * 1.6,
        r.origin[1] + r.dir[1] * 1.6,
        r.origin[2] + r.dir[2] * 1.6,
      ];
      const yaw = Math.atan2(r.dir[0], -r.dir[2]);
      const pitch = Math.asin(r.dir[1]);
      let model = M.model(mid, [0.012, 0.012, 3.2], yaw);
      this.gl.uniformMatrix4fv(this.loc.model, false, model);
      this.gl.uniform3fv(this.loc.color, [1, 0.75, 0.06]);
      this.gl.uniform1f(this.loc.glow, 0.4);
      this.gl.drawArrays(this.gl.TRIANGLES, 0, this.vertexCount);
    }
    _frame(t) {
      if (!this.running) return;
      const dt = Math.min(0.05, (t - this.last) / 1000 || 0);
      this.last = t;
      if (!this.xrSession) {
        this._move(dt);
        this._updateCarry();
        const f = this.forward();
        this.hovered = this.raycast(this.camera.position, f, 5.8);
        this.onHover(this.hovered);
        const proj = M.perspective(
            Math.PI / 3,
            this.canvas.width / this.canvas.height,
            0.05,
            100,
          ),
          view = this._view();
        this.gl.viewport(0, 0, this.canvas.width, this.canvas.height);
        this.render(proj, view);
      }
      requestAnimationFrame(this._raf);
    }
    start() {
      if (this.running) return;
      this.running = true;
      this.last = performance.now();
      requestAnimationFrame(this._raf);
    }
    stop() {
      this.running = false;
    }
    async vrSupported() {
      return !!(
        navigator.xr &&
        (await navigator.xr
          .isSessionSupported("immersive-vr")
          .catch(() => false))
      );
    }
    async enterVR() {
      if (!navigator.xr)
        throw new Error("WebXR is not available in this browser.");
      if (this.xrSession) return;
      const ok = await navigator.xr.isSessionSupported("immersive-vr");
      if (!ok) throw new Error("No immersive VR device/session is available.");
      await this.gl.makeXRCompatible();
      const s = await navigator.xr.requestSession("immersive-vr", {
        optionalFeatures: ["local-floor", "bounded-floor"],
      });
      this.xrSession = s;
      const layer = new XRWebGLLayer(s, this.gl);
      s.updateRenderState({ baseLayer: layer, depthNear: 0.05, depthFar: 100 });
      this.xrBaseRef = await s
        .requestReferenceSpace("local-floor")
        .catch(() => s.requestReferenceSpace("local"));
      this.xrRef = this.xrBaseRef;
      this.xrOffset = [this.camera.position[0], 0, this.camera.position[2]];
      s.addEventListener("end", () => {
        this.xrSession = null;
        this.xrControllerRay = null;
        this.resize();
        this.onVRState(false);
      });
      s.addEventListener("selectstart", (e) => {
        this._updateController(e.frame, e.inputSource);
        this.interact("vr");
      });
      s.addEventListener("squeezestart", () => this.drop());
      this.onVRState(true);
      s.requestAnimationFrame(this._xrFrame);
    }
    exitVR() {
      this.xrSession?.end();
    }
    _updateController(frame, input) {
      if (!frame || !this.xrRef || !input) return;
      const pose = frame.getPose(input.targetRaySpace, this.xrRef);
      if (!pose) return;
      const m = pose.transform.matrix;
      const origin = [m[12], m[13], m[14]],
        dir = M.normalize([-m[8], -m[9], -m[10]]);
      this.xrControllerRay = { origin, dir };
      this.xrInput = input;
      this.hovered = this.raycast(origin, dir, 6.5);
      this.onHover(this.hovered);
    }
    _xrMove(frame, pose, dt) {
      const s = this.xrSession;
      if (!s) return;
      let ax = 0,
        ay = 0;
      for (const input of s.inputSources) {
        if (input.gamepad) {
          const a = input.gamepad.axes;
          if (a.length >= 4) {
            ax += a[2] || 0;
            ay += a[3] || 0;
          } else if (a.length >= 2) {
            ax += a[0] || 0;
            ay += a[1] || 0;
          }
          this._updateController(frame, input);
        }
      }
      if (Math.hypot(ax, ay) < 0.2 || !pose) return;
      const vm = pose.views[0].transform.matrix;
      let f = M.normalize([-vm[8], 0, -vm[10]]),
        r = [-f[2], 0, f[0]];
      const sp = 2.2 * dt,
        nx = this.xrOffset[0] + (r[0] * ax + f[0] * -ay) * sp,
        nz = this.xrOffset[2] + (r[2] * ax + f[2] * -ay) * sp;
      if (!this._blocked([nx, 1.68, nz])) {
        this.xrOffset[0] = nx;
        this.xrOffset[2] = nz;
      }
      try {
        this.xrRef = this.xrBaseRef.getOffsetReferenceSpace(
          new XRRigidTransform({
            x: -this.xrOffset[0],
            y: 0,
            z: -this.xrOffset[2],
          }),
        );
      } catch (_) {}
    }
    _onXRFrame(t, frame) {
      if (!this.xrSession) return;
      const dt = Math.min(0.05, (t - this.last) / 1000 || 0);
      this.last = t;
      let pose = frame.getViewerPose(this.xrRef);
      if (pose) {
        this._xrMove(frame, pose, dt);
        pose = frame.getViewerPose(this.xrRef) || pose;
        this._updateCarry();
        const gl = this.gl,
          layer = this.xrSession.renderState.baseLayer;
        gl.bindFramebuffer(gl.FRAMEBUFFER, layer.framebuffer);
        for (const view of pose.views) {
          const vp = layer.getViewport(view);
          this.render(view.projectionMatrix, view.transform.inverse.matrix, vp);
        }
      }
      this.xrSession.requestAnimationFrame(this._xrFrame);
    }
  }
  window.WareEngine = WareEngine;
})();
