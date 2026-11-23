/* 余痕 · 世界构建（地形 / 废墟 / 可攀爬物 / 碎片 / 雾区） */
(function (YH) {
  'use strict';

  var W = {};
  var T = THREE;

  var WORLD = { x0: -114, x1: 114, z0: -102, z1: 118 };

  /* 中央荒原 + 五片回忆区（按《枢纽：回忆荒原》布点）
     方位角从 +z（北）顺时针量；入口碑立在枢纽石环缺口外。 */
  var HUB_R = 30;
  var PLACES = [
    {
      key: 'child', stage: 0, name: '童年区', sub: '灶台与银杏院 · 旧巷早点摊',
      x0: -26, x1: 26, z0: 54, z1: 104,
      gate: { x: 10, z: 54 }, gap: { x: 0, z: HUB_R }, ang: 0
    },
    {
      key: 'youth', stage: 1, name: '少年区', sub: '小学办公室 · 初中岔路口 · 高中走廊',
      x0: 50, x1: 98, z0: 0, z1: 48,
      gate: { x: 50, z: 24 }, gap: { x: 28.5, z: 9.3 }, ang: 72
    },
    {
      key: 'loss', stage: 2, name: '亲情与失去区', sub: '旧家饭桌 · 医院长廊 · 大学宿舍',
      x0: 22, x1: 70, z0: -88, z1: -40,
      gate: { x: 40, z: -40 }, gap: { x: 17.6, z: -24.3 }, ang: 144
    },
    {
      key: 'adult', stage: 3, name: '成年疏离区', sub: '城市餐厅 · 拆迁围挡 · 出租屋浴室',
      x0: -70, x1: -22, z0: -88, z1: -40,
      gate: { x: -52, z: -40 }, gap: { x: -17.6, z: -24.3 }, ang: 216
    },
    {
      key: 'final', stage: 4, name: '终章区', sub: '柜子深处 · 一条向前的长路',
      x0: -98, x1: -50, z0: 0, z1: 48,
      gate: { x: -50, z: 24 }, gap: { x: -28.5, z: 9.3 }, ang: 288
    }
  ];
  // 结局点：终章长路尽头
  var EXIT_POINT = { x: -95, z: 20 };
  var END_POINT = { x: -93, z: 20 };
  // 需要避开草木的室内地面（x0,z0,x1,z1）
  var FLOORS = [];

  var scene, root, stoneMat, stoneDarkMat, stoneMat3, woodMat, metalMat, ceramicMat, ceilMat, ceilDarkMat, beamMat;
  var brickMat, paperMat, blueMat, whiteMat, tileMat, darkWoodMat, clothMat, mirrorMat, glassMat;
  var leafMat = null, ginkgoTex = null;
  var steams = [], gateLights = [], exitGate = null, exitClosed = false;
  var fragGroup, colliders = [], fragments = [], clouds = [], grassMesh, waterMesh, sunSprite, groundMesh;
  var skyMat, fog, fragLights = [], pmrem = null, mistBanks = [], dust = null, hemiLight = null;
  var gradeTarget = null, envTex = null;
  var clockT = 0;
  var fogTarget = { color: new T.Color(0xd9d0c1), density: 0.011 };
  var sunDirCur = new T.Vector3(0.4, 0.45, 0.6);
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

    // 土路：从枢纽中央的石环向五个缺口辐射，再接到各区入口
    function strokeTrail(pts, width, color, blur) {
      g.save();
      g.lineCap = 'round';
      g.lineJoin = 'round';
      g.strokeStyle = color;
      g.lineWidth = width;
      if (blur) g.filter = 'blur(' + blur + 'px)';
      g.beginPath();
      for (var k = 0; k < pts.length; k++) {
        var X = px(pts[k][0]), Y = py(pts[k][1]);
        if (k === 0) g.moveTo(X, Y); else g.lineTo(X, Y);
      }
      g.stroke();
      g.restore();
    }

    var trails = [];
    PLACES.forEach(function (p, i) {
      var gx = p.gate.x, gz = p.gate.z;
      var mx = p.gap.x * 1.02, mz = p.gap.z * 1.02;
      var pts = [[0, 0]];
      // 略微弯折的土路，避免五条路像尺子画出来的
      var bend = (i % 2 ? 1 : -1) * (2.5 + i * 0.6);
      for (var t = 0.25; t < 1; t += 0.25) {
        pts.push([
          mx * t + Math.sin(t * 3.4 + i) * bend,
          mz * t + Math.cos(t * 2.6 + i) * bend * 0.7
        ]);
      }
      pts.push([mx, mz]);
      pts.push([(mx + gx) / 2 + Math.sin(i * 1.7) * 2.2, (mz + gz) / 2 + Math.cos(i * 2.1) * 2.0]);
      pts.push([gx, gz]);
      trails.push(pts);
    });
    trails.forEach(function (pts) {
      strokeTrail(pts, 26, 'rgba(74,70,58,.30)', 12);
      strokeTrail(pts, 17, 'rgba(88,83,70,.52)', 7);
      strokeTrail(pts, 11, '#5c574b', 3);
      strokeTrail(pts, 6, '#686254', 2);
    });
    // 枢纽里的一圈踏出来的环路
    (function () {
      var ring = [];
      for (var a = 0; a <= 64; a++) {
        var ang = a / 64 * Math.PI * 2;
        ring.push([Math.sin(ang) * 17, Math.cos(ang) * 17]);
      }
      strokeTrail(ring, 20, 'rgba(80,76,63,.26)', 10);
      strokeTrail(ring, 9, 'rgba(96,90,77,.42)', 4);
    })();

    g.save();
    g.globalAlpha = 0.35;
    for (var d = 0; d < 3400; d++) {
      var pi = Math.floor(Math.random() * trails.length);
      var seg = trails[pi];
      var si = Math.floor(Math.random() * (seg.length - 1));
      var f2 = Math.random();
      var tx2 = seg[si][0] + (seg[si + 1][0] - seg[si][0]) * f2 + (Math.random() - 0.5) * 5;
      var tz2 = seg[si][1] + (seg[si + 1][1] - seg[si][1]) * f2 + (Math.random() - 0.5) * 5;
      g.fillStyle = Math.random() > 0.5 ? '#7d7667' : '#a0998a';
      g.fillRect(px(tx2) + Math.random() * 4, py(tz2) + Math.random() * 4, 1 + Math.random() * 2.5, 1 + Math.random() * 2);
    }
    g.restore();

    // 湿痕：只做很轻的暗斑，别让它变成水面上的一块亮斑
    var puddles = [[-13, -6, 4.5], [66, 14, 3.5], [40, -56, 5], [-56, 16, 3.5]];
    puddles.forEach(function (p) {
      var rg = g.createRadialGradient(px(p[0]), py(p[1]), p[2] * 1.4, px(p[0]), py(p[1]), p[2] * 4.2);
      rg.addColorStop(0, 'rgba(58,56,48,.22)');
      rg.addColorStop(0.6, 'rgba(58,56,48,.11)');
      rg.addColorStop(1, 'rgba(58,56,48,0)');
      g.fillStyle = rg;
      g.beginPath(); g.arc(px(p[0]), py(p[1]), p[2] * 4.2, 0, 6.29); g.fill();
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
      var base = new T.Mesh(chippedBox(w * 1.12, hb, d * 1.12, 0.045, Math.round(Math.abs(cx * 11 + cz * 7)) % 991), bmat);
      base.position.set(cx, hb / 2, cz);
      base.rotation.y = ang + (Math.random() - 0.5) * 0.012;
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
    /* ---- 区域 1 · 童年：灶台与银杏院 / 旧巷早点摊 ---- */
    {
      id: 'stovechunk', stage: 0, name: '磨亮的灶台碎砖', shape: 'brick', mood: 'warm', seed: 1101,
      tier: 'main', where: '灶台边', pos: [10.4, 1.08, 75.0], rot: 0.4, scale: 1,
      shots: [
        { scene: 'stove', dur: 8.0, line: '我不饿，你吃。' },
        { scene: 'bowl', dur: 7.0 },
        { scene: 'steamface', dur: 6.5, line: '乖乖，吃饭了。' }
      ]
    },
    {
      id: 'oilpaper', stage: 0, name: '浸透油的纸袋残片', shape: 'bag', mood: 'warm', seed: 1102,
      tier: 'corner', where: '早点摊旁的地上', pos: [16.6, 0.10, 62.6], rot: -0.3, scale: 1.15,
      shots: [
        { scene: 'stall', dur: 8.0, line: '老样子，不要葱？' },
        { scene: 'bagshot', dur: 6.5, line: '长身体，多吃点。' },
        { scene: 'alley', dur: 7.0 }
      ]
    },

    /* ---- 区域 2 · 少年：小学办公室 / 初中岔路口 / 高中走廊 ---- */
    {
      id: 'homework', stage: 1, name: '泛黄的作业本残页', shape: 'page', mood: 'gray', seed: 1103,
      tier: 'high', where: '办公室窗台（要攀上去）', pos: [75, 1.86, 41.2], rot: 1.1, scale: 1.2,
      shots: [
        { scene: 'office', dur: 7.5 },
        { scene: 'redink', dur: 7.5, line: '下次别糊弄自己。' }
      ]
    },
    {
      id: 'note', stage: 1, name: '揉皱又展平的纸条', shape: 'note', mood: 'gray', seed: 1104,
      tier: 'corner', where: '初中课桌抽屉', pos: [58.4, 0.78, 23.6], rot: 0.8, scale: 1.1,
      shots: [
        { scene: 'classroom', dur: 7.5, line: '到家跟我说一声。' },
        { scene: 'fork', dur: 6.5 },
        { scene: 'chat', dur: 7.0 }
      ]
    },
    {
      id: 'exam', stage: 1, name: '试卷的一角', shape: 'ticket', mood: 'gray', seed: 2101,
      tier: 'main', where: '高中走廊窗边', pos: [57.4, 0.08, 5.4], rot: 0.2, scale: 1.1,
      shots: [
        { scene: 'corridor', dur: 8.0, line: '你也就这样了。' },
        { scene: 'standbell', dur: 6.5 }
      ]
    },

    /* ---- 区域 3 · 亲情与失去：医院 / 宿舍 / 巷口 ---- */
    {
      id: 'enamel', stage: 2, name: '掉漆搪瓷碗的瓷片', shape: 'shard', mood: 'gray', seed: 2102,
      tier: 'main', where: '病房床头柜', pos: [58.6, 0.88, -69.4], rot: 0.7, scale: 1.0,
      shots: [
        { scene: 'ward', dur: 8.0, line: '乖乖来了。' },
        { scene: 'handbowl', dur: 7.5, line: '我不饿。' },
        { scene: 'sink', dur: 6.5 }
      ]
    },
    {
      id: 'mug', stage: 2, name: '白搪瓷杯口的碎块', shape: 'cup', mood: 'gray', seed: 2103,
      tier: 'high', where: '宿舍上铺（要攀上去）', pos: [27.5, 1.74, -78.2], rot: -0.5, scale: 1.1,
      shots: [
        { scene: 'dorm', dur: 8.0 },
        { scene: 'cupwater', dur: 7.0, line: '好点没。' }
      ]
    },
    {
      id: 'dogfood', stage: 2, name: '褪色的狗粮袋残片', shape: 'bag', mood: 'gray', seed: 2104,
      tier: 'corner', where: '石墩旁边的草丛', pos: [67.0, 0.10, -81.6], rot: 0.9, scale: 1.1,
      shots: [
        { scene: 'canteen', dur: 7.5, line: '来福没了，老死的。' },
        { scene: 'alley', dur: 8.0 }
      ]
    },

    /* ---- 区域 4 · 成年疏离：餐厅 / 拆迁围挡 / 浴室 ---- */
    {
      id: 'receipt', stage: 3, name: '打印模糊的餐饮小票', shape: 'ticket', mood: 'dark', seed: 3101,
      tier: 'main', where: '餐桌桌面', pos: [-37.4, 0.81, -49.6], rot: 0.5, scale: 1.15,
      shots: [
        { scene: 'canteen', dur: 7.5, line: '没事，你忙。' },
        { scene: 'phone', dur: 8.0, line: '改天。' }
      ]
    },
    {
      id: 'root', stage: 3, name: '银杏的白色断根', shape: 'root', mood: 'dark', seed: 3102,
      tier: 'corner', where: '围挡缝隙', pos: [-59.2, 0.16, -68.8], rot: -0.4, scale: 1.0,
      shots: [
        { scene: 'fence', dur: 8.5 },
        { scene: 'rootclose', dur: 7.5, line: '有些故乡，长大就是用来失去的。' }
      ]
    },
    {
      id: 'glass', stage: 3, name: '镜面玻璃碎屑', shape: 'glass', mood: 'dark', seed: 3103,
      tier: 'main', where: '洗手台边缘', pos: [-25.35, 0.90, -81.4], rot: 0.15, scale: 1.1,
      shots: [
        { scene: 'mirror', dur: 9.0, line: '是不是我不够好。' },
        { scene: 'sink', dur: 6.0 }
      ]
    },

    /* ---- 区域 5 · 终章：柜子深处 / 长路 ---- */
    {
      id: 'woodbox', stage: 4, name: '空木盒的木屑', shape: 'box', mood: 'truth', seed: 3104, truth: true,
      tier: 'main', where: '柜子底部', pos: [-86, 0.18, 35.0], rot: 0.1, scale: 1.15,
      shots: [
        { scene: 'cabinet', dur: 8.5 },
        { scene: 'flashback', dur: 8.0, line: '不是忘了，是刻意不翻。' }
      ]
    },
    {
      id: 'leaf', stage: 4, name: '干枯的银杏叶', shape: 'leaf', mood: 'truth', seed: 3105,
      tier: 'main', where: '长路起始处', pos: [-62.5, 0.10, 21.4], rot: 0.6, scale: 1.2,
      shots: [
        { scene: 'leafpile', dur: 7.5, line: '踩着好听。' },
        { scene: 'emptylot', dur: 8.0 }
      ]
    }
  ];

  /* ---------------- 五片区域的构件 ---------------- */

  function slab(x0, z0, x1, z1, mat, h) {
    // 允许参数写成"从近到远"或"从远到近"，这里统一成有序矩形
    var ax0 = Math.min(x0, x1), ax1 = Math.max(x0, x1);
    var az0 = Math.min(z0, z1), az1 = Math.max(z0, z1);
    FLOORS.push([ax0, az0, ax1, az1]);
    var m = boxMesh((ax0 + ax1) / 2, 0, (az0 + az1) / 2, ax1 - ax0, h || 0.08, az1 - az0, mat || stoneDarkMat, 0, false, false);
    m.receiveShadow = true;
    return m;
  }

  // 一块屋顶：给"室内"一个天花板，灯才有地方挂
  function roof(x0, z0, x1, z1, h, opt) {
    opt = opt || {};
    var w = x1 - x0, d = z1 - z0;
    var cx = (x0 + x1) / 2, cz = (z0 + z1) / 2;
    var th = opt.thick || 0.18;
    var m = boxMesh(cx, h, cz, w, th, d, opt.mat || tileMat, 0, false, false);
    m.receiveShadow = true; m.castShadow = true;
    // 屋顶的底面：单独一层朝下的平面，材质自带一点自发光，室内不至于顶着一块黑
    var cm = opt.ceil || ceilMat;
    var cy = h - th / 2 - 0.012;
    var cplane = new T.Mesh(new T.PlaneGeometry(w - 0.06, d - 0.06), cm);
    cplane.rotation.x = Math.PI / 2;
    cplane.position.set(cx, cy, cz);
    cplane.receiveShadow = true;
    root.add(cplane);
    // 四周一圈裙板：墙头与天花板之间的那条缝，不遮住就会漏出天光
    var sk = 0.40;
    var skirtMat = opt.mat || tileMat;
    [[cx, cz - d / 2 + 0.04, w, 0.08], [cx, cz + d / 2 - 0.04, w, 0.08],
     [cx - w / 2 + 0.04, cz, 0.08, d], [cx + w / 2 - 0.04, cz, 0.08, d]].forEach(function (q) {
      var b = new T.Mesh(new T.BoxGeometry(q[2], sk, q[3]), skirtMat);
      b.position.set(q[0], cy - sk / 2 + 0.02, q[1]);
      b.receiveShadow = true;
      root.add(b);
    });
    // 檐口压条
    boxMesh(cx, h - 0.07, z0 - 0.10, w + 0.26, 0.14, 0.2, stoneDarkMat, 0, false);
    boxMesh(cx, h - 0.07, z1 + 0.10, w + 0.26, 0.14, 0.2, stoneDarkMat, 0, false);
    // 梁
    var nb = opt.beams == null ? Math.max(2, Math.round(w / 3.4)) : opt.beams;
    for (var i = 0; i < nb; i++) {
      boxMesh(x0 + (i + 0.5) * (w / nb), h - 0.26, cz, 0.17, 0.24, d - 0.1, beamMat, 0, false);
    }
    return m;
  }

  function desk(x, z, w, d, h, ry) {
    w = w || 1.15; d = d || 0.62; h = h || 0.74;
    boxMesh(x, h - 0.05, z, w, 0.06, d, darkWoodMat, ry || 0, true, true);
    boxMesh(x - w / 2 + 0.08, 0, z - d / 2 + 0.06, 0.06, h - 0.05, 0.06, darkWoodMat, 0, false);
    boxMesh(x + w / 2 - 0.08, 0, z - d / 2 + 0.06, 0.06, h - 0.05, 0.06, darkWoodMat, 0, false);
    boxMesh(x - w / 2 + 0.08, 0, z + d / 2 - 0.06, 0.06, h - 0.05, 0.06, darkWoodMat, 0, false);
    boxMesh(x + w / 2 - 0.08, 0, z + d / 2 - 0.06, 0.06, h - 0.05, 0.06, darkWoodMat, 0, false);
  }

  function chair(x, z, ry) {
    boxMesh(x, 0.40, z, 0.44, 0.06, 0.44, darkWoodMat, ry || 0, true, true);
    boxMesh(x, 0.46, z, 0.06, 0.52, 0.06, darkWoodMat, ry || 0, false);
    boxMesh(x - 0.18, 0, z - 0.18, 0.05, 0.40, 0.05, darkWoodMat, 0, false);
    boxMesh(x + 0.18, 0, z - 0.18, 0.05, 0.40, 0.05, darkWoodMat, 0, false);
    boxMesh(x - 0.18, 0, z + 0.18, 0.05, 0.40, 0.05, darkWoodMat, 0, false);
    boxMesh(x + 0.18, 0, z + 0.18, 0.05, 0.40, 0.05, darkWoodMat, 0, false);
  }

  // 一段带窗的墙：下裙 + 窗间柱 + 上梁，中间装玻璃
  function windowWall(x1, z1, x2, z2, h, opt) {
    opt = opt || {};
    var alongX = Math.abs(x2 - x1) > Math.abs(z2 - z1);
    var len = alongX ? Math.abs(x2 - x1) : Math.abs(z2 - z1);
    var cx = (x1 + x2) / 2, cz = (z1 + z2) / 2;
    var sill = opt.sill == null ? 0.92 : opt.sill;
    var head = opt.head == null ? 2.05 : opt.head;
    var th = opt.thick || 0.18;
    var mat = opt.mat || whiteMat;

    if (alongX) boxMesh(cx, 0, cz, len, sill, th, mat, 0, true, true);
    else boxMesh(cx, 0, cz, th, sill, len, mat, 0, true, true);
    if (h > head) {
      if (alongX) boxMesh(cx, head, cz, len, h - head, th, mat, 0, true, false);
      else boxMesh(cx, head, cz, th, h - head, len, mat, 0, true, false);
    }
    var n = Math.max(1, Math.round(len / 2.3));
    for (var i = 0; i < n; i++) {
      var t0 = (i / n) * len, t1 = ((i + 0.94) / n) * len;
      var mid = (t0 + t1) / 2;
      var paneLen = t1 - t0;
      var px = alongX ? (x1 + (x2 - x1) * (mid / len)) : x1;
      var pz = alongX ? z1 : (z1 + (z2 - z1) * (mid / len));
      var glass = new T.Mesh(new T.PlaneGeometry(paneLen * 0.96, head - sill), glassMat);
      glass.position.set(px, (sill + head) / 2, pz);
      if (!alongX) glass.rotation.y = Math.PI / 2;
      root.add(glass);
      var bar = new T.Mesh(new T.BoxGeometry(alongX ? paneLen * 0.98 : 0.04, 0.04, alongX ? 0.04 : paneLen * 0.98), metalMat);
      bar.position.set(px, (sill + head) / 2, pz);
      root.add(bar);
      var mull = new T.Mesh(new T.BoxGeometry(0.05, head - sill, 0.05), metalMat);
      mull.position.set(px, (sill + head) / 2, pz);
      root.add(mull);
      var edge = alongX ? (x1 + (x2 - x1) * (t0 / len)) : (z1 + (z2 - z1) * (t0 / len));
      if (alongX) boxMesh(edge, sill, cz, 0.18, head - sill, th, mat, 0, true, false);
      else boxMesh(cx, sill, edge, th, head - sill, 0.18, mat, 0, true, false);
    }
  }

  function makeStove(x, z, ry) {
    boxMesh(x, 0, z, 2.3, 1.02, 2.6, brickMat, ry || 0, true, true);
    var wok = new T.Mesh(new T.CylinderGeometry(0.56, 0.46, 0.34, 22, 1, true), new T.MeshStandardMaterial({
      color: 0x241f1a, roughness: 0.42, metalness: 0.72, side: T.DoubleSide, envMapIntensity: 0.9
    }));
    wok.position.set(x, 1.17, z - 0.55);
    wok.castShadow = true;
    root.add(wok);
    var rim = new T.Mesh(new T.TorusGeometry(0.56, 0.045, 8, 26), metalMat);
    rim.rotation.x = Math.PI / 2;
    rim.position.set(x, 1.33, z - 0.55);
    root.add(rim);
    // 灶膛口：正面一个黑洞，里面一点暗红，比任何说明都直白
    var mouth = new T.Mesh(new T.BoxGeometry(0.84, 0.56, 0.12), new T.MeshStandardMaterial({ color: 0x120f0c, roughness: 1, metalness: 0 }));
    mouth.position.set(x, 0.40, z - 1.30);
    root.add(mouth);
    var ember = new T.Mesh(new T.PlaneGeometry(0.6, 0.26), new T.MeshBasicMaterial({ color: 0xff7328, transparent: true, opacity: 0.38 }));
    ember.position.set(x, 0.24, z - 1.368);
    ember.rotation.y = Math.PI;
    root.add(ember);
    var lid = new T.Mesh(new T.CylinderGeometry(0.6, 0.6, 0.07, 24), darkWoodMat);
    lid.position.set(x + 0.62, 1.06, z + 0.30);
    lid.rotation.set(0, 0.4, 0.02);
    lid.castShadow = true;
    root.add(lid);
    var knob = new T.Mesh(new T.CylinderGeometry(0.05, 0.06, 0.1, 10), woodMat);
    knob.position.set(x + 0.62, 1.13, z + 0.30);
    root.add(knob);
    // 蒸笼：三层，竹色有深浅，各带一道箍
    var bamA = new T.MeshStandardMaterial({ color: 0x9c8452, roughness: 0.92 });
    var bamB = new T.MeshStandardMaterial({ color: 0x8a7443, roughness: 0.94 });
    for (var i = 0; i < 3; i++) {
      var s = new T.Mesh(new T.CylinderGeometry(0.34, 0.35, 0.15, 18), i % 2 ? bamB : bamA);
      s.position.set(x - 0.70, 1.09 + i * 0.155, z + 0.86);
      s.castShadow = true;
      root.add(s);
      var hoop = new T.Mesh(new T.TorusGeometry(0.352, 0.012, 5, 20), bamB);
      hoop.rotation.x = Math.PI / 2;
      hoop.position.set(x - 0.70, 1.02 + i * 0.155, z + 0.86);
      root.add(hoop);
    }
    var bamLid = new T.Mesh(new T.CylinderGeometry(0.36, 0.335, 0.07, 18), bamB);
    bamLid.position.set(x - 0.70, 1.07 + 3 * 0.155, z + 0.86);
    bamLid.castShadow = true;
    root.add(bamLid);
    var cloth = new T.Mesh(new T.PlaneGeometry(0.34, 0.26), new T.MeshStandardMaterial({ color: 0x9e9a8d, roughness: 0.98, side: T.DoubleSide }));
    cloth.rotation.set(-Math.PI / 2 + 0.04, 0, 0.22);
    cloth.position.set(x - 0.52, 1.032, z + 0.42);
    root.add(cloth);
    for (var k = 0; k < 3; k++) addSteam(x + (k - 1) * 0.22, 1.40, z - 0.55, 1.0 + k * 0.2);
    var fire = new T.PointLight(0xff8a3c, 0.42, 5.0, 2);
    fire.position.set(x, 0.65, z - 0.4);
    root.add(fire);
  }

  function addSteam(x, y, z, sc) {
    var sp = new T.Sprite(new T.SpriteMaterial({
      map: mistTexture(), transparent: true, depthWrite: false, opacity: 0, color: 0xf6f2e6
    }));
    sp.scale.set(1.5 * sc, 1.9 * sc, 1);
    sp.position.set(x, y, z);
    sp.userData = { x: x, z: z, y0: y, ph: Math.random(), sp: 0.10 + Math.random() * 0.06, sc: sc };
    scene.add(sp);
    steams.push(sp);
  }

  function makeStall(x, z) {
    boxMesh(x, 0.72, z, 2.0, 0.07, 0.9, woodMat, 0, true, true);
    boxMesh(x - 0.8, 0, z - 0.3, 0.07, 0.72, 0.07, metalMat, 0, false);
    boxMesh(x + 0.8, 0, z - 0.3, 0.07, 0.72, 0.07, metalMat, 0, false);
    boxMesh(x - 0.8, 0, z + 0.3, 0.07, 0.72, 0.07, metalMat, 0, false);
    boxMesh(x + 0.8, 0, z + 0.3, 0.07, 0.72, 0.07, metalMat, 0, false);
    var pot = new T.Mesh(new T.CylinderGeometry(0.42, 0.34, 0.3, 18, 1, true), new T.MeshStandardMaterial({ color: 0x3a352e, roughness: 0.5, metalness: 0.7, side: T.DoubleSide }));
    pot.position.set(x + 0.5, 0.9, z);
    root.add(pot);
    var oil = new T.Mesh(new T.CircleGeometry(0.4, 20), new T.MeshStandardMaterial({ color: 0x7a5c1f, roughness: 0.25, metalness: 0.3, envMapIntensity: 1.1 }));
    oil.rotation.x = -Math.PI / 2;
    oil.position.set(x + 0.5, 1.02, z);
    root.add(oil);
    var bamA2 = new T.MeshStandardMaterial({ color: 0xa89160, roughness: 0.92 });
    var bamB2 = new T.MeshStandardMaterial({ color: 0x8d7845, roughness: 0.94 });
    for (var i = 0; i < 4; i++) {
      var s = new T.Mesh(new T.CylinderGeometry(0.44, 0.45, 0.16, 20), i % 2 ? bamB2 : bamA2);
      s.position.set(x - 0.55, 0.79 + i * 0.17, z);
      s.castShadow = true;
      root.add(s);
      var hp = new T.Mesh(new T.TorusGeometry(0.452, 0.013, 5, 22), bamB2);
      hp.rotation.x = Math.PI / 2;
      hp.position.set(x - 0.55, 0.73 + i * 0.17, z);
      root.add(hp);
    }
    var lid2 = new T.Mesh(new T.CylinderGeometry(0.465, 0.43, 0.08, 20), bamB2);
    lid2.position.set(x - 0.55, 0.79 + 4 * 0.17, z);
    lid2.castShadow = true;
    root.add(lid2);
    addSteam(x - 0.55, 1.6, z, 1.25);
    var red = new T.MeshStandardMaterial({ color: 0x9a4438, roughness: 0.72 });
    var blue = new T.MeshStandardMaterial({ color: 0x3f5f7a, roughness: 0.72 });
    [[-0.9, 0.9, red], [0.2, 1.0, blue], [1.1, 0.7, red]].forEach(function (s2) {
      boxMesh(x + s2[0], 0.30, z + s2[1], 0.34, 0.06, 0.32, s2[2], 0.2, true, true);
      boxMesh(x + s2[0], 0, z + s2[1], 0.28, 0.30, 0.26, s2[2], 0.2, false);
    });
    boxMesh(x + 2.6, 0, z + 0.4, 0.95, 0.52, 0.8, stoneMat, 0.2, true, true);
    // 石墩顶面被磨得发亮（来福趴了一辈子）
    var worn = new T.Mesh(new T.CylinderGeometry(0.34, 0.34, 0.012, 18),
      new T.MeshStandardMaterial({ color: 0xb9b3a2, roughness: 0.32, metalness: 0.04, envMapIntensity: 0.9 }));
    worn.position.set(x + 2.6, 0.527, z + 0.4);
    root.add(worn);
  }

  function makeArch(x, z, ry) {
    boxMesh(x - 1.5, 0, z, 0.9, 2.2, 1.4, stoneDarkMat, ry || 0, true, false);
    boxMesh(x + 1.5, 0, z, 0.9, 2.2, 1.4, stoneDarkMat, ry || 0, true, false);
    for (var i = 0; i < 5; i++) {
      var t = i / 4;
      var m = new T.Mesh(new T.BoxGeometry(0.62, 0.34, 1.5), stoneMat);
      m.position.set(x - 1.4 + t * 2.8, 2.32 + Math.sin(t * Math.PI) * 0.42, z);
      m.rotation.z = (t - 0.5) * 0.5;
      m.castShadow = true;
      root.add(m);
    }
    var dark = new T.Mesh(new T.PlaneGeometry(2.2, 2.0), new T.MeshBasicMaterial({ color: 0x0e0f0c }));
    dark.position.set(x, 1.05, z + 0.72);
    root.add(dark);
  }

  function makeFence(x1, z1, x2, z2, h) {
    var len = Math.max(Math.abs(x2 - x1), Math.abs(z2 - z1));
    var alongX = Math.abs(x2 - x1) > Math.abs(z2 - z1);
    var n = Math.max(1, Math.round(len / 2.0));
    for (var i = 0; i < n; i++) {
      var t = (i + 0.5) / n;
      var px = x1 + (x2 - x1) * t, pz = z1 + (z2 - z1) * t;
      var g = new T.Mesh(new T.BoxGeometry(alongX ? len / n * 0.98 : 0.08, h, alongX ? 0.08 : len / n * 0.98), blueMat);
      g.position.set(px, h / 2, pz);
      g.rotation.y = (Math.random() - 0.5) * 0.02;
      g.castShadow = true; g.receiveShadow = true;
      root.add(g);
      addCollider(px, pz, alongX ? len / n : 0.3, alongX ? 0.3 : len / n, 0, h, false);
      boxMesh(px - (alongX ? len / n / 2 : 0), 0, pz - (alongX ? 0 : len / n / 2), 0.09, h + 0.12, 0.09, metalMat, 0, false);
    }
    for (var k = 0; k < 3; k++) {
      var t2 = 0.2 + k * 0.3;
      var paper = new T.Mesh(new T.PlaneGeometry(0.62, 0.86), paperMat);
      paper.position.set(x1 + (x2 - x1) * t2, 1.28, z1 + (z2 - z1) * t2 + (alongX ? -0.06 : 0));
      if (!alongX) { paper.rotation.y = -Math.PI / 2; paper.position.x -= 0.06; }
      paper.rotation.z = (Math.random() - 0.5) * 0.08;
      root.add(paper);
    }
  }

  function makeBunk(x, z, ry) {
    var w = 1.0, d = 2.0;
    for (var i = 0; i < 2; i++) {
      var y = i === 0 ? 0.46 : 1.34;
      boxMesh(x, y, z, w, 0.07, d, darkWoodMat, ry || 0, true, true);
      var quilt = new T.Mesh(new T.BoxGeometry(w * 0.9, 0.13, d * 0.82), clothMat);
      quilt.position.set(x, y + 0.11, z + 0.08);
      root.add(quilt);
      var pil = new T.Mesh(new T.BoxGeometry(w * 0.62, 0.10, 0.34), new T.MeshStandardMaterial({ color: 0xcfc9b8, roughness: 0.94 }));
      pil.position.set(x, y + 0.12, z - d / 2 + 0.32);
      root.add(pil);
    }
    [[-w / 2 + 0.05, -d / 2 + 0.05], [w / 2 - 0.05, -d / 2 + 0.05], [-w / 2 + 0.05, d / 2 - 0.05], [w / 2 - 0.05, d / 2 - 0.05]].forEach(function (p) {
      boxMesh(x + p[0], 0, z + p[1], 0.06, 1.95, 0.06, metalMat, 0, true, false);
    });
    for (var s = 0; s < 3; s++) {
      boxMesh(x + w / 2 + 0.14, 0.28 + s * 0.3, z - 0.3, 0.34, 0.05, 0.06, metalMat, 0, false);
    }
    addCollider(x, z, w, d, 0, 1.45, true);
  }

  function makeCabinet(x, z) {
    var w = 5.2, h = 2.8, d = 2.6;
    boxMesh(x, 0, z - d / 2, w, h, 0.12, darkWoodMat, 0, true, false);
    boxMesh(x - w / 2, 0, z, 0.12, h, d, darkWoodMat, 0, true, false);
    boxMesh(x + w / 2, 0, z, 0.12, h, d, darkWoodMat, 0, true, false);
    boxMesh(x, h - 0.12, z, w, 0.12, d, darkWoodMat, 0, true, false);
    for (var i = 0; i < 2; i++) {
      boxMesh(x, 0.95 + i * 0.85, z + 0.15, w - 0.2, 0.06, 0.7, woodMat, 0, true, true);
    }
    for (var k = 0; k < 7; k++) {
      var bx = x - w / 2 + 0.7 + Math.random() * (w - 1.4);
      var bz = z - 0.4 + Math.random() * 0.9;
      var by = k < 3 ? 1.01 : 1.86;
      boxMesh(bx, by, bz, 0.4 + Math.random() * 0.3, 0.28 + Math.random() * 0.16, 0.36 + Math.random() * 0.2,
        Math.random() > 0.5 ? paperMat : woodMat, Math.random(), true, true);
    }
    var door = boxMesh(x - w / 4, 0, z + d / 2, w / 2 - 0.06, 2.6, 0.08, darkWoodMat, 0, false, false);
    door.rotation.y = -0.9;
    door.position.set(x - w / 2 - 0.4, 1.3, z + d / 2 - 0.2);
  }

  function makeWindowBand(x1, z1, x2, z2, h, mat) {
    windowWall(x1, z1, x2, z2, h, { mat: mat || whiteMat, sill: 1.35, head: 2.55, thick: 0.16 });
  }

  function makeNameStele(p) {
    var gx = p.gate.x, gz = p.gate.z;
    var dx = gx - p.gap.x, dz = gz - p.gap.z;
    var len = Math.sqrt(dx * dx + dz * dz) || 1;
    var nx = dx / len, nz = dz / len;
    var sx = gx - nx * 0.5 + nz * 2.8;
    var sz = gz - nz * 0.5 - nx * 2.8;
    var stone = boxMesh(sx, 0, sz, 1.0, 2.5, 0.3, stoneDarkMat, Math.atan2(dx, dz) + Math.PI / 2, true, false);
    stone.rotation.x = (Math.random() - 0.5) * 0.03;
    var tex = labelTexture(p.name, p.sub);
    var face = new T.Mesh(new T.PlaneGeometry(0.86, 2.1), new T.MeshBasicMaterial({
      map: tex, transparent: true, opacity: 0.9, depthWrite: false
    }));
    face.position.set(sx, 1.32, sz);
    face.rotation.y = Math.atan2(dx, dz) + Math.PI / 2;
    face.translateZ(0.17);
    root.add(face);
    var gl = new T.Sprite(new T.SpriteMaterial({
      map: glowTexture('rgba(255,244,214,1)', 'rgba(255,226,168,.28)'),
      transparent: true, blending: T.AdditiveBlending, depthWrite: false, opacity: 0.55
    }));
    gl.scale.set(3.4, 3.4, 1);
    gl.position.set(sx, 0.5, sz);
    root.add(gl);
    gateLights.push(gl);
  }

  function labelTexture(title, sub) {
    var W = 256, H = 640, c = cv(W, H), g = c.getContext('2d');
    g.clearRect(0, 0, W, H);
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    var chars = title.split('');
    var step = 96;
    var y0 = 78 + (H - 160 - (chars.length - 1) * step) / 2;
    g.font = '600 74px "Songti SC","STSong","SimSun",serif';
    chars.forEach(function (ch, i) {
      g.fillStyle = 'rgba(246,242,230,.55)';
      g.fillText(ch, W / 2 + 1.5, y0 + i * step + 1.5);
      g.fillStyle = 'rgba(26,24,20,.86)';
      g.fillText(ch, W / 2, y0 + i * step);
    });
    g.strokeStyle = 'rgba(30,28,24,.5)';
    g.lineWidth = 2;
    g.beginPath(); g.moveTo(W / 2 - 34, H - 118); g.lineTo(W / 2 + 34, H - 118); g.stroke();
    g.font = '400 20px "Songti SC","STSong","SimSun",serif';
    g.fillStyle = 'rgba(30,28,24,.6)';
    var parts = sub.split(' · ');
    parts.forEach(function (t, i) {
      g.fillText(t, W / 2, H - 96 + i * 24);
    });
    var tex = new T.CanvasTexture(c);
    tex.colorSpace = T.SRGBColorSpace;
    tex.anisotropy = 4;
    return tex;
  }

  function ginkgoTexture() {
    var S = 128, c = cv(S, S), g = c.getContext('2d');
    g.clearRect(0, 0, S, S);
    var cx = S / 2, cy = S * 0.52, r = S * 0.40;
    g.save();
    g.translate(cx, cy);
    var grad = g.createLinearGradient(0, -r, 0, r);
    grad.addColorStop(0, '#d8b25c');
    grad.addColorStop(0.55, '#c08f3e');
    grad.addColorStop(1, '#8d6329');
    g.fillStyle = grad;
    g.beginPath();
    g.moveTo(0, r * 0.85);
    g.arc(0, -r * 0.42, r, Math.PI * 0.18, Math.PI * 0.82, false);
    g.quadraticCurveTo(0, -r * 0.34, 0, r * 0.85);
    g.closePath();
    g.fill();
    g.strokeStyle = 'rgba(120,80,30,.42)';
    g.lineWidth = 1.3;
    for (var i = -3; i <= 3; i++) {
      g.beginPath();
      g.moveTo(0, r * 0.72);
      g.lineTo(i * r * 0.28, -r * 1.28);
      g.stroke();
    }
    g.globalCompositeOperation = 'destination-out';
    g.beginPath();
    g.moveTo(-S * 0.03, -S * 0.06);
    g.lineTo(0, S * 0.02);
    g.lineTo(S * 0.03, -S * 0.06);
    g.fill();
    g.restore();
    var tex = new T.CanvasTexture(c);
    tex.colorSpace = T.SRGBColorSpace;
    tex.anisotropy = 4;
    return tex;
  }

  function leafCarpet(x0, z0, x1, z1, n, y) {
    if (!ginkgoTex) ginkgoTex = ginkgoTexture();
    if (!leafMat) {
      leafMat = new T.MeshStandardMaterial({
        map: ginkgoTex, transparent: true, alphaTest: 0.42, side: T.DoubleSide,
        roughness: 0.88, metalness: 0, envMapIntensity: 0.4
      });
    }
    if (!leafCarpet._geo) leafCarpet._geo = new T.PlaneGeometry(0.24, 0.24);
    var mesh = new T.InstancedMesh(leafCarpet._geo, leafMat, n);
    var dummy = new T.Object3D();
    var col = new T.Color();
    for (var i = 0; i < n; i++) {
      dummy.position.set(x0 + Math.random() * (x1 - x0), (y || 0.026) + Math.random() * 0.012, z0 + Math.random() * (z1 - z0));
      dummy.rotation.set(-Math.PI / 2 + (Math.random() - 0.5) * 0.5, Math.random() * 6.28, 0);
      var sc = 0.7 + Math.random() * 0.85;
      dummy.scale.set(sc, sc, sc);
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
      var v = 0.72 + Math.random() * 0.5;
      col.setRGB(v, v * (0.9 + Math.random() * 0.2), v * (0.62 + Math.random() * 0.2));
      mesh.setColorAt(i, col);
    }
    mesh.castShadow = false;
    mesh.receiveShadow = true;
    scene.add(mesh);
    return mesh;
  }

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

    // 区域专用材质
    brickMat = new T.MeshStandardMaterial({
      map: sset.albedo, normalMap: sset.normal, roughnessMap: sset.rough,
      color: 0x9a7355, roughness: 0.95, metalness: 0, envMapIntensity: 0.42, vertexColors: true
    });
    brickMat.normalScale.set(1.2, 1.2);
    paperMat = new T.MeshStandardMaterial({ color: 0xd9cfb6, roughness: 0.94, metalness: 0, side: T.DoubleSide, envMapIntensity: 0.3 });
    blueMat = new T.MeshStandardMaterial({ color: 0x3f6a86, roughness: 0.52, metalness: 0.38, envMapIntensity: 0.9 });
    whiteMat = new T.MeshStandardMaterial({ color: 0xb4b2a9, roughness: 0.90, metalness: 0, envMapIntensity: 0.34 });
    // 天花板：完全背光也不会黑成一块布，靠一点自发光兜底
    ceilMat = new T.MeshStandardMaterial({
      color: 0xb0aaa0, roughness: 0.97, metalness: 0, envMapIntensity: 0.16,
      emissive: 0x2b261f, emissiveIntensity: 1.0
    });
    beamMat = new T.MeshStandardMaterial({
      color: 0x453726, roughness: 0.96, metalness: 0, envMapIntensity: 0.10,
      emissive: 0x0a0704, emissiveIntensity: 1.0
    });
    ceilDarkMat = new T.MeshStandardMaterial({
      color: 0x6f675c, roughness: 0.98, metalness: 0, envMapIntensity: 0.12,
      emissive: 0x241f19, emissiveIntensity: 1.0
    });
    tileMat = new T.MeshStandardMaterial({
      map: sset.albedo, normalMap: sset.normal, roughnessMap: sset.rough,
      color: 0x8e8f86, roughness: 0.94, metalness: 0.0, envMapIntensity: 0.26, vertexColors: true
    });
    tileMat.normalScale.set(0.8, 0.8);
    darkWoodMat = new T.MeshStandardMaterial({ color: 0x5d4a38, roughness: 0.88, metalness: 0, envMapIntensity: 0.3 });
    clothMat = new T.MeshStandardMaterial({ color: 0x8e8b7d, roughness: 0.95, metalness: 0 });
    mirrorMat = new T.MeshStandardMaterial({ color: 0xb9c2c4, roughness: 0.05, metalness: 1.0, envMapIntensity: 1.6 });
    glassMat = new T.MeshPhysicalMaterial({
      color: 0xa8b8bc, roughness: 0.10, metalness: 0, transmission: 0,
      transparent: true, opacity: 0.18, envMapIntensity: 1.6, side: T.DoubleSide, depthWrite: false
    });
    FLOORS.length = 0;

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
    groundMesh = ground;

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

    var amb = new T.AmbientLight(0xbfb8a8, 0.17);
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

    /* ---- 中央荒原：石环 + 五处缺口 + 中央石阵 ---- */
    buildHub();

    /* ---- 五片回忆区 ---- */
    buildChild();
    buildYouth();
    buildLoss();
    buildAdult();
    buildFinal();

    function buildHub() {
      // 一圈断墙围出荒原的“院子”，在五个方位留缺口
      var N = 100;
      for (var i = 0; i < N; i++) {
        var a = (i / N) * Math.PI * 2;
        var deg = a * 180 / Math.PI;
        var near = false;
        for (var p = 0; p < PLACES.length; p++) {
          var dd = Math.abs((((deg - PLACES[p].ang) % 360) + 540) % 360 - 180);
          if (dd < 9) { near = true; break; }
        }
        if (near) continue;
        if (Math.random() < 0.22) continue;
        var x = Math.sin(a) * HUB_R, z = Math.cos(a) * HUB_R;
        var h = 0.65 + Math.random() * 1.35;
        boxMesh(x, 0, z, 2.0, h, 0.85, Math.random() > 0.55 ? stoneDarkMat : stoneMat, a, true, h < 1.7);
      }

      // 每个缺口两侧立门柱，柱上一点残光
      PLACES.forEach(function (p) {
        var a = p.ang * Math.PI / 180;
        var tx = Math.cos(a), tz = -Math.sin(a);
        for (var s = -1; s <= 1; s += 2) {
          var px = Math.sin(a) * HUB_R + tx * 3.5 * s;
          var pz = Math.cos(a) * HUB_R + tz * 3.5 * s;
          boxMesh(px, 0, pz, 0.85, 2.5 + (s > 0 ? 0.35 : 0), 0.85, stoneMat, a, true, false);
          boxMesh(px, 2.45 + (s > 0 ? 0.35 : 0), pz, 1.05, 0.16, 1.05, stoneDarkMat, a, false, false);
        }
        makeNameStele(p);
      });

      // 中央石阵：八块立石 + 一方低台
      for (var k = 0; k < 8; k++) {
        var ka = (k / 8) * Math.PI * 2 + 0.2;
        var kx = Math.sin(ka) * 4.6, kz = Math.cos(ka) * 4.6;
        var sh = 1.1 + Math.random() * 1.0;
        var st = boxMesh(kx, 0, kz, 0.5, sh, 0.42, stoneMat, ka, true, true);
        st.rotation.z = (Math.random() - 0.5) * 0.16;
      }
      boxMesh(0, 0, 0, 3.2, 0.28, 3.2, stoneDarkMat, Math.PI / 8, true, true);
      boxMesh(0, 0.28, 0, 1.6, 0.34, 1.6, stoneMat, 0, true, true);
      var core = new T.Sprite(new T.SpriteMaterial({
        map: glowTexture('rgba(255,247,224,1)', 'rgba(255,228,178,.30)'),
        transparent: true, blending: T.AdditiveBlending, depthWrite: false, opacity: 0.32
      }));
      core.scale.set(9, 9, 1);
      core.position.set(0, 0.75, 0);
      scene.add(core);
      var coreLight = new T.PointLight(0xffe6bc, 0.55, 16, 2);
      coreLight.position.set(0, 2.2, 0);
      scene.add(coreLight);

      // 荒原里的旧物：亭子、水塘、树、断墙
      makeGazebo(15, -3);
      makeTree(22, -9, { h: 9.5, r: 0.4, branches: 6, depth: 4 });
      makeTree(-25, 13, { h: 7, r: 0.28, branches: 5, depth: 4 });
      makeTree(-26, -3, { h: 8, r: 0.3, branches: 5, depth: 3 });
      wall(-24, 20, -13, 20, 1.15, 0.55, { broken: true, gaps: 0.3 });
      wall(-24, 20, -24, 11, 1.05, 0.55, { broken: true, gaps: 0.35 });
      makeRubble(-19, 16, 9, 3);
      boxMesh(9, 0, 14, 1.9, 0.62, 1.6, stoneMat, 0.3, true, true);

      // 水塘
      (function () {
        var wn = groundNormalMap();
        wn.repeat.set(4, 4);
        var pmat = new T.MeshStandardMaterial({
          color: 0x66787b, roughness: 0.13, metalness: 0.55,
          normalMap: wn, envMapIntensity: 1.05
        });
        pmat.normalScale.set(0.32, 0.32);
        var pond = new T.Mesh(new T.CircleGeometry(6.2, 40), pmat);
        pond.rotation.x = -Math.PI / 2;
        pond.position.set(-15, 0.035, -8);
        pond.scale.set(1.25, 1, 1);
        scene.add(pond);
        waterMesh = pond;
        for (var i = 0; i < 18; i++) {
          var aa = Math.random() * 6.28;
          var s2 = 0.24 + Math.random() * 0.5;
          var m = new T.Mesh(paintAO(new T.DodecahedronGeometry(s2, 0), 0.55), stoneMat);
          m.position.set(-15 + Math.cos(aa) * 8.1, s2 * 0.4, -8 + Math.sin(aa) * 6.4);
          m.rotation.set(Math.random(), Math.random(), Math.random());
          m.castShadow = true;
          root.add(m);
        }
      })();

      // 缺口外的引路灯：雾里能看见的微光
      PLACES.forEach(function (p) {
        var a = p.ang * Math.PI / 180;
        for (var d2 = 7; d2 <= 20; d2 += 6.5) {
          var lx = p.gap.x + (p.gate.x - p.gap.x) * (d2 / 26);
          var lz = p.gap.z + (p.gate.z - p.gap.z) * (d2 / 26);
          lx += (Math.random() - 0.5) * 1.6;
          lz += (Math.random() - 0.5) * 1.6;
          boxMesh(lx, 0, lz, 0.16, 0.34 + Math.random() * 0.2, 0.16, stoneDarkMat, a, true, true);
        }
      });
    }

    /* ---- 区域 1：童年区（巷口早点摊 + 灶房 + 银杏院）---- */
    function buildChild() {
      // 前沿墙：中间留 6..14 的门
      wall(-26, 54, 6, 54, 2.05, 0.85, { broken: true, seg: 2.6, gaps: 0.018 });
      wall(14, 54, 26, 54, 2.05, 0.85, { broken: true, seg: 2.6, gaps: 0.018 });
      // 门柱 / 门楣 / 门槛
      boxMesh(6.4, 0, 54, 0.72, 2.42, 0.78, stoneDarkMat, 0, true, false);
      boxMesh(13.6, 0, 54, 0.72, 2.38, 0.78, stoneDarkMat, 0, true, false);
      boxMesh(10, 2.34, 54, 7.6, 0.22, 0.86, stoneMat, 0, false, false);
      boxMesh(10, 0, 54.5, 7.0, 0.10, 1.9, stoneDarkMat, 0, true, true);

      // 院墙：加高到 1.9，站在院里看不到外面那片空地
      wall(-26, 54, -26, 104, 1.92, 0.8, { broken: true, seg: 3, gaps: 0.03 });
      wall(26, 54, 26, 104, 1.92, 0.8, { broken: true, seg: 3, gaps: 0.03 });
      wall(-26, 104, 26, 104, 1.86, 0.8, { broken: true, seg: 3, gaps: 0.13 });

      // 前院与后院之间的一道院墙（留 3 米宽的过门）
      wall(-26, 68, -2, 68, 1.78, 0.55, { broken: true, seg: 2.5, gaps: 0.07 });
      wall(3.4, 68, 8, 68, 1.75, 0.55, { broken: true, seg: 2.2, gaps: 0.025 });
      boxMesh(-2.2, 0, 68, 0.5, 2.02, 0.72, stoneMat, 0, true, false);
      boxMesh(3.6, 0, 68, 0.5, 1.98, 0.72, stoneMat, 0, true, false);

      // ---- 巷口早餐摊：摊子 + 一块旧雨棚 ----
      makeStall(18, 60.5);
      (function () {
        var tp = new T.MeshStandardMaterial({ color: 0x8d8477, roughness: 0.96, metalness: 0, side: T.DoubleSide });
        [[16.7, 59.2], [19.3, 59.2], [16.7, 61.9], [19.3, 61.9]].forEach(function (q) {
          boxMesh(q[0], 0, q[1], 0.06, 2.16, 0.06, metalMat, 0, false);
        });
        var tarp = new T.Mesh(new T.BoxGeometry(3.1, 0.05, 3.0), tp);
        tarp.position.set(18, 2.18, 60.5);
        tarp.rotation.z = -0.045;
        tarp.castShadow = true;
        root.add(tarp);
        // 棚下垂着的一块旧布
        var flap = new T.Mesh(new T.PlaneGeometry(2.5, 0.5), tp);
        flap.position.set(18, 1.9, 61.98);
        flap.rotation.x = 0.06;
        root.add(flap);
      })();

      // ---- 灶房：x 8..24, z 66..84 ----
      wall(8, 66, 16.6, 66, 2.52, 0.42, { seg: 2.4, gaps: 0.018 });
      wall(20.6, 66, 24, 66, 2.52, 0.42, { seg: 2.0, gaps: 0.018 });
      wall(8, 66, 8, 84, 2.56, 0.42, { seg: 3, gaps: 0.02 });
      wall(24, 66, 24, 84, 2.52, 0.42, { seg: 3, gaps: 0.02 });
      wall(8, 84, 24, 84, 2.52, 0.42, { seg: 3, gaps: 0.025 });
      // 西墙开一扇窗，屋里才不闷
      boxMesh(8, 0, 73, 0.44, 1.0, 3.0, stoneDarkMat, 0, false, false);
      boxMesh(8, 1.92, 73, 0.44, 0.75, 3.0, stoneMat3, 0, false, false);
      // 门框
      boxMesh(16.9, 0, 66.1, 0.16, 2.2, 0.5, darkWoodMat, 0, false, false);
      boxMesh(20.3, 0, 66.1, 0.16, 2.2, 0.5, darkWoodMat, 0, false, false);
      boxMesh(18.6, 2.18, 66.1, 3.6, 0.16, 0.5, darkWoodMat, 0, false, false);
      slab(8, 66, 24, 84, tileMat, 0.05);
      roof(7.5, 65.6, 24.5, 84.4, 2.74, { beams: 4, ceil: ceilDarkMat });
      // 梁下挂的灯泡
      var bulb = new T.Mesh(new T.SphereGeometry(0.075, 10, 8), new T.MeshBasicMaterial({ color: 0xffe9bc }));
      bulb.position.set(14.4, 2.30, 74.4);
      root.add(bulb);
      var wire = new T.Mesh(new T.CylinderGeometry(0.007, 0.007, 0.30, 4), new T.MeshStandardMaterial({ color: 0x2a2620, roughness: 1 }));
      wire.position.set(14.4, 2.50, 74.4);
      root.add(wire);
      var shade = new T.Mesh(new T.ConeGeometry(0.17, 0.12, 12, 1, true), new T.MeshStandardMaterial({ color: 0x6f6a5c, roughness: 0.9, side: T.DoubleSide }));
      shade.position.set(14.4, 2.38, 74.4);
      root.add(shade);
      var bulbL = new T.PointLight(0xffce8a, 1.25, 11, 1.6);
      bulbL.position.set(14.4, 2.36, 74.4);
      root.add(bulbL);
      // 门口漏进来的日光
      var doorFill = new T.PointLight(0xc6d4dc, 0.5, 9, 1.6);
      doorFill.position.set(18.6, 1.6, 64.6);
      root.add(doorFill);
      // 灶台
      makeStove(9.7, 74.2, 0);
      // 后半间隔成柴房：一道带门的隔墙
      wall(8, 79.4, 15.2, 79.4, 2.46, 0.28, { seg: 2.4, gaps: 0.02 });
      wall(19.2, 79.4, 24, 79.4, 2.46, 0.28, { seg: 2.4, gaps: 0.02 });
      boxMesh(15.2, 0, 79.4, 0.3, 2.2, 0.34, darkWoodMat, 0, false, false);
      boxMesh(19.2, 0, 79.4, 0.3, 2.2, 0.34, darkWoodMat, 0, false, false);
      boxMesh(17.2, 2.12, 79.4, 4.4, 0.32, 0.34, darkWoodMat, 0, false, false);
      // 柴房里靠墙的柴垛
      for (var w = 0; w < 26; w++) {
        var wd = new T.Mesh(new T.CylinderGeometry(0.085, 0.095, 0.95 + Math.random() * 0.4, 6), woodMat);
        wd.position.set(9.4 + (w % 7) * 0.21, 0.10 + Math.floor(w / 7) * 0.165, 81.4 + Math.random() * 0.3);
        wd.rotation.x = Math.PI / 2;
        wd.rotation.z = (Math.random() - 0.5) * 0.25;
        wd.castShadow = true;
        root.add(wd);
      }
      // 柴房门口的一口缸
      var bigJar = new T.Mesh(new T.CylinderGeometry(0.44, 0.36, 0.86, 16, 1, true), new T.MeshStandardMaterial({ color: 0x53463a, roughness: 0.78, side: T.DoubleSide }));
      bigJar.position.set(20.9, 0.43, 80.6);
      bigJar.castShadow = true;
      root.add(bigJar);
      // 案板与碗
      boxMesh(19.6, 0, 76.4, 2.2, 0.8, 1.0, woodMat, 0, true, true);
      for (var bw = 0; bw < 3; bw++) {
        var b2 = new T.Mesh(new T.CylinderGeometry(0.13, 0.09, 0.09, 14, 1, true), ceramicMat);
        b2.position.set(19.0 + bw * 0.34, 0.84, 76.2 + (bw % 2) * 0.3);
        root.add(b2);
      }
      // 竹菜筐
      var basket = new T.Mesh(new T.CylinderGeometry(0.38, 0.3, 0.32, 14, 1, true), new T.MeshStandardMaterial({ color: 0xa8905f, roughness: 0.92, side: T.DoubleSide }));
      basket.position.set(15.6, 0.16, 70.6);
      root.add(basket);

      // ---- 银杏院：老银杏 + 落叶 + 一圈矮砖 ----
      makeTree(-9, 92, { h: 13, r: 0.62, branches: 7, depth: 4 });
      leafCarpet(-16, 84, -2, 100, 2600);
      wall(-18, 82, -18, 100, 0.48, 0.34, { broken: true, seg: 2.2, gaps: 0.06, noCollide: false });
      wall(-18, 100, 0, 100, 0.46, 0.34, { broken: true, seg: 2.2, gaps: 0.02 });
      wall(0, 100, 0, 84, 0.46, 0.34, { broken: true, seg: 2.2, gaps: 0.02 });
      wall(-1.6, 82, -7, 82, 0.44, 0.34, { broken: true, seg: 2.0, gaps: 0.018 });
      makeTree(-21, 74, { h: 7.5, r: 0.3, branches: 5, depth: 3 });

      // 井
      (function () {
        var ring = new T.Mesh(new T.CylinderGeometry(1.0, 1.04, 0.64, 18, 1, true), stoneMat);
        ring.position.set(-22, 0.32, 78);
        ring.castShadow = true; ring.receiveShadow = true;
        root.add(ring);
        var water = new T.Mesh(new T.CircleGeometry(0.94, 18), new T.MeshStandardMaterial({ color: 0x2c3330, roughness: 0.08, metalness: 0.4, envMapIntensity: 0.9 }));
        water.rotation.x = -Math.PI / 2;
        water.position.set(-22, 0.42, 78);
        root.add(water);
        addCollider(-22, 78, 2.1, 2.1, 0, 0.64, true);
        boxMesh(-22.9, 0, 78, 0.14, 2.0, 0.14, woodMat, 0, false);
        boxMesh(-21.1, 0, 78, 0.14, 2.0, 0.14, woodMat, 0, false);
        boxMesh(-22, 1.96, 78, 2.0, 0.12, 0.14, woodMat, 0, false);
        // 木桶
        var bucket = new T.Mesh(new T.CylinderGeometry(0.24, 0.2, 0.3, 12), woodMat);
        bucket.position.set(-20.6, 0.15, 76.9);
        root.add(bucket);
      })();

      // 晾衣绳
      (function () {
        boxMesh(-3.4, 0, 76, 0.1, 2.1, 0.1, woodMat, 0, false);
        boxMesh(-3.4, 0, 84.5, 0.1, 2.05, 0.1, woodMat, 0, false);
        var line = new T.Mesh(new T.CylinderGeometry(0.012, 0.012, 8.6, 4), new T.MeshStandardMaterial({ color: 0x8a8478, roughness: 1 }));
        line.position.set(-3.4, 2.02, 80.25);
        line.rotation.x = Math.PI / 2;
        root.add(line);
        var clothMat2 = new T.MeshStandardMaterial({ color: 0xc3bdae, roughness: 0.97, side: T.DoubleSide });
        var clothMat3 = new T.MeshStandardMaterial({ color: 0x8f9a92, roughness: 0.97, side: T.DoubleSide });
        [[77.4, 0.9, clothMat2], [79.6, 0.7, clothMat3], [81.9, 1.0, clothMat2]].forEach(function (c3, i3) {
          var cl = new T.Mesh(new T.PlaneGeometry(0.78, c3[1]), c3[2]);
          cl.position.set(-3.4, 2.0 - c3[1] / 2, c3[0]);
          cl.rotation.y = Math.PI / 2;
          cl.rotation.z = (Math.random() - 0.5) * 0.05;
          root.add(cl);
        });
      })();

      // 水缸两口
      [[5.4, 70.4], [4.6, 69.4]].forEach(function (j) {
        var jar = new T.Mesh(new T.CylinderGeometry(0.34, 0.28, 0.62, 14, 1, true), new T.MeshStandardMaterial({ color: 0x4a4038, roughness: 0.72, metalness: 0.1, side: T.DoubleSide }));
        jar.position.set(j[0], 0.31, j[1]);
        jar.castShadow = true;
        root.add(jar);
        var lid = new T.Mesh(new T.CylinderGeometry(0.35, 0.35, 0.05, 14), woodMat);
        lid.position.set(j[0], 0.64, j[1]);
        root.add(lid);
      });

      // 门槛边的板凳与菜筐
      boxMesh(-4.4, 0.2, 90.5, 0.62, 0.06, 0.42, woodMat, 0.4, true, true);
      boxMesh(-4.4, 0, 90.5, 0.36, 0.2, 0.30, woodMat, 0.4, false);
      boxMesh(-5.2, 0.2, 84, 1.7, 0.08, 0.42, woodMat, 0.06, true, true);
      boxMesh(-5.9, 0, 84, 0.1, 0.2, 0.34, woodMat, 0, false);
      boxMesh(-4.5, 0, 84, 0.1, 0.2, 0.34, woodMat, 0, false);
      var basket2 = new T.Mesh(new T.CylinderGeometry(0.34, 0.27, 0.28, 12, 1, true), new T.MeshStandardMaterial({ color: 0x9c8452, roughness: 0.92, side: T.DoubleSide }));
      basket2.position.set(-3.6, 0.14, 89.6);
      root.add(basket2);

      // 桥洞（巷子西头的旧涵洞）
      makeArch(-21.6, 56.2, 0);
      leafCarpet(-25, 56, -18, 62, 140, 0.03);

      // ---- 西边这片空地：柴棚 + 菜畦 + 石桌，别让前院空成一片草地 ----
      (function () {
        // 柴棚：四根柱子 + 一块石棉瓦顶
        var px0 = -15.6, pz0 = 60.4, px1 = -11.4, pz1 = 64.2;
        [[px0, pz0], [px1, pz0], [px0, pz1], [px1, pz1]].forEach(function (q) {
          boxMesh(q[0], 0, q[1], 0.12, 2.16, 0.12, woodMat, 0, false);
        });
        var shed = new T.Mesh(new T.BoxGeometry(px1 - px0 + 0.5, 0.10, pz1 - pz0 + 0.5),
          new T.MeshStandardMaterial({ color: 0x6b6559, roughness: 0.97, metalness: 0.02 }));
        shed.position.set((px0 + px1) / 2, 2.20, (pz0 + pz1) / 2);
        shed.rotation.z = -0.03;
        shed.castShadow = true;
        root.add(shed);
        // 棚下码着的柴
        for (var w2 = 0; w2 < 22; w2++) {
          var lg = new T.Mesh(new T.CylinderGeometry(0.075, 0.085, 1.15, 6), woodMat);
          lg.position.set(-15.1 + (w2 % 6) * 0.19, 0.09 + Math.floor(w2 / 6) * 0.15, 61.9 + Math.random() * 0.4);
          lg.rotation.x = Math.PI / 2;
          lg.rotation.z = (Math.random() - 0.5) * 0.2;
          lg.castShadow = true;
          root.add(lg);
        }
        // 柴棚边的破陶罐
        var jug = new T.Mesh(new T.CylinderGeometry(0.22, 0.16, 0.46, 12, 1, true), new T.MeshStandardMaterial({ color: 0x5d5145, roughness: 0.8, side: T.DoubleSide }));
        jug.position.set(-10.6, 0.23, 63.4);
        jug.castShadow = true;
        root.add(jug);

        // 菜畦：三条土垄，垄上零星的菜苗
        var soilMat = new T.MeshStandardMaterial({ color: 0x453a2c, roughness: 1, metalness: 0 });
        for (var r2 = 0; r2 < 3; r2++) {
          var rz = 57.6 + r2 * 2.6;
          var ridge = new T.Mesh(new T.BoxGeometry(6.4, 0.14, 1.15), soilMat);
          ridge.position.set(-5.4, 0.07, rz);
          ridge.receiveShadow = true;
          root.add(ridge);
          var leafMat = new T.MeshStandardMaterial({ color: 0x5c6b34, roughness: 0.92 });
          for (var p3 = 0; p3 < 22; p3++) {
            var tuft = new T.Mesh(new T.ConeGeometry(0.045 + Math.random() * 0.02, 0.09 + Math.random() * 0.06, 4), leafMat);
            tuft.position.set(-8.4 + p3 * 0.28 + Math.random() * 0.14, 0.15, rz + (Math.random() - 0.5) * 0.8);
            tuft.rotation.z = (Math.random() - 0.5) * 0.4;
            root.add(tuft);
          }
        }
        // 竹篱笆
        for (var f3 = 0; f3 < 9; f3++) {
          var pst = new T.Mesh(new T.CylinderGeometry(0.028, 0.032, 0.78, 5), new T.MeshStandardMaterial({ color: 0x94834f, roughness: 0.95 }));
          pst.position.set(-8.9 + f3 * 0.5, 0.39, 66.6);
          root.add(pst);
        }
        boxMesh(-5.9, 0.56, 66.6, 4.4, 0.035, 0.035, new T.MeshStandardMaterial({ color: 0x8b7a48, roughness: 0.95 }), 0, false);

        // 石桌两只石凳
        boxMesh(-19.2, 0, 65.4, 1.0, 0.12, 0.8, stoneMat, 0.3, true, true);
        boxMesh(-19.2, 0, 65.4, 0.28, 0.66, 0.28, stoneDarkMat, 0, false);
        boxMesh(-18.0, 0.42, 66.3, 0.42, 0.1, 0.42, stoneDarkMat, 0.2, true, false);
        boxMesh(-20.4, 0.42, 64.6, 0.42, 0.1, 0.42, stoneDarkMat, -0.3, true, false);
      })();
    }

    /* ---- 区域 2：少年区（小学办公室 + 初中岔路口 + 高中走廊）---- */
    function buildYouth() {
      // 围墙
      wall(50, 0, 50, 21, 1.95, 0.8, { broken: true, seg: 3, gaps: 0.03 });
      wall(50, 27, 50, 48, 1.92, 0.8, { broken: true, seg: 3, gaps: 0.03 });
      wall(50, 0, 98, 0, 1.85, 0.8, { broken: true, seg: 3, gaps: 0.03 });
      wall(98, 0, 98, 48, 1.9, 0.8, { broken: true, seg: 3, gaps: 0.03 });
      wall(50, 48, 98, 48, 1.88, 0.8, { broken: true, seg: 3, gaps: 0.035 });

      // 小学：一层教学楼，走廊 + 办公室
      windowWall(54, 40, 71, 40, 3.1, { mat: whiteMat, sill: 0.9, head: 2.3 });
      windowWall(89, 40, 96, 40, 3.1, { mat: whiteMat, sill: 0.9, head: 2.3 });
      wall(54, 44.2, 96, 44.2, 3.18, 0.4, { seg: 3.4, gaps: 0.018 });
      // 办公室
      wall(71, 40, 71, 48, 2.94, 0.35, { seg: 2.4, gaps: 0.018 });
      wall(89, 40, 89, 48, 2.94, 0.35, { seg: 2.4, gaps: 0.018 });
      slab(71, 40, 89, 48, tileMat, 0.05);
      // 窗台 + 一摞作业本（高处碎片）
      boxMesh(75, 0, 41.2, 2.5, 1.15, 0.62, whiteMat, 0, true, true);
      boxMesh(75, 1.15, 41.2, 0.5, 0.34, 0.44, paperMat, 0.05, true, true);
      boxMesh(75, 1.15, 41.2, 0.46, 0.28, 0.4, paperMat, 0.22, true, true);
      // 办公桌
      desk(78.2, 44.4, 2.0, 0.9, 0.76);
      chair(78.2, 45.6);
      roof(70.4, 39.6, 89.6, 48.4, 3.22, { beams: 5 });
      var officeL = new T.PointLight(0xffe0b4, 0.9, 9, 1.8);
      officeL.position.set(78.5, 2.55, 44.2);
      root.add(officeL);
      // 走廊柱子
      for (var c = 0; c < 5; c++) {
        boxMesh(56 + c * 3.4, 0, 36.6, 0.32, 3.0, 0.32, whiteMat, 0, true, false);
      }
      // 走廊地面
      slab(54, 36, 96, 44, tileMat, 0.06);
      roof(53.4, 35.4, 96.6, 44.6, 3.24, { beams: 11 });
      for (var tl2 = 0; tl2 < 4; tl2++) {
        var tube2 = new T.Mesh(new T.BoxGeometry(1.5, 0.06, 0.14), new T.MeshStandardMaterial({ color: 0xf4f2e6, emissive: 0xdfe2cf, emissiveIntensity: 1.2, roughness: 0.6 }));
        tube2.position.set(58 + tl2 * 9, 2.96, 40);
        root.add(tube2);
      }

      // 初中：教室 + 课桌
      wall(54, 20, 76, 20, 2.58, 0.35, { seg: 3, gaps: 0.018 });
      wall(54, 20, 54, 22.4, 2.58, 0.35, { seg: 2.4, gaps: 0.02 });
      wall(54, 27.6, 54, 36, 2.58, 0.35, { seg: 2.4, gaps: 0.02 });
      boxMesh(54, 2.3, 25, 0.42, 0.4, 5.2, stoneDarkMat, 0, false, false);
      wall(54, 36, 66, 36, 2.54, 0.35, { seg: 3, gaps: 0.025 });
      wall(66, 36, 76, 36, 2.54, 0.35, { seg: 3, gaps: 0.03 });
      slab(54, 20, 76, 36, stoneDarkMat, 0.05);
      for (var r = 0; r < 4; r++) {
        for (var cc = 0; cc < 2; cc++) {
          desk(58.5 + cc * 3.2, 23.5 + r * 3.0, 1.05, 0.55, 0.72);
        }
      }
      roof(53.5, 19.6, 76.5, 36.4, 2.74, { beams: 7 });
      var classL = new T.PointLight(0xdfe8ea, 0.85, 11, 1.8);
      classL.position.set(64, 2.3, 28);
      root.add(classL);
      // 黑板
      var board = new T.Mesh(new T.PlaneGeometry(5.4, 1.5), new T.MeshStandardMaterial({ color: 0x2b3730, roughness: 0.92 }));
      board.position.set(63, 1.72, 20.2);
      root.add(board);

      // 岔路口：电线杆 + 残破广告
      var pole = new T.Mesh(new T.CylinderGeometry(0.16, 0.22, 7.4, 8), new T.MeshStandardMaterial({ color: 0x6f6a60, roughness: 0.92 }));
      pole.position.set(86, 3.7, 26);
      pole.castShadow = true;
      root.add(pole);
      addCollider(86, 26, 0.5, 0.5, 0, 7.4, false);
      for (var ad = 0; ad < 4; ad++) {
        var pp = new T.Mesh(new T.PlaneGeometry(0.5, 0.66), paperMat);
        pp.position.set(86 + Math.cos(ad * 1.7) * 0.23, 1.5 + ad * 0.42, 26 + Math.sin(ad * 1.7) * 0.23);
        pp.rotation.y = ad * 1.7;
        root.add(pp);
      }
      // 岔路的两条土路（用碎石与矮草示意）
      makeRubble(88, 20, 7, 2.4);
      makeRubble(92, 32, 6, 2.2);
      makeTree(94, 38, { h: 8, r: 0.3, branches: 5, depth: 3 });

      // 高中：长走廊，一排落地窗
      makeWindowBand(54, 2, 96, 2, 3.2, whiteMat);
      makeWindowBand(54, 12, 96, 12, 2.9, whiteMat);
      slab(54, 2, 96, 12, tileMat, 0.05);
      roof(53.4, 1.4, 96.6, 12.6, 3.32, { beams: 11 });
      for (var tl3 = 0; tl3 < 4; tl3++) {
        var tube3 = new T.Mesh(new T.BoxGeometry(1.6, 0.06, 0.14), new T.MeshStandardMaterial({ color: 0xf4f2e6, emissive: 0xd6dccb, emissiveIntensity: 1.1, roughness: 0.6 }));
        tube3.position.set(58 + tl3 * 9.4, 3.18, 7);
        root.add(tube3);
      }
      for (var cc2 = 0; cc2 < 6; cc2++) {
        boxMesh(56 + cc2 * 7.4, 0, 7, 0.34, 3.0, 0.34, whiteMat, 0, true, false);
      }
      // 走廊尽头的大树（窗外）
      makeTree(99, 7, { h: 10, r: 0.5, branches: 6, depth: 4 });
      // 地上散落的试卷
      for (var ex = 0; ex < 8; ex++) {
        var paper = new T.Mesh(new T.PlaneGeometry(0.32, 0.24), paperMat);
        paper.rotation.x = -Math.PI / 2;
        paper.rotation.z = Math.random() * 3;
        paper.position.set(56 + Math.random() * 36, 0.07, 3 + Math.random() * 8);
        root.add(paper);
      }
    }

    /* ---- 区域 3：亲情与失去区（旧家饭桌 + 医院 + 宿舍 + 巷口）---- */
    function buildLoss() {
      wall(22, -40, 38, -40, 1.95, 0.8, { broken: true, seg: 3, gaps: 0.025 });
      wall(44, -40, 70, -40, 1.95, 0.8, { broken: true, seg: 3, gaps: 0.025 });
      wall(22, -40, 22, -88, 1.9, 0.8, { broken: true, seg: 3, gaps: 0.03 });
      wall(70, -40, 70, -88, 1.92, 0.8, { broken: true, seg: 3, gaps: 0.03 });
      wall(22, -88, 70, -88, 1.88, 0.8, { broken: true, seg: 3, gaps: 0.035 });
      boxMesh(40, 0, -40.6, 7.0, 0.12, 2.0, stoneDarkMat, 0, true, true);

      // 旧家：饭桌
      boxMesh(31, 0, -49.5, 1.9, 0.76, 1.1, darkWoodMat, 0, true, true);
      chair(29.4, -49.5);
      chair(32.6, -49.5);
      chair(31, -50.6);
      chair(31, -48.4);
      // 两只碗 + 一盘菜
      [[30.1, -49.5], [32.0, -49.5]].forEach(function (b) {
        var bowl = new T.Mesh(new T.CylinderGeometry(0.13, 0.09, 0.08, 14, 1, true), ceramicMat);
        bowl.position.set(b[0], 0.80, b[1]);
        root.add(bowl);
      });
      var dish = new T.Mesh(new T.CylinderGeometry(0.19, 0.17, 0.04, 16), ceramicMat);
      dish.position.set(31, 0.79, -49.8);
      root.add(dish);
      // 屋墙一角
      wall(25, -55, 36, -55, 2.32, 0.4, { seg: 3, gaps: 0.03 });
      wall(25, -55, 25, -45, 2.28, 0.4, { seg: 3, gaps: 0.03 });
      wall(24.6, -44.6, 37.4, -44.6, 2.28, 0.4, { seg: 3, gaps: 0.03 });
      wall(36, -55, 36, -45, 2.3, 0.4, { seg: 3, gaps: 0.04 });
      roof(24.4, -55.4, 37.6, -44.4, 2.46, { beams: 4 });
      var homeL = new T.PointLight(0xffd39a, 0.95, 8, 1.8);
      homeL.position.set(30.6, 2.2, -49.6);
      root.add(homeL);

      // 医院长廊
      slab(46, -52, 60, -78, tileMat, 0.05);
      wall(46, -52, 46, -78, 2.8, 0.34, { seg: 3, gaps: 0.03 });
      wall(60, -52, 60, -78, 2.8, 0.34, { seg: 3, gaps: 0.03 });
      // 病房门（在墙上留口，用门框示意）
      for (var d3 = 0; d3 < 3; d3++) {
        var dz = -56 - d3 * 7;
        boxMesh(46, 0, dz, 0.12, 2.1, 1.1, whiteMat, 0, false, false);
        var gl = new T.Mesh(new T.PlaneGeometry(0.4, 0.5), new T.MeshStandardMaterial({ color: 0x9fb0a8, transparent: true, opacity: 0.35, roughness: 0.2 }));
        gl.position.set(46.02, 1.6, dz);
        gl.rotation.y = Math.PI / 2;
        root.add(gl);
      }
      roof(45.6, -78.2, 60.4, -51.8, 2.96, { beams: 5 });
      var hallL = new T.PointLight(0xdde6e2, 0.85, 14, 1.6);
      hallL.position.set(53, 2.5, -64);
      root.add(hallL);
      // 走廊尽头：一段带窗洞的端墙
      wall(46, -78, 51.4, -78, 2.8, 0.34, { seg: 2.6, gaps: 0.02 });
      wall(55.6, -78, 60, -78, 2.8, 0.34, { seg: 2.6, gaps: 0.02 });
      boxMesh(53.5, 2.2, -78, 4.4, 0.6, 0.34, whiteMat, 0, false, false);
      boxMesh(51.4, 0, -78, 0.3, 2.2, 0.4, whiteMat, 0, false, false);
      boxMesh(55.6, 0, -78, 0.3, 2.2, 0.4, whiteMat, 0, false, false);
      // 顶灯
      for (var lt = 0; lt < 4; lt++) {
        var tube = new T.Mesh(new T.BoxGeometry(1.7, 0.06, 0.16), new T.MeshStandardMaterial({ color: 0xf2f2e8, emissive: 0xd8dcc8, emissiveIntensity: 1.6, roughness: 0.6 }));
        tube.position.set(53, 2.62, -55 - lt * 6.4);
        root.add(tube);
      }
      // 病房：床 + 床头柜 + 搪瓷碗
      boxMesh(56.4, 0, -70, 1.1, 0.44, 2.1, whiteMat, 0, true, true);
      // 床头挡板 / 床尾挡板
      boxMesh(56.4, 0.44, -71.02, 1.14, 0.52, 0.08, whiteMat, 0, true, false);
      boxMesh(56.4, 0.44, -68.98, 1.14, 0.30, 0.08, whiteMat, 0, true, false);
      var quilt2 = new T.Mesh(new T.BoxGeometry(1.02, 0.14, 1.42), new T.MeshStandardMaterial({ color: 0xc3c7cd, roughness: 0.96 }));
      quilt2.position.set(56.4, 0.54, -69.78);
      root.add(quilt2);
      // 叠好的被子一角
      var fold2 = new T.Mesh(new T.BoxGeometry(1.02, 0.1, 0.34), new T.MeshStandardMaterial({ color: 0xd3d6da, roughness: 0.96 }));
      fold2.position.set(56.4, 0.60, -69.08);
      root.add(fold2);
      var pil2 = new T.Mesh(new T.BoxGeometry(0.66, 0.11, 0.36), new T.MeshStandardMaterial({ color: 0xe4e4dd, roughness: 0.95 }));
      pil2.position.set(56.4, 0.53, -70.62);
      root.add(pil2);
      boxMesh(58.6, 0, -70, 0.6, 0.72, 0.6, whiteMat, 0, true, true);
      var bowl2 = new T.Mesh(new T.CylinderGeometry(0.15, 0.10, 0.1, 14, 1, true), ceramicMat);
      bowl2.position.set(58.6, 0.78, -70);
      root.add(bowl2);
      // 输液架
      boxMesh(55.2, 0, -71.4, 0.05, 1.9, 0.05, metalMat, 0, true, false);
      boxMesh(55.2, 1.9, -71.4, 0.5, 0.04, 0.04, metalMat, 0, false);

      // 大学宿舍
      wall(24, -72, 33.2, -72, 2.42, 0.32, { seg: 2.6, gaps: 0.02 });
      wall(35.4, -72, 40, -72, 2.42, 0.32, { seg: 2.6, gaps: 0.02 });
      boxMesh(33.2, 2.14, -72, 0.24, 2.2, 0.36, stoneDarkMat, 0, false, false);
      boxMesh(35.4, 2.14, -72, 0.24, 2.2, 0.36, stoneDarkMat, 0, false, false);
      boxMesh(34.3, 2.14, -72, 2.6, 0.3, 0.36, stoneDarkMat, 0, false, false);
      wall(24, -72, 24, -86, 2.42, 0.32, { seg: 3, gaps: 0.02 });
      wall(40, -72, 40, -86, 2.42, 0.32, { seg: 3, gaps: 0.02 });
      wall(24, -86, 40, -86, 2.38, 0.32, { seg: 3, gaps: 0.02 });
      slab(24, -72, 40, -86, stoneDarkMat, 0.05);
      roof(23.6, -86.4, 40.4, -71.6, 2.56, { beams: 5 });
      makeBunk(27.5, -78, 0);
      makeBunk(36, -78, 0);
      desk(31.6, -84, 1.5, 0.7, 0.75);
      // 桌上的搪瓷杯
      var cup = new T.Mesh(new T.CylinderGeometry(0.09, 0.08, 0.15, 14, 1, true), ceramicMat);
      cup.position.set(32.2, 0.82, -84);
      root.add(cup);
      // 台灯
      boxMesh(30.6, 0.75, -84.2, 0.16, 0.3, 0.16, metalMat, 0, false);
      var lampL = new T.PointLight(0xffd9a4, 0.5, 6, 2);
      lampL.position.set(30.6, 1.05, -84.2);
      root.add(lampL);

      // 巷口：地垫 + 狗盆 + 石墩
      var mat2 = new T.Mesh(new T.PlaneGeometry(1.5, 1.0), new T.MeshStandardMaterial({ color: 0x6b5a48, roughness: 1 }));
      mat2.rotation.x = -Math.PI / 2;
      mat2.position.set(64, 0.03, -80.5);
      root.add(mat2);
      var dish2 = new T.Mesh(new T.CylinderGeometry(0.24, 0.19, 0.1, 14, 1, true), metalMat);
      dish2.position.set(65.2, 0.06, -79.4);
      root.add(dish2);
      boxMesh(63.2, 0, -78.2, 0.9, 0.5, 0.8, stoneMat, 0.3, true, true);
      // 草丛
      for (var gs = 0; gs < 14; gs++) {
        makeRubble(67 + Math.random() * 2, -81 - Math.random() * 3, 1, 0.5);
      }
      makeTree(66, -85, { h: 7, r: 0.28, branches: 4, depth: 3 });
    }

    /* ---- 区域 4：成年疏离区（餐厅 + 拆迁围挡 + 浴室）---- */
    function buildAdult() {
      wall(-70, -40, -58, -40, 1.95, 0.8, { broken: true, seg: 3, gaps: 0.025 });
      wall(-46, -40, -22, -40, 1.95, 0.8, { broken: true, seg: 3, gaps: 0.025 });
      wall(-70, -40, -70, -88, 1.9, 0.8, { broken: true, seg: 3, gaps: 0.03 });
      wall(-22, -40, -22, -88, 1.92, 0.8, { broken: true, seg: 3, gaps: 0.03 });
      wall(-70, -88, -22, -88, 1.88, 0.8, { broken: true, seg: 3, gaps: 0.035 });
      boxMesh(-52, 0, -40.6, 7.0, 0.12, 2.0, stoneDarkMat, 0, true, true);

      // 城市餐厅
      slab(-46, -44, -30, -58, stoneDarkMat, 0.05);
      wall(-46, -44, -30, -44, 2.62, 0.32, { seg: 3, gaps: 0.02 });
      makeWindowBand(-46, -58, -30, -58, 3.0, whiteMat);
      wall(-46, -44, -46, -58, 2.62, 0.32, { seg: 3, gaps: 0.03 });
      boxMesh(-38, 0, -50, 1.8, 0.75, 1.0, darkWoodMat, 0, true, true);
      chair(-39.1, -50);
      chair(-36.9, -50);
      // 餐盘 + 小票
      var plate = new T.Mesh(new T.CylinderGeometry(0.2, 0.18, 0.03, 16), ceramicMat);
      plate.position.set(-38.4, 0.78, -50);
      root.add(plate);
      var ticket = new T.Mesh(new T.PlaneGeometry(0.14, 0.24), paperMat);
      ticket.rotation.x = -Math.PI / 2;
      ticket.rotation.z = 0.4;
      ticket.position.set(-37.4, 0.785, -49.7);
      root.add(ticket);
      roof(-46.4, -58.4, -29.6, -43.6, 3.14, { beams: 5 });
      // 吊灯（微弱暖黄）
      var lampP = new T.PointLight(0xffca86, 0.55, 8, 2);
      lampP.position.set(-38, 2.3, -51);
      root.add(lampP);
      boxMesh(-38, 2.55, -51, 0.06, 0.3, 0.06, metalMat, 0, false);

      // 拆迁围挡：中间留一道缝，露出断根
      makeFence(-70, -70, -61, -70, 2.7);
      makeFence(-57, -70, -48, -70, 2.7);
      // 断掉的老银杏根
      (function () {
        var rootMat = new T.MeshStandardMaterial({ color: 0xd8cdb4, roughness: 0.86, metalness: 0 });
        for (var r2 = 0; r2 < 5; r2++) {
          var rl = 0.7 + Math.random() * 1.1;
          var r3 = new T.Mesh(new T.CylinderGeometry(0.10 + Math.random() * 0.1, 0.16, rl, 6), rootMat);
          r3.position.set(-59.5 + (Math.random() - 0.5) * 1.2, 0.3 + Math.random() * 0.3, -70 + (Math.random() - 0.5) * 0.5);
          r3.rotation.set(Math.PI / 2 + (Math.random() - 0.5) * 0.7, Math.random() * 3, (Math.random() - 0.5) * 0.6);
          r3.castShadow = true;
          root.add(r3);
        }
      })();
      // 碎砖
      makeRubble(-60.5, -69, 12, 2.2);
      makeRubble(-58.4, -71.4, 10, 2.0);

      // 出租屋浴室
      // 6×6 的小卫生间，北墙留一扇门
      wall(-31, -79, -28.6, -79, 2.4, 0.28, { seg: 2.4, gaps: 0.02 });
      wall(-27.0, -79, -24.8, -79, 2.4, 0.28, { seg: 2.4, gaps: 0.02 });
      boxMesh(-28.6, 2.16, -79, 0.22, 2.24, 0.32, whiteMat, 0, false, false);
      boxMesh(-27.0, 2.16, -79, 0.22, 2.24, 0.32, whiteMat, 0, false, false);
      boxMesh(-27.8, 2.16, -79, 1.8, 0.28, 0.32, whiteMat, 0, false, false);
      wall(-31, -79, -31, -85, 2.4, 0.28, { seg: 2.6, gaps: 0.02 });
      wall(-24.8, -79, -24.8, -85, 2.4, 0.28, { seg: 2.6, gaps: 0.02 });
      wall(-31, -85, -24.8, -85, 2.4, 0.28, { seg: 2.6, gaps: 0.02 });
      slab(-31, -79, -24.8, -85, tileMat, 0.05);
      // 洗手台贴着东墙
      boxMesh(-25.35, 0, -82.0, 0.5, 0.80, 1.7, whiteMat, 0, true, true);
      var basin = new T.Mesh(new T.CylinderGeometry(0.26, 0.20, 0.16, 16, 1, true), ceramicMat);
      basin.position.set(-25.35, 0.86, -82.0);
      root.add(basin);
      boxMesh(-25.12, 0.82, -82.0, 0.05, 0.22, 0.05, metalMat, 0, false, false);
      // 镜子
      var mirror = new T.Mesh(new T.PlaneGeometry(1.1, 1.0), mirrorMat);
      mirror.position.set(-25.06, 1.62, -82.0);
      mirror.rotation.y = -Math.PI / 2;
      root.add(mirror);
      // 淋浴
      boxMesh(-30.5, 0, -84.2, 0.06, 2.1, 0.06, metalMat, 0, true, false);
      var head = new T.Mesh(new T.CylinderGeometry(0.16, 0.12, 0.05, 12), metalMat);
      head.position.set(-29.9, 2.05, -84.2);
      head.rotation.z = 0.5;
      root.add(head);
      // 地漏
      var drain = new T.Mesh(new T.CircleGeometry(0.12, 12), new T.MeshStandardMaterial({ color: 0x6a6a66, roughness: 0.5, metalness: 0.6 }));
      drain.rotation.x = -Math.PI / 2;
      drain.position.set(-29.8, 0.056, -83.6);
      root.add(drain);
      roof(-31.4, -85.4, -24.4, -78.6, 2.58, { beams: 3 });
      // 顶光（镜前灯）
      var bathL = new T.PointLight(0xd8e4e6, 0.6, 6, 2);
      bathL.position.set(-26.4, 2.2, -82.0);
      root.add(bathL);

      // 远处不摆高楼：雾密度这么高，任何 60 米外的东西都只剩一块白斑，
      // 城市感交给围挡、招牌和筒灯去说。

    }

    /* ---- 区域 5：终章区（柜子深处 + 长路）---- */
    function buildFinal() {
      wall(-98, 0, -98, 48, 1.62, 0.8, { broken: true, seg: 3, gaps: 0.13 });
      wall(-98, 0, -50, 0, 1.55, 0.8, { broken: true, seg: 3, gaps: 0.13 });
      wall(-50, 0, -50, 18, 1.35, 0.8, { broken: true, seg: 3, gaps: 0.1 });
      wall(-50, 30, -50, 48, 1.3, 0.8, { broken: true, seg: 3, gaps: 0.1 });
      wall(-98, 48, -50, 48, 1.2, 0.8, { broken: true, seg: 3, gaps: 0.18 });

      // 柜子深处
      makeCabinet(-86, 34);
      // 柜子里的暗：一块压暗的地面
      slab(-89, 32, -83, 37, darkWoodMat, 0.04);
      // 柜前散落的旧物
      makeRubble(-84, 30, 8, 2.2);

      // 长路：从入口一路向西，尽头是出口
      slab(-80, 21.4, -95, 22.6, stoneDarkMat, 0.04);
      for (var st = 0; st < 22; st++) {
        var sx = -56 - st * 1.85;
        boxMesh(sx, 0, 21 + Math.sin(st * 1.3) * 1.5, 0.5, 0.06, 0.42, stoneMat, Math.random(), false);
      }
      leafCarpet(-96, 15, -56, 30, 1200, 0.03);
      // 路边的土坡（可攀）
      for (var sl = 0; sl < 5; sl++) {
        var sx2 = -66 - sl * 6.4;
        boxMesh(sx2, 0, 27 + (sl % 2) * 2, 3.2, 0.55 + sl * 0.12, 2.4, stoneDarkMat, 0.2, true, true);
      }
      // 尽头的门：两柱 + 上方一线微光
      boxMesh(-95.6, 0, 15.6, 0.9, 3.0, 0.9, stoneMat, 0, true, false);
      boxMesh(-95.6, 0, 26.4, 0.9, 3.0, 0.9, stoneMat, 0, true, false);
      boxMesh(-95.6, 3.0, 21, 0.9, 0.35, 11.6, stoneMat, 0, false, false);
      var exitGlow = new T.Sprite(new T.SpriteMaterial({
        map: glowTexture('rgba(255,250,232,1)', 'rgba(255,236,190,.32)'),
        transparent: true, blending: T.AdditiveBlending, depthWrite: false, opacity: 0.5
      }));
      exitGlow.scale.set(16, 16, 1);
      exitGlow.position.set(-96.5, 2.2, 21);
      scene.add(exitGlow);

      // 单向雾门：走到柜子之后合上
      exitGate = new T.Mesh(new T.PlaneGeometry(7, 4.4), new T.MeshBasicMaterial({
        map: mistTexture(), transparent: true, opacity: 0, depthWrite: false, side: T.DoubleSide, color: 0xd8d4c6
      }));
      exitGate.position.set(-50, 2.2, 24);
      exitGate.rotation.y = Math.PI / 2;
      scene.add(exitGate);
    }

    /* ---- 室内地面压平：石板下面不该钻出起伏的野地 ---- */
    (function () {
      if (!groundMesh) return;
      var pos = groundMesh.geometry.attributes.position;
      var cz = (WORLD.z0 + WORLD.z1) / 2;
      var n2 = 0;
      for (var i = 0; i < pos.count; i++) {
        var wx = pos.getX(i);
        var wz = -pos.getY(i) + cz;
        if (inFloor(wx, wz, 0.5)) { pos.setZ(i, 0.0); n2++; }
      }
      pos.needsUpdate = true;
      groundMesh.geometry.computeVertexNormals();
    })();

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
    for (var i = 0; i < 30; i++) {
      var x, z;
      if (i < 10) {
        // 枢纽中央的薄雾
        var a0 = Math.random() * 6.283;
        var r0 = 6 + Math.random() * 22;
        x = Math.sin(a0) * r0;
        z = Math.cos(a0) * r0;
      } else {
        // 各区之间的空隙：让每片区域都像被雾隔开
        var pi = (i - 10) % PLACES.length;
        var p = PLACES[pi];
        var cx = (p.x0 + p.x1) / 2, cz = (p.z0 + p.z1) / 2;
        x = cx + (Math.random() - 0.5) * 52;
        z = cz + (Math.random() - 0.5) * 52;
        if (inFloor(x, z, 2)) { x += 6; z += 6; }
      }
      var mat = new T.SpriteMaterial({
        map: tex, transparent: true, depthWrite: false,
        opacity: 0, color: 0xffffff, fog: true
      });
      var sp = new T.Sprite(mat);
      var sc = 16 + Math.random() * 26;
      sp.scale.set(sc, sc * (0.52 + Math.random() * 0.16), 1);
      sp.position.set(x, 0.35 + Math.random() * 1.5, z);
      sp.material.rotation = (Math.random() - 0.5) * 0.16;
      sp.userData.base = 0.018 + Math.random() * 0.032;
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
      var pt = scatterPoint();
      dummy.position.set(pt.x, 0, pt.z);
      dummy.rotation.y = Math.random() * Math.PI * 2;
      var sc = 0.75 + Math.random() * 0.7;
      dummy.scale.set(sc, sc * (0.42 + Math.random() * 0.44), sc);
      dummy.updateMatrix();
      grassMesh.setMatrixAt(i, dummy.matrix);

      var ps = placeAt(pt.x, pt.z);
      var warmth = ps < 0 ? 0.55 : WARMTH[ps];
      col.setRGB(0.42 + warmth * 0.16, 0.45 + warmth * 0.16, 0.31 + warmth * 0.12);
      col.offsetHSL((Math.random() - 0.5) * 0.10, -0.10 + Math.random() * 0.10, (Math.random() - 0.5) * 0.22);
      // 三成草叶偏枯黄：整个场地的绿才不会像一块塑料草坪
      if (Math.random() < 0.32) col.lerp(new T.Color(0.58, 0.51, 0.28), 0.35 + Math.random() * 0.3);
      if (ps === 2 || ps === 3) {
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
      var pt = scatterPoint();
      dummy.position.set(pt.x, 0, pt.z);
      dummy.rotation.y = Math.random() * Math.PI;
      var sc = 0.42 + Math.random() * 0.62;
      dummy.scale.set(sc * (0.85 + Math.random() * 0.4), sc * (0.72 + Math.random() * 0.6), sc);
      dummy.updateMatrix();
      grassCards.setMatrixAt(i, dummy.matrix);

      var ps = placeAt(pt.x, pt.z);
      var warmth = ps < 0 ? 0.55 : WARMTH[ps];
      col.setRGB(0.44 + warmth * 0.15, 0.47 + warmth * 0.15, 0.32 + warmth * 0.11);
      col.offsetHSL((Math.random() - 0.5) * 0.09, -0.06 + Math.random() * 0.10, (Math.random() - 0.5) * 0.22);
      if (Math.random() < 0.35) col.lerp(new T.Color(0.62, 0.54, 0.30), 0.30 + Math.random() * 0.28);
      if (ps === 2 || ps === 3) {
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
      var pt = scatterPoint();
      var s = 0.022 + Math.pow(Math.random(), 2.4) * 0.075;
      dummy.position.set(pt.x, s * 0.34, pt.z);
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
      return x > -118 && x < 118 && z > -108 && z < 124;
    }

    var placed = 0, guard = 0;
    while (placed < 108 && guard < 5000) {
      guard++;
      var lx = (Math.random() * 2 - 1) * 300;
      var lz = 8 + (Math.random() * 2 - 1) * 260;
      var rr = Math.sqrt(lx * lx + (lz - 8) * (lz - 8));
      if (rr < 124 || rr > 330) continue;
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
      var sa = Math.random() * 6.283;
      var sr = 136 + Math.pow(Math.random(), 1.5) * 110;
      var sx = Math.sin(sa) * sr;
      var sz = 8 + Math.cos(sa) * sr;
      if (placeAt(sx, sz) >= 0) continue;
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

  function inFloor(x, z, m) {
    m = m == null ? 0 : m;
    for (var i = 0; i < FLOORS.length; i++) {
      var f = FLOORS[i];
      if (x > f[0] - m && x < f[2] + m && z > f[1] - m && z < f[3] + m) return true;
    }
    return false;
  }

  // 某点属于哪片区域（含外扩的氛围带）：返回 stage，枢纽返回 -1
  function placeAt(x, z) {
    var best = -1, bestD = 1e9;
    for (var i = 0; i < PLACES.length; i++) {
      var p = PLACES[i];
      if (x > p.x0 && x < p.x1 && z > p.z0 && z < p.z1) return p.stage;
      var cx = (p.x0 + p.x1) / 2, cz = (p.z0 + p.z1) / 2;
      var d = Math.max(Math.abs(x - cx) - (p.x1 - p.x0) / 2, Math.abs(z - cz) - (p.z1 - p.z0) / 2);
      if (d < bestD) { bestD = d; best = p.stage; }
    }
    return bestD < 14 ? best : -1;
  }

  var WARMTH = [1.0, 0.55, 0.22, 0.16, 0.85];

  function scatterPoint() {
    for (var t = 0; t < 14; t++) {
      var x = WORLD.x0 + 5 + Math.random() * (WORLD.x1 - WORLD.x0 - 10);
      var z = WORLD.z0 + 5 + Math.random() * (WORLD.z1 - WORLD.z0 - 10);
      if (inFloor(x, z, 0.9)) continue;
      return { x: x, z: z };
    }
    return { x: 0, z: 0 };
  }
  
  /* ---------------- 更新 & 阶段 ---------------- */

  // 0-4：五片回忆区；5：中央荒原；6：结局草地
  var PAL = [
    { // 童年：午后的暖光
      col: 0xd3c8b0, den: 0.0078, top: 0x93a9bc, mid: 0xdbd2be, sunK: 1.45,
      sunDir: [-0.46, 0.58, -0.68], sunColor: 0xffeccb,
      grade: { exposure: 0.74, bloom: 0.14, threshold: 1.10, saturation: 1.06, contrast: 1.20, warmth: 0.090, shafts: 0.30, vignette: 0.80, grain: 0.019, clouds: 1.0 }
    },
    { // 少年：中性自然光，慢慢变冷
      col: 0xb2aea4, den: 0.030, top: 0x8b97a0, mid: 0xc4bdad, sunK: 0.85,
      sunDir: [0.52, 0.52, -0.68], sunColor: 0xffeeda,
      grade: { exposure: 0.72, bloom: 0.15, threshold: 1.06, saturation: 0.90, contrast: 1.24, warmth: 0.014, shafts: 0.18, vignette: 0.86, grain: 0.025, clouds: 0.72 }
    },
    { // 亲情与失去：冷白、雾气重
      col: 0x9fa4a4, den: 0.046, top: 0x77838c, mid: 0xa8aeae, sunK: 0.42,
      sunDir: [-0.44, 0.56, -0.70], sunColor: 0xe8ece8,
      grade: { exposure: 0.76, bloom: 0.16, threshold: 1.05, saturation: 0.76, contrast: 1.26, warmth: -0.020, shafts: 0.08, vignette: 0.90, grain: 0.026, clouds: 0.35 }
    },
    { // 成年：低照度蓝灰
      col: 0x7d8388, den: 0.042, top: 0x4e5a66, mid: 0x767d82, sunK: 0.26,
      sunDir: [0.48, 0.54, -0.69], sunColor: 0xc8cfd4,
      grade: { exposure: 0.82, bloom: 0.17, threshold: 1.02, saturation: 0.68, contrast: 1.28, warmth: -0.034, shafts: 0.03, vignette: 0.92, grain: 0.028, clouds: 0.18 }
    },
    { // 终章：淡金漫射
      col: 0xd8d0bc, den: 0.0095, top: 0x9fb2c0, mid: 0xe2dccd, sunK: 1.35,
      sunDir: [-0.40, 0.52, -0.75], sunColor: 0xfff2d6,
      grade: { exposure: 0.76, bloom: 0.20, threshold: 1.14, saturation: 1.04, contrast: 1.16, warmth: 0.052, shafts: 0.30, vignette: 0.70, grain: 0.017, clouds: 0.8 }
    },
    { // 中央荒原：中性柔光
      col: 0xbfb9ab, den: 0.026, top: 0x84939f, mid: 0xc7c1b4, sunK: 1.0,
      sunDir: [0.32, 0.16, -1], sunColor: 0xfff0da,
      grade: { exposure: 0.72, bloom: 0.15, threshold: 1.09, saturation: 0.92, contrast: 1.24, warmth: 0.016, shafts: 0.24, vignette: 0.86, grain: 0.023, clouds: 0.85 }
    },
    { // 结局草地
      col: 0xd6d2c6, den: 0.010, top: 0x9fb2c0, mid: 0xdedbd0, sunK: 1.3,
      sunDir: [0.4, 0.2, -1], sunColor: 0xfff2d6,
      grade: { exposure: 0.80, bloom: 0.20, threshold: 1.16, saturation: 1.12, contrast: 1.14, warmth: 0.060, shafts: 0.30, vignette: 0.68, grain: 0.016, clouds: 0.85 }
    }
  ];
  var PAL_HEMI = [0.62, 0.54, 0.58, 0.60, 0.48, 0.46, 0.38];
  var PAL_SUN = [2.10, 1.55, 1.05, 0.85, 2.00, 1.70, 1.70];
  var PAL_SPRITE = [0.5, 0.30, 0.20, 0.12, 0.46, 0.36, 0.5];

  W.setStage = function (s, instant) {
    s = Math.max(0, Math.min(6, s | 0));
    stageNow = s;
    var p = PAL[s] || PAL[5];
    var col = p.col, den = p.den, top = p.top, mid = p.mid, bot = col, sunK = p.sunK;
    var sunPos = new T.Vector3(p.sunDir[0], p.sunDir[1], p.sunDir[2]).normalize();
    var sunColor = p.sunColor;

    fogTarget.color = new T.Color(col);
    fogTarget.density = den;
    gradeTarget = p.grade;

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
      sunSprite.material.opacity = PAL_SPRITE[s];
      sunSprite.position.copy(sunPos).multiplyScalar(300);
    }
    if (instant) {
      fog.color.copy(fogTarget.color);
      fog.density = fogTarget.density;
    }
    if (hemiLight) hemiLight.intensity = PAL_HEMI[s];
    if (W.sun) {
      W.sun.intensity = PAL_SUN[s];
      W.sun.color.set(sunColor);
    }
    sunDirCur.copy(sunPos);

    // 环境球：每次换区重建一次
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

    // 蒸汽：从灶台与蒸笼里升起来
    for (var si = 0; si < steams.length; si++) {
      var sw = steams[si], su = sw.userData;
      var sph = (clockT * su.sp + su.ph) % 1;
      sw.position.y = su.y0 + sph * 2.6;
      sw.position.x = su.x + Math.sin(clockT * 0.55 + su.ph * 6.28) * 0.28 * sph;
      var ssc = su.sc * (0.55 + sph * 1.9);
      sw.scale.set(1.45 * ssc, 1.85 * ssc, 1);
      sw.material.opacity = (1 - sph) * 0.20 * Math.min(1, sph * 5.5);
    }

    // 走到柜子之后：身后的雾门合上，不能再回头
    if (exitGate && camera) {
      if (!exitClosed && camera.position.x < -73 && camera.position.z > 0 && camera.position.z < 48) {
        exitClosed = true;
        exitGate.userData.target = 0.5;
        addCollider(-50, 24, 0.5, 7.4, 0, 4.4, false);
        if (YH.Audio && YH.Audio.closeIn) YH.Audio.closeIn();
      }
      var gt = exitGate.userData.target || 0;
      exitGate.material.opacity += (gt - exitGate.material.opacity) * Math.min(1, dt * 1.2);
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
      W.sun.position.set(
        camera.position.x + sunDirCur.x * 78,
        sunDirCur.y * 78,
        camera.position.z + sunDirCur.z * 78
      );
      W.sun.target.position.set(camera.position.x, 0, camera.position.z);
      W.sun.target.updateMatrixWorld();
    }
  };

  // 区域判定：矩形内就是该区，矩形外 10 米算“还没走进去”的引道，仍用该区的雾
  W.stageAt = function (x, z) {
    var best = 5, bd = 1e9;
    for (var i = 0; i < PLACES.length; i++) {
      var p = PLACES[i];
      var dx = Math.max(p.x0 - x, 0, x - p.x1);
      var dz = Math.max(p.z0 - z, 0, z - p.z1);
      var d = Math.sqrt(dx * dx + dz * dz);
      if (d <= 0.5) return p.stage;
      if (d < bd) { bd = d; best = p.stage; }
    }
    return bd < 4 ? best : 5;
  };

  W.placeName = function (x, z) {
    for (var i = 0; i < PLACES.length; i++) {
      var p = PLACES[i];
      if (x > p.x0 - 2 && x < p.x1 + 2 && z > p.z0 - 2 && z < p.z1 + 2) return p.name;
    }
    return '回忆荒原';
  };

  W.endReached = function (x, z) {
    return x < -92.5 && z > 13 && z < 29;
  };

  W.exitClosed = function () { return exitClosed; };

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
  W.PLACES = PLACES;
  W.fragments = fragments;
  W.colliders = colliders;
  W.scene = function () { return scene; };

  YH.World = W;
})(window.YH = window.YH || {});
