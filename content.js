/**
 * YouTube Suite - content.js
 *
 *  1. キーワードフィルター  … 部分一致 / "完全一致" でカードを非表示
 *                            チャンネル名の左の「×」から完全一致キーワードを追加できる
 *  2. Shorts ブロック       … Shorts 関連の表示を非表示
 *  3. ゲームルーム ブロック … Playables 関連の表示を非表示
 *  4. 再生速度             … 動画を開くたびに設定速度を適用 (ショートカットで増減)
 *  5. 動画の回転           … ショートカットで左右に回転 (はみ出す場合は自動縮小)
 *  6. 音量ブースト          … Web Audio で最大5倍まで増幅
 *  ショートカットキーはすべて設定から変更できる
 */

"use strict";

(() => {
  // ==================================================================
  // 設定 (chrome.storage.sync)
  // ==================================================================
  const DEFAULTS = {
    // キーワードフィルター
    keywordEnabled: true,
    ytFilterKeywords: [],
    // Shorts ブロック (キー名は旧拡張との互換のため "enabled")
    enabled: true,
    // ゲームルーム / Playables ブロック
    gameEnabled: true,
    // チャンネル名の左に出す「×」ボタン
    blockButton: true,
    // 再生速度
    speedEnabled: true,
    playbackSpeed: 1.0,
    // 音量ブースト (使いたいときだけ ON にする想定のため既定は OFF)
    boostEnabled: false,
    volumeBoost: 2.0,
    // 表示言語 ("auto" | "ja" | "en")
    language: "auto",
    // 動画の回転
    rotationEnabled: true,
    rotationStep: 90,
    // ショートカットキー (すべて変更可能)
    keybinds: {
      speedDown: { code: "KeyQ", ctrl: false, shift: true, alt: false },
      speedUp: { code: "KeyE", ctrl: false, shift: true, alt: false },
      rotateLeft: { code: "KeyA", ctrl: false, shift: true, alt: false },
      rotateRight: { code: "KeyD", ctrl: false, shift: true, alt: false },
    },
  };

  const ROTATION_STEPS = [1, 45, 90, 180];

  const S = Object.assign({}, DEFAULTS);
  let settingsLoaded = false;

  // ------------------------------------------------------------------
  // 拡張機能をリロード/更新すると、既存ページに残った content script は
  // chrome.* を失う (Extension context invalidated)。その状態で API に
  // 触れると例外になるので、生存確認して静かに停止する。
  // ------------------------------------------------------------------
  let alive = true;
  let scanIntervalId = null;
  let navIntervalId = null;

  function extensionAlive() {
    try {
      return !!(
        typeof chrome !== "undefined" &&
        chrome.runtime &&
        chrome.runtime.id &&
        chrome.storage &&
        chrome.storage.sync
      );
    } catch (_) {
      return false;
    }
  }

  function shutdown() {
    if (!alive) return;
    alive = false;
    clearInterval(scanIntervalId);
    clearInterval(navIntervalId);
    clearTimeout(scanTimer);
    burstTimers.forEach(clearTimeout);
    try {
      observer.disconnect();
    } catch (_) {}
  }

  /** chrome.storage への書き込み (コンテキスト消失時は何もしない) */
  function storageSet(obj) {
    if (!extensionAlive()) {
      shutdown();
      return;
    }
    try {
      chrome.storage.sync.set(obj);
    } catch (_) {
      shutdown();
    }
  }

  const MIN_SPEED = 0.1;
  const MAX_SPEED = 5.0;
  const STEP = 0.1;

  const round2 = (n) => Math.round(n * 100) / 100;
  const clampSpeed = (n) => {
    const v = Number(n);
    if (!Number.isFinite(v)) return 1.0;
    return Math.min(MAX_SPEED, Math.max(MIN_SPEED, round2(v)));
  };
  const formatSpeed = (n) =>
    Math.round(n * 100) % 10 === 0 ? n.toFixed(1) : n.toFixed(2);

  const MIN_BOOST = 1.0;
  const MAX_BOOST = 5.0;
  const clampBoost = (n) => {
    const v = Number(n);
    if (!Number.isFinite(v)) return 1.0;
    return Math.min(MAX_BOOST, Math.max(MIN_BOOST, round2(v)));
  };

  // ==================================================================
  // 1. Shorts 非表示用スタイル (設定で ON/OFF できるよう動的に注入)
  // ==================================================================
  const SHORTS_CSS = `
/* サイドバー / ミニガイドの「ショート」 */
ytd-guide-entry-renderer:has(a[href="/shorts"]),
ytd-mini-guide-entry-renderer:has(a[href="/shorts"]),
tp-yt-paper-item:has(a[href="/shorts"]),
ytd-guide-entry-renderer a[href="/shorts"],
ytd-mini-guide-entry-renderer a[href="/shorts"],
ytd-mobile-bottom-bar-renderer a[href*="shorts"] {
  display: none !important;
}

/* タブの「ショート」 */
yt-tab-shape[tab-title="ショート"],
yt-tab-shape[tab-title="Shorts"],
ytd-browse-tab-renderer:has(yt-tab-shape[tab-title="ショート"]),
ytd-browse-tab-renderer:has(yt-tab-shape[tab-title="Shorts"]),
tp-yt-paper-tab:has(yt-tab-shape[tab-title="ショート"]),
tp-yt-paper-tab:has(yt-tab-shape[tab-title="Shorts"]) {
  display: none !important;
}

/* ホーム / フィードの Shorts セクション */
ytd-rich-section-renderer:has(ytd-rich-shelf-renderer[is-shorts]),
ytd-rich-section-renderer:has([overlay-style="SHORTS"]),
ytd-reel-shelf-renderer,
ytd-rich-shelf-renderer[is-shorts],
ytd-shelf-renderer:has(a[href*="/shorts/"]),
ytd-shelf-renderer:has(ytd-reel-shelf-renderer),
ytd-horizontal-card-list-renderer:has(ytd-reel-item-renderer),
ytd-search-pyv-renderer:has(a[href*="/shorts/"]),
yt-related-chip-cloud-renderer:has([href*="shorts"]),
yt-chip-cloud-chip-renderer:has([href*="shorts"]) {
  display: none !important;
}

/* Shorts の動画カード */
ytd-rich-item-renderer:has(a[href*="/shorts/"]),
ytd-grid-video-renderer:has(a[href*="/shorts/"]),
ytd-compact-video-renderer:has(a[href*="/shorts/"]),
ytd-video-renderer:has(a[href*="/shorts/"]),
ytd-compact-video-renderer:has(ytd-thumbnail-overlay-time-status-renderer[overlay-style="SHORTS"]),
ytd-video-renderer:has(ytd-thumbnail-overlay-time-status-renderer[overlay-style="SHORTS"]),
ytd-thumbnail-overlay-time-status-renderer[overlay-style="SHORTS"],
ytd-reel-item-renderer,
yt-shorts-lockup-view-model,
ytd-shorts-lockup-view-model,
ytm-shorts-lockup-view-model-v2 {
  display: none !important;
}
`;

  let shortsStyleEl = null;

  function ensureShortsStyle() {
    if (shortsStyleEl && shortsStyleEl.isConnected) return shortsStyleEl;
    shortsStyleEl = document.createElement("style");
    shortsStyleEl.id = "yts-shorts-style";
    shortsStyleEl.textContent = SHORTS_CSS;
    (document.head || document.documentElement).appendChild(shortsStyleEl);
    return shortsStyleEl;
  }

  function syncShortsStyle() {
    // /shorts/ ページを直接開いた場合は再生を妨げない
    const onShortsPage = location.pathname.startsWith("/shorts");
    ensureShortsStyle().disabled = !S.enabled || onShortsPage;
  }

  // 設定読み込み前でも初期表示のちらつきが出ないよう、既定(ON)で先に入れておく
  ensureShortsStyle();

  // ==================================================================
  // 1-b. ゲームルーム (Playables) 非表示用スタイル
  // ==================================================================
  const GAME_CSS = `
/* サイドバー / ミニガイドの「ゲームルーム」 */
ytd-guide-entry-renderer:has(a[href^="/playables"]),
ytd-mini-guide-entry-renderer:has(a[href^="/playables"]),
ytd-guide-entry-renderer:has(a[href^="/gameroom"]),
ytd-mini-guide-entry-renderer:has(a[href^="/gameroom"]),
tp-yt-paper-item:has(a[href^="/playables"]),
ytd-mobile-bottom-bar-renderer a[href*="playables"] {
  display: none !important;
}

/* タブ / チップ */
yt-tab-shape[tab-title="ゲームルーム"],
yt-tab-shape[tab-title="Game room"],
yt-tab-shape[tab-title="Playables"],
ytd-browse-tab-renderer:has(yt-tab-shape[tab-title="ゲームルーム"]),
ytd-browse-tab-renderer:has(yt-tab-shape[tab-title="Playables"]),
tp-yt-paper-tab:has(yt-tab-shape[tab-title="ゲームルーム"]),
tp-yt-paper-tab:has(yt-tab-shape[tab-title="Playables"]),
yt-chip-cloud-chip-renderer:has(a[href*="playables"]) {
  display: none !important;
}

/* ホーム / 検索結果のシェルフ・カード */
ytd-rich-section-renderer:has(a[href*="/playables"]),
ytd-rich-shelf-renderer:has(a[href*="/playables"]),
ytd-shelf-renderer:has(a[href*="/playables"]),
ytd-reel-shelf-renderer:has(a[href*="/playables"]),
ytd-horizontal-card-list-renderer:has(a[href*="/playables"]),
ytd-rich-item-renderer:has(a[href*="/playables"]),
ytd-video-renderer:has(a[href*="/playables"]),
ytd-compact-video-renderer:has(a[href*="/playables"]),
yt-lockup-view-model:has(a[href*="/playables"]),
ytd-game-card-renderer,
ytd-playables-shelf-renderer,
yt-playables-shelf-view-model,
yt-playables-lockup-view-model,
ytm-playables-shelf-renderer {
  display: none !important;
}
`;

  let gameStyleEl = null;

  function ensureGameStyle() {
    if (gameStyleEl && gameStyleEl.isConnected) return gameStyleEl;
    gameStyleEl = document.createElement("style");
    gameStyleEl.id = "yts-game-style";
    gameStyleEl.textContent = GAME_CSS;
    (document.head || document.documentElement).appendChild(gameStyleEl);
    return gameStyleEl;
  }

  function syncGameStyle() {
    // /playables を直接開いた場合はページ自体を壊さない
    const onGamePage = /^\/(playables|gameroom)/.test(location.pathname);
    ensureGameStyle().disabled = !S.gameEnabled || onGamePage;
  }

  ensureGameStyle();

  // 表記ゆれ対応 (完全一致で判定する。「ゲーム」単体は対象外)
  const GAME_LABELS = new Set([
    "ゲームルーム",
    "ゲーム ルーム",
    "プレイアブル",
    "playables",
    "playable",
    "game room",
    "gameroom",
  ]);

  const isGameLabel = (text) =>
    !!text && GAME_LABELS.has(text.trim().toLowerCase().replace(/　/g, " "));

  // ラベルに反応したとき、非表示にしてよい祖先要素
  const GAME_CONTAINER_TAGS = new Set([
    "ytd-guide-entry-renderer",
    "ytd-mini-guide-entry-renderer",
    "ytd-guide-section-renderer",
    "ytd-browse-tab-renderer",
    "tp-yt-paper-tab",
    "yt-tab-shape",
    "yt-chip-cloud-chip-renderer",
    "ytd-rich-section-renderer",
    "ytd-rich-shelf-renderer",
    "ytd-shelf-renderer",
    "ytd-reel-shelf-renderer",
    "ytd-item-section-renderer",
    "ytd-horizontal-card-list-renderer",
    "ytd-rich-item-renderer",
  ]);

  function hideClosestGameContainer(el) {
    let node = el;
    while (node && node !== document.body) {
      const tag = node.tagName ? node.tagName.toLowerCase() : "";
      if (GAME_CONTAINER_TAGS.has(tag)) {
        hideEl(node, "game");
        return;
      }
      node = node.parentElement;
    }
  }

  function scanGames() {
    if (!S.gameEnabled) return;
    if (/^\/(playables|gameroom)/.test(location.pathname)) return;

    // href ベース (CSS の :has が効かない箇所の保険)
    document
      .querySelectorAll('a[href*="/playables"],a[href*="/gameroom"]')
      .forEach((a) => hideClosestGameContainer(a));

    // ラベルベース (シェルフ見出し・ナビ・タブ・チップ)
    const labelHosts = document.querySelectorAll(
      "yt-tab-shape[tab-title],ytd-guide-entry-renderer,ytd-mini-guide-entry-renderer," +
        "yt-chip-cloud-chip-renderer,ytd-rich-section-renderer #title," +
        "ytd-shelf-renderer #title,ytd-rich-shelf-renderer #title," +
        "ytd-reel-shelf-renderer #title"
    );
    labelHosts.forEach((host) => {
      if (host.hasAttribute("data-yts-hidden")) return;
      const label =
        host.getAttribute("tab-title") ||
        host.getAttribute("title") ||
        host.getAttribute("aria-label") ||
        (host.textContent || "").slice(0, 40);
      if (isGameLabel(label)) hideClosestGameContainer(host);
    });
  }

  // ==================================================================
  // 2. キーワードフィルター
  // ==================================================================
  const CARD_SELECTORS = [
    "ytd-rich-item-renderer",
    "ytd-video-renderer",
    "ytd-compact-video-renderer",
    "ytd-grid-video-renderer",
    "ytd-playlist-video-renderer",
    "ytd-playlist-panel-video-renderer",
    "ytd-compact-radio-renderer",
    "ytd-compact-playlist-renderer",
    "ytd-compact-movie-renderer",
    "ytd-radio-renderer",
    "ytd-movie-renderer",
    "ytd-playlist-renderer",
    "ytd-grid-movie-renderer",
    "ytd-grid-playlist-renderer",
    "ytd-grid-radio-renderer",
    "ytd-reel-item-renderer",
    "ytd-shorts-lockup-view-model",
    "ytm-shorts-lockup-view-model-v2",
    "yt-lockup-view-model",
    "ytd-compact-autoplay-renderer",
    ".ytp-endscreen-content .ytp-ce-video",
    ".ytp-suggestion-set .ytp-videowall-still",
    "ytm-video-with-context-renderer",
    "ytm-compact-video-renderer",
    "ytm-rich-item-renderer",
  ];
  const CARD_SELECTOR = CARD_SELECTORS.join(",");

  const TEXT_SELECTORS = [
    "#video-title",
    "#video-title-link",
    ".yt-lockup-metadata-view-model-wiz__title",
    "#channel-name",
    "ytd-channel-name",
    ".ytd-channel-name",
    "#text",
    "#description-text",
    "yt-formatted-string",
    ".ytp-ce-video-title",
    ".ytp-videowall-still-info-title",
    "span.title",
    "h3",
    "a",
  ];

  const BRACKET_AND_SYMBOL_RE =
    /[「」『』【】\[\]()（）<>《》〈〉{}｛｝"'"'“”'’、。,.!！?？~〜\-_・|｜*＊#＃]/g;

  function toHalfWidth(str) {
    return str.replace(/[Ａ-Ｚａ-ｚ０-９]/g, (ch) =>
      String.fromCharCode(ch.charCodeAt(0) - 0xfee0)
    );
  }

  function normalize(str) {
    if (!str) return "";
    return toHalfWidth(str).toUpperCase().replace(BRACKET_AND_SYMBOL_RE, "").trim();
  }

  /**
   * キーワードは2種類。
   *   ASMR          … 部分一致 (記号・全角半角・大小文字を無視)
   *   "チャンネル名" … 完全一致 (タイトルやチャンネル名など、どれか1項目と丸ごと一致)
   */
  const EXACT_RE = /^"(.*)"$/;
  const isExactKeyword = (kw) => typeof kw === "string" && EXACT_RE.test(kw.trim());
  const exactBody = (kw) => kw.trim().replace(EXACT_RE, "$1");

  let partialKeywords = []; // 正規化済み
  let exactKeywords = []; // 正規化済み

  function rebuildKeywords() {
    const list = Array.isArray(S.ytFilterKeywords) ? S.ytFilterKeywords : [];
    partialKeywords = [];
    exactKeywords = [];
    list.forEach((kw) => {
      if (typeof kw !== "string") return;
      const exact = isExactKeyword(kw);
      const value = normalize(exact ? exactBody(kw) : kw);
      if (!value) return;
      (exact ? exactKeywords : partialKeywords).push(value);
    });
  }

  const hasKeywords = () => partialKeywords.length > 0 || exactKeywords.length > 0;

  // 14個のセレクタを1本にまとめる (querySelectorAll の呼び出しを 14回 → 1回に)
  const TEXT_SELECTOR = TEXT_SELECTORS.join(",");

  /**
   * 完全一致の判定に使う「項目単位」のテキストを集める。
   * 完全一致キーワードが登録されているときだけ呼ぶ。
   */
  function collectCardItems(card) {
    const items = [];
    const push = (t) => {
      if (!t) return;
      const s = t.replace(/\s+/g, " ").trim();
      if (s && s.length <= 300) items.push(s);
    };

    card.querySelectorAll("[title],[aria-label]").forEach((el) => {
      // 自前で挿入した「×」ボタンの説明文は判定に混ぜない
      if (el.classList && el.classList.contains("yts-block-btn")) return;
      push(el.getAttribute("title"));
      push(el.getAttribute("aria-label"));
    });

    card.querySelectorAll(TEXT_SELECTOR).forEach((el) => push(el.textContent));

    if (card.getAttribute) {
      push(card.getAttribute("title"));
      push(card.getAttribute("aria-label"));
    }
    return items;
  }

  /**
   * @param {Element} card
   * @param {string} all カード内の全テキスト (呼び出し側で取得済みのものを使い回す)
   */
  function matchesKeyword(card, all) {
    // 完全一致：いずれかの項目と丸ごと一致するか
    if (exactKeywords.length) {
      for (const item of collectCardItems(card)) {
        const n = normalize(item);
        if (n && exactKeywords.includes(n)) return true;
      }
    }

    // 部分一致：カード内のどこかに含まれていればよい。
    // textContent はタイトル・チャンネル名・説明をすべて含むため、
    // セレクタに依存せず1回の読み取りで判定できる。
    if (partialKeywords.length) {
      const haystack = normalize(all);
      if (haystack) {
        for (const kw of partialKeywords) {
          if (haystack.includes(kw)) return true;
        }
      }
    }
    return false;
  }

  // カードごとの判定結果を覚えておき、内容が変わらない限り再判定しない。
  // (YouTube は仮想スクロールで要素を使い回すため、テキストを鍵にして判定する)
  const keywordCache = new WeakMap();
  const textKey = (s) => s.length + "|" + s.slice(0, 80);

  function scanKeywords() {
    if (!S.keywordEnabled || !hasKeywords()) return;
    let hidden = 0;
    let evaluated = 0;

    document.querySelectorAll(CARD_SELECTOR).forEach((card) => {
      const all = (card.textContent || "").replace(/\s+/g, " ").trim().slice(0, 1200);
      const key = textKey(all);

      let hide;
      const cached = keywordCache.get(card);
      if (cached && cached.key === key) {
        hide = cached.hide;
      } else {
        hide = matchesKeyword(card, all);
        keywordCache.set(card, { key, hide });
        evaluated++;
      }

      if (hide) hidden++;
      // 変化がないときは classList を触らない (スタイル再計算を避ける)
      if (card.classList.contains("yts-hidden-keyword") !== hide) {
        card.classList.toggle("yts-hidden-keyword", hide);
      }
    });
    if (DEBUG) {
      console.debug(
        `[YouTube Suite] keyword hidden=${hidden} evaluated=${evaluated} partial=${JSON.stringify(
          partialKeywords
        )} exact=${JSON.stringify(exactKeywords)}`
      );
    }
  }

  function clearKeywordHidden() {
    document
      .querySelectorAll(".yts-hidden-keyword")
      .forEach((el) => el.classList.remove("yts-hidden-keyword"));
  }

  // ==================================================================
  // 3. Shorts (DOM 側の補助的な非表示)
  // ==================================================================
  const SHORTS_DIRECT_SELECTORS = [
    "ytd-reel-shelf-renderer",
    "ytd-rich-shelf-renderer[is-shorts]",
    "ytd-reel-item-renderer",
    "yt-shorts-lockup-view-model",
    "ytm-shorts-lockup-view-model-v2",
    "ytd-shorts-lockup-view-model",
    'ytd-thumbnail-overlay-time-status-renderer[overlay-style="SHORTS"]',
  ];

  function hideEl(el, reason) {
    if (!el || !el.style) return;
    if (el.getAttribute("data-yts-hidden") === reason) return;
    if (el.hasAttribute("data-yts-hidden")) return;
    el.style.setProperty("display", "none", "important");
    el.setAttribute("data-yts-hidden", reason);
  }

  function showEl(el) {
    if (!el || !el.hasAttribute("data-yts-hidden")) return;
    el.style.removeProperty("display");
    el.removeAttribute("data-yts-hidden");
  }

  function scanShorts() {
    if (!S.enabled) return;
    if (location.pathname.startsWith("/shorts")) return;

    for (const sel of SHORTS_DIRECT_SELECTORS) {
      try {
        document.querySelectorAll(sel).forEach((el) => hideEl(el, "shorts"));
      } catch (_) {}
    }

    document.querySelectorAll("ytd-rich-item-renderer").forEach((item) => {
      if (item.hasAttribute("data-yts-hidden")) return;
      if (
        item.querySelector('a[href*="/shorts/"]') ||
        item.querySelector('[overlay-style="SHORTS"]') ||
        item.querySelector("[is-shorts]")
      ) {
        hideEl(item, "shorts");
      }
    });

    document.querySelectorAll("ytd-shelf-renderer").forEach((shelf) => {
      if (shelf.hasAttribute("data-yts-hidden")) return;
      if (
        shelf.querySelector("ytd-reel-item-renderer") ||
        shelf.querySelector("ytd-reel-shelf-renderer") ||
        shelf.querySelector('[overlay-style="SHORTS"]') ||
        shelf.querySelector('a[href*="/shorts/"]')
      ) {
        hideEl(shelf, "shorts");
      }
    });
  }

  function restoreHidden(reason) {
    document
      .querySelectorAll(`[data-yts-hidden="${reason}"]`)
      .forEach((el) => showEl(el));
  }

  // ==================================================================
  // 4. チャンネル名の左に置く「×」ボタン
  //    押すとチャンネル名を "完全一致キーワード" としてフィルターへ追加する
  // ==================================================================
  const CH_HREF_RE = /^\/(@[^/?#]+|channel\/[^/?#]+|c\/[^/?#]+|user\/[^/?#]+)(\/|\?|#|$)/;

  // ボタンを1つ置く単位 (カード / 動画ページの投稿者欄)
  const BUTTON_CARD_SELECTOR = [
    "ytd-rich-item-renderer",
    "ytd-video-renderer",
    "ytd-compact-video-renderer",
    "ytd-grid-video-renderer",
    "ytd-playlist-video-renderer",
    "ytd-playlist-panel-video-renderer",
    "ytd-compact-playlist-renderer",
    "ytd-compact-radio-renderer",
    "ytd-compact-movie-renderer",
    "ytd-compact-autoplay-renderer",
    "ytd-movie-renderer",
    "ytd-channel-renderer",
    "ytd-grid-channel-renderer",
    "yt-lockup-view-model",
    "ytd-video-owner-renderer",
    "ytm-compact-video-renderer",
    "ytm-video-with-context-renderer",
  ].join(",");

  const DEBUG = (() => {
    try {
      return localStorage.getItem("ytsDebug") === "1";
    } catch (_) {
      return false;
    }
  })();

  /** チャンネル名を完全一致キーワード ("名前") として追加する */
  function addExactKeyword(name) {
    const trimmed = (name || "").trim();
    if (!trimmed) return;
    const entry = `"${trimmed.replace(/"/g, "")}"`;

    const list = Array.isArray(S.ytFilterKeywords) ? S.ytFilterKeywords : [];
    if (list.some((kw) => kw.trim().toLowerCase() === entry.toLowerCase())) return;

    const next = [...list, entry];
    S.ytFilterKeywords = next;
    rebuildKeywords();
    storageSet({ ytFilterKeywords: next });
    runScan();
  }

  function createBlockButton() {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "yts-block-btn";
    btn.textContent = "×";
    const stop = (e) => {
      e.preventDefault();
      e.stopPropagation();
    };
    // YouTube 側のリンク遷移・mousedown ハンドラを止める
    ["mousedown", "pointerdown", "auxclick", "touchstart"].forEach((ev) =>
      btn.addEventListener(ev, stop, true)
    );
    btn.addEventListener(
      "click",
      (e) => {
        stop(e);
        addExactKeyword(btn.dataset.ytsName);
      },
      true
    );
    return btn;
  }

  /** target の直前にボタンを置き、対象チャンネル名を同期する */
  function syncBlockButton(target, name) {
    if (!target || !target.parentNode) return false;
    let btn = target.previousElementSibling;
    if (!btn || !btn.classList || !btn.classList.contains("yts-block-btn")) {
      btn = createBlockButton();
      try {
        target.parentNode.insertBefore(btn, target);
      } catch (_) {
        return false;
      }
    }
    // 仮想スクロールで要素が使い回されるため、毎回同期する
    if (btn.dataset.ytsName !== name) {
      btn.dataset.ytsName = name;
      btn.title = I18N.t("blockBtnTitle", { name });
      btn.setAttribute("aria-label", btn.title);
    }
    return true;
  }

  /** 明らかにチャンネル名ではないテキストを弾く */
  function looksLikeChannelName(text) {
    if (!text) return false;
    const t = text.trim();
    if (!t || t.length > 80) return false;
    if (/^[\d.,・\s]+$/.test(t)) return false;
    // 視聴回数 / 投稿日時 / 再生時間 / ライブ表示など
    if (/回視聴|回再生|views?\b|watching|視聴中/i.test(t)) return false;
    if (/(前|ago)$/i.test(t)) return false;
    if (/^\d+:\d\d(:\d\d)?$/.test(t)) return false;
    if (/^(ライブ|LIVE|新着|プレミア公開|Premiere|Scheduled)/i.test(t)) return false;
    if (/^(動画|本の動画|videos?)$/i.test(t)) return false;
    return true;
  }

  /** タイトル側の要素かどうか (タイトルに ✕ を付けないため) */
  function isTitleNode(node) {
    if (!node || !node.closest) return false;
    // 「タイトル」を含むクラス名 / #video-title / h3 のみを除外する。
    // (yt-lockup-metadata-view-model はタイトルとチャンネル名の両方を含むため対象外)
    return !!node.closest('#video-title,#video-title-link,h3,[class*="title"]');
  }

  /**
   * カードからチャンネル名の位置を割り出す。
   * クラス名の変更に強いよう、リンク → 既知のID → メタデータ行の順で構造的に探す。
   */
  function findBylineTarget(card) {
    // --- 1) テキストを持つチャンネルリンク (最も確実) ---
    for (const a of card.querySelectorAll("a[href]")) {
      const href = a.getAttribute("href") || "";
      if (!CH_HREF_RE.test(href)) continue;
      if (isTitleNode(a)) continue;
      const name = (a.textContent || "").trim();
      if (!looksLikeChannelName(name)) continue;
      return { node: a, name };
    }

    // --- 2) 旧UIの既知のチャンネル名要素 ---
    const KNOWN = [
      "ytd-channel-name #text",
      "#channel-name #text",
      "ytd-channel-name yt-formatted-string",
      "#byline",
      "#channel-name",
    ];
    for (const sel of KNOWN) {
      for (const node of card.querySelectorAll(sel)) {
        if (isTitleNode(node)) continue;
        const name = (node.textContent || "").trim();
        if (!looksLikeChannelName(name)) continue;
        return { node, name };
      }
    }

    // --- 3) 新UI (yt-lockup-view-model) のメタデータ行 ---
    //     クラス名を当てにせず「メタデータの最初の行 = チャンネル名」という構造で拾う
    const meta = card.querySelector("yt-content-metadata-view-model");
    if (meta) {
      const rows = Array.from(meta.children);
      for (const row of rows) {
        if (isTitleNode(row)) continue;
        const name = (row.textContent || "").trim();
        if (!looksLikeChannelName(name)) continue;
        // 行の中の最初のテキスト要素の手前に置く
        const inner = Array.from(row.querySelectorAll("span,a,div")).find((n) =>
          looksLikeChannelName((n.textContent || "").trim())
        );
        return { node: inner || row, name };
      }
    }

    return null;
  }

  // 判定済みカードを覚えておき、内容が変わらない限り再探索しない
  const buttonCache = new WeakMap();

  function decorateChannelButtons() {
    if (!S.blockButton) return;

    let total = 0;
    let done = 0;
    let sample = null;

    document.querySelectorAll(BUTTON_CARD_SELECTOR).forEach((card) => {
      if (card.hasAttribute("data-yts-hidden")) return;

      const key = textKey((card.textContent || "").slice(0, 200));
      const cached = buttonCache.get(card);
      // 同じ内容で、ボタンも生きているならスキップ
      if (cached === key && card.querySelector(".yts-block-btn")) return;

      // 入れ子カードは内側だけを対象にする
      if (card.querySelector(BUTTON_CARD_SELECTOR)) return;
      total++;

      const target = findBylineTarget(card);
      if (!target) {
        if (!sample) sample = card;
        return;
      }
      if (syncBlockButton(target.node, target.name)) {
        done++;
        buttonCache.set(card, key);
      }
    });

    if (DEBUG) {
      console.debug(
        `[YouTube Suite] cards=${total} decorated=${done}`,
        sample ? { 見つからなかったカード: sample.tagName, html: sample.outerHTML.slice(0, 900) } : ""
      );
    }
  }

  function removeBlockButtons() {
    document.querySelectorAll(".yts-block-btn").forEach((btn) => btn.remove());
  }

  // ==================================================================
  // 5. 再生速度
  // ==================================================================
  const hookedVideos = new WeakSet();
  let toastEl = null;
  let toastTimer = null;
  let saveTimer = null;

  function getMainVideo() {
    const vids = Array.from(document.querySelectorAll("video"));
    if (!vids.length) return null;
    // 実際に再生中 / 再生可能なものを優先
    return (
      vids.find((v) => !v.paused && v.readyState > 0) ||
      vids.find((v) => v.readyState > 0) ||
      vids[0]
    );
  }

  function applySpeedTo(video) {
    if (!video) return;
    const target = clampSpeed(S.playbackSpeed);
    if (Math.abs(video.playbackRate - target) < 0.001) return;
    try {
      video.playbackRate = target;
    } catch (_) {}
  }

  function applySpeedToAll() {
    if (!S.speedEnabled) return;
    document.querySelectorAll("video").forEach(applySpeedTo);
  }

  function hookVideo(video) {
    if (hookedVideos.has(video)) return;
    hookedVideos.add(video);
    // YouTube が速度をリセットするタイミングで再適用する
    ["loadstart", "loadedmetadata", "canplay", "durationchange", "playing"].forEach(
      (ev) => video.addEventListener(ev, () => S.speedEnabled && applySpeedTo(video))
    );
    // 表示サイズが変わると回転時の縮小率も変わる
    ["loadedmetadata", "resize"].forEach((ev) =>
      video.addEventListener(ev, () => rotation && applyRotation())
    );
  }

  function hookVideos() {
    document.querySelectorAll("video").forEach(hookVideo);
  }

  /** ページ遷移直後は YouTube 側の初期化と競合するため、数回に分けて適用する */
  let burstTimers = [];
  function burstApplySpeed() {
    burstTimers.forEach(clearTimeout);
    burstTimers = [];
    [0, 100, 300, 600, 1000, 1500, 2500].forEach((delay) => {
      burstTimers.push(
        setTimeout(() => {
          hookVideos();
          if (S.speedEnabled) applySpeedToAll();
          if (rotation) applyRotation();
        }, delay)
      );
    });
  }

  function showToast(text) {
    // 全画面表示中は fullscreen 要素の中に入れないと表示されない
    const host = document.fullscreenElement || document.body;
    if (!host) return;
    if (!toastEl) {
      toastEl = document.createElement("div");
      toastEl.id = "yts-speed-toast";
    }
    if (toastEl.parentNode !== host) host.appendChild(toastEl);
    toastEl.textContent = text;
    toastEl.classList.add("yts-show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => {
      if (toastEl) toastEl.classList.remove("yts-show");
    }, 900);
  }

  function saveSpeed(speed) {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => storageSet({ playbackSpeed: speed }), 250);
  }

  function setSpeed(next) {
    const speed = clampSpeed(next);
    S.playbackSpeed = speed;
    document.querySelectorAll("video").forEach(applySpeedTo);
    showToast(formatSpeed(speed) + "x");
    saveSpeed(speed);
  }

  // ==================================================================
  // 5-a. 動画の回転
  // ==================================================================
  let rotation = 0; // 現在の角度 (0-359)

  function normalizeAngle(deg) {
    return ((Math.round(deg) % 360) + 360) % 360;
  }

  function getPlayerBox(video) {
    const player =
      video.closest(".html5-video-player") ||
      video.closest("#movie_player") ||
      video.parentElement;
    if (!player) return null;
    const w = player.clientWidth;
    const h = player.clientHeight;
    return w > 0 && h > 0 ? { w, h } : null;
  }

  /** 回転後もプレーヤー内に収まる倍率を求める */
  function fitScale(video, deg) {
    const box = getPlayerBox(video);
    const w = video.offsetWidth;
    const h = video.offsetHeight;
    if (!box || !w || !h) return 1;

    const rad = (deg * Math.PI) / 180;
    const cos = Math.abs(Math.cos(rad));
    const sin = Math.abs(Math.sin(rad));
    const rotatedW = w * cos + h * sin;
    const rotatedH = w * sin + h * cos;
    if (!rotatedW || !rotatedH) return 1;

    // 拡大はせず、はみ出すときだけ縮小する
    return Math.min(1, box.w / rotatedW, box.h / rotatedH);
  }

  function applyRotation() {
    document.querySelectorAll("video").forEach((video) => {
      if (!rotation) {
        video.style.removeProperty("transform");
        video.style.removeProperty("transform-origin");
        return;
      }
      const scale = fitScale(video, rotation);
      video.style.setProperty("transform-origin", "center center", "important");
      video.style.setProperty(
        "transform",
        `rotate(${rotation}deg) scale(${scale.toFixed(4)})`,
        "important"
      );
    });
  }

  function setRotation(deg) {
    rotation = normalizeAngle(deg);
    applyRotation();
    showToast(`${rotation}°`);
  }

  function rotateBy(delta) {
    setRotation(rotation + delta);
  }

  function resetRotation() {
    if (!rotation) return;
    rotation = 0;
    applyRotation();
  }

  const rotationStep = () =>
    ROTATION_STEPS.includes(Number(S.rotationStep)) ? Number(S.rotationStep) : 90;

  // プレーヤーの大きさが変わると必要な倍率も変わる
  window.addEventListener("resize", () => rotation && applyRotation());
  document.addEventListener("fullscreenchange", () =>
    setTimeout(() => rotation && applyRotation(), 100)
  );

  // ==================================================================
  // 5-c. ショートカットキー
  // ==================================================================
  function bindingOf(action) {
    const b = S.keybinds && S.keybinds[action];
    if (!b || !b.code) return null;
    return b;
  }

  function matchesBinding(e, b) {
    if (!b || !b.code || e.code !== b.code) return false;
    return (
      !!b.ctrl === (e.ctrlKey || e.metaKey) &&
      !!b.shift === e.shiftKey &&
      !!b.alt === e.altKey
    );
  }

  function isTypingTarget(e) {
    const path = typeof e.composedPath === "function" ? e.composedPath() : [];
    const el = path[0] || e.target;
    if (!el || el.nodeType !== 1) return false;
    const tag = el.tagName;
    if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return true;
    if (el.isContentEditable) return true;
    for (const node of path) {
      if (node && node.nodeType === 1 && node.isContentEditable) return true;
    }
    return false;
  }

  const ACTIONS = {
    speedDown: { run: () => setSpeed(S.playbackSpeed - STEP), enabled: () => true },
    speedUp: { run: () => setSpeed(S.playbackSpeed + STEP), enabled: () => true },
    rotateLeft: { run: () => rotateBy(-rotationStep()), enabled: () => S.rotationEnabled },
    rotateRight: { run: () => rotateBy(rotationStep()), enabled: () => S.rotationEnabled },
  };

  document.addEventListener(
    "keydown",
    (e) => {
      if (!settingsLoaded || e.repeat) return;
      if (isTypingTarget(e)) return;
      if (!document.querySelector("video")) return;

      for (const action of Object.keys(ACTIONS)) {
        if (!ACTIONS[action].enabled()) continue; // OFF の機能はキーを横取りしない
        if (!matchesBinding(e, bindingOf(action))) continue;
        e.preventDefault();
        e.stopPropagation();
        ACTIONS[action].run();
        return;
      }
    },
    true
  );

  // ==================================================================
  // 5-b. 音量ブースト (WebAudio)
  //
  //  video → MediaElementSource → Gain → Limiter → destination
  //
  //  createMediaElementSource() は一度繋ぐと切り離せないため、
  //  ブーストを ON にした時に初めて接続する。OFF 時は gain=1 で素通し。
  // ==================================================================
  let audioCtx = null;
  const boostChains = new WeakMap(); // video -> { gain }
  let gestureHookAttached = false;

  function ensureAudioContext() {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    if (!audioCtx) {
      try {
        audioCtx = new AC();
      } catch (_) {
        return null;
      }
    }
    if (audioCtx.state === "suspended") {
      audioCtx.resume().catch(() => {});
      attachGestureResume();
    }
    return audioCtx;
  }

  /** 自動再生ポリシーで AudioContext が止まっている場合、次の操作で復帰させる */
  function attachGestureResume() {
    if (gestureHookAttached) return;
    gestureHookAttached = true;
    const resume = () => {
      if (audioCtx && audioCtx.state === "suspended") {
        audioCtx.resume().then(applyBoost).catch(() => {});
      }
    };
    ["pointerdown", "keydown", "click"].forEach((ev) =>
      window.addEventListener(ev, resume, { capture: true, passive: true })
    );
  }

  function getBoostChain(video, create) {
    const existing = boostChains.get(video);
    if (existing) return existing;
    if (!create) return null;

    const ctx = ensureAudioContext();
    // ctx が running になる前に接続すると無音になることがあるので待つ
    if (!ctx || ctx.state !== "running") return null;

    try {
      const source = ctx.createMediaElementSource(video);
      const gain = ctx.createGain();
      const limiter = ctx.createDynamicsCompressor();
      // 増幅時のクリッピングを抑えるリミッター
      limiter.threshold.value = -2;
      limiter.knee.value = 0;
      limiter.ratio.value = 20;
      limiter.attack.value = 0.003;
      limiter.release.value = 0.25;

      source.connect(gain);
      gain.connect(limiter);
      limiter.connect(ctx.destination);

      const chain = { source, gain, limiter };
      boostChains.set(video, chain);
      return chain;
    } catch (_) {
      // 既に他所で接続済み等。以降の再試行を避けるため null を記録しない
      return null;
    }
  }

  function applyBoost() {
    const target = S.boostEnabled ? clampBoost(S.volumeBoost) : 1;
    // 接続済みで ctx が止まると無音になるため、常に復帰を試みる
    if (audioCtx && audioCtx.state === "suspended") {
      audioCtx.resume().catch(() => {});
      attachGestureResume();
    }
    document.querySelectorAll("video").forEach((video) => {
      // OFF かつ未接続なら、音声経路には一切触れない
      const chain = getBoostChain(video, S.boostEnabled && target > 1);
      if (!chain) return;
      if (Math.abs(chain.gain.gain.value - target) < 0.001) return;
      try {
        chain.gain.gain.setTargetAtTime(target, chain.gain.context.currentTime, 0.02);
      } catch (_) {
        chain.gain.gain.value = target;
      }
    });
  }

  // ==================================================================
  // 6. スキャンのスケジューリング
  // ==================================================================
  let scanTimer = null;
  let scanScheduled = false;

  function runScan() {
    scanScheduled = false;
    if (!settingsLoaded || !alive) return;
    if (!extensionAlive()) {
      shutdown();
      return;
    }
    try {
      scanShorts();
    } catch (_) {}
    try {
      scanGames();
    } catch (_) {}
    try {
      scanKeywords();
    } catch (_) {}
    try {
      decorateChannelButtons();
    } catch (_) {}
    try {
      hookVideos();
    } catch (_) {}
    try {
      applyBoost();
    } catch (_) {}
  }

  function scheduleScan() {
    if (scanScheduled) return;
    scanScheduled = true;
    clearTimeout(scanTimer);
    scanTimer = setTimeout(runScan, 250);
  }

  const observer = new MutationObserver((mutations) => {
    for (const m of mutations) {
      if (m.addedNodes.length > 0 || m.type === "characterData" || m.type === "attributes") {
        scheduleScan();
        return;
      }
    }
  });

  function startObserving() {
    // characterData は監視しない。YouTube は視聴回数や経過時間を頻繁に
    // 書き換えるため、監視すると通知が止まらず CPU を食い続ける。
    // 遅れて描画されたタイトルは下の定期スキャンで拾う。
    observer.observe(document.documentElement, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ["title", "aria-label", "href", "is-shorts", "overlay-style"],
    });

    // 非同期描画の取りこぼし対策。ブラウザが暇なときに実行する。
    const idle = (fn) =>
      typeof requestIdleCallback === "function"
        ? requestIdleCallback(fn, { timeout: 1000 })
        : fn();
    scanIntervalId = setInterval(() => {
      if (document.hidden) return; // 非表示タブでは何もしない
      idle(runScan);
    }, 2000);
  }

  // ---- SPA ナビゲーション ----
  let lastHref = location.href;

  function onNavigate() {
    resetRotation(); // 回転は動画ごとにリセットする
    syncShortsStyle();
    syncGameStyle();
    burstApplySpeed();
    scheduleScan();
  }

  function checkNavigation() {
    if (!alive) return;
    if (location.href !== lastHref) {
      lastHref = location.href;
      onNavigate();
    }
  }

  window.addEventListener("yt-navigate-finish", onNavigate, true);
  window.addEventListener("yt-page-data-updated", scheduleScan, true);
  window.addEventListener("popstate", checkNavigation);
  navIntervalId = setInterval(checkNavigation, 400);

  // ==================================================================
  // 7. 設定の読み込み・同期
  // ==================================================================
  /** 壊れた/欠けたキー設定を既定値で補う */
  function sanitizeKeybinds() {
    const src = S.keybinds && typeof S.keybinds === "object" ? S.keybinds : {};
    const out = {};
    Object.keys(DEFAULTS.keybinds).forEach((action) => {
      const b = src[action];
      out[action] =
        b && typeof b === "object" && typeof b.code === "string" && b.code
          ? { code: b.code, ctrl: !!b.ctrl, shift: !!b.shift, alt: !!b.alt }
          : Object.assign({}, DEFAULTS.keybinds[action]);
    });
    S.keybinds = out;
    if (!ROTATION_STEPS.includes(Number(S.rotationStep))) {
      S.rotationStep = DEFAULTS.rotationStep;
    }
  }

  function applySettings(changedKeys) {
    rebuildKeywords();
    syncShortsStyle();
    syncGameStyle();

    const touched = (k) => !changedKeys || changedKeys.includes(k);

    if (touched("keywordEnabled") || touched("ytFilterKeywords")) {
      clearKeywordHidden();
    }
    if (touched("enabled") && !S.enabled) {
      restoreHidden("shorts");
    }
    if (touched("gameEnabled") && !S.gameEnabled) {
      restoreHidden("game");
    }
    if (touched("blockButton") && !S.blockButton) {
      removeBlockButtons();
    }
    if (touched("language")) {
      removeBlockButtons(); // ツールチップを新しい言語で作り直す
    }
    if (touched("playbackSpeed") || touched("speedEnabled")) {
      if (S.speedEnabled) applySpeedToAll();
    }
    if (touched("boostEnabled") || touched("volumeBoost")) {
      applyBoost();
    }
    if (touched("rotationEnabled") && !S.rotationEnabled) {
      resetRotation();
    }

    runScan();
  }

  if (!extensionAlive()) return;

  chrome.storage.sync.get(DEFAULTS, (res) => {
    if (chrome.runtime.lastError) return;
    Object.assign(S, res);
    S.playbackSpeed = clampSpeed(S.playbackSpeed);
    S.volumeBoost = clampBoost(S.volumeBoost);
    if (!Array.isArray(S.ytFilterKeywords)) S.ytFilterKeywords = [];
    sanitizeKeybinds();
    I18N.setLanguage(S.language);
    settingsLoaded = true;

    rebuildKeywords();
    syncShortsStyle();
    syncGameStyle();
    hookVideos();
    burstApplySpeed();

    if (document.documentElement) {
      startObserving();
      runScan();
    }
  });

  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== "sync" || !alive) return;
    const keys = Object.keys(changes).filter((k) => k in DEFAULTS);
    if (!keys.length) return;
    keys.forEach((k) => {
      const v = changes[k].newValue;
      S[k] = v === undefined ? DEFAULTS[k] : v;
    });
    S.playbackSpeed = clampSpeed(S.playbackSpeed);
    S.volumeBoost = clampBoost(S.volumeBoost);
    if (!Array.isArray(S.ytFilterKeywords)) S.ytFilterKeywords = [];
    sanitizeKeybinds();
    I18N.setLanguage(S.language);
    if (settingsLoaded) applySettings(keys);
  });
})();
