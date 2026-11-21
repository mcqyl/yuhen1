/* 余痕 · 世界构建（地形 / 废墟 / 可攀爬物 / 碎片 / 雾区） */
(function (YH) {
  'use strict';

  var W = {};
  var T = THREE;

  var WORLD = { x0: -160, x1: 160, z0: -180, z1: 60 };

  var scene, root, stoneMat, stoneDarkMat, stoneMat3, woodMat, metalMat, ceramicMat;
  var fragGroup, colliders = [], fragments = [], clouds = [], grassMesh, waterMesh, sunSprite;
  var skyMat, fog, fragLights = [], pmrem = null, mistBanks = [], dust = null, hemiLight = null;
  var gradeTarget = null, envTex = null;
  var clockT = 0;
  var fogTarget = { color: new T.Color(0xd9d0c1), density: 0.011 };
  var stageNow = 0;

  /* ---------------- 程序化贴图 ---------------- */

  function cv(w, h) {
    var c = document.createElement('canvas');
    c.width = w; c.height = h;
    return c;
  }

  /* ---------------- 程序化噪声与贴图 ---------------- */

  // 可平铺哈希噪声
  function hash2(x, y, seed) {
    var n = Math.sin(x * 127.1 + y * 311.7 + seed * 74.7) * 43758.5453;
    return n - Math.floor(n);
  }

  function pnoise(x, y, period, seed) {
    var xi = Math.floor(x), yi = Math.floor(y);
    var xf = x - xi, yf = y - yi;
    var u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
    var p = Math.max(1, Math.round(period));
    function h(a, b) {
      a = ((a % p) + p) % p; b = ((b % p) + p) % p;
      return hash2(a, b, seed);
    }
    var a = h(xi, yi), b = h(xi + 1, yi), c = h(xi, yi + 1), d = h(xi + 1, yi + 1);
    return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
  }

  function fbm(x, y, period, oct, seed) {
    var s = 0, amp = 0.5, f = 1, norm = 0;
    for (var i = 0; i < oct; i++) {
      s += pnoise(x * f, y * f, period * f, seed + i * 13) * amp;
      norm += amp; amp *= 0.5; f *= 2;
    }
    return s / norm;
  }

  // 由高度场生成法线贴图（切线空间）
  function normalMap(size, field, strength) {
    var c = cv(size, size), g = c.getContext('2d');
    var img = g.createImageData(size, size), d = img.data;
    var e = 1 / size;
    for (var y = 0; y < size; y++) {
      var v = y / size;
      for (var x = 0; x < size; x++) {
        var u = x / size;
        var dx = (field(u + e, v) - field(u - e, v)) * strength;
        var dy = (field(u, v + e) - field(u, v - e)) * strength;
        var nx = -dx, ny = -dy, l = Math.sqrt(nx * nx + ny * ny + 1);
        var i = (y * size + x) * 4;
        d[i] = (nx / l * 0.5 + 0.5) * 255;
        d[i + 1] = (ny / l * 0.5 + 0.5) * 255;
        d[i + 2] = (1 / l * 0.5 + 0.5) * 255;
        d[i + 3] = 255;
      }
    }
    g.putImageData(img, 0, 0);
    var t = new T.CanvasTexture(c);
    t.wrapS = t.wrapT = T.RepeatWrapping;
    t.anisotropy = 4;
    return t;
  }

  function stoneSet() {
    var S = 512, c = cv(S, S), g = c.getContext('2d');

    var bg = g.createLinearGradient(0, 0, S, S);
    bg.addColorStop(0, '#8d8679');
    bg.addColorStop(0.5, '#9d9689');
    bg.addColorStop(1, '#7c7568');
    g.fillStyle = bg;
    g.fillRect(0, 0, S, S);

    // 大块色斑
    for (var i = 0; i < 220; i++) {
      var x = Math.random() * S, y = Math.random() * S, r = 12 + Math.random() * 76;
      var rg = g.createRadialGradient(x, y, 0, x, y, r);
      var t = Math.random();
      var col = t > 0.55 ? '188,180,166' : t > 0.25 ? '122,114,102' : '152,144,130';
      rg.addColorStop(0, 'rgba(' + col + ',' + (0.09 + Math.random() * 0.20) + ')');
      rg.addColorStop(1, 'rgba(' + col + ',0)');
      g.fillStyle = rg;
      g.beginPath(); g.arc(x, y, r, 0, 6.2832); g.fill();
    }

    // 砌缝
    for (var row = 0; row < 7; row++) {
      var yy = row * (S / 7) + (Math.random() - 0.5) * 6;
      g.strokeStyle = 'rgba(46,42,36,' + (0.32 + Math.random() * 0.22) + ')';
      g.lineWidth = 3.0;
      g.beginPath(); g.moveTo(-4, yy);
      for (var sx = 0; sx <= S; sx += 64) g.lineTo(sx, yy + (Math.random() - 0.5) * 4);
      g.stroke();
      for (var vx = 0; vx < 3; vx++) {
        var px = (vx + Math.random() * 0.7) * (S / 3);
        g.beginPath(); g.moveTo(px, yy); g.lineTo(px + (Math.random() - 0.5) * 5, yy + S / 7); g.stroke();
      }
    }

    // 裂纹
    for (var ck = 0; ck < 9; ck++) {
      var cx = Math.random() * S, cy = Math.random() * S, a0 = Math.random() * 6.28;
      g.strokeStyle = 'rgba(46,42,36,' + (0.18 + Math.random() * 0.22) + ')';
      g.lineWidth = 0.8 + Math.random() * 1.3;
      g.beginPath(); g.moveTo(cx, cy);
      for (var st = 0; st < 14; st++) {
        a0 += (Math.random() - 0.5) * 1.1;
        cx += Math.cos(a0) * (4 + Math.random() * 9);
        cy += Math.sin(a0) * (4 + Math.random() * 9);
        g.lineTo(cx, cy);
      }
      g.stroke();
    }

    // 苔藓
    for (var m = 0; m < 34; m++) {
      var mx = Math.random() * S, my = Math.random() * S, mr = 10 + Math.random() * 34;
      var mg = g.createRadialGradient(mx, my, 0, mx, my, mr);
      mg.addColorStop(0, 'rgba(92,106,64,.52)');
      mg.addColorStop(0.55, 'rgba(84,98,60,.24)');
      mg.addColorStop(1, 'rgba(88,100,64,0)');
      g.fillStyle = mg;
      g.beginPath(); g.arc(mx, my, mr, 0, 6.2832); g.fill();
    }

    // 细颗粒
    for (var q = 0; q < 22000; q++) {
      var vv = 108 + Math.random() * 112;
      g.fillStyle = 'rgba(' + (vv | 0) + ',' + ((vv - 4) | 0) + ',' + ((vv - 12) | 0) + ',' + (Math.random() * 0.36) + ')';
      g.fillRect(Math.random() * S, Math.random() * S, 1 + Math.random() * 2, 1 + Math.random() * 2);
    }

    var albedo = new T.CanvasTexture(c);
    albedo.wrapS = albedo.wrapT = T.RepeatWrapping;
    albedo.colorSpace = T.SRGBColorSpace;
    albedo.anisotropy = 8;

    // 粗糙度
    var rc = cv(256, 256), rg2 = rc.getContext('2d');
    rg2.fillStyle = '#dcdcdc';
    rg2.fillRect(0, 0, 256, 256);
    for (var q2 = 0; q2 < 8000; q2++) {
      var gv = 165 + Math.random() * 85;
      rg2.fillStyle = 'rgba(' + (gv | 0) + ',' + (gv | 0) + ',' + (gv | 0) + ',' + (Math.random() * 0.45) + ')';
      rg2.fillRect(Math.random() * 256, Math.random() * 256, 1 + Math.random() * 3, 1 + Math.random() * 3);
    }
    var rough = new T.CanvasTexture(rc);
    rough.wrapS = rough.wrapT = T.RepeatWrapping;

    // 法线：大起伏 + 细颗粒 + 砌缝
    var nrm = normalMap(256, function (u, v) {
      var f = fbm(u * 6, v * 6, 6, 4, 3) * 0.52
            + fbm(u * 22, v * 22, 22, 3, 11) * 0.28
            + pnoise(u * 96, v * 96, 96, 21) * 0.20;
      var seam = Math.abs(((v * 7) % 1) - 0.5);
      f -= Math.max(0, 0.05 - seam) * 3.4;
      return f;
    }, 2.6);

    return { albedo: albedo, normal: nrm, rough: rough };
  }

  function barkSet() {
    var W = 256, H = 512, c = cv(W, H), g = c.getContext('2d');
    g.fillStyle = '#5b5044';
    g.fillRect(0, 0, W, H);

    for (var i = 0; i < 150; i++) {
      var x = Math.random() * W;
      g.strokeStyle = 'rgba(' + (26 + Math.random() * 42 | 0) + ',' + (22 + Math.random() * 34 | 0) + ',' + (18 + Math.random() * 28 | 0) + ',' + (0.16 + Math.random() * 0.44) + ')';
      g.lineWidth = 1 + Math.random() * 7;
      g.beginPath(); g.moveTo(x, -10);
      for (var y = 0; y <= H + 20; y += 26) g.lineTo(x + Math.sin(y * 0.03 + i) * 5 + (Math.random() - 0.5) * 3, y);
      g.stroke();
    }
    for (var k = 0; k < 60; k++) {
      var hx = Math.random() * W;
      g.strokeStyle = 'rgba(154,136,110,' + (0.05 + Math.random() * 0.12) + ')';
      g.lineWidth = 1 + Math.random() * 3;
      g.beginPath(); g.moveTo(hx, 0);
      for (var hy = 0; hy <= H; hy += 30) g.lineTo(hx + Math.sin(hy * 0.02 + k) * 4, hy);
      g.stroke();
    }
    for (var m = 0; m < 14; m++) {
      var mx = Math.random() * W, my = Math.random() * H, mr = 8 + Math.random() * 22;
      var mg = g.createRadialGradient(mx, my, 0, mx, my, mr);
      mg.addColorStop(0, 'rgba(92,106,62,.34)');
      mg.addColorStop(1, 'rgba(92,106,62,0)');
      g.fillStyle = mg;
      g.beginPath(); g.arc(mx, my, mr, 0, 6.2832); g.fill();
    }

    var albedo = new T.CanvasTexture(c);
    albedo.wrapS = albedo.wrapT = T.RepeatWrapping;
    albedo.colorSpace = T.SRGBColorSpace;
    albedo.anisotropy = 4;

    var nrm = normalMap(256, function (u, v) {
      return pnoise(u * 15, v * 3, 15, 7) * 0.62 + pnoise(u * 42, v * 10, 42, 13) * 0.38;
    }, 3.2);

    return { albedo: albedo, normal: nrm };
  }

  function groundTexture() {
    var S = 2048, c = cv(S, S * 0.75), g = c.getContext('2d');
    var H = S * 0.75;
    function px(x) { return (x - WORLD.x0) / (WORLD.x1 - WORLD.x0) * S; }
    function py(z) { return (WORLD.z1 - z) / (WORLD.z1 - WORLD.z0) * H; }

    var base = g.createLinearGradient(0, 0, 0, H);
    base.addColorStop(0, '#4c5138');
    base.addColorStop(0.45, '#43482f');
    base.addColorStop(1, '#383d29');
    g.fillStyle = base;
    g.fillRect(0, 0, S, H);

    for (var i = 0; i < 1100; i++) {
      var x = Math.random() * S, y = Math.random() * H;
      var r = 20 + Math.random() * 130;
      var rg = g.createRadialGradient(x, y, 0, x, y, r);
      var tone = Math.random();
      var col = tone > 0.62 ? '96,104,68' : tone > 0.3 ? '80,86,58' : '112,106,76';
      rg.addColorStop(0, 'rgba(' + col + ',' + (0.05 + Math.random() * 0.13) + ')');
      rg.addColorStop(1, 'rgba(' + col + ',0)');
      g.fillStyle = rg;
      g.beginPath(); g.arc(x, y, r, 0, 6.29); g.fill();
    }

    // 中频斑驳：0.5 - 2 米的枯草/裸土
    for (var mi2 = 0; mi2 < 3200; mi2++) {
      var mx2 = Math.random() * S, my2 = Math.random() * H;
      var mr2 = 2 + Math.random() * 10;
      var mv = Math.random();
      var mc = mv > 0.72 ? '124,120,74' : mv > 0.42 ? '72,76,50' : '92,80,56';
      var mg2 = g.createRadialGradient(mx2, my2, 0, mx2, my2, mr2);
      mg2.addColorStop(0, 'rgba(' + mc + ',' + (0.10 + Math.random() * 0.28) + ')');
      mg2.addColorStop(1, 'rgba(' + mc + ',0)');
      g.fillStyle = mg2;
      g.beginPath(); g.arc(mx2, my2, mr2, 0, 6.2832); g.fill();
    }

    // 土路
    var pathZ = [56, 44, 30, 16, 4, -8, -20, -34, -48, -62, -76, -92, -106, -120, -134, -150, -168];
    var pathX = [0, 0.4, -0.6, 0.8, 1.8, 0.4, -1.2, 0.2, 1.2, -0.6, 0.4, -0.8, 0.6, -0.4, 0, 0.3, 0];
    function strokePath(width, color, blur) {
      g.save();
      g.lineCap = 'round';
      g.lineJoin = 'round';
      g.strokeStyle = color;
      g.lineWidth = width;
      if (blur) g.filter = 'blur(' + blur + 'px)';
      g.beginPath();
      for (var k = 0; k < pathZ.length; k++) {
        var X = px(pathX[k]), Y = py(pathZ[k]);
        if (k === 0) g.moveTo(X, Y); else g.lineTo(X, Y);
      }
      g.stroke();
      g.restore();
    }
    strokePath(26, 'rgba(74,70,58,.30)', 12);
    strokePath(17, 'rgba(88,83,70,.52)', 7);
    strokePath(11, '#5c574b', 3);
    strokePath(6, '#686254', 2);

    g.save();
    g.globalAlpha = 0.35;
    for (var d = 0; d < 2600; d++) {
      var tz = Math.random() * 2 - 1;
      var idx = Math.floor(Math.random() * (pathZ.length - 1));
      var zz = pathZ[idx] + (Math.random() - 0.5) * 10;
      var xx = pathX[idx] + tz * 2.4;
      g.fillStyle = Math.random() > 0.5 ? '#7d7667' : '#a0998a';
      g.fillRect(px(xx) + Math.random() * 4, py(zz) + Math.random() * 4, 1 + Math.random() * 2.5, 1 + Math.random() * 2);
    }
    g.restore();

    var puddles = [[-14, 4, 5], [10, -30, 4], [-6, -60, 6], [4, -96, 5], [-18, -118, 7]];
    puddles.forEach(function (p) {
      var rg = g.createRadialGradient(px(p[0]), py(p[1]), 0, px(p[0]), py(p[1]), p[2] * 4.6);
      rg.addColorStop(0, 'rgba(120,132,134,.55)');
      rg.addColorStop(0.7, 'rgba(120,132,134,.28)');
      rg.addColorStop(1, 'rgba(120,132,134,0)');
      g.fillStyle = rg;
      g.beginPath(); g.arc(px(p[0]), py(p[1]), p[2] * 4.6, 0, 6.29); g.fill();
    });

    var img = g.getImageData(0, 0, S, H);
    var dd = img.data;
    for (var q = 0; q < dd.length; q += 4) {
      var n = (Math.random() - 0.5) * 15;
      dd[q] = Math.max(0, Math.min(255, dd[q] + n));
      dd[q + 1] = Math.max(0, Math.min(255, dd[q + 1] + n));
      dd[q + 2] = Math.max(0, Math.min(255, dd[q + 2] + n));
    }
    g.putImageData(img, 0, 0);

    var tex = new T.CanvasTexture(c);
    tex.flipY = false;
    tex.colorSpace = T.SRGBColorSpace;
    tex.anisotropy = 8;
    return tex;
  }

  // 地面细节层：近距离的草叶、土粒，补偿贴图分辨率
  function floorDetailTexture() {
    var S = 256, c = cv(S, S), g = c.getContext('2d');
    g.fillStyle = '#9a9a9a';
    g.fillRect(0, 0, S, S);
    // 大块斑驳
    for (var i = 0; i < 90; i++) {
      var x = Math.random() * S, y = Math.random() * S, r = 10 + Math.random() * 40;
      var rg = g.createRadialGradient(x, y, 0, x, y, r);
      var v = Math.random() > 0.5 ? 235 : 74;
      rg.addColorStop(0, 'rgba(' + v + ',' + v + ',' + v + ',' + (0.10 + Math.random() * 0.26) + ')');
      rg.addColorStop(1, 'rgba(' + v + ',' + v + ',' + v + ',0)');
      g.fillStyle = rg;
      g.beginPath(); g.arc(x, y, r, 0, 6.2832); g.fill();
    }
    // 草叶短笔触
    g.lineCap = 'round';
    for (var k = 0; k < 2600; k++) {
      var sx = Math.random() * S, sy = Math.random() * S;
      var l = 2 + Math.random() * 7;
      var lean = (Math.random() - 0.5) * 4;
      var tone = 40 + Math.random() * 180;
      g.strokeStyle = 'rgba(' + (tone | 0) + ',' + ((tone * 1.05) | 0) + ',' + ((tone * 0.75) | 0) + ',' + (0.2 + Math.random() * 0.55) + ')';
      g.lineWidth = 0.6 + Math.random() * 1.1;
      g.beginPath(); g.moveTo(sx, sy); g.lineTo(sx + lean, sy - l); g.stroke();
    }
    // 土粒
    for (var d = 0; d < 1600; d++) {
      var dv = 140 + Math.random() * 100;
      g.fillStyle = 'rgba(' + (dv | 0) + ',' + ((dv * 0.94) | 0) + ',' + ((dv * 0.82) | 0) + ',' + (0.18 + Math.random() * 0.3) + ')';
      g.fillRect(Math.random() * S, Math.random() * S, 1 + Math.random() * 2, 1 + Math.random() * 2);
    }
    var t = new T.CanvasTexture(c);
    t.wrapS = t.wrapT = T.RepeatWrapping;
    t.colorSpace = T.SRGBColorSpace;
    t.anisotropy = 8;
    return t;
  }

  function groundNormalMap() {
    var t = normalMap(256, function (u, v) {
      return fbm(u * 9, v * 9, 9, 4, 31) * 0.58 + pnoise(u * 44, v * 44, 44, 41) * 0.42;
    }, 2.0);
    t.flipY = false;
    t.repeat.set(52, 52);
    return t;
  }

  function mistTexture() {
    var S = 256, c = cv(S, S), g = c.getContext('2d');
    var img = g.createImageData(S, S), d = img.data;
    for (var y = 0; y < S; y++) {
      for (var x = 0; x < S; x++) {
        var u = x / S, v = y / S;
        var n = fbm(u * 4, v * 4, 4, 4, 5);
        var dx = (u - 0.5) * 2, dy = (v - 0.5) * 2;
        var r = Math.sqrt(dx * dx + dy * dy);
        var a = Math.max(0, 1 - r) * (0.42 + n * 0.95);
        a = Math.max(0, Math.min(1, a * a * 1.4));
        var i = (y * S + x) * 4;
        d[i] = d[i + 1] = d[i + 2] = 255;
        d[i + 3] = a * 255;
      }
    }
    g.putImageData(img, 0, 0);
    var t = new T.CanvasTexture(c);
    t.colorSpace = T.SRGBColorSpace;
    return t;
  }

  function glowTexture(inner, outer) {
    var c = cv(128, 128), g = c.getContext('2d');
    var rg = g.createRadialGradient(64, 64, 0, 64, 64, 64);
    rg.addColorStop(0, inner || 'rgba(255,244,220,1)');
    rg.addColorStop(0.35, outer || 'rgba(255,232,190,.36)');
    rg.addColorStop(1, 'rgba(255,230,190,0)');
    g.fillStyle = rg;
    g.fillRect(0, 0, 128, 128);
    var tex = new T.CanvasTexture(c);
    tex.colorSpace = T.SRGBColorSpace;
    return tex;
  }

  // 环境光照贴图（等距柱状），由各段天色生成
  function envEquirect(top, mid, bot, sunCol, sunK) {
    var W = 256, H = 128, c = cv(W, H), g = c.getContext('2d');
    var lg = g.createLinearGradient(0, 0, 0, H);
    lg.addColorStop(0, '#' + top.toString(16).padStart(6, '0'));
    lg.addColorStop(0.42, '#' + mid.toString(16).padStart(6, '0'));
    lg.addColorStop(0.52, '#' + bot.toString(16).padStart(6, '0'));
    lg.addColorStop(1, '#3c3a32');
    g.fillStyle = lg;
    g.fillRect(0, 0, W, H);
    // 太阳
    var sx = W * 0.34, sy = H * 0.42;
    var rg = g.createRadialGradient(sx, sy, 0, sx, sy, W * 0.22);
    rg.addColorStop(0, '#' + sunCol.toString(16).padStart(6, '0'));
    rg.addColorStop(1, 'rgba(255,240,210,0)');
    g.globalAlpha = Math.min(1, 0.55 + sunK * 0.45);
    g.fillStyle = rg;
    g.fillRect(0, 0, W, H);
    g.globalAlpha = 1;
    var t = new T.CanvasTexture(c);
    t.mapping = T.EquirectangularReflectionMapping;
    t.colorSpace = T.SRGBColorSpace;
    return t;
  }

  /* ---------------- 碰撞 ---------------- */

  function addCollider(x, z, w, d, y0, y1, climb) {
    colliders.push({
      x0: x - w / 2, x1: x + w / 2,
      z0: z - d / 2, z1: z + d / 2,
      y0: y0, y1: y1, climb: !!climb
    });
  }

  /* ---------------- 几何合并 ---------------- */

  function mergeGeos(list) {
    var pos = [], nor = [], uv = [], idx = [], off = 0;
    for (var gi = 0; gi < list.length; gi++) {
      var g = list[gi];
      var p = g.attributes.position, n = g.attributes.normal, u = g.attributes.uv;
      for (var i = 0; i < p.count; i++) {
        pos.push(p.getX(i), p.getY(i), p.getZ(i));
        nor.push(n.getX(i), n.getY(i), n.getZ(i));
        uv.push(u ? u.getX(i) : 0, u ? u.getY(i) : 0);
      }
      if (g.index) {
        for (var k = 0; k < g.index.count; k++) idx.push(g.index.getX(k) + off);
      } else {
        for (var k2 = 0; k2 < p.count; k2++) idx.push(k2 + off);
      }
      off += p.count;
    }
    var out = new T.BufferGeometry();
    out.setAttribute('position', new T.Float32BufferAttribute(pos, 3));
    out.setAttribute('normal', new T.Float32BufferAttribute(nor, 3));
    out.setAttribute('uv', new T.Float32BufferAttribute(uv, 2));
    out.setIndex(idx);
    out.computeBoundingSphere();
    return out;
  }

  /* ---------------- 几何：缺口石块 ---------------- */

  var geoCache = {};
  var geoCacheKeys = 0;

  // 基础环境光遮蔽：把底部的暗、顶部的亮烘进顶点色
  function paintAO(geo, dark, tint) {
    var pos = geo.attributes.position;
    var yMin = Infinity, yMax = -Infinity;
    for (var i = 0; i < pos.count; i++) {
      var y = pos.getY(i);
      if (y < yMin) yMin = y;
      if (y > yMax) yMax = y;
    }
    var span = Math.max(0.001, yMax - yMin);
    var k = dark == null ? 0.66 : dark;
    var tr = tint ? tint[0] : 1, tg = tint ? tint[1] : 1, tb = tint ? tint[2] : 1;
    var col = [];
    for (var j = 0; j < pos.count; j++) {
      var t = (pos.getY(j) - yMin) / span;
      var v = k + (1 - k) * Math.pow(t, 0.75);
      col.push(v * tr, v * 0.995 * tg, v * 0.985 * tb);
    }
    geo.setAttribute('color', new T.Float32BufferAttribute(col, 3));
    return geo;
  }

  // 每个石块一个确定性的色偏：同尺寸的石块也不会像一个模子印出来的
  function seedTint(sd) {
    var r0 = Math.abs(Math.sin(sd * 127.1) * 43758.5453) % 1;
    var r1 = Math.abs(Math.sin(sd * 311.7 + 1.7) * 24634.6345) % 1;
    var r2 = Math.abs(Math.sin(sd * 74.7 + 3.1) * 96321.4321) % 1;
    return [0.90 + r0 * 0.17, 0.90 + r1 * 0.15, 0.88 + r2 * 0.15];
  }

  // 按世界尺度重算盒子 UV：石材纹理在不同尺寸的石块上密度一致，不会被拉伸成横条
  function boxWorldUV(geo, tile) {
    var pos = geo.attributes.position, nor = geo.attributes.normal, uv = geo.attributes.uv;
    if (!uv) return geo;
    var t = tile || 1.7;
    for (var i = 0; i < pos.count; i++) {
      var ax = Math.abs(nor.getX(i)), ay = Math.abs(nor.getY(i)), az = Math.abs(nor.getZ(i));
      var x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
      var u, v;
      if (ax >= ay && ax >= az) { u = z / t; v = y / t; }
      else if (ay >= ax && ay >= az) { u = x / t; v = z / t; }
      else { u = x / t; v = y / t; }
      uv.setXY(i, u, v);
    }
    uv.needsUpdate = true;
    return geo;
  }

  function chippedBox(w, h, d, amp, seed) {
    var key = w.toFixed(2) + '_' + h.toFixed(2) + '_' + d.toFixed(2) + '_' + amp.toFixed(3) + '_' + (seed | 0);
    var hit = geoCache[key];
    if (hit) return hit;
    var g = new T.BoxGeometry(w, h, d, 2, 2, 2);
    boxWorldUV(g, 1.75);
    var pos = g.attributes.position;
    var sd = (seed | 0) + 1;
    // 按顶点原始坐标做确定性抖动：棱上被复制的顶点位移一致，不会裂缝
    for (var i = 0; i < pos.count; i++) {
      var x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
      var hx = pnoise(x * 4.3 + z * 1.7 + 24, y * 4.1 + z * 2.3 + 24, 1024, sd);
      var hy = pnoise(z * 3.7 + 48, x * 3.3 + y * 2.9 + 48, 1024, sd + 3);
      var hz = pnoise(y * 4.7 + 72, z * 3.9 + x * 1.3 + 72, 1024, sd + 7);
      pos.setXYZ(i,
        x + (hx - 0.5) * 2 * amp,
        y + (hy - 0.5) * 1.5 * amp,
        z + (hz - 0.5) * 2 * amp);
    }
    g.computeVertexNormals();
    paintAO(g, 0.7, seedTint(sd));
    if (geoCacheKeys > 900) { geoCache = {}; geoCacheKeys = 0; }
    geoCache[key] = g;
    geoCacheKeys++;
    return g;
  }

  function boxMesh(x, y, z, w, h, d, mat, ry, collide, climb) {
    var thin = Math.min(w, Math.min(h, d));
    var geo = thin > 0.3
      ? chippedBox(w, h, d, Math.min(0.045, thin * 0.11), Math.round(Math.abs(x * 13 + z * 7 + h * 53)) % 991)
      : paintAO(boxWorldUV(new T.BoxGeometry(w, h, d), 1.75), 0.7);
    var m = new T.Mesh(geo, mat);
    m.position.set(x, y + h / 2, z);
    if (ry) m.rotation.y = ry;
    m.castShadow = true; m.receiveShadow = true;
    root.add(m);
    if (collide) addCollider(x, z, w, d, y, y + h, climb);
    return m;
  }

  /* ---------------- 废墟部件 ---------------- */

  // 一段会断的墙：沿 (x1,z1)->(x2,z2)
  function wall(x1, z1, x2, z2, h, thick, opt) {
    opt = opt || {};
    var dx = x2 - x1, dz = z2 - z1;
    var len = Math.sqrt(dx * dx + dz * dz);
    var ang = Math.atan2(dx, dz);
    var seg = opt.seg || 2.4;
    var n = Math.max(1, Math.round(len / seg));
    var stepX = dx / n, stepZ = dz / n;
    var alongX = Math.abs(stepX) > Math.abs(stepZ);

    for (var i = 0; i < n; i++) {
      var cx = x1 + stepX * (i + 0.5);
      var cz = z1 + stepZ * (i + 0.5);
      var w = alongX ? Math.abs(stepX) : thick;
      var d = alongX ? thick : Math.abs(stepZ);

      // 连续基座：保证整段墙连成一体，不至于碎成一个个方块
      var hb = h * (0.42 + Math.random() * 0.16);
      var bmat = Math.random() > 0.5 ? stoneDarkMat : stoneMat;
      var base = new T.Mesh(chippedBox(w * 1.04, hb, d * 1.04, 0.045, Math.round(Math.abs(cx * 11 + cz * 7)) % 991), bmat);
      base.position.set(cx, hb / 2, cz);
      base.rotation.y = ang + (Math.random() - 0.5) * 0.03;
      base.castShadow = true;
      base.receiveShadow = true;
      root.add(base);
      if (opt.noCollide !== true) addCollider(cx, cz, w, d, 0, hb, hb < 1.7);

      // 上段：断续、错落
      if (opt.gaps && Math.random() < opt.gaps) continue;
      var hh = h * (opt.broken ? (0.62 + Math.random() * 0.62) : (0.94 + Math.random() * 0.14));
      var top = hh - hb;
      if (top < 0.12) continue;
      var mat = Math.random() > 0.72 ? stoneMat3 : Math.random() > 0.45 ? stoneDarkMat : stoneMat;
      var m = new T.Mesh(chippedBox(w * (0.92 + Math.random() * 0.1), top, d * (0.9 + Math.random() * 0.12), 0.038,
        Math.round(Math.abs(cx * 13 + cz * 5)) % 991), mat);
      m.position.set(cx + (Math.random() - 0.5) * 0.06, hb + top / 2, cz + (Math.random() - 0.5) * 0.05);
      m.rotation.y = ang + (Math.random() - 0.5) * 0.07;
      m.rotation.z = (Math.random() - 0.5) * 0.02;
      m.castShadow = true; m.receiveShadow = true;
      root.add(m);
      if (opt.noCollide !== true) addCollider(cx, cz, w * 0.95, d * 0.95, hb, hh, hh < 1.7);

      // 顶部碎石
      if (Math.random() > 0.6) {
        var rb = new T.Mesh(paintAO(new T.BoxGeometry(w * (0.24 + Math.random() * 0.34), 0.1 + Math.random() * 0.12, d * 0.7), 0.7), mat);
        rb.position.set(cx + (Math.random() - 0.5) * w * 0.4, hh + 0.05, cz + (Math.random() - 0.5) * d * 0.3);
        rb.rotation.set(Math.random() * 0.3, Math.random() * 3, Math.random() * 0.24);
        rb.castShadow = true;
        root.add(rb);
      }
    }
  }

  function gravestoneLike(x, z, h, w) {
    var m = boxMesh(x, 0, z, w, h, 0.26, stoneMat, Math.random() * 0.3, true, true);
    m.rotation.z = (Math.random() - 0.5) * 0.12;
  }

  function makeTree(x, z, opt) {
    opt = opt || {};
    var h = opt.h || 7;
    var r = opt.r || 0.34;
    var grp = new T.Group();
    grp.position.set(x, 0, z);
    root.add(grp);

    var parts = [];
    var up = new T.Vector3(0, 1, 0);

    function seg(px, py, pz, dir, len, rad, depth) {
      var start = new T.Vector3(px, py, pz);
      var end = start.clone().addScaledVector(dir, len);
      var mid = start.clone().add(end).multiplyScalar(0.5);
      var L = len;
      var geo = new T.CylinderGeometry(rad * 0.56, rad, L, depth > 1 ? 7 : 5, 1, false);
      var q = new T.Quaternion().setFromUnitVectors(up, dir.clone().normalize());
      geo.applyMatrix4(new T.Matrix4().compose(mid, q, new T.Vector3(1, 1, 1)));
      parts.push(geo);
      if (depth <= 0) return;
      var k = 2 + (Math.random() > 0.55 ? 1 : 0);
      for (var i = 0; i < k; i++) {
        var nd = new T.Vector3(
          dir.x + (Math.random() - 0.5) * 1.05,
          dir.y * 0.82 + 0.20 + Math.random() * 0.18,
          dir.z + (Math.random() - 0.5) * 1.05
        ).normalize();
        seg(end.x, end.y, end.z, nd, len * (0.52 + Math.random() * 0.2), rad * 0.6, depth - 1);
      }
    }

    // 主干（略带弯曲：分两段）
    var trunkDir = new T.Vector3((Math.random() - 0.5) * 0.10, 1, (Math.random() - 0.5) * 0.10).normalize();
    seg(0, 0, 0, trunkDir, h * 0.52, r * 1.12, 0);
    var midY = h * 0.52;
    seg(trunkDir.x * h * 0.52, midY, trunkDir.z * h * 0.52, trunkDir, h * 0.40, r * 0.68, 1);

    // 根部起坡
    var flare = new T.ConeGeometry(r * 2.0, h * 0.10, 10);
    flare.translate(0, h * 0.05, 0);
    parts.push(flare);

    var nb = opt.branches || 5;
    for (var bi = 0; bi < nb; bi++) {
      var ang = (bi / nb) * Math.PI * 2 + Math.random() * 0.7;
      var yy = h * (0.5 + Math.random() * 0.34);
      var dir = new T.Vector3(Math.cos(ang) * 0.62, 0.55 + Math.random() * 0.35, Math.sin(ang) * 0.62).normalize();
      seg(trunkDir.x * yy * 0.6, yy, trunkDir.z * yy * 0.6, dir,
        h * (0.20 + Math.random() * 0.12), r * (0.42 + Math.random() * 0.14), opt.depth || 3);
    }

    var mesh = new T.Mesh(mergeGeos(parts), woodMat);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    grp.add(mesh);

    addCollider(x, z, r * 2.4, r * 2.4, 0, h * 0.9, false);
    return grp;
  }

  function makeGazebo(x, z) {
    var R = 3.1, n = 6, colH = 2.85;

    // 八边形台基
    var plinth = new T.Mesh(new T.CylinderGeometry(R * 1.5, R * 1.62, 0.22, 8), stoneDarkMat);
    plinth.position.set(x, 0.11, z);
    plinth.rotation.y = Math.PI / 8;
    plinth.castShadow = true; plinth.receiveShadow = true;
    root.add(plinth);
    addCollider(x, z, R * 2.6, R * 2.6, 0, 0.22, true);

    for (var i = 0; i < n; i++) {
      var a = (i / n) * Math.PI * 2;
      var px = x + Math.cos(a) * R, pz = z + Math.sin(a) * R;
      var col = boxMesh(px, 0.22, pz, 0.42, colH, 0.42, stoneMat, a, true, false);
      col.rotation.z = (Math.random() - 0.5) * 0.02;
      boxMesh(px, 0.22, pz, 0.62, 0.16, 0.62, stoneDarkMat, a, false, false);
      boxMesh(px, colH - 0.06, pz, 0.58, 0.16, 0.58, stoneDarkMat, a, false, false);
    }

    // 圈梁
    var ring = new T.Mesh(paintAO(new T.TorusGeometry(R, 0.13, 8, 32), 0.72), stoneDarkMat);
    ring.position.set(x, colH + 0.12, z);
    ring.rotation.x = Math.PI / 2;
    ring.castShadow = true;
    root.add(ring);

    // 残缺的锥形屋顶：留出一段缺口
    var roof = new T.Mesh(
      new T.ConeGeometry(R * 1.22, 1.15, 6, 1, true, Math.PI * 0.35, Math.PI * 1.55),
      new T.MeshStandardMaterial({
        map: stoneMat.map, normalMap: stoneMat.normalMap, roughnessMap: stoneMat.roughnessMap,
        color: 0x8f887c, roughness: 0.94, metalness: 0, side: T.DoubleSide, envMapIntensity: 0.6
      })
    );
    roof.position.set(x, colH + 0.72, z);
    roof.rotation.y = Math.PI * 0.1;
    roof.castShadow = true; roof.receiveShadow = true;
    root.add(roof);

    // 檐下椽子
    for (var k = 0; k < 6; k++) {
      var ang = (k / 6) * Math.PI * 2 + 0.2;
      var beam = new T.Mesh(new T.BoxGeometry(R * 0.95, 0.09, 0.14), woodMat);
      beam.position.set(x + Math.cos(ang) * R * 0.52, colH + 0.22, z + Math.sin(ang) * R * 0.52);
      beam.rotation.y = -ang;
      beam.castShadow = true;
      root.add(beam);
    }

    // 塌落的构件
    boxMesh(x + 1.4, 0.22, z + 1.1, 2.2, 0.16, 0.2, woodMat, 0.7, false);
    makeRubble(x - 2.2, z + 1.4, 6, 1.4);
  }

  function makeShelter(x, z) {
    boxMesh(x - 1.6, 0, z - 1.2, 0.2, 2.4, 0.2, metalMat, 0, true, false);
    boxMesh(x + 1.6, 0, z - 1.2, 0.2, 2.4, 0.2, metalMat, 0, true, false);
    boxMesh(x - 1.6, 0, z + 1.2, 0.2, 2.4, 0.2, metalMat, 0, true, false);
    boxMesh(x + 1.6, 0, z + 1.2, 0.2, 1.05, 0.2, metalMat, 0, true, false);
    var roof = boxMesh(x, 2.4, z, 3.9, 0.12, 3.1, metalMat, 0, true, false);
    roof.rotation.z = 0.03;
    // 长椅
    boxMesh(x, 0.42, z + 0.9, 3.0, 0.1, 0.5, woodMat, 0, true, true);
    boxMesh(x - 1.2, 0, z + 0.9, 0.1, 0.42, 0.4, metalMat, 0, false);
    boxMesh(x + 1.2, 0, z + 0.9, 0.1, 0.42, 0.4, metalMat, 0, false);
  }

  function makeTable(x, z, h) {
    boxMesh(x, 0, z, 1.5, h, 0.9, stoneMat, 0, true, true);
    boxMesh(x - 0.6, 0, z, 0.5, h * 0.96, 1.5, stoneDarkMat, 0, true, true);
  }

  function makePlatformSlab(x, z, w, d, h) {
    boxMesh(x, 0, z, w, h, d, stoneDarkMat, 0, true, true);
    // 边缘黄线（褪色）
    var line = new T.Mesh(new T.BoxGeometry(w, 0.02, 0.16), new T.MeshStandardMaterial({ color: 0xbfae7e, roughness: 0.9 }));
    line.position.set(x, h + 0.01, z + d / 2 - 0.5);
    root.add(line);
  }

  function makeRubble(x, z, n, r) {
    for (var i = 0; i < n; i++) {
      var a = Math.random() * 6.28, d = Math.random() * r;
      var s = 0.2 + Math.random() * 0.5;
      var m = new T.Mesh(paintAO(new T.BoxGeometry(s, s * (0.4 + Math.random() * 0.6), s * (0.6 + Math.random())), 0.45), stoneMat);
      m.position.set(x + Math.cos(a) * d, s * 0.24, z + Math.sin(a) * d);
      m.rotation.set(Math.random(), Math.random() * 3, Math.random() * 0.5);
      m.castShadow = true; m.receiveShadow = true;
      root.add(m);
    }
  }

  /* ---------------- 碎片 ---------------- */

  function fragmentMesh(shape) {
    var g = new T.Group();
    var mat = new T.MeshStandardMaterial({
      color: 0xcdbda6, roughness: 0.74, metalness: 0.12,
      emissive: new T.Color(0x6a5636), emissiveIntensity: 0.18
    });
    var s = 0.11;
    switch (shape) {
      case 'ring':
        g.add(new T.Mesh(new T.TorusGeometry(s * 0.9, s * 0.16, 8, 24), mat));
        break;
      case 'note':
      case 'page':
      case 'envelope':
      case 'ticket': {
        var pl = new T.Mesh(new T.PlaneGeometry(shape === 'ticket' ? 0.18 : 0.15, shape === 'ticket' ? 0.08 : 0.12), new T.MeshStandardMaterial({ color: 0xe4d8bf, roughness: 0.9, side: T.DoubleSide, emissive: 0x4a3c28, emissiveIntensity: 0.25 }));
        pl.rotation.x = -Math.PI / 2;
        g.add(pl);
        break;
      }
      case 'cup': {
        var cup = new T.Mesh(new T.CylinderGeometry(s * 0.62, s * 0.5, s * 1.5, 14, 1, true), mat);
        cup.material.side = T.DoubleSide;
        g.add(cup);
        break;
      }
      case 'bell': {
        var b = new T.Mesh(new T.ConeGeometry(s * 0.66, s * 1.3, 14), mat);
        b.position.y = s * 0.3;
        g.add(b);
        var knob = new T.Mesh(new T.SphereGeometry(s * 0.2, 10, 8), mat);
        knob.position.y = s * 1.05;
        g.add(knob);
        break;
      }
      case 'umbrella': {
        var stick = new T.Mesh(new T.CylinderGeometry(0.012, 0.012, 0.5, 6), mat);
        stick.rotation.z = Math.PI / 2.3;
        g.add(stick);
        var canopy = new T.Mesh(new T.ConeGeometry(0.14, 0.2, 10, 1, true), mat);
        canopy.material.side = T.DoubleSide;
        canopy.position.set(0.2, 0.1, 0);
        canopy.rotation.z = -0.9;
        g.add(canopy);
        break;
      }
      case 'watch': {
        var w1 = new T.Mesh(new T.TorusGeometry(s * 0.85, s * 0.24, 8, 22), mat);
        g.add(w1);
        var face = new T.Mesh(new T.CircleGeometry(s * 0.8, 18), new T.MeshStandardMaterial({ color: 0xe8dcc4, roughness: 0.5, side: T.DoubleSide }));
        face.position.z = 0.005;
        g.add(face);
        var strap = new T.Mesh(new T.BoxGeometry(s * 0.4, s * 2.2, s * 0.2), new T.MeshStandardMaterial({ color: 0x6b5744, roughness: 0.85 }));
        strap.position.y = -s * 1.4;
        g.add(strap);
        break;
      }
      case 'key': {
        var kh = new T.Mesh(new T.TorusGeometry(s * 0.55, s * 0.18, 8, 20), metalMat);
        g.add(kh);
        var bar = new T.Mesh(new T.CylinderGeometry(s * 0.12, s * 0.12, s * 2.0, 6), metalMat);
        bar.rotation.z = Math.PI / 2;
        bar.position.x = s * 1.2;
        g.add(bar);
        break;
      }
      case 'bird': {
        var body = new T.Mesh(new T.SphereGeometry(s * 1.1, 14, 12), ceramicMat);
        body.scale.set(1.2, 0.9, 0.95);
        g.add(body);
        var head = new T.Mesh(new T.SphereGeometry(s * 0.55, 12, 10), ceramicMat);
        head.position.set(s * 0.9, s * 0.7, 0);
        g.add(head);
        var beak = new T.Mesh(new T.ConeGeometry(s * 0.2, s * 0.5, 8), ceramicMat);
        beak.rotation.z = -Math.PI / 2;
        beak.position.set(s * 1.4, s * 0.66, 0);
        g.add(beak);
        break;
      }
      case 'camera': {
        var cb = new T.Mesh(new T.BoxGeometry(0.24, 0.16, 0.1), new T.MeshStandardMaterial({ color: 0x3a3630, roughness: 0.65, metalness: 0.3 }));
        g.add(cb);
        var lens = new T.Mesh(new T.CylinderGeometry(0.055, 0.062, 0.07, 14), metalMat);
        lens.rotation.x = Math.PI / 2;
        lens.position.z = 0.06;
        g.add(lens);
        break;
      }
      case 'box': {
        var bb = new T.Mesh(new T.BoxGeometry(0.2, 0.09, 0.14), new T.MeshStandardMaterial({ color: 0x8c2f38, roughness: 0.55, metalness: 0.25, emissive: 0x2a0a0d, emissiveIntensity: 0.4 }));
        g.add(bb);
        var lid = new T.Mesh(new T.BoxGeometry(0.2, 0.02, 0.14), new T.MeshStandardMaterial({ color: 0xa33b45, roughness: 0.5, metalness: 0.3 }));
        lid.position.set(0.02, 0.06, 0);
        lid.rotation.z = 0.5;
        g.add(lid);
        break;
      }
      case 'brick': {
        // 灶台碎砖：被磨圆了一角的老青砖
        var br = new T.Mesh(boxWorldUV(new T.BoxGeometry(0.16, 0.10, 0.13, 2, 2, 2), 0.9), stoneMat.clone());
        br.material.vertexColors = false;
        br.material.color.setHex(0x8a7d68);
        br.material.emissive = new T.Color(0x2a2118);
        br.material.emissiveIntensity = 0.3;
        g.add(br);
        var worn = new T.Mesh(new T.SphereGeometry(0.062, 12, 8), new T.MeshStandardMaterial({ color: 0xb9ab90, roughness: 0.55, metalness: 0.05, emissive: 0x392c1e, emissiveIntensity: 0.35 }));
        worn.scale.set(1.05, 0.32, 0.9);
        worn.position.y = 0.056;
        g.add(worn);
        break;
      }
      case 'bag': {
        // 油纸袋残片：一角被揉皱的牛皮纸
        var paperMat = new T.MeshStandardMaterial({ color: 0xc2a074, roughness: 0.82, metalness: 0.0, side: T.DoubleSide, emissive: 0x3a2a16, emissiveIntensity: 0.25 });
        var bg1 = new T.Mesh(new T.PlaneGeometry(0.20, 0.15, 4, 4), paperMat);
        var bp = bg1.geometry.attributes.position;
        for (var bi = 0; bi < bp.count; bi++) {
          var bxx = bp.getX(bi), byy = bp.getY(bi);
          bp.setZ(bi, Math.sin(bxx * 26) * 0.012 + Math.cos(byy * 22) * 0.010);
        }
        bg1.geometry.computeVertexNormals();
        bg1.rotation.x = -Math.PI / 2 + 0.18;
        bg1.rotation.z = 0.22;
        g.add(bg1);
        // 油渍
        var stain = new T.Mesh(new T.CircleGeometry(0.045, 14), new T.MeshBasicMaterial({ color: 0x6a4418, transparent: true, opacity: 0.5 }));
        stain.rotation.x = -Math.PI / 2 + 0.18;
        stain.position.set(0.02, 0.004, 0.02);
        g.add(stain);
        break;
      }
      case 'shard': {
        // 掉漆搪瓷碗的瓷片：一片弧形的白瓷
        var sh = new T.Mesh(new T.CylinderGeometry(0.12, 0.12, 0.012, 14, 1, true, 0, 1.5), new T.MeshStandardMaterial({ color: 0xe8e6dc, roughness: 0.32, metalness: 0.06, side: T.DoubleSide, emissive: 0x2e2c26, emissiveIntensity: 0.22 }));
        sh.rotation.set(-0.9, 0.4, 0.3);
        g.add(sh);
        break;
      }
      case 'root': {
        // 银杏的白色断根：断面发白，带一点树皮
        var rg2 = new T.Mesh(new T.CylinderGeometry(0.055, 0.075, 0.26, 10), new T.MeshStandardMaterial({ color: 0xd8cdb2, roughness: 0.72, metalness: 0.0, emissive: 0x3a3324, emissiveIntensity: 0.28 }));
        rg2.rotation.set(0.9, 0.3, 1.15);
        g.add(rg2);
        var cut = new T.Mesh(new T.CircleGeometry(0.056, 12), new T.MeshStandardMaterial({ color: 0xefe6cd, roughness: 0.55, side: T.DoubleSide, emissive: 0x4a4130, emissiveIntensity: 0.35 }));
        cut.position.set(-0.09, 0.12, 0.05);
        cut.rotation.set(0.9, 0.3, 1.15);
        g.add(cut);
        break;
      }
      case 'glass': {
        // 镜子碎屑：薄薄一片，边上反光
        var gl = new T.Mesh(new T.CircleGeometry(0.075, 3), new T.MeshPhysicalMaterial({ color: 0xb9c6c8, roughness: 0.08, metalness: 0.45, clearcoat: 0.9, clearcoatRoughness: 0.1, side: T.DoubleSide, emissive: 0x1e2a2c, emissiveIntensity: 0.35 }));
        gl.rotation.set(-1.2, 0.2, 0.4);
        g.add(gl);
        break;
      }
      case 'leaf': {
        // 干枯的银杏叶：扇形，边缘卷起来
        var leafMat = new T.MeshStandardMaterial({ color: 0xd8ae58, roughness: 0.78, metalness: 0.0, side: T.DoubleSide, emissive: 0x3a2a08, emissiveIntensity: 0.30 });
        var lf = new T.Mesh(new T.CircleGeometry(0.085, 16, Math.PI * 0.18, Math.PI * 0.64), leafMat);
        lf.rotation.set(-Math.PI / 2 + 0.25, 0, 0.5);
        var lp = lf.geometry.attributes.position;
        for (var li = 0; li < lp.count; li++) {
          var lr = Math.hypot(lp.getX(li), lp.getY(li));
          lp.setZ(li, lr * lr * 3.2);
        }
        lf.geometry.computeVertexNormals();
        g.add(lf);
        var stem = new T.Mesh(new T.CylinderGeometry(0.0035, 0.0045, 0.05, 5), new T.MeshStandardMaterial({ color: 0xa8873e, roughness: 0.8 }));
        stem.position.set(0.008, 0, 0.026);
        stem.rotation.x = Math.PI / 2;
        g.add(stem);
        break;
      }
      default:
        g.add(new T.Mesh(new T.SphereGeometry(s, 10, 8), mat));
    }
    g.traverse(function (o) { if (o.isMesh) { o.castShadow = true; } });
    return g;
  }

  /* ---------------- 碎片数据 ---------------- */

  var FRAG_DEFS = [
    /* ---- 第一段：还暖和的时候 ---- */
    {
      id: 'stovechunk', stage: 0, name: '磨亮的灶台碎砖', shape: 'brick', mood: 'warm', seed: 1101,
      pos: [2.35, 0.30, 41.2], rot: 0.4, scale: 1,
      shots: [
        { scene: 'stove', dur: 8.0, line: '我不饿，你吃。' },
        { scene: 'bowl', dur: 7.0 },
        { scene: 'steamface', dur: 6.5, line: '乖乖，吃饭了。' }
      ]
    },
    {
      id: 'oilpaper', stage: 0, name: '浸透油的纸袋残片', shape: 'bag', mood: 'warm', seed: 1102,
      pos: [-1.15, 0.03, 27.5], rot: -0.3, scale: 1.15,
      shots: [
        { scene: 'stall', dur: 8.0, line: '老样子，不要葱？' },
        { scene: 'bagshot', dur: 6.5, line: '长身体，多吃点。' },
        { scene: 'alley', dur: 7.0 }
      ]
    },
    {
      id: 'homework', stage: 0, name: '泛黄的作业本残页', shape: 'page', mood: 'warm', seed: 1103,
      pos: [14.4, 0.28, 0.9], rot: 1.1, scale: 1.2,
      shots: [
        { scene: 'office', dur: 7.5 },
        { scene: 'redink', dur: 7.5, line: '下次别糊弄自己。' }
      ]
    },
    {
      id: 'note', stage: 0, name: '揉皱又展平的纸条', shape: 'note', mood: 'warm', seed: 1104,
      pos: [-6.4, 0.04, 36.0], rot: 0.8, scale: 1.1,
      shots: [
        { scene: 'classroom', dur: 7.5, line: '到家跟我说一声。' },
        { scene: 'fork', dur: 6.5 },
        { scene: 'chat', dur: 7.0 }
      ]
    },

    /* ---- 第二段：开始失去 ---- */
    {
      id: 'exam', stage: 1, name: '试卷的一角', shape: 'ticket', mood: 'gray', seed: 2101,
      pos: [-6.2, 0.80, -34.2], rot: 0.2, scale: 1.1,
      shots: [
        { scene: 'corridor', dur: 8.0, line: '你也就这样了。' },
        { scene: 'standbell', dur: 6.5 }
      ]
    },
    {
      id: 'enamel', stage: 1, name: '掉漆搪瓷碗的瓷片', shape: 'shard', mood: 'gray', seed: 2102,
      pos: [4.55, 1.21, -52.0], rot: 0.7, scale: 1.0,
      shots: [
        { scene: 'ward', dur: 8.0, line: '乖乖来了。' },
        { scene: 'handbowl', dur: 7.5, line: '我不饿。' },
        { scene: 'sink', dur: 6.5 }
      ]
    },
    {
      id: 'mug', stage: 1, name: '白搪瓷杯口的碎块', shape: 'cup', mood: 'gray', seed: 2103,
      pos: [-16.4, 0.06, -60.5], rot: -0.5, scale: 1.1,
      shots: [
        { scene: 'dorm', dur: 8.0 },
        { scene: 'cupwater', dur: 7.0, line: '好点没。' }
      ]
    },
    {
      id: 'dogfood', stage: 1, name: '褪色的狗粮袋残片', shape: 'bag', mood: 'gray', seed: 2104,
      pos: [10.4, 0.56, -39.1], rot: 0.9, scale: 1.1,
      shots: [
        { scene: 'canteen', dur: 7.5, line: '来福没了，老死的。' },
        { scene: 'alley', dur: 8.0 }
      ]
    },

    /* ---- 第三段：都不在了 ---- */
    {
      id: 'receipt', stage: 2, name: '打印模糊的餐饮小票', shape: 'ticket', mood: 'dark', seed: 3101,
      pos: [-6.1, 0.82, -88.2], rot: 0.5, scale: 1.15,
      shots: [
        { scene: 'canteen', dur: 7.5, line: '没事，你忙。' },
        { scene: 'phone', dur: 8.0, line: '改天。' }
      ]
    },
    {
      id: 'root', stage: 2, name: '银杏的白色断根', shape: 'root', mood: 'dark', seed: 3102,
      pos: [-9.7, 0.62, -92.4], rot: -0.4, scale: 1.0,
      shots: [
        { scene: 'fence', dur: 8.5 },
        { scene: 'rootclose', dur: 7.5, line: '有些故乡，长大就是用来失去的。' }
      ]
    },
    {
      id: 'glass', stage: 2, name: '镜面玻璃碎屑', shape: 'glass', mood: 'dark', seed: 3103,
      pos: [12.2, 0.93, -103.6], rot: 0.15, scale: 1.1,
      shots: [
        { scene: 'mirror', dur: 9.0, line: '是不是我不够好。' },
        { scene: 'sink', dur: 6.0 }
      ]
    },
    {
      id: 'woodbox', stage: 2, name: '空木盒的木屑', shape: 'box', mood: 'truth', seed: 3104, truth: true,
      pos: [0.6, 0.82, -124.0], rot: 0.1, scale: 1.15,
      shots: [
        { scene: 'cabinet', dur: 8.5 },
        { scene: 'flashback', dur: 8.0, line: '不是忘了，是刻意不翻。' }
      ]
    },
    {
      id: 'leaf', stage: 2, name: '干枯的银杏叶', shape: 'leaf', mood: 'truth', seed: 3105,
      pos: [2.10, 0.12, -130.5], rot: 0.6, scale: 1.2,
      shots: [
        { scene: 'leafpile', dur: 7.5, line: '踩着好听。' },
        { scene: 'emptylot', dur: 8.0 }
      ]
    }
  ];

  /* ---------------- 场景搭建 ---------------- */

  W.build = function (renderer) {
    scene = new T.Scene();
    scene.fog = new T.FogExp2(0xcfc6b6, 0.015);
    fog = scene.fog;
    scene.background = new T.Color(0xcfc6b6);

    root = new T.Group();
    scene.add(root);

    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = T.PCFSoftShadowMap;

    // 材质（PBR：颜色 + 法线 + 粗糙度 + 环境反射）
    var sset = stoneSet();
    stoneMat = new T.MeshStandardMaterial({
      map: sset.albedo, normalMap: sset.normal, roughnessMap: sset.rough,
      color: 0x9c968a, roughness: 0.92, metalness: 0.0, envMapIntensity: 0.68, vertexColors: true
    });
    stoneMat.normalScale.set(0.95, 0.95);
    stoneDarkMat = new T.MeshStandardMaterial({
      map: sset.albedo, normalMap: sset.normal, roughnessMap: sset.rough,
      color: 0x736f66, roughness: 0.96, metalness: 0.0, envMapIntensity: 0.58, vertexColors: true
    });
    stoneDarkMat.normalScale.copy(stoneMat.normalScale);

    var bset = barkSet();
    woodMat = new T.MeshStandardMaterial({
      map: bset.albedo, normalMap: bset.normal,
      color: 0x8d7f6b, roughness: 0.95, metalness: 0.0, envMapIntensity: 0.36
    });
    woodMat.normalScale.set(1.0, 1.0);
    woodMat.map.repeat.set(1.5, 3.0);
    woodMat.normalMap.repeat.set(1.5, 3.0);

    stoneMat3 = stoneMat.clone();
    stoneMat3.color.setHex(0x8a8578);

    metalMat = new T.MeshStandardMaterial({
      color: 0x6d6960, roughness: 0.4, metalness: 0.88, envMapIntensity: 1.3
    });
    ceramicMat = new T.MeshPhysicalMaterial({
      color: 0xd5c9b2, roughness: 0.3, metalness: 0.0,
      clearcoat: 0.7, clearcoatRoughness: 0.32, envMapIntensity: 1.1
    });

    // 地面
    var gtex = groundTexture();
    var gGeo = new T.PlaneGeometry(WORLD.x1 - WORLD.x0, WORLD.z1 - WORLD.z0, 136, 104);
    (function () {
      var pos = gGeo.attributes.position;
      for (var i = 0; i < pos.count; i++) {
        var lx = pos.getX(i), ly = pos.getY(i);
        var hgt = Math.sin(lx * 0.07 + ly * 0.03) * 0.09
                + Math.sin(lx * 0.021 - ly * 0.017) * 0.15
                + Math.sin(lx * 0.33 + ly * 0.19) * 0.021
                + Math.sin(lx * 0.61 - ly * 0.53) * 0.009;
        pos.setZ(i, hgt);
      }
      gGeo.computeVertexNormals();
    })();
    var gmat = new T.MeshStandardMaterial({
      map: gtex, normalMap: groundNormalMap(),
      roughness: 1, metalness: 0, envMapIntensity: 0.35
    });
    gmat.normalScale.set(0.75, 0.75);
    var gDetail = floorDetailTexture();
    gmat.onBeforeCompile = function (shader) {
      shader.uniforms.uDetail = { value: gDetail };
      shader.fragmentShader = 'uniform sampler2D uDetail;\n' + shader.fragmentShader.replace(
        '#include <map_fragment>',
        [
          '#include <map_fragment>',
          'vec3 dA = texture2D(uDetail, vMapUv * 64.0).rgb;',
          'vec3 dB = texture2D(uDetail, vMapUv * 11.0).rgb;',
          'vec3 dC = texture2D(uDetail, vMapUv * 2.6).rgb;',
          'float mA = dA.r;',
          'float mB = dB.r;',
          'float mC = dC.r;',
          'vec3 soil = diffuseColor.rgb * vec3(1.00, 0.93, 0.84);',
          'diffuseColor.rgb = mix(soil, diffuseColor.rgb, smoothstep(0.26, 0.60, mA));',
          'float dryK = smoothstep(0.62, 0.96, mA);',
          'diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb * vec3(1.20, 1.17, 0.92), dryK);',
          // 大尺度斑块：枯草地 / 湿土，打破一整片"草坪"的均匀感
          'diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb * vec3(1.26, 1.20, 0.88), smoothstep(0.56, 0.86, mC) * 0.80);',
          'diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb * vec3(0.70, 0.74, 0.72), smoothstep(0.46, 0.16, mC) * 0.60);',
          'diffuseColor.rgb *= 0.78 + mB * 0.50;',
        ].join('\n')
      );
    };
    var ground = new T.Mesh(gGeo, gmat);
    ground.rotation.x = -Math.PI / 2;
    ground.position.set(0, 0, (WORLD.z0 + WORLD.z1) / 2);
    ground.receiveShadow = true;
    scene.add(ground);

    // 远景地面：只看作雾里的地平线，防止露出天空球下缘
    var farGround = new T.Mesh(
      new T.CircleGeometry(520, 56),
      new T.MeshStandardMaterial({ color: 0x4a4e3d, roughness: 1, metalness: 0, envMapIntensity: 0.35 })
    );
    farGround.rotation.x = -Math.PI / 2;
    farGround.position.y = -0.25;
    scene.add(farGround);


    // 天空（含云层与太阳散射）
    skyMat = new T.ShaderMaterial({
      side: T.BackSide, depthWrite: false,
      uniforms: {
        topColor: { value: new T.Color(0x8fa3b4) },
        midColor: { value: new T.Color(0xd9d2c4) },
        botColor: { value: new T.Color(0xe8dcc6) },
        sunDir: { value: new T.Vector3(0.32, 0.16, -1).normalize() },
        sunColor: { value: new T.Color(0xffe3b4) },
        sunK: { value: 1 },
        uTime: { value: 0 },
        uCloud: { value: 1 },
        uFog: { value: new T.Color(0xcdc4b2) }
      },
      vertexShader: [
        'varying vec3 vDir;',
        'void main(){',
        '  vDir = normalize(position);',
        '  gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0);',
        '}'
      ].join('\n'),
      fragmentShader: [
        'uniform vec3 topColor; uniform vec3 midColor; uniform vec3 botColor;',
        'uniform vec3 sunDir; uniform vec3 sunColor; uniform float sunK;',
        'uniform float uTime;',
        'uniform float uCloud;',
        'uniform vec3 uFog;',
        'varying vec3 vDir;',
        'float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }',
        'float vnoise(vec2 p){',
        '  vec2 i = floor(p), f = fract(p);',
        '  vec2 u = f * f * (3.0 - 2.0 * f);',
        '  return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x),',
        '             mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x), u.y);',
        '}',
        'float fbm2(vec2 p){',
        '  float s = 0.0, a = 0.5;',
        '  for (int i = 0; i < 4; i++) { s += vnoise(p) * a; p *= 2.03; a *= 0.5; }',
        '  return s;',
        '}',
        'void main(){',
        '  vec3 dir = normalize(vDir);',
        '  float h = clamp(dir.y * 1.15 + 0.06, -0.2, 1.0);',
        '  vec3 col = mix(botColor, midColor, smoothstep(-0.06, 0.34, h));',
        '  col = mix(col, topColor, smoothstep(0.22, 0.92, h));',
        '  float cy = max(dir.y, 0.02);',
        '  vec2 cp = dir.xz / cy * 0.34;',
        '  float cl = fbm2(cp * 1.35 + vec2(uTime * 0.006, uTime * 0.0022));',
        '  cl = smoothstep(0.46, 0.74, cl) * smoothstep(0.01, 0.13, dir.y);',
        '  vec3 cloudCol = mix(midColor * 1.18 + 0.05, sunColor * 0.92, pow(max(dot(dir, normalize(sunDir)), 0.0), 2.4) * 0.48);',
        '  col = mix(col, cloudCol, cl * 0.78 * uCloud);',
        // 地平线雾霭：沿视线方向并入场景雾色，消除地面雾与天空之间的硬色阶
        '  float hz = 1.0 - smoothstep(-0.02, 0.22, dir.y);',
        '  hz = pow(hz, 1.3);',
        '  vec3 hazeCol = uFog * (1.0 + 0.10 * pow(max(dot(dir, normalize(sunDir)), 0.0), 3.0));',
        '  col = mix(col, hazeCol, hz * 0.90);',
        '  float d = max(dot(dir, normalize(sunDir)), 0.0);',
        '  col += sunColor * pow(d, 900.0) * 5.0 * sunK;',
        '  col += sunColor * pow(d, 90.0) * 0.55 * sunK;',
        '  col += sunColor * pow(d, 12.0) * 0.085 * sunK;',
        '  col += sunColor * pow(d, 2.2) * 0.028 * sunK;',
        '  gl_FragColor = vec4(col, 1.0);',
        '  #include <tonemapping_fragment>',
        '  #include <encodings_fragment>',
        '}'
      ].join('\n')
    });
    var sky = new T.Mesh(new T.SphereGeometry(560, 40, 24), skyMat);
    scene.add(sky);

    // 太阳光晕
    var sunTex = glowTexture('rgba(255,250,236,1)', 'rgba(255,236,198,.5)');
    sunSprite = new T.Sprite(new T.SpriteMaterial({ map: sunTex, transparent: true, blending: T.AdditiveBlending, depthWrite: false, opacity: 0.32 }));
    sunSprite.scale.set(13, 13, 1);
    sunSprite.position.set(84, 46, -260);
    scene.add(sunSprite);

    // 云
    var cloudTex = glowTexture('rgba(255,255,255,.85)', 'rgba(252,248,240,.34)');
    for (var ci = 0; ci < 16; ci++) {
      var sp = new T.Sprite(new T.SpriteMaterial({ map: cloudTex, transparent: true, opacity: 0.05 + Math.random() * 0.075, depthWrite: false }));
      var s = 60 + Math.random() * 120;
      sp.scale.set(s, s * 0.52, 1);
      sp.position.set((Math.random() - 0.5) * 520, 34 + Math.random() * 68, -80 - Math.random() * 260);
      scene.add(sp);
      clouds.push({ sp: sp, sp2: 0.25 + Math.random() * 0.7 });
    }

    // 光
    var hemi = new T.HemisphereLight(0xdfe4e2, 0x5b5548, 0.16);
    scene.add(hemi);
    hemiLight = hemi;

    var amb = new T.AmbientLight(0xbfb8a8, 0.09);
    scene.add(amb);

    var sun = new T.DirectionalLight(0xfff0da, 1.05);
    sun.position.set(60, 44, 30);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    sun.shadow.camera.near = 1;
    sun.shadow.camera.far = 120;
    sun.shadow.camera.left = -34;
    sun.shadow.camera.right = 34;
    sun.shadow.camera.top = 34;
    sun.shadow.camera.bottom = -34;
    sun.shadow.bias = -0.0009;
    sun.shadow.normalBias = 0.02;
    scene.add(sun);
    scene.add(sun.target);
    W.sun = sun;

    // 环境光照（IBL）
    try {
      pmrem = new T.PMREMGenerator(renderer);
      pmrem.compileEquirectangularShader();
    } catch (err) {
      pmrem = null;
    }

    // 体积感：低空雾团 + 浮尘
    buildMist();
    buildDust();

    /* ---- 第一段 ---- */
    // 入口豁口两侧的断墙
    wall(-15, 44.2, -3.2, 44.2, 1.35, 1.1, { broken: true, seg: 2.2 });
    wall(2.4, 44.2, 13, 44.2, 1.3, 1.1, { broken: true, seg: 2.2 });
    wall(-15, 44.2, -15, 39.5, 1.1, 0.9, { broken: true, gaps: 0.35 });
    wall(13, 44.2, 13, 39.5, 1.05, 0.9, { broken: true, gaps: 0.4 });
    // 门槛台阶
    boxMesh(0, 0, 43.8, 5.0, 0.14, 1.6, stoneDarkMat, 0, true, true);

    makeGazebo(15, -2);
    makeTree(22, -8, { h: 9.5, r: 0.4, branches: 6, depth: 4 });
    makeTree(-24, 14, { h: 7, r: 0.28, branches: 5, depth: 4 });
    makeTree(-30, -10, { h: 8, r: 0.3, branches: 5, depth: 3 });

    // 石台
    boxMesh(6.2, 0, 30.5, 2.2, 1.05, 1.8, stoneMat, 0, true, true);
    boxMesh(-8.5, 0, 12.5, 2.8, 0.72, 2.2, stoneMat, 0, true, true);
    // 矮墙
    wall(-6.5, 6.5, 2.0, 6.5, 1.05, 0.55, {});
    // 斜靠的粗树干
    (function () {
      var g = new T.Group();
      var len = 5.2;
      var cyl = new T.Mesh(new T.CylinderGeometry(0.19, 0.26, len, 8), woodMat);
      cyl.rotation.z = Math.PI / 2 - 0.26;
      cyl.position.set(-11, 0.75, 3.2);
      cyl.castShadow = true; cyl.receiveShadow = true;
      root.add(cyl);
      addCollider(-11, 3.2, 4.8, 0.62, 0, 1.15, true);
      // 树根
      makeRubble(-13.6, 3.2, 5, 1.2);
    })();
    // 残墙院落
    wall(-30, 26, -18, 26, 1.5, 0.6, { broken: true, gaps: 0.25 });
    wall(-30, 26, -30, 14, 1.4, 0.6, { broken: true, gaps: 0.3 });
    wall(-18, 26, -18, 19, 1.3, 0.6, { broken: true, gaps: 0.4 });
    makeRubble(-24, 20, 12, 4);

    // 水塘
    (function () {
      var wn = groundNormalMap();
      wn.repeat.set(5, 5);
      var pmat = new T.MeshStandardMaterial({
        color: 0x66787b, roughness: 0.13, metalness: 0.55,
        normalMap: wn, envMapIntensity: 1.05
      });
      pmat.normalScale.set(0.32, 0.32);
      var pond = new T.Mesh(new T.CircleGeometry(9.5, 48), pmat);
      pond.rotation.x = -Math.PI / 2;
      pond.position.set(-19, 0.035, -6);
      pond.scale.set(1.35, 1, 1);
      scene.add(pond);
      waterMesh = pond;
      for (var i = 0; i < 26; i++) {
        var a = Math.random() * 6.28;
        var rx = 12.4 * (1 + Math.random() * 0.12);
        var rz = 9.2 * (1 + Math.random() * 0.12);
        var s = 0.24 + Math.random() * 0.5;
        var m = new T.Mesh(paintAO(new T.DodecahedronGeometry(s, 0), 0.55), stoneMat);
        m.position.set(-19 + Math.cos(a) * rx, s * 0.4, -6 + Math.sin(a) * rz);
        m.rotation.set(Math.random(), Math.random(), Math.random());
        m.castShadow = true;
        root.add(m);
      }
    })();

    // 散落草垛/土堆
    for (var mi = 0; mi < 26; mi++) {
      var mx = (Math.random() - 0.5) * 90;
      var mz = 46 - Math.random() * 66;
      if (Math.abs(mx) < 4) continue;
      makeRubble(mx, mz, 2 + Math.floor(Math.random() * 3), 2);
    }

    /* ---- 第二段：界墙（断墙缺口）---- */
    wall(-34, -20, -3.4, -20, 1.55, 1.0, { broken: true, seg: 2.6, gaps: 0.12 });
    wall(2.6, -20, 34, -20, 1.5, 1.0, { broken: true, seg: 2.6, gaps: 0.12 });
    // 缺口的门柱
    boxMesh(-3.6, 0, -20, 0.9, 2.3, 0.9, stoneMat, 0, true, false);
    boxMesh(2.8, 0, -20, 0.9, 2.6, 0.9, stoneMat, 0, true, false);
    // 缺口前的石阶（站高一点看远处）
    boxMesh(0, 0, -18.2, 5.0, 0.42, 1.8, stoneMat, 0, true, true);

    /* ---- 第二段场景 ---- */
    makeShelter(10, -40);
    makeTable(-6, -34, 0.78);
    // 需要爬上去的矮墙
    wall(2.0, -52, 7.0, -52, 1.18, 0.7, {});
    wall(7.0, -52, 7.0, -47, 1.1, 0.7, {});
    // 下沉的院落
    wall(-22, -56, -11, -56, 1.25, 0.7, { broken: true, gaps: 0.2 });
    wall(-22, -56, -22, -66, 1.2, 0.7, { broken: true, gaps: 0.25 });
    wall(-22, -66, -11, -66, 1.05, 0.7, { broken: true, gaps: 0.3 });
    wall(-11, -66, -11, -60, 1.0, 0.7, { broken: true, gaps: 0.4 });
    makeRubble(-16.5, -61, 14, 3.5);
    // 稀疏的枯树列
    for (var ti = 0; ti < 7; ti++) {
      makeTree(-26 + ti * 9 + (Math.random() - 0.5) * 4, -26 - Math.random() * 40, {
        h: 5.5 + Math.random() * 3, r: 0.24 + Math.random() * 0.12, branches: 4, depth: 2
      });
    }
    // 碎墙阵
    wall(-4, -30, -4, -40, 0.95, 0.5, { broken: true, gaps: 0.35 });
    wall(16, -62, 16, -70, 1.2, 0.6, { broken: true, gaps: 0.25 });
    boxMesh(-2, 0, -68, 3.4, 0.55, 2.0, stoneMat, 0.4, true, true);

    /* ---- 第三段界线：倒下的枯树 ---- */
    (function () {
      // 倒木横卧，需要翻过去
      var log = new T.Mesh(new T.CylinderGeometry(0.42, 0.5, 52, 9), woodMat);
      log.rotation.z = Math.PI / 2;
      log.position.set(0, 0.52, -74);
      log.castShadow = true; log.receiveShadow = true;
      root.add(log);
      addCollider(0, -74, 52, 1.05, 0, 1.0, true);
      // 断枝
      for (var i = 0; i < 9; i++) {
        var b = new T.Mesh(new T.CylinderGeometry(0.06, 0.11, 1.2 + Math.random(), 5), woodMat);
        b.position.set(-22 + Math.random() * 44, 1.0 + Math.random() * 0.5, -74 + (Math.random() - 0.5) * 0.7);
        b.rotation.z = (Math.random() - 0.5) * 2;
        b.rotation.x = (Math.random() - 0.5) * 1.2;
        b.castShadow = true;
        root.add(b);
      }
      // 两侧延伸的残墙
      wall(-34, -74, -26, -74, 1.4, 1.0, { broken: true, seg: 3, gaps: 0.15 });
      wall(26, -74, 34, -74, 1.35, 1.0, { broken: true, seg: 3, gaps: 0.15 });
      // 一个可以踩上去的树墩
      boxMesh(28, 0, -72, 1.6, 0.75, 1.6, woodMat, 0, true, true);
    })();

    /* ---- 第三段：破屋 / 站台 ---- */
    // 破屋
    wall(-16, -84, -2, -84, 2.4, 0.5, { broken: true, gaps: 0.15 });
    wall(-16, -84, -16, -97, 2.2, 0.5, { broken: true, gaps: 0.2 });
    wall(-16, -97, -4, -97, 2.0, 0.5, { broken: true, gaps: 0.25 });
    wall(-4, -97, -4, -92, 1.9, 0.5, { broken: true, gaps: 0.15 });
    wall(-4, -89, -4, -84, 2.1, 0.5, { broken: true, gaps: 0.15 });
    // 窗台
    boxMesh(-6.1, 0, -88.2, 1.8, 0.78, 0.42, stoneMat, 0, true, true);
    // 塌落的屋梁
    (function () {
      for (var i = 0; i < 5; i++) {
        var bm = new T.Mesh(new T.BoxGeometry(0.22, 0.24, 6 + Math.random() * 3), woodMat);
        bm.position.set(-12 + Math.random() * 6, 0.2 + Math.random() * 0.35, -88 - Math.random() * 6);
        bm.rotation.set(Math.random() * 0.3, Math.random() * 3, Math.random() * 0.3);
        bm.castShadow = true;
        root.add(bm);
      }
    })();
    makeRubble(-8, -92, 16, 4);

    // 站台
    makePlatformSlab(17, -106, 18, 12, 0.9);
    // 站台顶棚残架
    (function () {
      for (var i = 0; i < 4; i++) {
        boxMesh(9.5 + i * 4.5, 0.9, -110, 0.16, 2.5, 0.16, metalMat, 0, true, false);
      }
      boxMesh(15, 3.4, -110, 14, 0.12, 5.5, metalMat, 0, true, false);
    })();
    // 铁轨
    (function () {
      var railMat = new T.MeshStandardMaterial({ color: 0x7d786e, roughness: 0.55, metalness: 0.7 });
      for (var r = 0; r < 2; r++) {
        var rail = new T.Mesh(new T.BoxGeometry(0.1, 0.12, 60), railMat);
        rail.position.set(24 + r * 1.5, 0.06, -104);
        rail.castShadow = true;
        root.add(rail);
      }
      for (var sl = 0; sl < 26; sl++) {
        var tie = new T.Mesh(new T.BoxGeometry(3.4, 0.08, 0.24), woodMat);
        tie.position.set(24.75, 0.02, -78 - sl * 2.3);
        root.add(tie);
      }
      // 站台边缘挡墙
      wall(8, -112.2, 26, -112.2, 0.42, 0.3, { noCollide: true });
    })();
    // 第三段枯树
    for (var t3 = 0; t3 < 8; t3++) {
      makeTree(-34 + t3 * 11 + Math.random() * 5, -80 - Math.random() * 42, {
        h: 6 + Math.random() * 4, r: 0.26 + Math.random() * 0.16, branches: 4, depth: 2
      });
    }
    // 真相前的石台
    makeTable(0.6, -124, 0.8);
    // 最后一道门
    wall(-9, -130, -2.2, -130, 2.0, 0.8, { broken: true, gaps: 0.1 });
    wall(2.2, -130, 9, -130, 2.1, 0.8, { broken: true, gaps: 0.1 });
    boxMesh(-2.6, 0, -130, 0.9, 3.0, 0.9, stoneMat, 0, true, false);
    boxMesh(2.6, 0, -130, 0.9, 2.8, 0.9, stoneMat, 0, true, false);

    /* ---- 结局草地 ---- */
    for (var e = 0; e < 10; e++) {
      makeTree(-40 + e * 9 + Math.random() * 5, -140 - Math.random() * 22, {
        h: 5 + Math.random() * 4, r: 0.22, branches: 4, depth: 2
      });
    }
    boxMesh(0, 0, -150, 2.2, 0.34, 2.2, stoneMat, 0.3, true, true);

    /* ---- 草与地面细节 ---- */
    buildGrass();
    buildGrassCards();
    buildPebbles();
    buildFarScenery();

    /* ---- 碎片 ---- */
    fragGroup = new T.Group();
    scene.add(fragGroup);
    var glowTex = glowTexture('rgba(255,240,208,1)', 'rgba(255,220,170,.30)');
    FRAG_DEFS.forEach(function (def) {
      var holder = new T.Group();
      holder.position.set(def.pos[0], def.pos[1], def.pos[2]);
      var mesh = fragmentMesh(def.shape);
      mesh.scale.setScalar(def.scale || 1);
      mesh.rotation.y = def.rot || 0;
      holder.add(mesh);

      var glow = new T.Sprite(new T.SpriteMaterial({
        map: glowTex, transparent: true, blending: T.AdditiveBlending, depthWrite: false,
        opacity: def.truth ? 0.85 : 0.5
      }));
      glow.scale.set(def.truth ? 2.2 : 1.1, def.truth ? 2.2 : 1.1, 1);
      glow.position.y = 0.06;
      holder.add(glow);

      fragGroup.add(holder);
      var f = {
        def: def, id: def.id, name: def.name, stage: def.stage,
        holder: holder, mesh: mesh, glow: glow,
        home: new T.Vector3(def.pos[0], def.pos[1], def.pos[2]),
        picked: false, seen: false, truth: !!def.truth, bobPhase: Math.random() * 6.28
      };
      fragments.push(f);
      if (def.truth) {
        var pl = new T.PointLight(0xffd9a0, 0.9, 9, 2);
        pl.position.set(0, 0.5, 0);
        holder.add(pl);
        fragLights.push(pl);
      }
    });

    return { scene: scene, colliders: colliders, fragments: fragments };
  };

  /* ---------------- 环境光照 ---------------- */

  W.refreshEnv = function (top, mid, bot, sunColor, sunK) {
    if (!pmrem || !scene) return;
    try {
      var src = envEquirect(top, mid, bot, sunColor, sunK);
      var out = pmrem.fromEquirectangular(src);
      if (envTex && envTex.dispose) envTex.dispose();
      envTex = out;
      scene.environment = out.texture;
      src.dispose();
    } catch (err) {
      /* 忽略：无 IBL 也能跑 */
    }
  };

  /* ---------------- 大气：雾团 / 浮尘 ---------------- */

  function buildMist() {
    var tex = mistTexture();
    // 少而大、扁平但不"条"：贴地平铺的雾团，视觉上像浮在地面上的云
    for (var i = 0; i < 22; i++) {
      var z = 46 - i * 9.4 - Math.random() * 6;
      var x = pathXAt(z) + (Math.random() - 0.5) * 96;
      var mat = new T.SpriteMaterial({
        map: tex, transparent: true, depthWrite: false,
        opacity: 0, color: 0xffffff, fog: true
      });
      var sp = new T.Sprite(mat);
      var sc = 16 + Math.random() * 24;
      sp.scale.set(sc, sc * (0.52 + Math.random() * 0.16), 1);
      sp.position.set(x, 0.35 + Math.random() * 1.5, z);
      sp.material.rotation = (Math.random() - 0.5) * 0.16;
      sp.userData.base = 0.016 + Math.random() * 0.030;
      sp.userData.ph = Math.random() * 6.28;
      sp.userData.drift = (Math.random() - 0.5) * 0.55;
      sp.userData.homeX = x;
      scene.add(sp);
      mistBanks.push(sp);
    }
  }

  function buildDust() {
    var N = 760;
    var geo = new T.BufferGeometry();
    var arr = new Float32Array(N * 3);
    var meta = [];
    for (var i = 0; i < N; i++) {
      arr[i * 3] = (Math.random() - 0.5) * 34;
      arr[i * 3 + 1] = -2 + Math.random() * 7;
      arr[i * 3 + 2] = (Math.random() - 0.5) * 34;
      meta.push(0.035 + Math.random() * 0.11);
    }
    geo.setAttribute('position', new T.BufferAttribute(arr, 3));
    var mat = new T.PointsMaterial({
      size: 0.032, map: glowTexture('rgba(255,251,240,1)', 'rgba(255,240,210,.42)'),
      transparent: true, opacity: 0.4, depthWrite: false,
      blending: T.AdditiveBlending, sizeAttenuation: true, color: 0xfff2d6, fog: true
    });
    dust = new T.Points(geo, mat);
    dust.frustumCulled = false;
    dust.userData.vy = meta;
    scene.add(dust);
  }

  function bladeTexture() {
    var c = cv(16, 64), g = c.getContext('2d');
    var lg = g.createLinearGradient(0, 64, 0, 0);
    lg.addColorStop(0, '#66704a');
    lg.addColorStop(0.45, '#8b9160');
    lg.addColorStop(0.85, '#b6b47e');
    lg.addColorStop(1, '#d2cd98');
    g.fillStyle = lg;
    g.fillRect(0, 0, 16, 64);
    // 叶脉
    g.strokeStyle = 'rgba(60,70,40,.20)';
    g.lineWidth = 1;
    g.beginPath(); g.moveTo(8, 64); g.lineTo(8, 4); g.stroke();
    var tex = new T.CanvasTexture(c);
    tex.colorSpace = T.SRGBColorSpace;
    return tex;
  }

  // 一簇草：多片叶子合成一个几何体，实例化后视觉密度高一个数量级
  function tuftGeometry(blades, seg) {
    var pos = [], uv = [], idx = [], cols = [];
    var base = 0;
    for (var b = 0; b < blades; b++) {
      var ang = (b / blades) * Math.PI * 2 + Math.random() * 0.7;
      var ox = (Math.random() - 0.5) * 0.13;
      var oz = (Math.random() - 0.5) * 0.13;
      var hh = 0.7 + Math.random() * 0.55;
      var lean = 0.16 + Math.random() * 0.34;
      var ca = Math.cos(ang), sa = Math.sin(ang);
      var baseW = 0.0088 + Math.random() * 0.0042;
      var tone = 0.72 + Math.random() * 0.5;
      for (var i = 0; i <= seg; i++) {
        var t = i / seg;
        var w = baseW * (1 - Math.pow(t, 1.7) * 0.97);
        var y = t * 0.46 * hh;
        var bz = t * t * lean;
        for (var side = 0; side < 2; side++) {
          var lx = side ? w : -w;
          pos.push(lx * ca - bz * sa + ox, y, lx * sa + bz * ca + oz);
          uv.push(side, t);
          var g2 = tone * (0.86 + t * 0.30);
          cols.push(g2 * 0.94, g2, g2 * 0.74);
        }
      }
      for (var k = 0; k < seg; k++) {
        var p0 = base + k * 2, p1 = p0 + 1, p2 = p0 + 2, p3 = p0 + 3;
        idx.push(p0, p2, p1, p1, p2, p3);
      }
      base += (seg + 1) * 2;
    }
    var g = new T.BufferGeometry();
    g.setAttribute('position', new T.Float32BufferAttribute(pos, 3));
    g.setAttribute('uv', new T.Float32BufferAttribute(uv, 2));
    g.setAttribute('color', new T.Float32BufferAttribute(cols, 3));
    g.setIndex(idx);
    g.computeVertexNormals();
    return g;
  }

  var GRASS_MAX = 30000;
  var GRASS_TIERS = { high: 30000, med: 16000, low: 7000 };

  function buildGrass() {
    var geo = tuftGeometry(4, 2);
    var mat = new T.MeshStandardMaterial({
      map: bladeTexture(), side: T.DoubleSide, vertexColors: true,
      roughness: 0.92, metalness: 0, envMapIntensity: 0.45
    });
    mat.onBeforeCompile = function (shader) {
      shader.uniforms.uTime = { value: 0 };
      mat.userData.shader = shader;
      shader.vertexShader = 'uniform float uTime;\n' + shader.vertexShader.replace(
        '#include <begin_vertex>',
        [
          '#include <begin_vertex>',
          'vec3 wpos = (modelMatrix * instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0)).xyz;',
          'float ph = wpos.x * 0.42 + wpos.z * 0.31;',
          'float gust = 0.55 + 0.45 * sin(uTime * 0.37 + wpos.x * 0.055 + wpos.z * 0.048);',
          'float amp = (0.042 + 0.036 * sin(ph * 0.7)) * gust;',
          'float h2 = position.y * position.y * 5.0;',
          'transformed.x += sin(uTime * 1.55 + ph) * amp * h2;',
          'transformed.z += cos(uTime * 1.27 + ph * 1.37) * amp * h2 * 0.78;'
        ].join('\n')
      );
    };

    grassMesh = new T.InstancedMesh(geo, mat, GRASS_MAX);
    grassMesh.instanceMatrix.setUsage(T.DynamicDrawUsage);
    var dummy = new T.Object3D();
    var col = new T.Color();
    for (var i = 0; i < GRASS_MAX; i++) {
      var cz = 50 - Math.random() * 196;
      // 七成贴近道路，三成铺到远处
      var side = Math.random() > 0.5 ? 1 : -1;
      var off = Math.random() < 0.7
        ? Math.pow(Math.random(), 1.5) * 9
        : 9 + Math.random() * 26;
      var cx = pathXAt(cz) + side * (1.9 + off);
      dummy.position.set(cx, 0, cz);
      dummy.rotation.y = Math.random() * Math.PI * 2;
      var sc = 0.75 + Math.random() * 0.7;
      dummy.scale.set(sc, sc * (0.42 + Math.random() * 0.44), sc);
      dummy.updateMatrix();
      grassMesh.setMatrixAt(i, dummy.matrix);

      var warmth = cz > -20 ? 1 : cz > -74 ? 0.5 : 0.15;
      col.setRGB(0.42 + warmth * 0.16, 0.45 + warmth * 0.16, 0.31 + warmth * 0.12);
      col.offsetHSL((Math.random() - 0.5) * 0.10, -0.10 + Math.random() * 0.10, (Math.random() - 0.5) * 0.22);
      // 三成草叶偏枯黄：整个场地的绿才不会像一块塑料草坪
      if (Math.random() < 0.32) col.lerp(new T.Color(0.58, 0.51, 0.28), 0.35 + Math.random() * 0.3);
      if (cz < -74) {
        var grey = 0.30 + Math.random() * 0.06;
        col.lerp(new T.Color(grey, grey * 0.97, grey * 0.90), 0.55);
      }
      grassMesh.setColorAt(i, col);
    }
    grassMesh.count = GRASS_MAX;
    grassMesh.instanceMatrix.needsUpdate = true;
    if (grassMesh.instanceColor) grassMesh.instanceColor.needsUpdate = true;
    grassMesh.castShadow = false;
    grassMesh.receiveShadow = true;
    scene.add(grassMesh);
  }

  W.setGrassQuality = function (level) {
    if (!grassMesh) return;
    var n = GRASS_TIERS[level] || GRASS_MAX;
    grassMesh.count = Math.min(n, GRASS_MAX);
    if (grassCards) grassCards.count = Math.min(CARD_TIERS[level] || CARD_MAX, CARD_MAX);
  };

  /* ---------------- 草丛卡片：让近景不是一根根孤立的草 ---------------- */

  var grassCards = null;
  var CARD_MAX = 9000;
  var CARD_TIERS = { high: 9000, med: 5200, low: 2200 };

  function grassCardTexture() {
    var S = 256, c = cv(S, S), g = c.getContext('2d');
    g.clearRect(0, 0, S, S);
    var blades = 22;
    for (var i = 0; i < blades; i++) {
      var x0 = S * 0.5 + (Math.random() - 0.5) * S * 0.72;
      var h = S * (0.34 + Math.random() * 0.58);
      var lean = (Math.random() - 0.5) * S * 0.30;
      var w = 2.4 + Math.random() * 3.4;
      var tone = 0.55 + Math.random() * 0.45;
      var dry = Math.random() < 0.35;
      var r0 = Math.round((dry ? 84 : 50) * tone + 26);
      var g0 = Math.round((dry ? 80 : 68) * tone + 26);
      var b0 = Math.round((dry ? 44 : 32) * tone + 18);
      var r1 = Math.round(r0 * 1.95), g1 = Math.round(g0 * 1.85), b1 = Math.round(b0 * 2.0);
      var grad = g.createLinearGradient(0, S, 0, S - h);
      grad.addColorStop(0, 'rgba(' + r0 + ',' + g0 + ',' + b0 + ',1)');
      grad.addColorStop(0.55, 'rgba(' + (r0 * 1.4 | 0) + ',' + (g0 * 1.35 | 0) + ',' + (b0 * 1.3 | 0) + ',1)');
      grad.addColorStop(1, 'rgba(' + Math.min(255, r1) + ',' + Math.min(255, g1) + ',' + Math.min(255, b1) + ',1)');
      g.fillStyle = grad;
      g.beginPath();
      g.moveTo(x0 - w * 0.5, S);
      g.quadraticCurveTo(x0 + lean * 0.35 - w * 0.18, S - h * 0.55, x0 + lean, S - h);
      g.quadraticCurveTo(x0 + lean * 0.35 + w * 0.18, S - h * 0.55, x0 + w * 0.5, S);
      g.closePath();
      g.fill();
    }
    var t = new T.CanvasTexture(c);
    t.colorSpace = T.SRGBColorSpace;
    t.anisotropy = 4;
    return t;
  }

  function crossCardGeometry() {
    var pos = [], nor = [], uv = [], idx = [];
    function quad(a) {
      var ca = Math.cos(a), sa = Math.sin(a);
      var base = pos.length / 3;
      var pts = [[-0.5, 1], [0.5, 1], [0.5, 0], [-0.5, 0]];
      var uvs = [[0, 1], [1, 1], [1, 0], [0, 0]];
      for (var i = 0; i < 4; i++) {
        pos.push(pts[i][0] * ca, pts[i][1], pts[i][0] * sa);
        uv.push(uvs[i][0], uvs[i][1]);
        nor.push(0, 0.86, 0);
      }
      idx.push(base, base + 1, base + 2, base, base + 2, base + 3);
    }
    quad(0);
    quad(Math.PI / 2);
    var g = new T.BufferGeometry();
    g.setAttribute('position', new T.Float32BufferAttribute(pos, 3));
    g.setAttribute('normal', new T.Float32BufferAttribute(nor, 3));
    g.setAttribute('uv', new T.Float32BufferAttribute(uv, 2));
    g.setIndex(idx);
    return g;
  }

  function buildGrassCards() {
    var mat = new T.MeshStandardMaterial({
      map: grassCardTexture(), side: T.DoubleSide, alphaTest: 0.42,
      roughness: 0.94, metalness: 0, envMapIntensity: 0.4
    });
    mat.onBeforeCompile = function (shader) {
      shader.uniforms.uTime = { value: 0 };
      mat.userData.shader = shader;
      shader.vertexShader = 'uniform float uTime;\n' + shader.vertexShader.replace(
        '#include <begin_vertex>',
        [
          '#include <begin_vertex>',
          'vec3 wpos = (modelMatrix * instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0)).xyz;',
          'float ph = wpos.x * 0.44 + wpos.z * 0.33;',
          'float gust = 0.55 + 0.45 * sin(uTime * 0.35 + wpos.x * 0.05 + wpos.z * 0.045);',
          'float amp = (0.055 + 0.05 * sin(ph * 0.7)) * gust;',
          'float h2 = position.y * position.y;',
          'transformed.x += sin(uTime * 1.5 + ph) * amp * h2;',
          'transformed.z += cos(uTime * 1.22 + ph * 1.4) * amp * h2 * 0.8;'
        ].join('\n')
      );
    };

    grassCards = new T.InstancedMesh(crossCardGeometry(), mat, CARD_MAX);
    grassCards.instanceMatrix.setUsage(T.DynamicDrawUsage);
    var dummy = new T.Object3D();
    var col = new T.Color();
    for (var i = 0; i < CARD_MAX; i++) {
      var cz = 52 - Math.random() * 200;
      var side = Math.random() > 0.5 ? 1 : -1;
      // 主要铺在离路 0.4 - 15 米：这一段是镜头最常扫过的区域
      var off = 0.4 + Math.pow(Math.random(), 1.25) * 15;
      var cx = pathXAt(cz) + side * off;
      dummy.position.set(cx, 0, cz);
      dummy.rotation.y = Math.random() * Math.PI;
      var sc = 0.42 + Math.random() * 0.62;
      dummy.scale.set(sc * (0.85 + Math.random() * 0.4), sc * (0.72 + Math.random() * 0.6), sc);
      dummy.updateMatrix();
      grassCards.setMatrixAt(i, dummy.matrix);

      var warmth = cz > -20 ? 1 : cz > -74 ? 0.5 : 0.15;
      col.setRGB(0.44 + warmth * 0.15, 0.47 + warmth * 0.15, 0.32 + warmth * 0.11);
      col.offsetHSL((Math.random() - 0.5) * 0.09, -0.06 + Math.random() * 0.10, (Math.random() - 0.5) * 0.22);
      if (Math.random() < 0.35) col.lerp(new T.Color(0.62, 0.54, 0.30), 0.30 + Math.random() * 0.28);
      if (cz < -74) {
        var grey2 = 0.32 + Math.random() * 0.07;
        col.lerp(new T.Color(grey2, grey2 * 0.97, grey2 * 0.90), 0.5);
      }
      grassCards.setColorAt(i, col);
    }
    grassCards.count = CARD_MAX;
    grassCards.instanceMatrix.needsUpdate = true;
    if (grassCards.instanceColor) grassCards.instanceColor.needsUpdate = true;
    grassCards.castShadow = false;
    grassCards.receiveShadow = true;
    scene.add(grassCards);
  }

  function buildPebbles() {
    var geo = paintAO(new T.DodecahedronGeometry(1, 0), 0.72);
    var N = 4200;
    var mesh = new T.InstancedMesh(geo, stoneMat, N);
    var dummy = new T.Object3D();
    var col = new T.Color();
    for (var i = 0; i < N; i++) {
      var z = 50 - Math.random() * 190;
      var side = Math.random() > 0.5 ? 1 : -1;
      var off = Math.pow(Math.random(), 2.3) * 18;
      var x = pathXAt(z) + side * (1.8 + off);
      var s = 0.022 + Math.pow(Math.random(), 2.4) * 0.075;
      dummy.position.set(x, s * 0.34, z);
      dummy.rotation.set(Math.random() * 3, Math.random() * 3, Math.random() * 3);
      dummy.scale.set(s, s * (0.5 + Math.random() * 0.5), s * (0.7 + Math.random() * 0.6));
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
      var v = 0.30 + Math.random() * 0.34;
      col.setRGB(v, v * 0.97, v * 0.88);
      mesh.setColorAt(i, col);
    }
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    scene.add(mesh);
  }

  /* ---------------- 远景剪影：林线与灌丛 ----------------
     作用有两个：一是把地平线上那条毫无信息的空白带打碎，
     二是给薄雾段提供“远处还有东西”的纵深线索。
     全部合并成两个 draw call，且不投影、不接收投影。 */

  var farTrees = null, farScrub = null;

  function buildFarScenery() {
    var parts = [];
    var upV = new T.Vector3(0, 1, 0);

    function limb(px, py, pz, dir, len, rad, depth) {
      var start = new T.Vector3(px, py, pz);
      var end = start.clone().addScaledVector(dir, len);
      var mid = start.clone().add(end).multiplyScalar(0.5);
      var g = new T.CylinderGeometry(rad * 0.5, rad, len, depth > 0 ? 5 : 4, 1, false);
      var q = new T.Quaternion().setFromUnitVectors(upV, dir.clone().normalize());
      g.applyMatrix4(new T.Matrix4().compose(mid, q, new T.Vector3(1, 1, 1)));
      parts.push(g);
      if (depth <= 0) return;
      var k = 2 + (Math.random() > 0.45 ? 1 : 0);
      for (var i = 0; i < k; i++) {
        var nd = new T.Vector3(
          dir.x + (Math.random() - 0.5) * 1.15,
          dir.y * 0.78 + 0.24 + Math.random() * 0.2,
          dir.z + (Math.random() - 0.5) * 1.15
        ).normalize();
        limb(end.x, end.y, end.z, nd, len * (0.54 + Math.random() * 0.22), rad * 0.6, depth - 1);
      }
    }

    function tree(tx, tz, h, r) {
      var before = parts.length;
      var lean = new T.Vector3((Math.random() - 0.5) * 0.16, 1, (Math.random() - 0.5) * 0.16).normalize();
      limb(0, 0, 0, lean, h * 0.56, r, 2);
      // 树冠处的几根细枝，远看就是一个"炸开的头"
      for (var b = 0; b < 3; b++) {
        var a = Math.random() * 6.28;
        var d = new T.Vector3(Math.cos(a) * 0.55, 1, Math.sin(a) * 0.55).normalize();
        limb(lean.x * h * 0.55, h * 0.55, lean.z * h * 0.55, d, h * (0.26 + Math.random() * 0.2), r * 0.42, 1);
      }
      // 统一平移到世界坐标
      for (var i = before; i < parts.length; i++) parts[i].translate(tx, 0, tz);
    }

    // 走廊保护区：这块不放远景树，免得挡路或穿模
    function blocked(x, z) {
      return Math.abs(x) < 48 && z < 62 && z > -216;
    }

    var placed = 0, guard = 0;
    while (placed < 96 && guard < 4000) {
      guard++;
      var lx = (Math.random() * 2 - 1) * 290;
      var lz = -74 + (Math.random() * 2 - 1) * 235;
      var rr = Math.sqrt(lx * lx + (lz + 74) * (lz + 74));
      if (rr < 58 || rr > 320) continue;
      if (blocked(lx, lz)) continue;
      // 越远越高，远看才有层次
      var hh = 6.5 + rr / 42 + Math.random() * 5;
      tree(lx, lz, Math.min(hh, 22), 0.16 + Math.random() * 0.16);
      placed++;
    }

    if (parts.length) {
      farTrees = new T.Mesh(mergeGeos(parts), new T.MeshStandardMaterial({
        color: 0x3f4237, roughness: 1, metalness: 0, flatShading: true, envMapIntensity: 0.5
      }));
      farTrees.castShadow = false;
      farTrees.receiveShadow = false;
      farTrees.frustumCulled = true;
      scene.add(farTrees);
    }

    // 灌丛：36 - 130 米之间的矮丛，填补树干与地面草之间的空档
    var sg = paintAO(new T.IcosahedronGeometry(1, 1), 0.55);
    var smat = new T.MeshStandardMaterial({
      color: 0x4d5138, roughness: 1, metalness: 0, vertexColors: true, flatShading: true, envMapIntensity: 0.45
    });
    var N = 1400;
    farScrub = new T.InstancedMesh(sg, smat, N);
    var dummy = new T.Object3D();
    var col2 = new T.Color();
    var n = 0;
    for (var i2 = 0; i2 < N * 4 && n < N; i2++) {
      var sx = (Math.random() * 2 - 1) * 150;
      var sz = 58 - Math.random() * 290;
      if (blocked(sx, sz) && Math.abs(sx) < 26) continue;
      if (sz < -126) continue;
      var s2 = 0.34 + Math.pow(Math.random(), 2.0) * 1.05;
      dummy.position.set(sx, s2 * 0.26, sz);
      dummy.rotation.set((Math.random() - 0.5) * 0.3, Math.random() * 6.28, (Math.random() - 0.5) * 0.3);
      dummy.scale.set(s2 * (0.95 + Math.random() * 0.5), s2 * (0.62 + Math.random() * 0.38), s2 * (0.95 + Math.random() * 0.5));
      dummy.updateMatrix();
      farScrub.setMatrixAt(n, dummy.matrix);
      var v2 = 0.42 + Math.random() * 0.22;
      col2.setRGB(v2, v2 * 1.02, v2 * 0.78);
      farScrub.setColorAt(n, col2);
      n++;
    }
    farScrub.count = n;
    farScrub.instanceMatrix.needsUpdate = true;
    if (farScrub.instanceColor) farScrub.instanceColor.needsUpdate = true;
    farScrub.castShadow = false;
    farScrub.receiveShadow = false;
    scene.add(farScrub);
  }

  function pathXAt(z) {    // 与贴图路径近似的解析函数
    var t = (56 - z) / 220;
    return Math.sin(t * 9.2) * 1.6 + Math.cos(t * 4.1) * 0.9;
  }

  /* ---------------- 更新 & 阶段 ---------------- */

  W.setStage = function (s, instant) {
    stageNow = s;
    var col, den, top, mid, bot, sunK, sunPos, sunColor;
    // 天球底部的颜色直接取雾色：地平线两侧同色，才不会有硬色阶
    if (s === 0) {
      col = 0xcdc4b2; den = 0.0105;
      top = 0x8ea6ba; mid = 0xd8d1c1; bot = col; sunK = 1.05;
      sunPos = new T.Vector3(0.36, 0.17, -1).normalize(); sunColor = 0xfff0d0;
    } else if (s === 1) {
      col = 0xa4a29a; den = 0.040;
      top = 0x76838d; mid = 0x9d9d98; bot = col; sunK = 0.34;
      sunPos = new T.Vector3(0.3, 0.22, -1).normalize(); sunColor = 0xefe6d2;
    } else if (s === 2) {
      col = 0x6a6660; den = 0.060;
      top = 0x41454b; mid = 0x575651; bot = col; sunK = 0.18;
      sunPos = new T.Vector3(0.2, 0.3, -1).normalize(); sunColor = 0xb2aea4;
    } else {
      // 结局草地
      col = 0xd6d2c6; den = 0.012;
      top = 0x9fb2c0; mid = 0xdedbd0; bot = col; sunK = 1.25;
      sunPos = new T.Vector3(0.4, 0.2, -1).normalize(); sunColor = 0xfff2d6;
    }
    fogTarget.color = new T.Color(col);
    fogTarget.density = den;

    // 各段的调色与光学参数
    if (s === 0) {
      gradeTarget = { exposure: 0.42, bloom: 0.13, threshold: 1.08, saturation: 1.02, contrast: 1.30, warmth: 0.050, shafts: 0.26, vignette: 0.86, grain: 0.020, clouds: 1.0 };
    } else if (s === 1) {
      gradeTarget = { exposure: 0.52, bloom: 0.16, threshold: 1.06, saturation: 0.82, contrast: 1.28, warmth: 0.006, shafts: 0.20, vignette: 0.92, grain: 0.028, clouds: 0.55 };
    } else if (s === 2) {
      gradeTarget = { exposure: 0.58, bloom: 0.16, threshold: 1.02, saturation: 0.58, contrast: 1.30, warmth: -0.030, shafts: 0.04, vignette: 0.95, grain: 0.030, clouds: 0.22 };
    } else {
      gradeTarget = { exposure: 0.80, bloom: 0.20, threshold: 1.16, saturation: 1.12, contrast: 1.14, warmth: 0.060, shafts: 0.30, vignette: 0.68, grain: 0.016, clouds: 0.85 };
    }
    if (instant && YH.Post) {
      var pp = YH.Post.params;
      pp.exposure = gradeTarget.exposure;
      pp.bloom = gradeTarget.bloom;
      pp.threshold = gradeTarget.threshold;
      pp.saturation = gradeTarget.saturation;
      pp.contrast = gradeTarget.contrast;
      pp.warmth = gradeTarget.warmth;
      pp.shafts = gradeTarget.shafts;
      pp.vignette = gradeTarget.vignette;
      pp.grain = gradeTarget.grain;
    }

    if (skyMat) {
      skyMat.uniforms.topColor.value.set(top);
      skyMat.uniforms.midColor.value.set(mid);
      skyMat.uniforms.botColor.value.set(bot);
      skyMat.uniforms.sunK.value = sunK;
      skyMat.uniforms.sunDir.value.copy(sunPos);
      skyMat.uniforms.sunColor.value.set(sunColor);
    }
    if (sunSprite) {
      sunSprite.material.opacity = s === 2 ? 0.10 : s === 1 ? 0.24 : 0.5;
      sunSprite.position.copy(sunPos).multiplyScalar(300);
    }
    if (instant) {
      fog.color.copy(fogTarget.color);
      fog.density = fogTarget.density;
    }
    if (hemiLight) hemiLight.intensity = [0.36, 0.34, 0.50, 0.38][s] || 0.30;
    if (W.sun) {
      W.sun.intensity = [1.30, 0.86, 0.62, 1.70][s] || 1.2;
      W.sun.color.set(sunColor);
    }

    // 环境球：每次换段重建一次
    W.refreshEnv(top, mid, bot, sunColor, sunK);

    // 雾团色调跟随
    for (var mb = 0; mb < mistBanks.length; mb++) {
      mistBanks[mb].material.color.setHex(col);
    }
  };

  W.update = function (dt, camera) {
    clockT += dt;
    // 雾平滑
    fog.color.lerp(fogTarget.color, Math.min(1, dt * 0.35));

    // 站在高处：雾薄一点，看得更远
    var eye = camera ? camera.position.y : 1.62;
    var hBonus = Math.min(1, Math.max(0, (eye - 1.6) / 2.2));
    var targetDen = fogTarget.density * (1 - 0.28 * hBonus);
    fog.density += (targetDen - fog.density) * Math.min(1, dt * 1.6);

    // 碎片浮动
    for (var i = 0; i < fragments.length; i++) {
      var f = fragments[i];
      if (!f.holder.visible) continue;
      f.holder.position.y = f.home.y + Math.sin(clockT * 1.1 + f.bobPhase) * 0.018;
      f.mesh.rotation.y += dt * 0.28;
      var pulse = 0.42 + Math.sin(clockT * 1.6 + f.bobPhase) * 0.1;
      f.glow.material.opacity = (f.truth ? 0.8 : 0.45) * (0.8 + Math.sin(clockT * 1.4 + f.bobPhase) * 0.2);
    }
    for (var li = 0; li < fragLights.length; li++) {
      fragLights[li].intensity = 0.7 + Math.sin(clockT * 1.3) * 0.15;
    }

    // 云漂移
    for (var c = 0; c < clouds.length; c++) {
      clouds[c].sp.position.x += dt * clouds[c].sp2 * 1.3;
      if (clouds[c].sp.position.x > 300) clouds[c].sp.position.x = -300;
    }

    // 水波
    if (waterMesh) {
      var wm = waterMesh.material;
      wm.roughness = 0.07 + Math.sin(clockT * 0.8) * 0.015;
      if (wm.normalMap) {
        wm.normalMap.offset.x = clockT * 0.012;
        wm.normalMap.offset.y = clockT * 0.008;
      }
    }

    // 草风
    var gm = grassMesh && grassMesh.material.userData.shader;
    if (gm) gm.uniforms.uTime.value = clockT;
    var gc = grassCards && grassCards.material.userData.shader;
    if (gc) gc.uniforms.uTime.value = clockT;

    // 天空云层
    if (skyMat) skyMat.uniforms.uTime.value = clockT;
    if (skyMat) skyMat.uniforms.uFog.value.copy(fog.color);
    if (skyMat && gradeTarget) {
      skyMat.uniforms.uCloud.value += (gradeTarget.clouds - skyMat.uniforms.uCloud.value) * Math.min(1, dt * 0.8);
    }

    // 调色平滑过渡
    if (gradeTarget && YH.Post && !W.gradeLock) {
      var gp = YH.Post.params;
      var gk = Math.min(1, dt * 0.85);
      gp.exposure += (gradeTarget.exposure - gp.exposure) * gk;
      gp.bloom += (gradeTarget.bloom - gp.bloom) * gk;
      gp.threshold += (gradeTarget.threshold - gp.threshold) * gk;
      gp.saturation += (gradeTarget.saturation - gp.saturation) * gk;
      gp.contrast += (gradeTarget.contrast - gp.contrast) * gk;
      gp.warmth += (gradeTarget.warmth - gp.warmth) * gk;
      gp.shafts += (gradeTarget.shafts - gp.shafts) * gk;
      gp.vignette += (gradeTarget.vignette - gp.vignette) * gk;
      gp.grain += (gradeTarget.grain - gp.grain) * gk;
    }

    // 雾团：漂移 + 近处淡出
    if (camera) {
      for (var mi = 0; mi < mistBanks.length; mi++) {
        var sp = mistBanks[mi];
        sp.position.x += dt * sp.userData.drift;
        if (sp.position.x > sp.userData.homeX + 12) sp.position.x = sp.userData.homeX - 12;
        if (sp.position.x < sp.userData.homeX - 12) sp.position.x = sp.userData.homeX + 12;
        var dx = sp.position.x - camera.position.x;
        var dz = sp.position.z - camera.position.z;
        var dd = Math.sqrt(dx * dx + dz * dz);
        var near = Math.min(1, Math.max(0, (dd - 16) / 20));
        var breathe = 0.75 + 0.25 * Math.sin(clockT * 0.33 + sp.userData.ph);
        sp.material.opacity = sp.userData.base * near * breathe;
      }
    }

    // 浮尘：跟随相机，缓慢上升
    if (dust && camera) {
      dust.position.set(camera.position.x, camera.position.y - 1.6, camera.position.z);
      var dp = dust.geometry.attributes.position;
      var arr = dp.array;
      var vy = dust.userData.vy;
      for (var di = 0; di < vy.length; di++) {
        arr[di * 3 + 1] += vy[di] * dt;
        if (arr[di * 3 + 1] > 5.2) arr[di * 3 + 1] = -2;
        arr[di * 3] += Math.sin(clockT * 0.4 + di) * dt * 0.06;
      }
      dp.needsUpdate = true;
    }

    // 阴影跟随
    if (W.sun && camera) {
      W.sun.position.set(camera.position.x + 42, 40, camera.position.z + 22);
      W.sun.target.position.set(camera.position.x, 0, camera.position.z);
      W.sun.target.updateMatrixWorld();
    }
  };

  W.stageOf = function (z) {
    if (z > -20.4) return 0;
    if (z > -74.2) return 1;
    if (z > -130.4) return 2;
    return 3;
  };

  W.fogNow = function () { return fog.density; };
  W.dbg = function () {
    return {
      stage: stageNow,
      fog: +fog.density.toFixed(4),
      fogTarget: +fogTarget.density.toFixed(4),
      fogCol: fog.color.getHexString(),
      targetCol: fogTarget.color.getHexString(),
      skyTop: skyMat ? skyMat.uniforms.topColor.value.getHexString() : '-'
    };
  };
  W.sunPos = function () { return sunSprite ? sunSprite.position : null; };
  W.FRAG_DEFS = FRAG_DEFS;
  W.fragments = fragments;
  W.colliders = colliders;
  W.scene = function () { return scene; };

  YH.World = W;
})(window.YH = window.YH || {});
