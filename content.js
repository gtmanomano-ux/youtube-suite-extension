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
  const DEFAULTS = YTSShared.DEFAULTS;
  const ROTATION_STEPS = YTSShared.ROTATION_STEPS;

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

  const MIN_SPEED = YTSShared.SPEED.min;
  const MAX_SPEED = YTSShared.SPEED.max;
  const DEFAULT_PLAYBACK_RATE = 1.0;
  const STEP = 0.1;

  const round2 = (n) => Math.round(n * 100) / 100;
  const clampSpeed = YTSShared.clampSpeed;
  const formatSpeed = (n) =>
    Math.round(n * 100) % 10 === 0 ? n.toFixed(1) : n.toFixed(2);

  const MIN_BOOST = YTSShared.BOOST.min;
  const MAX_BOOST = YTSShared.BOOST.max;
  const clampBoost = YTSShared.clampBoost;

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
      if (host.classList.contains("yts-hidden-game")) return;
      const label =
        host.getAttribute("tab-title") ||
        host.getAttribute("title") ||
        host.getAttribute("aria-label") ||
        (host.textContent || "").slice(0, 40);
      if (isGameLabel(label)) hideClosestGameContainer(host);
    });
  }

  // ==================================================================
  // 1-c. ミックスリスト (自動生成のミックス) 非表示用スタイル
  //
  //  ミックスの再生リストIDは必ず "RD" で始まる (RDMM.., RDCLAK.. など)。
  //  これを手がかりに、専用レンダラーと list=RD を指すカードを消す。
  // ==================================================================
  const MIX_CSS = `
/* ミックス専用のレンダラー */
ytd-compact-radio-renderer,
ytd-radio-renderer,
ytd-grid-radio-renderer,
ytm-compact-radio-renderer,
ytd-shelf-renderer:has(ytd-radio-renderer),
ytd-rich-section-renderer:has(ytd-radio-renderer),
ytd-item-section-renderer:has(> #contents > ytd-radio-renderer:only-child) {
  display: none !important;
}

/* list=RD... を指すカード (ホーム・検索・関連動画・新UI) */
ytd-rich-item-renderer:has(a[href*="list=RD"]),
ytd-video-renderer:has(a[href*="list=RD"]),
ytd-compact-video-renderer:has(a[href*="list=RD"]),
ytd-grid-video-renderer:has(a[href*="list=RD"]),
ytd-playlist-renderer:has(a[href*="list=RD"]),
ytd-compact-playlist-renderer:has(a[href*="list=RD"]),
yt-lockup-view-model:has(a[href*="list=RD"]),
ytm-video-with-context-renderer:has(a[href*="list=RD"]) {
  display: none !important;
}

/* 「ミックス」バッジを持つサムネイル */
ytd-compact-video-renderer:has(ytd-thumbnail-overlay-bottom-panel-renderer[has-badge]),
ytd-rich-item-renderer:has(a[href*="start_radio=1"]),
ytd-video-renderer:has(a[href*="start_radio=1"]),
yt-lockup-view-model:has(a[href*="start_radio=1"]) {
  display: none !important;
}
`;

  let mixStyleEl = null;

  function ensureMixStyle() {
    if (mixStyleEl && mixStyleEl.isConnected) return mixStyleEl;
    mixStyleEl = document.createElement("style");
    mixStyleEl.id = "yts-mix-style";
    mixStyleEl.textContent = MIX_CSS;
    (document.head || document.documentElement).appendChild(mixStyleEl);
    return mixStyleEl;
  }

  /** ミックスを意図して開いているページかどうか */
  const onMixPage = () => /[?&]list=RD/.test(location.search);

  function syncMixStyle() {
    // ミックスを再生中のページでは、再生リストを壊さないよう無効化する
    ensureMixStyle().disabled = !S.mixEnabled || onMixPage();
  }

  ensureMixStyle();

  const PLAYER_CARDS_CSS = `
.html5-video-player.yts-player-cards-hidden .ytp-endscreen-content,
.html5-video-player.yts-player-cards-hidden .ytp-autonav-endscreen-upnext-container,
.html5-video-player.yts-player-cards-hidden .ytp-suggestion-set,
.html5-video-player.yts-player-cards-hidden .ytp-modern-videowall-still,
.html5-video-player.yts-player-cards-hidden .ytp-ce-element,
.html5-video-player.yts-player-cards-hidden .ytp-ce-video,
.html5-video-player.yts-player-cards-hidden .ytp-ce-playlist,
.html5-video-player.yts-player-cards-hidden .ytp-ce-channel,
.html5-video-player.yts-player-cards-hidden .ytp-videowall-still,
.html5-video-player.yts-player-cards-hidden .ytp-cards-teaser,
.html5-video-player.yts-player-cards-hidden .ytp-cards-button,
.html5-video-player.yts-player-cards-hidden .ytp-card,
.html5-video-player.yts-player-cards-hidden #iv-drawer,
#movie_player.yts-player-cards-hidden .ytp-endscreen-content,
#movie_player.yts-player-cards-hidden .ytp-autonav-endscreen-upnext-container,
#movie_player.yts-player-cards-hidden .ytp-suggestion-set,
#movie_player.yts-player-cards-hidden .ytp-modern-videowall-still,
#movie_player.yts-player-cards-hidden .ytp-ce-element,
#movie_player.yts-player-cards-hidden .ytp-ce-video,
#movie_player.yts-player-cards-hidden .ytp-ce-playlist,
#movie_player.yts-player-cards-hidden .ytp-ce-channel,
#movie_player.yts-player-cards-hidden .ytp-videowall-still,
#movie_player.yts-player-cards-hidden .ytp-cards-teaser,
#movie_player.yts-player-cards-hidden .ytp-cards-button,
#movie_player.yts-player-cards-hidden .ytp-card,
#movie_player.yts-player-cards-hidden #iv-drawer {
  display: none !important;
}
`;

  let playerCardsStyleEl = null;

  function ensurePlayerCardsStyle() {
    if (playerCardsStyleEl && playerCardsStyleEl.isConnected) return playerCardsStyleEl;
    playerCardsStyleEl = document.createElement("style");
    playerCardsStyleEl.id = "yts-player-cards-style";
    playerCardsStyleEl.textContent = PLAYER_CARDS_CSS;
    (document.head || document.documentElement).appendChild(playerCardsStyleEl);
    return playerCardsStyleEl;
  }

  function syncPlayerCardsStyle() {
    ensurePlayerCardsStyle().disabled = false;
    const hidden = !!S.playerCardsEnabled;
    document.querySelectorAll(".html5-video-player,#movie_player").forEach((player) => {
      player.classList.toggle("yts-player-cards-hidden", hidden);
    });
  }

  ensurePlayerCardsStyle();

  const MIX_CARD_TAGS = new Set([
    "ytd-rich-item-renderer",
    "ytd-video-renderer",
    "ytd-compact-video-renderer",
    "ytd-grid-video-renderer",
    "ytd-playlist-renderer",
    "ytd-compact-playlist-renderer",
    "ytd-compact-radio-renderer",
    "ytd-radio-renderer",
    "ytd-grid-radio-renderer",
    "yt-lockup-view-model",
    "ytm-video-with-context-renderer",
    "ytm-compact-video-renderer",
  ]);

  function hideClosestMixCard(el) {
    let node = el;
    for (let i = 0; i < 8 && node && node !== document.body; i++) {
      const tag = (node.tagName || "").toLowerCase();
      if (MIX_CARD_TAGS.has(tag)) {
        hideEl(node, "mix");
        return;
      }
      node = node.parentElement;
    }
  }

  function scanMix() {
    if (!S.mixEnabled || onMixPage()) return;

    // :has() が効かない箇所の保険。ミックスへのリンクを持つカードを消す。
    document
      .querySelectorAll('a[href*="list=RD"],a[href*="start_radio=1"]')
      .forEach((a) => hideClosestMixCard(a));

    // 専用レンダラーは無条件で消す
    document
      .querySelectorAll(
        "ytd-compact-radio-renderer,ytd-radio-renderer,ytd-grid-radio-renderer,ytm-compact-radio-renderer"
      )
      .forEach((el) => hideEl(el, "mix"));
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
    "ytd-channel-renderer",
    "ytd-grid-channel-renderer",
    "yt-lockup-view-model",
    "ytd-compact-autoplay-renderer",
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
    "yt-content-metadata-view-model",
    ".yt-content-metadata-view-model__metadata-row",
    ".yt-content-metadata-view-model__metadata-row span",
    "yt-content-metadata-view-model span",
    ".yt-lockup-metadata-view-model__title",
    ".yt-lockup-metadata-view-model__heading-reset",
    ".yt-lockup-metadata-view-model__metadata-row",
    ".yt-lockup-metadata-view-model__metadata-row span",
    "#text",
    "#description-text",
    "yt-formatted-string",
    ".ytp-ce-video-title",
    ".ytp-ce-channel-title",
    ".ytp-videowall-still-info-title",
    ".ytp-videowall-still-info-author",
    ".ytp-videowall-still-info",
    ".ytp-autonav-endscreen-upnext-title",
    "span.title",
    "h3",
    "a",
  ];

  const normalize = YTSShared.normalizeMatchText;
  const isExactKeyword = (kw) =>
    typeof kw === "string" && /^"[\s\S]*"$/.test(kw.trim());
  const exactBody = (kw) => (isExactKeyword(kw) ? kw.trim().slice(1, -1) : kw);
  const cleanKeywordList = YTSShared.sanitizeKeywordList;

  let partialKeywords = []; // 正規化済み
  let exactKeywords = []; // 正規化済み
  let keywordRevision = 0;

  function rebuildKeywords() {
    const list = cleanKeywordList(S.ytFilterKeywords);
    S.ytFilterKeywords = list;
    partialKeywords = [];
    exactKeywords = [];
    list.forEach((kw) => {
      if (typeof kw !== "string") return;
      const exact = isExactKeyword(kw);
      const value = normalize(exact ? exactBody(kw) : kw);
      if (!value) return;
      (exact ? exactKeywords : partialKeywords).push(value);
    });
    keywordRevision++;
  }

  const hasKeywords = () => partialKeywords.length > 0 || exactKeywords.length > 0;

  const TEXT_SELECTOR = TEXT_SELECTORS.join(",");

  function textWithoutBlockButtons(node) {
    if (!node) return "";
    if (node.nodeType === 3) return node.nodeValue || "";
    if (node.nodeType !== 1 && node.nodeType !== 9) return "";
    if (node.nodeType === 1 && node.classList.contains("yts-block-btn")) return "";
    let text = "";
    node.childNodes.forEach((child) => {
      text += textWithoutBlockButtons(child);
    });
    return text;
  }

  function collectCardItems(card) {
    const items = [];
    const push = (t) => {
      if (!t) return;
      const s = t.replace(/\s+/g, " ").trim();
      if (s && s.length <= 300) items.push(s);
    };

    card.querySelectorAll("[title],[aria-label],[data-title],[data-author]").forEach((el) => {
      if (el.classList && el.classList.contains("yts-block-btn")) return;
      push(el.getAttribute("title"));
      push(el.getAttribute("aria-label"));
      push(el.getAttribute("data-title"));
      push(el.getAttribute("data-author"));
    });

    card.querySelectorAll(TEXT_SELECTOR).forEach((el) => push(textWithoutBlockButtons(el)));

    if (card.getAttribute) {
      push(card.getAttribute("title"));
      push(card.getAttribute("aria-label"));
      push(card.getAttribute("data-title"));
      push(card.getAttribute("data-author"));
    }
    return items;
  }

  function matchesKeyword(card, data) {
    if (exactKeywords.length) {
      for (const item of collectCardItems(card)) {
        const n = normalize(item);
        if (n && exactKeywords.includes(n)) return true;
      }
    }

    if (partialKeywords.length) {
      const haystack = normalize(data.all);
      if (haystack) {
        for (const kw of partialKeywords) {
          if (haystack.includes(kw)) return true;
        }
      }
    }
    return false;
  }

  let keywordCache = new WeakMap();

  function getCardSearchData(card) {
    const attributeText = [
      card,
      ...Array.from(card.querySelectorAll("[title],[aria-label],[data-title],[data-author]")).filter(
        (el) => !el.classList.contains("yts-block-btn")
      ),
    ]
      .flatMap((el) => [
        el.getAttribute("title"),
        el.getAttribute("aria-label"),
        el.getAttribute("data-title"),
        el.getAttribute("data-author"),
      ])
      .filter(Boolean)
      .join(" ");
    const all = [textWithoutBlockButtons(card), attributeText]
      .filter(Boolean)
      .join(" ")
      .replace(/\s+/g, " ")
      .trim();
    const watchLink = card.querySelector('a[href*="/watch"],a[href*="/shorts/"]');
    const href = watchLink ? watchLink.getAttribute("href") || "" : "";
    const videoMatch = href.match(/[?&]v=([^&#]+)/);
    const identity = videoMatch ? `video:${videoMatch[1]}` : `text:${all}`;
    return { all, identity, signature: `${identity}|${all}` };
  }

  function isVideoCard(element) {
    return !!(element && element.nodeType === 1 && element.matches(CARD_SELECTOR));
  }

  const ENDSCREEN_ROOT_SELECTOR =
    ".ytp-endscreen-content,.ytp-autonav-endscreen-upnext-container,.ytp-suggestion-set";
  const ENDSCREEN_CARD_SELECTOR =
    ".ytp-ce-element,.ytp-ce-video,.ytp-ce-playlist,.ytp-ce-channel,.ytp-videowall-still,.ytp-modern-videowall-still,.ytp-suggestion-set";
  const ENDSCREEN_TITLE_SELECTOR =
    ".ytp-ce-video-title,.ytp-ce-channel-title,.ytp-videowall-still-info-title,.ytp-videowall-still-info,.ytp-modern-videowall-still-info-title,.ytp-modern-videowall-still-info";

  function findEndscreenCard(node, root) {
    let current = node;
    let known = null;
    while (current && current !== root) {
      if (current.matches && current.matches(ENDSCREEN_CARD_SELECTOR)) known = current;
      current = current.parentElement;
    }
    if (known) return known;

    const link = node.closest ? node.closest('a[href*="/watch"]') : null;
    if (link) return link;

    current = node;
    while (current.parentElement && current.parentElement !== root) {
      current = current.parentElement;
    }
    return current !== root && current.querySelector && current.querySelector('a[href*="/watch"]')
      ? current
      : null;
  }

  function collectRegularCards(root = document) {
    const candidates = [];
    if (root.nodeType === 1 && isVideoCard(root)) candidates.push(root);
    root.querySelectorAll(CARD_SELECTOR).forEach((card) => candidates.push(card));
    const unique = Array.from(new Set(candidates));
    return unique.filter((card) => {
      let parent = card.parentElement;
      while (parent && parent !== document.body) {
        if (isVideoCard(parent)) return false;
        parent = parent.parentElement;
      }
      return true;
    });
  }

  function collectEndscreenCards() {
    const cards = new Set();
    document.querySelectorAll(ENDSCREEN_ROOT_SELECTOR).forEach((root) => {
      if (root.matches(ENDSCREEN_CARD_SELECTOR)) cards.add(root);
      root.querySelectorAll(ENDSCREEN_CARD_SELECTOR).forEach((card) => {
        const resolved = findEndscreenCard(card, root);
        if (resolved) cards.add(resolved);
      });
      root.querySelectorAll('a[href*="/watch"]').forEach((link) => {
        const card = findEndscreenCard(link, root);
        if (card) cards.add(card);
      });
      root.querySelectorAll(ENDSCREEN_TITLE_SELECTOR).forEach((title) => {
        const card = findEndscreenCard(title, root);
        if (card) cards.add(card);
      });
    });
    return cards;
  }

  function collectKeywordCards() {
    return [...collectRegularCards(), ...collectEndscreenCards()].filter(
      (card, index, all) => all.indexOf(card) === index
    );
  }

  function scanKeywordCard(card) {
    if (!card || !card.isConnected) return false;
    const data = getCardSearchData(card);
    const cached = keywordCache.get(card);
    let hide;
    if (cached && cached.revision === keywordRevision && cached.signature === data.signature) {
      hide = cached.hide;
    } else {
      hide = matchesKeyword(card, data);
      keywordCache.set(card, { revision: keywordRevision, signature: data.signature, hide });
    }
    if (card.classList.contains("yts-hidden-keyword") !== hide) {
      card.classList.toggle("yts-hidden-keyword", hide);
    }
    return hide;
  }

  function scanKeywords() {
    if (!S.keywordEnabled || !hasKeywords()) return;
    let hidden = 0;
    let evaluated = 0;

    collectKeywordCards().forEach((card) => {
      const before = keywordCache.get(card);
      const hide = scanKeywordCard(card);
      const after = keywordCache.get(card);
      if (
        !before ||
        !after ||
        before.signature !== after.signature ||
        before.revision !== after.revision
      ) {
        evaluated++;
      }
      if (hide) hidden++;
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
    keywordCache = new WeakMap();
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

  const HIDE_REASON_CLASSES = {
    shorts: "yts-hidden-shorts",
    game: "yts-hidden-game",
    mix: "yts-hidden-mix",
  };

  function hasHideReason(el, reason) {
    const className = HIDE_REASON_CLASSES[reason];
    return !!(el && className && el.classList.contains(className));
  }

  function hideEl(el, reason) {
    if (!el || !el.style || !HIDE_REASON_CLASSES[reason]) return;
    if (hasHideReason(el, reason)) return;
    el.classList.add(HIDE_REASON_CLASSES[reason]);
    el.style.setProperty("display", "none", "important");
    const reasons = Object.keys(HIDE_REASON_CLASSES).filter((key) => hasHideReason(el, key));
    el.setAttribute("data-yts-hidden", reasons.join(" "));
  }

  function showEl(el, reason) {
    if (!el || !HIDE_REASON_CLASSES[reason]) return;
    el.classList.remove(HIDE_REASON_CLASSES[reason]);
    const reasons = Object.keys(HIDE_REASON_CLASSES).filter((key) => hasHideReason(el, key));
    if (reasons.length) {
      el.setAttribute("data-yts-hidden", reasons.join(" "));
      return;
    }
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
      if (
        item.querySelector('a[href*="/shorts/"]') ||
        item.querySelector('[overlay-style="SHORTS"]') ||
        item.querySelector("[is-shorts]")
      ) {
        hideEl(item, "shorts");
      }
    });

    document.querySelectorAll("ytd-shelf-renderer").forEach((shelf) => {
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
    const className = HIDE_REASON_CLASSES[reason];
    if (!className) return;
    document.querySelectorAll(`.${className}`).forEach((el) => showEl(el, reason));
  }

  // ==================================================================
  // 4. チャンネル名の左に置く「×」ボタン
  //    押すとチャンネル名を "完全一致キーワード" としてフィルターへ追加する
  // ==================================================================
  const CH_HREF_RE = /^\/(@[^/?#]+|channel\/[^/?#]+|c\/[^/?#]+|user\/[^/?#]+)(\/|\?|#|$)/;

  // ボタンを1つ置く単位 (カード / 動画ページの投稿者欄)
  const BUTTON_CARD_SELECTOR = [...CARD_SELECTORS, "ytd-video-owner-renderer"].join(",");

  const DEBUG = (() => {
    try {
      return localStorage.getItem("ytsDebug") === "1";
    } catch (_) {
      return false;
    }
  })();

  /** チャンネル名を完全一致キーワード ("名前") として追加する */
  function addExactKeyword(name) {
    const entry = YTSShared.makeExactKeyword(name);
    if (!entry) return false;

    const list = cleanKeywordList(S.ytFilterKeywords);
    if (!list.some((kw) => YTSShared.keywordIdentity(kw) === YTSShared.keywordIdentity(entry))) {
      const next = [...list, entry];
      S.ytFilterKeywords = next;
      storageSet({ ytFilterKeywords: next });
    } else {
      S.ytFilterKeywords = list;
    }
    rebuildKeywords();
    runScan();
    return true;
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
    const cleanName = (name || "").replace(/^\s*[×✕✖☓✗]\s*/, "").trim();
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
    if (btn.dataset.ytsName !== cleanName) {
      btn.dataset.ytsName = cleanName;
      btn.title = I18N.t("blockBtnTitle", { name: cleanName });
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
      const name = textWithoutBlockButtons(a).trim();
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
        const name = textWithoutBlockButtons(node).trim();
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
        const name = textWithoutBlockButtons(row).trim();
        if (!looksLikeChannelName(name)) continue;
        // 行の中の最初のテキスト要素の手前に置く
        const inner = Array.from(row.querySelectorAll("span,a,div")).find((n) =>
          looksLikeChannelName(textWithoutBlockButtons(n).trim())
        );
        return {
          node: inner || row,
          name: textWithoutBlockButtons(inner || row).trim(),
        };
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
      const key = textWithoutBlockButtons(card).replace(/\s+/g, " ").trim();
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
  const videoSources = new WeakMap();
  const speedApplyTimers = new WeakMap();
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

  function setVideoPlaybackRate(video, rate) {
    if (!video) return;
    try {
      video.defaultPlaybackRate = rate;
      video.playbackRate = rate;
    } catch (_) {}
  }

  function resetVideoSpeed(video) {
    setVideoPlaybackRate(video, DEFAULT_PLAYBACK_RATE);
  }

  function applySpeedTo(video, force) {
    if (!video) return;
    const target = clampSpeed(S.playbackSpeed);
    if (
      !force &&
      Math.abs(video.playbackRate - target) < 0.001 &&
      Math.abs(video.defaultPlaybackRate - target) < 0.001
    ) {
      return;
    }
    setVideoPlaybackRate(video, target);
  }

  function applySpeedToAll(force) {
    if (!S.speedEnabled) return;
    document.querySelectorAll("video").forEach((video) => applySpeedTo(video, force));
  }

  function videoSource(video) {
    return video.currentSrc || video.src || "";
  }

  function scheduleVideoSpeed(video) {
    if (!video || !S.speedEnabled) return;
    const oldTimer = speedApplyTimers.get(video);
    if (oldTimer) clearTimeout(oldTimer);
    const timer = setTimeout(() => {
      speedApplyTimers.delete(video);
      if (S.speedEnabled) applySpeedTo(video, true);
    }, 0);
    speedApplyTimers.set(video, timer);
  }

  function resetAndApplyVideoSpeed(video) {
    if (!video || !S.speedEnabled) return;
    videoSources.set(video, videoSource(video));
    resetVideoSpeed(video);
    scheduleVideoSpeed(video);
  }

  function hookVideo(video) {
    if (hookedVideos.has(video)) return;
    hookedVideos.add(video);
    ["emptied", "loadstart"].forEach((ev) =>
      video.addEventListener(ev, () => resetAndApplyVideoSpeed(video))
    );
    ["loadedmetadata", "canplay", "durationchange", "playing"].forEach((ev) =>
      video.addEventListener(ev, () => {
        if (!S.speedEnabled) return;
        const source = videoSource(video);
        if (videoSources.get(video) !== source) {
          resetAndApplyVideoSpeed(video);
          return;
        }
        applySpeedTo(video, true);
      })
    );
    // 表示サイズが変わると回転時の縮小率も変わる
    ["loadedmetadata", "resize"].forEach((ev) =>
      video.addEventListener(ev, () => rotation && applyRotation())
    );
    // 視聴終了後のカードは ended の後に遅れて生成されるため、表示直後にも再判定する
    video.addEventListener("ended", () => {
      scheduleScan();
      setTimeout(scheduleScan, 350);
      setTimeout(scheduleScan, 1000);
    });
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
          if (S.speedEnabled) applySpeedToAll(true);
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
    document.querySelectorAll("video").forEach((video) => applySpeedTo(video, true));
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

  const TITLE_SPOOF_CSS = `
.html5-video-player.yts-title-spoof-active .html5-video-container,
#movie_player.yts-title-spoof-active .html5-video-container {
  background: #000 !important;
}
.html5-video-player.yts-title-spoof-active video,
#movie_player.yts-title-spoof-active video {
  opacity: 0 !important;
}
.html5-video-player.yts-title-spoof-active .ytp-caption-window-container,
.html5-video-player.yts-title-spoof-active .ytp-iv-player-content,
#movie_player.yts-title-spoof-active .ytp-caption-window-container,
#movie_player.yts-title-spoof-active .ytp-iv-player-content {
  visibility: hidden !important;
}
`;

  const SPOOF_TITLE_SELECTOR = "ytd-watch-metadata h1,#title h1,h1.ytd-watch-metadata";
  const SPOOF_CHANNEL_SELECTOR =
    "#owner #channel-name,#upload-info #channel-name,ytd-watch-metadata #channel-name,ytd-video-owner-renderer #channel-name";
  const SPOOF_AVATAR_SELECTOR =
    "#owner #avatar img,#owner yt-img-shadow img,#upload-info #avatar img,ytd-video-owner-renderer #avatar img,ytd-video-owner-renderer yt-img-shadow img";

  let titleSpoofStyleEl = null;

  function ensureTitleSpoofStyle() {
    if (titleSpoofStyleEl && titleSpoofStyleEl.isConnected) return titleSpoofStyleEl;
    titleSpoofStyleEl = document.createElement("style");
    titleSpoofStyleEl.id = "yts-title-spoof-style";
    titleSpoofStyleEl.textContent = TITLE_SPOOF_CSS;
    (document.head || document.documentElement).appendChild(titleSpoofStyleEl);
    return titleSpoofStyleEl;
  }

  let titleSpoofActive = false;
  let titleSpoofUsedSinceLoad = false;
  let titleSpoofOriginal = document.title;
  let titleSpoofOriginalChannelName = "";
  let titleSpoofLastValue = "";
  let titleSpoofKeywordPrevious = null;
  const spoofedTitleValues = new Set();
  const spoofedChannelValues = new Set();
  const spoofTextElements = new Set();
  let spoofTextOriginals = new WeakMap();
  const spoofImageElements = new Set();
  let spoofImageOriginals = new WeakMap();
  const spoofFaviconElements = new Set();
  let spoofFaviconOriginals = new WeakMap();
  let spoofFaviconCreated = null;

  function spoofIconUrl() {
    const value = typeof S.titleSpoofIconUrl === "string" ? S.titleSpoofIconUrl.trim() : "";
    return /^(https?:|data:image\/|chrome-extension:)/i.test(value) ? value : "";
  }

  function playerResponseData() {
    const direct = window.ytInitialPlayerResponse;
    if (direct && typeof direct === "object") return direct;
    const raw = window.ytplayer && window.ytplayer.config && window.ytplayer.config.args
      ? window.ytplayer.config.args.player_response
      : "";
    if (typeof raw !== "string" || !raw) return null;
    try {
      const parsed = JSON.parse(raw);
      return parsed && typeof parsed === "object" ? parsed : null;
    } catch (_) {
      return null;
    }
  }

  function textFromRuns(value) {
    if (!value || typeof value !== "object") return "";
    if (typeof value.simpleText === "string") return value.simpleText.trim();
    if (!Array.isArray(value.runs)) return "";
    return value.runs
      .map((run) => (run && typeof run.text === "string" ? run.text : ""))
      .join("")
      .trim();
  }

  function currentVideoId() {
    try {
      const url = new URL(location.href);
      const queryId = url.searchParams.get("v");
      if (queryId) return queryId;
      const match = url.pathname.match(/^\/(?:shorts|live|embed)\/([^/?#]+)/);
      return match ? match[1] : "";
    } catch (_) {
      return "";
    }
  }

  function isCurrentPlayerResponse(response) {
    if (!response || !response.videoDetails) return false;
    const currentId = currentVideoId();
    const responseId = response.videoDetails.videoId;
    return !currentId || !responseId || currentId === responseId;
  }

  function findChannelInInitialData(data) {
    const contents =
      data &&
      data.contents &&
      data.contents.twoColumnWatchNextResults &&
      data.contents.twoColumnWatchNextResults.results &&
      data.contents.twoColumnWatchNextResults.results.results &&
      data.contents.twoColumnWatchNextResults.results.results.contents;
    if (!Array.isArray(contents)) return "";

    for (const item of contents) {
      const secondary = item && item.videoSecondaryInfoRenderer;
      const owner = secondary && secondary.owner && secondary.owner.videoOwnerRenderer;
      if (!owner) continue;
      const name = textFromRuns(owner.title) || textFromRuns(owner.ownerText);
      if (name) return name;
    }
    return "";
  }

  function isSpoofedMetadataValue(value, configured, previousValues) {
    const current = typeof value === "string" ? value.trim() : "";
    if (!current) return true;
    if (configured && current === configured) return true;
    if (previousValues && previousValues.has(current)) return true;
    return /^youtube$/i.test(current);
  }

  function visibleChannelName() {
    const elements = document.querySelectorAll(SPOOF_CHANNEL_SELECTOR);
    for (const element of elements) {
      const name = textWithoutBlockButtons(element).replace(/\s+/g, " ").trim();
      if (name) return name;
    }
    return actualChannelName();
  }

  function originalChannelName() {
    return titleSpoofOriginalChannelName || actualChannelName();
  }

  function clearSpoofSessionState() {
    spoofedTitleValues.clear();
    spoofedChannelValues.clear();
    titleSpoofOriginalChannelName = "";
  }

  function actualVideoTitle() {
    const fakeTitle = typeof S.titleSpoofText === "string" ? S.titleSpoofText.trim() : "";
    const pageTitle = document.title.replace(/\s+-\s+YouTube(?:\s+-\s+Vivaldi)?\s*$/i, "").trim();
    const usablePageTitle =
      pageTitle && !/^youtube(?:\s+music)?$/i.test(pageTitle) && pageTitle !== fakeTitle
        ? pageTitle
        : "";
    if (usablePageTitle) return usablePageTitle;
    const response = playerResponseData();
    const responseTitle = response && response.videoDetails && response.videoDetails.title;
    if (isCurrentPlayerResponse(response) && typeof responseTitle === "string" && responseTitle.trim()) {
      return responseTitle.trim();
    }
    return usablePageTitle;
  }

  function actualChannelName() {
    const response = playerResponseData();
    const author = response && response.videoDetails && response.videoDetails.author;
    if (isCurrentPlayerResponse(response) && typeof author === "string" && author.trim()) {
      return author.trim();
    }
    return findChannelInInitialData(window.ytInitialData);
  }

  function rememberSpoofText(element) {
    if (spoofTextOriginals.has(element)) return true;
    const html = element.innerHTML || "";
    const text = (element.textContent || "").replace(/\s+/g, " ").trim();
    if (!text) return false;
    spoofTextOriginals.set(element, { html, text });
    spoofTextElements.add(element);
    return true;
  }

  function applySpoofMetadata() {
    const title = typeof S.titleSpoofText === "string" ? S.titleSpoofText.trim() : "";
    const channel =
      typeof S.titleSpoofChannelName === "string" ? S.titleSpoofChannelName.trim() : "";
    if (title) {
      spoofedTitleValues.add(title);
      document.querySelectorAll(SPOOF_TITLE_SELECTOR).forEach((element) => {
        if (!rememberSpoofText(element)) return;
        element.textContent = title;
      });
    }
    if (channel) {
      if (!titleSpoofOriginalChannelName) titleSpoofOriginalChannelName = visibleChannelName();
      spoofedChannelValues.add(channel);
      document.querySelectorAll(SPOOF_CHANNEL_SELECTOR).forEach((element) => {
        if (!rememberSpoofText(element)) return;
        element.textContent = channel;
      });
    }
    const icon = spoofIconUrl();
    if (!icon) return;
    document.querySelectorAll(SPOOF_AVATAR_SELECTOR).forEach((element) => {
      if (!spoofImageOriginals.has(element)) {
        spoofImageOriginals.set(element, {
          src: element.getAttribute("src"),
          srcset: element.getAttribute("srcset"),
          sizes: element.getAttribute("sizes"),
          dataSrc: element.getAttribute("data-src"),
          alt: element.getAttribute("alt"),
        });
        spoofImageElements.add(element);
      }
      element.setAttribute("src", icon);
      element.removeAttribute("srcset");
      element.removeAttribute("data-src");
      if (channel) element.setAttribute("alt", channel);
    });
    let faviconLinks = [...document.querySelectorAll('link[rel~="icon"],link[rel="shortcut icon"]')];
    if (!faviconLinks.length && document.head) {
      const link = document.createElement("link");
      link.id = "yts-title-spoof-favicon";
      link.rel = "icon";
      document.head.appendChild(link);
      spoofFaviconCreated = link;
      faviconLinks = [link];
    }
    faviconLinks.forEach((element) => {
      if (!spoofFaviconOriginals.has(element)) {
        spoofFaviconOriginals.set(element, element.getAttribute("href"));
        spoofFaviconElements.add(element);
      }
      element.setAttribute("href", icon);
    });
  }

  function restoreSpoofMetadata() {
    spoofTextElements.forEach((element) => {
      if (!element.isConnected) return;
      const original = spoofTextOriginals.get(element);
      if (!original) return;
      if (original.html.trim()) {
        element.innerHTML = original.html;
      } else if (original.text) {
        element.textContent = original.text;
      } else if (element.matches(SPOOF_TITLE_SELECTOR)) {
        element.textContent = actualVideoTitle();
      } else if (element.matches(SPOOF_CHANNEL_SELECTOR)) {
        const channel = originalChannelName();
        if (channel) element.textContent = channel;
      }
    });
    spoofImageElements.forEach((element) => {
      const original = spoofImageOriginals.get(element);
      if (!element.isConnected || !original) return;
      ["src", "srcset", "sizes", "data-src", "alt"].forEach((name) => {
        const value = original[name === "data-src" ? "dataSrc" : name];
        if (value === null || value === undefined) element.removeAttribute(name);
        else element.setAttribute(name, value);
      });
    });
    spoofTextElements.clear();
    spoofImageElements.clear();
    spoofTextOriginals = new WeakMap();
    spoofImageOriginals = new WeakMap();
    spoofFaviconElements.forEach((element) => {
      if (!element.isConnected) return;
      if (element === spoofFaviconCreated) {
        element.remove();
        return;
      }
      const original = spoofFaviconOriginals.get(element);
      if (original === null || original === undefined) element.removeAttribute("href");
      else element.setAttribute("href", original);
    });
    spoofFaviconElements.clear();
    spoofFaviconOriginals = new WeakMap();
    spoofFaviconCreated = null;
  }

  function recoverSpoofTextWhenOff() {
    if (titleSpoofActive) return;
    const fakeTitle = typeof S.titleSpoofText === "string" ? S.titleSpoofText.trim() : "";
    const title = actualVideoTitle();
    if (title) {
      document.querySelectorAll(SPOOF_TITLE_SELECTOR).forEach((element) => {
        const current = (element.textContent || "").replace(/\s+/g, " ").trim();
        if (isSpoofedMetadataValue(current, fakeTitle, spoofedTitleValues)) {
          element.textContent = title;
        }
      });
    }
    const fakeChannel =
      typeof S.titleSpoofChannelName === "string" ? S.titleSpoofChannelName.trim() : "";
    const channel = originalChannelName();
    if (channel) {
      document.querySelectorAll(SPOOF_CHANNEL_SELECTOR).forEach((element) => {
        const current = (element.textContent || "").replace(/\s+/g, " ").trim();
        if (isSpoofedMetadataValue(current, fakeChannel, spoofedChannelValues)) {
          element.textContent = channel;
        }
      });
    }
  }

  function syncSpoofMode() {
    if (!titleSpoofActive) return;
    ensureTitleSpoofStyle().disabled = false;
    document.querySelectorAll(".html5-video-player,#movie_player").forEach((player) => {
      player.classList.toggle("yts-title-spoof-active", titleSpoofActive);
    });
    applySpoofMetadata();
  }

  ensureTitleSpoofStyle();

  function syncTitleSpoof() {
    if (!titleSpoofActive) return;
    const fakeTitle = typeof S.titleSpoofText === "string" ? S.titleSpoofText.trim() : "";
    const currentTitle = document.title;

    if (fakeTitle) {
      if (currentTitle && currentTitle !== titleSpoofLastValue && currentTitle !== fakeTitle) {
        titleSpoofOriginal = currentTitle;
      }
      titleSpoofLastValue = fakeTitle;
      if (currentTitle !== fakeTitle) document.title = fakeTitle;
      return;
    }
  }

  function restoreTitleSpoof() {
    const currentTitle = document.title;
    if (currentTitle === titleSpoofLastValue && titleSpoofOriginal) {
      document.title = titleSpoofOriginal;
    }
    titleSpoofLastValue = "";
  }

  function toggleTitleSpoof() {
    if (titleSpoofActive) {
      titleSpoofActive = false;
      restoreTitleSpoof();
      document.querySelectorAll(".yts-title-spoof-active").forEach((element) => {
        element.classList.remove("yts-title-spoof-active");
      });
      restoreSpoofMetadata();
      recoverSpoofTextWhenOff();
      clearSpoofSessionState();
      if (titleSpoofKeywordPrevious !== null) {
        const previous = titleSpoofKeywordPrevious;
        titleSpoofKeywordPrevious = null;
        S.keywordEnabled = previous;
        rebuildKeywords();
        if (!previous) clearKeywordHidden();
        storageSet({ keywordEnabled: previous });
      }
      return;
    }
    const fakeTitle = typeof S.titleSpoofText === "string" ? S.titleSpoofText.trim() : "";
    if (!fakeTitle) {
      showToast(I18N.t("titleSpoofEmpty"));
      return;
    }
    titleSpoofOriginal = document.title;
    titleSpoofOriginalChannelName = visibleChannelName();
    titleSpoofLastValue = "";
    titleSpoofActive = true;
    titleSpoofUsedSinceLoad = true;
    if (!S.keywordEnabled) {
      titleSpoofKeywordPrevious = false;
      S.keywordEnabled = true;
      rebuildKeywords();
      storageSet({ keywordEnabled: true });
    }
    syncTitleSpoof();
    syncSpoofMode();
  }

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
    titleSpoof: { run: toggleTitleSpoof, enabled: () => true },
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

  function runScanTask(name, task) {
    try {
      task();
    } catch (error) {
      if (DEBUG) console.warn(`[YouTube Suite] ${name} failed`, error);
    }
  }

  function runScan() {
    scanScheduled = false;
    if (!settingsLoaded || !alive) return;
    if (!extensionAlive()) {
      shutdown();
      return;
    }
    runScanTask("Shorts scan", scanShorts);
    runScanTask("game scan", scanGames);
    runScanTask("Mix scan", scanMix);
    runScanTask("player cards style", syncPlayerCardsStyle);
    if (titleSpoofActive) {
      runScanTask("title spoof", syncTitleSpoof);
      runScanTask("spoof visuals and metadata", syncSpoofMode);
    }
    runScanTask("keyword scan", scanKeywords);
    runScanTask("channel button scan", decorateChannelButtons);
    runScanTask("video hook", hookVideos);
    runScanTask("volume boost", applyBoost);
  }

  function scheduleScan() {
    if (scanScheduled) return;
    scanScheduled = true;
    clearTimeout(scanTimer);
    scanTimer = setTimeout(runScan, 250);
  }

  const observer = new MutationObserver((mutations) => {
    for (const m of mutations) {
      if (m.addedNodes.length > 0) {
        scheduleScan();
        return;
      }
      if (m.type === "attributes") {
        scheduleScan();
        return;
      }
      if (m.type === "characterData") {
        const parent = m.target && m.target.parentElement;
        if (parent && parent.tagName === "TITLE") {
          scheduleScan();
          return;
        }
        if (
          parent &&
          (parent.closest(CARD_SELECTOR) ||
            parent.closest(ENDSCREEN_CARD_SELECTOR) ||
            parent.closest(ENDSCREEN_ROOT_SELECTOR))
        ) {
          scheduleScan();
          return;
        }
      }
    }
  });

  function startObserving() {
    observer.observe(document.documentElement, {
      childList: true,
      subtree: true,
      characterData: true,
      attributes: true,
      attributeFilter: [
        "title",
        "aria-label",
        "href",
        "data-title",
        "data-author",
        "is-shorts",
        "overlay-style",
      ],
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
  let lastVideoId = currentVideoId();

  function onNavigate() {
    resetRotation(); // 回転は動画ごとにリセットする
    if (titleSpoofActive) {
      restoreSpoofMetadata();
      clearSpoofSessionState();
    }
    syncShortsStyle();
    syncGameStyle();
    syncMixStyle();
    syncPlayerCardsStyle();
    if (titleSpoofActive) {
      syncTitleSpoof();
      syncSpoofMode();
    }
    if (S.speedEnabled) {
      document.querySelectorAll("video").forEach(resetVideoSpeed);
    }
    burstApplySpeed();
    scheduleScan();
  }

  function checkNavigation() {
    if (!alive) return;
    if (location.href !== lastHref) {
      const previousVideoId = lastVideoId;
      const nextVideoId = currentVideoId();
      lastHref = location.href;
      lastVideoId = nextVideoId;
      if (
        titleSpoofUsedSinceLoad &&
        nextVideoId &&
        nextVideoId !== previousVideoId
      ) {
        window.location.reload();
        return;
      }
      onNavigate();
    }
  }

  window.addEventListener("yt-navigate-finish", checkNavigation, true);
  window.addEventListener("yt-page-data-updated", scheduleScan, true);
  window.addEventListener("popstate", checkNavigation);
  navIntervalId = setInterval(checkNavigation, 400);

  // ==================================================================
  // 7. 設定の読み込み・同期
  // ==================================================================
  /** 壊れた/欠けたキー設定を既定値で補う */
  function sanitizeKeybinds() {
    S.keybinds = YTSShared.sanitizeKeybinds(S.keybinds);
    if (!ROTATION_STEPS.includes(Number(S.rotationStep))) {
      S.rotationStep = DEFAULTS.rotationStep;
    }
  }

  function applySettings(changedKeys) {
    rebuildKeywords();
    syncShortsStyle();
    syncGameStyle();
    syncMixStyle();
    syncPlayerCardsStyle();

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
    if (touched("mixEnabled") && !S.mixEnabled) {
      restoreHidden("mix");
    }
    if (touched("blockButton") && !S.blockButton) {
      removeBlockButtons();
    }
    if (touched("language")) {
      removeBlockButtons(); // ツールチップを新しい言語で作り直す
    }
    if (touched("playbackSpeed") || touched("speedEnabled")) {
      if (S.speedEnabled) applySpeedToAll(true);
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
    const titleSpoofPatch = YTSShared.migrateTitleSpoofSettings(res);
    const migratedSettings = Object.assign({}, res, titleSpoofPatch);
    const previousKeywords = Array.isArray(res.ytFilterKeywords) ? res.ytFilterKeywords : [];
    Object.assign(S, YTSShared.sanitizeSettings(migratedSettings));
    if (Object.keys(titleSpoofPatch).length) storageSet(titleSpoofPatch);
    const cleanedKeywords = S.ytFilterKeywords;
    if (
      cleanedKeywords.length !== previousKeywords.length ||
      cleanedKeywords.some((kw, i) => kw !== previousKeywords[i])
    ) {
      S.ytFilterKeywords = cleanedKeywords;
      storageSet({ ytFilterKeywords: cleanedKeywords });
    } else {
      S.ytFilterKeywords = cleanedKeywords;
    }
    sanitizeKeybinds();
    I18N.setLanguage(S.language);
    settingsLoaded = true;

    rebuildKeywords();
    syncShortsStyle();
    syncGameStyle();
    syncMixStyle();
    syncPlayerCardsStyle();
    syncTitleSpoof();
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
    if (titleSpoofActive && keys.includes("keywordEnabled") && !S.keywordEnabled) {
      S.keywordEnabled = true;
      storageSet({ keywordEnabled: true });
    }
    const previousKeywords = Array.isArray(S.ytFilterKeywords) ? S.ytFilterKeywords : [];
    S.playbackSpeed = clampSpeed(S.playbackSpeed);
    S.volumeBoost = clampBoost(S.volumeBoost);
    S.ytFilterKeywords = cleanKeywordList(S.ytFilterKeywords);
    if (
      previousKeywords.length !== S.ytFilterKeywords.length ||
      previousKeywords.some((kw, index) => kw !== S.ytFilterKeywords[index])
    ) {
      storageSet({ ytFilterKeywords: S.ytFilterKeywords });
    }
    sanitizeKeybinds();
    I18N.setLanguage(S.language);
    if (settingsLoaded) applySettings(keys);
  });
})();
