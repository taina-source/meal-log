# Meal Log 開発ルール

ユーザーの今回の明示指示を優先する。利用量を節約しつつ、既存機能とユーザーデータの安全性を維持する。

## 固定条件

- React + TypeScript + Vite、iPhone向けPWA、GitHub Pages。base pathは `/meal-log/`。
- IndexedDB / Dexieで端末内保存。既存ユーザーデータを絶対に削除しない。
- 追加料金0円。バックエンド、アカウント、クラウド同期、有料API、OpenAI API、APIキーを追加しない。
- MEXT食品DB、21チェーン外食DB、オフライン対応、Service Workerを維持する。

## Git

ユーザーの明示指示なしに `git commit`、`git push`、`git reset --hard`、`git clean`、未コミット変更を破棄するcheckout、tag作成・削除、branch削除を行わない。既存の未コミット変更を保持し、通常はcommit/pushせず停止する。

## 調査と実装の範囲

- 作業開始時にAGENTS.mdとgit status/diffで必要な現状を確認する。
- 今回必要なファイルだけ読む。README全文やリポジトリ全体を毎回読み込まない。
- 既存実装を再利用する。関係ないリファクタリングや将来機能の先行実装をしない。
- 既存dependencyを優先し、本当に必要でない限りnpm/pnpm/Python/system packageを追加しない。
- 通常開発では外部サイトへアクセスしない。外部アクセスが必要なタスクだけ、目的を明確にして行う。

## 検証と利用量

- 開発途中は変更に関係するテストを優先する。小変更のたびに全件テスト・production buildを実行しない。
- 成功した検証を、新しい変更・失敗・未解決の懸念などの理由なく繰り返さない。
- 通常の最終確認は `pnpm test` 全件を1回、`pnpm run build` を1回（TypeScriptチェックとPWA生成を含む）、必要なら変更画面だけブラウザー確認とする。
- 現在 `pnpm test` はVitest全件、`pnpm run build` は `tsc -b && vite build`。build内の型チェックを1回に数え、同じ型チェックを別途重複実行しない。PWA生成もbuild結果で確認する。
- 対象テストは例として `pnpm test src/domain/jsonQuotes.test.ts`。Vitestは `src/domain/*.test.ts` と `src/data/*.test.ts`、既存ブラウザー検証は `scripts/browser-*.cjs` にある。関連するものだけ利用する。
- 全テスト3回連続等はflaky test・非決定的挙動の調査時に限る。失敗は原因を確認し、成功するまで再実行して隠さない。
- ドキュメントのみ等、実行動作を変えない変更は必要な内容確認に留める。ユーザーが指定した検証範囲を優先する。

## テスト方針

- 利用量削減のために意味ある既存回帰テストを削除しない。
- 特にIndexedDB migration・データ保持、食事履歴・snapshot、MEXT食品DB、21チェーン外食DBとprovenance、レシピ、お気に入り、MealSet、ChatGPT取り込み、重要なoffline動作の検証を維持する。
- 新機能では重要なビジネスロジックと再発防止に必要なテストを追加する。同じ挙動を重複確認するだけのテストを増やしすぎない。
- sleepやsetTimeoutでflaky testをごまかさない。時刻・順序等の前提を明示し、テストの後始末を行う。

## ブラウザー確認

- 開発途中は代表的なiPhoneサイズ1つ程度で、変更箇所を確認する。
- 小修正ごとに390×844、320×440、light、dark、offline、全過去機能をすべて確認しない。
- 画面を大きく変更したステージ完了時は、必要に応じて広い確認を行う。

## DB・栄養データ

- 現在のIndexedDB v3を理由なく上げない。optional field追加だけなら、互換性が保てる限りversionを上げない。
- 必要なmigrationは非破壊とし、既存version定義とデータを保持する。実ユーザーDBのclear/deleteで問題解決しない。隔離したテストDBの準備・後始末とは区別する。
- unknownを0にしない。推定を公式として表示しない。
- `official` / `official_old` / `secondary` / `estimate` / `unknown` / ChatGPT経由の区別を維持する。
- 過去MealEntryのsnapshotを元データ更新に合わせて再計算しない。

## README・docs

- 安定した開発ルールはAGENTS.mdに置く。小さな内部修正ごとにREADMEを更新・全文読込しない。
- 主な更新契機はステージ完了、ユーザー操作変更、schema・DB動作変更、セットアップ・デプロイ変更、重要な制約変更。
- 内部だけのテスト修正では、将来保守に必要でなければREADME更新不要。

## 完了報告と停止

- 通常は「変更内容、主な変更ファイル、テスト結果、build/PWA結果、DB/schema変更有無、iPhoneで必要な確認、残課題」を簡潔に報告する。未実施の検証は成功と書かない。
- 20項目以上の長い報告はユーザーが要求した場合だけにする。
- 要求された機能と必要な検証が完了したら、関係ない改善を続けず停止する。
