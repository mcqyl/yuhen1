/* 余痕 · 后处理管线
   HDR 场景缓冲 → 亮部提取 → 多级高斯泛光 → 太阳光束 → ACES 色调映射 + 分级 + 暗角 + 颗粒 */
(function (YH) {
  'use strict';

  var T = THREE;
  var P = {};

  var renderer = null;
  var quadScene = null, quadCam = null, quad = null;
  var M = {};          // 各 pass 的材质
  var rt = {};         // 各渲染目标
  var bufW = 1, bufH = 1, dpr = 1;
  var quality = 'high';
  var sunUV = new T.Vector2(-8, -8);
  var sunVis = 0;
  var tmp = new T.Vector3();

  var VS = [
    'varying vec2 vUv;',
    'void main(){',
    '  vUv = uv;',
    '  gl_Position = vec4(position.xy, 0.0, 1.0);',
    '}'
  ].join('\n');

  /* 可调参数（world / main 会按段落改写） */
  P.params = {
    exposure: 1.0,
    bloom: 0.40,
    threshold: 1.06,
    knee: 0.55,
    shafts: 0.0,
    vignette: 0.92,
    grain: 0.028,
    saturation: 1.06,
    contrast: 1.11,
    lift: 0.004,
    warmth: 0.020,
    ca: 1.0,
    sharpen: 0.30,
    fade: 0.0,         // 全屏黑场（0 = 无）
    encode: 1.0,       // 调试：0 = 跳过 sRGB 编码
    raw: 0             // 调试：1 = 直接输出场景缓冲
  };

  function makeMat(fs, uniforms) {
    return new T.ShaderMaterial({
      uniforms: uniforms,
      vertexShader: VS,
      fragmentShader: fs,
      depthTest: false,
      depthWrite: false,
      transparent: false
    });
  }

  /* ---------------- 材质 ---------------- */

  function initMaterials() {
    // 亮部提取
    M.bright = makeMat([
      'uniform sampler2D tDiffuse;',
      'uniform float threshold;',
      'uniform float knee;',
      'varying vec2 vUv;',
      'void main(){',
      '  vec3 c = texture2D(tDiffuse, vUv).rgb;',
      '  float l = max(c.r, max(c.g, c.b));',
      '  float soft = clamp(l - threshold + knee, 0.0, 2.0 * knee);',
      '  soft = soft * soft / (4.0 * knee + 0.0001);',
      '  float w = max(soft, l - threshold) / max(l, 0.0001);',
      '  gl_FragColor = vec4(c * clamp(w, 0.0, 1.0), 1.0);',
      '}'
    ].join('\n'), {
      tDiffuse: { value: null },
      threshold: { value: P.params.threshold },
      knee: { value: P.params.knee }
    });

    // 可分离高斯
    M.blur = makeMat([
      'uniform sampler2D tDiffuse;',
      'uniform vec2 dir;',
      'varying vec2 vUv;',
      'void main(){',
      '  vec3 s = texture2D(tDiffuse, vUv).rgb * 0.227027;',
      '  s += (texture2D(tDiffuse, vUv + dir * 1.3846).rgb + texture2D(tDiffuse, vUv - dir * 1.3846).rgb) * 0.3162162;',
      '  s += (texture2D(tDiffuse, vUv + dir * 3.2307).rgb + texture2D(tDiffuse, vUv - dir * 3.2307).rgb) * 0.0702702;',
      '  gl_FragColor = vec4(s, 1.0);',
      '}'
    ].join('\n'), {
      tDiffuse: { value: null },
      dir: { value: new T.Vector2(1 / 512, 0) }
    });

    // 合成 + 调色
    M.final = makeMat([
      'uniform sampler2D tScene;',
      'uniform sampler2D tBloom1;',
      'uniform sampler2D tBloom2;',
      'uniform vec2 resolution;',
      'uniform vec2 sun;',
      'uniform float exposure;',
      'uniform float bloom;',
      'uniform float shafts;',
      'uniform float vigAmt;',
      'uniform float grainAmt;',
      'uniform float sat;',
      'uniform float contrast;',
      'uniform float lift;',
      'uniform float warmth;',
      'uniform float ca;',
      'uniform float sharpen;',
      'uniform float fade;',
      'uniform float encode;',
      'uniform float raw;',
      'uniform float time;',
      'varying vec2 vUv;',

      'vec3 aces(vec3 x){',
      '  const float a = 2.51, b = 0.03, c = 2.43, d = 0.59, e = 0.14;',
      '  return clamp((x * (a * x + b)) / (x * (c * x + d) + e), 0.0, 1.0);',
      '}',
      'vec3 lin2srgb(vec3 c){',
      '  return mix(c * 12.92, 1.055 * pow(max(c, vec3(0.0)), vec3(0.41666)) - 0.055, step(vec3(0.0031308), c));',
      '}',
      'float hash(vec2 p){',
      '  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);',
      '}',

      'void main(){',
      '  vec2 uv = vUv;',
      '  if (raw > 0.5) { gl_FragColor = vec4(texture2D(tScene, uv).rgb, 1.0); return; }',
      '  vec2 dc = uv - 0.5;',
      '  float r2 = dot(dc, dc);',

      // 轻微色散（边缘才有）
      '  vec2 off = dc * r2 * ca * 0.0022;',
      '  vec3 col;',
      '  col.r = texture2D(tScene, uv + off).r;',
      '  col.g = texture2D(tScene, uv).g;',
      '  col.b = texture2D(tScene, uv - off).b;',

      // 太阳光束：沿「像素 → 太阳」方向累积亮部
      '  vec3 sh = vec3(0.0);',
      '  if (shafts > 0.001) {',
      '    vec2 dir = (sun - uv) * 0.075;',
      '    vec2 tc = uv;',
      '    float decay = 1.0;',
      '    for (int i = 0; i < 14; i++) {',
      '      tc += dir;',
      '      sh += texture2D(tBloom2, tc).rgb * decay;',
      '      decay *= 0.885;',
      '    }',
      '    sh /= 14.0;',
      '  }',

      '  vec3 b1 = texture2D(tBloom1, uv).rgb;',
      '  vec3 b2 = texture2D(tBloom2, uv).rgb;',
      '  col += (b1 * 0.55 + b2 * 1.05) * bloom;',
      '  col += sh * shafts * 2.2;',

      // 轻锐化，抵消上采样发糊
      '  vec3 nb = texture2D(tScene, uv + vec2(1.0 / resolution.x, 0.0)).rgb',
      '          + texture2D(tScene, uv - vec2(1.0 / resolution.x, 0.0)).rgb',
      '          + texture2D(tScene, uv + vec2(0.0, 1.0 / resolution.y)).rgb',
      '          + texture2D(tScene, uv - vec2(0.0, 1.0 / resolution.y)).rgb;',
      '  col += (col - nb * 0.25) * sharpen;',

      '  col *= exposure;',
      '  col = aces(col);',

      // 对比：保端点的 S 曲线（旧的 (c-0.5)*k+0.5 会把暗部整片压成纯黑）
      '  float sc = clamp(contrast - 1.0, 0.0, 1.2) * 0.92;',
      '  col = mix(col, col * col * (3.0 - 2.0 * col), sc);',
      '  float lum = dot(col, vec3(0.2126, 0.7152, 0.0722));',
      '  col = mix(vec3(lum), col, sat);',

      // 分离色调：暗部偏冷，亮部偏暖
      '  float shMask = 1.0 - smoothstep(0.0, 0.55, lum);',
      '  float hiMask = smoothstep(0.45, 1.0, lum);',
      '  col += vec3(-0.020, -0.006, 0.026) * shMask * warmth * 6.0;',
      '  col += vec3(0.026, 0.010, -0.020) * hiMask * warmth * 6.0;',

      // 抬黑，避免死黑
      '  col = col * (1.0 - lift) + lift;',

      // 暗角
      '  float vig = smoothstep(0.95, 0.16, length(dc) * (1.16 + 0.22 * vigAmt));',
      '  col *= mix(1.0, vig, vigAmt * 0.9);',

      // 胶片颗粒（暗部更明显）
      '  float n = hash(uv * resolution + fract(time) * 91.7);',
      '  col += (n - 0.5) * grainAmt * (1.15 - lum * 0.7);',

      '  col = clamp(col, 0.0, 1.0);',
      '  col = mix(col, col * 0.94 + 0.02, 0.0);',
      '  col *= (1.0 - fade);',
      '  vec3 outc = mix(col, lin2srgb(col), encode);',
      '  gl_FragColor = vec4(outc, 1.0);',
      '}'
    ].join('\n'), {
      tScene: { value: null },
      tBloom1: { value: null },
      tBloom2: { value: null },
      resolution: { value: new T.Vector2(1, 1) },
      sun: { value: sunUV },
      exposure: { value: 1 },
      bloom: { value: 0.6 },
      shafts: { value: 0 },
      vigAmt: { value: 0.9 },
      grainAmt: { value: 0.03 },
      sat: { value: 1.05 },
      contrast: { value: 1.07 },
      lift: { value: 0.01 },
      warmth: { value: 0.02 },
      ca: { value: 1 },
      sharpen: { value: 0.3 },
      fade: { value: 0 },
      encode: { value: 1 },
      raw: { value: 0 },
      time: { value: 0 }
    });
  }

  /* ---------------- 渲染目标 ---------------- */

  function makeRT(w, h, samples) {
    var t = new T.WebGLRenderTarget(Math.max(1, w | 0), Math.max(1, h | 0), {
      type: T.HalfFloatType,
      format: T.RGBAFormat,
      minFilter: T.LinearFilter,
      magFilter: T.LinearFilter,
      depthBuffer: true,
      stencilBuffer: false,
      samples: samples || 0
    });
    t.texture.generateMipmaps = false;
    t.texture.colorSpace = T.NoColorSpace;
    return t;
  }

  function makeBloomRT(w, h) {
    var t = new T.WebGLRenderTarget(Math.max(1, w | 0), Math.max(1, h | 0), {
      type: T.HalfFloatType,
      format: T.RGBAFormat,
      minFilter: T.LinearFilter,
      magFilter: T.LinearFilter,
      depthBuffer: false,
      stencilBuffer: false
    });
    t.texture.generateMipmaps = false;
    t.texture.colorSpace = T.NoColorSpace;
    return t;
  }

  function disposeAll() {
    Object.keys(rt).forEach(function (k) {
      if (rt[k] && rt[k].dispose) rt[k].dispose();
      delete rt[k];
    });
  }

  function alloc() {
    disposeAll();
    var samples = quality === 'high' ? 4 : quality === 'med' ? 2 : 0;
    if (!renderer.capabilities.isWebGL2) samples = 0;

    rt.scene = makeRT(bufW, bufH, samples);
    var hw = Math.max(1, bufW >> 1), hh = Math.max(1, bufH >> 1);
    rt.bright = makeBloomRT(hw, hh);
    rt.blurA = makeBloomRT(hw, hh);
    rt.blurB = makeBloomRT(hw, hh);
    var qw = Math.max(1, bufW >> 2), qh = Math.max(1, bufH >> 2);
    rt.bloom2A = makeBloomRT(qw, qh);
    rt.bloom2B = makeBloomRT(qw, qh);

    M.final.uniforms.resolution.value.set(bufW, bufH);
  }

  /* ---------------- 对外 ---------------- */

  P.init = function (r) {
    renderer = r;
    initMaterials();

    quadScene = new T.Scene();
    quadCam = new T.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    quad = new T.Mesh(new T.PlaneGeometry(2, 2), M.final);
    quad.frustumCulled = false;
    quadScene.add(quad);

    P.setSize(window.innerWidth, window.innerHeight, Math.min(window.devicePixelRatio || 1, 1.6));
    return P;
  };

  P.setQuality = function (q) {
    quality = q;
    P.setSize(window.innerWidth, window.innerHeight, dpr);
  };

  P.quality = function () { return quality; };

  P.setSize = function (w, h, ratio) {
    if (ratio) dpr = ratio;
    bufW = Math.max(2, Math.floor(w * dpr));
    bufH = Math.max(2, Math.floor(h * dpr));
    alloc();
  };

  P.setSun = function (worldPos, camera) {
    tmp.copy(worldPos).project(camera);
    if (tmp.z > 1 || tmp.z < -1) { sunVis = 0; return; }
    sunUV.set(tmp.x * 0.5 + 0.5, tmp.y * 0.5 + 0.5);
    // 只取屏幕内一点的范围
    var edge = Math.max(
      Math.max(0, -sunUV.x), Math.max(0, sunUV.x - 1)
    ) + Math.max(Math.max(0, -sunUV.y), Math.max(0, sunUV.y - 1));
    sunVis = Math.max(0, 1 - edge * 1.6);
  };

  P.sunVisibility = function () { return sunVis; };

  P.render = function (scene, camera, dt, time) {
    var u = M.final.uniforms;
    u.exposure.value = P.params.exposure;
    u.bloom.value = P.params.bloom;
    u.shafts.value = P.params.shafts * sunVis;
    u.vigAmt.value = P.params.vignette;
    u.grainAmt.value = P.params.grain;
    u.sat.value = P.params.saturation;
    u.contrast.value = P.params.contrast;
    u.lift.value = P.params.lift;
    u.warmth.value = P.params.warmth;
    u.ca.value = P.params.ca;
    u.sharpen.value = P.params.sharpen;
    u.fade.value = P.params.fade;
    u.encode.value = P.params.encode;
    u.raw.value = P.params.raw;
    u.time.value = time || 0;

    // 1. 场景 → HDR
    renderer.setRenderTarget(rt.scene);
    renderer.clear(true, true, true);
    renderer.render(scene, camera);

    // 2. 亮部提取（半分辨率）
    M.bright.uniforms.tDiffuse.value = rt.scene.texture;
    M.bright.uniforms.threshold.value = P.params.threshold;
    M.bright.uniforms.knee.value = P.params.knee;
    quad.material = M.bright;
    renderer.setRenderTarget(rt.bright);
    renderer.render(quadScene, quadCam);

    // 3. 半分辨率模糊
    M.blur.uniforms.dir.value.set(1 / rt.bright.width, 0);
    M.blur.uniforms.tDiffuse.value = rt.bright.texture;
    quad.material = M.blur;
    renderer.setRenderTarget(rt.blurA);
    renderer.render(quadScene, quadCam);

    M.blur.uniforms.dir.value.set(0, 1 / rt.bright.height);
    M.blur.uniforms.tDiffuse.value = rt.blurA.texture;
    renderer.setRenderTarget(rt.blurB);
    renderer.render(quadScene, quadCam);

    // 4. 四分之一分辨率再模糊一次（大范围光晕）
    M.blur.uniforms.dir.value.set(1 / rt.bloom2A.width, 0);
    M.blur.uniforms.tDiffuse.value = rt.blurB.texture;
    quad.material = M.blur;
    renderer.setRenderTarget(rt.bloom2A);
    renderer.render(quadScene, quadCam);

    M.blur.uniforms.dir.value.set(0, 1 / rt.bloom2A.height);
    M.blur.uniforms.tDiffuse.value = rt.bloom2A.texture;
    renderer.setRenderTarget(rt.bloom2B);
    renderer.render(quadScene, quadCam);

    // 5. 合成上屏
    u.tScene.value = rt.scene.texture;
    u.tBloom1.value = rt.blurB.texture;
    u.tBloom2.value = rt.bloom2B.texture;
    quad.material = M.final;
    renderer.setRenderTarget(null);
    renderer.render(quadScene, quadCam);
  };

  /* 静态一帧（用于加载/标题） */
  P.renderOnce = function (scene, camera) {
    P.render(scene, camera, 0.016, 0);
  };

  YH.Post = P;
})(window.YH = window.YH || {});
