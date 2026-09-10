# 第3B-2 検証記録

実施日：2026-09-10。基準タグ：`stage3b1-complete`。写真取り込みの実装を行い、git commit／pushは実行していません。

## 結果

| 項目 | 結果 |
| --- | --- |
| 自動テスト | **290件成功：既存257件を変更せず維持＋新規33件**、9ファイル |
| TypeScript・本番 | `tsc -b && vite build`成功 |
| PWA | manifest、Service Worker生成。`/meal-log/`・設定・workflow変更なし |
| precache | **37エントリー、32実ファイル、21,011,898 bytes（約20.038MiB）**。第3B-1の21,002,590 bytesから9,308 bytes増加 |
| データ不変 | 21外食JSONとMEXT JSONを基準タグとバイト比較・SHA-256確認。22ファイル一致。出典ファイル・DB定義・PWA設定・workflowもGitの改行フィルターを考慮して一致 |
| 写真ブラウザー検証 | 入口、手順、プロンプトコピー成功／拒否時の手動コピー、clipboard読取成功／拒否、手動貼付、注意、notes、confidence、編集、登録、Home、History、詳細に成功 |
| 写真の値と出典 | 数量1の皿全体、数量5×1個値、複数品合計、null補完前の拒否、元値保持、official申告とestimateの区別を確認 |
| コピー | 前日コピーでinputType・notes・元snapshot・登録前修正フラグを保持し、group ID更新と既存の二重コピー防止を確認 |
| 既存テキスト | 第3B-1専用ブラウザー検証をそのまま完走。旧形式、通常JSON、clipboard fallback、fragment、編集、Home/History、オフライン成功 |
| サイズ・表示 | ChromeのiPhone相当390×844、320×440、ライト／ダーク。手動コピー欄・確認画面・登録までスクロール可能、横スクロールなし。スクリーンショット目視確認済み |
| オフライン | 専用プロファイルを終了→オフライン再起動し、既存記録読込、photo JSONの手動貼付／clipboard登録、再読込成功 |
| v1→v3 | 実ブラウザーIndexedDBに置いた旧食事・体重・設定を保持 |
| v2→v3 | 6テーブルの旧記録の全フィールドを比較し保持 |
| v3維持 | 6テーブルと外食snapshotを保持。第3B-1形式のinputTypeなしChatGPT記録も再起動後まで全フィールド保持 |
| 第1・第2段階回帰 | 手入力・編集・削除、体重、設定、小数表示、MEXT検索・重量計算、レシピ、複製、今回だけ変更、お気に入り、セット、コピー、かんたん入力成功 |
| 外食回帰 | KFC／CoCo壱／びっくりドンキーの検索→variant→出典→カート→数量→登録→Home→History、21チェーンのオフライン検索成功 |
| 画像・安全性 | file input・画像アップロード・AIモデル・写真tableなし。未知画像フィールドを正規化／保存から除外し、文字列欄の画像data URLを拒否。HTMLはテキスト表示、HTTPSリンク検証と入力上限を維持 |
| エラー・外部通信 | 完走した全ブラウザー検証でconsole/page errorなし。新機能からの自動外部リクエストなし |

IndexedDBは**v3のまま**です。型の任意項目`chatgptSnapshot.inputType`と`MealEntry.chatgptModifiedBeforeSave`を追加しただけで、table/index/migrationの変更・データ消去はありません。画像そのものは保存しません。

写真ブラウザー検証の初回で、手動コピー用textareaのアクセシブル名に本文まで含まれる問題を検出しました。明示的なaria-labelを付けて修正し、コピー拒否時のfallbackを含めて再実行・成功しています。

## 再実行

```sh
pnpm test
pnpm run build
pnpm exec vite preview --host 127.0.0.1 --port 4175 --strictPort
```

別ターミナルで、既存の検証用PlaywrightとChromeを使用します（アプリの依存には追加していません）。

```powershell
$env:APP_URL = 'http://127.0.0.1:4175/meal-log/'
# 必要な環境だけ設定：$env:PLAYWRIGHT_MODULE = 'インストール済みplaywrightの絶対パス'
node scripts/browser-stage3b2.cjs
node scripts/browser-stage3b1.cjs
node scripts/browser-check.cjs
node scripts/browser-stage2.cjs
node scripts/browser-stage3.cjs
node scripts/browser-stage3a3.cjs
```

レポート、隔離したプロファイル、画面画像はGit対象外の`test-results/`に出力します。ユーザーの実機Safari／PWAのDBはテストで開きません。外食データとprecacheの監査は`python scripts/restaurants/audit-stage3a3.py`。

プロンプト変更時は`src/prompts/chatgpt-photo.txt`を編集し、`node scripts/sync-photo-prompt.cjs`を実行してください。アプリ内コピーとdocs本文の一致を自動テストします。

## iPhone実機で確認すること

今回はChromeの端末相当表示で検証しており、第3B-2の実機・実写真・ChatGPTアプリ操作は未確認です。既にユーザーが確認済みの第3B-1実機結果に従い、正式ルートはクリップボード方式です。

1. 公開後、普段のホーム画面PWAを更新し、従来の食事・体重・設定・レシピ・お気に入り・セット・外食履歴を確認。
2. ＋ → 写真からChatGPT取り込み → 写真解析プロンプトをコピー。コピー拒否時には表示欄から手動コピーできることを確認。
3. ChatGPTアプリへ手動で切り替え、食事写真を添付しプロンプトを貼付。「ご飯200g」「半分だけ食べた」等を補足してJSONを生成。
4. 回答JSONをコピーし、**普段のホーム画面PWA**へ戻って結果を読み込む。URLからSafariを開くルートは使わない。
5. 写真推定の注意、数量1と単位、1皿分の栄養、notes、confidence、official申告との区別を確認。数量が合計値に二重計上されていないかを確認。
6. 数値を編集して登録し、Home・History・詳細で元snapshotと「登録前にユーザー修正あり」を確認。
7. 複数料理、null入力の補完前の登録拒否、前日コピーを確認。
8. キーボード表示時のスクロール、セーフエリア、ライト／ダーク表示を確認。
9. 機内モードでPWA終了→再起動。取得済みJSONを手動貼付／clipboardから登録でき、既存記録も残ることを確認。
10. テキスト版Ask ChatGPTの従来ショートカット→JSONコピー→「ChatGPTから取り込み」も確認。

写真の解析品質はChatGPTと写真・補足の内容に依存します。自動テストの値は合成した試験データで、実際の食事写真の栄養精度を証明するものではありません。ショートカットの「Appを開く」にChatGPTが出るかも実機で確認し、出ない場合は手動で開いてください。
