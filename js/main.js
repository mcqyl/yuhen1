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
    { t: '童 年 区', s: '灶台还是热的，巷子里总有白汽' },
    { t: '少 年 区', s: '光变得干净，走廊里的话却开始发凉' },
    { t: '亲 情 与 失 去', s: '雾厚起来，医院的灯是白的' },
    { t: '成 年 疏 离', s: '城市没熄灯，也没有一盏是为你亮的' },
    { t: '终 章 区', s: '雾最薄的地方，一条路一直向前' },
    { t: '回 忆 荒 原', s: '五片回忆，都从这里延伸出去' }
  ];
  var visited = {};

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
    player.reset(0, 0, -20, Math.PI);
    player.onStep = function () { audio.step(false); };
    player.onClimb = function () { audio.climb(); };

    world.setStage(5, true);
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
    audio.setStage(5);
    ui.title.style.transition = 'opacity 1.6s ease';
    ui.title.style.opacity = '0';
    setTimeout(function () {
      ui.title.classList.add('hidden');
      ui.title.style.opacity = '';
    }, 1700);
    state = 'play';
    stage = 5;
    visited = {};
    visited[5] = true;
    world.setStage(5);
    setTimeout(function () { showPlace('回 忆 荒 原', '指尖划开镜面的水汽之后，你站在这里'); }, 900);
    setTimeout(function () { ui.hint.classList.add('hide'); }, 26000);
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
        ui.promptKey.textContent = (text === '攀上' || text === '要爬上去') ? '空格' : 'E';
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

  function showPlace(title, sub, ms) {
    ui.stage.innerHTML = title + (sub ? '<small>' + sub + '</small>' : '');
    ui.stage.style.transition = 'opacity 1.6s ease';
    ui.stage.style.opacity = '0';
    requestAnimationFrame(function () { ui.stage.style.opacity = '0.9'; });
    clearTimeout(showPlace._t);
    showPlace._t = setTimeout(function () { ui.stage.style.opacity = '0'; }, ms || 5200);
  }

  function showFlash(text, ms) {
    ui.flash.textContent = text;
    ui.flash.style.opacity = '0';
    requestAnimationFrame(function () { ui.flash.style.opacity = '0.92'; });
    clearTimeout(showFlash._t);
    showFlash._t = setTimeout(function () { ui.flash.style.opacity = '0'; }, ms || 3200);
  }

  /* ---------------- 拾取 / 放下 ---------------- */

  function nearestFragment(ignoreHeight) {
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
      // 高处的东西要先站上去：脚底离它太高就够不着
      if (!ignoreHeight && f.holder.position.y - player.pos.y > 1.25) continue;
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
    // 记录“放回原处 / 丢下”，结局判定要用
    f.dropped = true;
    ui.carry.classList.remove('show');
    carried = null;
    audio.pickup(f.stage);
  }

  /* ---------------- 阶段 ---------------- */

  function checkStage() {
    var s = world.stageAt(player.pos.x, player.pos.z);
    window.__cs = { x: +player.pos.x.toFixed(1), z: +player.pos.z.toFixed(1), s: s, stage: stage };
    if (s !== stage) {
      stage = s;
      world.setStage(s);
      audio.setStage(s);
      if (!visited[s]) {
        visited[s] = true;
        var txt = STAGE_TEXT[s] || STAGE_TEXT[5];
        showPlace(txt.t, txt.s);
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

    var all = world.fragments.length;
    var total = 0, dropped = 0;
    world.fragments.forEach(function (f) {
      if (f.seen) total++;
      if (f.dropped) dropped++;
    });

    // 结局分支（按《地图与动画设计方案》）：
    // 0 什么都没捡 → 空白；1 全部看过且空手 → 放下；2 全部看过且手里还留着 → 释然
    var kind = total === 0 ? 0
      : (total >= all ? (carried ? 2 : 1) : 3);

    audio.setStage(6);
    audio.ending(kind === 2 ? 2 : 0);

    ui.ending.classList.remove('hidden');
    ui.ending.style.opacity = '0';
    ui.ending.style.transition = 'opacity 1.8s ease';
    requestAnimationFrame(function () { ui.ending.style.opacity = '1'; });

    mem.playEnding(kind, { total: total, dropped: dropped }).then(function () {
      var card = ui.ending.querySelector('.ending-card');
      $('ending-kicker').textContent = kind === 2 ? 'ENDING 03 / 雾散之后'
        : kind === 1 ? 'ENDING 02 / 我看过了，也放下了'
          : kind === 0 ? 'ENDING 01 / 什么也没带走' : 'ENDING 04 / 薄雾还在';
      $('ending-title').textContent = kind === 2 ? '雾散了'
        : kind === 1 ? '空着手' : kind === 0 ? '草地是空的' : '雾没有散';
      $('ending-line').textContent = kind === 2
        ? '碗底的荷包蛋、烫手的油纸袋、洇开的红字、\n那句骗了你一辈子的“我不饿”。\n你把它们一块一块捡起来，也没有替谁原谅谁。\n风把叶子吹到脚边，你踩了一脚，带着它们继续往前走。'
        : kind === 1
          ? '你把每一块都看完了，然后一块一块放回草里。\n雾散开的时候没有强光，路只是比来时清楚了一点。\n空着手往前走，不欠谁，也不再欠自己。'
          : kind === 0
            ? '你什么都没有捡。\n草地上很轻，轻得像什么都没发生过。\n雾一直在，你也一直往前走。'
            : '你只看了一部分，就往前走了。\n雾停在原来的地方，不浓也不淡。\n那些没看的，还在那里。';
      $('ending-stat').textContent = '看过 ' + total + ' / ' + all + ' 段回忆　·　放下 ' + dropped + ' 块';
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
          else if (nearestFragment(true)) setPrompt('要爬上去');
          else if (player.findLedge()) setPrompt('攀上');
          else setPrompt(null);
        }
        // 走到终章长路的尽头，结局
        if (world.endReached(player.pos.x, player.pos.z)) triggerEnding();
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
    seenAll: function () {
      world.fragments.forEach(function (f) { f.seen = true; f.dropped = false; seen[f.id] = true; });
    },
    dropAll: function () {
      if (carried) dropItem();
      world.fragments.forEach(function (f) { f.dropped = true; });
    },
    place: function (i) {
      var p = world.PLACES[i];
      if (!p) return null;
      player.reset(p.gate.x, 0, p.gate.z, 0);
      return p.name;
    },
    state: function () { return { state: state, stage: stage, pos: player.pos.clone(), carried: carried && carried.name }; },
    cam: function () { return { yaw: player.yaw, pitch: player.pitch }; },
    scene: function () { return world.scene(); },
    camera: function () { return camera; },
    quality: function (q) { perfLock = true; applyQuality(q); return quality; },
    view: function (yaw, pitch) { player.yaw = yaw; if (pitch != null) player.pitch = pitch; },
    stats: function () { return { calls: renderer.info.render.calls, tris: renderer.info.render.triangles, geos: renderer.info.memory.geometries, tex: renderer.info.memory.textures }; }
  };
})(window.YH = window.YH || {});
