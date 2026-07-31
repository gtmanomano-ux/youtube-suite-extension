/**
 * YouTube Suite - settings.js
 * popup / options で共有する設定アクセスとユーティリティ
 */

"use strict";

const YTS = (() => {
  const DEFAULTS = {
    keywordEnabled: true,
    ytFilterKeywords: [],
    enabled: true,
    gameEnabled: true,
    mixEnabled: true,
    blockButton: true,
    speedEnabled: true,
    playbackSpeed: 1.0,
    boostEnabled: false,
    volumeBoost: 2.0,
    language: "auto",
    rotationEnabled: true,
    rotationStep: 90,
    keybinds: {
      speedDown: { code: "KeyQ", ctrl: false, shift: true, alt: false },
      speedUp: { code: "KeyE", ctrl: false, shift: true, alt: false },
      rotateLeft: { code: "KeyA", ctrl: false, shift: true, alt: false },
      rotateRight: { code: "KeyD", ctrl: false, shift: true, alt: false },
    },
  };

  const ROTATION_STEPS = [1, 45, 90, 180];

  const ACTION_KEYS = {
    speedDown: "actSpeedDown",
    speedUp: "actSpeedUp",
    rotateLeft: "actRotateLeft",
    rotateRight: "actRotateRight",
  };
  const actionLabel = (action) => I18N.t(ACTION_KEYS[action]);

  const SPEED = { min: 0.1, max: 5.0, step: 0.1 };
  const BOOST = { min: 1.0, max: 5.0, step: 0.1 };

  const round2 = (n) => Math.round(n * 100) / 100;

  function clamp(n, range, fallback) {
    const v = Number(n);
    if (!Number.isFinite(v)) return fallback;
    return Math.min(range.max, Math.max(range.min, round2(v)));
  }

  const clampSpeed = (n) => clamp(n, SPEED, 1.0);
  const clampBoost = (n) => clamp(n, BOOST, 1.0);

  /** 1.0 / 1.25 のように、小数第2位があるときだけ2桁で表示する */
  const format = (n) => (Math.round(n * 100) % 10 === 0 ? n.toFixed(1) : n.toFixed(2));

  function sanitize(obj) {
    const s = Object.assign({}, DEFAULTS, obj);
    s.playbackSpeed = clampSpeed(s.playbackSpeed);
    s.volumeBoost = clampBoost(s.volumeBoost);
    if (!Array.isArray(s.ytFilterKeywords)) s.ytFilterKeywords = DEFAULTS.ytFilterKeywords.slice();
    if (!ROTATION_STEPS.includes(Number(s.rotationStep))) s.rotationStep = DEFAULTS.rotationStep;
    s.rotationStep = Number(s.rotationStep);
    if (["auto", "ja", "en"].indexOf(s.language) < 0) s.language = DEFAULTS.language;
    s.keybinds = sanitizeKeybinds(s.keybinds);
    return s;
  }

  /** 壊れた/欠けたキー設定を既定値で補う */
  function sanitizeKeybinds(raw) {
    const src = raw && typeof raw === "object" ? raw : {};
    const out = {};
    Object.keys(DEFAULTS.keybinds).forEach((action) => {
      const b = src[action];
      out[action] =
        b && typeof b === "object" && typeof b.code === "string" && b.code
          ? { code: b.code, ctrl: !!b.ctrl, shift: !!b.shift, alt: !!b.alt }
          : Object.assign({}, DEFAULTS.keybinds[action]);
    });
    return out;
  }

  // ---- キーバインド表示 / 取得 -----------------------------------------
  /** KeyboardEvent.code を人が読める表記にする */
  function keyLabel(code) {
    if (!code) return "";
    if (/^Key[A-Z]$/.test(code)) return code.slice(3);
    if (/^Digit\d$/.test(code)) return code.slice(5);
    if (/^Numpad/.test(code)) return "Num " + code.slice(6);
    if (/^F\d{1,2}$/.test(code)) return code;
    const MAP = {
      ArrowUp: "↑",
      ArrowDown: "↓",
      ArrowLeft: "←",
      ArrowRight: "→",
      Space: "Space",
      Enter: "Enter",
      Escape: "Esc",
      Backquote: "`",
      Minus: "-",
      Equal: "=",
      BracketLeft: "[",
      BracketRight: "]",
      Backslash: "\\",
      Semicolon: ";",
      Quote: "'",
      Comma: ",",
      Period: ".",
      Slash: "/",
      Home: "Home",
      End: "End",
      PageUp: "PageUp",
      PageDown: "PageDown",
      Insert: "Insert",
      Delete: "Delete",
      Tab: "Tab",
    };
    return MAP[code] || code;
  }

  function formatBinding(b) {
    if (!b || !b.code) return I18N.t("unset");
    const parts = [];
    if (b.ctrl) parts.push("Ctrl");
    if (b.alt) parts.push("Alt");
    if (b.shift) parts.push("Shift");
    parts.push(keyLabel(b.code));
    return parts.join(" + ");
  }

  /** 修飾キー単独の入力かどうか */
  const isModifierOnly = (code) =>
    /^(Control|Shift|Alt|Meta)(Left|Right)$/.test(code) || code === "CapsLock";

  /** KeyboardEvent からキーバインドを作る (修飾キー単独なら null) */
  function bindingFromEvent(e) {
    if (!e.code || isModifierOnly(e.code)) return null;
    return {
      code: e.code,
      ctrl: e.ctrlKey || e.metaKey,
      shift: e.shiftKey,
      alt: e.altKey,
    };
  }

  const sameBinding = (a, b) =>
    !!a &&
    !!b &&
    a.code === b.code &&
    !!a.ctrl === !!b.ctrl &&
    !!a.shift === !!b.shift &&
    !!a.alt === !!b.alt;

  /**
   * 旧「チャンネルブロック」の設定をキーワードへ移行する。
   * 表示名で登録されていたものだけが移行できる (識別子は表示名と一致しないため)。
   */
  function migrate(raw, settings) {
    const old = raw && raw.blockedChannels;
    if (!Array.isArray(old) || !old.length) return Promise.resolve(settings);

    const migrated = old
      .filter((ch) => typeof ch === "string" && ch.startsWith("name:"))
      .map((ch) => `"${ch.slice(5).trim()}"`)
      .filter((kw) => kw !== '""');

    const keywords = settings.ytFilterKeywords.slice();
    migrated.forEach((kw) => {
      if (!keywords.some((k) => k.trim().toLowerCase() === kw.toLowerCase())) keywords.push(kw);
    });

    settings.ytFilterKeywords = keywords;
    return new Promise((resolve) =>
      chrome.storage.sync.set(
        { ytFilterKeywords: keywords, blockedChannels: [] },
        () => resolve(settings)
      )
    );
  }

  const load = () =>
    new Promise((resolve) =>
      chrome.storage.sync.get(
        Object.assign({ blockedChannels: [] }, DEFAULTS),
        (res) => {
          const raw = chrome.runtime.lastError ? null : res;
          migrate(raw, sanitize(raw)).then(resolve);
        }
      )
    );

  const save = (obj) =>
    new Promise((resolve) => chrome.storage.sync.set(obj, () => resolve()));

  /** 変更を購読する。キーは DEFAULTS にあるものだけ通知する */
  function subscribe(callback) {
    chrome.storage.onChanged.addListener((changes, area) => {
      if (area !== "sync") return;
      const keys = Object.keys(changes).filter((k) => k in DEFAULTS);
      if (!keys.length) return;
      const patch = {};
      keys.forEach((k) => {
        const v = changes[k].newValue;
        patch[k] = v === undefined ? DEFAULTS[k] : v;
      });
      callback(patch, keys);
    });
  }

  function updateBadge(badge, enabled) {
    if (!badge) return;
    badge.textContent = enabled ? "ON" : "OFF";
    badge.className = "status-badge " + (enabled ? "on" : "off");
  }

  /**
   * 入力テキストからチャンネル識別子を取り出す
   *   @handle / handle / youtube.com/@handle / channel/UCxxxx / UCxxxx / c/ / user/
   */
  // ---- キーワード -------------------------------------------------------
  const EXACT_RE = /^"(.*)"$/;

  /** "…" で囲まれていれば完全一致キーワード */
  const isExactKeyword = (kw) => typeof kw === "string" && EXACT_RE.test(kw.trim());

  /**
   * 入力を正規化する。
   *   ASMR        → ASMR            (部分一致)
   *   "ぽこぴー"  → "ぽこぴー"      (完全一致)
   *   「ぽこぴー」→ "ぽこぴー"      (全角の括弧も完全一致として受け付ける)
   */
  function normalizeKeywordInput(raw) {
    const text = (raw || "").trim();
    if (!text) return null;

    const quoted = text.match(/^[「『“”"'](.*)[」』“”"']$/);
    if (quoted) {
      const body = quoted[1].trim().replace(/"/g, "");
      return body ? `"${body}"` : null;
    }
    return text;
  }

  const keywordLabel = (kw) =>
    isExactKeyword(kw) ? EXACT_RE.exec(kw.trim())[1] : kw;

  const keywordKind = (kw) => I18N.t(isExactKeyword(kw) ? "kindExact" : "kindPartial");

  return {
    DEFAULTS,
    SPEED,
    BOOST,
    clampSpeed,
    clampBoost,
    format,
    sanitize,
    load,
    save,
    subscribe,
    updateBadge,
    isExactKeyword,
    normalizeKeywordInput,
    keywordLabel,
    keywordKind,
    ROTATION_STEPS,
    ACTION_KEYS,
    actionLabel,
    sanitizeKeybinds,
    formatBinding,
    bindingFromEvent,
    sameBinding,
  };
})();
