"use strict";

const YTSShared = (() => {
  const DEFAULTS = {
    keywordEnabled: true,
    ytFilterKeywords: [],
    enabled: true,
    gameEnabled: true,
    mixEnabled: true,
    playerCardsEnabled: false,
    blockButton: true,
    speedEnabled: true,
    playbackSpeed: 1.0,
    boostEnabled: false,
    volumeBoost: 2.0,
    titleSpoofText: "",
    titleSpoofChannelName: "",
    titleSpoofIconUrl: "",
    titleSpoofDataVersion: 0,
    language: "auto",
    rotationEnabled: true,
    rotationStep: 90,
    keybinds: {
      speedDown: { code: "KeyQ", ctrl: false, shift: true, alt: false },
      speedUp: { code: "KeyE", ctrl: false, shift: true, alt: false },
      rotateLeft: { code: "KeyA", ctrl: false, shift: true, alt: false },
      rotateRight: { code: "KeyD", ctrl: false, shift: true, alt: false },
      titleSpoof: { code: "KeyR", ctrl: false, shift: true, alt: false },
    },
  };

  const ROTATION_STEPS = [1, 45, 90, 180];
  const SPEED = { min: 0.1, max: 5.0, step: 0.1 };
  const BOOST = { min: 1.0, max: 5.0, step: 0.1 };
  const FULL_WIDTH_RE = /[Ａ-Ｚａ-ｚ０-９]/g;
  const MATCH_SYMBOL_RE =
    /[「」『』【】\[\]()（）<>《》〈〉{}｛｝"'“”‘’、。,.!！?？~〜\-_・|｜*＊#＃]/g;
  const BLOCK_PREFIX_RE = /^\s*[×✕✖☓✗]\s*/;
  const EXACT_RE = /^"([\s\S]*)"$/;
  const JAPANESE_EXACT_RE = /^[「『“‘]([\s\S]*)[」』”’]$/;

  const clone = (value) => JSON.parse(JSON.stringify(value));
  const round2 = (n) => Math.round(n * 100) / 100;

  function migrateTitleSpoofSettings(raw) {
    const source = raw && typeof raw === "object" ? raw : {};
    if (Number(source.titleSpoofDataVersion) >= 1) return {};

    const patch = { titleSpoofDataVersion: 1 };
    ["titleSpoofText", "titleSpoofChannelName"].forEach((key) => {
      const value = source[key];
      if (typeof value === "string" && value.trim().toLowerCase() === "youtube") {
        patch[key] = "";
      }
    });
    return patch;
  }

  function clamp(n, range, fallback) {
    const value = Number(n);
    if (!Number.isFinite(value)) return fallback;
    return Math.min(range.max, Math.max(range.min, round2(value)));
  }

  function toHalfWidth(value) {
    return String(value).replace(FULL_WIDTH_RE, (ch) =>
      String.fromCharCode(ch.charCodeAt(0) - 0xfee0)
    );
  }

  function normalizeMatchText(value) {
    if (value === undefined || value === null) return "";
    let text = String(value);
    try {
      text = text.normalize("NFKC");
    } catch (_) {}
    return toHalfWidth(text).toUpperCase().replace(MATCH_SYMBOL_RE, "").replace(/\s+/g, " ").trim();
  }

  function unwrapKeyword(value) {
    let text = String(value || "").trim();
    let exact = false;
    let match = text.match(EXACT_RE);
    if (match) {
      exact = true;
      text = match[1];
    } else {
      match = text.match(JAPANESE_EXACT_RE);
      if (match) {
        exact = true;
        text = match[1];
      }
    }
    if (exact) text = text.replace(BLOCK_PREFIX_RE, "");
    return { exact, text: text.replace(/"/g, "").trim() };
  }

  function canonicalizeKeyword(value) {
    if (typeof value !== "string") return null;
    const unwrapped = unwrapKeyword(value);
    if (!unwrapped.text) return null;
    return unwrapped.exact ? `"${unwrapped.text}"` : unwrapped.text;
  }

  function makeExactKeyword(value) {
    if (typeof value !== "string") return null;
    const text = value.replace(BLOCK_PREFIX_RE, "").replace(/"/g, "").trim();
    return text ? `"${text}"` : null;
  }

  function keywordIdentity(value) {
    const canonical = canonicalizeKeyword(value);
    if (!canonical) return "";
    const unwrapped = unwrapKeyword(canonical);
    return `${unwrapped.exact ? "exact" : "partial"}:${normalizeMatchText(unwrapped.text)}`;
  }

  function sanitizeKeywordList(list) {
    const result = [];
    const seen = new Set();
    (Array.isArray(list) ? list : []).forEach((value) => {
      const canonical = canonicalizeKeyword(value);
      const identity = keywordIdentity(canonical);
      if (!canonical || !identity || seen.has(identity)) return;
      seen.add(identity);
      result.push(canonical);
    });
    return result;
  }

  function sanitizeKeybinds(raw) {
    const source = raw && typeof raw === "object" ? raw : {};
    const result = {};
    Object.keys(DEFAULTS.keybinds).forEach((action) => {
      const binding = source[action];
      result[action] =
        binding && typeof binding === "object" && typeof binding.code === "string" && binding.code
          ? {
              code: binding.code,
              ctrl: !!binding.ctrl,
              shift: !!binding.shift,
              alt: !!binding.alt,
            }
          : clone(DEFAULTS.keybinds[action]);
    });
    return result;
  }

  function sanitizeSettings(raw) {
    const source = raw && typeof raw === "object" ? raw : {};
    const result = Object.assign(clone(DEFAULTS), source);
    result.ytFilterKeywords = sanitizeKeywordList(source.ytFilterKeywords);
    result.playbackSpeed = clamp(result.playbackSpeed, SPEED, 1.0);
    result.volumeBoost = clamp(result.volumeBoost, BOOST, 1.0);
    result.titleSpoofText =
      typeof source.titleSpoofText === "string"
        ? source.titleSpoofText.replace(/[\u0000-\u001f\u007f]/g, "").trim().slice(0, 200)
        : DEFAULTS.titleSpoofText;
    result.titleSpoofChannelName =
      typeof source.titleSpoofChannelName === "string"
        ? source.titleSpoofChannelName.replace(/[\u0000-\u001f\u007f]/g, "").trim().slice(0, 100)
        : DEFAULTS.titleSpoofChannelName;
    result.titleSpoofIconUrl =
      typeof source.titleSpoofIconUrl === "string"
        ? source.titleSpoofIconUrl.replace(/[\u0000-\u001f\u007f]/g, "").trim().slice(0, 4000)
        : DEFAULTS.titleSpoofIconUrl;
    result.titleSpoofDataVersion = Number(source.titleSpoofDataVersion) >= 1 ? 1 : 0;
    result.rotationStep = ROTATION_STEPS.includes(Number(result.rotationStep))
      ? Number(result.rotationStep)
      : DEFAULTS.rotationStep;
    result.language = ["auto", "ja", "en"].includes(result.language)
      ? result.language
      : DEFAULTS.language;
    result.keybinds = sanitizeKeybinds(source.keybinds);
    return result;
  }

  return {
    DEFAULTS,
    ROTATION_STEPS,
    SPEED,
    BOOST,
    clone,
    clampSpeed: (value) => clamp(value, SPEED, 1.0),
    clampBoost: (value) => clamp(value, BOOST, 1.0),
    normalizeMatchText,
    canonicalizeKeyword,
    makeExactKeyword,
    keywordIdentity,
    sanitizeKeywordList,
    sanitizeKeybinds,
    sanitizeSettings,
    migrateTitleSpoofSettings,
  };
})();
