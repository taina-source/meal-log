# 第3B-1 検証記録

実施日：2026-09-10。ブラウザーは隔離したChromeプロファイルによるiPhone相当表示です。ユーザーの実機Safariや本番IndexedDBを開いたり、削除したりしていません。

## 公開後のiPhone実機結果（ユーザー確認済み）

テキスト版Ask ChatGPT→JSON生成・コピー→普段のホーム画面Meal Log→クリップボード読込→確認→登録→Home/Historyは正常でした。fragment URLはSafariを開き、ホーム画面PWAとIndexedDB／履歴が共有されませんでした。「Appを開く」でPWAのMeal Logも選択できませんでした。

したがってiPhoneの正式運用は**クリップボード方式**です。URL fragmentはPC等の互換／実験的ルートとして保持し、この実機でのPWA起動には推奨しません。`stage3b1-complete`時点の機能・データを保持して第3B-2へ進みます。以下の開発時検証は当時の記録です。

## 実行結果

| 検証 | 結果 |
| --- | --- |
| Vitest | 既存199 + 新規58 = **257件成功** |
| TypeScript | `tsc -b`成功 |
| 本番 | `vite build`成功、manifest / Service Worker生成。37 precacheエントリー、32実ファイル、21,002,590 bytes（約20.03MiB） |
| 第3B-1専用ブラウザー | JSON貼付・旧形式・編集・複数品・fragment起動と消去・hashchange・null補完・source表示・クリップボード成功/拒否・キャンセル・オフライン登録に成功 |
| サイズ・表示 | 390×844、320×440、ライト／ダーク。入力と登録ボタンまでスクロール可能、横はみ出しなし |
| 第1段階 | 手入力、編集、削除、日付変更、体重、目標、テーマ、小数表示、ホーム・履歴・分析、オフライン再起動成功 |
| 第2段階 | 食品・別名検索、重量、お気に入り、レシピ作成/編集/複製/今回だけ変更、セット、前日コピー、重複防止、かんたん入力成功 |
| DB v1→v3 | 旧食事・体重・設定が保持されることを実ブラウザーIndexedDBで確認 |
| DB v2→v3 | 6テーブルの旧記録を全フィールド比較して保持を確認 |
| DB v3→v3 | 6テーブルと外食snapshotを比較して保持を確認 |
| 第3A外食 | KFC・CoCo壱・びっくりドンキーの検索、variant、出典、カート、数量、合計、保存、ホーム・履歴成功。21チェーンをオフラインで検索可能 |
| データ不変 | `stage3a-complete`と21外食JSON・食品JSONのバイト列一致。sources.jsonのGitオブジェクト一致（Windows改行フィルターを考慮） |
| ネットワーク | 第3B-1確認・登録中に自動外部リクエストなし。JSONを含むquery/HTTPリクエストなし |
| コンソール | 完走した全ブラウザー検証でpage/console errorなし |

初回の単体テストで新規テストの期待値に不要な`sourceType: undefined`を含めた1件が失敗したため、実際のsnapshotの`declaredSourceType`仕様に合わせて修正し、全件再実行しています。第1段階のブラウザースクリプトは既定ポート4173への初回接続に失敗したため、稼働中の4175を`APP_URL`で指定し直して完走しました。

## 再実行

```sh
pnpm test
pnpm run build
pnpm exec vite preview --host 127.0.0.1 --port 4175 --strictPort
```

別ターミナルで、利用可能なPlaywrightとChromeを使用します。Playwrightは既存の検証用環境を利用し、アプリの依存パッケージには追加していません。

```powershell
$env:APP_URL = 'http://127.0.0.1:4175/meal-log/'
# 通常のmodule解決でPlaywrightが見つからない場合だけ、インストール済みの絶対パスを設定
# $env:PLAYWRIGHT_MODULE = '.../node_modules/playwright'
node scripts/browser-stage3b1.cjs
node scripts/browser-check.cjs
node scripts/browser-stage2.cjs
node scripts/browser-stage3.cjs
node scripts/browser-stage3a3.cjs
```

専用プロファイル、JSONレポート、スクリーンショットはGit対象外の`test-results/`へ出力します。食品・外食DB監査は`python scripts/restaurants/audit-stage3a3.py`です。

## 公開前に用意した実機チェックリスト（記録）

本変更はGitHubへpushしていません。新しいiOS Safariでの実機検証、Ask ChatGPT実行、ショートカットのOSアクション接続は利用者による公開後確認が必要です。

1. 公開後に普段のホーム画面PWAを開き、更新通知から更新。既存の食事・体重・設定・レシピ・お気に入り・セット・外食履歴が残ることを確認。
2. まず手動JSON貼付で1件確認・編集・登録し、ホームと履歴の出典・元snapshotを確認。
3. `CHATGPT_SHORTCUT.md`の手順でショートカットを作り、テキスト入力→Ask ChatGPT→確認画面→登録を確認。数量の掛け方と元値の保存を確認。
4. URLが消えることと、普段のPWAと同じ保存先で開いたかを確認。Safariの別領域に開いた場合は登録せず、普段のPWAへJSONを貼り付ける。
5. 2〜3品を取り込み、nullの未入力拒否、数量変更、公式申告／推定表示を確認。
6. クリップボードボタンの許可・拒否と、長押しペーストの代替操作を確認。
7. 機内モードでPWAを終了→再起動し、手元にあるJSONを貼り付けて保存・履歴確認。
8. キーボード表示中に最下部までスクロールでき、セーフエリア・ダーク表示が自然か確認。
