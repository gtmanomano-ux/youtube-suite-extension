/**
 * YouTube Suite - options.js
 * 全設定 + ヘルプ。popup とは chrome.storage.sync 経由で同期する。
 */

"use strict";

const $ = (id) => document.getElementById(id);

const el = {
  tabs: document.querySelectorAll(".tab"),

  speedToggle: $("speedToggle"),
  speedBadge: $("speedBadge"),
  speedValue: $("speedValue"),
  speedRange: $("speedRange"),
  speedUp: $("speedUp"),
  speedDown: $("speedDown"),
  speedPresets: $("speedPresets"),

  boostToggle: $("boostToggle"),
  boostBadge: $("boostBadge"),
  boostBody: $("boostBody"),
  boostValue: $("boostValue"),
  boostRange: $("boostRange"),
  boostUp: $("boostUp"),
  boostDown: $("boostDown"),
  boostPresets: $("boostPresets"),

  shortsToggle: $("shortsToggle"),
  shortsBadge: $("shortsBadge"),

  gameToggle: $("gameToggle"),
  gameBadge: $("gameBadge"),

  mixToggle: $("mixToggle"),
  mixBadge: $("mixBadge"),

  playerCardsToggle: $("playerCardsToggle"),
  playerCardsBadge: $("playerCardsBadge"),

  titleSpoofForm: $("titleSpoofForm"),
  titleSpoofInput: $("titleSpoofInput"),
  titleSpoofMetaForm: $("titleSpoofMetaForm"),
  titleSpoofChannelInput: $("titleSpoofChannelInput"),
  titleSpoofIconInput: $("titleSpoofIconInput"),

  rotationToggle: $("rotationToggle"),
  rotationBadge: $("rotationBadge"),
  rotationBody: $("rotationBody"),
  rotationPresets: $("rotationPresets"),
  langPresets: $("langPresets"),
  keybindList: $("keybindList"),
  keybindError: $("keybindError"),
  keybindReset: $("keybindReset"),

  blockButtonToggle: $("blockButtonToggle"),
  blockButtonBadge: $("blockButtonBadge"),

  keywordToggle: $("keywordToggle"),
  keywordBadge: $("keywordBadge"),
  keywordForm: $("keywordForm"),
  keywordInput: $("keywordInput"),
  keywordError: $("keywordError"),
  keywordList: $("keywordList"),
  keywordReset: $("keywordReset"),

  resetAll: $("resetAll"),
  resetDone: $("resetDone"),
};

let state = Object.assign({}, YTS.DEFAULTS);

// ==================================================================
// タブ切り替え
// ==================================================================
function selectTab(name) {
  let matched = false;
  el.tabs.forEach((t) => {
    const on = t.dataset.tab === name;
    if (on) matched = true;
    t.classList.toggle("active", on);
  });
  if (!matched) return;
  document.querySelectorAll(".tab-panel").forEach((panel) => {
    panel.hidden = panel.id !== "panel-" + name;
  });
}

el.tabs.forEach((tab) => {
  tab.addEventListener("click", () => selectTab(tab.dataset.tab));
});

// ポップアップの「ヘルプ」から options.html#help で開かれたとき
if (location.hash) selectTab(location.hash.slice(1));
window.addEventListener("hashchange", () => selectTab(location.hash.slice(1)));

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
function showError(node, msg) {
  node.textContent = msg;
  node.classList.add("show");
}
function clearError(node) {
  node.textContent = "";
  node.classList.remove("show");
}

function renderChips(container, items, labelFn, onRemove, kindFn) {
  container.textContent = "";
  items.forEach((item, idx) => {
    const row = document.createElement("div");
    row.className = "chip";

    const name = document.createElement("span");
    name.className = "chip-name";
    name.textContent = labelFn(item);
    name.title = item;

    const kind = kindFn && kindFn(item);
    if (kind) {
      const tag = document.createElement("span");
      tag.className = "chip-kind";
      tag.textContent = kind;
      name.appendChild(tag);
    }

    const btn = document.createElement("button");
    btn.className = "chip-remove";
    btn.type = "button";
    btn.textContent = "×";
    btn.title = I18N.t("remove");
    btn.addEventListener("click", () => onRemove(idx));

    row.appendChild(name);
    row.appendChild(btn);
    container.appendChild(row);
  });
}

function renderSpeed() {
  const speed = YTS.clampSpeed(state.playbackSpeed);
  el.speedValue.textContent = YTS.format(speed);
  el.speedRange.value = String(speed);
  el.speedPresets.querySelectorAll("button").forEach((btn) => {
    btn.classList.toggle("active", YTS.clampSpeed(btn.dataset.speed) === speed);
  });
  el.speedToggle.checked = state.speedEnabled;
  YTS.updateBadge(el.speedBadge, state.speedEnabled);
}

function renderBoost() {
  const boost = YTS.clampBoost(state.volumeBoost);
  el.boostValue.textContent = YTS.format(boost);
  el.boostRange.value = String(boost);
  el.boostPresets.querySelectorAll("button").forEach((btn) => {
    btn.classList.toggle("active", YTS.clampBoost(btn.dataset.boost) === boost);
  });
  el.boostToggle.checked = state.boostEnabled;
  YTS.updateBadge(el.boostBadge, state.boostEnabled);
  el.boostBody.classList.toggle("disabled", !state.boostEnabled);
}

function renderShorts() {
  el.shortsToggle.checked = state.enabled;
  YTS.updateBadge(el.shortsBadge, state.enabled);
  el.gameToggle.checked = state.gameEnabled;
  YTS.updateBadge(el.gameBadge, state.gameEnabled);
  el.mixToggle.checked = state.mixEnabled;
  YTS.updateBadge(el.mixBadge, state.mixEnabled);
  el.playerCardsToggle.checked = state.playerCardsEnabled;
  YTS.updateBadge(el.playerCardsBadge, state.playerCardsEnabled);
}

function renderTitleSpoof() {
  if (document.activeElement !== el.titleSpoofInput) {
    el.titleSpoofInput.value = state.titleSpoofText;
  }
  if (document.activeElement !== el.titleSpoofChannelInput) {
    el.titleSpoofChannelInput.value = state.titleSpoofChannelName;
  }
  if (document.activeElement !== el.titleSpoofIconInput) {
    el.titleSpoofIconInput.value = state.titleSpoofIconUrl;
  }
}

function renderKeywords() {
  el.keywordToggle.checked = state.keywordEnabled;
  YTS.updateBadge(el.keywordBadge, state.keywordEnabled);
  el.blockButtonToggle.checked = state.blockButton;
  YTS.updateBadge(el.blockButtonBadge, state.blockButton);

  renderChips(
    el.keywordList,
    state.ytFilterKeywords,
    YTS.keywordLabel,
    (idx) => update({ ytFilterKeywords: state.ytFilterKeywords.filter((_, i) => i !== idx) }),
    YTS.keywordKind
  );
}

function renderRotation() {
  el.rotationToggle.checked = state.rotationEnabled;
  YTS.updateBadge(el.rotationBadge, state.rotationEnabled);
  el.rotationBody.classList.toggle("disabled", !state.rotationEnabled);
  el.rotationPresets.querySelectorAll("button").forEach((btn) => {
    btn.classList.toggle("active", Number(btn.dataset.rot) === Number(state.rotationStep));
  });
}

// ---- ショートカット ----
let recordingAction = null;

function renderKeybinds() {
  el.keybindList.textContent = "";

  Object.keys(YTS.ACTION_KEYS).forEach((action) => {
    const row = document.createElement("div");
    row.className = "keybind-row";
    row.dataset.action = action;
    if (recordingAction === action) row.classList.add("recording");

    const name = document.createElement("span");
    name.className = "keybind-name";
    name.textContent = YTS.actionLabel(action);

    const key = document.createElement("span");
    key.className = "keybind-key";
    key.textContent =
      recordingAction === action ? I18N.t("keyPress") : YTS.formatBinding(state.keybinds[action]);

    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "keybind-edit";
    btn.textContent = I18N.t(recordingAction === action ? "cancel" : "change");
    btn.addEventListener("click", () => {
      recordingAction = recordingAction === action ? null : action;
      clearError(el.keybindError);
      renderKeybinds();
    });

    row.appendChild(name);
    row.appendChild(key);
    row.appendChild(btn);
    el.keybindList.appendChild(row);
  });
}

// 記録中は、このページのキー入力をすべて横取りする
window.addEventListener(
  "keydown",
  (e) => {
    if (!recordingAction) return;
    e.preventDefault();
    e.stopPropagation();

    if (e.code === "Escape") {
      recordingAction = null;
      renderKeybinds();
      return;
    }

    const binding = YTS.bindingFromEvent(e);
    if (!binding) return; // 修飾キー単独は無視して押し直しを待つ

    const duplicate = Object.keys(state.keybinds).find(
      (a) => a !== recordingAction && YTS.sameBinding(state.keybinds[a], binding)
    );
    if (duplicate) {
      showError(
        el.keybindError,
        I18N.t("keyDup", { name: YTS.actionLabel(duplicate), key: YTS.formatBinding(binding) })
      );
      return;
    }

    const next = Object.assign({}, state.keybinds, { [recordingAction]: binding });
    recordingAction = null;
    clearError(el.keybindError);
    update({ keybinds: next });
  },
  true
);

function applyLanguage() {
  I18N.setLanguage(state.language);
  I18N.apply(document);
  el.langPresets.querySelectorAll("button").forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.lang === state.language);
  });
}

function render() {
  applyLanguage();
  renderSpeed();
  renderBoost();
  renderShorts();
  renderKeywords();
  renderRotation();
  renderKeybinds();
  renderTitleSpoof();
}

// ==================================================================
// 再生速度
// ==================================================================
function setSpeed(value) {
  const speed = YTS.clampSpeed(value);
  if (speed === YTS.clampSpeed(state.playbackSpeed)) {
    renderSpeed();
    return;
  }
  update({ playbackSpeed: speed });
}

el.speedUp.addEventListener("click", () => setSpeed(state.playbackSpeed + YTS.SPEED.step));
el.speedDown.addEventListener("click", () => setSpeed(state.playbackSpeed - YTS.SPEED.step));
el.speedRange.addEventListener("input", () => setSpeed(el.speedRange.value));
el.speedPresets.addEventListener("click", (e) => {
  const btn = e.target.closest("button[data-speed]");
  if (btn) setSpeed(btn.dataset.speed);
});
el.speedToggle.addEventListener("change", () =>
  update({ speedEnabled: el.speedToggle.checked })
);

// ==================================================================
// 音量ブースト
// ==================================================================
function setBoost(value) {
  const boost = YTS.clampBoost(value);
  if (boost === YTS.clampBoost(state.volumeBoost)) {
    renderBoost();
    return;
  }
  update({ volumeBoost: boost });
}

el.boostUp.addEventListener("click", () => setBoost(state.volumeBoost + YTS.BOOST.step));
el.boostDown.addEventListener("click", () => setBoost(state.volumeBoost - YTS.BOOST.step));
el.boostRange.addEventListener("input", () => setBoost(el.boostRange.value));
el.boostPresets.addEventListener("click", (e) => {
  const btn = e.target.closest("button[data-boost]");
  if (btn) setBoost(btn.dataset.boost);
});
el.boostToggle.addEventListener("change", () =>
  update({ boostEnabled: el.boostToggle.checked })
);

// ==================================================================
// Shorts
// ==================================================================
el.shortsToggle.addEventListener("change", () => update({ enabled: el.shortsToggle.checked }));
el.gameToggle.addEventListener("change", () => update({ gameEnabled: el.gameToggle.checked }));
el.mixToggle.addEventListener("change", () => update({ mixEnabled: el.mixToggle.checked }));
el.playerCardsToggle.addEventListener("change", () =>
  update({ playerCardsEnabled: el.playerCardsToggle.checked })
);

el.titleSpoofForm.addEventListener("submit", (e) => {
  e.preventDefault();
  update({
    titleSpoofText: el.titleSpoofInput.value,
    titleSpoofChannelName: el.titleSpoofChannelInput.value,
    titleSpoofIconUrl: el.titleSpoofIconInput.value,
  });
});

el.titleSpoofMetaForm.addEventListener("submit", (e) => {
  e.preventDefault();
  update({
    titleSpoofText: el.titleSpoofInput.value,
    titleSpoofChannelName: el.titleSpoofChannelInput.value,
    titleSpoofIconUrl: el.titleSpoofIconInput.value,
  });
});

// ==================================================================
// 回転 / ショートカット
// ==================================================================
el.rotationToggle.addEventListener("change", () =>
  update({ rotationEnabled: el.rotationToggle.checked })
);

el.langPresets.addEventListener("click", (e) => {
  const btn = e.target.closest("button[data-lang]");
  if (btn) update({ language: btn.dataset.lang });
});

el.rotationPresets.addEventListener("click", (e) => {
  const btn = e.target.closest("button[data-rot]");
  if (!btn) return;
  const step = Number(btn.dataset.rot);
  if (YTS.ROTATION_STEPS.includes(step)) update({ rotationStep: step });
});

el.keybindReset.addEventListener("click", () => {
  recordingAction = null;
  clearError(el.keybindError);
  update({ keybinds: YTS.sanitizeKeybinds(null) });
});

// ==================================================================
// キーワード
// ==================================================================
el.blockButtonToggle.addEventListener("change", () =>
  update({ blockButton: el.blockButtonToggle.checked })
);

el.keywordForm.addEventListener("submit", (e) => {
  e.preventDefault();
  clearError(el.keywordError);

  const value = YTS.normalizeKeywordInput(el.keywordInput.value);
  if (!value) {
    showError(el.keywordError, I18N.t("errKwEmpty"));
    return;
  }
  if (
    state.ytFilterKeywords.some(
      (k) => YTSShared.keywordIdentity(k) === YTSShared.keywordIdentity(value)
    )
  ) {
    showError(el.keywordError, I18N.t("errKwDup"));
    return;
  }
  el.keywordInput.value = "";
  update({ ytFilterKeywords: [...state.ytFilterKeywords, value] });
});

el.keywordToggle.addEventListener("change", () =>
  update({ keywordEnabled: el.keywordToggle.checked })
);

el.keywordReset.addEventListener("click", () => {
  if (!state.ytFilterKeywords.length) return;
  if (!window.confirm(I18N.t("kwClearConfirm"))) return;
  clearError(el.keywordError);
  update({ ytFilterKeywords: [] });
});

// ==================================================================
// 全初期化
// ==================================================================
el.resetAll.addEventListener("click", async () => {
  if (!window.confirm(I18N.t("resetConfirm"))) return;
  await update(JSON.parse(JSON.stringify(YTS.DEFAULTS)));
  el.resetDone.hidden = false;
  setTimeout(() => {
    el.resetDone.hidden = true;
  }, 2000);
});

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
