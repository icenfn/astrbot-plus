import presetEnv from "postcss-preset-env";

/**
 * PostCSS pipeline — CSS-level down-levelling for old Android WebViews.
 *
 * ## 作用范围（对应「polyfill/PostCSS 不应污染现代浏览器」的要求）
 *
 * Vuetify 4 官方支持基线是 Chrome 107+ / Safari 16+（`@layer`、`color-mix()` 等
 * 正好都在这个区间内落地）。我们的底线是 Android WebView 91，因此**只有**
 * 91~106 这一段「部分支持」的引擎才真正需要降级。三类降级的处理方式如下：
 *
 *   1. JS polyfill（core-js / @vitejs/plugin-legacy）
 *      → 天然只作用于旧引擎：core-js 每个 polyfill 都会先做特性探测，现代浏览器
 *        检测到原生实现后**不会打补丁**；legacy 的 SystemJS 包由 `nomodule`
 *        门控，现代引擎根本不下载。
 *
 *   2. `dvh` / `color-mix()` / `oklch()` 等 CSS 值语法
 *      → 走**叠加式**降级：先把兼容写法插在原声明之前，原生值原样保留。现代
 *        浏览器照旧用原生语法（后出现的声明胜出），老引擎因为解析失败而回落到
 *        兼容声明。即「降级存在，但不改变现代浏览器的行为」。
 *
 *   3. `@layer` 级联层
 *      → 这是唯一**无法**做增量降级的项：单产物构建 + CSS 级联层是结构性的，
 *        没法同时输出「分层」和「不分层」两份。因此构建期统一展平，再由
 *        `src/compat/legacy-css.ts` 在运行期把 Vuetify **运行时**注入的主题表
 *        也一并去层，使新旧引擎落在同一个「无层级」世界、级联结果完全一致。
 *        这也正是修复 v-chip / v-switch / v-btn 不跟随主题色的关键。
 *
 * Scope: the WHOLE Vuetify 4 stylesheet surface (Vuetify 4.2.x), not a hand-
 * picked subset. Vite runs every stylesheet it resolves — including Vuetify 4's
 * own component CSS from node_modules — through this pipeline.
 *
 * ── What Vuetify 4.2.x actually uses (measured in node_modules) ─────────────
 *   @layer ............ 36 occurrences   (Chrome 99+)   -> MUST be flattened
 *   color-mix() ....... 148              (Chrome 111+)  -> lowered where static
 *   :where()/:is() .... supported ≥ Chrome 88          -> already safe on 91
 *   oklch() ........... 1                (Chrome 111+)  -> converted to rgb()
 *   dvh ............... 13               (Chrome 108+)  -> needs a vh fallback
 *   :has() ............ ~45              (Chrome 105+)  -> no static lowering
 *   @property ......... 6                (Chrome 85+)   -> safe / ignorable
 *
 * ── Plugin 1: postcss-preset-env (SINGLE source of modern-CSS lowering) ─────
 * stage: 2 enables the COMPLETE stage-2 feature set (not a hand-picked subset),
 * which is what covers Vuetify 4. It owns cascade-layers (@layer flattening),
 * color-mix-function, nesting-rules, logical-properties, media-query-ranges,
 * relative-color-syntax, and Autoprefixer. Running the bundled transforms AND
 * separate @csstools/* plugins at the same time would double-process the CSS,
 * so the preset is the SINGLE source of truth (conflict-avoidance boundary). It
 * reads the same `browserslist` as the JS/legacy layer.
 *
 * `enableClientSidePolyfills` is intentionally left OFF: per its README it "does
 * not cause the browsers libraries to be included in your bundle" — enabling it
 * would emit `.js-*` fallback selectors whose polyfill JS is not shipped, i.e.
 * dead CSS, and would add a new JS dependency (exactly the kind of conflict the
 * user asked us to avoid). The dynamic-viewport gap is closed below instead.
 *
 * ── Plugin 2: local viewport-unit fallback (COMPLEMENTARY, no overlap) ──────
 * postcss-preset-env has NO feature for viewport units, so `100dvh` (used by
 * Vuetify's `v-application` wrapper and the `h-screen`-style utilities) is left
 * untouched — and Chromium 91 cannot parse `dvh`, so it drops the whole
 * declaration. This tiny plugin inserts a `vh`/`vw` fallback immediately BEFORE
 * any dynamic viewport unit, so old WebViews use the fallback while modern ones
 * keep the dynamic value (source order wins). It only clones declarations and
 * never touches @layer/color-mix/nesting, so it cannot conflict with the preset.
 */
function viewportUnitFallback() {
  const DYNAMIC = { dvh: "vh", svh: "vh", lvh: "vh", dvw: "vw", svw: "vw", lvw: "vw" };
  // Match a numeric dimension immediately followed by a dynamic viewport unit.
  // A plain word boundary (`\b`) before the unit does NOT work for the usual
  // `100dvh` form — there is no boundary between `0` and `d` — so the unit is
  // anchored to a required number prefix instead (this also covers `calc(...)`,
  // `min(...)`, and `0.5svh`). The trailing `\b` still applies so identifiers
  // such as `dvhx` are ignored.
  const re = /(\d+(?:\.\d+)?)(dvh|svh|lvh|dvw|svw|lvw)\b/gi;

  return {
    postcssPlugin: "viewport-unit-fallback",
    Declaration(decl) {
      if (!decl.value) return;
      re.lastIndex = 0;
      if (!re.test(decl.value)) return;
      const fallback = decl.value.replace(
        re,
        (_, num, unit) => num + (DYNAMIC[unit.toLowerCase()] ?? unit),
      );
      if (fallback === decl.value) return;
      // Insert the fallback BEFORE the original so the original wins where
      // supported, and old engines (which dropped the original) keep the clone.
      decl.cloneBefore({ value: fallback });
    },
  };
}
viewportUnitFallback.postcss = true;

/**
 * Plugin 3: color-mix() fallback for old WebViews (COMPLEMENTARY to the preset).
 *
 * postcss-preset-env can only lower `color-mix()` when every colour argument is
 * statically resolvable. Vuetify mixes a *runtime* custom property with
 * `transparent`:
 *   color-mix(in srgb, var(--v-elevation-overlay-color) 8%, transparent)
 * The value depends on the active theme, so the preset leaves it untouched — and
 * Chromium 91 (needs Chrome 111+) drops the whole declaration. Because the overlay
 * colour resolves to an RGB triplet at runtime (`elevation-overlay-color` is a
 * `#rrggbb` value in src/plugins/vuetify.ts, so Vuetify serialises it to `r, g, b`),
 * the mix is arithmetically just `rgba(<triplet>, 0.08)`.
 *
 * Handled shapes — the themable color-mix surface of Vuetify 4.2 (i.e. the mixes
 * whose only unknown is a runtime custom property and whose other operand is
 * `transparent`):
 *   color-mix(in srgb, var(--c) N%, transparent)
 *       -> rgba(var(--c), N/100)
 *   color-mix(in srgb, rgb(var(--c)) calc(var(--o) * 100%), transparent)
 *       -> rgba(var(--c), var(--o))
 *   color-mix(in srgb, rgb(var(--c)) N%, transparent)
 *       -> rgba(var(--c), N/100)
 * Anything the plugin cannot rewrite is left alone (never silently dropped): the
 * few remaining mixes combine a runtime triplet with an *opaque* literal
 * (e.g. `rgb(var(--v-theme-surface-variant)) 20%, #888`), which has no exact
 * static lowering without knowing the active theme — those keep Vuetify's base
 * track/thumb declarations on engines that drop the declaration.
 */
/**
 * 该声明是否位于 `@supports (color: color-mix(...))` 块内。
 *
 * 这类块本身就是「只在支持 color-mix 时才生效」的渐进增强写法，老引擎会整块
 * 跳过，因此在块内保留原生 color-mix 既安全又最精确 —— 不需要兜底。
 */
function insideColorMixSupports(decl) {
  let node = decl.parent;
  while (node) {
    if (
      node.type === "atrule" &&
      node.name === "supports" &&
      typeof node.params === "string" &&
      node.params.indexOf("color-mix") !== -1
    ) {
      return true;
    }
    node = node.parent;
  }
  return false;
}

/** 取一段 `color-mix(...)` 内容里第一个颜色参数（跳过 `in srgb,`）。 */
function firstColorArg(inner) {
  let body = inner.replace(/^\s*in\s+[a-z-]+\s*,/i, "");
  // 若是嵌套 color-mix，递归取其内部第一个颜色。
  if (/^\s*color-mix\(/i.test(body)) {
    const nested = extractCall(body.trim(), 0);
    if (nested) return fallbackForColorMix(nested.inner);
  }
  const m = body.match(/^\s*(rgba?\([^()]*\)|var\([^()]*\)|#[0-9a-f]{3,8}|[a-z]+)/i);
  return m ? m[1] : "transparent";
}

/** 从字符串 pos 处的 `color-mix(` 开始，取出配对的内部内容。 */
function extractCall(str, pos) {
  const open = str.indexOf("(", pos);
  if (open === -1) return null;
  let depth = 0;
  for (let i = open; i < str.length; i++) {
    if (str[i] === "(") depth++;
    else if (str[i] === ")") {
      depth--;
      if (depth === 0) return { inner: str.slice(open + 1, i), end: i + 1 };
    }
  }
  return null;
}

/** 计算一个 color-mix 的兜底值：退回它的第一个颜色参数。 */
function fallbackForColorMix(inner) {
  return firstColorArg(inner);
}

/**
 * 把一段值里所有顶层 `color-mix(...)` 替换为兜底颜色。
 * 浏览器不支持 color-mix 时整条声明会被丢弃，因此兜底必须是**颜色值**本身。
 */
function replaceColorMix(value) {
  let out = "";
  let i = 0;
  while (i < value.length) {
    const at = value.indexOf("color-mix(", i);
    if (at === -1) {
      out += value.slice(i);
      break;
    }
    out += value.slice(i, at);
    const call = extractCall(value, at);
    if (!call) {
      out += value.slice(at);
      break;
    }
    out += fallbackForColorMix(call.inner);
    i = call.end;
  }
  return out;
}

function colorMixFallback() {
  const OPACITY =
    /color-mix\(\s*in\s+srgb\s*,\s*rgb\(var\((--[\w-]+)\)\)\s+calc\(var\((--[\w-]+)\)\s*\*\s*100%\)\s*,\s*transparent\s*\)/gi;
  const RGB_TRANSPARENT =
    /color-mix\(\s*in\s+srgb\s*,\s*rgb\(var\((--[\w-]+)\)\)\s+([\d.]+)%\s*,\s*transparent\s*\)/gi;
  const OVERLAY =
    /color-mix\(\s*in\s+srgb\s*,\s*var\((--[\w-]+)\)\s+([\d.]+)%\s*,\s*transparent\s*\)/gi;
  return {
    postcssPlugin: "color-mix-fallback",
    Declaration(decl) {
      if (!decl.value || decl.value.indexOf("color-mix") === -1) return;
      let value = decl.value;
      value = value.replace(
        OPACITY,
        (_m, color, opacity) => `rgba(var(${color}), var(${opacity}))`,
      );
      value = value.replace(
        RGB_TRANSPARENT,
        (_m, color, pct) => `rgba(var(${color}), ${Number(pct) / 100})`,
      );
      value = value.replace(
        OVERLAY,
        (_m, color, pct) => `rgba(var(${color}), ${Number(pct) / 100})`,
      );
      // 剩下的形态（与实体色的混合、以及嵌套 color-mix）统一用通用递归兜底，
      // 例如 Vuetify 的 `.v-switch--inset-material .v-switch__track`：
      //   color-mix(in srgb, rgb(var(--v-theme-on-surface-variant)) 73%, #ccc)
      // 这类规则不写在 @supports 里，WebView 91 会整条丢弃 -> 轨道没有背景。
      if (value.indexOf("color-mix(") !== -1 && !insideColorMixSupports(decl)) {
        value = replaceColorMix(value);
      }
      if (value !== decl.value) {
        // 叠加式降级：把 rgba() 兜底**插在原声明之前**，原生 color-mix 继续保留。
        //   • 支持 color-mix 的引擎（Chrome 111+）：两条声明都合法，后者（原生）
        //     胜出，完全走浏览器原生实现，未被 polyfill 改动分毫；
        //   • 不支持的老引擎（WebView 91）：color-mix 整条声明被解析器丢弃，
        //     只剩前面的 rgba() 兜底 —— 正好是需要的效果。
        decl.cloneBefore({ value });
      }
    },
  };
}
colorMixFallback.postcss = true;

export default {
  // Array form of PRE-INSTANTIATED plugins. Vite's array branch does not accept
  // a `[name, options]` tuple (it only filters the list), so each plugin is
  // imported and instantiated here instead.
  plugins: [
    presetEnv({
      // Complete stage-2 feature set — the whole modern-CSS surface Vuetify 4
      // relies on, not just a couple of transforms enabled on demand.
      stage: 2,
      // One Autoprefixer instance, driven by package.json "browserslist".
      autoprefixer: {},
      features: {
        // Keep Vuetify's runtime CSS custom properties intact — resolving var()
        // to static values would break its runtime theme switching.
        "custom-properties": false,
        // 交给本地 colorMixFallback()：它产出的是「叠加式」降级（先写 rgba 兜底，
        // 再保留原生 color-mix）。preset 自带的 color-mix 会**破坏性**改写，导致
        // 现代浏览器也拿不到原生 color-mix —— 那才是「Polyfill 污染现代浏览器」
        // 的典型症状，这里显式关掉。
        //
        // 注意：cssdb 里的 feature id 是 `color-mix`（由
        // @csstools/postcss-color-mix-function 提供）。postcss-preset-env 10.x
        // 已不再接受旧的 `color-mix-function` 写法，写错会直接抛
        // `Unknown feature: "color-mix-function"`。
        "color-mix": false,
        // 变参形态（color-mix(A 10%, B 20%, C)）属于同一个 transform 家族，
        // 一并关掉，保证所有 color-mix 只在本地插件里以叠加式降级出现。
        "color-mix-variadic-function-arguments": false,
      },
    }),
    viewportUnitFallback(),
    colorMixFallback(),
  ],
};
