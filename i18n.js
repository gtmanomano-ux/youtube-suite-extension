/**
 * YouTube Suite - i18n.js
 * 日本語 / 英語の辞書と適用処理。popup・options・content で共有する。
 *
 *  language 設定: "auto" | "ja" | "en"
 *    auto … ブラウザの表示言語が日本語なら ja、それ以外は en
 */

"use strict";

const I18N = (() => {
  const DICT = {
    ja: {
      // ---- 共通 ----
      add: "追加",
      remove: "削除",
      change: "変更",
      cancel: "キャンセル",
      unset: "未設定",
      kindPartial: "部分一致",
      kindExact: "完全一致",
      countUnit: "{n}件",
      notRegistered: "未登録",
      errKwEmpty: "キーワードを入力してください。",
      errKwDup: "このキーワードはすでに追加されています。",

      // ---- ポップアップ ----
      pTabFilter: "フィルター",
      pTabFunc: "機能",
      pKeyword: "キーワード",
      pKwPlaceholder: 'ASMR / "チャンネル名"',
      pKwEmpty: "キーワードが登録されていません",
      pOptions: "詳細設定",
      pHelp: "ヘルプ",

      // ---- 機能名 (ポップアップ・オプション共通) ----
      fKeyword: "キーワードで非表示",
      fBlockButton: "チャンネル名の「×」ボタン",
      fShorts: "Shortsを非表示",
      fGame: "ゲームルームを非表示",
      fMix: "ミックスリストを非表示",
      fPlayerCards: "動画内カードを非表示",
      fSpeed: "再生速度の自動適用",
      fRotation: "動画の回転",
      fBoost: "音量ブースト",

      // ---- オプション ----
      optTitle: "YouTube Suite — オプション",
      optSubtitle: "設定はすべてのYouTubeタブへ即座に反映されます",
      tabKeyword: "キーワードフィルター",
      tabOther: "その他",
      tabHelp: "ヘルプ",

      kwSection: "キーワード",
      kwBlockButton: "チャンネル名の左に「×」ボタンを表示",
      kwBlockButtonDesc:
        'YouTube上のチャンネル名の先頭に小さな「×」が表示されます。押すと、そのチャンネル名が <b>完全一致キーワード</b> として下のリストに追加されます。',
      kwPlaceholder: '例: ASMR　または　"チャンネル名"',
      kwHint:
        '<b>ASMR</b> … 部分一致。【ASMR】やＡＳＭＲのように括弧・全角半角・大文字小文字が違っても消します。<br /><b>"チャンネル名"</b> … 完全一致。タイトルやチャンネル名がその文字列と丸ごと一致するものだけ消します。',
      kwEmpty: "キーワードが登録されていません",
      kwClear: "キーワードをすべて削除",
      kwClearConfirm: "登録済みのキーワードをすべて削除します。よろしいですか？",

      speedSection: "再生速度",
      speedToggle: "動画を開くたびに適用",
      speedDesc:
        "初期設定では、再生中に <kbd>Shift</kbd>+<kbd>Q</kbd> で 0.1 遅く、<kbd>Shift</kbd>+<kbd>E</kbd> で 0.1 速くなります。ショートカットで変更した速度もこの設定として保存され、次に開く動画に適用されます（0.1〜5.0）。",

      rotSection: "動画の回転",
      rotToggle: "回転ショートカットを有効にする",
      rotStep: "1回あたりの回転角度",
      rotDesc:
        "再生中にショートカットキーで回転します。回転した映像がプレーヤーからはみ出す場合は自動で縮小して収めます。回転は動画ごとにリセットされます。",

      keySection: "ショートカットキー",
      keyDesc:
        "「変更」を押してから使いたいキーの組み合わせを押してください（<kbd>Esc</kbd>で取り消し）。検索欄やコメント入力中はショートカットは動作しません。",
      keyReset: "ショートカットを初期設定に戻す",
      keyPress: "キーを押す…",
      keyDup: "「{name}」と重複しています（{key}）。",
      actSpeedDown: "再生速度を下げる",
      actSpeedUp: "再生速度を上げる",
      actRotateLeft: "動画を左に回転",
      actRotateRight: "動画を右に回転",
      actTitleSpoof: "タブとウィンドウ表示を偽装",

      boostSection: "音量ブースト",
      boostToggle: "YouTubeの最大音量を超えて増幅する",
      boostDesc:
        'OFFの間は音声にまったく手を加えません。ONにすると音量を最大5倍まで増幅します（歪み防止のリミッター付き）。<strong class="warn">大音量に注意。使い終わったらOFFに戻してください。</strong>',

      shortsSection: "Shortsブロック",
      shortsDesc:
        "ナビゲーション・シェルフ・カード・タブなどShorts関連をすべて非表示にします（/shorts/ を直接開いた場合は再生できます）。",
      mixSection: "ミックスリストブロック",
      mixDesc:
        "YouTubeが自動生成する「ミックス」（再生リストIDが RD で始まるもの）を非表示にします。ホーム・検索結果・関連動画のミックスカードが対象です。ミックスを再生中のページでは、再生リストを壊さないよう非表示を解除します。",
      gameSection: "ゲームルームブロック",
      gameDesc:
        "サイドバーの「ゲームルーム」、ホームや検索結果のゲームシェルフ・カード（Playables）を非表示にします。",
      playerCardsSection: "動画内カード",
      playerCardsToggle: "動画内に表示されるカードをすべて非表示",
      playerCardsDesc:
        "動画プレーヤー内の終了後おすすめ・次の動画・プレイリスト・チャンネル・関連動画カードと、再生中に表示されるカードを対象にします。ホーム画面や通常の関連動画欄のカードには影響しません。",
      titleSpoofSection: "タイトル表示の偽装",
      titleSpoofPlaceholder: "例: 作業用BGMを再生中",
      titleSpoofChannelPlaceholder: "偽装するチャンネル名（任意）",
      titleSpoofIconPlaceholder: "偽装するアイコン画像のURL（任意）",
      titleSpoofSave: "保存",
      titleSpoofDesc:
        "動画上で Shift+R を押すと偽装モードを切り替えます。偽装中は映像を黒くして音声だけを再生し、タイトル・チャンネル名・アイコンをここで指定した内容に置き換えます。開始時にはキーワードフィルターも自動的にONになります。",
      titleSpoofEmpty: "偽装する文字列を先に保存してください。",
      titleSpoofOn: "タイトル表示を偽装中",
      titleSpoofOff: "元のタイトルに戻しました",

      langSection: "言語 / Language",
      langDesc:
        "「自動」ではブラウザの表示言語が日本語のときは日本語、それ以外は英語になります。",
      langAuto: "自動",
      langJa: "日本語",
      langEn: "English",

      resetSection: "リセット",
      resetDesc:
        "すべての設定（キーワード・再生速度・回転・ショートカット・音量ブースト・タイトル表示偽装・各ブロック）を初期状態に戻します。",
      resetBtn: "すべての設定を初期化",
      resetConfirm: "すべての設定を初期状態に戻します。よろしいですか？",
      resetDone: "初期化しました",

      // ---- ヘルプ ----
      hKwTitle: "キーワードの2つの書き方",
      hKwExactSample: '"ぽこぴー"',
      hKwPartial:
        "<b>部分一致</b>：どこかに「ASMR」が含まれていれば非表示。<code>【ASMR】</code> <code>(asmr)</code> <code>ＡＳＭＲ</code> も同じ語として扱います（括弧・記号・全角半角・大文字小文字を無視）。",
      hKwExact:
        "<b>完全一致</b>：タイトルやチャンネル名がその文字列と<b>丸ごと一致</b>したときだけ非表示。部分的に含むだけでは消えません。",
      hKwNote:
        "入力欄では <code>「ぽこぴー」</code> のように鉤括弧で囲んでも完全一致として登録されます。リストには「部分一致」「完全一致」のタグが表示されます。",

      hBtnTitle: "チャンネルを「×」ボタンで登録する",
      hBtn1:
        'YouTube上のチャンネル名の先頭（1文字目の手前）に小さな「×」が表示されます。押すとそのチャンネル名が <code>"チャンネル名"</code> という<b>完全一致キーワード</b>としてリストに追加され、そのチャンネルの動画がすぐに消えます。',
      hBtn2:
        "ホーム・検索結果・関連動画・動画ページの投稿者欄など、チャンネル名が出る場所すべてに付きます。",
      hBtn3:
        "完全一致なので、名前の一部が同じだけの別チャンネルは消えません。ただし<b>まったく同じ表示名</b>の別チャンネルがある場合は一緒に消えます。",
      hBtn4:
        "間違えて追加した場合は「キーワードフィルター」タブのリストから「×」で削除できます。",
      hBtn5:
        "ボタンが邪魔な場合は同タブの<b>「チャンネル名の左に『×』ボタンを表示」</b>をOFFにしてください。",

      hKeyTitle: "キーボードショートカット",
      hKeySpeedUp: "再生速度を 0.1 上げる",
      hKeySpeedDown: "再生速度を 0.1 下げる",
      hKeyRotRight: "動画を右に回転",
      hKeyRotLeft: "動画を左に回転",
      hKeyTitleSpoof: "タブとウィンドウのタイトル表示を偽装",
      hKeyNote:
        "上記は初期設定で、「その他」タブの<b>ショートカットキー</b>から自由に変更できます。変更した速度・角度は画面上部に一瞬表示されます。速度はそのまま設定として保存されます。検索欄やコメント入力中は誤操作を防ぐため無効になります。",
      hKeyWarn:
        '<strong class="warn">注意：</strong>ブラウザ自体が使っているショートカット（Vivaldiの <kbd>Ctrl</kbd>+<kbd>Q</kbd>、<kbd>Alt</kbd> 単独のメニュー呼び出しなど）は、拡張機能側では受け取れないことがあります。反応しない場合は別のキーに変更してください。',

      hRotTitle: "動画の回転について",
      hRot1: "1回あたりの角度は <b>1° / 45° / 90° / 180°</b> から選べます（既定は90°）。",
      hRot2:
        "回転して映像がプレーヤーからはみ出す場合は、収まるように自動で縮小します（拡大はしません）。",
      hRot3:
        "ウィンドウサイズ変更・全画面切り替え・画質変更などで表示サイズが変わったときは、縮小率を再計算します。",
      hRot4:
        "「その他」タブのトグルでOFFにすると、回転ショートカットは無効になり（キー操作はYouTube本来の動作にそのまま渡されます）、回転中の映像も元に戻ります。",
      hRot5:
        "回転状態は動画を切り替えるとリセットされます。元に戻したいときは反対方向に同じ回数押すか、動画を開き直してください。",

      hSpeedTitle: "再生速度について",
      hSpeedDesc:
        "YouTubeは動画を読み込むたびに速度を1.0xへ戻すため、本拡張は読み込みのたびに設定値を再適用します。プレーヤーの設定メニューから手動で速度を変えた場合はその動画に対してだけ有効で、次の動画では設定値に戻ります。",

      hBoostTitle: "音量ブーストについて",
      hBoost1: "OFFの間は音声経路に一切手を加えないため、音質・音量は通常のままです。",
      hBoost2:
        "ONにした瞬間から音声をWeb Audioで増幅します。歪みを抑えるリミッターを通しています。",
      hBoost3:
        "効果があるのはそのタブの音声だけです。元の音量が極端に小さい動画向けの機能です。",
      hBoost4:
        "ONにしても音が変わらない場合は、動画をクリックしてから再度お試しください（ブラウザの自動再生制限のため、最初の操作までブーストが開始できないことがあります）。",

      hHideTitle: "非表示機能について",
      hHide1:
        "<b>Shorts</b>：サイドバー・タブ・シェルフ・カードなどShorts関連の表示を消します。/shorts/ のURLを直接開いた場合は再生できます。",
      hHideMix:
        "<b>ミックスリスト</b>：YouTubeが自動生成する「ミックス」を消します。判定は再生リストIDが <code>RD</code> で始まることを手がかりにしています。自分でミックスを開いた場合は、そのページでは非表示になりません。",
      hHide2:
        "<b>ゲームルーム</b>：サイドバーの「ゲームルーム」、ホーム・検索結果のゲームシェルフやカード（Playables）を消します。<code>/playables</code> を直接開いた場合はそのまま遊べます。表記が「Playables」「プレイアブル」でも判定します。",
      hHide3:
        '<b>キーワード</b>：タイトル・チャンネル名・説明などのテキストで判定します。チャンネル単位のブロックもキーワードフィルターに統合され、<code>"チャンネル名"</code>（完全一致）で登録します。',

      hTroubleTitle: "うまく動かないとき",
      hTrouble1: "設定を変えても反映されない → YouTubeのタブを再読み込みしてください。",
      hTrouble2:
        "旧バージョンの「YouTube キーワードフィルター」「YouTube Shorts &amp; Channel Blocker」を入れたままだと二重にDOM操作されます。無効化または削除してください。",
      hTrouble3:
        "必要以上に動画が消える → キーワードが短すぎる可能性があります（例：「AS」）。より具体的な語にしてください。",
      hTrouble4:
        "一部のカードに「×」が出ない → YouTube側のHTML構造が変わった可能性があります。YouTubeのページでF12を押し、コンソールに <code>localStorage.ytsDebug='1'</code> を入力して再読み込みすると、検出できなかったカードの構造がコンソールに出力されます（<code>localStorage.removeItem('ytsDebug')</code> で解除）。",

      hPrivacyTitle: "プライバシー",
      hPrivacyDesc:
        "通信は行いません。設定は <code>chrome.storage.sync</code> にのみ保存され、閲覧履歴などの収集・送信は一切ありません。",

      // ---- content script ----
      blockBtnTitle: "「{name}」を完全一致キーワードとして追加",
    },

    en: {
      // ---- common ----
      add: "Add",
      remove: "Remove",
      change: "Edit",
      cancel: "Cancel",
      unset: "Not set",
      kindPartial: "Partial",
      kindExact: "Exact",
      countUnit: "{n}",
      notRegistered: "None",
      errKwEmpty: "Please enter a keyword.",
      errKwDup: "That keyword is already in the list.",

      // ---- popup ----
      pTabFilter: "Filter",
      pTabFunc: "Features",
      pKeyword: "Keywords",
      pKwPlaceholder: 'ASMR / "Channel name"',
      pKwEmpty: "No keywords registered",
      pOptions: "Settings",
      pHelp: "Help",

      // ---- feature names ----
      fKeyword: "Hide by keyword",
      fBlockButton: '"×" button on channel names',
      fShorts: "Hide Shorts",
      fGame: "Hide Playables",
      fMix: "Hide Mix playlists",
      fPlayerCards: "Hide in-player cards",
      fSpeed: "Auto-apply playback speed",
      fRotation: "Video rotation",
      fBoost: "Volume boost",

      // ---- options ----
      optTitle: "YouTube Suite — Options",
      optSubtitle: "Changes apply instantly to every open YouTube tab",
      tabKeyword: "Keyword filter",
      tabOther: "Other",
      tabHelp: "Help",

      kwSection: "Keywords",
      kwBlockButton: 'Show a "×" button before channel names',
      kwBlockButtonDesc:
        'A small "×" appears in front of channel names on YouTube. Clicking it adds that channel name to the list below as an <b>exact-match keyword</b>.',
      kwPlaceholder: 'e.g. ASMR  or  "Channel name"',
      kwHint:
        '<b>ASMR</b> — partial match. Brackets, full-width characters and letter case are ignored, so 【ASMR】 and ＡＳＭＲ also match.<br /><b>"Channel name"</b> — exact match. Only hides items whose title or channel name is exactly that string.',
      kwEmpty: "No keywords registered",
      kwClear: "Remove all keywords",
      kwClearConfirm: "Remove every registered keyword. Are you sure?",

      speedSection: "Playback speed",
      speedToggle: "Apply every time a video opens",
      speedDesc:
        "By default, press <kbd>Shift</kbd>+<kbd>Q</kbd> while watching to slow down by 0.1 and <kbd>Shift</kbd>+<kbd>E</kbd> to speed up by 0.1. Speeds set with the shortcut are saved here too and applied to the next video you open (0.1–5.0).",

      rotSection: "Video rotation",
      rotToggle: "Enable rotation shortcuts",
      rotStep: "Degrees per press",
      rotDesc:
        "Rotate the video with a shortcut key while watching. If the rotated video overflows the player, it is scaled down to fit. Rotation resets for each new video.",

      keySection: "Keyboard shortcuts",
      keyDesc:
        'Click "Edit", then press the key combination you want (<kbd>Esc</kbd> to cancel). Shortcuts are disabled while typing in the search box or a comment field.',
      keyReset: "Restore default shortcuts",
      keyPress: "Press a key…",
      keyDup: 'Already used by "{name}" ({key}).',
      actSpeedDown: "Decrease playback speed",
      actSpeedUp: "Increase playback speed",
      actRotateLeft: "Rotate video left",
      actRotateRight: "Rotate video right",
      actTitleSpoof: "Spoof tab and window title",

      boostSection: "Volume boost",
      boostToggle: "Amplify beyond YouTube's maximum volume",
      boostDesc:
        'While OFF, the audio is left completely untouched. While ON, the volume is amplified up to 5× (with a limiter to prevent distortion). <strong class="warn">Watch your ears — turn it back OFF when you are done.</strong>',

      shortsSection: "Shorts blocking",
      shortsDesc:
        "Hides every Shorts-related element: navigation entries, shelves, cards and tabs. Opening a /shorts/ URL directly still plays normally.",
      mixSection: "Mix playlist blocking",
      mixDesc:
        "Hides the Mix playlists YouTube generates automatically (their playlist ID starts with RD) on the home page, in search results and in related videos. While you are watching a Mix, the blocking is switched off so the playlist keeps working.",
      gameSection: "Playables blocking",
      gameDesc:
        'Hides the "Playables" entry in the sidebar and the game shelves and cards on the home page and search results.',
      playerCardsSection: "In-player cards",
      playerCardsToggle: "Hide all cards shown inside the video",
      playerCardsDesc:
        "Targets end-of-video recommendations, up-next, playlist and channel cards, related video cards, and cards shown during playback. Home and normal related-video list cards are not affected.",
      titleSpoofSection: "Title display spoofing",
      titleSpoofPlaceholder: "e.g. Playing background music",
      titleSpoofChannelPlaceholder: "Spoof channel name (optional)",
      titleSpoofIconPlaceholder: "Spoof icon image URL (optional)",
      titleSpoofSave: "Save",
      titleSpoofDesc:
        "Press Shift+R on the video to toggle spoof mode. While active, the picture is black while audio continues, and the title, channel name and icon are replaced with the values entered here. The keyword filter is also turned ON automatically when the mode starts.",
      titleSpoofEmpty: "Save a spoof title first.",
      titleSpoofOn: "Title display spoofing is ON",
      titleSpoofOff: "Restored the original title",

      langSection: "Language / 言語",
      langDesc:
        'With "Auto", the UI is Japanese when your browser language is Japanese, and English otherwise.',
      langAuto: "Auto",
      langJa: "日本語",
      langEn: "English",

      resetSection: "Reset",
      resetDesc:
        "Restore every setting (keywords, playback speed, rotation, shortcuts, volume boost, title spoofing and all blocking options) to its default.",
      resetBtn: "Reset all settings",
      resetConfirm: "Restore all settings to their defaults. Are you sure?",
      resetDone: "Settings were reset",

      // ---- help ----
      hKwTitle: "Two ways to write a keyword",
      hKwExactSample: '"Channel name"',
      hKwPartial:
        "<b>Partial match</b>: hides anything containing “ASMR” anywhere. <code>【ASMR】</code>, <code>(asmr)</code> and <code>ＡＳＭＲ</code> all count as the same word (brackets, symbols, full-width characters and letter case are ignored).",
      hKwExact:
        "<b>Exact match</b>: wrap the text in double quotes to hide an item only when its title or channel name is <b>exactly</b> that string. Merely containing the text is not enough — this is how you block a whole channel.",
      hKwNote:
        "Japanese-style quotes (<code>「…」</code>) are accepted in the input field as well and are stored as an exact match. Each entry in the list is tagged “Partial” or “Exact”.",

      hBtnTitle: 'Adding channels with the "×" button',
      hBtn1:
        'A small "×" appears in front of channel names on YouTube. Clicking it adds that name as an <b>exact-match keyword</b> (<code>"Channel name"</code>), and videos from that channel disappear immediately.',
      hBtn2:
        "It appears everywhere a channel name is shown: the home page, search results, related videos and the uploader row on the watch page.",
      hBtn3:
        "Because it is an exact match, other channels that merely share part of the name are not affected. Channels with <b>exactly the same display name</b> will be hidden too.",
      hBtn4:
        'If you add one by mistake, remove it with the "×" in the list on the "Keyword filter" tab.',
      hBtn5:
        'If the buttons get in the way, turn off <b>Show a "×" button before channel names</b> on the same tab.',

      hKeyTitle: "Keyboard shortcuts",
      hKeySpeedUp: "Increase playback speed by 0.1",
      hKeySpeedDown: "Decrease playback speed by 0.1",
      hKeyRotRight: "Rotate the video right",
      hKeyRotLeft: "Rotate the video left",
      hKeyTitleSpoof: "Spoof the tab and window title",
      hKeyNote:
        'These are the defaults; change them freely under <b>Keyboard shortcuts</b> on the "Other" tab. The new speed or angle flashes briefly at the top of the screen, and the speed is saved as your setting. Shortcuts are disabled while typing in the search box or a comment field.',
      hKeyWarn:
        '<strong class="warn">Note:</strong> shortcuts claimed by the browser itself (such as Vivaldi\'s <kbd>Ctrl</kbd>+<kbd>Q</kbd>, or <kbd>Alt</kbd> opening the menu) may never reach the extension. Assign a different key if one does not respond.',

      hRotTitle: "About video rotation",
      hRot1: "Choose <b>1° / 45° / 90° / 180°</b> per press (90° by default).",
      hRot2:
        "If the rotated video would overflow the player, it is scaled down to fit (it is never scaled up).",
      hRot3:
        "The scale is recalculated whenever the display size changes — resizing the window, entering full screen, switching quality and so on.",
      hRot4:
        'Turning the toggle off on the "Other" tab disables the rotation shortcuts (those keys are passed through to YouTube) and restores any rotated video.',
      hRot5:
        "Rotation resets when you switch videos. To undo it, press the opposite direction the same number of times or reopen the video.",

      hSpeedTitle: "About playback speed",
      hSpeedDesc:
        "YouTube resets the speed to 1.0x every time it loads a video, so this extension reapplies your setting on each load. Changing the speed from the player's own settings menu affects only that video; the next video goes back to your setting.",

      hBoostTitle: "About volume boost",
      hBoost1:
        "While OFF, the audio path is not touched at all, so quality and volume stay exactly as normal.",
      hBoost2:
        "The moment you turn it ON, the audio is amplified through the Web Audio API, passing through a limiter that suppresses distortion.",
      hBoost3:
        "Only the audio of that tab is affected. It is meant for videos whose original volume is far too low.",
      hBoost4:
        "If nothing changes after turning it ON, click the video once and try again — because of the browser's autoplay policy, the boost cannot start before your first interaction.",

      hHideTitle: "About the hiding features",
      hHide1:
        "<b>Shorts</b>: removes Shorts-related sidebar entries, tabs, shelves and cards. Opening a /shorts/ URL directly still plays.",
      hHideMix:
        '<b>Mix playlists</b>: hides the Mixes YouTube generates automatically, detected by their playlist ID starting with <code>RD</code>. If you open a Mix yourself, it is left alone on that page.',
      hHide2:
        '<b>Playables</b>: removes the "Playables" sidebar entry and the game shelves and cards on the home page and search results. Opening <code>/playables</code> directly still works. Japanese labels (ゲームルーム / プレイアブル) are recognised as well.',
      hHide3:
        '<b>Keywords</b>: matched against the title, channel name, description and other text. Per-channel blocking is part of this filter — register a channel as <code>"Channel name"</code> (exact match).',

      hTroubleTitle: "Troubleshooting",
      hTrouble1: "Settings do not take effect → reload the YouTube tab.",
      hTrouble2:
        'If the older "YouTube キーワードフィルター" / "YouTube Shorts &amp; Channel Blocker" extensions are still installed, the page is modified twice. Disable or remove them.',
      hTrouble3:
        "Too many videos disappear → your keyword may be too short (e.g. “AS”). Use a more specific word.",
      hTrouble4:
        'The "×" is missing on some cards → YouTube may have changed its HTML. On a YouTube page press F12, enter <code>localStorage.ytsDebug=\'1\'</code> in the console and reload; the structure of any card that could not be handled is printed to the console (<code>localStorage.removeItem(\'ytsDebug\')</code> to stop).',

      hPrivacyTitle: "Privacy",
      hPrivacyDesc:
        "This extension makes no network requests. Settings are stored only in <code>chrome.storage.sync</code>; nothing about your browsing is collected or transmitted.",

      // ---- content script ----
      blockBtnTitle: 'Add "{name}" as an exact-match keyword',
    },
  };

  let lang = "ja";

  /** ブラウザの表示言語から言語を決める */
  function detect() {
    let ui = "";
    try {
      if (typeof chrome !== "undefined" && chrome.i18n && chrome.i18n.getUILanguage) {
        ui = chrome.i18n.getUILanguage();
      }
    } catch (_) {}
    if (!ui && typeof navigator !== "undefined") ui = navigator.language || "";
    return /^ja/i.test(ui) ? "ja" : "en";
  }

  /** setting ("auto" | "ja" | "en") を実際の言語に解決して保持する */
  function setLanguage(setting) {
    lang = setting === "ja" || setting === "en" ? setting : detect();
    return lang;
  }

  const current = () => lang;

  /** 訳文を返す。{name} などのプレースホルダーを params で置換する */
  function t(key, params) {
    const table = DICT[lang] || DICT.ja;
    let s = table[key];
    if (s === undefined) s = DICT.ja[key];
    if (s === undefined) return key;
    if (params) {
      Object.keys(params).forEach((k) => {
        s = s.split("{" + k + "}").join(params[k]);
      });
    }
    return s;
  }

  /**
   * data-i18n 属性を持つ要素へ訳文を流し込む。
   *   data-i18n           … textContent
   *   data-i18n-html      … innerHTML (タグを含む文言)
   *   data-i18n-placeholder / -title / -empty … 各属性
   */
  function apply(root = document) {
    root.querySelectorAll("[data-i18n]").forEach((el) => {
      el.textContent = t(el.dataset.i18n);
    });
    root.querySelectorAll("[data-i18n-html]").forEach((el) => {
      el.innerHTML = t(el.dataset.i18nHtml);
    });
    root.querySelectorAll("[data-i18n-placeholder]").forEach((el) => {
      el.setAttribute("placeholder", t(el.dataset.i18nPlaceholder));
    });
    root.querySelectorAll("[data-i18n-title]").forEach((el) => {
      el.setAttribute("title", t(el.dataset.i18nTitle));
    });
    root.querySelectorAll("[data-i18n-empty]").forEach((el) => {
      el.setAttribute("data-empty", t(el.dataset.i18nEmpty));
    });
    const title = root.querySelector("title[data-i18n-doc]");
    if (title) document.title = t(title.dataset.i18nDoc);
    document.documentElement.lang = lang;
  }

  return { t, apply, setLanguage, current, detect };
})();
