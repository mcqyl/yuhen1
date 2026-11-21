/* 余痕 · 主流程 */
(function (YH) {
  'use strict';

  var T = THREE;

  var renderer, camera, scene, player;
  var world = YH.World, audio = YH.Audio, mem = YH.Memory;

  var state = 'title';       // title | play | film | ending
  var stage = 0;
  var carried = null;
  var seen = {};
  var promptTarget = null;
  var promptMode = '';
  var lastT = 0;
  var stageFlashTimer = 0;
  var ui = {};
  var handLight = null;
  var endingDone = false;
  var post = null;
  var quality = 'high';
  var perfAcc = 0, perfFrames = 0, perfLock = false;

  var STAGE_TEXT = [
    { t: '第 一 段', s: '灶台还是热的，巷子里总有白汽' },
    { t: '第 二 段', s: '雾厚了一点，有些话开始没人说' },
    { t: '第 三 段', s: '雾最浓的地方，什么都快看不见了' },
    { t: '', s: '' }
  ];

  function $(id) { return document.getElementById(id); }

  function init() {
    var canvas = $('gl');
    renderer = new T.WebGLRenderer({ canvas: canvas, antialias: false, powerPreference: 'high-performance' });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75));
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = T.PCFSoftShadowMap;
    // 色调映射交给后处理（场景缓冲保持线性 HDR）
    renderer.toneMapping = T.NoToneMapping;
    if ('outputColorSpace' in renderer) renderer.outputColorSpace = T.SRGBColorSpace;

    camera = new T.PerspectiveCamera(66, window.innerWidth / window.innerHeight, 0.06, 900);
    camera.rotation.order = 'YXZ';
    camera.position.set(0, 1.62, 48);

    // 画质档位（?q=low|med|high 可强制）
    var qp = (location.search.match(/[?&]q=(low|med|high)/) || [])[1];
    if (qp) quality = qp;

    var built = world.build(renderer);
    scene = built.scene;
    scene.add(camera);

    post = YH.Post.init(renderer);

    // 手持物品补光
    handLight = new T.PointLight(0xffe4bb, 0.45, 2.2, 2);
    handLight.position.set(0.15, -0.05, -0.25);
    camera.add(handLight);

    mem.init();

    player = new YH.Player(camera, canvas, built.colliders);
    player.reset(0, 0, 48, 0);
    player.onStep = function () { audio.step(false); };
    player.onClimb = function () { audio.climb(); };

    world.setStage(0, true);
    applyQuality(quality);

    ui.title = $('title');
    ui.flash = $('flash');
    ui.name = $('hud-name');
    ui.prompt = $('hud-prompt');
    ui.promptLabel = ui.prompt.querySelector('span');
    ui.promptKey = ui.prompt.querySelector('kbd');
    ui.carry = $('hud-carry');
    ui.carryName = $('hud-carry-name');
    ui.hint = $('hud-hint');
    ui.stage = $('hud-stage');
    ui.filmWrap = $('film-wrap');
    ui.ending = $('ending');
    ui.loading = $('loading');

    var qbtns = document.querySelectorAll('.title-quality button');
    Array.prototype.forEach.call(qbtns, function (b) {
      if (b.getAttribute('data-q') === quality) b.classList.add('on');
      b.addEventListener('click', function (e) {
        e.stopPropagation();
        Array.prototype.forEach.call(qbtns, function (x) { x.classList.remove('on'); });
        b.classList.add('on');
        perfLock = true;
        applyQuality(b.getAttribute('data-q'));
      });
    });

    $('btn-enter').addEventListener('click', enterGame);
    $('btn-again').addEventListener('click', function () { location.reload(); });

    document.addEventListener('keydown', onKey);

    window.addEventListener('resize', onResize);

    // 进入前先渲染一帧
    renderer.setRenderTarget(null);
    post.renderOnce(scene, camera);
    ui.loading.classList.add('done');

    requestAnimationFrame(loop);
  }

  function enterGame() {
    audio.init();
    audio.resume();
    audio.setStage(0);
    ui.title.style.transition = 'opacity 1.6s ease';
    ui.title.style.opacity = '0';
    setTimeout(function () {
      ui.title.classList.add('hidden');
      ui.title.style.opacity = '';
    }, 1700);
    state = 'play';
    stage = 0;
    world.setStage(0);
    setTimeout(function () { showFlash('第一段\n灶台还是热的，巷子里总有白汽', 3400); }, 1200);
    setTimeout(function () { ui.hint.classList.add('hide'); }, 22000);
    var canvas = $('gl');
    if (canvas.requestPointerLock) canvas.requestPointerLock();
  }

  function onResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    applyQuality(quality, true);
  }

  /* ---------------- 画质 ---------------- */

  var Q_DPR = { high: 1.75, med: 1.3, low: 1.0 };
  var Q_SHADOW = { high: 4096, med: 2048, low: 1024 };

  function applyQuality(q, resizing) {
    if (!renderer) return;
    quality = q;
    var dpr = Math.min(window.devicePixelRatio || 1, Q_DPR[q] || 1.3);
    renderer.setPixelRatio(dpr);
    renderer.setSize(window.innerWidth, window.innerHeight);
    if (post && !resizing) post.setQuality(q);
    else if (post) post.setSize(window.innerWidth, window.innerHeight, dpr);
    if (world.setGrassQuality) world.setGrassQuality(q);
    if (world.sun) {
      var size = Q_SHADOW[q] || 2048;
      if (world.sun.shadow.mapSize.x !== size) {
        world.sun.shadow.mapSize.set(size, size);
        if (world.sun.shadow.map) {
          world.sun.shadow.map.dispose();
          world.sun.shadow.map = null;
        }
      }
    }
    var lab = document.querySelector('.title-quality');
    if (lab) {
      Array.prototype.forEach.call(lab.querySelectorAll('button'), function (b) {
        b.classList.toggle('on', b.getAttribute('data-q') === q);
      });
    }
  }

  /* ---------------- 输入 ---------------- */

  function onKey(e) {
    if (state !== 'play') return;
    if (e.code === 'KeyE') {
      e.preventDefault();
      if (carried) dropItem();
      else if (promptTarget) pickup(promptTarget);
    }
    if (e.code === 'KeyQ' && carried) dropItem();
  }

  /* ---------------- 提示 ---------------- */

  function setPrompt(text) {
    if (text) {
      if (promptMode !== text) {
        ui.promptLabel.textContent = text;
        ui.promptKey.textContent = text === '攀上' ? '空格' : 'E';
        promptMode = text;
      }
      ui.prompt.classList.add('show');
    } else {
      ui.prompt.classList.remove('show');
      promptMode = '';
    }
  }

  function showName(text) {
    ui.name.textContent = text;
    ui.name.classList.add('show');
    clearTimeout(showName._t);
    showName._t = setTimeout(function () { ui.name.classList.remove('show'); }, 4200);
  }

  function showFlash(text, ms) {
    ui.flash.textContent = text;
    ui.flash.style.opacity = '0';
    requestAnimationFrame(function () { ui.flash.style.opacity = '0.92'; });
    clearTimeout(showFlash._t);
    showFlash._t = setTimeout(function () { ui.flash.style.opacity = '0'; }, ms || 3200);
  }

  /* ---------------- 拾取 / 放下 ---------------- */

  function nearestFragment() {
    var best = null, bestD = 2.35;
    var fwd = player.forward();
    for (var i = 0; i < world.fragments.length; i++) {
      var f = world.fragments[i];
      if (!f.holder.visible) continue;
      var dx = f.holder.position.x - player.pos.x;
      var dz = f.holder.position.z - player.pos.z;
      var dy = f.holder.position.y - (player.pos.y + 1.1);
      var d = Math.sqrt(dx * dx + dz * dz);
      if (Math.abs(dy) > 1.7) continue;
      if (d > bestD) continue;
      var dot = (dx * fwd.x + dz * fwd.z) / (d || 1);
      if (d > 0.9 && dot < 0.1) continue;
      best = f; bestD = d;
    }
    return best;
  }

  function takeInHand(f) {
    camera.add(f.mesh);
    f.mesh.position.set(0.26, -0.30, -0.70);
    f.mesh.rotation.set(-0.12, 0.42, 0.1);
    f.mesh.scale.setScalar((f.def.scale || 1) * 0.50);
    f.holder.visible = false;
    ui.carryName.textContent = f.name;
    ui.carry.classList.add('show');
    carried = f;
  }

  function pickup(f) {
    if (state !== 'play' || carried) return;

    // 已经看过的东西：直接拿起，不再放动画
    if (f.seen) {
      f.holder.visible = false;
      takeInHand(f);
      audio.pickup(f.stage);
      showName(f.name);
      return;
    }

    state = 'film';
    player.frozen = true;
    setPrompt(null);
    ui.name.classList.remove('show');

    audio.pickup(f.stage);
    audio.memoryStart(f.def.mood);

    // 碎片从场景里消失，交给回忆
    f.holder.visible = false;

    mem.play(f.def).then(function () {
      f.seen = true;
      seen[f.id] = true;
      takeInHand(f);
      showName(f.name);
      player.frozen = false;
      state = 'play';
      audio.memoryEnd();
    });
  }

  function dropItem() {
    if (!carried) return;
    var f = carried;
    var fwd = player.forward();
    var dx = f.home.x - player.pos.x;
    var dz = f.home.z - player.pos.z;
    var nearHome = Math.sqrt(dx * dx + dz * dz) < 1.9;

    // 从相机取回
    camera.remove(f.mesh);
    f.holder.add(f.mesh);
    f.mesh.position.set(0, 0, 0);
    f.mesh.rotation.set(0, f.def.rot || 0, 0);
    f.mesh.scale.setScalar(f.def.scale || 1);
    f.holder.visible = true;

    if (nearHome) {
      f.holder.position.copy(f.home);
    } else {
      var px = player.pos.x + fwd.x * 0.9;
      var pz = player.pos.z + fwd.z * 0.9;
      var sy = player.supportAt(px, pz, player.pos.y + 0.6);
      f.home.set(px, sy + 0.06, pz);
      f.holder.position.copy(f.home);
    }
    // 已经看过，仍然保留碎片，但不再触发动画
    ui.carry.classList.remove('show');
    carried = null;
    audio.pickup(f.stage);
  }

  /* ---------------- 阶段 ---------------- */

  function checkStage() {
    var z = player.pos.z;
    var s = world.stageOf(z);
    window.__cs = { z: z, s: s, stage: stage };
    if (s > stage) {
      stage = s;
      world.setStage(Math.min(3, s));
      audio.setStage(Math.min(2, s));
      var txt = STAGE_TEXT[Math.min(3, s)];
      if (txt.t) showFlash(txt.t + '\n' + txt.s, 4200);
      // 手里拿着东西跨段：留在那边
      if (carried) {
        var f = carried;
        camera.remove(f.mesh);
        ui.carry.classList.remove('show');
        f.holder.add(f.mesh);
        f.mesh.position.set(0, 0, 0);
        f.mesh.rotation.set(0, f.def.rot || 0, 0);
        f.mesh.scale.setScalar(f.def.scale || 1);
        f.holder.position.copy(f.home);
        f.holder.visible = true;
        carried = null;
        setTimeout(function () { showName('东西留在了雾那边'); }, 1400);
      }
    }
  }

  /* ---------------- 结局 ---------------- */

  function seenCount(st) {
    var n = 0;
    world.fragments.forEach(function (f) { if (f.stage === st && f.seen) n++; });
    return n;
  }

  function triggerEnding() {
    if (endingDone) return;
    endingDone = true;
    state = 'ending';
    player.frozen = true;
    setPrompt(null);
    document.exitPointerLock && document.exitPointerLock();

    var s3 = seenCount(2);
    var total = 0;
    world.fragments.forEach(function (f) { if (f.seen) total++; });
    // 全捡齐 -> 雾散；什么都没捡 -> 空的草地；中间 -> 薄雾还在
    var kind = total >= world.fragments.length ? 2 : (total === 0 ? 0 : 1);

    audio.setStage(kind === 2 ? 3 : (kind === 0 ? 1 : 2));
    audio.ending(kind);

    ui.ending.classList.remove('hidden');
    ui.ending.style.opacity = '0';
    ui.ending.style.transition = 'opacity 1.8s ease';
    requestAnimationFrame(function () { ui.ending.style.opacity = '1'; });

    mem.playEnding(kind, { total: total }).then(function () {
      var card = ui.ending.querySelector('.ending-card');
      $('ending-kicker').textContent = kind === 2 ? 'ENDING 03 / 雾散之后'
        : kind === 0 ? 'ENDING 01 / 什么也没带走' : 'ENDING 02 / 薄雾还在';
      $('ending-title').textContent = kind === 2 ? '雾散了' : kind === 0 ? '草地是空的' : '雾没有散';
      $('ending-line').textContent = kind === 2
        ? '碗底的荷包蛋、烫手的油纸袋、洇开的红字、\n那句骗了你一辈子的“我不饿”。\n你都看完了，也没有替谁原谅谁。\n风把叶子吹到脚边，你踩了一脚，继续往前走。'
        : kind === 0
          ? '你什么都没有捡。\n草地上很轻，轻得像什么都没发生过。\n雾一直在，你也一直往前走。'
          : '你只把记得的那一点暖收好了。\n雾停在原来的地方，不浓也不淡。\n那些没看的，还在那里。';
      $('ending-stat').textContent = '看过 ' + total + ' / 13 段回忆　·　第三段 ' + seenCount(2) + ' 段';
      card.classList.add('on');
    });
  }

  /* ---------------- 主循环 ---------------- */

  function loop(t) {
    requestAnimationFrame(loop);
    window.__f = (window.__f | 0) + 1; window.__st = state;
    var now = t / 1000;
    var dt = lastT ? Math.min(0.05, now - lastT) : 0.016;
    lastT = now;

    if (state === 'play' || state === 'title') {
      player.update(dt);
      world.update(dt, camera);
      checkStage();

      if (state === 'play') {
        // 拾取 / 攀爬提示
        if (carried) {
          setPrompt('放下');
          promptTarget = null;
        } else {
          var f = nearestFragment();
          promptTarget = f;
          if (f) setPrompt('捡起');
          else if (player.findLedge()) setPrompt('攀上');
          else setPrompt(null);
        }
        // 走到草地深处，结局
        if (player.pos.z < -137 && stage >= 2) triggerEnding();
        audio.setHeight(camera.position.y);
      }
    } else {
      world.update(dt, camera);
    }

    // 手持物轻微晃动
    if (carried) {
      var tt = performance.now() / 1000;
      carried.mesh.position.y = -0.30 + Math.sin(tt * 1.6) * 0.005 + Math.sin(player.bobPhase) * 0.004;
      carried.mesh.rotation.z = 0.1 + Math.sin(tt * 0.9) * 0.03;
    }

    // 回忆片/结局期间，3D 画面被完全遮住，省下 GPU
    if (state !== 'film' && state !== 'ending') {
      var sp = world.sunPos && world.sunPos();
      if (sp) post.setSun(sp, camera);
      post.render(scene, camera, dt, now);
    }

    // 帧率兜底：掉帧会自动降一档
    if (!perfLock && state === 'play') {
      perfAcc += dt;
      perfFrames++;
      if (perfAcc > 2.4) {
        var avgMs = (perfAcc / perfFrames) * 1000;
        if (avgMs > 27 && quality === 'high') { applyQuality('med'); perfLock = true; }
        else if (avgMs > 30 && quality === 'med') { applyQuality('low'); perfLock = true; }
        perfAcc = 0; perfFrames = 0;
      }
    }
  }

  window.addEventListener('load', function () {
    try {
      init();
    } catch (err) {
      console.error(err);
      var l = document.getElementById('loading');
      if (l) l.textContent = '初始化失败：' + err.message;
    }
  });

  // 调试入口（便于定位与验收）
  window.__YH = {
    tp: function (x, z, y) { player.pos.set(x, y || 0, z); },
    stage: function (s) { stage = s; world.setStage(s, true); },
    seenAll: function () { world.fragments.forEach(function (f) { f.seen = true; seen[f.id] = true; }); },
    state: function () { return { state: state, stage: stage, pos: player.pos.clone(), carried: carried && carried.name }; },
    cam: function () { return { yaw: player.yaw, pitch: player.pitch }; },
    quality: function (q) { perfLock = true; applyQuality(q); return quality; },
    view: function (yaw, pitch) { player.yaw = yaw; if (pitch != null) player.pitch = pitch; },
    stats: function () { return { calls: renderer.info.render.calls, tris: renderer.info.render.triangles, geos: renderer.info.memory.geometries, tex: renderer.info.memory.textures }; }
  };
})(window.YH = window.YH || {});
