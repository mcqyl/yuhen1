/* 余痕 · 程序化声音（无外部音频素材）
   风声 / 脚步 / 拾取 / 回忆和声 / 结局铺底 */
(function (YH) {
  'use strict';

  var A = {
    ctx: null,
    master: null,
    windGain: null,
    windFilter: null,
    droneGain: null,
    droneOscs: [],
    padGain: null,
    ready: false,
    muted: false,
    stepFlip: false
  };

  A.init = function () {
    if (A.ready) return;
    var Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return;
    var ctx = new Ctx();
    A.ctx = ctx;

    var master = ctx.createGain();
    master.gain.value = 0.85;
    master.connect(ctx.destination);
    A.master = master;

    // ---- 风：白噪声 -> 低通 ----
    var len = ctx.sampleRate * 4;
    var buf = ctx.createBuffer(1, len, ctx.sampleRate);
    var d = buf.getChannelData(0);
    var last = 0;
    for (var i = 0; i < len; i++) {
      var w = Math.random() * 2 - 1;
      last = (last + 0.03 * w) / 1.03;
      d[i] = last * 3.2;
    }
    var src = ctx.createBufferSource();
    src.buffer = buf;
    src.loop = true;
    var filt = ctx.createBiquadFilter();
    filt.type = 'lowpass';
    filt.frequency.value = 420;
    filt.Q.value = 0.4;
    var wg = ctx.createGain();
    wg.gain.value = 0.16;
    src.connect(filt); filt.connect(wg); wg.connect(master);
    src.start();
    A.windGain = wg; A.windFilter = filt;

    // 风强度缓慢起伏
    var lfo = ctx.createOscillator();
    lfo.frequency.value = 0.045;
    var lfoGain = ctx.createGain();
    lfoGain.gain.value = 0.07;
    lfo.connect(lfoGain); lfoGain.connect(wg.gain);
    lfo.start();

    var lfo2 = ctx.createOscillator();
    lfo2.frequency.value = 0.027;
    var lfo2g = ctx.createGain();
    lfo2g.gain.value = 150;
    lfo2.connect(lfo2g); lfo2g.connect(filt.frequency);
    lfo2.start();

    // ---- 低频底噪 ----
    var dg = ctx.createGain();
    dg.gain.value = 0.0;
    dg.connect(master);
    [55, 82.4, 110].forEach(function (f, idx) {
      var o = ctx.createOscillator();
      o.type = idx === 0 ? 'sine' : 'triangle';
      o.frequency.value = f;
      var g = ctx.createGain();
      g.gain.value = idx === 0 ? 0.5 : 0.12;
      o.connect(g); g.connect(dg);
      o.start();
      A.droneOscs.push({ o: o, g: g });
    });
    A.droneGain = dg;

    // ---- 回忆和声总线 ----
    var pg = ctx.createGain();
    pg.gain.value = 0;
    pg.connect(master);
    A.padGain = pg;

    A.ready = true;
  };

  A.resume = function () {
    if (A.ctx && A.ctx.state === 'suspended') A.ctx.resume();
  };

  function now() { return A.ctx ? A.ctx.currentTime : 0; }

  /* 环境随阶段变化：0 薄雾暖 / 1 灰 / 2 浓雾压抑 */
  A.setStage = function (s) {
    if (!A.ready) return;
    var t = now();
    var wind = [0.14, 0.19, 0.24][s] || 0.16;
    var cut = [520, 380, 260][s] || 460;
    A.windGain.gain.cancelScheduledValues(t);
    A.windGain.gain.linearRampToValueAtTime(wind, t + 3.5);
    A.windFilter.frequency.cancelScheduledValues(t);
    A.windFilter.frequency.linearRampToValueAtTime(cut, t + 3.5);
    var dr = [0.0, 0.012, 0.03][s] || 0.0;
    A.droneGain.gain.cancelScheduledValues(t);
    A.droneGain.gain.linearRampToValueAtTime(dr, t + 4.0);
  };

  /* 站在高处：风声更明显、更亮 */
  A.setHeight = function (y) {
    if (!A.ready) return;
    var k = Math.min(1, Math.max(0, (y - 1.6) / 2.4));
    A.windFilter.frequency.setTargetAtTime(460 + k * 320, now(), 0.6);
  };

  /* 脚步 */
  A.step = function (onStone) {
    if (!A.ready || A.muted) return;
    var ctx = A.ctx, t = now();
    var len = 0.16;
    var buf = ctx.createBuffer(1, ctx.sampleRate * len, ctx.sampleRate);
    var d = buf.getChannelData(0);
    for (var i = 0; i < d.length; i++) {
      var e = Math.pow(1 - i / d.length, 3.2);
      d[i] = (Math.random() * 2 - 1) * e;
    }
    var src = ctx.createBufferSource();
    src.buffer = buf;
    var f = ctx.createBiquadFilter();
    f.type = 'bandpass';
    f.frequency.value = onStone ? 900 : 320;
    f.Q.value = onStone ? 1.4 : 0.7;
    var g = ctx.createGain();
    g.gain.value = onStone ? 0.07 : 0.1;
    src.connect(f); f.connect(g); g.connect(A.master);
    src.start(t);
  };

  /* 拾取：一声很轻的金属/木质回响 */
  A.pickup = function (stage) {
    if (!A.ready || A.muted) return;
    var ctx = A.ctx, t = now();
    var base = [784, 659.3, 523.3][stage] || 698;
    [1, 1.5, 2.02].forEach(function (m, i) {
      var o = ctx.createOscillator();
      o.type = i === 0 ? 'sine' : 'triangle';
      o.frequency.value = base * m;
      var g = ctx.createGain();
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(0.055 / (i + 1), t + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 2.6 + i * 0.4);
      o.connect(g); g.connect(A.master);
      o.start(t); o.stop(t + 3.2);
    });
  };

  /* 攀爬 */
  A.climb = function () {
    if (!A.ready || A.muted) return;
    var ctx = A.ctx, t = now();
    var o = ctx.createOscillator();
    o.type = 'triangle';
    o.frequency.setValueAtTime(180, t);
    o.frequency.exponentialRampToValueAtTime(110, t + 0.34);
    var g = ctx.createGain();
    g.gain.setValueAtTime(0.001, t);
    g.gain.linearRampToValueAtTime(0.05, t + 0.06);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.5);
    o.connect(g); g.connect(A.master);
    o.start(t); o.stop(t + 0.55);
  };

  /* 回忆和声：按碎片情绪给和弦 */
  A.memoryStart = function (mood) {
    if (!A.ready) return;
    var ctx = A.ctx, t = now();
    var chords = {
      warm: [196.0, 246.9, 293.7, 392.0],
      gray: [174.6, 220.0, 261.6, 329.6],
      cold: [164.8, 207.7, 246.9, 311.1],
      dark: [146.8, 174.6, 220.0, 293.7],
      truth: [130.8, 164.8, 196.0, 261.6]
    };
    var ch = chords[mood] || chords.warm;
    A.padGain.gain.cancelScheduledValues(t);
    A.padGain.gain.setValueAtTime(A.padGain.gain.value, t);
    A.padGain.gain.linearRampToValueAtTime(0.5, t + 2.2);
    A._pads = A._pads || [];
    ch.forEach(function (f, i) {
      var o = ctx.createOscillator();
      o.type = i % 2 ? 'triangle' : 'sine';
      o.frequency.value = f;
      o.detune.value = (Math.random() * 8 - 4);
      var g = ctx.createGain();
      g.gain.value = 0.11 / (i + 1.2);
      var flt = ctx.createBiquadFilter();
      flt.type = 'lowpass';
      flt.frequency.value = mood === 'dark' || mood === 'truth' ? 700 : 1200;
      o.connect(g); g.connect(flt); flt.connect(A.padGain);
      o.start(t);
      A._pads.push({ o: o, g: g });
    });
  };

  A.memoryEnd = function () {
    if (!A.ready) return;
    var ctx = A.ctx, t = now();
    A.padGain.gain.cancelScheduledValues(t);
    A.padGain.gain.setValueAtTime(A.padGain.gain.value, t);
    A.padGain.gain.linearRampToValueAtTime(0, t + 2.0);
    var ps = A._pads || [];
    A._pads = [];
    ps.forEach(function (p) {
      try { p.o.stop(t + 2.2); } catch (e) {}
    });
  };

  /* 结局：一种是悬着不解决，一种是松开 */
  A.ending = function (kind) {
    if (!A.ready) return;
    var ctx = A.ctx, t = now();
    var notes = kind === 2
      ? [130.8, 196.0, 261.6, 329.6, 392.0, 523.3]
      : [146.8, 174.6, 220.0, 261.6];
    notes.forEach(function (f, i) {
      var o = ctx.createOscillator();
      o.type = 'sine';
      o.frequency.value = f;
      var g = ctx.createGain();
      g.gain.setValueAtTime(0, t + i * 0.5);
      g.gain.linearRampToValueAtTime(0.05, t + i * 0.5 + 1.6);
      g.gain.linearRampToValueAtTime(kind === 2 ? 0.0001 : 0.012, t + 22);
      o.connect(g); g.connect(A.master);
      o.start(t + i * 0.5);
      o.stop(t + 24);
    });
  };

  A.setFogDepth = function (k) {
    if (!A.ready) return;
    A.windGain.gain.setTargetAtTime(0.12 + k * 0.13, now(), 2.0);
  };

  YH.Audio = A;
})(window.YH = window.YH || {});
