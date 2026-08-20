/**
 * YouTube Suite - settings.js
 * popup / options で共有する設定アクセスとユーティリティ
 */

"use strict";

const YTS = (() => {
  const DEFAULTS = YTSShared.DEFAULTS;
  const ROTATION_STEPS = YTSShared.ROTATION_STEPS;

  const ACTION_KEYS = {
    speedDown: "actSpeedDown",
    speedUp: "actSpeedUp",
    rotateLeft: "actRotateLeft",
    rotateRight: "actRotateRight",
    titleSpoof: "actTitleSpoof",
  };
  const actionLabel = (action) => I18N.t(ACTION_KEYS[action]);

  const SPEED = YTSShared.SPEED;
  const BOOST = YTSShared.BOOST;
  const clampSpeed = YTSShared.clampSpeed;
  const clampBoost = YTSShared.clampBoost;

  /** 1.0 / 1.25 のように、小数第2位があるときだけ2桁で表示する */
  const format = (n) => (Math.round(n * 100) % 10 === 0 ? n.toFixed(1) : n.toFixed(2));

  function sanitize(obj) {
    return YTSShared.sanitizeSettings(obj);
  }

  /** 壊れた/欠けたキー設定を既定値で補う */
  function sanitizeKeybinds(raw) {
    return YTSShared.sanitizeKeybinds(raw);
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
      .map((ch) => YTSShared.makeExactKeyword(ch.slice(5)))
      .filter(Boolean);

    const keywords = YTSShared.sanitizeKeywordList(settings.ytFilterKeywords);
    migrated.forEach((kw) => {
      if (!keywords.some((k) => YTSShared.keywordIdentity(k) === YTSShared.keywordIdentity(kw))) {
        keywords.push(kw);
      }
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
        Object.assign(
          {
            blockedChannels: [],
            titleSpoofBetaUrl: null,
            titleSpoofChannelName: null,
            titleSpoofIconUrl: null,
            titleSpoofText: null,
          },
          DEFAULTS
        ),
        (res) => {
          const raw = chrome.runtime.lastError ? null : res;
          const titleSpoofPatch = YTSShared.migrateTitleSpoofSettings(raw);
          const settings = sanitize(Object.assign({}, raw || {}, titleSpoofPatch));
          const rawKeywords = raw && Array.isArray(raw.ytFilterKeywords) ? raw.ytFilterKeywords : [];
          const legacyTitleSpoofKeys = YTSShared.TITLE_SPOOF_LEGACY_KEYS.filter(
            (key) => typeof (raw || {})[key] === "string"
          );
          migrate(raw, settings).then((migrated) => {
            const changed =
              rawKeywords.length !== migrated.ytFilterKeywords.length ||
              rawKeywords.some((kw, index) => kw !== migrated.ytFilterKeywords[index]);
            const patch = Object.assign({}, titleSpoofPatch);
            if (changed && !(raw && Array.isArray(raw.blockedChannels) && raw.blockedChannels.length)) {
              patch.ytFilterKeywords = migrated.ytFilterKeywords;
            }
            const finish = () => {
              if (!legacyTitleSpoofKeys.length) {
                resolve(migrated);
                return;
              }
              chrome.storage.sync.remove(legacyTitleSpoofKeys, () => resolve(migrated));
            };
            if (Object.keys(patch).length) {
              chrome.storage.sync.set(patch, finish);
              return;
            }
            finish();
          });
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
  /** "…" で囲まれていれば完全一致キーワード */
  const isExactKeyword = (kw) =>
    typeof kw === "string" && /^"[\s\S]*"$/.test(kw.trim());

  /**
   * 入力を正規化する。
   *   ASMR        → ASMR            (部分一致)
   *   "ぽこぴー"  → "ぽこぴー"      (完全一致)
   *   「ぽこぴー」→ "ぽこぴー"      (全角の括弧も完全一致として受け付ける)
   */
  function normalizeKeywordInput(raw) {
    return YTSShared.canonicalizeKeyword(raw);
  }

  const keywordLabel = (kw) => {
    const canonical = YTSShared.canonicalizeKeyword(kw);
    return isExactKeyword(canonical) ? canonical.slice(1, -1) : canonical || "";
  };

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
