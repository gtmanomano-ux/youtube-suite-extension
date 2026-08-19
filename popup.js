/**
 * YouTube Suite - popup.js
 *  タブ1「フィルター」… キーワード・音量ブースト・再生速度
 *  タブ2「機能」      … 各機能の ON/OFF だけ (数値は表示しない)
 *  下部               … 詳細設定 / ヘルプ (オプションページ)
 */

"use strict";

const $ = (id) => document.getElementById(id);

const el = {
  tabs: document.querySelectorAll(".tab"),

  keywordCount: $("keywordCount"),
  keywordForm: $("keywordForm"),
  keywordInput: $("keywordInput"),
  keywordError: $("keywordError"),
  keywordList: $("keywordList"),

  boostBody: $("boostBody"),
  boostValue: $("boostValue"),
  boostUp: $("boostUp"),
  boostDown: $("boostDown"),

  speedBody: $("speedBody"),
  speedValue: $("speedValue"),
  speedUp: $("speedUp"),
  speedDown: $("speedDown"),

  keywordToggle: $("keywordToggle"),
  blockButtonToggle: $("blockButtonToggle"),
  shortsToggle: $("shortsToggle"),
  gameToggle: $("gameToggle"),
  mixToggle: $("mixToggle"),
  playerCardsToggle: $("playerCardsToggle"),
  speedToggle: $("speedToggle"),
  rotationToggle: $("rotationToggle"),
  boostToggle: $("boostToggle"),

  openOptions: $("openOptions"),
  openHelp: $("openHelp"),
};

let state = Object.assign({}, YTS.DEFAULTS);

// ==================================================================
// タブ
// ==================================================================
el.tabs.forEach((tab) => {
  tab.addEventListener("click", () => {
    el.tabs.forEach((t) => t.classList.toggle("active", t === tab));
    document.querySelectorAll(".tab-panel").forEach((panel) => {
      panel.hidden = panel.id !== "panel-" + tab.dataset.tab;
    });
  });
});

// ==================================================================
// 保存
// ==================================================================
async function update(patch) {
  Object.assign(state, patch);
  state = YTS.sanitize(state);
  render();
  await YTS.save(patch);
}

// ==================================================================
// 描画
// ==================================================================
function showError(msg) {
  el.keywordError.textContent = msg;
  el.keywordError.classList.add("show");
}
function clearError() {
  el.keywordError.textContent = "";
  el.keywordError.classList.remove("show");
}

function renderKeywords() {
  const list = state.ytFilterKeywords;
  el.keywordCount.textContent = list.length
    ? I18N.t("countUnit", { n: list.length })
    : I18N.t("notRegistered");
  el.keywordList.textContent = "";

  list.forEach((kw, idx) => {
    const row = document.createElement("div");
    row.className = "chip";

    const name = document.createElement("span");
    name.className = "chip-name";
    name.textContent = YTS.keywordLabel(kw);
    name.title = kw;

    const kind = document.createElement("span");
    kind.className = "chip-kind";
    kind.textContent = YTS.keywordKind(kw);
    name.appendChild(kind);

    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "chip-remove";
    btn.textContent = "×";
    btn.title = I18N.t("remove");
    btn.addEventListener("click", () =>
      update({ ytFilterKeywords: state.ytFilterKeywords.filter((_, i) => i !== idx) })
    );

    row.appendChild(name);
    row.appendChild(btn);
    el.keywordList.appendChild(row);
  });
}

function renderBoost() {
  const boost = YTS.clampBoost(state.volumeBoost);
  el.boostValue.textContent = YTS.format(boost);
  el.boostToggle.checked = state.boostEnabled;
  el.boostBody.classList.toggle("disabled", !state.boostEnabled);
}

function renderSpeed() {
  const speed = YTS.clampSpeed(state.playbackSpeed);
  el.speedValue.textContent = YTS.format(speed);
  el.speedToggle.checked = state.speedEnabled;
  el.speedBody.classList.toggle("disabled", !state.speedEnabled);
}

function renderToggles() {
  el.keywordToggle.checked = state.keywordEnabled;
  el.blockButtonToggle.checked = state.blockButton;
  el.shortsToggle.checked = state.enabled;
  el.gameToggle.checked = state.gameEnabled;
  el.mixToggle.checked = state.mixEnabled;
  el.playerCardsToggle.checked = state.playerCardsEnabled;
  el.rotationToggle.checked = state.rotationEnabled;
}

function render() {
  I18N.setLanguage(state.language);
  I18N.apply(document);
  renderKeywords();
  renderBoost();
  renderSpeed();
  renderToggles();
}

// ==================================================================
// キーワード
// ==================================================================
el.keywordForm.addEventListener("submit", (e) => {
  e.preventDefault();
  clearError();

  const value = YTS.normalizeKeywordInput(el.keywordInput.value);
  if (!value) {
    showError(I18N.t("errKwEmpty"));
    return;
  }
  if (
    state.ytFilterKeywords.some(
      (k) => YTSShared.keywordIdentity(k) === YTSShared.keywordIdentity(value)
    )
  ) {
    showError(I18N.t("errKwDup"));
    return;
  }
  el.keywordInput.value = "";
  update({ ytFilterKeywords: [...state.ytFilterKeywords, value] });
});

// ==================================================================
// 音量ブーストの倍率
// ==================================================================
function setBoost(v) {
  const boost = YTS.clampBoost(v);
  if (boost === YTS.clampBoost(state.volumeBoost)) return;
  update({ volumeBoost: boost });
}
el.boostUp.addEventListener("click", () => setBoost(state.volumeBoost + YTS.BOOST.step));
el.boostDown.addEventListener("click", () => setBoost(state.volumeBoost - YTS.BOOST.step));

// 再生速度
function setSpeed(v) {
  const speed = YTS.clampSpeed(v);
  if (speed === YTS.clampSpeed(state.playbackSpeed)) return;
  update({ playbackSpeed: speed });
}
el.speedUp.addEventListener("click", () => setSpeed(state.playbackSpeed + YTS.SPEED.step));
el.speedDown.addEventListener("click", () => setSpeed(state.playbackSpeed - YTS.SPEED.step));

// ==================================================================
// 機能トグル
// ==================================================================
const TOGGLES = {
  keywordToggle: "keywordEnabled",
  blockButtonToggle: "blockButton",
  shortsToggle: "enabled",
  gameToggle: "gameEnabled",
  mixToggle: "mixEnabled",
  playerCardsToggle: "playerCardsEnabled",
  speedToggle: "speedEnabled",
  rotationToggle: "rotationEnabled",
  boostToggle: "boostEnabled",
};

Object.keys(TOGGLES).forEach((id) => {
  el[id].addEventListener("change", () => update({ [TOGGLES[id]]: el[id].checked }));
});

// ==================================================================
// オプションページ
// ==================================================================
function openOptionsPage(hash) {
  const url = chrome.runtime.getURL("options.html" + (hash || ""));
  try {
    if (chrome.tabs && chrome.tabs.create) {
      chrome.tabs.create({ url });
      window.close();
      return;
    }
  } catch (_) {}
  window.open(url, "_blank");
  window.close();
}

el.openOptions.addEventListener("click", () => openOptionsPage(""));
el.openHelp.addEventListener("click", () => openOptionsPage("#help"));

// ==================================================================
// 他画面・ショートカットからの変更を反映
// ==================================================================
YTS.subscribe((patch) => {
  state = YTS.sanitize(Object.assign({}, state, patch));
  render();
});

(async () => {
  state = await YTS.load();
  render();
})();
