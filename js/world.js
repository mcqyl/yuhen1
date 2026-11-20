/* 余痕 · 世界构建（地形 / 废墟 / 可攀爬物 / 碎片 / 雾区） */
(function (YH) {
  'use strict';

  var W = {};
  var T = THREE;

  var WORLD = { x0: -160, x1: 160, z0: -180, z1: 60 };

  var scene, root, stoneMat, stoneDarkMat, woodMat, metalMat, ceramicMat;
  var fragGroup, colliders = [], fragments = [], clouds = [], grassMesh, waterMesh, sunSprite;
  var skyMat, fog, fragLights = [];
  var clockT = 0;
  var fogTarget = { color: new T.Color(0xd9d0c1), density: 0.011 };
  var stageNow = 0;

  /* ---------------- 程序化贴图 ---------------- */

  function cv(w, h) {
    var c = document.createElement('canvas');
    c.width = w; c.height = h;
    return c;
  }

  function stoneTexture() {
    var c = cv(256, 256), g = c.getContext('2d');
    g.fillStyle = '#a9a296';
    g.fillRect(0, 0, 256, 256);
    for (var i = 0; i < 2600; i++) {
      var v = 130 + Math.random() * 70;
      g.fillStyle = 'rgba(' + (v | 0) + ',' + ((v - 6) | 0) + ',' + ((v - 16) | 0) + ',' + (Math.random() * 0.4) + ')';
      g.fillRect(Math.random() * 256, Math.random() * 256, 1 + Math.random() * 3, 1 + Math.random() * 3);
    }
    // 石块分缝
    g.strokeStyle = 'rgba(60,55,48,.28)';
    g.lineWidth = 2;
    for (var r = 0; r < 6; r++) {
      var y = r * 42 + Math.random() * 8;
      g.beginPath(); g.moveTo(0, y); g.lineTo(256, y + (Math.random() * 6 - 3)); g.stroke();
      for (var s = 0; s < 3; s++) {
        var x = Math.random() * 256;
        g.beginPath(); g.moveTo(x, y); g.lineTo(x + (Math.random() * 8 - 4), y + 42); g.stroke();
      }
    }
    // 苔藓
    for (var m = 0; m < 26; m++) {
      var mx = Math.random() * 256, my = 120 + Math.random() * 136;
      var rg = g.createRadialGradient(mx, my, 0, mx, my, 6 + Math.random() * 18);
      rg.addColorStop(0, 'rgba(112,120,84,.5)');
      rg.addColorStop(1, 'rgba(112,120,84,0)');
      g.fillStyle = rg;
      g.beginPath(); g.arc(mx, my, 24, 0, 6.29); g.fill();
    }
    var tex = new T.CanvasTexture(c);
    tex.wrapS = tex.wrapT = T.RepeatWrapping;
    tex.colorSpace = T.SRGBColorSpace;
    return tex;
  }

  function barkTexture() {
    var c = cv(128, 256), g = c.getContext('2d');
    g.fillStyle = '#5d5145';
    g.fillRect(0, 0, 128, 256);
    for (var i = 0; i < 90; i++) {
      g.strokeStyle = 'rgba(' + (30 + Math.random() * 30) + ',' + (26 + Math.random() * 24) + ',' + (22 + Math.random() * 20) + ',' + (0.25 + Math.random() * 0.4) + ')';
      g.lineWidth = 1 + Math.random() * 3;
      var x = Math.random() * 128;
      g.beginPath();
      g.moveTo(x, 0);
      for (var y = 0; y < 256; y += 32) g.lineTo(x + Math.sin(y * 0.08 + i) * 6, y);
      g.stroke();
    }
    var tex = new T.CanvasTexture(c);
    tex.wrapS = tex.wrapT = T.RepeatWrapping;
    tex.colorSpace = T.SRGBColorSpace;
    return tex;
  }

  function groundTexture() {
    var S = 2048, c = cv(S, S * 0.75), g = c.getContext('2d');
    var H = S * 0.75;
    // 世界 -> 画布
    function px(x) { return (x - WORLD.x0) / (WORLD.x1 - WORLD.x0) * S; }
    function py(z) { return (WORLD.z1 - z) / (WORLD.z1 - WORLD.z0) * H; }

    // 底色草
    var base = g.createLinearGradient(0, 0, 0, H);
    base.addColorStop(0, '#787c5d');
    base.addColorStop(0.45, '#6a6f50');
    base.addColorStop(1, '#585e44');
    g.fillStyle = base;
    g.fillRect(0, 0, S, H);

    // 大块草斑
    for (var i = 0; i < 900; i++) {
      var x = Math.random() * S, y = Math.random() * H;
      var r = 20 + Math.random() * 130;
      var rg = g.createRadialGradient(x, y, 0, x, y, r);
      var tone = Math.random();
      var col = tone > 0.62 ? '96,104,68' : tone > 0.3 ? '82,88,60' : '112,106,76';
      rg.addColorStop(0, 'rgba(' + col + ',' + (0.05 + Math.random() * 0.13) + ')');
      rg.addColorStop(1, 'rgba(' + col + ',0)');
      g.fillStyle = rg;
      g.beginPath(); g.arc(x, y, r, 0, 6.29); g.fill();
    }

    // 土路（与行走主轴一致）
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
    strokePath(17, 'rgba(104,95,74,.40)', 5);
    strokePath(11, '#7d705a', 2);
    strokePath(7, '#8b7d66', 1);
    // 路面碎石与车辙
    g.save();
    g.globalAlpha = 0.35;
    for (var d = 0; d < 2400; d++) {
      var tz = Math.random() * 2 - 1;
      var idx = Math.floor(Math.random() * (pathZ.length - 1));
      var zz = pathZ[idx] + (Math.random() - 0.5) * 10;
      var xx = pathX[idx] + tz * 2.4;
      g.fillStyle = Math.random() > 0.5 ? '#8a7c62' : '#b3a488';
      g.fillRect(px(xx) + Math.random() * 4, py(zz) + Math.random() * 4, 1 + Math.random() * 2.5, 1 + Math.random() * 2);
    }
    g.restore();

    // 水洼
    var puddles = [[-14, 4, 5], [10, -30, 4], [-6, -60, 6], [4, -96, 5], [-18, -118, 7]];
    puddles.forEach(function (p) {
      var rg = g.createRadialGradient(px(p[0]), py(p[1]), 0, px(p[0]), py(p[1]), p[2] * 4.6);
      rg.addColorStop(0, 'rgba(120,132,134,.55)');
      rg.addColorStop(0.7, 'rgba(120,132,134,.28)');
      rg.addColorStop(1, 'rgba(120,132,134,0)');
      g.fillStyle = rg;
      g.beginPath(); g.arc(px(p[0]), py(p[1]), p[2] * 4.6, 0, 6.29); g.fill();
    });

    // 细噪点
    var img = g.getImageData(0, 0, S, H);
    var dd = img.data;
    for (var q = 0; q < dd.length; q += 4) {
      var n = (Math.random() - 0.5) * 16;
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

  function detailTexture() {
    var c = cv(256, 256), g = c.getContext('2d');
    g.fillStyle = '#ffffff';
    g.fillRect(0, 0, 256, 256);
    for (var i = 0; i < 9000; i++) {
      var v = 200 + Math.random() * 55;
      g.fillStyle = 'rgba(' + (v | 0) + ',' + (v | 0) + ',' + (v | 0) + ',' + (Math.random() * 0.5) + ')';
      g.fillRect(Math.random() * 256, Math.random() * 256, 1, 1 + Math.random() * 2);
    }
    var tex = new T.CanvasTexture(c);
    tex.wrapS = tex.wrapT = T.RepeatWrapping;
    tex.repeat.set(90, 90);
    tex.colorSpace = T.SRGBColorSpace;
    return tex;
  }

  function grassTexture() {
    var c = cv(64, 64), g = c.getContext('2d');
    g.clearRect(0, 0, 64, 64);
    for (var i = 0; i < 7; i++) {
      var x = 8 + Math.random() * 48;
      g.strokeStyle = 'rgba(' + (96 + Math.random() * 34 | 0) + ',' + (112 + Math.random() * 40 | 0) + ',' + (72 + Math.random() * 30 | 0) + ',.95)';
      g.lineWidth = 1.4 + Math.random() * 1.6;
      g.lineCap = 'round';
      g.beginPath();
      g.moveTo(x, 64);
      g.quadraticCurveTo(x + (Math.random() * 14 - 7), 36, x + (Math.random() * 22 - 11), 8 + Math.random() * 14);
      g.stroke();
    }
    var tex = new T.CanvasTexture(c);
    tex.colorSpace = T.SRGBColorSpace;
    return tex;
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

  /* ---------------- 碰撞 ---------------- */

  function addCollider(x, z, w, d, y0, y1, climb) {
    colliders.push({
      x0: x - w / 2, x1: x + w / 2,
      z0: z - d / 2, z1: z + d / 2,
      y0: y0, y1: y1, climb: !!climb
    });
  }

  function boxMesh(x, y, z, w, h, d, mat, ry, collide, climb) {
    var m = new T.Mesh(new T.BoxGeometry(w, h, d), mat);
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
    for (var i = 0; i < n; i++) {
      var cx = x1 + stepX * (i + 0.5);
      var cz = z1 + stepZ * (i + 0.5);
      var hh = h * (opt.broken ? (0.55 + Math.random() * 0.7) : (0.92 + Math.random() * 0.16));
      if (opt.gaps && Math.random() < opt.gaps) continue;
      var w = Math.abs(stepX) > Math.abs(stepZ) ? Math.abs(stepX) : thick;
      var d = Math.abs(stepX) > Math.abs(stepZ) ? thick : Math.abs(stepZ);
      var mat = Math.random() > 0.6 ? stoneDarkMat : stoneMat;
      var m = new T.Mesh(new T.BoxGeometry(w * 1.02, hh, d * 1.02), mat);
      m.position.set(cx, hh / 2, cz);
      m.rotation.y = ang + (Math.random() - 0.5) * 0.05;
      m.castShadow = true; m.receiveShadow = true;
      root.add(m);
      if (opt.noCollide !== true) addCollider(cx, cz, w, d, 0, hh, hh < 1.7);
      // 顶部碎石
      if (Math.random() > 0.55) {
        var rb = new T.Mesh(new T.BoxGeometry(w * (0.3 + Math.random() * 0.4), 0.16 + Math.random() * 0.16, d * 0.8), mat);
        rb.position.set(cx + (Math.random() - 0.5) * w * 0.4, hh + 0.07, cz + (Math.random() - 0.5) * d * 0.3);
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

    var trunk = new T.Mesh(new T.CylinderGeometry(r * 0.55, r, h, 7, 1), woodMat);
    trunk.position.y = h / 2;
    trunk.castShadow = true; trunk.receiveShadow = true;
    grp.add(trunk);

    function branch(px, py, pz, dirX, dirY, dirZ, len, rad, depth) {
      var start = new T.Vector3(px, py, pz);
      var end = new T.Vector3(px + dirX * len, py + dirY * len, pz + dirZ * len);
      var mid = start.clone().add(end).multiplyScalar(0.5);
      var dir = end.clone().sub(start);
      var L = dir.length();
      var geo = new T.CylinderGeometry(rad * 0.6, rad, L, 5, 1);
      var mesh = new T.Mesh(geo, woodMat);
      mesh.position.copy(mid);
      mesh.quaternion.setFromUnitVectors(new T.Vector3(0, 1, 0), dir.clone().normalize());
      mesh.castShadow = true;
      grp.add(mesh);
      if (depth > 0) {
        var k = 2 + (Math.random() > 0.6 ? 1 : 0);
        for (var i = 0; i < k; i++) {
          branch(
            end.x, end.y, end.z,
            dirX + (Math.random() - 0.5) * 0.9, dirY * 0.8 + Math.random() * 0.3, dirZ + (Math.random() - 0.5) * 0.9,
            len * (0.55 + Math.random() * 0.2), rad * 0.62, depth - 1
          );
        }
      }
    }

    var nb = opt.branches || 4;
    for (var i = 0; i < nb; i++) {
      var a = (i / nb) * Math.PI * 2 + Math.random() * 0.6;
      var up = 0.45 + Math.random() * 0.5;
      branch(0, h * (0.55 + Math.random() * 0.32), 0, Math.cos(a) * 0.55, up, Math.sin(a) * 0.55, h * 0.33, r * 0.55, opt.depth || 2);
    }
    addCollider(x, z, r * 2.4, r * 2.4, 0, h * 0.9, false);
    return grp;
  }

  function makeGazebo(x, z) {
    var R = 3.1, n = 6, colH = 2.85;
    for (var i = 0; i < n; i++) {
      var a = (i / n) * Math.PI * 2;
      var px = x + Math.cos(a) * R, pz = z + Math.sin(a) * R;
      var col = boxMesh(px, 0, pz, 0.44, colH, 0.44, stoneMat, a, true, false);
      col.rotation.z = (Math.random() - 0.5) * 0.03;
    }
    // 台基
    boxMesh(x, 0, z, R * 2.5, 0.22, R * 2.5, stoneDarkMat, 0, true, true);
    // 顶部残环
    var ring = new T.Mesh(new T.TorusGeometry(R, 0.14, 6, 24), stoneDarkMat);
    ring.position.set(x, colH - 0.1, z);
    ring.rotation.x = Math.PI / 2;
    ring.castShadow = true;
    root.add(ring);
    // 塌了一半的屋顶
    for (var k = 0; k < 9; k++) {
      var ang = (k / 9) * Math.PI * 2;
      if (k > 5) continue;
      var beam = new T.Mesh(new T.BoxGeometry(R * 1.05, 0.11, 0.2), woodMat);
      beam.position.set(x + Math.cos(ang) * R * 0.5, colH + 0.28 + Math.sin(k) * 0.06, z + Math.sin(ang) * R * 0.5);
      beam.rotation.y = -ang;
      beam.rotation.z = 0.16 + Math.random() * 0.1;
      beam.castShadow = true;
      root.add(beam);
    }
    // 掉落的横梁
    boxMesh(x + 1.6, 0.22, z + 1.2, 2.4, 0.18, 0.22, woodMat, 0.7, false);
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
      var m = new T.Mesh(new T.BoxGeometry(s, s * (0.4 + Math.random() * 0.6), s * (0.6 + Math.random())), stoneMat);
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
      default:
        g.add(new T.Mesh(new T.SphereGeometry(s, 10, 8), mat));
    }
    g.traverse(function (o) { if (o.isMesh) { o.castShadow = true; } });
    return g;
  }

  /* ---------------- 碎片数据 ---------------- */

  var FRAG_DEFS = [
    // 第一段：柔和、温柔的小物件
    {
      id: 'hairtie', stage: 0, name: '褪色发圈', shape: 'ring', mood: 'warm', seed: 1001,
      pos: [2.35, 0.30, 41.2], rot: 0.4, scale: 1,
      shots: [{ scene: 'walk', dur: 7.5 }, { scene: 'talk', dur: 6.5 }, { scene: 'object', dur: 6.0 }]
    },
    {
      id: 'note', stage: 0, name: '没写完的纸条', shape: 'note', mood: 'warm', seed: 1002,
      pos: [-1.15, 0.03, 27.5], rot: -0.3, scale: 1.15,
      shots: [{ scene: 'window', dur: 6.5 }, { scene: 'letter', dur: 7.0 }, { scene: 'talk', dur: 5.5 }]
    },
    {
      id: 'cup', stage: 0, name: '旧杯子（缺口）', shape: 'cup', mood: 'warm', seed: 1003,
      pos: [14.4, 0.28, 0.9], rot: 1.1, scale: 1.2,
      shots: [{ scene: 'sit', dur: 8.0 }, { scene: 'object', dur: 6.0 }, { scene: 'walk', dur: 6.0 }]
    },
    {
      id: 'bell', stage: 0, name: '小铜铃', shape: 'bell', mood: 'warm', seed: 1004,
      pos: [-6.4, 0.04, 36.0], rot: 0.8, scale: 1.1,
      shots: [{ scene: 'walk', dur: 6.5 }, { scene: 'talk', dur: 7.5 }, { scene: 'sunset', dur: 7.5 }]
    },

    // 第二段：疏远、别扭
    {
      id: 'umbrella', stage: 1, name: '伞骨弯了的长柄伞', shape: 'umbrella', mood: 'gray', seed: 2001,
      pos: [-6.2, 0.80, -34.2], rot: 0.2, scale: 1.1,
      shots: [{ scene: 'alone', dur: 7.0 }, { scene: 'apart', dur: 7.5 }, { scene: 'alone', dur: 5.5 }]
    },
    {
      id: 'watch', stage: 1, name: '停在三点十七的表', shape: 'watch', mood: 'gray', seed: 2002,
      pos: [4.55, 1.21, -52.0], rot: 0.7, scale: 1.0,
      shots: [{ scene: 'window', dur: 6.5 }, { scene: 'apart', dur: 8.0 }, { scene: 'object', dur: 5.5 }]
    },
    {
      id: 'key', stage: 1, name: '没送出去的钥匙', shape: 'key', mood: 'gray', seed: 2003,
      pos: [-16.4, 0.06, -60.5], rot: -0.5, scale: 1.1,
      shots: [{ scene: 'door', dur: 7.0 }, { scene: 'talk', dur: 8.0 }, { scene: 'leave', dur: 7.0 }]
    },
    {
      id: 'diary', stage: 1, name: '涂黑的日记页', shape: 'page', mood: 'gray', seed: 2004,
      pos: [10.4, 0.56, -39.1], rot: 0.9, scale: 1.1,
      shots: [{ scene: 'letter', dur: 8.0 }, { scene: 'argue', dur: 7.0 }, { scene: 'alone', dur: 5.5 }]
    },

    // 第三段：伤害与真相
    {
      id: 'letter', stage: 2, name: '撕坏的信', shape: 'envelope', mood: 'dark', seed: 3001,
      pos: [-6.1, 0.82, -88.2], rot: 0.5, scale: 1.15,
      shots: [{ scene: 'letter', dur: 8.0 }, { scene: 'argue', dur: 8.0 }, { scene: 'door', dur: 8.0 }]
    },
    {
      id: 'bird', stage: 2, name: '裂开的陶瓷鸟', shape: 'bird', mood: 'dark', seed: 3002,
      pos: [-9.7, 0.62, -92.4], rot: -0.4, scale: 1.0,
      shots: [{ scene: 'object', dur: 8.0 }, { scene: 'argue', dur: 7.0 }, { scene: 'alone', dur: 7.0 }]
    },
    {
      id: 'ticket', stage: 2, name: '旧车票', shape: 'ticket', mood: 'dark', seed: 3003,
      pos: [12.2, 0.93, -103.6], rot: 0.15, scale: 1.1,
      shots: [{ scene: 'platform', dur: 9.0 }, { scene: 'leave', dur: 8.0 }, { scene: 'alone', dur: 7.0 }]
    },
    {
      id: 'camera', stage: 2, name: '摔裂的相机', shape: 'camera', mood: 'dark', seed: 3004,
      pos: [18.2, 0.93, -110.0], rot: -0.2, scale: 1.0,
      shots: [{ scene: 'sunset', dur: 8.0 }, { scene: 'argue', dur: 8.0 }, { scene: 'object', dur: 8.0 }]
    },
    {
      id: 'jewelbox', stage: 2, name: '空首饰盒', shape: 'box', mood: 'truth', seed: 3005, truth: true,
      pos: [0.6, 0.82, -124.0], rot: 0.1, scale: 1.15,
      shots: [
        { scene: 'object', dur: 8.0 },
        { scene: 'talk', dur: 7.0 },
        { scene: 'argue', dur: 8.0 },
        { scene: 'leave', dur: 9.0 },
        { scene: 'window', dur: 6.0 }
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

    // 材质
    var st = stoneTexture();
    stoneMat = new T.MeshStandardMaterial({ map: st, color: 0xa9a094, roughness: 0.94, metalness: 0.02 });
    stoneDarkMat = new T.MeshStandardMaterial({ map: st, color: 0x8a8276, roughness: 0.96, metalness: 0.02 });
    var bark = barkTexture();
    woodMat = new T.MeshStandardMaterial({ map: bark, color: 0x77654f, roughness: 0.95 });
    metalMat = new T.MeshStandardMaterial({ color: 0x5d5a54, roughness: 0.6, metalness: 0.55 });
    ceramicMat = new T.MeshStandardMaterial({ color: 0xc9bca6, roughness: 0.5, metalness: 0.05 });

    // 地面
    var gtex = groundTexture();
    var gGeo = new T.PlaneGeometry(WORLD.x1 - WORLD.x0, WORLD.z1 - WORLD.z0, 64, 48);
    (function () {
      var pos = gGeo.attributes.position;
      for (var i = 0; i < pos.count; i++) {
        var lx = pos.getX(i), ly = pos.getY(i);
        var n1 = Math.sin(lx * 0.07 + ly * 0.03) * 0.10;
        var n2 = Math.sin(lx * 0.021 - ly * 0.017) * 0.16;
        pos.setZ(i, n1 + n2);
      }
      gGeo.computeVertexNormals();
    })();
    var ground = new T.Mesh(
      gGeo,
      new T.MeshStandardMaterial({ map: gtex, roughness: 1, metalness: 0 })
    );
    ground.rotation.x = -Math.PI / 2;
    ground.position.set(0, 0, (WORLD.z0 + WORLD.z1) / 2);
    ground.receiveShadow = true;
    scene.add(ground);


    // 天空
    skyMat = new T.ShaderMaterial({
      side: T.BackSide, depthWrite: false,
      uniforms: {
        topColor: { value: new T.Color(0x8fa3b4) },
        midColor: { value: new T.Color(0xd9d2c4) },
        botColor: { value: new T.Color(0xe8dcc6) },
        sunDir: { value: new T.Vector3(0.32, 0.16, -1).normalize() },
        sunColor: { value: new T.Color(0xfff1d2) },
        sunK: { value: 1 }
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
        'varying vec3 vDir;',
        'void main(){',
        '  float h = clamp(vDir.y*1.15+0.06, -0.2, 1.0);',
        '  vec3 col = mix(botColor, midColor, smoothstep(-0.06, 0.34, h));',
        '  col = mix(col, topColor, smoothstep(0.22, 0.92, h));',
        '  float d = max(dot(normalize(vDir), normalize(sunDir)), 0.0);',
        '  col += sunColor * pow(d, 26.0) * 0.85 * sunK;',
        '  col += sunColor * pow(d, 4.0) * 0.14 * sunK;',
        '  gl_FragColor = vec4(col, 1.0);',
        '  #include <tonemapping_fragment>',
        '  #include <encodings_fragment>',
        '}'
      ].join('\n')
    });
    var sky = new T.Mesh(new T.SphereGeometry(560, 32, 20), skyMat);
    scene.add(sky);

    // 太阳光晕
    var sunTex = glowTexture('rgba(255,250,236,1)', 'rgba(255,236,198,.5)');
    sunSprite = new T.Sprite(new T.SpriteMaterial({ map: sunTex, transparent: true, blending: T.AdditiveBlending, depthWrite: false, opacity: 0.45 }));
    sunSprite.scale.set(48, 48, 1);
    sunSprite.position.set(84, 46, -260);
    scene.add(sunSprite);

    // 云
    var cloudTex = glowTexture('rgba(255,255,255,.85)', 'rgba(252,248,240,.34)');
    for (var ci = 0; ci < 16; ci++) {
      var sp = new T.Sprite(new T.SpriteMaterial({ map: cloudTex, transparent: true, opacity: 0.18 + Math.random() * 0.22, depthWrite: false }));
      var s = 60 + Math.random() * 120;
      sp.scale.set(s, s * 0.52, 1);
      sp.position.set((Math.random() - 0.5) * 520, 34 + Math.random() * 68, -80 - Math.random() * 260);
      scene.add(sp);
      clouds.push({ sp: sp, sp2: 0.25 + Math.random() * 0.7 });
    }

    // 光
    var hemi = new T.HemisphereLight(0xe8e2d2, 0x5b5548, 0.30);
    scene.add(hemi);

    var amb = new T.AmbientLight(0xbfb8a8, 0.13);
    scene.add(amb);

    var sun = new T.DirectionalLight(0xffe9c6, 1.10);
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

    /* ---- 第一段 ---- */
    // 入口豁口两侧的断墙
    wall(-15, 44.2, -3.2, 44.2, 1.35, 1.1, { broken: true, seg: 2.2 });
    wall(2.4, 44.2, 13, 44.2, 1.3, 1.1, { broken: true, seg: 2.2 });
    wall(-15, 44.2, -15, 39.5, 1.1, 0.9, { broken: true, gaps: 0.35 });
    wall(13, 44.2, 13, 39.5, 1.05, 0.9, { broken: true, gaps: 0.4 });
    // 门槛台阶
    boxMesh(0, 0, 43.8, 5.0, 0.14, 1.6, stoneDarkMat, 0, true, true);

    makeGazebo(15, -2);
    makeTree(22, -8, { h: 9.5, r: 0.4, branches: 5, depth: 2 });
    makeTree(-24, 14, { h: 7, r: 0.28, branches: 4, depth: 2 });
    makeTree(-30, -10, { h: 8, r: 0.3, branches: 4, depth: 1 });

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
      var pond = new T.Mesh(new T.CircleGeometry(9.5, 40),
        new T.MeshStandardMaterial({ color: 0x8c9a9a, roughness: 0.16, metalness: 0.35, transparent: true, opacity: 0.85 }));
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
        var m = new T.Mesh(new T.DodecahedronGeometry(s, 0), stoneMat);
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
        h: 5.5 + Math.random() * 3, r: 0.24 + Math.random() * 0.12, branches: 4, depth: 1
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
        h: 6 + Math.random() * 4, r: 0.26 + Math.random() * 0.16, branches: 4, depth: 1
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
        h: 5 + Math.random() * 4, r: 0.22, branches: 3, depth: 1
      });
    }
    boxMesh(0, 0, -150, 2.2, 0.34, 2.2, stoneMat, 0.3, true, true);

    /* ---- 草 ---- */
    buildGrass();

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

  function buildGrass() {
    // 交叉双面片
    var g1 = new T.PlaneGeometry(0.55, 0.62);
    g1.translate(0, 0.31, 0);
    var g2 = g1.clone();
    g2.rotateY(Math.PI / 2);
    var merged = new T.BufferGeometry();
    var pos = [], nor = [], uv = [], idx = [];
    [g1, g2].forEach(function (g, gi) {
      var p = g.attributes.position.array;
      var n = g.attributes.normal.array;
      var u = g.attributes.uv.array;
      var off = gi * 4;
      for (var i = 0; i < p.length; i++) pos.push(p[i]);
      for (var j = 0; j < n.length; j++) nor.push(n[j]);
      for (var k = 0; k < u.length; k++) uv.push(u[k]);
      var ii = g.index.array;
      for (var m = 0; m < ii.length; m++) idx.push(ii[m] + off);
    });
    merged.setAttribute('position', new T.Float32BufferAttribute(pos, 3));
    merged.setAttribute('normal', new T.Float32BufferAttribute(nor, 3));
    merged.setAttribute('uv', new T.Float32BufferAttribute(uv, 2));
    merged.setIndex(idx);

    var mat = new T.MeshStandardMaterial({
      map: grassTexture(), transparent: true, alphaTest: 0.35,
      side: T.DoubleSide, roughness: 1, metalness: 0
    });
    mat.onBeforeCompile = function (shader) {
      shader.uniforms.uTime = { value: 0 };
      mat.userData.shader = shader;
      shader.vertexShader = 'uniform float uTime;\n' + shader.vertexShader.replace(
        '#include <begin_vertex>',
        [
          '#include <begin_vertex>',
          'vec3 wpos = (modelMatrix * instanceMatrix * vec4(position,1.0)).xyz;',
          'float sway = sin(uTime*1.1 + wpos.x*0.35 + wpos.z*0.28) * 0.055;',
          'transformed.x += sway * (position.y*1.6);',
          'transformed.z += sway * 0.7 * (position.y*1.6);'
        ].join('\n')
      );
    };

    var N = 24000;
    grassMesh = new T.InstancedMesh(merged, mat, N);
    grassMesh.instanceMatrix.setUsage(T.DynamicDrawUsage);
    var dummy = new T.Object3D();
    var col = new T.Color();
    for (var i = 0; i < N; i++) {
      var z = 50 - Math.random() * 196;
      var x = pathXAt(z) + (Math.random() - 0.5) * 96;
      // 避开主路
      var onPath = Math.abs(x - pathXAt(z)) < 1.9;
      if (onPath) x += (x > pathXAt(z) ? 1 : -1) * (1.9 + Math.random() * 3);
      dummy.position.set(x, 0, z);
      dummy.rotation.y = Math.random() * Math.PI;
      var sc = 0.45 + Math.random() * 0.62;
      dummy.scale.set(sc, sc * (0.8 + Math.random() * 0.55), sc);
      dummy.updateMatrix();
      grassMesh.setMatrixAt(i, dummy.matrix);
      // 阶段着色
      var warmth = z > -20 ? 1 : z > -74 ? 0.5 : 0.15;
      col.setRGB(0.50 + warmth * 0.12, 0.53 + warmth * 0.16, 0.34 + warmth * 0.09);
      col.offsetHSL(0, -0.04, (Math.random() - 0.5) * 0.09);
      // 第三段：草的颜色向灰靠拢
      if (z < -74) {
        var grey = 0.32 + Math.random() * 0.05;
        col.lerp(new T.Color(grey, grey * 0.97, grey * 0.90), 0.55);
      }
      grassMesh.setColorAt(i, col);
    }
    grassMesh.instanceMatrix.needsUpdate = true;
    grassMesh.castShadow = false;
    grassMesh.receiveShadow = false;
    scene.add(grassMesh);
  }

  function pathXAt(z) {
    // 与贴图路径近似的解析函数
    var t = (56 - z) / 220;
    return Math.sin(t * 9.2) * 1.6 + Math.cos(t * 4.1) * 0.9;
  }

  /* ---------------- 更新 & 阶段 ---------------- */

  W.setStage = function (s, instant) {
    stageNow = s;
    var col, den, top, mid, bot, sunK, sunPos, sunColor;
    if (s === 0) {
      col = 0xc4bbaa; den = 0.016;
      top = 0x8fa3b4; mid = 0xd6cec0; bot = 0xc6bdac; sunK = 0.9;
      sunPos = new T.Vector3(0.36, 0.17, -1).normalize(); sunColor = 0xfff0d0;
    } else if (s === 1) {
      col = 0xaeaba3; den = 0.045;
      top = 0x89929a; mid = 0xb6b7b1; bot = 0xaeaba3; sunK = 0.4;
      sunPos = new T.Vector3(0.3, 0.22, -1).normalize(); sunColor = 0xefe6d2;
    } else if (s === 2) {
      col = 0x6f6b64; den = 0.074;
      top = 0x50545a; mid = 0x6e6b65; bot = 0x77726a; sunK = 0.16;
      sunPos = new T.Vector3(0.2, 0.3, -1).normalize(); sunColor = 0xcbb896;
    } else {
      // 结局草地
      col = 0xd6d2c6; den = 0.012;
      top = 0x9fb2c0; mid = 0xdcd9ce; bot = 0xefe7d2; sunK = 1.25;
      sunPos = new T.Vector3(0.4, 0.2, -1).normalize(); sunColor = 0xfff2d6;
    }
    fogTarget.color = new T.Color(col);
    fogTarget.density = den;
    if (skyMat) {
      skyMat.uniforms.topColor.value.set(top);
      skyMat.uniforms.midColor.value.set(mid);
      skyMat.uniforms.botColor.value.set(bot);
      skyMat.uniforms.sunK.value = sunK;
      skyMat.uniforms.sunDir.value.copy(sunPos);
      skyMat.uniforms.sunColor.value.set(sunColor);
    }
    if (sunSprite) {
      sunSprite.material.opacity = s === 2 ? 0.18 : s === 1 ? 0.4 : 0.85;
      sunSprite.position.copy(sunPos).multiplyScalar(300);
    }
    if (instant) {
      fog.color.copy(fogTarget.color);
      fog.density = fogTarget.density;
    }
    if (W.sun) {
      W.sun.intensity = [1.75, 0.95, 0.42, 2.1][s] || 1.4;
      W.sun.color.set(sunColor);
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
      waterMesh.material.roughness = 0.14 + Math.sin(clockT * 0.8) * 0.03;
    }

    // 草风
    var gm = grassMesh && grassMesh.material.userData.shader;
    if (gm) gm.uniforms.uTime.value = clockT;

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
  W.FRAG_DEFS = FRAG_DEFS;
  W.fragments = fragments;
  W.colliders = colliders;
  W.scene = function () { return scene; };

  YH.World = W;
})(window.YH = window.YH || {});
