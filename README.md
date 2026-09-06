# Meal Log — 第1段階

iPhone 14の縦画面を優先した、個人用カロリー・PFC・体重記録PWAです。アプリの実行に有料API・バックエンド・ログインは不要です。デモデータは入れていません。

## 起動

Node.js 22.12以上（または24 LTS）とnpmを用意し、このフォルダーで実行します。

```sh
npm install
npm run dev
```

PCで `http://localhost:5173/meal-log/` を開きます。開発サーバーは同じWi-FiのiPhoneから `http://PCのIPアドレス:5173/meal-log/` でも確認できます。OSのファイアウォールで必要に応じてアクセスを許可してください。HTTPのLANアドレスではサービスワーカーが動作しないため、オフラインの検証には次のHTTPS手順を使います。

```sh
npm test
npm run build
npm run preview
```

本番出力は `dist/`。PCの `http://localhost:4173/meal-log/` でサービスワーカーを含む本番動作を確認できます。開発モードではサービスワーカーを登録しません。

この作業環境ではnpmコマンドがなかったため、同等のpnpmでインストールしています。再現用に `pnpm-lock.yaml` を同梱しています。pnpm利用時は `pnpm install --frozen-lockfile`、`pnpm test`、`pnpm run build` が使えます。`pnpm-workspace.yaml` はesbuildのインストールスクリプトのみ許可します。

## iPhoneでアプリとして確認する

1. [GitHub Pagesの初回公開手順](docs/GITHUB_PAGES.md)に従って、既存の公開リポジトリ `meal-log` にソースをpush。
2. GitHub Actionsがテスト・本番ビルド・Pages公開を自動実行。`dist/` はGitへpushせず、Actionsが生成・配信します。公開はまだ実行していません。
3. iPhoneのSafariで発行されたHTTPS URLを開く。
4. 「オフラインで使う準備ができました」を確認。
5. Safariの共有メニュー → 「ホーム画面に追加」。表示される場合は「Webアプリとして開く」をONにして追加。
6. ホーム画面のアイコンから起動して食事・体重を登録し、アプリを閉じて再起動して記録が残ることを確認。
7. 機内モードに切り替え、Wi-FiもOFFにして再起動。記録の閲覧・追加・編集を確認。

静的ホスティングはアプリのHTML/JS等の配信だけに使います。食事記録や体重を送信する実装はありません。公開リポジトリ・サイトは他の人も閲覧できますが、端末の記録は公開されません。実機Safariでの終了後の永続性・セーフエリア・キーボードは、この手順で最終確認してください。

参考：[Appleの追加手順](https://support.apple.com/ja-jp/guide/iphone/iphea86e5236/ios)、[Service WorkerのHTTPS要件](https://developer.mozilla.org/en-US/docs/Web/API/Service_Worker_API)、[GitHub Pagesの無料利用条件](https://docs.github.com/en/pages/getting-started-with-github-pages)。

## 実装した機能

- ホーム：日付移動／今日へ戻る、残り・超過カロリー、PFC、進捗、食事4区分、体重の記録・更新。
- 手入力：区分の初期選択、食事名・カロリー必須、PFC空欄は0、日付・時刻、数値検証。時刻から朝食4〜10時／昼食11〜15時／夕食16〜21時／その他は間食を選択。
- 履歴：日付別、食事詳細、編集、確認付き削除。ホームの食事区分からはその日の区分に絞った記録を表示。
- 設定：カロリー・PFC・目標体重、システム／ライト／ダーク、小数表示。目標は保存時、表示設定は選択時に反映。
- 分析：今日の摂取・目標とPFCのみ。献立提案ボタンは追加予定の通知のみ。
- PWA：standalone、セーフエリア、仮PNGアイコン、apple-touch-icon、オフラインキャッシュ、更新通知。更新は入力を保存してから手動で適用。

## 構成

```text
src/
  App.tsx                  画面切替・日付・モーダル・テーマ
  main.tsx                 React起動
  components/              ナビ、入力部品、PFC、ダイアログ、PWA通知
  pages/                   Home / MealForm / History / MealDetail / Settings / Analysis
  domain/
    types.ts               MealEntry / WeightEntry / UserSettingsと拡張用の種別
    date.ts                端末のタイムゾーンに沿った日付処理
    nutrition.ts           合計と表示（元データを変更しない）
    validation.ts          入力の検証
    domain.test.ts         計算・時刻区分・境界・入力のテスト
  data/
    db.ts                  Dexieのスキーマ・バージョン
    repository.ts          DBの取得／保存／削除
    id.ts                  端末内ID生成
    repository.test.ts     保存・再接続・更新・削除のテスト
  styles.css               共通デザイン
  styles/                  画面とフォームのCSS
public/
  favicon.svg              差し替え可能なアイコン原稿
  icons/                   180 / 192 / 512px・maskableのPNG
vite.config.ts             Vite、manifest、サービスワーカー生成
.github/workflows/deploy.yml mainへのpushでテスト・ビルド・Pages公開
docs/GITHUB_PAGES.md        初回pushとPages設定の手順
```

主要ライブラリ：React、TypeScript、Vite、Dexie、dexie-react-hooks、vite-plugin-pwa、workbox-window。テストにはVitestとfake-indexeddb。外部フォント・CDN・計測SDKは使用していません。

## 確認結果

- 依存関係インストール完了（pnpm、npm install相当）。
- TypeScript型チェックとVite本番ビルド成功（npm run build相当）。
- Vitest：24件すべて成功。集計・時刻区分・数値検証・日付境界・IndexedDBの保存／編集／削除／再接続を確認。
- ChromeのiPhone 14相当サイズ（390×844）で、食事追加・編集・日付移動・削除確認とキャンセル・目標変更・テーマ・小数表示・体重を確認。
- 専用ブラウザープロファイルを閉じて再起動し、オフラインでアプリ起動／保存済みデータ読込／食事追加／リロードに成功。
- 320px幅でも横スクロールなし。検証中のコンソールエラー・ページエラーなし。
- iPhone実機とSafari自体は未検証です。上の実機確認手順を実施してください。

追加のブラウザーテストは `scripts/browser-check.cjs` にあります。ChromeとPlaywrightがある環境で `node scripts/browser-check.cjs` を実行します（先に `npm run preview`）。Playwrightはアプリ本体の依存に含めていません。既存のPlaywrightを使う場合は `PLAYWRIGHT_MODULE` 環境変数にそのモジュールへのパスを指定します。結果とスクリーンショットはGit対象外の `test-results/` に出力され、通常使用するブラウザーの記録には触れません。

GitHub Pages用のVite base・manifestの起動URL／scope／アイコン・Service Workerのscopeは `/meal-log/` に統一しています。ブラウザーテストにも、サブディレクトリ内のmanifest・アイコン取得とService Worker登録先の検証を含めています。GitHub ActionsではNode.js 24とpnpm 11.19.0を使い、既存ロックファイルを `--frozen-lockfile` で再現します。

Pages設定変更後も24件のテスト・型チェック・本番ビルドが成功し、`/meal-log/` 配下でのブラウザーテストも成功しています。ロックファイル固定でのインストールと、Gitによる不要ファイル除外も確認済みです。GitHub側のworkflow実行・実際の公開・実機Safariは初回push後に確認します。

## データと拡張方針

IndexedDB `meal-log` の `meals` / `weights` / `settings` に保存します。日次合計は保存せず食事データから導出します。食事時刻はUTCのISO文字列、日付表示・集計の境界は端末のタイムゾーンを使用します。体重は同じ日付なら更新。PFCの小数表示OFFは画面のみ丸め、保存した小数を維持します。

食事名は100文字以内、1件のカロリーは0〜20,000、各PFCは0〜2,000、体重は1〜500kg、日付は1900〜2100年。目標カロリーは1以上です。これらは異常入力防止の技術上の上限です。検証規則は `domain/validation.ts` に分離しています。

今後の機能は `SourceType` と `MealEntry` を共通形式とし、データ取得を別モジュールとして追加できます。DBのテーブル追加・移行は `db.ts` の次バージョンで行います。第2段階のテーブルや仮データ、API実装は追加していません。

SafariのWebサイトデータ消去、プライベートブラウズ、OSによるストレージ削除、端末変更時には記録を失う場合があります。通常モード・同じHTTPS URL・同じホーム画面アプリで使ってください。第1段階にはバックアップ・エクスポート・同期がありません。

## 今回実装していないもの

食品DB、外食DB、レシピ、バーコード／Open Food Facts、OCR、ChatGPT・ショートカット連携、お気に入り、グラフ、自動分析、献立提案、推定維持カロリー、CSV/JSON出入力、クラウド同期、アカウント、バックエンド。
