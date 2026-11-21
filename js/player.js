/* 余痕 · 第一人称行走与攀爬 */
(function (YH) {
  'use strict';

  var T = THREE;

  function Player(camera, dom, colliders) {
    this.camera = camera;
    this.dom = dom;
    this.colliders = colliders;

    this.pos = new T.Vector3(0, 0, 45.5);   // 脚底位置
    this.yaw = 0;                            // 面向 -z
    this.pitch = -0.03;
    this.vy = 0;
    this.grounded = true;
    this.speed = 0;
    this.velocity = new T.Vector3();
    this.bob = 0;
    this.bobPhase = 0;
    this.stepTimer = 0;
    this.radius = 0.34;
    this.eye = 1.62;
    this.height = 1.72;
    this.frozen = false;
    this.locked = false;
    this.climb = null;
    this.keys = {};
    this.onStep = null;
    this.sensitivity = 0.0021;

    this._bind();
  }

  Player.prototype._bind = function () {
    var self = this;

    document.addEventListener('keydown', function (e) {
      self.keys[e.code] = true;
      if (e.code === 'Space') {
        e.preventDefault();
        if (!self.frozen) self.tryClimb();
      }
    });
    document.addEventListener('keyup', function (e) { self.keys[e.code] = false; });

    this.dom.addEventListener('click', function () {
      if (!self.frozen) self.dom.requestPointerLock();
    });

    document.addEventListener('pointerlockchange', function () {
      self.locked = document.pointerLockElement === self.dom;
    });

    document.addEventListener('mousemove', function (e) {
      if (!self.locked || self.frozen) return;
      self.yaw -= e.movementX * self.sensitivity;
      self.pitch -= e.movementY * self.sensitivity;
      self.pitch = Math.max(-1.25, Math.min(1.15, self.pitch));
    });

    // 触屏兜底：拖动转头
    var tx = 0, ty = 0;
    this.dom.addEventListener('touchstart', function (e) {
      if (e.touches.length) { tx = e.touches[0].clientX; ty = e.touches[0].clientY; }
    }, { passive: true });
    this.dom.addEventListener('touchmove', function (e) {
      if (!e.touches.length) return;
      var dx = e.touches[0].clientX - tx;
      var dy = e.touches[0].clientY - ty;
      tx = e.touches[0].clientX; ty = e.touches[0].clientY;
      self.yaw -= dx * 0.005;
      self.pitch = Math.max(-1.2, Math.min(1.1, self.pitch - dy * 0.005));
    }, { passive: true });
  };

  Player.prototype.reset = function (x, y, z, yaw) {
    this.pos.set(x, y, z);
    this.yaw = yaw || 0;
    this.pitch = -0.02;
    this.vy = 0;
    this.climb = null;
    this.speed = 0;
  };

  /* 支撑面高度：地面 0 或脚下箱体顶面 */
  Player.prototype.supportAt = function (x, z, feet) {
    var best = 0;
    var r = this.radius * 0.75;
    for (var i = 0; i < this.colliders.length; i++) {
      var c = this.colliders[i];
      if (x > c.x0 - r && x < c.x1 + r && z > c.z0 - r && z < c.z1 + r) {
        if (c.y1 <= feet + 0.52 && c.y1 > best) best = c.y1;
      }
    }
    return best;
  };

  Player.prototype.blocked = function (x, z, feet) {
    var r = this.radius;
    for (var i = 0; i < this.colliders.length; i++) {
      var c = this.colliders[i];
      if (c.y1 <= feet + 0.45) continue;           // 可踩上去
      if (c.y0 > feet + this.height - 0.1) continue; // 头顶之上
      if (x > c.x0 - r && x < c.x1 + r && z > c.z0 - r && z < c.z1 + r) return c;
    }
    return null;
  };

  /* 把玩家推出箱体 */
  Player.prototype.resolve = function (x, z, feet) {
    var r = this.radius;
    for (var iter = 0; iter < 3; iter++) {
      var hit = null;
      for (var i = 0; i < this.colliders.length; i++) {
        var c = this.colliders[i];
        if (c.y1 <= feet + 0.45) continue;
        if (c.y0 > feet + this.height - 0.1) continue;
        if (x > c.x0 - r && x < c.x1 + r && z > c.z0 - r && z < c.z1 + r) { hit = c; break; }
      }
      if (!hit) break;
      // 最近点法线
      var cx = Math.max(hit.x0, Math.min(x, hit.x1));
      var cz = Math.max(hit.z0, Math.min(z, hit.z1));
      var dx = x - cx, dz = z - cz;
      var d = Math.sqrt(dx * dx + dz * dz);
      if (d > 0.0001) {
        var push = (r - d) + 0.001;
        x += dx / d * push;
        z += dz / d * push;
      } else {
        // 在内部：沿最小穿透方向推出
        var pL = x - hit.x0, pR = hit.x1 - x;
        var pB = z - hit.z0, pF = hit.z1 - z;
        var m = Math.min(pL, pR, pB, pF);
        if (m === pL) x = hit.x0 - r - 0.001;
        else if (m === pR) x = hit.x1 + r + 0.001;
        else if (m === pB) z = hit.z0 - r - 0.001;
        else z = hit.z1 + r + 0.001;
      }
    }
    return { x: x, z: z };
  };

  Player.prototype.forward = function () {
    return new T.Vector3(-Math.sin(this.yaw), 0, -Math.cos(this.yaw));
  };

  /* 找面前可攀的边缘 */
  Player.prototype.findLedge = function () {
    var fwd = this.forward();
    var best = null, bestScore = 1e9;
    for (var i = 0; i < this.colliders.length; i++) {
      var c = this.colliders[i];
      if (!c.climb) continue;
      var rise = c.y1 - this.pos.y;
      if (rise < 0.30 || rise > 1.72) continue;
      var cx = (c.x0 + c.x1) / 2, cz = (c.z0 + c.z1) / 2;
      var dx = cx - this.pos.x, dz = cz - this.pos.z;
      var dist = Math.sqrt(dx * dx + dz * dz);
      var reach = Math.max(c.x1 - c.x0, c.z1 - c.z0) / 2 + 1.5;
      if (dist > reach) continue;
      var dot = (dx * fwd.x + dz * fwd.z) / (dist || 1);
      if (dot < 0.25) continue;
      var score = dist - dot * 1.2 + rise * 0.6;
      if (score < bestScore) { bestScore = score; best = c; }
    }
    return best;
  };

  Player.prototype.tryClimb = function () {
    if (this.climb) return;
    var c = this.findLedge();
    if (!c) return;
    var fwd = this.forward();
    var target = new T.Vector3(
      Math.max(c.x0 + 0.3, Math.min(this.pos.x + fwd.x * 0.85, c.x1 - 0.3)),
      c.y1,
      Math.max(c.z0 + 0.3, Math.min(this.pos.z + fwd.z * 0.85, c.z1 - 0.3))
    );
    this.climb = {
      t: 0,
      dur: 0.58,
      from: this.pos.clone(),
      to: target,
      peak: Math.max(this.pos.y, c.y1) + 0.18
    };
    if (this.onClimb) this.onClimb();
  };

  Player.prototype.update = function (dt) {
    var self = this;
    if (this.frozen && !this.climb) {
      this.applyCamera(0);
      return;
    }

    // 攀爬插值
    if (this.climb) {
      this.climb.t += dt;
      var k = Math.min(1, this.climb.t / this.climb.dur);
      var e = k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2;
      var c = this.climb;
      this.pos.x = c.from.x + (c.to.x - c.from.x) * e;
      this.pos.z = c.from.z + (c.to.z - c.from.z) * e;
      this.pos.y = c.from.y + (c.to.y - c.from.y) * e + Math.sin(k * Math.PI) * 0.16;
      this.applyCamera(dt);
      if (k >= 1) {
        this.pos.copy(c.to);
        this.climb = null;
        this.vy = 0;
      }
      return;
    }

    var kx = 0, kz = 0;
    if (this.keys['KeyW'] || this.keys['ArrowUp']) kz += 1;
    if (this.keys['KeyS'] || this.keys['ArrowDown']) kz -= 1;
    if (this.keys['KeyA'] || this.keys['ArrowLeft']) kx -= 1;
    if (this.keys['KeyD'] || this.keys['ArrowRight']) kx += 1;

    var fwd = this.forward();
    var right = new T.Vector3(-fwd.z, 0, fwd.x);
    var wish = new T.Vector3();
    wish.addScaledVector(fwd, kz);
    wish.addScaledVector(right, kx);
    if (wish.lengthSq() > 0) wish.normalize();

    var targetSpeed = wish.lengthSq() > 0 ? 1.32 : 0;
    this.speed += (targetSpeed - this.speed) * Math.min(1, dt * 7);
    if (this.speed < 0.02) this.speed = 0;

    var move = wish.multiplyScalar(this.speed * dt);
    var nx = this.pos.x + move.x;
    var nz = this.pos.z + move.z;

    // 世界边界
    nx = Math.max(-104, Math.min(104, nx));
    nz = Math.max(-172, Math.min(54, nz));

    var res = this.resolve(nx, nz, this.pos.y);
    this.pos.x = res.x;
    this.pos.z = res.z;

    // 竖直
    var support = this.supportAt(this.pos.x, this.pos.z, this.pos.y);
    if (this.pos.y > support + 0.02) {
      this.vy -= 9.4 * dt;
      this.pos.y += this.vy * dt;
      if (this.pos.y <= support) { this.pos.y = support; this.vy = 0; this.grounded = true; }
      else this.grounded = false;
    } else {
      this.pos.y = support;
      this.vy = 0;
      this.grounded = true;
    }

    // 脚步与呼吸
    if (this.speed > 0.25 && this.grounded) {
      this.bobPhase += dt * (5.2 + this.speed * 1.2);
      this.stepTimer -= dt;
      if (this.stepTimer <= 0) {
        this.stepTimer = 0.72;
        if (this.onStep) this.onStep();
      }
    } else {
      this.bobPhase += dt * 0.9;
    }
    this.applyCamera(dt);
  };

  Player.prototype.applyCamera = function (dt) {
    var walking = this.speed > 0.25;
    var amp = walking ? 0.028 : 0.006;
    this.bob += ((walking ? Math.sin(this.bobPhase) : Math.sin(this.bobPhase * 0.5) * 0.35) * amp - this.bob) * Math.min(1, dt * 9);
    var cam = this.camera;
    var t = performance.now() * 0.001;
    // 手持感：极缓慢的漂移 + 呼吸，让画面不像固定机位
    var driftY = Math.sin(t * 0.21) * 0.0015 + Math.sin(t * 0.37 + 1.3) * 0.0007;
    var driftX = Math.sin(t * 0.17 + 2.1) * 0.0011;
    var breath = Math.sin(this.bobPhase * 0.5) * (walking ? 0.0026 : 0.0016);

    cam.position.set(
      this.pos.x + Math.sin(t * 0.29) * 0.006,
      this.pos.y + this.eye + this.bob,
      this.pos.z
    );
    cam.rotation.order = 'YXZ';
    cam.rotation.y = this.yaw + driftY;
    cam.rotation.x = this.pitch + driftX + breath;
    cam.rotation.z = Math.sin(this.bobPhase * 0.5) * (walking ? 0.011 : 0.003) + Math.sin(t * 0.23) * 0.0012;
  };

  /* 手持物：挂在相机前下方 */
  Player.prototype.attachHand = function (obj) {
    if (!obj) return;
    obj.position.set(0.20, -0.20, -0.40);
    obj.rotation.set(-0.25, 0.35, 0.12);
    obj.scale.multiplyScalar(1.0);
    this.camera.add(obj);
  };

  YH.Player = Player;
})(window.YH = window.YH || {});
