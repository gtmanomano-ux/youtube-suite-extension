## 個人用に作ったものを配布～！Opus5で作成しましたよん。

# YouTube Suite

A Chrome/Vivaldi extension that bundles keyword filtering, Shorts & Playables blocking, per-video playback speed, video rotation and volume boost into one place.

**[English](#english) | [日本語](#日本語)**

---

## English

### Features

#### Keyword filter
Hide videos whose text matches your keywords. Two forms:

| Keyword | Behaviour |
|---|---|
| `ASMR` | **Partial match.** Brackets, symbols, full-width characters and letter case are ignored, so `【ASMR】`, `(asmr)` and `ＡＳＭＲ` all match. |
| `"Channel name"` | **Exact match.** Hides an item only when its title or channel name is exactly that string — this is how you block a whole channel. |

A small **`×` button** is shown in front of every channel name on YouTube. Clicking it adds that channel as an exact-match keyword, so blocking a channel takes one click. It works on the home page, search results, related videos and the watch page's uploader row — including the newer `yt-lockup-view-model` layout where channel names are not links.

#### Shorts / Playables blocking
Removes Shorts and Playables navigation entries, tabs, shelves and cards. Opening a `/shorts/` or `/playables` URL directly still works, so you can watch or play on purpose.

#### Playback speed
Reapplies your chosen speed every time a video loads (YouTube resets it to 1.0x on each load). Adjust with a shortcut while watching; the new value is saved and used for the next video too. Range 0.1–5.0.

#### Video rotation
Rotate the video left/right with a shortcut, by **1° / 45° / 90° / 180°** per press. If the rotated video would overflow the player it is scaled down to fit (never scaled up), and the scale is recalculated on window resize, full screen and quality changes. Rotation resets per video.

#### Volume boost
Amplifies the tab's audio up to **5×** using the Web Audio API, with a limiter to suppress clipping. While OFF the audio path is left completely untouched, so quality and volume stay exactly as normal.

#### Keyboard shortcuts

| Default | Action |
|---|---|
| <kbd>Shift</kbd>+<kbd>Q</kbd> | Decrease playback speed by 0.1 |
| <kbd>Shift</kbd>+<kbd>E</kbd> | Increase playback speed by 0.1 |
| <kbd>Shift</kbd>+<kbd>A</kbd> | Rotate video left |
| <kbd>Shift</kbd>+<kbd>D</kbd> | Rotate video right |

All four are freely reassignable from the options page (press "Edit", then the key combination). Duplicate assignments are rejected, and shortcuts are disabled while typing in the search box or a comment field.

#### Language
The UI follows your browser language automatically (Japanese for `ja`, English otherwise) and can be fixed to either language from the options page.

### Install

1. Download or clone this repository.
2. Open `chrome://extensions` (or `vivaldi://extensions`) and turn on **Developer mode**.
3. Choose **Load unpacked** and select the repository folder.

Open the options page from the extension's right-click menu → **Options**, or from the popup's **Settings** button.

### Permissions

| Permission | Why |
|---|---|
| `storage` | Saves your settings via `chrome.storage.sync`. |
| `*://www.youtube.com/*`, `*://m.youtube.com/*` | The content script only runs on YouTube. |

No background service worker, no network requests, no analytics. Nothing about your browsing is collected or transmitted.

### Files

| File | Role |
|---|---|
| `content.js` | Everything that runs on YouTube: filtering, blocking, speed, rotation, volume boost, shortcuts. |
| `content.css` | Hidden-card rule, the `×` button and the on-screen toast. |
| `i18n.js` | Japanese/English dictionary and the translation helper. |
| `settings.js` | Shared settings access, validation and keybind helpers for the popup and options page. |
| `popup.html` / `popup.js` / `popup.css` | Toolbar popup (Filter / Features tabs). |
| `options.html` / `options.js` / `options.css` | Full settings and help. |
| `ui.css` | Styles shared by the popup and options page. |

### Troubleshooting

- **Settings do not take effect** — reload the YouTube tab.
- **The `×` is missing on some cards** — YouTube may have changed its HTML. On a YouTube page press <kbd>F12</kbd>, run `localStorage.ytsDebug='1'` in the console and reload; the structure of any card that could not be handled is printed to the console. Turn it off with `localStorage.removeItem('ytsDebug')`.
- **A shortcut does nothing** — the browser itself may be claiming that combination (for example Vivaldi's <kbd>Ctrl</kbd>+<kbd>Q</kbd>). Assign a different key.
- **Volume boost seems inactive** — click the video once and try again; the browser's autoplay policy prevents the audio context from starting before your first interaction.

### License

[MIT](LICENSE)

---

## 日本語

キーワードフィルター、Shorts・ゲームルームの非表示、再生速度の自動適用、動画の回転、音量ブーストを1つにまとめた Chrome / Vivaldi 用の拡張機能です。

### 機能

#### キーワードフィルター
登録した語に一致する動画を非表示にします。書き方は2種類あります。

| キーワード | 動作 |
|---|---|
| `ASMR` | **部分一致**。括弧・記号・全角半角・大文字小文字を無視するので、`【ASMR】` `(asmr)` `ＡＳＭＲ` もすべて一致します。 |
| `"チャンネル名"` | **完全一致**。タイトルやチャンネル名がその文字列と丸ごと一致したときだけ非表示にします。チャンネル単位のブロックはこの形式で行います。 |

YouTube上のチャンネル名の先頭には小さな **「×」ボタン** が表示され、押すとそのチャンネル名が完全一致キーワードとして登録されます。ホーム・検索結果・関連動画・動画ページの投稿者欄など、チャンネル名が出るすべての場所に対応しており、チャンネル名がリンクになっていない新UI（`yt-lockup-view-model`）でも動作します。

#### Shorts / ゲームルームの非表示
Shorts とゲームルーム（Playables）のナビゲーション項目・タブ・シェルフ・カードを非表示にします。`/shorts/` や `/playables` のURLを直接開いた場合は通常どおり再生・プレイできます。

#### 再生速度
YouTube は動画を読み込むたびに速度を 1.0x へ戻すため、読み込みのたびに設定値を再適用します。再生中にショートカットで変更した値も保存され、次に開く動画へ引き継がれます（0.1〜5.0）。

#### 動画の回転
ショートカットで動画を左右に回転します。1回あたりの角度は **1° / 45° / 90° / 180°** から選択できます。回転した映像がプレーヤーからはみ出す場合は収まるように自動で縮小し（拡大はしません）、ウィンドウサイズ変更・全画面切り替え・画質変更のときに縮小率を再計算します。回転は動画ごとにリセットされます。

#### 音量ブースト
Web Audio API を使い、そのタブの音声を最大 **5倍** まで増幅します。歪みを抑えるリミッターを通しています。OFF の間は音声経路に一切手を加えないため、音質・音量は通常のままです。

#### ショートカットキー

| 初期設定 | 動作 |
|---|---|
| <kbd>Shift</kbd>+<kbd>Q</kbd> | 再生速度を 0.1 下げる |
| <kbd>Shift</kbd>+<kbd>E</kbd> | 再生速度を 0.1 上げる |
| <kbd>Shift</kbd>+<kbd>A</kbd> | 動画を左に回転 |
| <kbd>Shift</kbd>+<kbd>D</kbd> | 動画を右に回転 |

4つともオプションページから自由に変更できます（「変更」を押してから使いたいキーの組み合わせを押す）。他の操作と重複する割り当ては弾かれ、検索欄やコメント入力中はショートカットが無効になります。

#### 言語
ブラウザの表示言語に応じて日本語／英語が自動で切り替わります（`ja` なら日本語、それ以外は英語）。オプションページからどちらかに固定することもできます。

### インストール

1. このリポジトリをダウンロードまたはクローンします。
2. `chrome://extensions`（Vivaldi は `vivaldi://extensions`）を開き、**デベロッパーモード**をONにします。
3. 「**パッケージ化されていない拡張機能を読み込む**」でリポジトリのフォルダを選択します。

オプションページは、拡張機能アイコンの右クリックメニュー →「**オプション**」、またはポップアップの「**詳細設定**」ボタンから開けます。

### 権限

| 権限 | 用途 |
|---|---|
| `storage` | 設定を `chrome.storage.sync` に保存するため。 |
| `*://www.youtube.com/*`, `*://m.youtube.com/*` | コンテンツスクリプトを YouTube 上でのみ動作させるため。 |

バックグラウンドで常駐する処理はなく、通信も解析も行いません。閲覧履歴などの収集・送信は一切ありません。

### ファイル構成

| ファイル | 役割 |
|---|---|
| `content.js` | YouTube上で動作する処理全般（フィルター・ブロック・速度・回転・音量ブースト・ショートカット）。 |
| `content.css` | 非表示用のルール、「×」ボタン、画面上のトースト表示。 |
| `i18n.js` | 日本語／英語の辞書と適用処理。 |
| `settings.js` | ポップアップとオプションで共有する設定アクセス・検証・キーバインド処理。 |
| `popup.html` / `popup.js` / `popup.css` | ツールバーのポップアップ（フィルター／機能タブ）。 |
| `options.html` / `options.js` / `options.css` | 全設定とヘルプ。 |
| `ui.css` | ポップアップとオプションで共通のスタイル。 |

### うまく動かないとき

- **設定を変えても反映されない** — YouTube のタブを再読み込みしてください。
- **一部のカードに「×」が出ない** — YouTube側のHTML構造が変わった可能性があります。YouTubeのページで <kbd>F12</kbd> を押し、コンソールで `localStorage.ytsDebug='1'` を実行して再読み込みすると、検出できなかったカードの構造が出力されます。解除は `localStorage.removeItem('ytsDebug')` です。
- **ショートカットが反応しない** — ブラウザ自体がそのキーを使っている可能性があります（Vivaldi の <kbd>Ctrl</kbd>+<kbd>Q</kbd> など）。別のキーに変更してください。
- **音量ブーストが効かない** — 動画を一度クリックしてからお試しください。ブラウザの自動再生制限により、最初の操作までオーディオコンテキストを開始できないことがあります。

### ライセンス

[MIT](LICENSE)
