/* 余痕 · 回忆场景（第二组）
   依据《他记忆最开头的画面，永远定格在外婆的灶台》重写：
   灶台、早点摊、办公室的红字、走廊、病房、宿舍、食堂、围挡、镜子、柜子、银杏。
   全部沿用 memory.js 的水彩画法，只换内容。 */
(function (YH) {
  'use strict';

  var M = YH.Memory, h = M.h;
  var wash = h.wash, person = h.person, dust = h.dust;
  var hexA = h.hexA, shade = h.shade;
  var rr = h.rr, lerp = h.lerp, clamp = h.clamp, ease = h.ease, TAU = h.TAU;
  var S = {};

  /* ---------------- 小工具 ---------------- */

  // 静态噪点：不用 rand()，否则每帧重算会闪
  function h2(i) {
    var x = Math.sin(i * 12.9898 + 4.1414) * 43758.5453;
    return x - Math.floor(x);
  }

  function glowAt(g, x, y, r, color, a, mid) {
    g.save();
    g.globalCompositeOperation = 'screen';
    var rg = g.createRadialGradient(x, y, 0, x, y, r);
    rg.addColorStop(0, hexA(color, a));
    rg.addColorStop(mid == null ? 0.34 : mid, hexA(color, a * 0.34));
    rg.addColorStop(1, hexA(color, 0));
    g.fillStyle = rg;
    g.fillRect(x - r, y - r, r * 2, r * 2);
    g.restore();
  }

  function shadowAt(g, x, y, r, a) {
    g.save();
    var rg = g.createRadialGradient(x, y, 0, x, y, r);
    rg.addColorStop(0, 'rgba(8,6,5,' + a + ')');
    rg.addColorStop(0.55, 'rgba(8,6,5,' + (a * 0.45) + ')');
    rg.addColorStop(1, 'rgba(8,6,5,0)');
    g.fillStyle = rg;
    g.fillRect(x - r, y - r, r * 2, r * 2);
    g.restore();
  }

  // 错缝砖墙
  function bricks(g, x0, y0, x1, y1, pal, rows, alpha, bwK) {
    var bh = (y1 - y0) / rows, bw = bh * (bwK || 2.3);
    g.save();
    g.globalAlpha = alpha == null ? 0.22 : alpha;
    for (var r = 0; r < rows; r++) {
      var y = y0 + r * bh, off = (r % 2) * bw * 0.5;
      for (var i = -1; x0 + i * bw < x1 + bw; i++) {
        var v = h2(r * 31 + i * 7);
        g.fillStyle = 'rgba(255,238,208,' + (0.05 + v * 0.13).toFixed(3) + ')';
        g.fillRect(x0 + i * bw + off + 1.5, y + 1.5, bw - 3, bh - 3);
      }
    }
    g.strokeStyle = hexA(pal.ink, 0.55);
    g.lineWidth = Math.max(1, bh * 0.055);
    for (var r2 = 0; r2 <= rows; r2++) {
      var yy = y0 + r2 * bh, o2 = (r2 % 2) * bw * 0.5;
      g.beginPath(); g.moveTo(x0, yy); g.lineTo(x1, yy); g.stroke();
      for (var k = -1; x0 + k * bw < x1 + bw; k++) {
        g.beginPath();
        g.moveTo(x0 + k * bw + o2, yy);
        g.lineTo(x0 + k * bw + o2, Math.min(y1, yy + bh));
        g.stroke();
      }
    }
    g.restore();
  }

  // 上升的白汽
  function steam(g, x, y, ww, hh, t, n, alpha) {
    g.save();
    g.lineCap = 'round';
    n = n || 7;
    for (var i = 0; i < n; i++) {
      var ph = i * 1.37;
      var bx = x + (i - (n - 1) / 2) * ww * 0.085 + Math.sin(t * 0.55 + ph) * ww * 0.10;
      var a = (alpha == null ? 0.5 : alpha) * (0.22 + 0.55 * h2(i * 13));
      g.strokeStyle = 'rgba(255,251,242,' + a.toFixed(3) + ')';
      g.lineWidth = ww * (0.030 + 0.022 * (i % 3));
      g.beginPath();
      g.moveTo(bx, y);
      g.bezierCurveTo(
        bx + Math.sin(t * 0.9 + ph) * ww * 0.22, y - hh * 0.34,
        bx - Math.sin(t * 1.2 + ph) * ww * 0.26, y - hh * 0.68,
        bx + Math.sin(t * 0.7 + ph) * ww * 0.38, y - hh);
      g.stroke();
    }
    g.restore();
  }

  // 地面/桌面木纹
  function woodGrain(g, w, hh, y0, color, n, alpha) {
    g.save();
    g.strokeStyle = color;
    g.globalAlpha = alpha == null ? 0.12 : alpha;
    g.lineCap = 'round';
    for (var i = 0; i < n; i++) {
      var y = y0 + h2(i * 5) * (hh - y0);
      g.lineWidth = 0.8 + h2(i * 9) * 2.4;
      g.beginPath();
      g.moveTo(-10, y);
      g.bezierCurveTo(w * 0.3, y + (h2(i * 3) - 0.5) * 10, w * 0.7, y + (h2(i * 7) - 0.5) * 12, w + 10, y + (h2(i * 11) - 0.5) * 8);
      g.stroke();
    }
    g.restore();
  }

  // 外婆：背影带发髻
  function grandma(g, x, footY, hh, alpha, ink) {
    person(g, x, footY, hh, 0, { ink: ink, still: true, alpha: alpha });
    g.save();
    g.fillStyle = ink;
    g.globalAlpha = alpha == null ? 1 : alpha;
    g.beginPath();
    g.arc(x - hh * 0.035, footY - hh * 0.885, hh * 0.045, 0, TAU);
    g.fill();
    g.restore();
  }

  // 坐着的老人/病人：简化剪影（头 + 毯子轮廓）
  function lyingFigure(g, x, y, wid, hh, ink, alpha) {
    g.save();
    g.globalAlpha = alpha == null ? 1 : alpha;
    g.fillStyle = ink;
    g.beginPath();
    g.ellipse(x + wid * 0.10, y, wid * 0.30, hh * 0.10, 0, 0, TAU);
    g.fill();
    g.beginPath(); // 头
    g.arc(x - wid * 0.22, y - hh * 0.045, hh * 0.055, 0, TAU);
    g.fill();
    g.restore();
  }

  // 银杏叶：真的扇形，带一道缺口和叶脉
  function ginkgo(g, x, y, r, rot, fill, vein) {
    g.save();
    g.translate(x, y);
    g.rotate(rot);
    g.fillStyle = fill;
    g.beginPath();
    g.moveTo(0, 0);
    g.arc(0, -r * 0.52, r, Math.PI * 0.16, Math.PI * 0.84, false);
    g.closePath();
    g.fill();
    if (vein) {
      g.strokeStyle = vein;
      g.lineWidth = Math.max(0.8, r * 0.05);
      g.beginPath(); g.moveTo(0, 0); g.lineTo(0, -r * 1.05); g.stroke();
      for (var i = -2; i <= 2; i++) {
        g.beginPath();
        g.moveTo(0, -r * 0.92);
        g.lineTo(i * r * 0.44, -r * (1.34 - Math.abs(i) * 0.10));
        g.stroke();
      }
    }
    g.restore();
  }

  /* ---------------- 一 · 灶台 ---------------- */

  S.stove = function (g, w, hh, p, t, o) {
    var pal = o.pal, ink = pal.ink, glow = pal.glow;
    var wallBot = hh * 0.60, cTop = hh * 0.60, cBot = hh * 0.715;

    // 墙：被烟熏得发黄，越靠上越暗
    var bg = g.createLinearGradient(0, 0, 0, wallBot);
    bg.addColorStop(0, shade(ink, 0.22));
    bg.addColorStop(0.55, shade(ink, 0.32));
    bg.addColorStop(1, shade(ink, 0.40));
    g.fillStyle = bg;
    g.fillRect(0, 0, w, wallBot);
    bricks(g, -20, hh * 0.05, w, wallBot, pal, 7, 0.14);
    glowAt(g, w * 0.30, hh * 0.26, hh * 0.75, '#ffd9a2', 0.30);
    // 墙上的锅铲、挂着的竹刷
    g.save();
    g.strokeStyle = 'rgba(28,22,18,.55)';
    g.lineWidth = hh * 0.006;
    g.beginPath();
    g.moveTo(w * 0.10, hh * 0.10); g.lineTo(w * 0.10, hh * 0.26);
    g.stroke();
    g.fillStyle = 'rgba(28,22,18,.5)';
    g.fillRect(w * 0.093, hh * 0.255, w * 0.014, hh * 0.05);
    g.restore();

    // 台面：一条往右收的亮带
    var ct = g.createLinearGradient(0, cTop, 0, cBot);
    ct.addColorStop(0, shade(pal.ground, 0.10));
    ct.addColorStop(0.55, shade(pal.ground, -0.10));
    ct.addColorStop(1, shade(pal.ground, -0.34));
    g.fillStyle = ct;
    g.beginPath();
    g.moveTo(0, cTop + hh * 0.012);
    g.lineTo(w, cTop);
    g.lineTo(w, cBot);
    g.lineTo(0, cBot + hh * 0.020);
    g.closePath(); g.fill();
    // 磨亮的反光
    g.save();
    g.globalCompositeOperation = 'screen';
    var rg = g.createLinearGradient(0, 0, w, 0);
    rg.addColorStop(0, hexA(glow, 0.06));
    rg.addColorStop(0.24, hexA(glow, 0.30));
    rg.addColorStop(0.34, hexA(glow, 0.05));
    rg.addColorStop(0.52, hexA(glow, 0.20));
    rg.addColorStop(0.66, hexA(glow, 0.04));
    rg.addColorStop(1, hexA(glow, 0.12));
    g.fillStyle = rg;
    g.beginPath();
    g.moveTo(0, cTop + hh * 0.014);
    g.lineTo(w, cTop + hh * 0.002);
    g.lineTo(w, cTop + hh * 0.026);
    g.lineTo(0, cTop + hh * 0.038);
    g.closePath(); g.fill();
    g.restore();

    // 灶的前脸：暗到底，只有砖缝
    var front = g.createLinearGradient(0, cBot, 0, hh);
    front.addColorStop(0, shade(pal.ground, -0.52));
    front.addColorStop(1, shade(pal.ground, -0.74));
    g.fillStyle = front;
    g.beginPath();
    g.moveTo(0, cBot + hh * 0.020);
    g.lineTo(w, cBot);
    g.lineTo(w, hh); g.lineTo(0, hh);
    g.closePath(); g.fill();
    g.save();
    g.beginPath();
    g.moveTo(0, cBot + hh * 0.020);
    g.lineTo(w, cBot);
    g.lineTo(w, hh); g.lineTo(0, hh);
    g.closePath(); g.clip();
    bricks(g, -20, cBot, w, hh, pal, 4, 0.16);
    g.restore();
    // 灶膛里的火
    var fx0 = w * 0.34, fy0 = hh * 0.905;
    g.fillStyle = '#120c08';
    g.beginPath();
    g.moveTo(fx0 - w * 0.075, fy0);
    g.quadraticCurveTo(fx0, fy0 - hh * 0.145, fx0 + w * 0.075, fy0);
    g.closePath(); g.fill();
    glowAt(g, fx0, fy0 - hh * 0.012, w * 0.085, '#ff8f34', 0.30 + 0.08 * Math.sin(t * 2.6));

    /* ---- 锅：低角度看，只见一口黑和一圈锅沿 ---- */
    var wx = w * 0.42, wy = hh * 0.596, wrx = w * 0.125, wry = hh * 0.030;
    // 锅前面的弧形锅体
    g.fillStyle = '#171310';
    g.beginPath();
    g.moveTo(wx - wrx, wy);
    g.quadraticCurveTo(wx - wrx * 0.86, wy + hh * 0.075, wx, wy + hh * 0.082);
    g.quadraticCurveTo(wx + wrx * 0.86, wy + hh * 0.075, wx + wrx, wy);
    g.closePath(); g.fill();
    // 锅口
    g.fillStyle = '#0f0d0b';
    g.beginPath(); g.ellipse(wx, wy, wrx, wry, 0, 0, TAU); g.fill();
    // 锅沿的一线油光
    g.strokeStyle = 'rgba(214,182,134,.40)';
    g.lineWidth = Math.max(2, hh * 0.004);
    g.beginPath();
    g.ellipse(wx, wy, wrx * 0.99, wry * 0.98, 0, Math.PI * 1.04, Math.PI * 1.94);
    g.stroke();

    /* ---- 木锅盖被提起来，偏在锅的右上方 ---- */
    var lift = ease(clamp((p - 0.04) * 1.4, 0, 1));
    var lidX = wx + wrx * 0.86 + lift * w * 0.020;
    var lidY = wy - hh * 0.030 - lift * hh * 0.130;
    var tilt = -0.22 - lift * 0.34;
    var lrx = wrx * 1.08;
    g.save();
    g.translate(lidX, lidY);
    g.rotate(tilt);
    g.scale(1, 0.34);
    var lidG = g.createRadialGradient(-lrx * 0.30, -lrx * 0.30, lrx * 0.10, 0, 0, lrx * 1.04);
    lidG.addColorStop(0, shade(pal.ground, 0.10));
    lidG.addColorStop(0.62, shade(pal.ground, -0.22));
    lidG.addColorStop(1, shade(pal.ground, -0.52));
    g.fillStyle = lidG;
    g.beginPath(); g.arc(0, 0, lrx, 0, TAU); g.fill();
    g.strokeStyle = 'rgba(56,40,26,.20)';
    for (var i = 0; i < 6; i++) {
      g.lineWidth = 1 + (i % 2);
      g.beginPath(); g.arc(0, 0, lrx * (0.20 + i * 0.135), 0, TAU); g.stroke();
    }
    g.fillStyle = shade(pal.ink, 0.30);
    g.beginPath(); g.ellipse(0, 0, lrx * 0.17, lrx * 0.17, 0, 0, TAU); g.fill();
    g.restore();

    // 白汽：盖一开，蒸汽往左上涌
    if (lift > 0.04) {
      steam(g, wx - wrx * 0.10, wy - hh * 0.004, wrx * 1.25, hh * 0.52 * lift, t, 10, 0.18 * lift);
      g.save();
      g.globalCompositeOperation = 'screen';
      var sg = g.createRadialGradient(wx, wy - hh * 0.12 * lift, 0, wx, wy - hh * 0.12 * lift, wrx * 1.7);
      sg.addColorStop(0, 'rgba(255,251,240,' + (0.26 * lift) + ')');
      sg.addColorStop(1, 'rgba(255,251,240,0)');
      g.fillStyle = sg;
      g.fillRect(wx - wrx * 1.8, wy - hh * 0.75, wrx * 3.6, hh * 0.9);
      g.restore();
    }

    /* ---- 外婆站在灶后，上半身探出来，双手扣着锅盖 ---- */
    var gx = w * 0.735, gfoot = hh * 0.760, ghh = hh * 0.56;
    glowAt(g, gx - ghh * 0.18, gfoot - ghh * 0.40, ghh * 0.62, '#ffdcae', 0.20);
    // 她站在灶台后面，灶台挡住腰以下
    g.save();
    g.beginPath();
    g.rect(0, 0, w, cTop + hh * 0.020);
    g.clip();
    // 身子：一件厚棉袄的剪影
    g.fillStyle = shade(ink, 0.02);
    g.beginPath();
    g.moveTo(gx - ghh * 0.140, gfoot - ghh * 0.74);
    g.quadraticCurveTo(gx - ghh * 0.162, gfoot - ghh * 0.54, gx - ghh * 0.150, gfoot - ghh * 0.38);
    g.lineTo(gx + ghh * 0.150, gfoot - ghh * 0.38);
    g.quadraticCurveTo(gx + ghh * 0.162, gfoot - ghh * 0.54, gx + ghh * 0.140, gfoot - ghh * 0.74);
    g.quadraticCurveTo(gx, gfoot - ghh * 0.83, gx - ghh * 0.140, gfoot - ghh * 0.74);
    g.closePath(); g.fill();
    // 围裙：一块比棉袄亮的布，从胸口垂到腰下
    g.fillStyle = 'rgba(198,178,146,.92)';
    g.beginPath();
    g.moveTo(gx - ghh * 0.068, gfoot - ghh * 0.700);
    g.quadraticCurveTo(gx, gfoot - ghh * 0.730, gx + ghh * 0.068, gfoot - ghh * 0.700);
    g.lineTo(gx + ghh * 0.112, gfoot - ghh * 0.360);
    g.lineTo(gx + ghh * 0.104, gfoot + hh * 0.05);
    g.lineTo(gx - ghh * 0.104, gfoot + hh * 0.05);
    g.lineTo(gx - ghh * 0.112, gfoot - ghh * 0.360);
    g.closePath(); g.fill();
    // 围裙的系带与口袋
    g.strokeStyle = 'rgba(120,98,70,.45)';
    g.lineWidth = 1.6;
    g.beginPath();
    g.moveTo(gx - ghh * 0.090, gfoot - ghh * 0.520);
    g.lineTo(gx + ghh * 0.090, gfoot - ghh * 0.520);
    g.stroke();
    g.beginPath();
    g.moveTo(gx - ghh * 0.052, gfoot - ghh * 0.380);
    g.lineTo(gx + ghh * 0.052, gfoot - ghh * 0.380);
    g.stroke();
    g.strokeStyle = 'rgba(90,72,50,.35)';
    g.lineWidth = 1.4;
    g.beginPath();
    g.moveTo(gx - ghh * 0.070, gfoot - ghh * 0.50);
    g.lineTo(gx + ghh * 0.070, gfoot - ghh * 0.50);
    g.stroke();
    // 脖子与头
    g.fillStyle = shade(ink, 0.02);
    g.fillRect(gx - ghh * 0.024, gfoot - ghh * 0.80, ghh * 0.048, ghh * 0.06);
    g.beginPath();
    g.ellipse(gx, gfoot - ghh * 0.845, ghh * 0.050, ghh * 0.058, 0, 0, TAU);
    g.fill();
    // 花白的头发挽成的髻
    g.fillStyle = '#cfc4ae';
    g.beginPath(); g.ellipse(gx, gfoot - ghh * 0.872, ghh * 0.048, ghh * 0.036, 0, Math.PI, TAU); g.fill();
    g.beginPath(); g.arc(gx + ghh * 0.030, gfoot - ghh * 0.900, ghh * 0.030, 0, TAU); g.fill();
    // 伸出的一只手臂，去扣锅盖
    g.strokeStyle = shade(ink, 0.02);
    g.lineWidth = ghh * 0.058;
    g.lineCap = 'round';
    g.beginPath();
    g.moveTo(gx - ghh * 0.100, gfoot - ghh * 0.700);
    g.quadraticCurveTo(gx - ghh * 0.230, gfoot - ghh * 0.660, lidX + lrx * 0.30, lidY - hh * 0.012);
    g.stroke();
    // 轮廓光：肩和手臂的外缘
    g.save();
    g.strokeStyle = hexA(glow, 0.50);
    g.lineWidth = Math.max(2, hh * 0.005);
    g.lineCap = 'round';
    g.beginPath();
    g.moveTo(gx - ghh * 0.112, gfoot - ghh * 0.44);
    g.quadraticCurveTo(gx - ghh * 0.135, gfoot - ghh * 0.56, gx - ghh * 0.113, gfoot - ghh * 0.72);
    g.quadraticCurveTo(gx - ghh * 0.070, gfoot - ghh * 0.795, gx - ghh * 0.050, gfoot - ghh * 0.815);
    g.stroke();
    g.restore();
    // 两只手扣着盖沿
    g.save();
    g.fillStyle = shade(ink, 0.10);
    g.strokeStyle = shade(ink, 0.10);
    g.lineWidth = hh * 0.018;
    g.lineCap = 'round';
    // 手指扣在盖沿上
    for (var f = 0; f < 3; f++) {
      g.beginPath();
      g.moveTo(lidX + lrx * 0.26 + f * hh * 0.006, lidY + hh * 0.012);
      g.lineTo(lidX + lrx * 0.22 + f * hh * 0.010, lidY - hh * 0.014);
      g.stroke();
    }
    g.beginPath();
    g.ellipse(lidX + lrx * 0.16, lidY - hh * 0.026, hh * 0.026, hh * 0.016, -0.25, 0, TAU);
    g.fill();
    g.restore();
    g.restore();

    /* ---- 台沿的旧抹布 ---- */
    g.save();
    g.globalAlpha = 0.9;
    g.fillStyle = shade(pal.ground, 0.04);
    g.beginPath();
    g.moveTo(w * 0.045, cBot + hh * 0.006);
    g.lineTo(w * 0.165, cBot + hh * 0.002);
    g.quadraticCurveTo(w * 0.162, cBot + hh * 0.090, w * 0.146, cBot + hh * 0.150);
    g.quadraticCurveTo(w * 0.118, cBot + hh * 0.100, w * 0.102, cBot + hh * 0.152);
    g.quadraticCurveTo(w * 0.070, cBot + hh * 0.092, w * 0.045, cBot + hh * 0.006);
    g.closePath(); g.fill();
    g.globalCompositeOperation = 'screen';
    g.globalAlpha = 0.13;
    g.fillStyle = glow;
    g.fillRect(w * 0.085, cBot + hh * 0.055, w * 0.045, hh * 0.050);
    g.restore();

    /* ---- 他的碗：就在台面右边，蛋埋在碗底 ---- */
    var bx = w * 0.885, by = hh * 0.618;
    shadowAt(g, bx, by + hh * 0.010, w * 0.075, 0.36);
    g.fillStyle = shade(glow, -0.14);
    g.beginPath();
    g.moveTo(bx - w * 0.040, by - hh * 0.020);
    g.quadraticCurveTo(bx - w * 0.033, by + hh * 0.026, bx, by + hh * 0.030);
    g.quadraticCurveTo(bx + w * 0.033, by + hh * 0.026, bx + w * 0.040, by - hh * 0.020);
    g.closePath(); g.fill();
    g.fillStyle = shade(glow, 0.04);
    g.beginPath(); g.ellipse(bx, by - hh * 0.022, w * 0.040, hh * 0.012, 0, 0, TAU); g.fill();
    g.fillStyle = shade(glow, 0.14);
    g.beginPath(); g.ellipse(bx, by - hh * 0.023, w * 0.033, hh * 0.009, 0, 0, TAU); g.fill();

    dust(g, w, hh, t, o.rand, '#ffe8c4', 20);
  };

  S.bowl = function (g, w, hh, p, t, o) {
    var pal = o.pal, ink = pal.ink, glow = pal.glow;
    g.fillStyle = shade(pal.ground, -0.46);
    g.fillRect(0, 0, w, hh);
    woodGrain(g, w, hh, 0, shade(ink, -0.2), 14, 0.16);
    glowAt(g, w * 0.46, hh * 0.30, hh * 1.0, glow, 0.40);

    var cx = w * 0.50, cy = hh * 0.55, rx = w * 0.215, ry = hh * 0.325;
    shadowAt(g, cx + rx * 0.12, cy + ry * 0.32, rx * 1.25, 0.42);

    // 碗外壁
    g.fillStyle = shade(glow, -0.26);
    g.beginPath(); g.ellipse(cx, cy, rx, ry, 0, 0, TAU); g.fill();
    g.strokeStyle = 'rgba(96,84,64,.35)';
    g.lineWidth = 3;
    g.beginPath(); g.ellipse(cx, cy, rx * 0.995, ry * 0.995, 0, 0, TAU); g.stroke();
    g.fillStyle = shade(glow, -0.04);
    g.beginPath(); g.ellipse(cx, cy - ry * 0.02, rx * 0.97, ry * 0.96, 0, 0, TAU); g.fill();
    // 碗内：靠边一圈是釉下的暗
    g.fillStyle = shade(glow, -0.04);
    g.beginPath(); g.ellipse(cx, cy - ry * 0.02, rx * 0.90, ry * 0.88, 0, 0, TAU); g.fill();
    var ig = g.createRadialGradient(cx, cy - ry * 0.02, rx * 0.45, cx, cy - ry * 0.02, rx * 0.92);
    ig.addColorStop(0, 'rgba(255,255,255,0)');
    ig.addColorStop(1, 'rgba(120,104,80,.30)');
    g.fillStyle = ig;
    g.beginPath(); g.ellipse(cx, cy - ry * 0.02, rx * 0.90, ry * 0.88, 0, 0, TAU); g.fill();

    // 米饭
    g.save();
    g.beginPath(); g.ellipse(cx, cy - ry * 0.02, rx * 0.88, ry * 0.86, 0, 0, TAU); g.clip();
    g.fillStyle = shade(glow, 0.16);
    g.beginPath();
    g.ellipse(cx + rx * 0.05, cy + ry * 0.02, rx * 0.80, ry * 0.72, 0, 0, TAU);
    g.fill();
    // 饭粒的起伏：几团稍暗的米
    g.save();
    g.globalCompositeOperation = 'multiply';
    for (var cl = 0; cl < 9; cl++) {
      var ccx = cx + (h2(cl * 3.3) - 0.5) * rx * 1.3;
      var ccy = cy + (h2(cl * 7.7) - 0.5) * ry * 1.1;
      var ccr = rx * (0.10 + h2(cl * 5.1) * 0.16);
      var cg2 = g.createRadialGradient(ccx, ccy, 0, ccx, ccy, ccr);
      cg2.addColorStop(0, 'rgba(196,180,146,.35)');
      cg2.addColorStop(1, 'rgba(196,180,146,0)');
      g.fillStyle = cg2;
      g.beginPath(); g.arc(ccx, ccy, ccr, 0, TAU); g.fill();
    }
    g.restore();
    g.fillStyle = 'rgba(255,253,246,.55)';
    for (var i = 0; i < 220; i++) {
      var a2 = h2(i * 3.7) * TAU, r2 = Math.sqrt(h2(i * 9.1)) * 0.78;
      g.fillRect(cx + Math.cos(a2) * rx * r2, cy + Math.sin(a2) * ry * r2, 2.2, 1.5);
    }

    // 筷子把饭拨开，露出碗底
    var dig = ease(clamp((p - 0.10) * 1.25, 0, 1));
    var ex = cx - rx * 0.10, ey = cy + ry * 0.14;
    var holeR = rx * 0.30 * dig;
    g.fillStyle = shade(glow, -0.20);
    g.beginPath(); g.ellipse(ex, ey, holeR, holeR * 0.72, 0, 0, TAU); g.fill();

    // 荷包蛋
    if (dig > 0.25) {
      var ea = clamp((dig - 0.25) / 0.55, 0, 1);
      g.save();
      g.globalAlpha = ea;
      g.fillStyle = '#fbf5e4';
      g.beginPath();
      g.ellipse(ex, ey, rx * 0.235, rx * 0.185, 0.2, 0, TAU);
      g.fill();
      g.fillStyle = '#fbf5e4';
      g.beginPath(); g.ellipse(ex + rx * 0.14, ey - rx * 0.05, rx * 0.10, rx * 0.09, 0.4, 0, TAU); g.fill();
      // 焦边
      g.strokeStyle = 'rgba(150,102,54,.55)';
      g.lineWidth = 3;
      g.beginPath(); g.ellipse(ex, ey, rx * 0.235, rx * 0.185, 0.2, 0, TAU); g.stroke();
      // 蛋黄
      var yg = g.createRadialGradient(ex - rx * 0.02, ey - rx * 0.03, 0, ex, ey, rx * 0.115);
      yg.addColorStop(0, '#f6c34e');
      yg.addColorStop(1, '#d98c2a');
      g.fillStyle = yg;
      g.beginPath(); g.arc(ex, ey, rx * 0.108, 0, TAU); g.fill();
      g.restore();
      glowAt(g, ex, ey, rx * 0.42, '#ffdf9a', 0.30 * ea);
    }
    g.restore();

    // 筷子
    var tipX = lerp(cx + rx * 0.86, ex + rx * 0.24, dig);
    var tipY = lerp(cy + ry * 0.30, ey + ry * 0.10, dig);
    g.save();
    g.strokeStyle = shade(ink, -0.1);
    g.lineWidth = Math.max(2, hh * 0.007);
    g.lineCap = 'round';
    for (var k = 0; k < 2; k++) {
      g.beginPath();
      g.moveTo(tipX + rx * 0.62 + k * hh * 0.012, tipY + ry * 0.55);
      g.lineTo(tipX + k * hh * 0.014, tipY);
      g.stroke();
    }
    g.restore();

    if (dig < 0.9) steam(g, cx, cy - ry * 0.62, rx * 1.1, hh * 0.30, t, 5, 0.26 * (1 - dig));
    dust(g, w, hh, t, o.rand, glow, 12);
  };

  S.steamface = function (g, w, hh, p, t, o) {
    var pal = o.pal, ink = pal.ink, glow = pal.glow;
    g.fillStyle = shade(ink, 0.10);
    g.fillRect(0, 0, w, hh);
    glowAt(g, w * 0.14, hh * 0.40, hh * 1.25, glow, 0.62);
    bricks(g, 0, hh * 0.55, w, hh, pal, 4, 0.12);

    // 近处巨大的侧脸（逆光，只见轮廓和一点边缘光）
    var cx = w * 0.60, cy = hh * 0.50, r = hh * 0.235;
    g.save();
    g.fillStyle = shade(ink, 0.03);
    g.beginPath();
    g.moveTo(cx - r * 1.05, cy + r * 2.4);
    g.lineTo(cx - r * 1.05, cy + r * 0.55);
    g.bezierCurveTo(cx - r * 1.05, cy - r * 0.45, cx - r * 0.62, cy - r * 1.02, cx, cy - r * 0.98);
    g.bezierCurveTo(cx + r * 0.72, cy - r * 0.94, cx + r * 1.02, cy - r * 0.30, cx + r * 0.98, cy + r * 0.30);
    g.bezierCurveTo(cx + r * 0.94, cy + r * 1.0, cx + r * 1.1, cy + r * 1.7, cx + r * 1.15, cy + r * 2.4);
    g.closePath(); g.fill();
    // 发髻
    g.beginPath(); g.arc(cx + r * 0.72, cy - r * 0.60, r * 0.34, 0, TAU); g.fill();
    g.restore();

    // 侧脸：鼻子、下巴、一撮散下来的头发
    g.save();
    g.fillStyle = shade(ink, 0.03);
    g.beginPath();
    g.moveTo(cx - r * 0.98, cy - r * 0.10);
    g.quadraticCurveTo(cx - r * 1.16, cy + r * 0.10, cx - r * 1.02, cy + r * 0.26);
    g.quadraticCurveTo(cx - r * 0.94, cy + r * 0.40, cx - r * 0.96, cy + r * 0.52);
    g.lineTo(cx - r * 0.80, cy + r * 0.44);
    g.closePath(); g.fill();
    // 垂在额前的一缕
    g.strokeStyle = shade(ink, 0.03);
    g.lineWidth = r * 0.10;
    g.lineCap = 'round';
    g.beginPath();
    g.moveTo(cx - r * 0.12, cy - r * 0.94);
    g.quadraticCurveTo(cx - r * 0.34, cy - r * 0.55, cx - r * 0.30, cy - r * 0.18);
    g.stroke();
    g.restore();

    // 边缘光
    g.save();
    g.strokeStyle = hexA(glow, 0.75);
    g.lineWidth = Math.max(2, r * 0.045);
    g.lineCap = 'round';
    g.beginPath();
    g.moveTo(cx - r * 0.98, cy + r * 0.60);
    g.bezierCurveTo(cx - r * 1.02, cy - r * 0.40, cx - r * 0.58, cy - r * 0.98, cx, cy - r * 0.94);
    g.stroke();
    // 鼻子和下巴的边缘光
    g.globalAlpha = 0.55;
    g.beginPath();
    g.moveTo(cx - r * 1.06, cy + r * 0.10);
    g.quadraticCurveTo(cx - r * 1.18, cy + r * 0.20, cx - r * 1.02, cy + r * 0.30);
    g.stroke();
    g.globalAlpha = 0.45;
    g.beginPath();
    g.moveTo(cx - r * 0.30, cy + r * 0.10);
    g.quadraticCurveTo(cx - r * 0.05, cy + r * 0.55, cx + r * 0.10, cy + r * 1.10);
    g.stroke();
    g.restore();

    // 白汽横着扑过来：只走画面左下，别糊住脸
    steam(g, w * 0.16, hh * 1.02, w * 0.34, hh * 0.80, t, 6, 0.26);
    g.save();
    g.globalCompositeOperation = 'screen';
    var mg = g.createLinearGradient(0, hh * 0.30, w * 0.55, hh * 0.95);
    mg.addColorStop(0, hexA(glow, 0.0));
    mg.addColorStop(0.5, hexA(glow, 0.20));
    mg.addColorStop(1, hexA(glow, 0.0));
    g.fillStyle = mg;
    g.fillRect(0, hh * 0.2, w * 0.6, hh * 0.8);
    g.restore();
    dust(g, w, hh, t, o.rand, glow, 26);
  };

  /* ---------------- 二 · 早点摊 ---------------- */

  S.stall = function (g, w, hh, p, t, o) {
    var pal = o.pal, ink = pal.ink, glow = pal.glow;
    var hy = hh * 0.62;
    wash(g, w, hh, { sky: [shade(pal.sky[0], 0.02), pal.sky[1], shade(pal.sky[2], -0.1)] }, o.rand, 0.9);
    // 巷子里的两排屋檐
    g.fillStyle = shade(ink, 0.34);
    g.beginPath(); g.moveTo(0, 0); g.lineTo(w * 0.22, hy - hh * 0.12); g.lineTo(w * 0.22, hy); g.lineTo(0, hy + hh * 0.06); g.closePath(); g.fill();
    g.beginPath(); g.moveTo(w, 0); g.lineTo(w * 0.80, hy - hh * 0.14); g.lineTo(w * 0.80, hy); g.lineTo(w, hy + hh * 0.05); g.closePath(); g.fill();

    // 地面
    var gg = g.createLinearGradient(0, hy, 0, hh);
    gg.addColorStop(0, shade(pal.ground, -0.10));
    gg.addColorStop(1, shade(pal.ground, -0.46));
    g.fillStyle = gg;
    g.fillRect(0, hy, w, hh - hy);

    // 银杏：叶子已经黄了
    g.save();
    g.globalAlpha = 0.30;
    g.fillStyle = '#d8b64c';
    for (var i = 0; i < 90; i++) {
      var lx = h2(i * 3.3) * w, ly = h2(i * 7.7) * hy * 1.05;
      g.beginPath();
      g.ellipse(lx, ly, 5 + h2(i * 5.1) * 7, 3 + h2(i * 2.9) * 4, h2(i) * 3, 0, TAU);
      g.fill();
    }
    g.restore();
    g.save();
    g.strokeStyle = shade(ink, 0.1);
    g.globalAlpha = 0.55;
    g.lineWidth = hh * 0.022;
    g.beginPath();
    g.moveTo(w * 0.06, -hh * 0.05);
    g.quadraticCurveTo(w * 0.10, hh * 0.22, w * 0.16, hy - hh * 0.10);
    g.stroke();
    g.restore();

    // 摊子：折叠桌 + 油锅 + 蒸笼
    var tx = w * 0.30, tw = w * 0.44, ty = hh * 0.60;
    glowAt(g, tx + tw * 0.5, ty - hh * 0.10, hh * 0.75, glow, 0.42);

    // 蒸笼塔
    var stx = tx + tw * 0.10;
    for (var s2 = 0; s2 < 4; s2++) {
      var sy = ty - hh * 0.035 - s2 * hh * 0.038;
      g.fillStyle = shade(pal.ground, 0.16 - s2 * 0.03);
      g.beginPath(); g.ellipse(stx, sy, tw * 0.115, hh * 0.020, 0, 0, TAU); g.fill();
      g.strokeStyle = 'rgba(60,45,32,.35)';
      g.lineWidth = 1.2;
      g.beginPath(); g.ellipse(stx, sy, tw * 0.115, hh * 0.020, 0, 0, TAU); g.stroke();
    }
    steam(g, stx, ty - hh * 0.175, tw * 0.30, hh * 0.34, t, 7, 0.42);

    // 油锅
    var wx = tx + tw * 0.58;
    g.fillStyle = '#241c15';
    g.beginPath(); g.ellipse(wx, ty - hh * 0.012, tw * 0.155, hh * 0.034, 0, 0, TAU); g.fill();
    g.fillStyle = '#5a3a18';
    g.beginPath(); g.ellipse(wx, ty - hh * 0.016, tw * 0.140, hh * 0.028, 0, 0, TAU); g.fill();
    // 翻滚的油泡
    g.save();
    g.fillStyle = 'rgba(255,226,170,.55)';
    for (var b = 0; b < 26; b++) {
      var bx = wx + (h2(b * 4.1) - 0.5) * tw * 0.26;
      var by = ty - hh * 0.016 + (h2(b * 6.3) - 0.5) * hh * 0.035;
      var brr = 1 + Math.abs(Math.sin(t * 2 + b)) * 2.4;
      g.beginPath(); g.arc(bx, by, brr, 0, TAU); g.fill();
    }
    g.restore();
    // 两根长筷子插在锅里
    g.save();
    g.strokeStyle = '#3a2a1c';
    g.lineWidth = Math.max(2, hh * 0.006);
    g.beginPath();
    g.moveTo(wx - tw * 0.05, ty - hh * 0.012); g.lineTo(wx - tw * 0.16, ty - hh * 0.20);
    g.moveTo(wx + tw * 0.02, ty - hh * 0.012); g.lineTo(wx - tw * 0.12, ty - hh * 0.19);
    g.stroke();
    g.restore();

    // 桌面
    g.fillStyle = shade(pal.ground, -0.02);
    g.fillRect(tx, ty, tw, hh * 0.030);
    g.fillStyle = shade(pal.ground, -0.30);
    g.fillRect(tx + tw * 0.06, ty + hh * 0.030, tw * 0.012, hh * 0.28);
    g.fillRect(tx + tw * 0.90, ty + hh * 0.030, tw * 0.012, hh * 0.28);

    // 陈姨：围裙，低着头翻油条
    person(g, tx + tw * 0.84, ty + hh * 0.30, hh * 0.52, 0, { ink: shade(ink, 0.04), still: true });
    g.save();
    g.globalAlpha = 0.55;
    g.strokeStyle = shade(pal.ground, 0.24);
    g.lineWidth = hh * 0.010;
    g.beginPath();
    g.moveTo(tx + tw * 0.80, ty + hh * 0.06);
    g.lineTo(tx + tw * 0.86, ty + hh * 0.20);
    g.stroke();
    g.restore();

    // 六岁的他：小，攥着钱，站在摊前
    var kidY = hh * 0.985;
    var kidX = lerp(w * 0.24, w * 0.30, ease(clamp(p * 1.2, 0, 1)));
    person(g, kidX, kidY, hh * 0.30, 0, { ink: shade(ink, 0.06), still: true, gesture: 'hold' });

    // 塑料凳
    g.fillStyle = 'rgba(60,70,90,.55)';
    g.fillRect(w * 0.86, hh * 0.80, w * 0.05, hh * 0.035);

    dust(g, w, hh, t, o.rand, glow, 22);
  };

  S.bagshot = function (g, w, hh, p, t, o) {
    var pal = o.pal, ink = pal.ink, glow = pal.glow;
    g.fillStyle = shade(ink, 0.16);
    g.fillRect(0, 0, w, hh);
    glowAt(g, w * 0.44, hh * 0.44, hh * 1.1, glow, 0.52);

    // 背景虚化的街
    g.save();
    g.globalAlpha = 0.35;
    for (var i = 0; i < 9; i++) {
      var bx = h2(i * 5.3) * w, by = hh * (0.30 + h2(i * 8.1) * 0.35);
      glowAt(g, bx, by, hh * (0.10 + h2(i) * 0.16), '#ffeccd', 0.45);
    }
    g.restore();

    // 纸袋：被油浸透的一层
    var cx = w * 0.50, cy = hh * 0.56, bw = w * 0.155, bh = hh * 0.50;
    g.save();
    g.translate(cx, cy);
    g.rotate(-0.05 + Math.sin(t * 0.6) * 0.012);
    shadowAt(g, 0, bh * 0.52, bw * 2.0, 0.45);
    g.fillStyle = '#c8a878';
    g.beginPath();
    g.moveTo(-bw, -bh * 0.30);
    g.lineTo(bw, -bh * 0.34);
    g.lineTo(bw * 0.92, bh * 0.50);
    g.lineTo(-bw * 0.95, bh * 0.50);
    g.closePath(); g.fill();
    // 折口
    g.fillStyle = '#b1905f';
    g.beginPath();
    g.moveTo(-bw, -bh * 0.30); g.lineTo(bw, -bh * 0.34);
    g.lineTo(bw * 0.94, -bh * 0.18); g.lineTo(-bw * 0.96, -bh * 0.14);
    g.closePath(); g.fill();
    // 油渍
    g.save();
    g.globalCompositeOperation = 'multiply';
    for (var k = 0; k < 4; k++) {
      var ox = (h2(k * 3.3) - 0.5) * bw * 1.4;
      var oy = (h2(k * 7.1) - 0.4) * bh * 0.7;
      var og = g.createRadialGradient(ox, oy, 0, ox, oy, bw * (0.45 + h2(k) * 0.4));
      og.addColorStop(0, 'rgba(120,74,30,.55)');
      og.addColorStop(1, 'rgba(120,74,30,0)');
      g.fillStyle = og;
      g.beginPath(); g.arc(ox, oy, bw, 0, TAU); g.fill();
    }
    g.restore();
    // 纸的折痕
    g.strokeStyle = 'rgba(96,68,38,.35)';
    g.lineWidth = 1.4;
    g.beginPath(); g.moveTo(-bw * 0.5, -bh * 0.16); g.lineTo(-bw * 0.55, bh * 0.48); g.stroke();
    g.beginPath(); g.moveTo(bw * 0.42, -bh * 0.18); g.lineTo(bw * 0.40, bh * 0.48); g.stroke();
    g.restore();

    // 攥着纸袋的手：手腕从画面左下伸进来，四根手指扣住袋身
    g.save();
    g.translate(cx, cy);
    // 小臂：从画面左下斜进来
    g.strokeStyle = shade(ink, 0.14);
    g.lineWidth = bh * 0.26;
    g.lineCap = 'round';
    g.beginPath();
    g.moveTo(-bw * 2.30, bh * 0.86);
    g.lineTo(-bw * 1.02, bh * 0.18);
    g.stroke();
    // 手背
    g.fillStyle = shade(ink, 0.14);
    g.beginPath();
    g.ellipse(-bw * 0.92, bh * 0.16, bw * 0.30, bh * 0.20, -0.5, 0, TAU);
    g.fill();
    // 手指：四根短圆条，压在纸袋正面
    for (var f = 0; f < 4; f++) {
      var fy = -bh * 0.10 + f * bh * 0.085;
      var fl = bw * (0.50 - f * 0.045);
      g.fillStyle = shade(ink, 0.16 - f * 0.01);
      g.beginPath();
      g.moveTo(-bw * 0.95, fy);
      g.quadraticCurveTo(-bw * 0.55, fy - bh * 0.035, -bw * 0.95 + fl, fy + bh * 0.020);
      g.quadraticCurveTo(-bw * 0.55, fy + bh * 0.055, -bw * 0.95, fy + bh * 0.048);
      g.closePath(); g.fill();
      // 指缝的光
      g.strokeStyle = 'rgba(230,190,130,.35)';
      g.lineWidth = Math.max(1, bh * 0.004);
      g.beginPath();
      g.moveTo(-bw * 0.92, fy + bh * 0.046);
      g.quadraticCurveTo(-bw * 0.55, fy + bh * 0.052, -bw * 0.95 + fl, fy + bh * 0.018);
      g.stroke();
    }
    // 油亮的一点
    g.globalAlpha = 0.35;
    g.fillStyle = '#e8b060';
    g.beginPath(); g.ellipse(-bw * 0.60, -bh * 0.06, bw * 0.16, bh * 0.035, -0.2, 0, TAU); g.fill();
    g.restore();

    steam(g, cx - bw * 0.1, cy - bh * 0.28, bw * 1.6, hh * 0.26, t, 5, 0.34);
    dust(g, w, hh, t, o.rand, glow, 16);
  };

  S.alley = function (g, w, hh, p, t, o) {
    var pal = o.pal, ink = pal.ink, glow = pal.glow;
    var hy = hh * 0.66;
    // 巷子尽头，太阳快落下去了
    g.fillStyle = shade(pal.sky[1], 0.06);
    g.fillRect(0, 0, w, hh);
    glowAt(g, w * 0.52, hy - hh * 0.16, hh * 0.80, '#ffe0ac', 0.62);

    // 两侧的院墙：砖缝、墙根的潮气
    g.fillStyle = shade(ink, 0.44);
    g.beginPath();
    g.moveTo(0, hh * 0.02); g.lineTo(w * 0.27, hy - hh * 0.20);
    g.lineTo(w * 0.27, hh); g.lineTo(0, hh); g.closePath(); g.fill();
    g.fillStyle = shade(ink, 0.34);
    g.beginPath();
    g.moveTo(w, hh * 0.02); g.lineTo(w * 0.75, hy - hh * 0.22);
    g.lineTo(w * 0.75, hh); g.lineTo(w, hh); g.closePath(); g.fill();
    g.save();
    g.beginPath();
    g.moveTo(0, hh * 0.02); g.lineTo(w * 0.27, hy - hh * 0.20);
    g.lineTo(w * 0.27, hh); g.lineTo(0, hh); g.closePath(); g.clip();
    bricks(g, 0, hh * 0.02, w * 0.30, hh, pal, 9, 0.16);
    g.restore();
    g.save();
    g.beginPath();
    g.moveTo(w, hh * 0.02); g.lineTo(w * 0.75, hy - hh * 0.22);
    g.lineTo(w * 0.75, hh); g.lineTo(w, hh); g.closePath(); g.clip();
    bricks(g, w * 0.72, hh * 0.02, w, hh, pal, 9, 0.10);
    g.restore();

    // 地面：一条被踩得发亮的石板路
    var gg = g.createLinearGradient(0, hy - hh * 0.16, 0, hh);
    gg.addColorStop(0, shade(pal.ground, 0.04));
    gg.addColorStop(0.5, shade(pal.ground, -0.20));
    gg.addColorStop(1, shade(pal.ground, -0.52));
    g.fillStyle = gg;
    g.beginPath();
    g.moveTo(w * 0.27, hy - hh * 0.12); g.lineTo(w * 0.75, hy - hh * 0.14);
    g.lineTo(w, hh); g.lineTo(0, hh); g.closePath(); g.fill();
    // 石板的横缝
    g.save();
    g.strokeStyle = 'rgba(30,26,22,.28)';
    g.lineWidth = 1.4;
    for (var r = 0; r < 5; r++) {
      var ry = hy - hh * 0.02 + Math.pow(r / 5, 1.7) * hh * 0.40;
      g.beginPath(); g.moveTo(0, ry); g.lineTo(w, ry + hh * 0.01); g.stroke();
    }
    g.restore();
    glowAt(g, w * 0.50, hy + hh * 0.10, hh * 0.42, '#ffdca4', 0.22);

    // 石墩：就在近处，被坐得发亮
    var bx = w * 0.50, by = hh * 0.86, bw = w * 0.115, bh = hh * 0.185;
    shadowAt(g, bx + bw * 0.10, by + hh * 0.010, bw * 1.7, 0.42);
    g.fillStyle = shade(pal.ground, -0.30);
    g.beginPath();
    g.moveTo(bx - bw, by);
    g.lineTo(bx - bw * 0.94, by - bh * 0.92);
    g.lineTo(bx + bw * 0.94, by - bh * 0.92);
    g.lineTo(bx + bw, by);
    g.closePath(); g.fill();
    // 顶面
    g.fillStyle = shade(pal.ground, -0.06);
    g.beginPath(); g.ellipse(bx, by - bh * 0.92, bw * 0.95, hh * 0.022, 0, 0, TAU); g.fill();
    // 被趴出来的那一块暖
    g.fillStyle = 'rgba(214,168,104,.35)';
    g.beginPath(); g.ellipse(bx - bw * 0.06, by - bh * 0.925, bw * 0.58, hh * 0.014, 0, 0, TAU); g.fill();
    // 石头的裂纹
    g.strokeStyle = 'rgba(40,34,28,.30)';
    g.lineWidth = 1.2;
    g.beginPath();
    g.moveTo(bx - bw * 0.4, by - bh * 0.86);
    g.lineTo(bx - bw * 0.1, by - bh * 0.40);
    g.lineTo(bx - bw * 0.2, by - bh * 0.02);
    g.stroke();

    // 来福：趴在上面，最后一小段淡出
    var fade = clamp((1 - p) * 3.4, 0, 1);
    if (fade > 0.02) {
      g.save();
      g.globalAlpha = fade;
      var dogY = by - bh * 0.92;
      var dogC = '#c08a48', dogD = '#8a5c2c';
      // 身体
      g.fillStyle = dogC;
      g.beginPath();
      g.ellipse(bx + bw * 0.05, dogY - hh * 0.040, bw * 0.72, hh * 0.048, -0.04, 0, TAU);
      g.fill();
      // 背上稍深
      g.fillStyle = dogD;
      g.globalAlpha = fade * 0.45;
      g.beginPath();
      g.ellipse(bx + bw * 0.12, dogY - hh * 0.062, bw * 0.52, hh * 0.020, -0.06, 0, TAU);
      g.fill();
      g.globalAlpha = fade;
      // 头：搁在前爪上
      g.fillStyle = dogC;
      g.beginPath();
      g.ellipse(bx - bw * 0.62, dogY - hh * 0.036, bw * 0.30, hh * 0.030, -0.12, 0, TAU);
      g.fill();
      // 鼻子
      g.fillStyle = '#2b2018';
      g.beginPath(); g.ellipse(bx - bw * 0.88, dogY - hh * 0.030, bw * 0.055, hh * 0.010, -0.2, 0, TAU); g.fill();
      // 一只耳朵立着，一只塌着
      g.fillStyle = dogD;
      g.beginPath();
      g.moveTo(bx - bw * 0.60, dogY - hh * 0.058);
      g.lineTo(bx - bw * 0.66, dogY - hh * 0.106);
      g.lineTo(bx - bw * 0.44, dogY - hh * 0.060);
      g.closePath(); g.fill();
      g.beginPath();
      g.ellipse(bx - bw * 0.44, dogY - hh * 0.048, bw * 0.13, hh * 0.014, 0.5, 0, TAU);
      g.fill();
      // 前爪
      g.fillStyle = dogC;
      g.beginPath(); g.ellipse(bx - bw * 0.70, dogY - hh * 0.008, bw * 0.22, hh * 0.011, 0, 0, TAU); g.fill();
      // 尾巴：慢慢扫
      g.strokeStyle = dogC;
      g.lineWidth = hh * 0.016;
      g.lineCap = 'round';
      g.beginPath();
      g.moveTo(bx + bw * 0.72, dogY - hh * 0.038);
      g.quadraticCurveTo(bx + bw * 1.05, dogY - hh * 0.052 + Math.sin(t * 1.5) * hh * 0.010,
        bx + bw * 0.96, dogY - hh * 0.090);
      g.stroke();
      g.restore();
    } else {
      // 它不在了：石墩上只剩一块暖色
      glowAt(g, bx - bw * 0.06, by - bh * 0.93, bw * 1.2, '#e0b070', 0.20);
    }

    // 墙根几片落叶，几道水渍
    g.save();
    g.globalAlpha = 0.55;
    for (var k = 0; k < 16; k++) {
      g.fillStyle = h2(k * 3.3) > 0.5 ? '#c2a054' : '#8e7438';
      g.save();
      g.translate(w * (0.05 + h2(k * 7.1) * 0.9), hh * (0.80 + h2(k * 5.3) * 0.18));
      g.rotate(h2(k) * TAU);
      g.beginPath(); g.ellipse(0, 0, 5 + h2(k * 2) * 6, 3.5 + h2(k * 4) * 4, 0, 0, TAU); g.fill();
      g.restore();
    }
    g.restore();

    dust(g, w, hh, t, o.rand, '#ffe8c4', 16);
  };

  /* ---------------- 三 · 办公室的红字 ---------------- */

  S.office = function (g, w, hh, p, t, o) {
    var pal = o.pal, ink = pal.ink, glow = pal.glow;
    g.fillStyle = shade(ink, 0.24);
    g.fillRect(0, 0, w, hh);

    // 窗：玻璃上贴着旧报纸，边角卷起来
    var wx = w * 0.04, wy = hh * 0.08, ww = w * 0.27, whh = hh * 0.46;
    var wg = g.createLinearGradient(wx, wy, wx + ww, wy + whh);
    wg.addColorStop(0, hexA(glow, 0.92));
    wg.addColorStop(1, hexA(glow, 0.50));
    g.fillStyle = wg;
    g.fillRect(wx, wy, ww, whh);
    // 旧报纸
    g.save();
    g.globalAlpha = 0.34;
    g.fillStyle = '#8e887a';
    g.fillRect(wx + ww * 0.05, wy + whh * 0.08, ww * 0.36, whh * 0.58);
    g.fillStyle = '#a49c8c';
    g.fillRect(wx + ww * 0.50, wy + whh * 0.22, ww * 0.40, whh * 0.40);
    // 卷起来的角
    g.fillStyle = 'rgba(240,236,224,.7)';
    g.beginPath();
    g.moveTo(wx + ww * 0.90, wy + whh * 0.62);
    g.lineTo(wx + ww * 0.90, wy + whh * 0.50);
    g.lineTo(wx + ww * 0.78, wy + whh * 0.62);
    g.closePath(); g.fill();
    g.restore();
    g.strokeStyle = shade(ink, -0.18);
    g.lineWidth = hh * 0.012;
    g.strokeRect(wx, wy, ww, whh);
    g.lineWidth = hh * 0.007;
    g.beginPath();
    g.moveTo(wx + ww * 0.5, wy); g.lineTo(wx + ww * 0.5, wy + whh);
    g.stroke();

    // 窗台上一摞作业本，橡皮筋泛黄
    for (var i = 0; i < 7; i++) {
      g.fillStyle = shade(glow, -0.06 - i * 0.010);
      g.fillRect(wx + ww * 0.10, wy + whh * 0.86 - i * hh * 0.011, ww * 0.44, hh * 0.009);
    }
    g.strokeStyle = 'rgba(196,164,84,.7)';
    g.lineWidth = 2.4;
    g.beginPath();
    g.moveTo(wx + ww * 0.32, wy + whh * 0.74);
    g.lineTo(wx + ww * 0.32, wy + whh * 0.90);
    g.stroke();

    // 光柱
    g.save();
    g.globalCompositeOperation = 'screen';
    g.globalAlpha = 0.13;
    g.fillStyle = hexA(glow, 0.9);
    g.beginPath();
    g.moveTo(wx, wy); g.lineTo(wx + ww, wy);
    g.lineTo(wx + ww + w * 0.40, hh); g.lineTo(wx - w * 0.10, hh);
    g.closePath(); g.fill();
    g.restore();

    // 办公桌
    var dy = hh * 0.68;
    g.fillStyle = shade(pal.ground, -0.44);
    g.fillRect(0, dy, w, hh - dy);
    g.fillStyle = shade(pal.ground, -0.24);
    g.fillRect(0, dy, w, hh * 0.016);
    g.fillStyle = 'rgba(255,255,255,.06)';
    g.fillRect(0, dy - hh * 0.004, w, hh * 0.006);

    // 周老师：坐着，头发花白，把本子推回来
    var tx = w * 0.72, seat = dy;
    g.save();
    // 椅子靠背
    g.fillStyle = shade(ink, 0.14);
    g.fillRect(tx - hh * 0.075, seat - hh * 0.46, hh * 0.15, hh * 0.40);
    // 身子：坐着的梯形
    g.fillStyle = shade(ink, 0.04);
    g.beginPath();
    g.moveTo(tx - hh * 0.085, seat - hh * 0.30);
    g.lineTo(tx + hh * 0.085, seat - hh * 0.30);
    g.lineTo(tx + hh * 0.115, seat + hh * 0.03);
    g.lineTo(tx - hh * 0.115, seat + hh * 0.03);
    g.closePath(); g.fill();
    // 肩
    g.beginPath();
    g.moveTo(tx - hh * 0.105, seat - hh * 0.30);
    g.quadraticCurveTo(tx, seat - hh * 0.355, tx + hh * 0.105, seat - hh * 0.30);
    g.lineTo(tx + hh * 0.085, seat - hh * 0.235);
    g.quadraticCurveTo(tx, seat - hh * 0.275, tx - hh * 0.085, seat - hh * 0.235);
    g.closePath(); g.fill();
    // 脖子与头
    g.fillRect(tx - hh * 0.020, seat - hh * 0.40, hh * 0.040, hh * 0.075);
    g.fillStyle = '#b8ab98';
    g.beginPath(); g.ellipse(tx - hh * 0.010, seat - hh * 0.435, hh * 0.042, hh * 0.050, 0.05, 0, TAU); g.fill();
    // 花白的头发
    g.fillStyle = '#d6d0c2';
    g.beginPath(); g.ellipse(tx - hh * 0.014, seat - hh * 0.458, hh * 0.044, hh * 0.038, 0.05, Math.PI, TAU); g.fill();
    // 推到桌面的那只手
    g.strokeStyle = shade(ink, 0.04);
    g.lineWidth = hh * 0.028;
    g.lineCap = 'round';
    g.beginPath();
    g.moveTo(tx - hh * 0.075, seat - hh * 0.255);
    g.quadraticCurveTo(tx - hh * 0.17, seat - hh * 0.20, tx - hh * 0.275, seat - hh * 0.055);
    g.stroke();
    // 袖口
    g.strokeStyle = 'rgba(230,226,214,.35)';
    g.lineWidth = hh * 0.008;
    g.beginPath();
    g.moveTo(tx - hh * 0.095, seat - hh * 0.240);
    g.lineTo(tx - hh * 0.130, seat - hh * 0.205);
    g.stroke();
    g.restore();

    // 被推回来的作业本
    var nx = w * 0.44, ny = dy + hh * 0.020;
    g.save();
    g.translate(nx, ny);
    g.rotate(-0.08);
    g.fillStyle = 'rgba(0,0,0,.28)';
    g.fillRect(-hh * 0.105, -hh * 0.075, hh * 0.21, hh * 0.060);
    g.fillStyle = '#efe6cf';
    g.fillRect(-hh * 0.11, -hh * 0.082, hh * 0.21, hh * 0.060);
    g.strokeStyle = 'rgba(70,58,44,.32)';
    g.lineWidth = 1;
    g.strokeRect(-hh * 0.11, -hh * 0.082, hh * 0.21, hh * 0.060);
    // 本子上的红线
    g.strokeStyle = 'rgba(168,42,36,.55)';
    g.lineWidth = 1.6;
    g.beginPath();
    g.moveTo(-hh * 0.075, -hh * 0.050);
    g.lineTo(hh * 0.055, -hh * 0.056);
    g.stroke();
    g.restore();

    // 粉笔灰
    dust(g, w, hh, t, o.rand, glow, 34);
  };

  S.redink = function (g, w, hh, p, t, o) {
    var pal = o.pal, ink = pal.ink;
    // 整幅就是一张摊开的作业本
    g.fillStyle = '#e7dcc3';
    g.fillRect(0, 0, w, hh);
    // 纸的纤维和阴影
    g.save();
    g.globalAlpha = 0.10;
    for (var i = 0; i < 240; i++) {
      g.strokeStyle = 'rgba(110,94,70,.5)';
      g.lineWidth = 0.7 + h2(i) * 1.3;
      var y = h2(i * 3.1) * hh, x = h2(i * 7.9) * w;
      g.beginPath(); g.moveTo(x, y); g.lineTo(x + 8 + h2(i * 5) * 34, y + (h2(i * 2) - 0.5) * 2); g.stroke();
    }
    g.restore();
    shadowAt(g, w * 0.5, hh * 0.5, w * 0.8, 0.22);

    // 横格线
    g.strokeStyle = 'rgba(96,86,72,.28)';
    g.lineWidth = 1.2;
    for (var r = 0; r < 9; r++) {
      var ry = hh * 0.16 + r * hh * 0.085;
      g.beginPath(); g.moveTo(w * 0.08, ry); g.lineTo(w * 0.92, ry); g.stroke();
    }
    // 竖线
    g.strokeStyle = 'rgba(96,86,72,.16)';
    g.beginPath(); g.moveTo(w * 0.08, hh * 0.10); g.lineTo(w * 0.08, hh * 0.92); g.stroke();

    // 红字：一笔一笔写出来，最后挤在一起
    var write = clamp((p - 0.06) / 0.62, 0, 1);
    var lineY = hh * 0.50;
    var chars = ['这', '次', '比', '上', '次', '认', '真'];
    var cw = w * 0.098, startX = w * 0.11;
    var sz = Math.min(hh * 0.115, w * 0.085);
    g.save();
    g.font = '400 ' + sz + 'px "Kaiti SC","KaiTi","STKaiti",serif';
    g.textBaseline = 'alphabetic';
    g.fillStyle = 'rgba(168,42,36,.86)';
    for (var c = 0; c < chars.length; c++) {
      var appear = clamp((write - c * 0.135) / 0.22, 0, 1);
      if (appear <= 0) continue;
      var x = startX + c * cw * (1 - (c === chars.length - 1 ? 0.22 : 0));
      g.globalAlpha = appear * 0.92;
      g.save();
      g.translate(x, lineY);
      g.rotate((h2(c * 5.5) - 0.5) * 0.10);
      g.fillText(chars[c], 0, 0);
      g.restore();
    }
    g.restore();

    // 墨在纸纹里洇开
    g.save();
    g.globalCompositeOperation = 'multiply';
    for (var k = 0; k < 7; k++) {
      var bx = startX + k * cw + w * 0.02;
      var rg = g.createRadialGradient(bx, lineY - sz * 0.3, 0, bx, lineY - sz * 0.3, w * 0.030);
      rg.addColorStop(0, 'rgba(150,44,36,' + (0.16 * write) + ')');
      rg.addColorStop(1, 'rgba(150,44,36,0)');
      g.fillStyle = rg;
      g.beginPath(); g.arc(bx, lineY - sz * 0.3, w * 0.030, 0, TAU); g.fill();
    }
    g.restore();

    // 红笔停在纸边
    g.save();
    g.strokeStyle = 'rgba(60,40,32,.8)';
    g.lineWidth = Math.max(2, hh * 0.008);
    g.lineCap = 'round';
    var penX = startX + chars.length * cw - cw * 0.25 + write * w * 0.02;
    g.beginPath();
    g.moveTo(penX + w * 0.10, lineY + hh * 0.16);
    g.lineTo(penX + w * 0.008, lineY + hh * 0.02);
    g.stroke();
    g.restore();

    glowAt(g, w * 0.42, hh * 0.34, hh * 0.7, '#fff3d8', 0.18);
  };

  /* ---------------- 四 · 走廊 / 教室 ---------------- */

  S.corridor = function (g, w, hh, p, t, o) {
    var pal = o.pal, ink = pal.ink, glow = pal.glow;
    var vx = w * 0.52, vy = hh * 0.50;
    g.fillStyle = shade(ink, 0.30);
    g.fillRect(0, 0, w, hh);

    // 远端：一扇亮着的窗
    g.fillStyle = hexA(glow, 0.72);
    g.fillRect(vx - w * 0.055, vy - hh * 0.20, w * 0.11, hh * 0.40);
    glowAt(g, vx, vy - hh * 0.02, hh * 0.7, glow, 0.45);

    // 地板透视线
    g.save();
    g.strokeStyle = 'rgba(255,246,226,.12)';
    g.lineWidth = 1.2;
    for (var i = -6; i <= 6; i++) {
      g.beginPath();
      g.moveTo(vx + i * w * 0.012, vy + hh * 0.16);
      g.lineTo(vx + i * w * 0.20, hh * 1.02);
      g.stroke();
    }
    for (var j = 1; j <= 7; j++) {
      var yy = vy + hh * 0.16 + Math.pow(j / 7, 2.1) * hh * 0.86;
      g.beginPath(); g.moveTo(0, yy); g.lineTo(w, yy); g.stroke();
    }
    g.restore();

    // 右侧连窗
    g.fillStyle = hexA(glow, 0.40);
    g.beginPath();
    g.moveTo(w, hh * 0.06); g.lineTo(vx + w * 0.055, vy - hh * 0.18);
    g.lineTo(vx + w * 0.055, vy + hh * 0.10); g.lineTo(w, hh * 0.62);
    g.closePath(); g.fill();

    // 左侧墙 / 天花板
    g.fillStyle = shade(ink, 0.16);
    g.beginPath();
    g.moveTo(0, 0); g.lineTo(vx - w * 0.055, vy - hh * 0.20);
    g.lineTo(vx - w * 0.055, vy + hh * 0.16); g.lineTo(0, hh);
    g.closePath(); g.fill();
    g.fillStyle = shade(ink, 0.08);
    g.beginPath();
    g.moveTo(0, 0); g.lineTo(w, 0); g.lineTo(vx + w * 0.055, vy - hh * 0.20); g.lineTo(vx - w * 0.055, vy - hh * 0.20);
    g.closePath(); g.fill();

    // 窗外的树叶在翻
    g.save();
    g.globalAlpha = 0.5;
    g.fillStyle = '#6a7a4a';
    for (var k = 0; k < 12; k++) {
      var lx = w * (0.62 + h2(k * 3.7) * 0.34);
      var ly = hh * (0.10 + h2(k * 8.3) * 0.40);
      g.save();
      g.translate(lx, ly);
      g.rotate(Math.sin(t * 1.4 + k) * 0.5);
      g.beginPath(); g.ellipse(0, 0, w * 0.014, w * 0.006, 0, 0, TAU); g.fill();
      g.restore();
    }
    g.restore();

    // 来来往往的人：只当剪影
    for (var m = 0; m < 5; m++) {
      var depth = 0.28 + h2(m * 4.1) * 0.62;
      var dir = m % 2 ? 1 : -1;
      var px = vx + dir * (0.06 + ((t * 0.05 + h2(m * 9.7)) % 0.5)) * w;
      var ph = hh * (0.18 + depth * 0.62);
      var py = vy + hh * 0.16 + Math.pow(depth, 1.6) * hh * 0.84;
      g.save();
      g.globalAlpha = 0.20 + depth * 0.45;
      person(g, px, py, ph, t * 4 + m, { ink: shade(ink, -0.1) });
      g.restore();
    }

    // 他：站住不动，就在走廊中间
    person(g, w * 0.40, hh * 0.90, hh * 0.62, 0, { ink: shade(ink, -0.15), still: true });
    // 老师：已经转身走远
    person(g, lerp(w * 0.47, w * 0.56, ease(clamp(p * 0.9, 0, 1))), vy + hh * 0.32,
      hh * lerp(0.34, 0.24, clamp(p, 0, 1)), 0, { ink: shade(ink, -0.1), still: true, alpha: 0.8 });

    glowAt(g, vx, vy - hh * 0.02, hh * 1.1, glow, 0.24);
    dust(g, w, hh, t, o.rand, glow, 22);
  };

  S.classroom = function (g, w, hh, p, t, o) {
    var pal = o.pal, ink = pal.ink, glow = pal.glow;
    var hy = hh * 0.70;
    wash(g, w, hh, pal, o.rand, 0.55);
    // 黑板
    g.fillStyle = shade(ink, -0.1);
    g.fillRect(w * 0.18, hh * 0.06, w * 0.64, hh * 0.34);
    g.strokeStyle = shade(pal.ground, -0.2);
    g.lineWidth = hh * 0.014;
    g.strokeRect(w * 0.18, hh * 0.06, w * 0.64, hh * 0.34);
    // 黑板上的字迹（几道粉笔痕）
    g.save();
    g.globalAlpha = 0.22;
    g.strokeStyle = '#e8e4d6';
    g.lineWidth = 2;
    for (var i = 0; i < 5; i++) {
      g.beginPath();
      g.moveTo(w * (0.24 + i * 0.11), hh * 0.16);
      g.lineTo(w * (0.30 + i * 0.11), hh * 0.16);
      g.stroke();
    }
    g.restore();

    // 地板
    g.fillStyle = shade(pal.ground, -0.34);
    g.fillRect(0, hy, w, hh - hy);

    // 课桌：两排
    for (var row = 0; row < 2; row++) {
      var ry = hy + row * hh * 0.16;
      var kw = w * (0.30 + row * 0.10);
      g.fillStyle = shade(pal.ground, -0.14 + row * 0.04);
      g.fillRect(w * 0.5 - kw / 2, ry, kw, hh * 0.022);
      g.fillStyle = shade(pal.ground, -0.40);
      g.fillRect(w * 0.5 - kw / 2 + kw * 0.06, ry + hh * 0.022, kw * 0.02, hh * 0.10);
      g.fillRect(w * 0.5 + kw / 2 - kw * 0.08, ry + hh * 0.022, kw * 0.02, hh * 0.10);
    }

    // 两个同桌：低着头憋笑
    var bob = Math.sin(t * 2.4) * hh * 0.006;
    person(g, w * 0.44, hy + hh * 0.20 + bob, hh * 0.34, 0, { ink: shade(ink, 0.02), sit: true, still: true });
    person(g, w * 0.57, hy + hh * 0.205 - bob, hh * 0.335, 0, { ink: shade(ink, 0.02), sit: true, still: true });

    // 纸条：从左边递到右边
    var k2 = ease(clamp(p * 1.3, 0, 1));
    var px = lerp(w * 0.475, w * 0.535, k2);
    var py = hy + hh * 0.145 - Math.sin(k2 * Math.PI) * hh * 0.03;
    g.save();
    g.translate(px, py);
    g.rotate(0.14);
    g.fillStyle = '#f2ead6';
    g.fillRect(-w * 0.018, -hh * 0.018, w * 0.036, hh * 0.030);
    g.strokeStyle = 'rgba(80,66,50,.3)';
    g.lineWidth = 1;
    g.strokeRect(-w * 0.018, -hh * 0.018, w * 0.036, hh * 0.030);
    g.restore();

    // 靠窗的光
    g.save();
    g.globalCompositeOperation = 'screen';
    g.globalAlpha = 0.20;
    g.fillStyle = hexA(glow, 0.9);
    g.beginPath();
    g.moveTo(w * 0.86, 0); g.lineTo(w, 0); g.lineTo(w, hh); g.lineTo(w * 0.52, hh);
    g.closePath(); g.fill();
    g.restore();

    // 罚站的两个：靠墙站着，肩膀还在抖
    if (p > 0.55) {
      var ap = clamp((p - 0.55) / 0.2, 0, 1);
      g.save();
      g.globalAlpha = ap * 0.9;
      person(g, w * 0.16, hh * 0.965, hh * 0.46, 0, { ink: shade(ink, -0.05), still: true });
      person(g, w * 0.25, hh * 0.968, hh * 0.44, 0, { ink: shade(ink, -0.02), still: true });
      g.restore();
    }

    dust(g, w, hh, t, o.rand, glow, 20);
  };

  /* ---------------- 五 · 病房 ---------------- */

  S.ward = function (g, w, hh, p, t, o) {
    var pal = o.pal, ink = pal.ink;
    var cold = '#dfe6e4';
    g.fillStyle = shade(ink, 0.22);
    g.fillRect(0, 0, w, hh);
    // 冷白的顶灯
    g.save();
    g.globalCompositeOperation = 'screen';
    var cg = g.createRadialGradient(w * 0.46, hh * 0.02, 0, w * 0.46, hh * 0.02, hh * 1.15);
    cg.addColorStop(0, 'rgba(236,244,244,.72)');
    cg.addColorStop(0.4, 'rgba(226,236,236,.24)');
    cg.addColorStop(1, 'rgba(226,236,236,0)');
    g.fillStyle = cg; g.fillRect(0, 0, w, hh);
    g.restore();

    // 水磨石地面
    var fy = hh * 0.72;
    g.fillStyle = '#9aa4a2';
    g.fillRect(0, fy, w, hh - fy);
    g.save();
    g.globalAlpha = 0.25;
    for (var i = 0; i < 160; i++) {
      g.fillStyle = h2(i * 3.1) > 0.5 ? '#cfd8d4' : '#7d8783';
      g.fillRect(h2(i * 5.7) * w, fy + h2(i * 9.3) * (hh - fy), 3, 2);
    }
    g.restore();
    // 地面反光
    glowAt(g, w * 0.55, fy + hh * 0.10, hh * 0.55, cold, 0.22);

    // 病床
    var bx = w * 0.30, bw = w * 0.44, by = hh * 0.56;
    g.fillStyle = '#8f9a97';
    g.fillRect(bx, by, bw, hh * 0.030);
    g.fillStyle = '#c9d2ce';
    g.fillRect(bx - w * 0.008, by - hh * 0.075, bw + w * 0.016, hh * 0.078);
    // 枕头
    g.fillStyle = '#e8eeea';
    g.fillRect(bx + w * 0.010, by - hh * 0.098, w * 0.085, hh * 0.036);
    // 被子下的身形：很薄
    g.fillStyle = '#dde4df';
    g.beginPath();
    g.moveTo(bx + w * 0.10, by - hh * 0.070);
    g.quadraticCurveTo(bx + w * 0.26, by - hh * 0.098, bx + bw * 0.92, by - hh * 0.058);
    g.lineTo(bx + bw * 0.94, by - hh * 0.006);
    g.lineTo(bx + w * 0.10, by - hh * 0.006);
    g.closePath(); g.fill();
    // 床单折痕
    g.strokeStyle = 'rgba(120,132,128,.30)';
    g.lineWidth = 1.2;
    for (var k = 0; k < 5; k++) {
      g.beginPath();
      g.moveTo(bx + w * (0.12 + k * 0.06), by - hh * 0.066);
      g.quadraticCurveTo(bx + w * (0.16 + k * 0.06), by - hh * 0.040, bx + w * (0.13 + k * 0.06), by - hh * 0.010);
      g.stroke();
    }

    // 外婆的头：瘦，头发白
    g.fillStyle = '#e3e8e4';
    g.beginPath(); g.arc(bx + w * 0.055, by - hh * 0.078, hh * 0.030, 0, TAU); g.fill();
    g.fillStyle = '#d8dcd8';
    g.beginPath(); g.arc(bx + w * 0.048, by - hh * 0.090, hh * 0.024, 0, TAU); g.fill();

    // 输液架
    g.strokeStyle = '#7e8a88';
    g.lineWidth = hh * 0.006;
    g.beginPath();
    g.moveTo(bx - w * 0.03, hh * 0.98); g.lineTo(bx - w * 0.03, hh * 0.30);
    g.lineTo(bx + w * 0.02, hh * 0.30);
    g.stroke();
    g.fillStyle = 'rgba(226,240,238,.65)';
    g.beginPath();
    g.ellipse(bx + w * 0.02, hh * 0.335, w * 0.012, hh * 0.028, 0, 0, TAU);
    g.fill();
    // 管子垂到手臂
    g.strokeStyle = 'rgba(236,244,242,.55)';
    g.lineWidth = 1.6;
    g.beginPath();
    g.moveTo(bx + w * 0.02, hh * 0.36);
    g.quadraticCurveTo(bx + w * 0.05, hh * 0.46, bx + w * 0.075, by - hh * 0.060);
    g.stroke();

    // 床头柜 + 搪瓷碗（粥结了一层冷皮）
    var cx = bx + bw + w * 0.035, cy = by - hh * 0.010;
    g.fillStyle = '#a8b2ae';
    g.fillRect(cx, cy, w * 0.075, hh * 0.135);
    g.fillStyle = '#e6ebe7';
    g.beginPath(); g.ellipse(cx + w * 0.037, cy - hh * 0.004, w * 0.040, hh * 0.017, 0, 0, TAU); g.fill();
    g.fillStyle = '#d6cfae';
    g.beginPath(); g.ellipse(cx + w * 0.037, cy - hh * 0.006, w * 0.033, hh * 0.013, 0, 0, TAU); g.fill();
    g.strokeStyle = 'rgba(150,144,110,.6)';
    g.lineWidth = 1;
    g.beginPath();
    g.moveTo(cx + w * 0.014, cy - hh * 0.010);
    g.quadraticCurveTo(cx + w * 0.037, cy - hh * 0.016, cx + w * 0.060, cy - hh * 0.010);
    g.stroke();

    // 窗：外面是阴天
    g.fillStyle = 'rgba(200,212,212,.55)';
    g.fillRect(w * 0.70, hh * 0.10, w * 0.26, hh * 0.40);
    g.strokeStyle = '#8b9694';
    g.lineWidth = hh * 0.010;
    g.strokeRect(w * 0.70, hh * 0.10, w * 0.26, hh * 0.40);
    g.beginPath();
    g.moveTo(w * 0.83, hh * 0.10); g.lineTo(w * 0.83, hh * 0.50);
    g.stroke();

    // 他：站在床尾，一动不动
    person(g, w * 0.80, hh * 0.99, hh * 0.56, 0, { ink: shade(ink, -0.05), still: true, alpha: 0.95 });
    dust(g, w, hh, t, o.rand, '#e8f0ee', 14);
  };

  S.handbowl = function (g, w, hh, p, t, o) {
    var pal = o.pal, ink = pal.ink;
    g.fillStyle = '#b9c3c0';
    g.fillRect(0, 0, w, hh);
    glowAt(g, w * 0.34, hh * 0.20, hh * 0.95, '#f2f8f6', 0.55);
    // 墙面
    g.save();
    g.strokeStyle = 'rgba(226,236,234,.16)';
    g.lineWidth = 1.2;
    for (var i = 0; i < 7; i++) {
      g.beginPath(); g.moveTo(0, i * hh * 0.11); g.lineTo(w, i * hh * 0.11); g.stroke();
    }
    g.restore();

    // 被子盖到胸口，褶皱很深
    g.fillStyle = '#e2e8e4';
    g.beginPath();
    g.moveTo(0, hh * 0.34);
    g.quadraticCurveTo(w * 0.34, hh * 0.26, w * 0.66, hh * 0.34);
    g.quadraticCurveTo(w * 0.88, hh * 0.40, w, hh * 0.36);
    g.lineTo(w, hh); g.lineTo(0, hh); g.closePath(); g.fill();
    g.save();
    g.strokeStyle = 'rgba(140,152,148,.34)';
    g.lineWidth = 2;
    for (var k = 0; k < 8; k++) {
      g.beginPath();
      g.moveTo(-20, hh * (0.44 + k * 0.07));
      g.quadraticCurveTo(w * 0.4, hh * (0.40 + k * 0.07), w + 20, hh * (0.48 + k * 0.07));
      g.stroke();
    }
    g.restore();
    // 被子投下的阴影
    g.save();
    g.globalCompositeOperation = 'multiply';
    var sg2 = g.createLinearGradient(0, hh * 0.30, 0, hh * 0.44);
    sg2.addColorStop(0, 'rgba(120,136,132,.55)');
    sg2.addColorStop(1, 'rgba(120,136,132,0)');
    g.fillStyle = sg2;
    g.fillRect(0, hh * 0.30, w, hh * 0.16);
    g.restore();

    // 手臂与手背：瘦得能看见骨头，青筋浮起来，一片一片的淤青
    var hx = w * 0.26, hy = hh * 0.52;
    g.save();
    // 小臂从画面左边伸进来
    g.strokeStyle = '#d3bda8';
    g.lineWidth = hh * 0.135;
    g.lineCap = 'butt';
    g.beginPath();
    g.moveTo(-w * 0.05, hy + hh * 0.175);
    g.lineTo(hx - w * 0.055, hy + hh * 0.030);
    g.stroke();
    // 腕
    g.fillStyle = '#d8c3ae';
    g.beginPath();
    g.ellipse(hx - w * 0.050, hy + hh * 0.012, w * 0.036, hh * 0.052, 0.35, 0, TAU);
    g.fill();
    // 手背
    g.fillStyle = '#e0cdb9';
    g.beginPath();
    g.moveTo(hx - w * 0.070, hy - hh * 0.032);
    g.quadraticCurveTo(hx - w * 0.010, hy - hh * 0.058, hx + w * 0.052, hy - hh * 0.040);
    g.quadraticCurveTo(hx + w * 0.098, hy - hh * 0.028, hx + w * 0.104, hy + hh * 0.004);
    g.quadraticCurveTo(hx + w * 0.060, hy + hh * 0.056, hx - w * 0.006, hy + hh * 0.062);
    g.quadraticCurveTo(hx - w * 0.052, hy + hh * 0.058, hx - w * 0.070, hy - hh * 0.032);
    g.closePath(); g.fill();

    // 四根手指：一节一节，指尖朝右，微微向下扣着
    for (var f = 0; f < 4; f++) {
      var baseY = hy - hh * 0.018 + f * hh * 0.024;
      var len = w * (0.086 - f * 0.010);
      var droop = hh * (0.006 + f * 0.004);
      g.save();
      g.strokeStyle = f % 2 ? '#ddc8b2' : '#d5bfa8';
      g.lineWidth = hh * (0.026 - f * 0.002);
      g.lineCap = 'round';
      // 第一节
      g.beginPath();
      g.moveTo(hx + w * 0.070, baseY);
      g.quadraticCurveTo(hx + w * 0.070 + len * 0.55, baseY - hh * 0.004, hx + w * 0.070 + len * 0.62, baseY + droop * 0.5);
      g.stroke();
      // 第二节
      g.beginPath();
      g.moveTo(hx + w * 0.070 + len * 0.62, baseY + droop * 0.5);
      g.quadraticCurveTo(hx + w * 0.070 + len * 0.95, baseY + droop * 0.8, hx + w * 0.070 + len, baseY + droop * 1.5);
      g.stroke();
      // 指节的暗
      g.strokeStyle = 'rgba(150,120,96,.35)';
      g.lineWidth = 1.2;
      g.beginPath();
      g.moveTo(hx + w * 0.070 + len * 0.60, baseY - hh * 0.008);
      g.lineTo(hx + w * 0.070 + len * 0.62, baseY + droop * 0.5 + hh * 0.010);
      g.stroke();
      g.restore();
    }
    // 拇指扣在下面
    g.strokeStyle = '#d8c3ae';
    g.lineWidth = hh * 0.030;
    g.beginPath();
    g.moveTo(hx - w * 0.010, hy + hh * 0.040);
    g.quadraticCurveTo(hx + w * 0.040, hy + hh * 0.072, hx + w * 0.076, hy + hh * 0.060);
    g.stroke();

    // 青筋
    g.strokeStyle = 'rgba(118,128,150,.32)';
    g.lineWidth = 1.8;
    g.beginPath();
    g.moveTo(hx - w * 0.060, hy + hh * 0.040);
    g.quadraticCurveTo(hx - w * 0.010, hy - hh * 0.010, hx + w * 0.055, hy - hh * 0.020);
    g.stroke();
    g.beginPath();
    g.moveTo(hx - w * 0.048, hy + hh * 0.052);
    g.quadraticCurveTo(hx + w * 0.004, hy + hh * 0.006, hx + w * 0.062, hy + hh * 0.000);
    g.stroke();

    // 淤青：一片一片，不是一颗一颗的点
    g.save();
    g.globalCompositeOperation = 'multiply';
    for (var b = 0; b < 6; b++) {
      var bx2 = hx - w * (0.045 - h2(b * 3.7) * 0.085);
      var by2 = hy - hh * (0.020 - h2(b * 7.1) * 0.060);
      var br2 = w * (0.020 + h2(b) * 0.024);
      var rg2 = g.createRadialGradient(bx2, by2, 0, bx2, by2, br2);
      rg2.addColorStop(0, 'rgba(92,80,112,.34)');
      rg2.addColorStop(0.55, 'rgba(104,92,124,.18)');
      rg2.addColorStop(1, 'rgba(104,92,124,0)');
      g.fillStyle = rg2;
      g.beginPath(); g.arc(bx2, by2, br2, 0, TAU); g.fill();
    }
    g.restore();

    // 胶布 + 留置针 + 管子
    g.save();
    g.translate(hx + w * 0.010, hy - hh * 0.030);
    g.rotate(-0.10);
    g.fillStyle = 'rgba(246,244,234,.82)';
    g.fillRect(-w * 0.038, -hh * 0.016, w * 0.076, hh * 0.032);
    g.fillStyle = 'rgba(180,190,186,.45)';
    g.fillRect(-w * 0.004, -hh * 0.010, w * 0.010, hh * 0.020);
    g.restore();
    g.strokeStyle = 'rgba(238,246,244,.6)';
    g.lineWidth = 2;
    g.beginPath();
    g.moveTo(hx + w * 0.010, hy - hh * 0.044);
    g.quadraticCurveTo(hx + w * 0.030, -hh * 0.02, hx + w * 0.090, -hh * 0.05);
    g.stroke();
    g.restore();

    // 搪瓷碗：就在床边，粥凉透了
    var cx = w * 0.74, cy = hh * 0.50, cw = w * 0.105;
    shadowAt(g, cx + cw * 0.2, cy + hh * 0.085, cw * 1.6, 0.30);
    g.fillStyle = '#eef2ee';
    g.beginPath();
    g.moveTo(cx - cw, cy - hh * 0.020);
    g.quadraticCurveTo(cx - cw * 0.92, cy + hh * 0.090, cx, cy + hh * 0.098);
    g.quadraticCurveTo(cx + cw * 0.92, cy + hh * 0.090, cx + cw, cy - hh * 0.020);
    g.closePath(); g.fill();
    g.fillStyle = '#f6f8f2';
    g.beginPath(); g.ellipse(cx, cy - hh * 0.020, cw, hh * 0.030, 0, 0, TAU); g.fill();
    // 掉漆的几块
    g.fillStyle = '#6b6156';
    g.beginPath(); g.ellipse(cx + cw * 0.42, cy + hh * 0.022, cw * 0.16, hh * 0.014, 0.5, 0, TAU); g.fill();
    g.beginPath(); g.ellipse(cx - cw * 0.55, cy + hh * 0.010, cw * 0.10, hh * 0.009, -0.3, 0, TAU); g.fill();
    // 冷粥结的那层皮
    g.fillStyle = '#d8cdac';
    g.beginPath(); g.ellipse(cx, cy - hh * 0.021, cw * 0.88, hh * 0.024, 0, 0, TAU); g.fill();
    g.save();
    g.strokeStyle = 'rgba(150,140,108,.65)';
    g.lineWidth = 1.2;
    for (var m = 0; m < 5; m++) {
      g.beginPath();
      g.moveTo(cx - cw * 0.72, cy - hh * 0.028 + m * hh * 0.008);
      g.quadraticCurveTo(cx, cy - hh * 0.038 + m * hh * 0.008, cx + cw * 0.72, cy - hh * 0.024 + m * hh * 0.008);
      g.stroke();
    }
    g.restore();
    // 碗口的一点冷光
    g.strokeStyle = 'rgba(255,255,255,.55)';
    g.lineWidth = 1.6;
    g.beginPath(); g.ellipse(cx, cy - hh * 0.020, cw, hh * 0.030, 0, 3.6, 5.6); g.stroke();

    dust(g, w, hh, t, o.rand, '#eef6f4', 10);
  };

  S.sink = function (g, w, hh, p, t, o) {
    var pal = o.pal, ink = pal.ink;
    g.fillStyle = '#7d8a8a';
    g.fillRect(0, 0, w, hh);
    glowAt(g, w * 0.5, hh * 0.10, hh * 1.0, '#e8f2f0', 0.42);

    // 瓷砖墙
    g.save();
    g.strokeStyle = 'rgba(226,236,236,.16)';
    g.lineWidth = 1.2;
    for (var r = 0; r < 8; r++) {
      g.beginPath(); g.moveTo(0, r * hh * 0.10); g.lineTo(w, r * hh * 0.10); g.stroke();
    }
    for (var c = 0; c < 10; c++) {
      g.beginPath(); g.moveTo(c * w * 0.10, 0); g.lineTo(c * w * 0.10, hh * 0.80); g.stroke();
    }
    g.restore();

    // 镜子：雾还没散，里面是自己的脸
    var mx = w * 0.26, my = hh * 0.05, mw = w * 0.48, mhh = hh * 0.46;
    g.fillStyle = '#5d6766';
    g.fillRect(mx, my, mw, mhh);
    // 镜里的肩、脖子、头
    var fx = mx + mw * 0.5, fy = my + mhh * 0.60;
    g.save();
    g.fillStyle = 'rgba(52,54,52,.55)';
    g.beginPath();
    g.moveTo(fx - mw * 0.34, my + mhh);
    g.quadraticCurveTo(fx - mw * 0.26, my + mhh * 0.72, fx - mw * 0.10, my + mhh * 0.68);
    g.quadraticCurveTo(fx - mw * 0.075, my + mhh * 0.52, fx - mw * 0.075, my + mhh * 0.46);
    g.lineTo(fx + mw * 0.075, my + mhh * 0.46);
    g.quadraticCurveTo(fx + mw * 0.075, my + mhh * 0.52, fx + mw * 0.10, my + mhh * 0.68);
    g.quadraticCurveTo(fx + mw * 0.26, my + mhh * 0.72, fx + mw * 0.34, my + mhh);
    g.closePath(); g.fill();
    // 头
    g.fillStyle = 'rgba(150,128,112,.62)';
    g.beginPath(); g.ellipse(fx, my + mhh * 0.36, mw * 0.098, mhh * 0.155, 0, 0, TAU); g.fill();
    // 湿头发
    g.fillStyle = 'rgba(40,38,36,.55)';
    g.beginPath();
    g.ellipse(fx, my + mhh * 0.23, mw * 0.104, mhh * 0.09, 0, Math.PI, TAU);
    g.fill();
    // 通红的眼眶：两道红，不是两个红点
    g.save();
    g.globalCompositeOperation = 'multiply';
    g.fillStyle = 'rgba(168,72,58,.55)';
    g.beginPath(); g.ellipse(fx - mw * 0.042, my + mhh * 0.35, mw * 0.030, mhh * 0.016, -0.1, 0, TAU); g.fill();
    g.beginPath(); g.ellipse(fx + mw * 0.042, my + mhh * 0.35, mw * 0.030, mhh * 0.016, 0.1, 0, TAU); g.fill();
    g.restore();
    // 闭着的眼睛
    g.strokeStyle = 'rgba(44,40,38,.5)';
    g.lineWidth = 1.6;
    g.beginPath();
    g.moveTo(fx - mw * 0.060, my + mhh * 0.35); g.lineTo(fx - mw * 0.024, my + mhh * 0.352);
    g.moveTo(fx + mw * 0.024, my + mhh * 0.352); g.lineTo(fx + mw * 0.060, my + mhh * 0.35);
    g.stroke();
    g.restore();
    // 雾
    g.fillStyle = 'rgba(230,238,236,.62)';
    g.fillRect(mx, my, mw, mhh);
    // 雾的浓淡
    g.save();
    for (var d = 0; d < 22; d++) {
      g.globalAlpha = 0.05 + h2(d) * 0.06;
      g.fillStyle = '#ffffff';
      g.beginPath();
      g.ellipse(mx + h2(d * 3.7) * mw, my + h2(d * 7.3) * mhh, mw * 0.22, mhh * 0.16, 0, 0, TAU);
      g.fill();
    }
    g.restore();
    // 镜框
    g.strokeStyle = '#6a7472';
    g.lineWidth = hh * 0.011;
    g.strokeRect(mx, my, mw, mhh);
    // 水珠往下淌
    g.save();
    g.fillStyle = 'rgba(250,252,250,.42)';
    for (var q = 0; q < 14; q++) {
      var dx = mx + h2(q * 4.3) * mw;
      var dy = my + ((h2(q * 8.1) * mhh + t * 10) % mhh);
      g.beginPath(); g.ellipse(dx, dy, 1.4, 4 + h2(q) * 7, 0, 0, TAU); g.fill();
    }
    g.restore();

    // 洗手盆
    var sx = w * 0.50, sy = hh * 0.70;
    g.fillStyle = '#c4cecb';
    g.beginPath();
    g.moveTo(sx - w * 0.14, sy - hh * 0.03);
    g.quadraticCurveTo(sx, sy + hh * 0.15, sx + w * 0.14, sy - hh * 0.03);
    g.closePath(); g.fill();
    g.fillStyle = '#dfe7e4';
    g.beginPath(); g.ellipse(sx, sy - hh * 0.032, w * 0.138, hh * 0.040, 0, 0, TAU); g.fill();
    g.fillStyle = '#aab5b2';
    g.beginPath(); g.ellipse(sx, sy - hh * 0.030, w * 0.104, hh * 0.029, 0, 0, TAU); g.fill();
    // 龙头
    g.strokeStyle = '#9aa5a2';
    g.lineWidth = hh * 0.015;
    g.lineCap = 'round';
    g.beginPath();
    g.moveTo(sx, sy - hh * 0.062);
    g.lineTo(sx, sy - hh * 0.125);
    g.quadraticCurveTo(sx, sy - hh * 0.146, sx + w * 0.024, sy - hh * 0.142);
    g.stroke();
    // 冷水
    g.save();
    g.strokeStyle = 'rgba(226,244,246,.55)';
    g.lineWidth = hh * 0.009;
    for (var k = 0; k < 3; k++) {
      g.beginPath();
      g.moveTo(sx + w * 0.024 + k * 1.6, sy - hh * 0.136);
      g.lineTo(sx + w * 0.020 + Math.sin(t * 7 + k) * 1.4, sy - hh * 0.030);
      g.stroke();
    }
    // 溅起来的水花
    g.globalAlpha = 0.5;
    g.fillStyle = '#eef6f6';
    for (var sp = 0; sp < 8; sp++) {
      g.beginPath();
      g.arc(sx + w * 0.020 + (h2(sp * 3.1) - 0.5) * w * 0.05, sy - hh * 0.028, 1 + h2(sp) * 2, 0, TAU);
      g.fill();
    }
    g.restore();

    // 一只手撑在盆沿，指节发白
    g.save();
    g.fillStyle = 'rgba(176,146,124,.55)';
    g.beginPath();
    g.ellipse(sx - w * 0.115, sy - hh * 0.005, w * 0.050, hh * 0.022, -0.18, 0, TAU);
    g.fill();
    g.restore();
  };

  /* ---------------- 六 · 宿舍 / 食堂 ---------------- */

  S.dorm = function (g, w, hh, p, t, o) {
    var pal = o.pal, ink = pal.ink;
    g.fillStyle = shade(ink, 0.14);
    g.fillRect(0, 0, w, hh);
    // 窗外路灯
    var wx = w * 0.62, wy = hh * 0.10, ww = w * 0.26, whh = hh * 0.34;
    var wg = g.createLinearGradient(wx, wy, wx, wy + whh);
    wg.addColorStop(0, 'rgba(126,146,170,.65)');
    wg.addColorStop(1, 'rgba(96,112,132,.45)');
    g.fillStyle = wg;
    g.fillRect(wx, wy, ww, whh);
    glowAt(g, wx + ww * 0.7, wy + whh * 0.2, hh * 0.5, '#a8c0d8', 0.28);
    g.strokeStyle = shade(ink, -0.2);
    g.lineWidth = hh * 0.010;
    g.strokeRect(wx, wy, ww, whh);
    g.beginPath(); g.moveTo(wx + ww / 2, wy); g.lineTo(wx + ww / 2, wy + whh); g.stroke();

    // 窗光铺在地上
    g.save();
    g.globalCompositeOperation = 'screen';
    g.globalAlpha = 0.16;
    g.fillStyle = '#b8ccdc';
    g.beginPath();
    g.moveTo(wx, wy + whh); g.lineTo(wx + ww, wy + whh);
    g.lineTo(wx + ww - w * 0.06, hh); g.lineTo(wx - w * 0.10, hh);
    g.closePath(); g.fill();
    g.restore();

    // 上下铺的床架
    g.strokeStyle = 'rgba(70,80,88,.85)';
    g.lineWidth = hh * 0.010;
    g.beginPath();
    g.moveTo(w * 0.04, hh * 0.22); g.lineTo(w * 0.04, hh * 0.96);
    g.moveTo(w * 0.50, hh * 0.22); g.lineTo(w * 0.50, hh * 0.96);
    g.stroke();
    // 上铺
    g.fillStyle = 'rgba(120,132,142,.45)';
    g.fillRect(w * 0.04, hh * 0.22, w * 0.46, hh * 0.022);
    g.fillStyle = 'rgba(150,164,176,.32)';
    g.fillRect(w * 0.06, hh * 0.15, w * 0.42, hh * 0.070);

    // 下铺：他躺着，脸烧得通红，一声不吭
    var by = hh * 0.74;
    g.fillStyle = 'rgba(110,122,132,.30)';
    g.fillRect(w * 0.04, by, w * 0.46, hh * 0.014);
    g.fillStyle = 'rgba(186,198,208,.55)';
    g.beginPath();
    g.moveTo(w * 0.06, by - hh * 0.030);
    g.quadraticCurveTo(w * 0.24, by - hh * 0.070, w * 0.48, by - hh * 0.026);
    g.lineTo(w * 0.48, by); g.lineTo(w * 0.06, by);
    g.closePath(); g.fill();
    // 头
    g.fillStyle = 'rgba(196,150,132,.75)';
    g.beginPath(); g.arc(w * 0.075, by - hh * 0.048, hh * 0.030, 0, TAU); g.fill();
    // 额头的一点暗红（发烧）
    g.fillStyle = 'rgba(160,70,54,.35)';
    g.beginPath(); g.ellipse(w * 0.082, by - hh * 0.056, hh * 0.022, hh * 0.014, 0, 0, TAU); g.fill();

    // 桌子 + 那只被轻轻放下的搪瓷杯
    var tx = w * 0.62, ty = hh * 0.70;
    g.fillStyle = 'rgba(88,96,104,.85)';
    g.fillRect(tx, ty, w * 0.24, hh * 0.014);
    g.fillRect(tx + w * 0.02, ty + hh * 0.014, w * 0.012, hh * 0.26);
    g.fillRect(tx + w * 0.21, ty + hh * 0.014, w * 0.012, hh * 0.26);
    var cupA = clamp((p - 0.28) / 0.25, 0, 1);
    if (cupA > 0.02) {
      g.save();
      g.globalAlpha = cupA;
      var cupX = tx + w * 0.13, cupY = ty;
      g.fillStyle = '#e8ece8';
      g.beginPath();
      g.moveTo(cupX - w * 0.020, cupY - hh * 0.055);
      g.lineTo(cupX + w * 0.020, cupY - hh * 0.055);
      g.lineTo(cupX + w * 0.016, cupY - hh * 0.004);
      g.lineTo(cupX - w * 0.016, cupY - hh * 0.004);
      g.closePath(); g.fill();
      g.fillStyle = '#cfd8d4';
      g.beginPath(); g.ellipse(cupX, cupY - hh * 0.055, w * 0.020, hh * 0.007, 0, 0, TAU); g.fill();
      glowAt(g, cupX, cupY - hh * 0.050, w * 0.05, '#eaf2f2', 0.28 * cupA);
      g.restore();
    }

    // 小赵：只画半个背影，站在床边
    g.save();
    g.globalAlpha = 0.9;
    person(g, w * 0.55, hh * 0.96, hh * 0.52, 0, { ink: shade(ink, 0.02), still: true });
    g.restore();

    dust(g, w, hh, t, o.rand, '#c8d8e4', 12);
  };

  S.cupwater = function (g, w, hh, p, t, o) {
    var pal = o.pal, ink = pal.ink;
    g.fillStyle = shade(ink, 0.10);
    g.fillRect(0, 0, w, hh);
    glowAt(g, w * 0.56, hh * 0.30, hh * 0.85, '#cfe0ea', 0.30);
    // 桌面
    g.fillStyle = shade(pal.ground, -0.44);
    g.fillRect(0, hh * 0.66, w, hh * 0.34);
    g.fillStyle = shade(pal.ground, -0.30);
    g.fillRect(0, hh * 0.66, w, hh * 0.012);
    woodGrain(g, w, hh, hh * 0.66, '#000', 8, 0.18);

    // 杯子：白搪瓷，杯口磕掉一块
    var cx = w * 0.52, cy = hh * 0.66, cw = w * 0.115, chh = hh * 0.24;
    g.save();
    shadowAt(g, cx + cw * 0.15, cy + hh * 0.01, cw * 1.8, 0.42);
    g.fillStyle = '#e9eee9';
    g.beginPath();
    g.moveTo(cx - cw, cy - chh);
    g.lineTo(cx + cw, cy - chh);
    g.lineTo(cx + cw * 0.86, cy);
    g.quadraticCurveTo(cx, cy + hh * 0.018, cx - cw * 0.86, cy);
    g.closePath(); g.fill();
    // 杯口
    g.fillStyle = '#f2f6f1';
    g.beginPath(); g.ellipse(cx, cy - chh, cw, hh * 0.026, 0, 0, TAU); g.fill();
    g.fillStyle = 'rgba(90,96,92,.35)';
    g.beginPath(); g.ellipse(cx, cy - chh, cw * 0.88, hh * 0.020, 0, 0, TAU); g.fill();
    // 缺口
    g.save();
    g.globalCompositeOperation = 'destination-out';
    g.beginPath();
    g.moveTo(cx + cw * 0.42, cy - chh - hh * 0.010);
    g.lineTo(cx + cw * 0.78, cy - chh - hh * 0.004);
    g.lineTo(cx + cw * 0.62, cy - chh + hh * 0.014);
    g.closePath(); g.fill();
    g.restore();
    // 杯身上的一点反光
    g.globalAlpha = 0.5;
    g.fillStyle = '#ffffff';
    g.fillRect(cx - cw * 0.55, cy - chh * 0.85, cw * 0.10, chh * 0.70);
    g.restore();

    // 水汽
    steam(g, cx, cy - chh, cw * 1.6, hh * 0.20, t, 5, 0.26);

    // 手刚收回去（画面右缘）
    g.save();
    g.globalAlpha = 0.8;
    g.fillStyle = shade(ink, 0.06);
    g.beginPath();
    g.ellipse(w * 0.90, cy - chh * 0.30, w * 0.085, hh * 0.045, -0.25, 0, TAU);
    g.fill();
    g.restore();
  };

  S.canteen = function (g, w, hh, p, t, o) {
    var pal = o.pal, ink = pal.ink;
    var hy = hh * 0.62;
    g.fillStyle = shade(ink, 0.20);
    g.fillRect(0, 0, w, hh);
    // 大窗：外面是白的
    var wx = w * 0.05, wy = hh * 0.02, ww = w * 0.90, wh = hh * 0.36;
    var wg = g.createLinearGradient(wx, wy, wx, wy + wh);
    wg.addColorStop(0, 'rgba(228,234,228,.92)');
    wg.addColorStop(1, 'rgba(176,188,182,.70)');
    g.fillStyle = wg;
    g.fillRect(wx, wy, ww, wh);
    g.strokeStyle = shade(ink, 0.02);
    g.lineWidth = hh * 0.007;
    for (var i = 1; i < 5; i++) {
      g.beginPath();
      g.moveTo(wx + i * ww / 5, wy); g.lineTo(wx + i * ww / 5, wy + wh);
      g.stroke();
    }
    g.strokeRect(wx, wy, ww, wh);
    // 窗光扑进来
    g.save();
    g.globalCompositeOperation = 'screen';
    g.globalAlpha = 0.14;
    g.fillStyle = '#f6f8f0';
    g.beginPath();
    g.moveTo(wx, wy + wh); g.lineTo(wx + ww, wy + wh);
    g.lineTo(w * 1.1, hh); g.lineTo(-w * 0.1, hh);
    g.closePath(); g.fill();
    g.restore();

    // 地面
    g.fillStyle = shade(pal.ground, -0.36);
    g.fillRect(0, hy, w, hh - hy);
    // 室内整体压暗，窗户才亮得起来
    g.save();
    g.globalCompositeOperation = 'multiply';
    var dg = g.createLinearGradient(0, 0, 0, hh);
    dg.addColorStop(0, 'rgba(96,96,88,.55)');
    dg.addColorStop(0.42, 'rgba(120,118,108,.75)');
    dg.addColorStop(1, 'rgba(70,68,62,.80)');
    g.fillStyle = dg;
    g.fillRect(0, 0, w, hh);
    g.restore();

    // 后排：一群人吃饭、说话
    for (var m = 0; m < 9; m++) {
      var dx = w * (0.02 + h2(m * 4.7) * 0.96);
      var dy = hy + h2(m * 8.3) * hh * 0.10;
      var sc = hh * (0.30 + h2(m * 2.3) * 0.10);
      person(g, dx, dy, sc, 0, { ink: shade(ink, 0.10), sit: true, still: true, alpha: 0.9 });
    }
    // 长桌
    for (var r = 0; r < 2; r++) {
      var ry = hy + hh * (0.10 + r * 0.13);
      g.fillStyle = shade(pal.ground, -0.20 + r * 0.05);
      g.fillRect(-w * 0.02 + r * w * 0.02, ry, w * (1.04 - r * 0.04), hh * 0.026);
      g.fillStyle = 'rgba(255,255,255,.10)';
      g.fillRect(-w * 0.02 + r * w * 0.02, ry, w * (1.04 - r * 0.04), hh * 0.006);
    }
    // 桌上的餐盘
    g.save();
    for (var k = 0; k < 8; k++) {
      var px = w * (0.04 + k * 0.125);
      var py = hy + hh * (0.085 + (k % 2) * 0.13);
      g.fillStyle = 'rgba(226,228,220,.55)';
      g.beginPath(); g.ellipse(px, py, w * 0.022, hh * 0.008, 0, 0, TAU); g.fill();
    }
    g.restore();
    // 蒸汽
    for (var s2 = 0; s2 < 3; s2++) {
      steam(g, w * (0.20 + s2 * 0.28), hy + hh * 0.06, w * 0.10, hh * 0.13, t + s2, 3, 0.16);
    }

    // 前景：他站着，手机贴在耳边，周围全是笑声
    var px2 = w * 0.38, py2 = hh * 1.04;
    shadowAt(g, px2, hh * 0.99, hh * 0.22, 0.30);
    person(g, px2, py2, hh * 0.70, 0, { ink: shade(ink, -0.16), still: true, gesture: 'hand' });
    g.fillStyle = shade(ink, -0.20);
    g.fillRect(px2 + hh * 0.082, py2 - hh * 0.50, hh * 0.020, hh * 0.060);
    g.fillStyle = 'rgba(190,214,226,.35)';
    g.fillRect(px2 + hh * 0.084, py2 - hh * 0.496, hh * 0.016, hh * 0.052);

    // 左右两侧压暗，把注意力收到中间
    g.save();
    var lg = g.createLinearGradient(0, 0, w * 0.22, 0);
    lg.addColorStop(0, 'rgba(10,10,9,.45)');
    lg.addColorStop(1, 'rgba(10,10,9,0)');
    g.fillStyle = lg;
    g.fillRect(0, 0, w * 0.3, hh);
    var rg4 = g.createLinearGradient(w, 0, w * 0.78, 0);
    rg4.addColorStop(0, 'rgba(10,10,9,.45)');
    rg4.addColorStop(1, 'rgba(10,10,9,0)');
    g.fillStyle = rg4;
    g.fillRect(w * 0.7, 0, w * 0.3, hh);
    g.restore();
  };

  S.phone = function (g, w, hh, p, t, o) {
    var pal = o.pal, ink = pal.ink;
    g.fillStyle = shade(ink, 0.20);
    g.fillRect(0, 0, w, hh);
    // 虚焦的人群
    for (var i = 0; i < 10; i++) {
      var bx = h2(i * 3.9) * w, by = hh * (0.30 + h2(i * 8.7) * 0.50);
      g.save();
      g.globalAlpha = 0.16;
      g.fillStyle = shade(ink, -0.05);
      g.beginPath(); g.ellipse(bx, by, w * 0.03, hh * 0.09, 0, 0, TAU); g.fill();
      g.beginPath(); g.arc(bx, by - hh * 0.10, w * 0.016, 0, TAU); g.fill();
      g.restore();
    }
    glowAt(g, w * 0.30, hh * 0.34, hh * 0.9, '#ffe6bd', 0.18);

    // 侧脸：耳朵贴着手机
    var cx = w * 0.42, cy = hh * 0.50, r = hh * 0.24;
    g.fillStyle = shade(ink, 0.02);
    g.beginPath();
    g.moveTo(cx - r * 0.9, cy + r * 2.6);
    g.lineTo(cx - r * 0.9, cy + r * 0.4);
    g.bezierCurveTo(cx - r * 0.95, cy - r * 0.55, cx - r * 0.35, cy - r * 1.02, cx + r * 0.18, cy - r * 0.92);
    g.bezierCurveTo(cx + r * 0.78, cy - r * 0.82, cx + r * 0.86, cy - r * 0.10, cx + r * 0.70, cy + r * 0.30);
    g.lineTo(cx + r * 0.95, cy + r * 2.6);
    g.closePath(); g.fill();
    // 手机
    g.fillStyle = '#20242a';
    g.fillRect(cx - r * 0.52, cy - r * 0.34, r * 0.26, r * 0.78);
    g.fillStyle = 'rgba(180,210,230,.5)';
    g.fillRect(cx - r * 0.50, cy - r * 0.31, r * 0.22, r * 0.70);
    // 手
    g.strokeStyle = shade(ink, -0.02);
    g.lineWidth = r * 0.20;
    g.lineCap = 'round';
    g.beginPath();
    g.moveTo(cx - r * 0.42, cy + r * 0.42);
    g.lineTo(cx - r * 1.0, cy + r * 1.30);
    g.stroke();

    // 背景虚化成一片暖光
    g.save();
    g.globalCompositeOperation = 'screen';
    g.globalAlpha = 0.14;
    g.fillStyle = '#ffd9a0';
    g.fillRect(0, 0, w, hh);
    g.restore();
  };

  /* ---------------- 七 · 围挡 / 镜子 / 柜子 ---------------- */

  S.fence = function (g, w, hh, p, t, o) {
    var pal = o.pal, ink = pal.ink;
    var hy = hh * 0.74;
    g.fillStyle = shade(ink, 0.34);
    g.fillRect(0, 0, w, hh);
    // 天光
    glowAt(g, w * 0.5, hh * 0.08, hh * 0.85, '#c8ccc0', 0.30);

    // 蓝色铁皮围挡
    var fy = hh * 0.10;
    g.fillStyle = '#2d4f68';
    g.fillRect(0, fy, w, hy - fy);
    // 竖向瓦楞
    g.save();
    for (var i = 0; i < 46; i++) {
      var x = i * (w / 46);
      var v = Math.sin(i * 1.7) * 0.5 + 0.5;
      g.fillStyle = 'rgba(255,255,255,' + (0.02 + v * 0.05).toFixed(3) + ')';
      g.fillRect(x, fy, w / 90, hy - fy);
      g.fillStyle = 'rgba(0,0,0,' + (0.04 + (1 - v) * 0.06).toFixed(3) + ')';
      g.fillRect(x + w / 90, fy, w / 120, hy - fy);
    }
    g.restore();
    // 顶沿与锈
    g.fillStyle = 'rgba(20,34,46,.85)';
    g.fillRect(0, fy - hh * 0.010, w, hh * 0.016);
    g.save();
    g.globalAlpha = 0.28;
    g.fillStyle = '#8a5a34';
    for (var r = 0; r < 26; r++) {
      var rx = h2(r * 3.3) * w, ry2 = fy + h2(r * 7.7) * (hy - fy);
      g.beginPath(); g.ellipse(rx, ry2, 2 + h2(r) * 7, 1 + h2(r * 2) * 4, 0, 0, TAU); g.fill();
    }
    g.restore();

    // 中间的缝：露出一截被铲断的树根
    var gapX = w * 0.56, gapW = w * 0.055;
    g.fillStyle = '#12100e';
    g.fillRect(gapX, fy, gapW, hy - fy);
    g.fillStyle = '#e6dcc6';
    g.beginPath();
    g.ellipse(gapX + gapW * 0.5, hy - hh * 0.16, gapW * 0.34, hh * 0.055, 0.1, 0, TAU);
    g.fill();
    g.strokeStyle = 'rgba(160,140,108,.55)';
    g.lineWidth = 1;
    for (var q = 0; q < 3; q++) {
      g.beginPath();
      g.ellipse(gapX + gapW * 0.5, hy - hh * 0.16, gapW * (0.10 + q * 0.09), hh * (0.016 + q * 0.014), 0.1, 0, TAU);
      g.stroke();
    }

    // 拆迁公告：风一吹，边角来回掀
    var px = w * 0.24, py = fy + hh * 0.10, pw = w * 0.11, ph = hh * 0.20;
    var flap = Math.sin(t * 1.1) * 0.03;
    g.save();
    g.translate(px + pw / 2, py + ph / 2);
    g.rotate(flap);
    g.fillStyle = '#e8e4d8';
    g.fillRect(-pw / 2, -ph / 2, pw, ph);
    g.fillStyle = 'rgba(60,58,54,.75)';
    for (var l = 0; l < 7; l++) {
      g.fillRect(-pw * 0.36, -ph * 0.34 + l * ph * 0.10, pw * (0.3 + h2(l * 5.1) * 0.5), 1.6);
    }
    g.fillStyle = 'rgba(150,40,34,.55)';
    g.beginPath(); g.arc(pw * 0.26, ph * 0.28, pw * 0.10, 0, TAU); g.fill();
    g.restore();

    // 地面：碎砖、枯叶
    g.fillStyle = '#5b554a';
    g.fillRect(0, hy, w, hh - hy);
    g.save();
    g.globalAlpha = 0.5;
    for (var k = 0; k < 40; k++) {
      g.fillStyle = h2(k * 3.1) > 0.5 ? '#6e6759' : '#4a453c';
      g.fillRect(h2(k * 7.3) * w, hy + h2(k * 9.1) * (hh - hy), 4 + h2(k) * 10, 3 + h2(k * 2) * 5);
    }
    g.restore();

    // 他：站在铁皮墙外，很小
    person(g, w * 0.80, hh * 0.965, hh * 0.38, 0, { ink: shade(ink, -0.12), still: true });

    dust(g, w, hh, t, o.rand, '#d8d2c0', 14);
  };

  S.rootclose = function (g, w, hh, p, t, o) {
    var pal = o.pal, ink = pal.ink;
    g.fillStyle = '#171310';
    g.fillRect(0, 0, w, hh);
    // 缝隙里透进来的光
    glowAt(g, w * 0.52, hh * 0.30, hh * 0.75, '#cfd2c2', 0.34);
    // 铁皮边
    g.fillStyle = '#243a4c';
    g.fillRect(0, 0, w * 0.20, hh);
    g.fillRect(w * 0.80, 0, w * 0.20, hh);

    // 断根：新鲜、发白的断面
    var cx = w * 0.50, cy = hh * 0.52, rx = w * 0.20, ry = hh * 0.30;
    g.save();
    g.fillStyle = '#8a7454';
    g.beginPath(); g.ellipse(cx, cy, rx * 1.10, ry * 1.12, 0.06, 0, TAU); g.fill();
    g.fillStyle = '#e8dfc8';
    g.beginPath(); g.ellipse(cx, cy, rx, ry, 0.06, 0, TAU); g.fill();
    // 年轮
    g.strokeStyle = 'rgba(160,140,104,.45)';
    for (var i = 1; i <= 7; i++) {
      g.lineWidth = i % 2 ? 1.6 : 1;
      g.beginPath();
      g.ellipse(cx, cy, rx * (i / 8), ry * (i / 8), 0.06, 0, TAU);
      g.stroke();
    }
    // 锯痕与裂纹
    g.strokeStyle = 'rgba(120,100,70,.5)';
    g.lineWidth = 2;
    g.beginPath();
    g.moveTo(cx - rx * 0.5, cy + ry * 0.1);
    g.quadraticCurveTo(cx, cy - ry * 0.05, cx + rx * 0.55, cy + ry * 0.15);
    g.stroke();
    g.restore();

    // 断面反光
    glowAt(g, cx - rx * 0.2, cy - ry * 0.2, rx * 0.9, '#fff8e2', 0.22);
    dust(g, w, hh, t, o.rand, '#e8e4d0', 18);
  };

  S.mirror = function (g, w, hh, p, t, o) {
    var pal = o.pal, ink = pal.ink;
    g.fillStyle = shade(ink, 0.24);
    g.fillRect(0, 0, w, hh);
    // 浴室瓷砖
    g.strokeStyle = 'rgba(220,230,230,.10)';
    g.lineWidth = 1.2;
    for (var i = 0; i < 9; i++) {
      g.beginPath(); g.moveTo(0, i * hh * 0.12); g.lineTo(w, i * hh * 0.12); g.stroke();
      g.beginPath(); g.moveTo(i * w * 0.11, 0); g.lineTo(i * w * 0.11, hh); g.stroke();
    }
    glowAt(g, w * 0.5, hh * 0.10, hh * 0.9, '#e8f0ee', 0.30);

    var mx = w * 0.20, my = hh * 0.05, mw = w * 0.60, mhh = hh * 0.86;
    // 镜子里的暗
    g.fillStyle = '#6e7674';
    g.fillRect(mx, my, mw, mhh);
    // 镜子里的自己：模糊的脸
    g.save();
    g.globalAlpha = 0.45;
    g.fillStyle = '#cbb9aa';
    g.beginPath(); g.ellipse(mx + mw * 0.5, my + mhh * 0.52, mw * 0.13, mhh * 0.17, 0, 0, TAU); g.fill();
    g.fillStyle = '#b8a596';
    g.beginPath(); g.ellipse(mx + mw * 0.5, my + mhh * 0.36, mw * 0.14, mhh * 0.10, 0, 0, TAU); g.fill();
    g.restore();

    // 厚厚的雾
    g.fillStyle = 'rgba(236,242,240,.86)';
    g.fillRect(mx, my, mw, mhh);
    // 雾的浓淡
    g.save();
    g.globalAlpha = 0.10;
    for (var d = 0; d < 26; d++) {
      g.fillStyle = '#ffffff';
      g.beginPath();
      g.ellipse(mx + h2(d * 3.7) * mw, my + h2(d * 7.3) * mhh, mw * 0.20, mhh * 0.14, 0, 0, TAU);
      g.fill();
    }
    g.restore();

    // 手指写的字：一笔一笔出现
    var write = clamp((p - 0.08) / 0.45, 0, 1);
    var wipe = clamp((p - 0.58) / 0.28, 0, 1);
    var txt = '是不是我不够好';
    var fs = Math.min(hh * 0.115, mw * 0.105);
    g.save();
    g.font = '300 ' + fs + 'px "Kaiti SC","KaiTi","STKaiti",serif';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillStyle = 'rgba(88,96,94,.55)';
    g.globalAlpha = 0.9;
    // 逐字出现
    var total = Math.ceil(txt.length * write);
    var shown = txt.slice(0, total);
    g.fillText(shown, mx + mw * 0.5, my + mhh * 0.52);
    g.restore();

    // 一把擦掉：从右往左抹过去的掌纹
    if (wipe > 0.01) {
      g.save();
      var wx = mx + mw * (1 - wipe * 1.02);
      g.globalCompositeOperation = 'destination-out';
      var wg = g.createLinearGradient(wx - mw * 0.22, 0, wx + mw * 0.05, 0);
      wg.addColorStop(0, 'rgba(0,0,0,0)');
      wg.addColorStop(0.75, 'rgba(0,0,0,0.92)');
      wg.addColorStop(1, 'rgba(0,0,0,0.98)');
      g.fillStyle = wg;
      g.fillRect(mx, my + mhh * 0.36, mw, mhh * 0.30);
      g.restore();
      // 擦过的水痕
      g.save();
      g.globalAlpha = 0.18 * wipe;
      g.strokeStyle = '#dfe8e6';
      g.lineWidth = 3;
      for (var s = 0; s < 5; s++) {
        g.beginPath();
        g.moveTo(mx, my + mhh * (0.40 + s * 0.05));
        g.bezierCurveTo(mx + mw * 0.5, my + mhh * (0.38 + s * 0.05), mx + mw * 0.8, my + mhh * (0.44 + s * 0.05), mx + mw * wipe, my + mhh * (0.41 + s * 0.05));
        g.stroke();
      }
      g.restore();
    }

    // 镜框
    g.strokeStyle = '#5a625f';
    g.lineWidth = hh * 0.012;
    g.strokeRect(mx, my, mw, mhh);

    // 他的手：指尖停在镜前
    g.save();
    g.fillStyle = 'rgba(160,132,112,.55)';
    g.beginPath();
    g.ellipse(w * 0.72, hh * 0.80, w * 0.055, hh * 0.045, -0.4, 0, TAU);
    g.fill();
    g.restore();
  };

  S.cabinet = function (g, w, hh, p, t, o) {
    var pal = o.pal, ink = pal.ink;
    g.fillStyle = '#0d0b09';
    g.fillRect(0, 0, w, hh);

    // 柜门开着一条缝，光从左边斜进来
    g.save();
    g.globalCompositeOperation = 'screen';
    var lg = g.createLinearGradient(0, 0, w * 0.46, hh);
    lg.addColorStop(0, 'rgba(226,206,168,.46)');
    lg.addColorStop(0.55, 'rgba(226,206,168,.10)');
    lg.addColorStop(1, 'rgba(226,206,168,0)');
    g.fillStyle = lg;
    g.fillRect(0, 0, w * 0.55, hh);
    g.restore();
    // 门板
    g.fillStyle = '#1d1710';
    g.beginPath();
    g.moveTo(0, 0); g.lineTo(w * 0.10, hh * 0.03);
    g.lineTo(w * 0.10, hh); g.lineTo(0, hh);
    g.closePath(); g.fill();

    // 隔板
    g.fillStyle = '#2a2118';
    g.fillRect(0, hh * 0.24, w, hh * 0.018);
    g.fillRect(0, hh * 0.70, w, hh * 0.018);
    g.fillStyle = '#171310';
    g.fillRect(0, hh * 0.72, w, hh);

    // 上层：叠着的旧被子
    g.fillStyle = '#2c241b';
    g.fillRect(w * 0.08, hh * 0.10, w * 0.38, hh * 0.14);
    g.fillStyle = '#241d15';
    g.fillRect(w * 0.08, hh * 0.13, w * 0.38, hh * 0.11);
    g.strokeStyle = 'rgba(180,160,120,.12)';
    g.lineWidth = 1.4;
    for (var i = 0; i < 4; i++) {
      g.beginPath();
      g.moveTo(w * 0.08, hh * (0.145 + i * 0.028));
      g.lineTo(w * 0.46, hh * (0.148 + i * 0.028));
      g.stroke();
    }
    // 一个旧纸箱
    g.fillStyle = '#332a1e';
    g.fillRect(w * 0.56, hh * 0.12, w * 0.28, hh * 0.115);
    g.fillStyle = 'rgba(200,180,140,.14)';
    g.fillRect(w * 0.56, hh * 0.12, w * 0.28, hh * 0.012);

    // 下层：那只没吃完的狗粮袋，被塑料夹子夹着口
    var bx = w * 0.50, by = hh * 0.70, bw = w * 0.085, bh = hh * 0.24;
    g.save();
    g.fillStyle = '#3d3729';
    g.beginPath();
    g.moveTo(bx - bw, by);
    g.lineTo(bx - bw * 0.86, by - bh);
    g.lineTo(bx + bw * 0.86, by - bh);
    g.lineTo(bx + bw, by);
    g.closePath(); g.fill();
    // 袋子上的印刷：褪色的红和米白
    g.fillStyle = 'rgba(146,66,42,.40)';
    g.fillRect(bx - bw * 0.66, by - bh * 0.80, bw * 1.32, bh * 0.30);
    g.fillStyle = 'rgba(214,204,180,.20)';
    g.fillRect(bx - bw * 0.56, by - bh * 0.42, bw * 1.12, bh * 0.16);
    // 袋口的褶皱
    g.strokeStyle = 'rgba(206,196,172,.28)';
    g.lineWidth = 1.4;
    for (var k = 0; k < 6; k++) {
      var kx = bx - bw * 0.78 + k * bw * 0.31;
      g.beginPath();
      g.moveTo(kx, by - bh * 0.98);
      g.lineTo(kx + (h2(k) - 0.5) * 4, by - bh * 1.16);
      g.stroke();
    }
    // 塑料夹子
    g.fillStyle = '#8d8770';
    g.fillRect(bx - bw * 0.44, by - bh * 1.14, bw * 0.88, hh * 0.014);
    g.fillStyle = '#a29a80';
    g.fillRect(bx - bw * 0.44, by - bh * 1.14, bw * 0.88, hh * 0.005);
    // 袋底的干粮渣
    g.fillStyle = 'rgba(140,120,80,.45)';
    for (var d = 0; d < 10; d++) {
      g.fillRect(bx - bw * 0.5 + h2(d * 3.1) * bw, by - hh * 0.006, 2.5, 2);
    }
    g.restore();

    // 手：伸进来，在袋子前面停住，又收回去
    var reach = Math.sin(clamp(p, 0, 1) * Math.PI);
    var hx = lerp(w * 1.06, w * 0.70, ease(clamp(reach * 1.25, 0, 1)));
    var hy2 = hh * 0.62;
    g.save();
    g.globalAlpha = 0.95;
    // 小臂
    g.strokeStyle = '#b9977a';
    g.lineWidth = hh * 0.058;
    g.lineCap = 'round';
    g.beginPath();
    g.moveTo(hx + w * 0.05, hy2 + hh * 0.12);
    g.lineTo(w * 1.06, hy2 + hh * 0.30);
    g.stroke();
    // 手掌
    g.fillStyle = '#c8a888';
    g.beginPath();
    g.ellipse(hx, hy2, w * 0.052, hh * 0.036, -0.30, 0, TAU);
    g.fill();
    // 四根手指，朝袋子伸着
    g.strokeStyle = '#c8a888';
    g.lineWidth = hh * 0.020;
    for (var f = 0; f < 4; f++) {
      g.beginPath();
      g.moveTo(hx - w * 0.012, hy2 - hh * 0.014 + f * hh * 0.012);
      g.quadraticCurveTo(hx - w * 0.050, hy2 - hh * 0.020 + f * hh * 0.016,
        hx - w * 0.080 + f * w * 0.004, hy2 - hh * 0.004 + f * hh * 0.020);
      g.stroke();
    }
    // 拇指
    g.beginPath();
    g.moveTo(hx + w * 0.010, hy2 + hh * 0.010);
    g.quadraticCurveTo(hx - w * 0.020, hy2 + hh * 0.034, hx - w * 0.052, hy2 + hh * 0.030);
    g.stroke();
    g.restore();

    // 光里的灰
    dust(g, w, hh, t, o.rand, '#e8dcc0', 30);
  };

  S.flashback = function (g, w, hh, p, t, o) {
    var pal = o.pal, ink = pal.ink;
    g.fillStyle = '#100d0b';
    g.fillRect(0, 0, w, hh);

    // 五个一闪而过的小画面：白汽、油纸、尾巴、红字、走廊
    var bw = w * 0.24, bh = hh * 0.34;
    var pos = [
      [w * 0.06, hh * 0.10], [w * 0.38, hh * 0.06], [w * 0.70, hh * 0.12],
      [w * 0.18, hh * 0.56], [w * 0.56, hh * 0.60]
    ];
    for (var i = 0; i < pos.length; i++) {
      var a = clamp((p - i * 0.12) * 3.4, 0, 1) * (0.55 + 0.45 * Math.abs(Math.sin(t * 1.2 + i)));
      if (a <= 0.02) continue;
      var x = pos[i][0], y = pos[i][1];
      g.save();
      g.globalAlpha = a;
      g.beginPath(); g.rect(x, y, bw, bh); g.clip();
      if (i === 0) {
        g.fillStyle = '#2a2018'; g.fillRect(x, y, bw, bh);
        glowAt(g, x + bw * 0.5, y + bh * 0.9, bh * 0.9, '#ffe9c4', 0.5);
        steam(g, x + bw * 0.5, y + bh * 0.85, bw * 0.7, bh * 0.8, t, 5, 0.5);
      } else if (i === 1) {
        g.fillStyle = '#c8a878'; g.fillRect(x + bw * 0.2, y + bh * 0.2, bw * 0.6, bh * 0.6);
        g.fillStyle = 'rgba(120,74,30,.5)';
        g.beginPath(); g.arc(x + bw * 0.5, y + bh * 0.52, bw * 0.16, 0, TAU); g.fill();
      } else if (i === 2) {
        g.fillStyle = '#1e1a16'; g.fillRect(x, y, bw, bh);
        g.strokeStyle = '#c89a58'; g.lineWidth = bh * 0.07; g.lineCap = 'round';
        g.beginPath();
        g.moveTo(x + bw * 0.2, y + bh * 0.6);
        g.quadraticCurveTo(x + bw * 0.5, y + bh * 0.3 + Math.sin(t * 3) * 4, x + bw * 0.82, y + bh * 0.55);
        g.stroke();
      } else if (i === 3) {
        g.fillStyle = '#e7dcc3'; g.fillRect(x, y, bw, bh);
        g.save();
        g.font = '400 ' + (bh * 0.34) + 'px "Kaiti SC","KaiTi",serif';
        g.fillStyle = 'rgba(168,42,36,.85)';
        g.fillText('认真', x + bw * 0.22, y + bh * 0.62);
        g.restore();
      } else {
        g.fillStyle = '#2a2e30'; g.fillRect(x, y, bw, bh);
        g.fillStyle = 'rgba(210,222,224,.35)';
        g.fillRect(x + bw * 0.6, y + bh * 0.2, bw * 0.22, bh * 0.5);
        g.fillStyle = '#1a1d1f';
        g.beginPath(); g.ellipse(x + bw * 0.35, y + bh * 0.7, bw * 0.05, bh * 0.16, 0, 0, TAU); g.fill();
      }
      g.restore();
      // 边框
      g.save();
      g.globalAlpha = a * 0.5;
      g.strokeStyle = 'rgba(220,210,190,.5)';
      g.lineWidth = 1.2;
      g.strokeRect(x, y, bw, bh);
      g.restore();
    }

    dust(g, w, hh, t, o.rand, '#e8dcc0', 30);
  };

  /* ---------------- 八 · 银杏 ---------------- */

  S.leafpile = function (g, w, hh, p, t, o) {
    var pal = o.pal, ink = pal.ink, glow = pal.glow;
    var hy = hh * 0.72;
    wash(g, w, hh, { sky: [shade(pal.sky[0], 0.10), shade(pal.sky[1], 0.04), shade(pal.sky[2], 0.02)] }, o.rand, 1.0);
    glowAt(g, w * 0.66, hy - hh * 0.34, hh * 0.90, '#ffe6ae', 0.58);

    // 院墙：白灰墙，墙根一圈潮气
    var wallG = g.createLinearGradient(0, hy - hh * 0.26, 0, hy);
    wallG.addColorStop(0, shade(pal.ground, 0.34));
    wallG.addColorStop(1, shade(pal.ground, 0.10));
    g.fillStyle = wallG;
    g.fillRect(0, hy - hh * 0.26, w, hh * 0.26);
    g.save();
    g.globalAlpha = 0.12;
    g.fillStyle = '#6b5a3a';
    for (var r = 0; r < 8; r++) {
      g.fillRect(0, hy - hh * 0.26 + r * hh * 0.033, w, 1.6);
    }
    g.globalAlpha = 0.16;
    g.fillStyle = '#4a5238';
    g.fillRect(0, hy - hh * 0.045, w, hh * 0.045);
    g.restore();

    // 老银杏：粗得要两个人合抱，树皮一道一道裂开
    var tx = w * 0.140, tw = w * 0.104;
    g.fillStyle = '#7d6440';
    g.beginPath();
    g.moveTo(tx - tw * 1.05, hy + hh * 0.06);
    g.quadraticCurveTo(tx - tw * 0.96, hy - hh * 0.34, tx - tw * 0.78, hy - hh * 0.72);
    g.lineTo(tx + tw * 0.70, hy - hh * 0.76);
    g.quadraticCurveTo(tx + tw * 0.94, hy - hh * 0.32, tx + tw * 1.05, hy + hh * 0.06);
    g.closePath(); g.fill();
    // 树皮的深裂与苔
    g.save();
    g.beginPath();
    g.moveTo(tx - tw * 1.05, hy + hh * 0.06);
    g.quadraticCurveTo(tx - tw * 0.96, hy - hh * 0.34, tx - tw * 0.78, hy - hh * 0.72);
    g.lineTo(tx + tw * 0.70, hy - hh * 0.76);
    g.quadraticCurveTo(tx + tw * 0.94, hy - hh * 0.32, tx + tw * 1.05, hy + hh * 0.06);
    g.closePath(); g.clip();
    for (var i = 0; i < 16; i++) {
      var bx = tx - tw * 0.92 + i * tw * 0.12;
      g.strokeStyle = i % 3 ? 'rgba(44,32,20,.42)' : 'rgba(74,86,50,.35)';
      g.lineWidth = 1.4 + h2(i) * 3.0;
      g.beginPath();
      g.moveTo(bx, hy + hh * 0.04);
      g.quadraticCurveTo(bx + Math.sin(i * 1.7) * tw * 0.14, hy - hh * 0.34,
        bx + Math.sin(i * 2.3) * tw * 0.16, hy - hh * 0.72);
      g.stroke();
    }
    g.restore();
    // 右侧的受光边
    g.save();
    g.strokeStyle = 'rgba(255,226,168,.28)';
    g.lineWidth = Math.max(2, tw * 0.05);
    g.beginPath();
    g.moveTo(tx + tw * 0.94, hy + hh * 0.02);
    g.quadraticCurveTo(tx + tw * 0.90, hy - hh * 0.34, tx + tw * 0.66, hy - hh * 0.72);
    g.stroke();
    g.restore();
    // 一根伸出来的粗枝
    g.strokeStyle = '#7d6440';
    g.lineWidth = tw * 0.34;
    g.lineCap = 'round';
    g.beginPath();
    g.moveTo(tx + tw * 0.5, hy - hh * 0.60);
    g.quadraticCurveTo(w * 0.30, hy - hh * 0.80, w * 0.44, hy - hh * 0.86);
    g.stroke();

    // 树冠：一片压不住的黄
    g.save();
    for (var c = 0; c < 46; c++) {
      var cx2 = w * (-0.02 + h2(c * 3.1) * 0.72);
      var cy2 = hy - hh * (0.62 + h2(c * 7.7) * 0.30);
      var cr = w * (0.040 + h2(c * 5.3) * 0.075);
      g.fillStyle = h2(c * 9.1) > 0.55 ? 'rgba(224,182,88,.42)' : 'rgba(186,146,58,.40)';
      g.beginPath(); g.ellipse(cx2, cy2, cr, cr * 0.66, h2(c) * 3, 0, TAU); g.fill();
    }
    g.restore();

    // 落叶：厚厚一层，深浅不一
    var gg = g.createLinearGradient(0, hy, 0, hh);
    gg.addColorStop(0, '#a9843c');
    gg.addColorStop(0.4, '#b8924a');
    gg.addColorStop(1, '#7c5c26');
    g.fillStyle = gg;
    g.fillRect(0, hy, w, hh - hy);
    g.save();
    for (var k = 0; k < 420; k++) {
      var lx = h2(k * 3.1) * w;
      var ly = hy + Math.pow(h2(k * 7.7), 0.62) * (hh - hy);
      var tone = h2(k * 5.3);
      g.fillStyle = tone > 0.72 ? 'rgba(236,204,120,.85)'
        : tone > 0.42 ? 'rgba(196,156,72,.85)'
        : 'rgba(146,108,44,.85)';
      g.save();
      g.translate(lx, ly);
      g.rotate(h2(k * 9.1) * TAU);
      var lw2 = 4 + h2(k) * 8 * (0.4 + ly / hh);
      g.beginPath(); g.ellipse(0, 0, lw2, lw2 * 0.66, 0, 0, TAU); g.fill();
      g.restore();
    }
    // 踩出来的凹陷
    g.save();
    g.globalCompositeOperation = 'multiply';
    for (var d = 0; d < 5; d++) {
      var dx2 = w * (0.30 + d * 0.13);
      var rg3 = g.createRadialGradient(dx2, hh * 0.86, 0, dx2, hh * 0.86, w * 0.08);
      rg3.addColorStop(0, 'rgba(120,90,40,.35)');
      rg3.addColorStop(1, 'rgba(120,90,40,0)');
      g.fillStyle = rg3;
      g.beginPath(); g.arc(dx2, hh * 0.86, w * 0.08, 0, TAU); g.fill();
    }
    g.restore();
    g.restore();
    // 落叶层的边缘：一排草和叶子，把那条直线打散
    g.save();
    for (var e = 0; e < 150; e++) {
      var ex = h2(e * 3.7) * w;
      var eh = hh * (0.010 + h2(e * 7.9) * 0.035);
      g.strokeStyle = h2(e * 5.1) > 0.5 ? 'rgba(150,116,48,.75)' : 'rgba(196,158,70,.75)';
      g.lineWidth = 1.4 + h2(e) * 2.0;
      g.beginPath();
      g.moveTo(ex, hy + hh * 0.008);
      g.quadraticCurveTo(ex + 2, hy - eh * 0.6, ex + (h2(e * 2) - 0.5) * 10, hy - eh);
      g.stroke();
    }
    g.restore();

    // 一人一狗，在叶子上踩来踩去
    var run = ease(clamp(p * 1.05, 0, 1));
    var kx = lerp(w * 0.36, w * 0.56, run);
    shadowAt(g, kx + hh * 0.03, hh * 0.955, hh * 0.16, 0.20);
    person(g, kx, hh * 0.955, hh * 0.42, t * 9, { ink: shade(ink, -0.06) });
    // 来福：跟着跑，黄毛
    var dx = lerp(w * 0.28, w * 0.49, clamp(run * 0.92, 0, 1));
    var dy = hh * 0.965;
    g.fillStyle = '#c08a48';
    g.beginPath(); g.ellipse(dx, dy - hh * 0.055, w * 0.046, hh * 0.032, -0.06, 0, TAU); g.fill();
    g.beginPath(); g.ellipse(dx + w * 0.048, dy - hh * 0.088, w * 0.021, hh * 0.019, -0.1, 0, TAU); g.fill();
    g.beginPath();
    g.moveTo(dx + w * 0.055, dy - hh * 0.104);
    g.lineTo(dx + w * 0.060, dy - hh * 0.132);
    g.lineTo(dx + w * 0.070, dy - hh * 0.104);
    g.closePath(); g.fill();
    g.beginPath();
    g.ellipse(dx + w * 0.078, dy - hh * 0.094, w * 0.012, hh * 0.008, 0.7, 0, TAU);
    g.fill();
    // 四条腿
    g.strokeStyle = '#c08a48';
    g.lineWidth = hh * 0.011;
    g.lineCap = 'round';
    for (var lg = 0; lg < 4; lg++) {
      var lxx = dx - w * 0.030 + lg * w * 0.022;
      var sw2 = Math.sin(t * 10 + lg * 1.6) * hh * 0.014;
      g.beginPath();
      g.moveTo(lxx, dy - hh * 0.040);
      g.lineTo(lxx + sw2, dy - hh * 0.004);
      g.stroke();
    }
    g.beginPath();
    g.moveTo(dx - w * 0.042, dy - hh * 0.064);
    g.quadraticCurveTo(dx - w * 0.070, dy - hh * 0.086 + Math.sin(t * 9) * 6, dx - w * 0.058, dy - hh * 0.100);
    g.stroke();

    // 外婆坐在门槛上择菜
    if (p > 0.40) {
      g.save();
      g.globalAlpha = clamp((p - 0.40) / 0.32, 0, 1) * 0.95;
      // 她坐的地方：一小块干地
      g.fillStyle = 'rgba(110,84,40,.35)';
      g.beginPath();
      g.ellipse(w * 0.86, hh * 0.812, w * 0.085, hh * 0.020, 0, 0, TAU);
      g.fill();
      // 她坐在门槛上，膝盖上放着一把菜
      person(g, w * 0.88, hh * 0.760, hh * 0.40, 0, { ink: shade(ink, 0.30), sit: true, still: true });
      g.save();
      g.strokeStyle = 'rgba(96,116,60,.55)';
      g.lineWidth = 2;
      for (var v2 = 0; v2 < 5; v2++) {
        g.beginPath();
        g.moveTo(w * 0.845, hh * 0.735);
        g.lineTo(w * 0.845 + (v2 - 2) * 8, hh * 0.700);
        g.stroke();
      }
      g.restore();
      g.restore();
    }

    // 飘下来的叶子
    g.save();
    for (var f = 0; f < 22; f++) {
      var fx = ((h2(f * 3.3) + t * 0.018) % 1) * w;
      var fy = hy - hh * 0.7 + ((h2(f * 7.1) * hh * 0.9 + t * 26) % (hh * 0.95));
      g.globalAlpha = 0.55 + h2(f) * 0.35;
      g.fillStyle = '#dfb458';
      g.save();
      g.translate(fx, fy);
      g.rotate(t * 1.1 + f);
      g.beginPath(); g.ellipse(0, 0, 7, 4.6, 0, 0, TAU); g.fill();
      g.restore();
    }
    g.restore();
  };

  S.emptylot = function (g, w, hh, p, t, o) {
    var pal = o.pal, ink = pal.ink, glow = pal.glow;
    var hy = hh * 0.68;
    // 秋天下午的天，很淡
    var sg = g.createLinearGradient(0, 0, 0, hy);
    sg.addColorStop(0, '#cfcdc2');
    sg.addColorStop(1, '#dddad0');
    g.fillStyle = sg;
    g.fillRect(0, 0, w, hy);
    glowAt(g, w * 0.62, hh * 0.06, hh * 0.7, '#fff0d0', 0.34);

    // 蓝色铁皮围挡
    var fy = hh * 0.18;
    g.fillStyle = '#2b4a60';
    g.fillRect(0, fy, w, hy - fy);
    g.save();
    for (var i = 0; i < 60; i++) {
      var x = i * (w / 60);
      g.fillStyle = 'rgba(255,255,255,.045)';
      g.fillRect(x, fy, w / 140, hy - fy);
      g.fillStyle = 'rgba(0,0,0,.10)';
      g.fillRect(x + w / 140, fy, w / 200, hy - fy);
    }
    g.restore();
    g.fillStyle = 'rgba(18,30,40,.85)';
    g.fillRect(0, fy - hh * 0.010, w, hh * 0.017);
    // 铁皮上的锈
    g.save();
    g.globalAlpha = 0.22;
    g.fillStyle = '#8a5a34';
    for (var r = 0; r < 30; r++) {
      g.beginPath();
      g.ellipse(h2(r * 3.3) * w, fy + h2(r * 7.7) * (hy - fy), 2 + h2(r) * 8, 1 + h2(r * 2) * 4, 0, 0, TAU);
      g.fill();
    }
    g.restore();
    // 公告纸，风一吹边角掀起来
    var nx = w * 0.30, ny = fy + hh * 0.10, nw = w * 0.09, nh = hh * 0.17;
    g.save();
    g.translate(nx + nw / 2, ny + nh / 2);
    g.rotate(Math.sin(t * 1.2) * 0.035);
    g.fillStyle = 'rgba(236,232,220,.92)';
    g.beginPath();
    g.moveTo(-nw / 2, -nh / 2);
    g.lineTo(nw / 2, -nh / 2);
    g.lineTo(nw / 2, nh * 0.32);
    g.quadraticCurveTo(nw * 0.3, nh * 0.5 + Math.sin(t * 2.2) * 4, -nw / 2, nh * 0.44);
    g.closePath(); g.fill();
    g.fillStyle = 'rgba(60,58,54,.7)';
    for (var l = 0; l < 6; l++) {
      g.fillRect(-nw * 0.36, -nh * 0.38 + l * nh * 0.10, nw * (0.24 + h2(l * 5.1) * 0.52), 1.5);
    }
    g.fillStyle = 'rgba(150,40,34,.5)';
    g.beginPath(); g.arc(nw * 0.28, nh * 0.28, nw * 0.13, 0, TAU); g.fill();
    g.restore();

    // 地面：干裂的土，碎石，枯叶
    var gg = g.createLinearGradient(0, hy, 0, hh);
    gg.addColorStop(0, '#8e8a7a');
    gg.addColorStop(1, '#5e5a4c');
    g.fillStyle = gg;
    g.fillRect(0, hy, w, hh - hy);
    g.save();
    g.strokeStyle = 'rgba(48,44,36,.42)';
    g.lineWidth = 1.5;
    for (var c = 0; c < 18; c++) {
      var sx = h2(c * 4.3) * w, sy = hy + h2(c * 8.1) * (hh - hy);
      g.beginPath();
      g.moveTo(sx, sy);
      g.lineTo(sx + 22 + h2(c) * 46, sy + (h2(c * 2) - 0.5) * 20);
      g.stroke();
    }
    for (var d = 0; d < 40; d++) {
      g.fillStyle = h2(d * 3.1) > 0.5 ? 'rgba(120,114,100,.7)' : 'rgba(70,66,58,.7)';
      g.fillRect(h2(d * 7.3) * w, hy + h2(d * 9.1) * (hh - hy), 3 + h2(d) * 9, 2 + h2(d * 2) * 4);
    }
    // 铁皮墙根的一排阴影
    var shg = g.createLinearGradient(0, hy, 0, hy + hh * 0.07);
    shg.addColorStop(0, 'rgba(20,26,30,.35)');
    shg.addColorStop(1, 'rgba(20,26,30,0)');
    g.fillStyle = shg;
    g.fillRect(0, hy, w, hh * 0.07);
    g.restore();

    // 墙根一丛丛枯草，还有被铲断的树桩
    g.save();
    g.strokeStyle = 'rgba(150,132,84,.55)';
    g.lineWidth = 1.6;
    g.lineCap = 'round';
    for (var t2 = 0; t2 < 60; t2++) {
      var gx2 = h2(t2 * 3.7) * w;
      var gy2 = hy + h2(t2 * 7.9) * hh * 0.06;
      var gh2 = hh * (0.02 + h2(t2 * 5.1) * 0.05);
      g.beginPath();
      g.moveTo(gx2, gy2);
      g.quadraticCurveTo(gx2 + Math.sin(t2) * 5, gy2 - gh2 * 0.6, gx2 + Math.sin(t2 * 2 + t * 0.4) * 8, gy2 - gh2);
      g.stroke();
    }
    g.restore();
    // 树桩
    g.save();
    g.fillStyle = '#7a6a4c';
    g.beginPath(); g.ellipse(w * 0.78, hy + hh * 0.030, w * 0.045, hh * 0.018, 0, 0, TAU); g.fill();
    g.fillStyle = '#cdbf9c';
    g.beginPath(); g.ellipse(w * 0.78, hy + hh * 0.024, w * 0.042, hh * 0.014, 0, 0, TAU); g.fill();
    g.strokeStyle = 'rgba(150,132,96,.5)';
    g.lineWidth = 1;
    for (var rr2 = 1; rr2 <= 3; rr2++) {
      g.beginPath(); g.ellipse(w * 0.78, hy + hh * 0.024, w * 0.042 * rr2 / 4, hh * 0.014 * rr2 / 4, 0, 0, TAU); g.stroke();
    }
    g.restore();

    // 一片叶子从上面落下来
    var fall = clamp(p * 1.05, 0, 1);
    var lx = lerp(w * 0.60, w * 0.47, fall) + Math.sin(fall * 8) * w * 0.035;
    var ly = lerp(-hh * 0.06, hh * 0.845, Math.pow(fall, 1.6));
    if (fall < 0.96) {
      g.save();
      g.translate(lx, ly);
      g.rotate(Math.sin(fall * 9) * 1.3 + fall * 2.2);
      // 银杏叶：扇形
      ginkgo(g, 0, 0, w * 0.050, 0, '#d8ae58', 'rgba(140,104,44,.5)');
      g.restore();
    } else {
      // 落在鞋边的干叶
      g.save();
      g.translate(w * 0.452, hh * 0.868);
      g.fillStyle = 'rgba(60,52,36,.20)';
      g.beginPath(); g.ellipse(w * 0.010, -hh * 0.002, w * 0.050, hh * 0.008, 0, 0, TAU); g.fill();
      ginkgo(g, 0, 0, w * 0.048, 0.5, '#cda750', 'rgba(146,108,44,.55)');
      g.restore();
    }

    // 抬起脚，轻轻踩下去
    var step = clamp((p - 0.60) / 0.30, 0, 1);
    if (step > 0.01) {
      var liftK = Math.sin(Math.min(1, step * 1.5) * Math.PI) * 0.5;
      g.save();
      g.globalAlpha = 0.95;
      var fx2 = w * 0.47, fy2 = hh * (0.895 - liftK * 0.045);
      // 鞋的影子
      g.fillStyle = 'rgba(40,36,28,.28)';
      g.beginPath(); g.ellipse(fx2 - w * 0.006, fy2 + hh * 0.010, w * 0.062, hh * 0.010, 0, 0, TAU); g.fill();
      g.fillStyle = '#2f2a24';
      // 鞋：侧面，鞋尖朝左，鞋跟朝右
      g.beginPath();
      g.moveTo(fx2 - w * 0.070, fy2);
      g.quadraticCurveTo(fx2 - w * 0.062, fy2 - hh * 0.034, fx2 - w * 0.026, fy2 - hh * 0.040);
      g.quadraticCurveTo(fx2 + w * 0.006, fy2 - hh * 0.046, fx2 + w * 0.020, fy2 - hh * 0.078);
      g.quadraticCurveTo(fx2 + w * 0.034, fy2 - hh * 0.100, fx2 + w * 0.044, fy2 - hh * 0.070);
      g.quadraticCurveTo(fx2 + w * 0.056, fy2 - hh * 0.038, fx2 + w * 0.058, fy2 - hh * 0.004);
      g.quadraticCurveTo(fx2 + w * 0.010, fy2 + hh * 0.008, fx2 - w * 0.070, fy2);
      g.closePath(); g.fill();
      // 鞋帮的受光
      g.fillStyle = 'rgba(210,200,178,.20)';
      g.beginPath();
      g.moveTo(fx2 - w * 0.050, fy2 - hh * 0.014);
      g.quadraticCurveTo(fx2 + w * 0.000, fy2 - hh * 0.032, fx2 + w * 0.016, fy2 - hh * 0.050);
      g.lineTo(fx2 + w * 0.028, fy2 - hh * 0.026);
      g.quadraticCurveTo(fx2 + w * 0.000, fy2 - hh * 0.008, fx2 - w * 0.048, fy2 - hh * 0.004);
      g.closePath(); g.fill();
      // 鞋底的边
      g.fillStyle = shade(ink, 0.28);
      g.beginPath();
      g.moveTo(fx2 - w * 0.068, fy2);
      g.quadraticCurveTo(fx2 + w * 0.010, fy2 + hh * 0.006, fx2 + w * 0.058, fy2 - hh * 0.002);
      g.lineTo(fx2 + w * 0.056, fy2 + hh * 0.008);
      g.quadraticCurveTo(fx2 + w * 0.010, fy2 + hh * 0.016, fx2 - w * 0.070, fy2 + hh * 0.006);
      g.closePath(); g.fill();
      // 鞋底的纹
      g.strokeStyle = 'rgba(70,64,54,.45)';
      g.lineWidth = 1.2;
      for (var s2 = 0; s2 < 4; s2++) {
        g.beginPath();
        g.moveTo(fx2 - w * 0.044 + s2 * w * 0.022, fy2 - hh * 0.004);
        g.lineTo(fx2 - w * 0.040 + s2 * w * 0.022, fy2 - hh * 0.030);
        g.stroke();
      }
      g.restore();
      // 踩下去扬起来的一点尘
      if (step > 0.85) {
        g.save();
        g.globalAlpha = (step - 0.85) * 2.2;
        g.fillStyle = '#d0c6ae';
        for (var d2 = 0; d2 < 12; d2++) {
          g.beginPath();
          g.arc(fx2 + (h2(d2 * 3.1) - 0.55) * w * 0.16, fy2 - h2(d2) * hh * 0.035, 1 + h2(d2 * 5) * 2.6, 0, TAU);
          g.fill();
        }
        g.restore();
      }
    }

    dust(g, w, hh, t, o.rand, '#d8cfb8', 12);
  };

  /* ---------------- 九 · 岔路口 / 对话框 / 上课铃 ---------------- */

  S.fork = function (g, w, hh, p, t, o) {
    var pal = o.pal, ink = pal.ink, glow = pal.glow;
    var hy = hh * 0.66;
    wash(g, w, hh, pal, o.rand, 0.9);
    glowAt(g, w * 0.72, hy - hh * 0.14, hh * 0.85, glow, 0.45);
    // 矮墙与屋顶
    g.fillStyle = shade(ink, 0.38);
    g.fillRect(0, hy - hh * 0.22, w, hh * 0.22);
    g.fillStyle = shade(pal.ground, -0.30);
    g.fillRect(0, hy, w, hh - hy);
    // 两条岔开的路
    g.save();
    g.globalAlpha = 0.4;
    g.fillStyle = shade(pal.ground, 0.10);
    g.beginPath();
    g.moveTo(w * 0.44, hy); g.lineTo(w * 0.50, hy);
    g.lineTo(w * 0.28, hh); g.lineTo(-w * 0.02, hh);
    g.closePath(); g.fill();
    g.beginPath();
    g.moveTo(w * 0.50, hy); g.lineTo(w * 0.56, hy);
    g.lineTo(w * 1.02, hh); g.lineTo(w * 0.72, hh);
    g.closePath(); g.fill();
    g.restore();

    // 旧电线杆，贴满撕剩一半的小广告
    var px = w * 0.63;
    g.fillStyle = shade(ink, 0.20);
    g.fillRect(px - w * 0.011, hh * 0.10, w * 0.022, hy - hh * 0.10);
    g.save();
    for (var i = 0; i < 7; i++) {
      var ax = px - w * 0.03 + h2(i * 3.3) * w * 0.05;
      var ay = hh * (0.22 + h2(i * 7.7) * 0.34);
      g.fillStyle = h2(i * 5.1) > 0.5 ? 'rgba(230,224,206,.55)' : 'rgba(200,180,140,.45)';
      g.save();
      g.translate(ax, ay);
      g.rotate((h2(i * 9.3) - 0.5) * 0.5);
      g.fillRect(0, 0, w * 0.026, hh * 0.030);
      g.restore();
    }
    g.restore();
    // 电线
    g.strokeStyle = 'rgba(40,36,32,.45)';
    g.lineWidth = 1.4;
    for (var k = 0; k < 3; k++) {
      g.beginPath();
      g.moveTo(0, hh * (0.14 + k * 0.03));
      g.quadraticCurveTo(px, hh * (0.19 + k * 0.03), w, hh * (0.10 + k * 0.04));
      g.stroke();
    }

    // 两个人，在岔路口分开
    var sep = ease(clamp(p * 0.85, 0, 1));
    var bx = lerp(w * 0.36, w * 0.26, sep), gx = lerp(w * 0.44, w * 0.56, sep);
    var by = lerp(hh * 0.94, hh * 0.90, sep);
    person(g, bx, by, hh * 0.34 * (1 - sep * 0.12), 0, { ink: shade(ink, 0.04), still: sep > 0.55, gesture: 'hand' });
    person(g, gx, by, hh * 0.33 * (1 - sep * 0.12), 0, { ink: shade(ink, 0.04), still: sep > 0.55, gesture: 'hand' });

    // 傍晚的光扫过地面
    g.save();
    g.globalCompositeOperation = 'screen';
    g.globalAlpha = 0.16;
    g.fillStyle = hexA(glow, 0.9);
    g.beginPath();
    g.moveTo(w * 0.55, hy); g.lineTo(w, hy); g.lineTo(w, hh); g.lineTo(w * 0.30, hh);
    g.closePath(); g.fill();
    g.restore();

    dust(g, w, hh, t, o.rand, glow, 18);
  };

  S.chat = function (g, w, hh, p, t, o) {
    var pal = o.pal, ink = pal.ink;
    g.fillStyle = shade(ink, 0.12);
    g.fillRect(0, 0, w, hh);
    glowAt(g, w * 0.5, hh * 0.5, hh * 1.1, '#9fb4c8', 0.30);

    // 手机屏幕
    var sw = w * 0.34, sh = hh * 0.80;
    var sx = w * 0.5 - sw / 2, sy = hh * 0.10;
    g.save();
    g.shadowColor = 'rgba(0,0,0,.6)';
    g.shadowBlur = 40;
    g.fillStyle = '#1b1e22';
    g.fillRect(sx - w * 0.010, sy - hh * 0.012, sw + w * 0.020, sh + hh * 0.024);
    g.shadowBlur = 0;
    g.fillStyle = '#e9e7e0';
    g.fillRect(sx, sy, sw, sh);
    g.restore();

    // 聊天记录：越往上越稀疏，最后只剩系统的时间
    var rows = [
      { y: 0.10, w: 0.52, me: false },
      { y: 0.17, w: 0.40, me: true },
      { y: 0.24, w: 0.46, me: false },
      { y: 0.31, w: 0.34, me: true },
      { y: 0.40, w: 0.38, me: false },
      { y: 0.47, w: 0.24, me: true }
    ];
    for (var i = 0; i < rows.length; i++) {
      var r = rows[i];
      var bw = sw * r.w, bh = sh * 0.048;
      var bx = r.me ? sx + sw - bw - sw * 0.05 : sx + sw * 0.05;
      var by = sy + sh * r.y;
      g.fillStyle = r.me ? 'rgba(140,180,150,.55)' : 'rgba(210,208,200,.85)';
      g.fillRect(bx, by, bw, bh);
      // 文字（只画几道灰线，远看是字）
      g.fillStyle = 'rgba(70,68,62,.45)';
      for (var l = 0; l < 2; l++) {
        g.fillRect(bx + bw * 0.08, by + bh * (0.28 + l * 0.28), bw * (0.4 + h2(i * 3 + l) * 0.4), 1.6);
      }
    }

    // 那条打到一半的话
    var typed = clamp((p - 0.10) / 0.42, 0, 1);
    var full = '你到家跟我说一声';
    var inY = sy + sh * 0.84;
    g.fillStyle = 'rgba(250,250,246,.95)';
    g.fillRect(sx + sw * 0.04, inY, sw * 0.92, sh * 0.075);
    g.save();
    g.font = '300 ' + Math.round(sh * 0.042) + 'px "Songti SC","SimSun",serif';
    g.textBaseline = 'middle';
    g.fillStyle = 'rgba(50,50,48,.86)';
    var n = Math.ceil(full.length * typed);
    g.fillText(full.slice(0, n), sx + sw * 0.07, inY + sh * 0.040);
    g.restore();

    // 删掉：一个字一个字退回去
    var del = clamp((p - 0.58) / 0.30, 0, 1);
    if (del > 0.01 && typed > 0.02) {
      var keep = Math.max(0, Math.ceil(full.length * typed * (1 - del)));
      g.fillStyle = 'rgba(250,250,246,.95)';
      g.fillRect(sx + sw * 0.06, inY + sh * 0.006, sw * 0.88, sh * 0.064);
      g.save();
      g.font = '300 ' + Math.round(sh * 0.042) + 'px "Songti SC","SimSun",serif';
      g.textBaseline = 'middle';
      g.fillStyle = 'rgba(50,50,48,.86)';
      g.fillText(full.slice(0, keep), sx + sw * 0.07, inY + sh * 0.040);
      g.restore();
    }
    // 光标一直闪
    if (del > 0.2 || typed < 0.02) {
      var blink = (Math.sin(t * 5) > 0) ? 1 : 0.1;
      g.save();
      g.globalAlpha = blink;
      g.fillStyle = 'rgba(70,70,66,.8)';
      var cx2 = sx + sw * 0.07 + (del > 0.2 ? 0 : sw * 0.60);
      g.fillRect(cx2, inY + sh * 0.016, 2, sh * 0.044);
      g.restore();
    }

    // 屏幕的光落在他脸上
    g.save();
    g.globalCompositeOperation = 'screen';
    g.globalAlpha = 0.16;
    g.fillStyle = '#cfe0f0';
    g.beginPath();
    g.moveTo(sx, sy + sh);
    g.lineTo(sx + sw, sy + sh);
    g.lineTo(sx + sw * 1.3, hh);
    g.lineTo(sx - sw * 0.3, hh);
    g.closePath(); g.fill();
    g.restore();
  };

  S.standbell = function (g, w, hh, p, t, o) {
    var pal = o.pal, ink = pal.ink, glow = pal.glow;
    var vx = w * 0.50, vy = hh * 0.44;
    g.fillStyle = shade(ink, 0.26);
    g.fillRect(0, 0, w, hh);
    // 走廊尽头：窗
    g.fillStyle = hexA(glow, 0.62);
    g.fillRect(vx - w * 0.05, vy - hh * 0.16, w * 0.10, hh * 0.34);
    glowAt(g, vx, vy, hh * 0.7, glow, 0.34);

    // 两侧向中间收的墙与地面
    g.fillStyle = shade(ink, 0.12);
    g.beginPath();
    g.moveTo(0, 0); g.lineTo(vx - w * 0.05, vy - hh * 0.16);
    g.lineTo(vx - w * 0.05, vy + hh * 0.18); g.lineTo(0, hh);
    g.closePath(); g.fill();
    g.fillStyle = shade(ink, 0.20);
    g.beginPath();
    g.moveTo(w, 0); g.lineTo(vx + w * 0.05, vy - hh * 0.16);
    g.lineTo(vx + w * 0.05, vy + hh * 0.18); g.lineTo(w, hh);
    g.closePath(); g.fill();

    // 地面透视线
    g.save();
    g.strokeStyle = 'rgba(255,246,226,.10)';
    g.lineWidth = 1.2;
    for (var i = -5; i <= 5; i++) {
      g.beginPath();
      g.moveTo(vx + i * w * 0.010, vy + hh * 0.18);
      g.lineTo(vx + i * w * 0.22, hh * 1.02);
      g.stroke();
    }
    g.restore();

    // 他站在原地：整个走廊只剩这一个背影
    person(g, w * 0.46, hh * 0.90, hh * 0.56, 0, { ink: shade(ink, -0.14), still: true });
    // 影子拖得很长
    g.save();
    g.globalAlpha = 0.16;
    g.fillStyle = shade(ink, -0.2);
    g.beginPath();
    g.moveTo(w * 0.44, hh * 0.90);
    g.lineTo(w * 0.48, hh * 0.90);
    g.lineTo(w * 0.66, hh);
    g.lineTo(w * 0.50, hh);
    g.closePath(); g.fill();
    g.restore();

    // 窗外的叶子
    g.save();
    g.globalAlpha = 0.45;
    for (var k = 0; k < 8; k++) {
      g.fillStyle = '#7c8a52';
      var lx = vx - w * 0.05 + h2(k * 3.7) * w * 0.10;
      var ly = vy - hh * 0.14 + h2(k * 8.1) * hh * 0.28;
      g.save();
      g.translate(lx, ly);
      g.rotate(Math.sin(t * 1.6 + k) * 0.6);
      g.beginPath(); g.ellipse(0, 0, w * 0.011, w * 0.005, 0, 0, TAU); g.fill();
      g.restore();
    }
    g.restore();

    dust(g, w, hh, t, o.rand, glow, 16);
  };

  M.registerScenes(S);
})(window.YH = window.YH || {});
