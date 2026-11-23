/* 余痕 · 回忆片（Canvas 2D 水彩动画，内置镜头序列，不提供跳过） */
(function (YH) {
  'use strict';

  var TAU = Math.PI * 2;
  var F = {};

  var cvs, ctx, W, H, dpr, running = false;

  var PAL = {
    warm: { sky: ['#f8ecd5', '#f0d9b8', '#c6a982'], ground: '#bea885', ink: '#42342a', glow: '#fff6e2', mist: '#f4e8d2' },
    gray: { sky: ['#d2d3ce', '#b6b8b5', '#8d938f'], ground: '#989b93', ink: '#35393a', glow: '#eef0ea', mist: '#c7c9c3' },
    cold: { sky: ['#b1bcc4', '#8f9ba5', '#6a7782'], ground: '#828a92', ink: '#262d33', glow: '#e1e9ec', mist: '#a9b4bc' },
    dark: { sky: ['#7f7568', '#5e564d', '#3d3832'], ground: '#544b42', ink: '#1c1916', glow: '#c3b193', mist: '#6b6257' },
    truth: { sky: ['#918476', '#6c6156', '#453e37'], ground: '#584e44', ink: '#191614', glow: '#d7c3a3', mist: '#7a7064' }
  };

  function mulberry32(a) {
    return function () {
      a |= 0; a = a + 0x6D2B79F5 | 0;
      var t = Math.imul(a ^ a >>> 15, 1 | a);
      t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  }
  function rr(rand, a, b) { return a + rand() * (b - a); }
  function lerp(a, b, t) { return a + (b - a) * t; }
  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  function ease(t) { return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2; }
  function hexA(hex, a) {
    var c = hex.replace('#', '');
    if (c.length === 3) c = c[0] + c[0] + c[1] + c[1] + c[2] + c[2];
    var n = parseInt(c, 16);
    return 'rgba(' + (n >> 16 & 255) + ',' + (n >> 8 & 255) + ',' + (n & 255) + ',' + a + ')';
  }
  function shade(hex, amt) {
    var c = hex.replace('#', '');
    if (c.length === 3) c = c[0] + c[0] + c[1] + c[1] + c[2] + c[2];
    var n = parseInt(c, 16);
    return 'rgb(' + (clamp((n >> 16 & 255) * (1 + amt), 0, 255) | 0) + ',' +
      (clamp((n >> 8 & 255) * (1 + amt), 0, 255) | 0) + ',' +
      (clamp((n & 255) * (1 + amt), 0, 255) | 0) + ')';
  }

  /* ---------------- 纸与底 ---------------- */

  var paperTile = null;
  function paper() {
    if (paperTile) return paperTile;
    var c = document.createElement('canvas');
    c.width = c.height = 512;
    var g = c.getContext('2d');
    g.fillStyle = '#ffffff';
    g.fillRect(0, 0, 512, 512);
    // 纸纤维
    for (var i = 0; i < 900; i++) {
      g.strokeStyle = 'rgba(120,104,84,' + (0.02 + Math.random() * 0.06) + ')';
      g.lineWidth = 0.6 + Math.random() * 1.6;
      var x = Math.random() * 512, y = Math.random() * 512, L = 6 + Math.random() * 40;
      g.beginPath();
      g.moveTo(x, y);
      g.lineTo(x + L, y + (Math.random() - 0.5) * 3);
      g.stroke();
    }
    // 颗粒
    var img = g.getImageData(0, 0, 512, 512);
    for (var p = 0; p < img.data.length; p += 4) {
      var n = (Math.random() - 0.5) * 26;
      img.data[p] += n; img.data[p + 1] += n; img.data[p + 2] += n;
    }
    g.putImageData(img, 0, 0);
    paperTile = c;
    return c;
  }

  function paperOverlay(g, w, h, alpha) {
    var t = paper();
    g.save();
    g.globalCompositeOperation = 'multiply';
    g.globalAlpha = alpha == null ? 0.10 : alpha;
    var scale = Math.max(w / 512, h / 512) * 1.02;
    g.drawImage(t, 0, 0, 512 * scale, 512 * scale);
    g.restore();
  }

  function wash(g, w, h, pal, rand, strength) {
    strength = strength == null ? 1 : strength;
    var grd = g.createLinearGradient(0, 0, w * 0.12, h);
    grd.addColorStop(0, pal.sky[0]);
    grd.addColorStop(0.5, pal.sky[1]);
    grd.addColorStop(1, pal.sky[2]);
    g.fillStyle = grd;
    g.fillRect(0, 0, w, h);

    g.globalCompositeOperation = 'screen';
    for (var i = 0; i < 8; i++) {
      var cx = rr(rand, -0.15, 1.15) * w;
      var cy = rr(rand, -0.15, 0.95) * h;
      var r = rr(rand, 0.14, 0.52) * w;
      var rg = g.createRadialGradient(cx, cy, 0, cx, cy, r);
      rg.addColorStop(0, 'rgba(255,252,244,' + (0.18 * strength) + ')');
      rg.addColorStop(0.6, 'rgba(255,252,244,' + (0.06 * strength) + ')');
      rg.addColorStop(1, 'rgba(255,252,244,0)');
      g.fillStyle = rg;
      g.beginPath(); g.arc(cx, cy, r, 0, TAU); g.fill();
    }
    g.globalCompositeOperation = 'multiply';
    var nDark = strength < 0.6 ? 3 : 6;
    for (var j = 0; j < nDark; j++) {
      var x2 = rr(rand, -0.15, 1.15) * w;
      var y2 = rr(rand, 0.2, 1.15) * h;
      var r2 = rr(rand, 0.16, 0.5) * w;
      var rg2 = g.createRadialGradient(x2, y2, 0, x2, y2, r2);
      rg2.addColorStop(0, 'rgba(116,100,82,' + (0.11 * strength) + ')');
      rg2.addColorStop(1, 'rgba(116,100,82,0)');
      g.fillStyle = rg2;
      g.beginPath(); g.arc(x2, y2, r2, 0, TAU); g.fill();
    }
    g.globalCompositeOperation = 'source-over';
  }

  function groundPlane(g, w, h, hy, pal, rand, opts) {
    opts = opts || {};
    var mistA = opts.mistAlpha == null ? 0.5 : opts.mistAlpha;
    var grd = g.createLinearGradient(0, hy - h * 0.04, 0, h);
    grd.addColorStop(0, hexA(pal.mist, 0));
    grd.addColorStop(0.10, hexA(pal.mist, mistA));
    grd.addColorStop(0.30, pal.ground);
    grd.addColorStop(1, shade(pal.ground, -0.34));
    g.fillStyle = grd;
    g.fillRect(0, hy - h * 0.05, w, h - hy + h * 0.05);

    if (opts.tint) {
      var ta = opts.tintAlpha == null ? 0.34 : opts.tintAlpha;
      var tg = g.createLinearGradient(0, hy, 0, h);
      tg.addColorStop(0, hexA(opts.tint, 0));
      tg.addColorStop(0.22, hexA(opts.tint, ta * 0.75));
      tg.addColorStop(1, hexA(opts.tint, ta));
      g.save();
      g.globalCompositeOperation = 'overlay';
      g.fillStyle = tg;
      g.fillRect(0, hy, w, h - hy);
      g.restore();
      // 草丝
      g.save();
      g.globalCompositeOperation = 'multiply';
      g.globalAlpha = 0.10;
      g.strokeStyle = shade(opts.tint, -0.5);
      g.lineWidth = 1.2;
      for (var gi = 0; gi < 150; gi++) {
        var gy = hy + Math.pow(rand(), 0.7) * (h - hy);
        var gx = rand() * w;
        var gl = 4 + rand() * 14;
        g.beginPath();
        g.moveTo(gx, gy);
        g.lineTo(gx + rr(rand, -3, 3), gy - gl);
        g.stroke();
      }
      g.restore();
    }

    // 地面笔触
    g.save();
    g.globalAlpha = 0.12;
    g.strokeStyle = pal.ink;
    for (var i = 0; i < 18; i++) {
      g.lineWidth = rr(rand, 0.6, 2.4);
      var yy = rr(rand, hy + 0.03 * h, h);
      var x0 = rr(rand, -0.05, 0.9) * w;
      g.beginPath();
      g.moveTo(x0, yy);
      g.lineTo(x0 + rr(rand, 40, w * 0.3), yy + rr(rand, -6, 6));
      g.stroke();
    }
    g.restore();

    // 地平线湿边
    g.save();
    g.globalAlpha = 0.5;
    var mg = g.createLinearGradient(0, hy - h * 0.05, 0, hy + h * 0.08);
    mg.addColorStop(0, 'rgba(255,255,255,0)');
    mg.addColorStop(0.55, hexA(pal.mist, 0.75));
    mg.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = mg;
    g.fillRect(0, hy - h * 0.05, w, h * 0.14);
    g.restore();
  }

  // 远景树线，给画面纵深
  function treeline(g, w, h, yBase, pal, rand, opt) {
    opt = opt || {};
    var alpha = opt.alpha == null ? 0.22 : opt.alpha;
    var n = opt.n || 26;
    g.save();
    g.globalAlpha = alpha;
    g.fillStyle = pal.ink;
    g.strokeStyle = pal.ink;
    if (opt.blur) g.filter = 'blur(' + opt.blur + 'px)';
    for (var i = 0; i < n; i++) {
      var x = (i / n) * w + rr(rand, -8, 8);
      var hh = rr(rand, 0.02, 0.075) * h;
      var tw = rr(rand, 1, 2.4);
      g.lineWidth = tw;
      g.beginPath();
      g.moveTo(x, yBase);
      g.lineTo(x + rr(rand, -3, 3), yBase - hh * 0.66);
      g.stroke();
      // 稀疏枝
      for (var b = 0; b < 3; b++) {
        g.beginPath();
        g.moveTo(x, yBase - hh * (0.4 + b * 0.16));
        g.lineTo(x + rr(rand, -hh * 0.3, hh * 0.3), yBase - hh * (0.6 + b * 0.14));
        g.lineWidth = tw * 0.6;
        g.stroke();
      }
      // 远处树冠团（只在有叶的场景）
      if (opt.leaf) {
        g.beginPath();
        g.ellipse(x + rr(rand, -4, 4), yBase - hh * 0.78, hh * 0.32, hh * 0.2, 0, 0, TAU);
        g.fill();
      }
    }
    g.restore();
    g.filter = 'none';
  }


  // 中景的枯树，给近处纵深
  function midTree(g, x, baseY, hh, rand, alpha) {
    g.save();
    g.globalAlpha = alpha == null ? 0.42 : alpha;
    g.strokeStyle = '#2b2620';
    g.fillStyle = '#2b2620';
    g.lineCap = 'round';

    function limb(x0, y0, dx, dy, len, w, depth) {
      var x1 = x0 + dx * len, y1 = y0 + dy * len;
      g.lineWidth = Math.max(0.7, w);
      g.beginPath();
      g.moveTo(x0, y0);
      g.quadraticCurveTo((x0 + x1) / 2 + dx * len * 0.08, (y0 + y1) / 2, x1, y1);
      g.stroke();
      if (depth <= 0) return;
      var n = 2 + (rand() > 0.6 ? 1 : 0);
      for (var i = 0; i < n; i++) {
        var ndx = dx * 0.4 + (rand() - 0.5) * 0.9;
        var ndy = dy * 0.55 - 0.35 - rand() * 0.3;
        var m = Math.hypot(ndx, ndy) || 1;
        limb(x1, y1, ndx / m, ndy / m, len * (0.52 + rand() * 0.2), w * 0.58, depth - 1);
      }
    }

    // 主干
    g.lineWidth = Math.max(1.6, hh * 0.034);
    g.beginPath();
    g.moveTo(x, baseY);
    g.quadraticCurveTo(x + hh * 0.03, baseY - hh * 0.5, x + hh * 0.01, baseY - hh * 0.75);
    g.stroke();
    for (var b = 0; b < 4; b++) {
      var t = 0.45 + b * 0.13;
      var dir = b % 2 ? 1 : -1;
      limb(x + hh * 0.02, baseY - hh * t, dir * 0.85, -0.55, hh * (0.16 + rand() * 0.12), hh * 0.018, 2);
    }
    limb(x + hh * 0.01, baseY - hh * 0.75, 0.05, -0.95, hh * 0.12, hh * 0.015, 2);
    g.restore();
  }

  /* ---------------- 人物 ---------------- */

  function person(g, x, footY, hh, phase, o) {
    o = o || {};
    var ink = o.ink || '#3c3128';
    var sit = !!o.sit;
    var swing = o.still ? 0 : Math.sin(phase);
    var bob = o.still ? 0 : Math.abs(Math.cos(phase)) * hh * 0.011;
    var headR = hh * 0.056;
    var headCY = footY - hh * (sit ? 0.685 : 0.888);
    var shY = footY - hh * (sit ? 0.545 : 0.795);
    var waistY = footY - hh * (sit ? 0.30 : 0.605);
    var hemY = footY - hh * (sit ? 0.055 : 0.450);
    var shHalf = hh * 0.086;
    var waistHalf = hh * 0.066;
    var hemHalf = hh * 0.094;
    var stride = hh * 0.088 * swing;

    g.save();
    g.translate(x, -bob);
    g.fillStyle = ink;
    g.strokeStyle = ink;
    g.lineCap = 'round';
    g.lineJoin = 'round';
    if (o.alpha != null) g.globalAlpha = o.alpha;

    // ---- 腿 ----
    if (sit) {
      var shinY = footY + hh * 0.30;
      g.lineWidth = hh * 0.055;
      g.beginPath();
      g.moveTo(-hh * 0.035, hemY); g.lineTo(hh * 0.125, hemY + hh * 0.012); g.lineTo(hh * 0.135, shinY);
      g.moveTo(-hh * 0.012, hemY); g.lineTo(hh * 0.045, hemY + hh * 0.015); g.lineTo(hh * 0.012, shinY);
      g.stroke();
    } else {
      g.lineWidth = hh * 0.078;
      g.beginPath();
      g.moveTo(-hh * 0.032, hemY);
      g.lineTo(-hh * 0.038 + stride * 0.5, footY - hh * 0.21);
      g.lineTo(-hh * 0.048 + stride, footY - hh * 0.022);
      g.stroke();
      g.beginPath();
      g.moveTo(hh * 0.032, hemY);
      g.lineTo(hh * 0.038 - stride * 0.5, footY - hh * 0.21);
      g.lineTo(hh * 0.048 - stride, footY - hh * 0.022);
      g.stroke();
      g.lineWidth = hh * 0.036;
      g.beginPath();
      g.moveTo(-hh * 0.048 + stride, footY - hh * 0.022);
      g.lineTo(-hh * 0.048 + stride + hh * 0.055, footY - hh * 0.002);
      g.moveTo(hh * 0.048 - stride, footY - hh * 0.022);
      g.lineTo(hh * 0.048 - stride + hh * 0.055, footY - hh * 0.002);
      g.stroke();
    }

    // ---- 外套（收腰，下摆微散）----
    g.beginPath();
    g.moveTo(-shHalf, shY + hh * 0.012);
    g.bezierCurveTo(-shHalf * 1.06, shY + (waistY - shY) * 0.42, -waistHalf * 1.05, waistY - hh * 0.03, -waistHalf, waistY);
    g.bezierCurveTo(-waistHalf * 1.16, waistY + (hemY - waistY) * 0.5, -hemHalf * 0.98, hemY - hh * 0.05, -hemHalf, hemY);
    g.quadraticCurveTo(0, hemY + hh * 0.014, hemHalf, hemY);
    g.bezierCurveTo(hemHalf * 0.98, hemY - hh * 0.05, waistHalf * 1.16, waistY + (hemY - waistY) * 0.5, waistHalf, waistY);
    g.bezierCurveTo(waistHalf * 1.05, waistY - hh * 0.03, shHalf * 1.06, shY + (waistY - shY) * 0.42, shHalf, shY + hh * 0.012);
    g.quadraticCurveTo(0, shY - hh * 0.028, -shHalf, shY + hh * 0.012);
    g.closePath();
    g.fill();

    // ---- 手臂 ----
    var armSw = o.still ? 0 : swing * 0.5;
    g.lineWidth = hh * 0.038;
    g.beginPath();
    g.moveTo(-shHalf * 0.88, shY + hh * 0.028);
    g.quadraticCurveTo(-shHalf * 1.14, shY + hh * 0.16, -shHalf * 0.96 + armSw, shY + hh * 0.285);
    g.stroke();

    g.beginPath();
    g.moveTo(shHalf * 0.88, shY + hh * 0.028);
    if (o.gesture === 'reach') {
      g.quadraticCurveTo(shHalf * 1.55, shY + hh * 0.08, shHalf * 1.86, shY + hh * 0.175);
    } else if (o.gesture === 'hand') {
      g.quadraticCurveTo(shHalf * 1.45, shY + hh * 0.02, shHalf * 1.6, shY - hh * 0.06);
    } else if (o.gesture === 'hold') {
      g.quadraticCurveTo(shHalf * 1.35, shY + hh * 0.17, shHalf * 1.22, shY + hh * 0.245);
    } else {
      g.quadraticCurveTo(shHalf * 1.12, shY + hh * 0.16, shHalf * 0.96 - armSw, shY + hh * 0.285);
    }
    g.stroke();

    // ---- 颈 ----
    g.lineWidth = hh * 0.040;
    g.beginPath(); g.moveTo(0, shY + hh * 0.008); g.lineTo(0, headCY + headR * 0.62); g.stroke();

    // ---- 长发（后层）----
    if (o.hair === 'long') {
      g.beginPath();
      g.moveTo(-headR * 0.9, headCY - headR * 0.5);
      g.quadraticCurveTo(-headR * 1.45, headCY + headR * 1.7, -headR * 0.58, shY + hh * 0.012);
      g.lineTo(headR * 0.34, shY + hh * 0.008);
      g.quadraticCurveTo(-headR * 0.02, headCY + headR * 1.0, headR * 0.8, headCY - headR * 0.45);
      g.closePath();
      g.fill();
    }

    // ---- 头 ----
    g.beginPath();
    g.arc(0, headCY, headR, 0, TAU);
    g.fill();

    g.restore();
  }

  function dust(g, w, h, t, rand, color, n) {
    g.save();
    for (var i = 0; i < (n || 26); i++) {
      var bx = rand() * w;
      var by = rand() * h;
      var sp = 3 + rand() * 12;
      var x = (bx + t * sp) % (w + 40) - 20;
      var y = by + Math.sin(t * 0.7 + i) * 14;
      var r = 0.6 + rand() * 1.8;
      g.globalAlpha = 0.12 + rand() * 0.22;
      g.fillStyle = color || '#fff8e8';
      g.beginPath(); g.arc(x, y, r, 0, TAU); g.fill();
    }
    g.restore();
  }

  function rain(g, w, h, t, alpha, ink) {
    g.save();
    g.strokeStyle = ink || 'rgba(220,230,235,.5)';
    g.globalAlpha = alpha == null ? 0.3 : alpha;
    g.lineWidth = 1;
    for (var i = 0; i < 90; i++) {
      var x = (i * 97.3 + t * 60) % (w + 100) - 50;
      var y = (i * 53.7 + t * 620) % (h + 120) - 60;
      g.beginPath();
      g.moveTo(x, y);
      g.lineTo(x - 4, y + 20 + (i % 5) * 4);
      g.stroke();
    }
    g.restore();
  }

  var grainTile = null;
  function grain(g, w, h, amt) {
    if (!grainTile) {
      var c = document.createElement('canvas');
      c.width = c.height = 240;
      var cg = c.getContext('2d');
      var img = cg.createImageData(240, 240);
      for (var i = 0; i < img.data.length; i += 4) {
        var v = 120 + Math.random() * 135;
        img.data[i] = img.data[i + 1] = img.data[i + 2] = v;
        img.data[i + 3] = Math.random() * 38;
      }
      cg.putImageData(img, 0, 0);
      grainTile = c;
    }
    g.save();
    g.globalCompositeOperation = 'overlay';
    g.globalAlpha = amt == null ? 0.2 : amt;
    for (var y = 0; y < h; y += 240) {
      for (var x = 0; x < w; x += 240) {
        g.drawImage(grainTile, x + Math.random() * 6, y + Math.random() * 6, 240, 240);
      }
    }
    g.restore();
  }

  function vignette(g, w, h, amt) {
    var rg = g.createRadialGradient(w * 0.5, h * 0.46, h * 0.30, w * 0.5, h * 0.5, h * 0.98);
    rg.addColorStop(0, 'rgba(0,0,0,0)');
    rg.addColorStop(0.68, 'rgba(0,0,0,' + (0.16 * (amt || 1)) + ')');
    rg.addColorStop(1, 'rgba(0,0,0,' + (0.52 * (amt || 1)) + ')');
    g.fillStyle = rg;
    g.fillRect(0, 0, w, h);
  }

  /* ---------------- 场景 ---------------- */

  var SCENES = {};

  SCENES.walk = function (g, w, h, p, t, o) {
    var pal = o.pal, rand = o.rand, hy = h * 0.645;
    wash(g, w, h, pal, rand);
    treeline(g, w, h, hy + 2, pal, rand, { alpha: 0.13, n: 24, blur: 1.4 });
    groundPlane(g, w, h, hy, pal, rand, { mistAlpha: 0.4, tint: '#8d9a5f', tintAlpha: 0.4 });
    midTree(g, w * 0.15, hy + h * 0.02, h * 0.30, rand, 0.30);
    midTree(g, w * 0.85, hy + h * 0.03, h * 0.24, rand, 0.24);

    // 远处小路（压得很淡，避免出现三角楔形）
    g.save();
    g.globalAlpha = 0.16;
    g.fillStyle = shade(pal.ground, -0.12);
    g.beginPath();
    g.moveTo(w * 0.47, hy + 2);
    g.lineTo(w * 0.53, hy + 2);
    g.lineTo(w * 0.80, h);
    g.lineTo(w * 0.20, h);
    g.closePath();
    g.fill();
    g.restore();

    // 逆光
    g.save();
    g.globalCompositeOperation = 'screen';
    var sg = g.createRadialGradient(w * 0.54, hy - h * 0.10, 0, w * 0.54, hy - h * 0.10, h * 0.52);
    sg.addColorStop(0, hexA(pal.glow, 0.55));
    sg.addColorStop(0.4, hexA(pal.glow, 0.2));
    sg.addColorStop(1, hexA(pal.glow, 0));
    g.fillStyle = sg;
    g.fillRect(0, 0, w, h);
    g.restore();

    var base = w * 0.28 + p * w * 0.18;
    var s = h * 0.36;
    g.save();
    g.globalAlpha = 0.18;
    g.fillStyle = pal.ink;
    g.beginPath(); g.ellipse(base + w * 0.03, h * 0.925, s * 0.42, s * 0.045, 0, 0, TAU); g.fill();
    g.beginPath(); g.ellipse(base + w * 0.03 + s * 0.40, h * 0.925, s * 0.36, s * 0.04, 0, 0, TAU); g.fill();
    g.restore();

    var ph = t * 4.2;
    person(g, base, h * 0.925, s, ph, { ink: pal.ink, hair: 'long' });
    person(g, base + s * 0.40, h * 0.923, s * 0.97, ph + 0.55, { ink: pal.ink, gesture: 'hand' });
    dust(g, w, h, t, rand, pal.glow, 22);
  };

  SCENES.talk = function (g, w, h, p, t, o) {
    var pal = o.pal, rand = o.rand, hy = h * 0.665;
    wash(g, w, h, pal, rand);
    treeline(g, w, h, hy + 2, pal, rand, { alpha: 0.15, n: 24, blur: 1.6 });
    groundPlane(g, w, h, hy, pal, rand, { mistAlpha: 0.3, tint: '#8b9763', tintAlpha: 0.34 });
    midTree(g, w * 0.90, hy + h * 0.02, h * 0.26, rand, 0.26);

    g.save();
    g.globalCompositeOperation = 'screen';
    var rg = g.createRadialGradient(w * 0.5, h * 0.60, 0, w * 0.5, h * 0.60, h * 0.46);
    rg.addColorStop(0, hexA(pal.glow, 0.32));
    rg.addColorStop(1, hexA(pal.glow, 0));
    g.fillStyle = rg; g.fillRect(0, 0, w, h);
    g.restore();

    var s = h * 0.40, cx = w * 0.5, gap = s * 0.46;
    person(g, cx - gap, h * 0.925, s, 0, { ink: pal.ink, still: true, hair: 'long', gesture: 'reach' });
    person(g, cx + gap, h * 0.925, s * 0.98, 0, { ink: pal.ink, still: true, gesture: 'hold' });
    dust(g, w, h, t, rand, pal.glow, 26);
  };

  SCENES.sit = function (g, w, h, p, t, o) {
    var pal = o.pal, rand = o.rand, hy = h * 0.56;
    wash(g, w, h, pal, rand);
    treeline(g, w, h, hy + 4, pal, rand, { alpha: 0.12, n: 22, blur: 1.5, leaf: true });
    groundPlane(g, w, h, hy, pal, rand, { mistAlpha: 0.3, tint: '#8c9663', tintAlpha: 0.32 });

    var by = h * 0.795;
    g.save();
    g.strokeStyle = shade(pal.ink, 0.3);
    g.globalAlpha = 0.85;
    g.lineWidth = h * 0.014;
    g.beginPath(); g.moveTo(w * 0.20, by); g.lineTo(w * 0.80, by); g.stroke();
    g.lineWidth = h * 0.008;
    g.beginPath(); g.moveTo(w * 0.20, by + h * 0.075); g.lineTo(w * 0.80, by + h * 0.075); g.stroke();
    for (var i = 0; i < 4; i++) {
      var lx = w * (0.23 + i * 0.18);
      g.beginPath(); g.moveTo(lx, by + h * 0.005); g.lineTo(lx, by + h * 0.10); g.stroke();
    }
    g.restore();

    var s = h * 0.34;
    person(g, w * 0.42, by + h * 0.01, s, 0, { ink: pal.ink, sit: true, alpha: 0.97, hair: 'long' });
    person(g, w * 0.575, by + h * 0.01, s * 0.96, 0, { ink: pal.ink, sit: true, alpha: 0.97 });
    // 桌面上的一只杯子
    g.save();
    g.globalAlpha = 0.5;
    g.fillStyle = pal.ink;
    g.fillRect(w * 0.505, by - h * 0.024, h * 0.016, h * 0.026);
    g.restore();
    dust(g, w, h, t, rand, pal.glow, 18);
  };

  SCENES.apart = function (g, w, h, p, t, o) {
    var pal = o.pal, rand = o.rand, hy = h * 0.665;
    wash(g, w, h, pal, rand, 0.85);
    treeline(g, w, h, hy + 2, pal, rand, { alpha: 0.14, n: 20, blur: 1.6 });
    groundPlane(g, w, h, hy, pal, rand, { mistAlpha: 0.58, tint: '#7d8676', tintAlpha: 0.26 });

    var s = h * 0.34;
    var drift = (1 - p) * w * 0.008;
    person(g, w * 0.26 - drift, h * 0.925, s, 0, { ink: pal.ink, still: true, alpha: 0.82 });
    person(g, w * 0.74 + drift, h * 0.923, s, 0, { ink: pal.ink, still: true, alpha: 0.55, hair: 'long' });

    g.save();
    var mg = g.createLinearGradient(w * 0.26, 0, w * 0.74, 0);
    mg.addColorStop(0, hexA(pal.mist, 0));
    mg.addColorStop(0.5, hexA(pal.mist, 0.55));
    mg.addColorStop(1, hexA(pal.mist, 0));
    g.fillStyle = mg;
    g.fillRect(0, h * 0.42, w, h * 0.56);
    g.restore();

    // 断开的地面线
    g.save();
    g.globalAlpha = 0.22;
    g.strokeStyle = pal.ink;
    g.lineWidth = 1.2;
    g.beginPath();
    g.moveTo(w * 0.34, hy + 2); g.lineTo(w * 0.47, hy + 2);
    g.moveTo(w * 0.55, hy + 2); g.lineTo(w * 0.66, hy + 2);
    g.stroke();
    g.restore();
  };

  SCENES.argue = function (g, w, h, p, t, o) {
    var pal = o.pal, rand = o.rand, hy = h * 0.62;
    wash(g, w, h, pal, rand, 0.55);
    treeline(g, w, h, hy + 2, pal, rand, { alpha: 0.2, n: 18, blur: 2 });
    groundPlane(g, w, h, hy, pal, rand, { mistAlpha: 0.16, tint: '#5d5a48', tintAlpha: 0.3 });

    var jitter = Math.sin(t * 24) * 2.0 + Math.sin(t * 10.7) * 1.3;
    var s = h * 0.46, cx = w * 0.5;
    g.save();
    g.globalAlpha = 0.2;
    g.fillStyle = pal.ink;
    g.beginPath(); g.ellipse(cx, h * 0.945, s * 0.5, s * 0.03, 0, 0, TAU); g.fill();
    g.restore();
    person(g, cx - h * 0.115 + jitter, h * 0.945, s, 0, { ink: pal.ink, still: true, gesture: 'reach' });
    person(g, cx + h * 0.125 - jitter, h * 0.943, s * 0.95, 0, { ink: pal.ink, still: true });

    g.save();
    var rg = g.createRadialGradient(cx, h * 0.44, h * 0.10, cx, h * 0.5, h * 0.86);
    rg.addColorStop(0, 'rgba(0,0,0,0)');
    rg.addColorStop(1, 'rgba(10,8,6,.62)');
    g.fillStyle = rg; g.fillRect(0, 0, w, h);
    g.restore();
  };

  SCENES.leave = function (g, w, h, p, t, o) {
    var pal = o.pal, rand = o.rand, hy = h * 0.65;
    wash(g, w, h, pal, rand);
    treeline(g, w, h, hy + 2, pal, rand, { alpha: 0.15, n: 22, blur: 1.6 });
    groundPlane(g, w, h, hy, pal, rand, { mistAlpha: 0.4, tint: '#78826a', tintAlpha: 0.3 });

    var s = h * 0.34;
    person(g, w * 0.34, h * 0.925, s, t * 3.0, { ink: pal.ink, hair: 'long' });
    var k = ease(clamp(p * 1.15, 0, 1));
    var sc = lerp(s * 0.98, s * 0.26, k);
    var yy = lerp(h * 0.923, hy + h * 0.012, k);
    person(g, lerp(w * 0.45, w * 0.60, k), yy, sc, t * 3.5, { ink: pal.ink, alpha: 1 - k * 0.5 });

    g.save();
    var mg = g.createLinearGradient(0, hy - h * 0.05, 0, h * 0.74);
    mg.addColorStop(0, hexA(pal.mist, 0.9 * k));
    mg.addColorStop(1, hexA(pal.mist, 0));
    g.fillStyle = mg; g.fillRect(0, 0, w, h);
    g.restore();
  };

  SCENES.alone = function (g, w, h, p, t, o) {
    var pal = o.pal, rand = o.rand, hy = h * 0.685;
    wash(g, w, h, pal, rand, 0.75);
    treeline(g, w, h, hy + 2, pal, rand, { alpha: 0.18, n: 16, blur: 2.2 });
    groundPlane(g, w, h, hy, pal, rand, { mistAlpha: 0.32, tint: '#6f7c6c', tintAlpha: 0.26 });
    person(g, w * 0.5, h * 0.93, h * 0.38, 0, { ink: pal.ink, still: true, hair: 'long' });
    if (o.mood === 'cold' || o.mood === 'gray') rain(g, w, h, t, 0.16, hexA(pal.glow, 0.55));
    g.save();
    g.globalAlpha = 0.16;
    g.strokeStyle = pal.ink;
    g.lineWidth = 1;
    for (var i = 0; i < 6; i++) {
      var x = w * (0.1 + i * 0.16);
      g.beginPath();
      g.moveTo(x, h * 0.74 + Math.sin(t + i) * 8);
      g.lineTo(x + 46, h * 0.71 + Math.sin(t + i) * 12);
      g.stroke();
    }
    g.restore();
  };

  SCENES.window = function (g, w, h, p, t, o) {
    var pal = o.pal, rand = o.rand;
    g.fillStyle = shade(pal.ink, 0.05);
    g.fillRect(0, 0, w, h);
    var wx = w * 0.33, wy = h * 0.15, ww = w * 0.44, wh = h * 0.58;
    var gd = g.createLinearGradient(wx, wy, wx + ww, wy + wh);
    gd.addColorStop(0, hexA(pal.glow, 0.98));
    gd.addColorStop(0.55, hexA(pal.mist, 0.8));
    gd.addColorStop(1, hexA(pal.sky[2], 0.7));
    g.fillStyle = gd;
    g.fillRect(wx, wy, ww, wh);
    // 窗外的树影
    g.save();
    g.globalAlpha = 0.18;
    g.fillStyle = pal.ink;
    g.beginPath(); g.ellipse(wx + ww * 0.3, wy + wh * 0.55, ww * 0.16, wh * 0.2, 0, 0, TAU); g.fill();
    g.restore();
    // 窗框
    g.strokeStyle = shade(pal.ink, -0.25);
    g.lineWidth = h * 0.016;
    g.strokeRect(wx, wy, ww, wh);
    g.lineWidth = h * 0.008;
    g.beginPath();
    g.moveTo(wx + ww / 2, wy); g.lineTo(wx + ww / 2, wy + wh);
    g.moveTo(wx, wy + wh * 0.45); g.lineTo(wx + ww, wy + wh * 0.45);
    g.stroke();
    // 窗帘
    g.save();
    g.globalAlpha = 0.9;
    g.fillStyle = shade(pal.ink, 0.14);
    g.beginPath();
    g.moveTo(wx - w * 0.06, wy - h * 0.03);
    g.quadraticCurveTo(wx + ww * 0.09, wy + wh * 0.42, wx - w * 0.02, wy + wh + h * 0.04);
    g.lineTo(wx - w * 0.10, wy + wh + h * 0.04);
    g.lineTo(wx - w * 0.10, wy - h * 0.03);
    g.closePath(); g.fill();
    g.restore();
    // 窗前人影
    person(g, w * 0.71, h * 0.88, h * 0.44, 0, { ink: shade(pal.ink, -0.5), still: true, hair: 'long', alpha: 0.92 });
    // 光柱
    g.save();
    g.globalCompositeOperation = 'screen';
    g.globalAlpha = 0.18;
    g.fillStyle = hexA(pal.glow, 0.9);
    g.beginPath();
    g.moveTo(wx, wy); g.lineTo(wx + ww, wy);
    g.lineTo(wx + ww + w * 0.13, h); g.lineTo(wx - w * 0.11, h);
    g.closePath(); g.fill();
    g.restore();
    dust(g, w, h, t, rand, pal.glow, 34);
  };

  SCENES.letter = function (g, w, h, p, t, o) {
    var pal = o.pal, rand = o.rand;
    g.fillStyle = shade(pal.ink, 0.08);
    g.fillRect(0, 0, w, h);
    g.save();
    g.translate(w * 0.5, h * 0.5);
    g.rotate(-0.032);
    var pw = w * 0.56, ph = h * 0.74;
    g.shadowColor = 'rgba(0,0,0,.55)';
    g.shadowBlur = 48;
    g.fillStyle = '#efe6d2';
    g.fillRect(-pw / 2, -ph / 2, pw, ph);
    g.shadowBlur = 0;
    g.globalAlpha = 0.06;
    for (var i = 0; i < 26; i++) {
      g.strokeStyle = '#8a7a63';
      g.lineWidth = 1;
      var yy = -ph / 2 + i * ph / 26;
      g.beginPath();
      g.moveTo(-pw / 2, yy); g.lineTo(pw / 2, yy + rr(rand, -3, 3));
      g.stroke();
    }
    g.globalAlpha = 1;
    // 手写字迹
    g.strokeStyle = 'rgba(52,42,35,.75)';
    g.lineCap = 'round';
    for (var l = 0; l < 10; l++) {
      var appear = clamp((p * 1.6 - l * 0.1) * 4, 0, 1);
      if (appear <= 0) continue;
      var ly = -ph / 2 + ph * 0.12 + l * ph * 0.075;
      var len = pw * 0.70 * appear;
      var lx = -pw / 2 + pw * 0.10;
      g.lineWidth = 2 + (l % 3) * 0.4;
      g.beginPath();
      var steps = 22, first = true;
      for (var s2 = 0; s2 <= steps * appear; s2++) {
        var xx = lx + len * s2 / steps;
        var yoff = Math.sin(s2 * 2.1 + l) * 2 + Math.sin(s2 * 0.53 + l * 2) * 1.4;
        if (first) { g.moveTo(xx, ly + yoff); first = false; } else g.lineTo(xx, ly + yoff);
      }
      g.stroke();
    }
    g.restore();
    // 墨渍
    g.save();
    g.globalCompositeOperation = 'multiply';
    g.globalAlpha = 0.3;
    var rg = g.createRadialGradient(w * 0.70, h * 0.33, 2, w * 0.70, h * 0.33, h * 0.10);
    rg.addColorStop(0, 'rgba(88,72,54,.75)');
    rg.addColorStop(1, 'rgba(88,72,54,0)');
    g.fillStyle = rg; g.beginPath(); g.arc(w * 0.70, h * 0.33, h * 0.10, 0, TAU); g.fill();
    g.restore();
  };

  SCENES.object = function (g, w, h, p, t, o) {
    var pal = o.pal, rand = o.rand;
    wash(g, w, h, pal, rand, 0.75);
    var hy = h * 0.70;
    var gd = g.createLinearGradient(0, hy, 0, h);
    gd.addColorStop(0, shade(pal.ground, 0.02));
    gd.addColorStop(1, shade(pal.ground, -0.46));
    g.fillStyle = gd;
    g.fillRect(0, hy, w, h - hy);
    g.save();
    g.globalCompositeOperation = 'screen';
    var rg = g.createRadialGradient(w * 0.5, h * 0.56, 0, w * 0.5, h * 0.56, h * 0.46);
    rg.addColorStop(0, hexA(pal.glow, 0.5));
    rg.addColorStop(1, hexA(pal.glow, 0));
    g.fillStyle = rg; g.fillRect(0, 0, w, h);
    g.restore();
    drawObject(g, w * 0.5, h * 0.60, h * 0.20, pal.ink, o.shape, t);
    g.save();
    g.globalAlpha = 0.26;
    g.fillStyle = pal.ink;
    g.beginPath(); g.ellipse(w * 0.5, h * 0.735, h * 0.15, h * 0.022, 0, 0, TAU); g.fill();
    g.restore();
    dust(g, w, h, t, rand, pal.glow, 36);
  };

  function drawObject(g, cx, cy, s, ink, shape, t) {
    g.save();
    g.translate(cx, cy);
    g.strokeStyle = ink;
    g.fillStyle = ink;
    g.lineCap = 'round';
    g.lineJoin = 'round';
    g.lineWidth = s * 0.10;
    g.rotate(Math.sin(t * 0.9) * 0.012);
    switch (shape) {
      case 'ring':
        g.lineWidth = s * 0.12;
        g.beginPath(); g.ellipse(0, 0, s * 0.72, s * 0.62, -0.25, 0, TAU); g.stroke();
        g.beginPath(); g.arc(-s * 0.62, -s * 0.05, s * 0.05, 0, TAU); g.fill();
        break;
      case 'note':
      case 'page':
        g.fillRect(-s * 0.66, -s * 0.72, s * 1.32, s * 1.44);
        g.save(); g.globalCompositeOperation = 'destination-out';
        g.lineWidth = s * 0.05;
        for (var i = 0; i < 5; i++) {
          g.beginPath(); g.moveTo(-s * 0.46, -s * 0.5 + i * s * 0.26);
          g.lineTo(s * 0.44, -s * 0.5 + i * s * 0.26); g.stroke();
        }
        g.restore();
        break;
      case 'cup':
        g.beginPath();
        g.moveTo(-s * 0.5, -s * 0.52);
        g.lineTo(-s * 0.40, s * 0.55);
        g.lineTo(s * 0.40, s * 0.55);
        g.lineTo(s * 0.5, -s * 0.52);
        g.closePath();
        g.stroke();
        g.lineWidth = s * 0.09;
        g.beginPath(); g.arc(s * 0.58, 0, s * 0.24, -1.2, 1.2); g.stroke();
        break;
      case 'bell':
        g.beginPath();
        g.moveTo(-s * 0.42, s * 0.34);
        g.quadraticCurveTo(-s * 0.34, -s * 0.42, 0, -s * 0.56);
        g.quadraticCurveTo(s * 0.34, -s * 0.42, s * 0.42, s * 0.34);
        g.closePath();
        g.fill();
        g.beginPath(); g.arc(0, s * 0.46, s * 0.13, 0, TAU); g.fill();
        break;
      case 'umbrella':
        g.lineWidth = s * 0.07;
        g.beginPath(); g.moveTo(0, -s * 0.2); g.lineTo(0, s * 0.72); g.stroke();
        g.beginPath(); g.arc(0, -s * 0.2, s * 0.66, Math.PI, TAU); g.lineWidth = s * 0.11; g.stroke();
        g.lineWidth = s * 0.05;
        g.beginPath(); g.arc(s * 0.3, -s * 0.20, s * 0.16, Math.PI, TAU); g.stroke();
        break;
      case 'watch':
        g.lineWidth = s * 0.08;
        g.beginPath(); g.arc(0, 0, s * 0.46, 0, TAU); g.stroke();
        g.beginPath(); g.moveTo(0, 0); g.lineTo(0, -s * 0.28); g.stroke();
        g.beginPath(); g.moveTo(0, 0); g.lineTo(s * 0.2, s * 0.08); g.stroke();
        g.lineWidth = s * 0.13;
        g.beginPath(); g.moveTo(0, -s * 0.46); g.lineTo(0, -s * 0.74); g.stroke();
        break;
      case 'key':
        g.lineWidth = s * 0.10;
        g.beginPath(); g.arc(-s * 0.30, 0, s * 0.24, 0, TAU); g.stroke();
        g.beginPath(); g.moveTo(-s * 0.06, 0); g.lineTo(s * 0.66, 0); g.stroke();
        g.beginPath(); g.moveTo(s * 0.44, 0); g.lineTo(s * 0.44, s * 0.26); g.stroke();
        g.beginPath(); g.moveTo(s * 0.60, 0); g.lineTo(s * 0.60, s * 0.18); g.stroke();
        break;
      case 'envelope':
        g.lineWidth = s * 0.06;
        g.strokeRect(-s * 0.70, -s * 0.44, s * 1.40, s * 0.88);
        g.beginPath();
        g.moveTo(-s * 0.70, -s * 0.44); g.lineTo(0, s * 0.06); g.lineTo(s * 0.70, -s * 0.44);
        g.stroke();
        break;
      case 'bird':
        g.beginPath();
        g.ellipse(0, s * 0.14, s * 0.42, s * 0.30, -0.2, 0, TAU);
        g.fill();
        g.beginPath(); g.arc(s * 0.30, -s * 0.18, s * 0.20, 0, TAU); g.fill();
        g.beginPath(); g.moveTo(s * 0.46, -s * 0.22); g.lineTo(s * 0.72, -s * 0.08); g.lineTo(s * 0.46, -s * 0.04); g.closePath(); g.fill();
        g.save(); g.globalCompositeOperation = 'destination-out';
        g.lineWidth = s * 0.045;
        g.beginPath(); g.moveTo(-s * 0.10, -s * 0.10); g.lineTo(s * 0.03, s * 0.1); g.lineTo(-s * 0.05, s * 0.34); g.stroke();
        g.restore();
        break;
      case 'ticket':
        g.lineWidth = s * 0.05;
        g.fillRect(-s * 0.86, -s * 0.40, s * 1.72, s * 0.80);
        g.save(); g.globalCompositeOperation = 'destination-out';
        g.fillRect(-s * 0.02, -s * 0.44, s * 0.06, s * 0.88);
        g.lineWidth = s * 0.05;
        for (var m = 0; m < 3; m++) {
          g.beginPath(); g.moveTo(-s * 0.68, -s * 0.2 + m * s * 0.18);
          g.lineTo(-s * 0.16, -s * 0.2 + m * s * 0.18); g.stroke();
        }
        g.restore();
        break;
      case 'camera':
        g.lineWidth = s * 0.07;
        g.strokeRect(-s * 0.66, -s * 0.34, s * 1.32, s * 0.72);
        g.beginPath(); g.arc(0, s * 0.04, s * 0.22, 0, TAU); g.stroke();
        g.beginPath(); g.moveTo(-s * 0.34, -s * 0.34); g.lineTo(-s * 0.28, -s * 0.54);
        g.lineTo(s * 0.02, -s * 0.54); g.lineTo(s * 0.08, -s * 0.34); g.stroke();
        break;
      case 'box':
        g.lineWidth = s * 0.06;
        g.strokeRect(-s * 0.62, -s * 0.22, s * 1.24, s * 0.52);
        g.beginPath();
        g.moveTo(-s * 0.62, -s * 0.22); g.lineTo(0, -s * 0.64); g.lineTo(s * 0.62, -s * 0.22);
        g.stroke();
        break;
      default:
        g.beginPath(); g.arc(0, 0, s * 0.4, 0, TAU); g.stroke();
    }
    g.restore();
  }

  SCENES.platform = function (g, w, h, p, t, o) {
    var pal = o.pal, rand = o.rand, hy = h * 0.575;
    wash(g, w, h, pal, rand, 0.7);
    treeline(g, w, h, hy + 2, pal, rand, { alpha: 0.14, n: 18, blur: 1.8 });
    groundPlane(g, w, h, hy, pal, rand, { mistAlpha: 0.3, tint: '#6b6b58', tintAlpha: 0.24 });

    // 站台面
    g.save();
    g.fillStyle = shade(pal.ground, 0.06);
    g.fillRect(0, h * 0.795, w, h * 0.205);
    g.globalAlpha = 0.4;
    g.strokeStyle = pal.ink;
    g.lineWidth = 2;
    g.beginPath(); g.moveTo(0, h * 0.795); g.lineTo(w, h * 0.795); g.stroke();
    g.globalAlpha = 0.2;
    for (var i = 0; i < 8; i++) {
      g.beginPath();
      g.moveTo(w, h * 0.60 + i * h * 0.02);
      g.lineTo(0, h * 0.66 + i * h * 0.03);
      g.stroke();
    }
    g.restore();

    // 列车掠过
    var pass = clamp((p - 0.32) / 0.32, 0, 1);
    if (pass > 0 && pass < 1) {
      g.save();
      g.globalCompositeOperation = 'screen';
      g.globalAlpha = 0.55 * Math.sin(pass * Math.PI);
      var lg = g.createLinearGradient(0, h * 0.40, w, h * 0.60);
      lg.addColorStop(0, 'rgba(255,240,210,0)');
      lg.addColorStop(0.45, 'rgba(255,244,220,.9)');
      lg.addColorStop(1, 'rgba(255,240,210,0)');
      g.fillStyle = lg;
      g.fillRect(0, h * 0.395, w, h * 0.215);
      g.restore();
    }

    var s = h * 0.30;
    person(g, w * 0.30, h * 0.815, s, 0, { ink: pal.ink, still: true, hair: 'long' });
    person(g, w * 0.395, h * 0.815, s * 0.97, 0, { ink: pal.ink, still: true, alpha: 0.75 });
    dust(g, w, h, t, rand, pal.glow, 14);
  };

  SCENES.door = function (g, w, h, p, t, o) {
    var pal = o.pal, rand = o.rand;
    g.fillStyle = shade(pal.ink, 0.02);
    g.fillRect(0, 0, w, h);
    var dx = w * 0.31, dy = h * 0.13, dw = w * 0.38, dh = h * 0.76;
    var lg = g.createLinearGradient(dx, dy, dx, dy + dh);
    lg.addColorStop(0, hexA(pal.glow, 0.92));
    lg.addColorStop(1, hexA(pal.mist, 0.5));
    g.fillStyle = lg;
    g.fillRect(dx, dy, dw, dh);
    // 门外的树影
    g.save();
    g.globalAlpha = 0.16;
    g.fillStyle = pal.ink;
    g.beginPath();
    g.ellipse(dx + dw * 0.62, dy + dh * 0.7, dw * 0.16, dh * 0.16, 0, 0, TAU);
    g.fill();
    g.restore();
    person(g, dx + dw * 0.5, dy + dh * 0.96, h * 0.34, 0,
      { ink: hexA(pal.ink, 0.8), still: true, alpha: 0.72, hair: 'long' });

    var close = clamp((p - 0.42) / 0.5, 0, 1);
    var openW = dw * (1 - ease(close));
    g.save();
    g.fillStyle = shade(pal.ink, -0.35);
    g.fillRect(dx, dy, dw - openW, dh);
    g.fillStyle = shade(pal.ink, -0.22);
    g.fillRect(dx + dw - openW, dy, openW, dh);
    g.strokeStyle = shade(pal.ink, 0.28);
    g.lineWidth = 2;
    g.strokeRect(dx, dy, dw, dh);
    g.beginPath();
    g.moveTo(dx + dw - openW, dy); g.lineTo(dx + dw - openW, dy + dh);
    g.stroke();
    g.restore();

    if (close > 0.1) {
      g.save();
      g.globalCompositeOperation = 'screen';
      g.globalAlpha = 0.35 * (1 - close);
      g.fillStyle = hexA(pal.glow, 0.9);
      g.fillRect(dx + dw - openW, dy, Math.max(0, openW * 0.25), dh);
      g.restore();
    }
    dust(g, w, h, t, rand, pal.glow, 20);
  };

  SCENES.sunset = function (g, w, h, p, t, o) {
    var pal = o.pal, rand = o.rand, hy = h * 0.695;
    var grd = g.createLinearGradient(0, 0, 0, hy);
    grd.addColorStop(0, shade(pal.sky[2], 0.18));
    grd.addColorStop(0.5, pal.sky[1]);
    grd.addColorStop(1, pal.glow);
    g.fillStyle = grd;
    g.fillRect(0, 0, w, hy);

    var sx = w * 0.52, sy = hy - h * 0.055;
    g.save();
    g.globalCompositeOperation = 'screen';
    var sg = g.createRadialGradient(sx, sy, 0, sx, sy, h * 0.55);
    sg.addColorStop(0, 'rgba(255,247,226,.95)');
    sg.addColorStop(0.07, 'rgba(255,238,205,.7)');
    sg.addColorStop(1, 'rgba(255,230,190,0)');
    g.fillStyle = sg; g.fillRect(0, 0, w, h);
    g.restore();

    treeline(g, w, h, hy + 2, pal, rand, { alpha: 0.22, n: 14, blur: 1.2 });
    groundPlane(g, w, h, hy, pal, rand, { mistAlpha: 0.4, tint: '#8a8a63', tintAlpha: 0.3 });
    midTree(g, w * 0.12, hy + h * 0.02, h * 0.22, rand, 0.22);
    midTree(g, w * 0.88, hy + h * 0.02, h * 0.18, rand, 0.2);

    var s = h * 0.16;
    person(g, w * 0.43, h * 0.855, s, 0, { ink: pal.ink, still: true, hair: 'long' });
    person(g, w * 0.49, h * 0.853, s * 0.98, 0, { ink: pal.ink, still: true });
    dust(g, w, h, t, rand, pal.glow, 18);
  };

  /* ---------------- 播放器 ---------------- */

  function fit() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    W = window.innerWidth;
    H = window.innerHeight;
    cvs.width = Math.floor(W * dpr);
    cvs.height = Math.floor(H * dpr);
    cvs.style.width = W + 'px';
    cvs.style.height = H + 'px';
  }

  function drawShot(g, shot, p, tAbs, opt) {
    var fn = SCENES[shot.scene] || SCENES.object;
    g.save();
    var z = 1.04;
    g.translate(W / 2 + Math.sin(tAbs * 0.31) * 3, H / 2 + Math.cos(tAbs * 0.23) * 2);
    g.scale(z, z);
    g.translate(-W / 2, -H / 2);
    fn(g, W, H, p, tAbs, opt);
    if (shot.line) filmLine(g, shot.line, p);
    g.restore();
  }

  // 镜头里偶尔浮出的一句话：淡入、停住、淡出，不做字幕条
  function filmLine(g, text, p) {
    var a = clamp((p - 0.18) * 5, 0, 1) * clamp((1 - p) * 5.5, 0, 1);
    if (a <= 0.01) return;
    var sz = Math.max(15, Math.min(34, H * 0.030));
    g.save();
    g.globalAlpha = a * 0.88;
    g.font = '300 ' + sz + 'px "Songti SC","STSong","SimSun",serif';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.shadowColor = 'rgba(0,0,0,.55)';
    g.shadowBlur = sz * 0.7;
    g.fillStyle = 'rgba(248,241,226,.94)';
    g.fillText(text, W / 2, H * 0.845);
    g.restore();
  }

  F.play = function (frag) {
    return new Promise(function (resolve) {
      if (running) { resolve(); return; }
      running = true;
      fit();

      var shots = frag.shots;
      var total = shots.reduce(function (a, s) { return a + s.dur; }, 0);
      var start = performance.now();
      var fadeIn = 0.9, fadeOut = 1.4;
      var opt = {
        pal: PAL[frag.mood] || PAL.warm,
        rand: mulberry32(frag.seed || 12345),
        mood: frag.mood,
        shape: frag.shape
      };
      var progEl = document.querySelector('#film-progress i');
      var wrap = document.getElementById('film-wrap');
      wrap.classList.add('on');
      g_reset();

      function frame(now) {
        var t = (now - start) / 1000;
        var g = ctx;
        g.setTransform(dpr, 0, 0, dpr, 0, 0);
        g.clearRect(0, 0, W, H);

        var acc = 0, idx = 0, local = 0;
        for (var i = 0; i < shots.length; i++) {
          if (t < acc + shots[i].dur || i === shots.length - 1) {
            idx = i; local = clamp(t - acc, 0, shots[i].dur); break;
          }
          acc += shots[i].dur;
        }
        var shot = shots[idx];
        var p = clamp(local / shot.dur, 0, 1);
        var globalP = clamp(t / total, 0, 1);

        var blend = 0;
        if (idx > 0 && local < 1.0) blend = 1 - local / 1.0;
        if (blend > 0.01) {
          drawShot(g, shots[idx - 1], 1, t, opt);
          g.save();
          g.globalAlpha = 1 - blend;
          drawShot(g, shot, p, t, opt);
          g.restore();
          g.save();
          g.globalAlpha = blend * 0.5;
          g.fillStyle = opt.pal.mist;
          g.fillRect(0, 0, W, H);
          g.restore();
        } else {
          drawShot(g, shot, p, t, opt);
        }

        paperOverlay(g, W, H, 0.10);
        grain(g, W, H, 0.15);
        vignette(g, W, H, 1);

        var black = 0;
        if (t < fadeIn) black = 1 - t / fadeIn;
        if (t > total - fadeOut) black = (t - (total - fadeOut)) / fadeOut;
        if (black > 0) {
          g.fillStyle = 'rgba(4,3,3,' + clamp(black, 0, 1) + ')';
          g.fillRect(0, 0, W, H);
        }

        if (progEl) progEl.style.width = (globalP * 100).toFixed(1) + '%';

        if (t < total) {
          requestAnimationFrame(frame);
        } else {
          g.fillStyle = 'rgba(4,3,3,1)';
          g.fillRect(0, 0, W, H);
          wrap.classList.remove('on');
          if (progEl) progEl.style.width = '0%';
          setTimeout(function () {
            g.clearRect(0, 0, W, H);
            running = false;
            resolve();
          }, 1100);
        }
      }
      requestAnimationFrame(frame);
    });
  };

  function g_reset() {
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, W, H);
    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = 1;
  }

  /* ---------------- 结局影像 ---------------- */

  F.playEnding = function (kind, stats) {
    return new Promise(function (resolve) {
      var c = document.getElementById('ending-cv');
      var g = c.getContext('2d');
      var W2 = window.innerWidth, H2 = window.innerHeight;
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      c.width = Math.floor(W2 * dpr);
      c.height = Math.floor(H2 * dpr);
      c.style.width = W2 + 'px';
      c.style.height = H2 + 'px';

      var start = performance.now();
      var dur = kind === 2 ? 14 : (kind === 1 ? 13 : (kind === 0 ? 11 : 12));
      var rand = mulberry32(kind === 2 ? 8891 : 4477);
      var pal = kind === 2
        ? { sky: ['#eaf0f2', '#e6dcc6', '#c9b08a'], ground: '#a8a680', ink: '#332e26', glow: '#fff8e6', mist: '#f0e8d6' }
        : kind === 1
          ? { sky: ['#e7e9e2', '#ded8c6', '#b6ae97'], ground: '#9da084', ink: '#33302a', glow: '#f6f2e4', mist: '#e4dfcd' }
          : kind === 0
            ? { sky: ['#e4e5df', '#d6d8d0', '#b9bcb4'], ground: '#a8aba1', ink: '#3a3d38', glow: '#f4f2e6', mist: '#dcded6' }
            : { sky: ['#d2d5cf', '#b6bbb5', '#8f958f'], ground: '#8e948c', ink: '#2e322d', glow: '#eae6d8', mist: '#c6cac3' };

      function frame(now) {
        var t = (now - start) / 1000;
        var p = clamp(t / dur, 0, 1);
        g.setTransform(dpr, 0, 0, dpr, 0, 0);
        g.clearRect(0, 0, W2, H2);

        var hy = H2 * 0.62;
        var fogK = kind === 2 ? clamp(1 - p * 2.4, 0.02, 1)
          : kind === 1 ? clamp(1 - p * 1.9, 0.10, 1)
          : kind === 0 ? clamp(0.30 + Math.sin(p * Math.PI) * 0.06, 0.2, 0.5)
          : clamp(0.82 + Math.sin(p * Math.PI) * 0.1, 0.5, 1);
        wash(g, W2, H2, pal, rand, 0.38);
        // 结局二：雾散后露出的低太阳
        if (kind === 2) {
          var sunX = W2 * 0.54, sunY = hy - H2 * 0.10;
          var sunA = clamp(p / 0.22, 0, 1);
          g.save();
          g.globalCompositeOperation = 'screen';
          var sg0 = g.createRadialGradient(sunX, sunY, 0, sunX, sunY, H2 * 0.55);
          sg0.addColorStop(0, 'rgba(255,250,232,' + (0.58 * sunA) + ')');
          sg0.addColorStop(0.06, 'rgba(255,240,206,' + (0.44 * sunA) + ')');
          sg0.addColorStop(1, 'rgba(255,232,190,0)');
          g.fillStyle = sg0;
          g.fillRect(0, 0, W2, H2);
          g.globalAlpha = 1;
          g.restore();
        }
        treeline(g, W2, H2, hy + 2, pal, rand, { alpha: kind === 2 ? 0.18 : (kind === 1 ? 0.17 : 0.16), n: 22, blur: 2 });
        groundPlane(g, W2, H2, hy, pal, rand, {
          mistAlpha: kind === 2 ? 0.05 + 0.34 * fogK : (kind === 1 ? 0.10 + 0.40 * fogK : (kind === 0 ? 0.34 : 0.72)),
          tint: kind === 2 ? '#9aa055' : (kind === 1 ? '#8f9560' : '#8b918a'),
          tintAlpha: kind === 2 ? 0.46 : (kind === 1 ? 0.34 : (kind === 0 ? 0.10 : 0.2))
        });

        for (var i = 0; i < 7; i++) {
          var fx = ((i * 0.21 + t * 0.011) % 1.2 - 0.1) * W2;
          var fy = hy - H2 * 0.02 + i * H2 * 0.042;
          var fr = H2 * (0.15 + (i % 3) * 0.05);
          var rg = g.createRadialGradient(fx, fy, 0, fx, fy, fr);
          rg.addColorStop(0, hexA(pal.mist, 0.65 * fogK));
          rg.addColorStop(1, hexA(pal.mist, 0));
          g.fillStyle = rg;
          g.beginPath(); g.arc(fx, fy, fr, 0, TAU); g.fill();
        }

        g.save();
        g.strokeStyle = pal.ink;
        g.globalAlpha = 0.16;
        for (var k = 0; k < 50; k++) {
          var gx = (k / 50) * W2 + Math.sin(k * 12.3) * 6;
          var gh = H2 * (0.04 + (k % 5) * 0.012);
          g.lineWidth = 1.2;
          g.beginPath();
          g.moveTo(gx, H2);
          g.quadraticCurveTo(gx + Math.sin(t * 0.8 + k) * 8, H2 - gh * 0.6, gx + Math.sin(t * 0.9 + k) * 14, H2 - gh);
          g.stroke();
        }
        g.restore();

        if (kind === 2) {
          g.save();
          g.globalCompositeOperation = 'screen';
          var sg = g.createRadialGradient(W2 * 0.52, hy - H2 * 0.12, 0, W2 * 0.52, hy - H2 * 0.12, H2 * 0.78);
          sg.addColorStop(0, 'rgba(255,248,228,' + (0.20 * p) + ')');
          sg.addColorStop(1, 'rgba(255,248,228,0)');
          g.fillStyle = sg; g.fillRect(0, 0, W2, H2);
          g.restore();

          g.save();
          g.globalAlpha = 0.14 + p * 0.12;
          g.fillStyle = shade(pal.ground, 0.22);
          g.beginPath();
          g.moveTo(W2 * 0.505, hy + 2);
          g.lineTo(W2 * 0.515, hy + 2);
          g.lineTo(W2 * 0.60, H2);
          g.lineTo(W2 * 0.40, H2);
          g.closePath(); g.fill();
          g.restore();

          var walkK = clamp((p - 0.18) / 0.72, 0, 1);
          person(g, W2 * 0.50 + walkK * W2 * 0.02, H2 * 0.905 - walkK * H2 * 0.11, H2 * (0.40 - walkK * 0.22), t * 3.0,
            { ink: pal.ink, alpha: 0.72 - walkK * 0.42, hair: 'long' });
        } else if (kind === 1) {
          // 放下结局：空着手往前走，碎片一块块沉进草里
          var wk2 = clamp((p - 0.10) / 0.80, 0, 1);
          g.save();
          for (var d4 = 0; d4 < 13; d4++) {
            var t0 = clamp((p - d4 * 0.035) * 2.6, 0, 1);
            if (t0 <= 0) continue;
            var dx4 = W2 * (0.50 + (d4 % 4 - 1.5) * 0.035) + Math.sin(d4 * 2.1) * W2 * 0.02;
            var dy4 = H2 * 0.80 + t0 * H2 * 0.13 + (d4 % 5) * H2 * 0.012;
            g.globalAlpha = (1 - t0) * 0.5;
            g.fillStyle = pal.ink;
            g.beginPath();
            g.ellipse(dx4, dy4, H2 * 0.006, H2 * 0.004, d4, 0, TAU);
            g.fill();
          }
          g.restore();
          g.save();
          g.globalCompositeOperation = 'screen';
          var eg2 = g.createRadialGradient(W2 * 0.5, hy - H2 * 0.06, 0, W2 * 0.5, hy - H2 * 0.06, H2 * 0.95);
          eg2.addColorStop(0, 'rgba(250,246,232,' + (0.22 + 0.08 * p) + ')');
          eg2.addColorStop(1, 'rgba(250,246,232,0)');
          g.fillStyle = eg2; g.fillRect(0, 0, W2, H2);
          g.restore();
          person(g, W2 * (0.49 + wk2 * 0.03), H2 * 0.90 - wk2 * H2 * 0.06, H2 * (0.40 - wk2 * 0.14), t * 2.6,
            { ink: pal.ink, alpha: 0.70 - wk2 * 0.34, hair: 'long' });
        } else if (kind === 0) {
          // 空结局：草地上什么都没有，风也是轻的
          g.save();
          g.globalCompositeOperation = 'screen';
          var eg = g.createRadialGradient(W2 * 0.5, hy - H2 * 0.10, 0, W2 * 0.5, hy - H2 * 0.10, H2 * 0.9);
          eg.addColorStop(0, 'rgba(252,250,240,' + (0.28 + 0.10 * Math.sin(t * 0.7)) + ')');
          eg.addColorStop(1, 'rgba(252,250,240,0)');
          g.fillStyle = eg; g.fillRect(0, 0, W2, H2);
          g.restore();
        } else {
          var breathe = Math.sin(t * 0.9) * 0.004;
          person(g, W2 * 0.5, H2 * 0.93, H2 * (0.42 + breathe), 0, { ink: pal.ink, still: true, alpha: 0.82, hair: 'long' });
          var glimpses = [[0.23, 0.40], [0.76, 0.36], [0.63, 0.5]];
          for (var m = 0; m < glimpses.length; m++) {
            var a = clamp(Math.sin(clamp((p - m * 0.13) * 2.4, 0, 1) * Math.PI), 0, 1) * 0.32;
            if (a <= 0.01) continue;
            g.save();
            g.globalAlpha = a;
            g.globalCompositeOperation = 'screen';
            var gx2 = glimpses[m][0] * W2, gy2 = glimpses[m][1] * H2;
            var rg2 = g.createRadialGradient(gx2, gy2, 0, gx2, gy2, H2 * 0.19);
            rg2.addColorStop(0, 'rgba(255,236,198,.95)');
            rg2.addColorStop(1, 'rgba(255,236,198,0)');
            g.fillStyle = rg2;
            g.beginPath(); g.arc(gx2, gy2, H2 * 0.19, 0, TAU); g.fill();
            g.restore();
          }
        }

        paperOverlay(g, W2, H2, 0.09);
        grain(g, W2, H2, 0.14);
        vignette(g, W2, H2, kind === 2 ? 0.7 : (kind === 1 ? 0.86 : 1.05));

        var black = t < 1.2 ? 1 - t / 1.2 : 0;
        if (black > 0) {
          g.fillStyle = 'rgba(4,3,3,' + black + ')';
          g.fillRect(0, 0, W2, H2);
        }

        if (t < dur) requestAnimationFrame(frame);
        else resolve();
      }
      requestAnimationFrame(frame);
    });
  };


  // 调试：把任意回忆镜头画到指定 canvas（便于逐帧检查）
  F.debugFrame = function (frag, idx, p, target) {
    var c = target || cvs;
    var g = c.getContext('2d');
    var w = c.width, hh = c.height;
    var opt = {
      pal: PAL[frag.mood] || PAL.warm,
      rand: mulberry32(frag.seed || 1),
      mood: frag.mood,
      shape: frag.shape
    };
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.clearRect(0, 0, w, hh);
    g.save();
    g.translate(w / 2, hh / 2);
    g.scale(1.04, 1.04);
    g.translate(-w / 2, -hh / 2);
    var fn = SCENES[frag.shots[idx].scene] || SCENES.object;
    fn(g, w, hh, p, (p || 0) * 6 + idx * 3, opt);
    g.restore();
    if (w > 900) {
      paperOverlay(g, w, hh, 0.10);
      grain(g, w, hh, 0.14);
      vignette(g, w, hh, 1);
    }
  };

  // 第二个场景文件（memory2.js）往这里注册新镜头，绘制方式与上面完全一致
  F.registerScenes = function (map) {
    for (var k in map) { if (map.hasOwnProperty(k)) SCENES[k] = map[k]; }
  };

  F.h = {
    wash: wash, groundPlane: groundPlane, treeline: treeline, midTree: midTree,
    person: person, dust: dust, rain: rain, grain: grain, vignette: vignette,
    paperOverlay: paperOverlay, hexA: hexA, shade: shade,
    rr: rr, lerp: lerp, clamp: clamp, ease: ease, TAU: TAU
  };

  F.init = function () {
    cvs = document.getElementById('film');
    ctx = cvs.getContext('2d');
    fit();
    window.addEventListener('resize', function () {
      if (running) fit();
    });
  };

  F._person = function (g, x, y, h, ph, o) { person(g, x, y, h, ph, o); };
  F._pal = PAL;

  YH.Memory = F;
})(window.YH = window.YH || {});
