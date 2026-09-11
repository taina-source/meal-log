# Meal Log — 第3B-2段階

## iOSコピー時のスマート引用符対策

通常のJSON.parseを最優先し、構文エラーの場合だけJSONのキー・値の開始位置を見てスマート引用符を補正します。通常の “…” に加え、開始側もU+201Dになった ”…” と空文字の :”” に対応します。全文置換は行わず、ASCII引用符内の本文・エスケープと、スマート引用符内の対になった引用符は保持します。本文中の単独の ” と区切りを判別できないケース、ASCIIとスマート引用符で片側ずつ囲んだ文字列、末尾カンマ等は推測して修復せず拒否します。補正後もJSON.parseと既存schema検証を通します。うまく読めない場合はASCII引用符で再出力してください。

追加修正（開始側U+201D）：実機で失敗したJSON全文を `src/testing/iphone-smart-quotes.txt` に保存し、restaurant／sourceUrl／sourceTitleの `:””`、`”テスト”`、photo／text／legacy、本文保持・不正配置拒否を検証しました。現在342件（従来325件に17件追加。従来のU+201D開始を拒否する1件は、新しい対応仕様に合わせ受理の検証へ更新）です。`pnpm test` は342/342成功を3回連続で確認しました。最初の試行では別件のロイヤルホスト全データ検査が5秒でタイムアウトしましたが、検査や制限時間を変更せず、その後3回連続成功しています。

「最近使った食品・レシピ・セット」テストは、連続登録のcreatedAtが同一ミリ秒になるとUUID順で前回量が決まる可能性がありました。テストだけDateを固定し、各登録を1秒ずつ進め、finallyで時計を復元しました。本番のrecentItems／保存処理は未変更です。

追加修正の最終確認：TypeScript（tsc -b）・本番build成功、PWA生成成功（37エントリー、20,520.08KiB）。390×844の本番プレビューで実機JSON全文から写真確認画面へ遷移し、通常のphoto／text／legacyと不正JSON・schema違反の拒否も成功、console／page errorは0件です。DB v3、MEXT・21外食JSON、/meal-log/・PWA設定のHEADとの差分はありません。git commit／pushは行っていません。

前回の修正記録：

修正検証：既存290件＋追加35件＝325件の自動テスト成功。TypeScript・本番build・PWA生成成功（precache 37件、20,520.06KiB）。390×844でスマート引用符のphoto／text／legacy貼り付けと不正データ拒否を確認し、既存第3B-1／第3B-2のブラウザーテスト（320×440、ライト／ダーク、クリップボードfallback、オフライン終了・再起動を含む）も成功しました。console／page errorは0件。IndexedDB v3・食品DB・21外食JSONは変更していません。実iPhoneでの修正版確認は公開更新後に行ってください。

**食事写真をChatGPTアプリで解析 → JSONをコピー → 普段のホーム画面Meal Logで確認・編集・登録**に対応しました。写真はMeal Logに渡さず、画像解析・画像保存・OpenAI API・APIキー・バックエンドを追加していません。契約済みChatGPTアプリを使い、Meal Log側の追加料金は0円です。

## 正式なiPhone運用

- **テキスト**：ショートカットの「入力を要求」→ プロンプト → テキスト版Ask ChatGPT → 回答JSONをクリップボードへコピー → 普段のホーム画面Meal Log → ＋ → **ChatGPTから取り込み**。
- **写真**：ChatGPTアプリへ写真を添付 → 写真用プロンプトと量の補足を送信 → 回答JSONをコピー → 普段のホーム画面Meal Log → ＋ → **写真からChatGPT取り込み**。

いずれも読込後に内容確認・編集・食事区分／日時選択を経て登録します。自動登録やMeal LogからChatGPTへの通信はありません。

**第3B-1の実機結果**：テキストJSONの生成・コピー・PWAでの読込・登録・Home/History反映は正常でした。一方、fragment URLはSafariを開き、ホーム画面PWAと履歴／IndexedDBが共有されませんでした。「Appを開く」でもPWAのMeal Logを選べませんでした。したがって、このiPhoneではクリップボード方式を正式運用とします。fragment機能はPC等の**互換／実験的ルート**として維持しますが、PWA起動の推奨ルートにはしません。

## 第3B-2の追加機能と仕様

| 項目 | 内容 |
| --- | --- |
| 写真入口 | 写真解析の手順、プロンプトコピー、clipboard読込、手動JSON貼付。書込・読取が拒否されても手動コピー／貼付可能 |
| 共通処理 | 第3B-1のparser、編集、数量計算、登録、snapshot、Home、History、前日コピーを再利用 |
| JSON | schemaVersion=1、type=meal-log-chatgptのまま。任意inputType="photo"を追加。省略／textはテキスト・旧形式、未知値は拒否 |
| 数量 | 原則、数量1・単位「写真の1皿分」・その皿全体の栄養値。個数が確実な場合のみ1個あたり×個数。アプリは数量を1回掛ける |
| 注意表示 | 写真の量・油・調味料・隠れた材料を正確には判断できないことを確認画面に表示 |
| 出典 | 写真estimateは「ChatGPT写真推定」、テキストestimateは従来の「ChatGPT推定」。officialの申告は「ChatGPT経由・公式情報」で、検証済み公式DBと区別 |
| confidence・notes | 「推定信頼度：高／中／低（ChatGPTの申告）」「推定時のメモ」として表示 |
| 修正 | 元snapshotを保持。chatgptUserModifiedに加え任意chatgptModifiedBeforeSaveで登録前の修正を区別 |
| null | 0へ補完せず、数値入力が揃うまで登録禁止。従来の負値・非有限値・巨大入力・1〜20items制限も維持 |
| 写真の保存 | 画像入力／送信／保存処理なし。許可した項目だけを正規化・保存し、未知の画像/base64/blobフィールドは採用しない。既知の文字列欄の画像data URLは拒否 |
| DB | **IndexedDB v3維持**。chatgptSnapshot.inputTypeとMealEntryの任意フラグ追加だけで、table/index/既存migrationの変更なし |

写真JSONは既存テキスト入口でも写真と判定します。写真入口でもinputType未指定の旧JSONを勝手に写真扱いにせず、テキスト形式の注意を出します。写真の結果なら写真用プロンプトでJSONを出し直してください。

## プロンプトと操作ガイド

- **[写真の実際の手順・プロンプト全文・ショートカット案](docs/CHATGPT_PHOTO.md)**
- **[テキスト版ショートカットの手順](docs/CHATGPT_SHORTCUT.md)**（iPhoneはclipboard方式に更新）
- **[第3B-2検証記録と実機チェックリスト](docs/STAGE3B2_VERIFICATION.md)**

写真プロンプトの原本は[`src/prompts/chatgpt-photo.txt`](src/prompts/chatgpt-photo.txt)。アプリが直接取り込み、docsのプロンプト全文は`node scripts/sync-photo-prompt.cjs`で更新します。自動テストで一致を確認します。ユーザーの量・食べた割合の補足を最優先し、隠れた材料の断定・二重計上・不自然な精密値を避ける内容です。プロンプト上の丸めは写真の推定値への指示だけで、アプリは既存公式値を丸め直しません。

写真をChatGPTで解析する部分は手動操作とオンライン接続が必要です。取得済みJSONの貼付・確認・編集・登録・履歴はオフラインで利用できます。ChatGPTを開く独自URLスキームや画像Share機能は追加していません。

## 検証・保守

既存257件＋写真用33件の **290件成功**。型チェック・本番ビルド・PWA生成成功。precacheは**37エントリー／32実ファイル、21,011,898 bytes（約20.038MiB）**。390×844／320×440・ライト／ダーク・オフライン再起動、テキスト版回帰、v1/v2/v3データ保持に成功。詳しくは[検証記録](docs/STAGE3B2_VERIFICATION.md)を参照してください。21外食JSON、MEXT JSON、`/meal-log/`、Service Worker設定、GitHub Actionsを維持します。

```sh
pnpm install --frozen-lockfile
pnpm dev
pnpm test
pnpm run build
```

## 今回含まないもの

OpenAI API、完全自動画像Shortcut連携、独自AI画像モデル、栄養表示専用OCR、バーコード、Open Food Facts、本格グラフ、自動分析、摂取カロリーと体重の関連分析、推定維持カロリー、残りPFC食事提案、全データExport/Import、同期、アカウント、バックエンドは未実装です。

---

以下は第3B-1以前の開発記録です。**iPhoneの現行運用は上記のクリップボード方式**を使用してください。

# 第3B-1段階の記録

**ChatGPTアプリのテキスト版「Ask ChatGPT」→ Meal Logで確認・編集 → 食事登録**に対応しました。OpenAI API・APIキー・バックエンドは使いません。契約済みChatGPT PlusとiPhoneショートカットを利用し、Meal Log側の追加料金は0円です。アプリからChatGPTへ通信する処理はありません。

## 第3B-1で追加した機能

- 食事追加画面の「ChatGPTから取り込み」を有効化。手動JSON貼付と、ボタン操作時のみのクリップボード読取に対応。権限拒否・非対応でも長押しペーストから使えます。
- `#ml-import=<URL_ENCODED_JSON>`による起動と、起動済みアプリのhash変更を検出。受信した内容を必ず確認画面に表示し、自動登録しません。
- 商品名・店名・数量・単位・kcal/P/F/Cを編集。**1単位あたりの栄養値 × 数量**で合計し、食事区分・日時を選んで1〜20品を一括登録します。
- 元のChatGPT情報はimmutable snapshotとして残し、ユーザー修正を表示。ホーム、日次合計、履歴へ即反映。履歴詳細から元値・出典・信頼度を確認できます。
- null／欠落の栄養値は0にせず空欄として確認画面へ進め、補完するまで保存不可。負値、非有限値、数量0、不正なschema、過大な入力を拒否。大皿相当の大きな値や4/9/4との差は警告にとどめます。
- 前日コピーでも栄養値とChatGPT snapshotを保持。コピー先では取り込みgroup IDを新しくし、既存の二重コピー防止を維持します。

## JSON schema・旧形式

```json
{
  "schemaVersion": 1,
  "type": "meal-log-chatgpt",
  "items": [{
    "name": "料理名",
    "restaurant": "",
    "quantity": 1,
    "unit": "人前",
    "calories": null,
    "protein": null,
    "fat": null,
    "carbs": null,
    "sourceType": "estimate",
    "sourceUrl": "",
    "sourceTitle": "",
    "confidence": "low",
    "notes": "分量と栄養値を確認して補完してください"
  }]
}
```

上は数値を補完する前の形式例です。旧単品形式（`name`と栄養値等がルートにあるJSON）も読み込み、schemaVersion 1 / items 1件へ正規化します。省略時quantity=1、unit=個。複数品は各々MealEntryとして同じ`chatgptImportId`で保存します。商品をまとめた合計栄養値を渡す場合はquantity=1にし、二重乗算を避けてください。

## ChatGPTの出典とDB

`sourceType="official"`という回答も、Meal Logの検証済み公式DBとして扱いません。

| ChatGPTの申告 | 表示 |
| --- | --- |
| official + 有効なHTTPS URL | ChatGPT経由・公式情報 |
| official + URLなし／無効 | ChatGPT経由・公式情報（出典URLなし）＋確認の注意 |
| estimate | ChatGPT推定 |
| confidence | 高／中／低（ChatGPTの申告） |

MealEntryは`sourceType="chatgpt"`、既存の数値confidenceはnull。元の文字列confidenceはsnapshotへ保存します。追加フィールドはすべてoptional：`chatgptSnapshot`（schemaVersion、元の商品・店・1単位の栄養値・quantity・unit・declaredSourceType・URL・資料名・confidence・notes・importedAt）、`chatgptImportId`、`chatgptUnit`、`chatgptUserModified`。MealEntry本体は編集後の名前・店・数量と数量反映後の栄養値を保持します。履歴で再編集しても元snapshotは変更しません。`restaurantSnapshot`／`restaurantOrderId`とは別です。

**IndexedDB v3を維持**。table/index追加なし、既存v1/v2/v3定義を変更せず、既存データを消去する処理は追加していません。新しいお気に入りDBやChatGPT専用recentsは今回追加していません。

## Fragment・privacy・オフライン

URLは`https://taina-source.github.io/meal-log/#ml-import=...`。query parameterに食事JSONを入れません。fragmentはHTTPリクエストとしてGitHub Pagesへ送られません。ただし端末側の履歴等に一時的に残り得るため、解析前に`history.replaceState`で現在URLから削除します。不正JSON・過大fragmentも削除し、手動貼り付けへ誘導します。登録前はメモリー内だけに保持し、再読込で確認中の内容は失われます。Shortcuts／ChatGPT／端末全体の履歴を消す機能ではありません。[仕様の説明](https://developer.mozilla.org/en-US/docs/Web/URI/Reference/Fragment)

fragmentはエンコード後16KiB、手動JSONはUTF-8で128KiBまで。これはアプリの上限で、ブラウザーのURL限界を断定しません。大きなJSONはクリップボード・手動貼付へ。HTTPSのみ明示操作用リンクとし、危険なURLやHTMLを実行しません。

PWAの`/meal-log/`、manifest、Service Worker、GitHub Actionsを維持。21外食JSONと食品DBを引き続きキャッシュし、受け取ったJSONの確認・編集・登録はオフラインで完結します。ChatGPTへの質問だけはオンラインです。公開後の更新を完了してからオフラインで使ってください。

## 手順・検証

- **[iPhoneショートカットの作り方と推奨ChatGPTプロンプト](docs/CHATGPT_SHORTCUT.md)**：入力を要求→テキスト→Ask ChatGPT→結果変数→JSONを1回URLエンコード→fragment URL→URLを開く。
- **[第3B-1検証記録・実機チェックリスト](docs/STAGE3B1_VERIFICATION.md)**。
- 自動テスト **257件成功（既存199 + 新規58）**、TypeScript、本番ビルド、PWA生成成功。
- Chromeの隔離プロファイルで390×844／320×440、ライト／ダーク、clipboard fallback、fragment、オフライン終了→再起動と保存を確認。v1/v2/v3の記録保持、食品／レシピ／セット／コピー／体重／設定、外食KFC／CoCo壱／びっくりドンキー、21店検索も成功。console/page errorなし。
- 21外食JSONと食品JSONは`stage3a-complete`とバイト一致。sources.jsonはGitの改行正規化を考慮して同一オブジェクト。外食JSON累計 **19,305,936 bytes**のまま。
- PWA precacheは **37エントリー／32実ファイル、21,002,590 bytes（約20.03MiB）**。raw資料のprecache追加なし。

```sh
pnpm install --frozen-lockfile
pnpm dev
pnpm test
pnpm run build
```

iPhoneでは公開後、普段のホーム画面PWAを更新し、まず手動貼付で確認・登録してください。その後ショートカットでURL起動→fragment消去→保存先が同じかを確認します。URLを開く操作がSafariへ進む場合もあり、PWAの直接起動は強制できません。保存先が別ならJSONをコピーして普段のPWAへ貼り付けます。詳細手順は上のdocsを参照してください。

## 今回未実装

写真・画像版Ask ChatGPTの自動受け取りは第3B-2以降。OpenAI API、バーコード、Open Food Facts、OCR、本格グラフ、自動分析、体重との関連分析、推定維持カロリー、食事提案、全データCSV/JSON Export・Import、クラウド同期、アカウント、バックエンドは追加していません。

---

# 第3A-3段階の記録

**当初予定した21チェーンの外食実メニューDBが完成しました。** 実商品・公開栄養値・出典を収録したカタログです。未公表の栄養値は残っており、全商品のPFCが揃ったという意味ではありません。新7店舗のうちジョイフルは食事登録に対応し、ガスト・天下一品・餃子の王将・スシロー・くら寿司・はま寿司は今回、検索・詳細・出典確認・お気に入りまで利用できます。不足商品をカートへ追加・登録する操作は拒否します。

既存の検索・variant・カート・注文グループ・保存・最近使った店を再利用。既存14JSONのID・件数・栄養値・出典とsources.jsonの既存14項目はSHA-256で一致を確認しました。IndexedDBは **v3のまま**。追加アプリ依存・バックエンド・有料API・ログイン・クラウドなし。commit / pushは行っていません。

## 第3A-3の収録件数・公式出典

取得日：**2026-09-09**。variantは原資料のサイズ・地域・時間帯・提供単位を区別した行です。現在の公式表への掲載は、全店舗での販売を保証するものではありません。

| チェーン | 商品グループ | variant | 登録不可 | JSON bytes | 主な公式資料 | 公開・更新日 |
| --- | ---: | ---: | ---: | ---: | --- | --- |
| ガスト | 324 | 389 | 389 | 1,047,857 | [メニュー](https://www.skylark.co.jp/gusto/menu/)が参照する[公式JSON](https://www.skylark.co.jp/gusto/menu/json/menu_detail.json) | 記載なし |
| ジョイフル | 300 | 345 | 0 | 649,088 | [栄養成分・アレルゲンPDF](https://www.joyfull.co.jp/cal_pdf/cal.pdf) | 2026-09-08 |
| 天下一品 | 17 | 34 | 34 | 96,504 | [東側地域](https://www.tenkaippin.co.jp/allergy_e/)・[西側地域](https://www.tenkaippin.co.jp/allergy_w/)の現在公式商品一覧 | 2025-08-01 |
| 餃子の王将 | 70 | 266 | 266 | 747,098 | [東日本](https://www.ohsho.co.jp/menu/east/)・[西日本](https://www.ohsho.co.jp/menu/west/)・[中国九州](https://www.ohsho.co.jp/menu/south/)と商品詳細 | 記載なし |
| スシロー | 220 | 226 | 226 | 608,042 | [新宿三丁目店](https://www.akindo-sushiro.co.jp/menu/menu_detail/?s_id=869)・[道頓堀店](https://www.akindo-sushiro.co.jp/menu/menu_detail/?s_id=1019)、[公式FAQ](https://www.akindo-sushiro.co.jp/faq/) | 記載なし |
| くら寿司 | 339 | 354 | 354 | 909,854 | [アレルゲン・カロリーPDF](https://www.kurasushi.co.jp/common/pdf/kura_allergen.pdf?260904=) | 2026-09-04 |
| はま寿司 | 539 | 586 | 586 | 1,508,640 | [店内用カロリー・アレルゲンPDF](https://images.zensho.co.jp/materials/hama-sushi/allergen/allergen.pdf) | 2026-09-08 |
| **今回7店** | **1,809** | **2,200** | **1,855** | **5,567,083** | | |
| **21店累計** | **4,602** | **9,652** | **2,887** | **19,305,936** | 既存14店は変更なし | |

ジョイフルは原表356行を取り込み、同一商品・条件・値の重複を整理して345variant。スシローは上記2店舗の実掲載を確認した範囲です。価格だけの違いは重複化せず、内容・値が異なる記載は提供条件を分離しました。全店舗限定品の網羅は保証しません。

provenanceの内訳は **商品数ではなく栄養素数（1variantにつきkcal/P/F/Cの4個）** です。数値のない商品カタログの出典が公式でも、その栄養素はunknownです。

| 対象 | official | official_old | secondary | estimate | unknown |
| --- | ---: | ---: | ---: | ---: | ---: |
| ガスト | 372 | 0 | 0 | 0 | 1,184 |
| ジョイフル | 1,380 | 0 | 0 | 0 | 0 |
| 天下一品 | 0 | 0 | 0 | 0 | 136 |
| 餃子の王将 | 0 | 0 | 0 | 0 | 1,064 |
| スシロー | 201 | 0 | 0 | 0 | 703 |
| くら寿司 | 335 | 0 | 0 | 0 | 1,081 |
| はま寿司 | 584 | 0 | 0 | 0 | 1,760 |
| **今回7店** | **2,872** | **0** | **0** | **0** | **5,928** |
| **21店累計** | **31,562** | **0** | **0** | **0** | **7,046** |

## チェーン固有の取り扱い

- **ガスト**：公式JSONから商品・時間帯・カロリーを取得。塩分や一部糖質があっても、糖質をCへ置き換えません。P/F/Cはnull。カロリー空欄17variantも0にしません。
- **ジョイフル**：kcal/P/F/Cの掲載順を保持。店内とテイクアウトを分離し、原表カテゴリ（町中華、トッピング、朝食、ランチ等）も保持。ライスは原表の通常量。セットに含まれないドリンクバー・スープバーや卓上調味料の栄養を足しません。ライス差分・セット全組み合わせを生成しません。
- **天下一品**：現在公式から案内される地域別17商品×2地域。現資料はアレルゲン中心です。[2024年の旧公式PDF](https://www.tenkaippin.co.jp/wp-content/uploads/2024/11/tenkaippin_allergy_east2411.pdf)もアレルゲン資料で、流用できる同一商品・量のPFCを確認できませんでした。旧栄養ページは取得できず、二次サイトの一般料理の推定、家麺・コンビニ監修品などは店内商品と同一ではないため採用していません。kcalも含めnullです。
- **餃子の王将**：3地域の実商品名・通常／ジャストサイズを分離。餃子は公式の1人前6個／3個を保存。現在メニューと公式アレルゲン資料に対象のkcal/PFCを直接支持する値がなく、過去値・二次値も地域・量・現在商品の同一性を確認できませんでした。大阪王将や通販品の値、料理名からの推定は使いません。
- **回転寿司3社**：kcalは公式資料の提供単位。P/F/Cはnullです。スシローは公式FAQでも他の栄養分が非公表と案内されています。一般食品や他社のPFCは流用しません。貫数が明示された商品だけpiecesPerServingを設定し、記載がなければ **「1皿」** と表示。1皿＝2貫とは推測しません。持ち帰りは商品名の人数・内容に対応するセット単位、ドリンク・調味料はその公開単位を保持。スシローの20ドリンクは **100ml当たり** の記載で、1杯の値に置き換えません。くら寿司のサイド類は原表の1皿／1杯、末尾の栄養未掲載品はnull。はま寿司は地域条件、朝食欄、5g／一袋等の調味料を区別します。

数量表示は既存quantityを使い、単位があると「3皿」、貫数が判明していれば「合計6貫相当」と表示します。**今回の実際の寿司商品はPFC不足により登録不可**です。この数量計算UIの自動検証は、本番JSONと分離した明示的なテスト専用fixtureで行っています。

### はま寿司の3行補正と原表内の矛盾

PDFを画像化して5／6ページの列位置と数値を照合しました。

| 商品名（表示用の括弧対を整えた名称） | 原表kcal |
| --- | ---: |
| (北海道限定)レアステーキ三種盛り(びんちょう、サーモン、アカイカ) | 168 |
| (北海道以外)サーモン三種(サーモン・大トロサーモン・レアステーキ) | 157 |
| (北海道限定)サーモン三種(サーモン・大トロサーモン・レアステーキ) | 164 |

最初の名称は原PDFでカロリー列へはみ出し、抽出文字列に二重閉じ括弧も含まれるため、表示名の余分な末尾括弧1個を除去しました。数値は原画像どおりです。補正理由は各商品のnotesにも残しています。

補正はPDFのSHA-256 `d80d1b64f4da4c64e06eb0a7c3f84c42fa274d2e55b5a4254f2c70eadcd7e252` と元の商品名セル・カロリーセルの完全一致で限定し、3行すべてに一致しなければ停止します。新版PDF・変更セル・補正対象の欠落で停止することを自動テストしました。

ほかにホット抹茶ラテSは84／105kcal、Mは118／147kcalの同名同サイズ記載があり、提供条件の区別を確認できません。値を選んだり架空のvariant条件を作らず、2variantのカロリーをnull、原表の両値をrawNutrientsとprovenance notesに保存しています。朝食の明示された欄は独立variantです。

## 型・DB・スナップショット

RestaurantMenuItemにoptionalのservingBasis、quantityUnit、piecesPerServingを追加。旧JSON／旧MealEntryをそのまま読めます。DB定義のv1／v2／v3、6テーブル、移行処理は変更していません。個人データのclear・削除・過去記録の再計算はしません。

数量を掛けたkcal/PFCを商品別MealEntryに保存し、同一注文はrestaurantOrderIdでまとめます。restaurantSnapshotは1単位の値・提供単位・商品情報・栄養素別provenanceを複製保存する既存仕様。公式JSONを更新しても過去記録は変化しません。

代表sourceTypeは従来どおり **estimate → secondary → official_old → official** の優先で弱い出典を選択します。unknown、出典valueと商品数値の不一致、負値・非数・不完全な栄養情報は登録を拒否します。混在する過去公式・二次・推定の表示／保存規則もテスト用データで確認し、今回の実データには無理に追加していません。

## 外食DBの取得・再変換・更新

実行時・GitHub Actions時に外部栄養サイトへアクセスしません。生成JSONをGitへ含めます。原本・抽出キャッシュ・確認画像は `data-sources/restaurants/raw/stage3a3/` に置き、Git対象外・配信対象外です。

1. 既存14JSONと出典の基準ハッシュは `data-sources/restaurants/stage3a2-baseline.json` と `stage3a2-source-baseline.json`。意図的な旧データ更新を伴わない今回の作業では書き換えません。
2. PythonにBeautifulSoup4、pdfplumber、pypdfium2を用意し、`python scripts/restaurants/fetch-stage3a3.py`。保存済みファイルを再利用します。更新する資料だけ `--file hama.pdf --refresh` 等で指定。403／429の回避や継続再試行はしません。
3. ジョイフルは自動PDF取得が403だったため、ブラウザーで公開されているPDFの読取本文を用い、全1510行・356商品行・11ページを照合しました。再変換用の `scripts/restaurants/joyfull-reviewed.json` はGit対象の転記データです。`prepare-joyfull-transcription.py` は今回版の保存済みjoyfull-reader-*.txt（L番号・P番号付き全文）と転記の完全一致を検証します。本文のSHA-256をsourcesに残し、PDFバイナリのハッシュとは区別しています。
4. 次版のジョイフルは公式PDFをブラウザーから保存・確認し、名称／カテゴリ／提供条件／ページ／kcal/P/F/Cをreviewedファイルへ転記します。原PDFの列順・注記・全商品数と照合してから公開日・件数ガードを更新してください。数値を推測して不足行を埋めないでください。
5. 他6店は保存済み公式HTML／JSON／PDFから専用パーサーで変換。`python scripts/restaurants/convert-stage3a3.py --retrieved-at 2026-09-09`。`--chain hama` 等で1店のみも可能。将来の更新時は実際の取得日を指定します。既存のconvert.py／convert-stage3a2.pyは今回の追加では実行不要です。
6. 必須列・版・未知記号・負値・件数下限・ID／variant重複を検証し、曖昧な衝突は停止。はま寿司新版はまず画像・元セル・重複行を確認してからガードを更新します。今回の自動補正は固定版専用です。
7. `python scripts/restaurants/test-stage3a3.py`、`python scripts/restaurants/prepare-joyfull-transcription.py`、`pnpm test`、`pnpm run build`、`python scripts/restaurants/audit-stage3a3.py`。監査で旧14JSON・出典のSHA-256、21店の件数／provenance／unknown、配信JSONの一致とキャッシュ実容量を確認します。
8. IDに栄養値・取得日を使いません。名前・条件変更に伴うID差分は確認します。過去MealEntryは変更しません。新資料のタイトル・URL・公開日・取得日・localRawFile・sha256・変換方法・注記はsources.jsonへ追加します。

## PWA・容量・GitHub Pages

Vite base／manifest／Service Worker／アイコン／既存Actionsは **/meal-log/** を維持。21JSONと食品DBをprecacheし、初回更新後はオフラインで検索・詳細・出典の保存内容・登録可能商品の保存・お気に入り・最近使った店を利用できます。外部リンクは利用者が開いた場合だけ通信します。

| 対象 | 実ファイル容量 |
| --- | ---: |
| 新7JSON | 5,567,083 bytes（約5.31MiB） |
| 21外食JSON | 19,305,936 bytes（約18.41MiB） |
| 最大単一JSON（ロイヤルホスト、既存） | 5,640,064 bytes（約5.38MiB） |
| 食品DB・本体等を含むprecache | 20,986,880 bytes（約20.02MiB） |
| precache件数 | 37エントリー／重複URLを除く32実ファイル |

既存6MiBの単一ファイル上限内です。20MiB程度に収まり、provenanceを削減する変更はしていません。raw PDF／HTML／画像・テスト結果はprecacheに含まれません。iPhoneの空き容量やSafariの保存領域管理は実機で確認してください。

## 第3A-3の最終確認

- アプリ自動テスト **199件成功**（既存143件＋追加56件、7ファイル）。原資料補正のPython回帰テスト **4件成功**。Joyfull転記の全1510行／356商品行照合とデータ監査も成功。
- TypeScript型チェック、本番build、PWA生成成功。追加アプリ依存なし。
- Chromeの390×844／320px、ライト／ダーク、高さ440pxのキーボード想定画面で、横スクロールなしを確認。
- 新7店の検索・variant・出典・お気に入り。ジョイフルの登録、残る6店のPFC不足による登録拒否を確認。
- KFC／CoCo壱／びっくりドンキーで検索→variant→出典→カート→数量増減→登録→ホーム→履歴を確認。
- v1→v3、v2→v3、v3再起動時に、既存の食事・体重・設定・レシピ・お気に入り・セット・外食snapshotを保持。利用者の実データを開かず、専用の合成データ／ブラウザープロファイルで検証。
- ブラウザー終了→オフライン再起動し、21店舗検索、ジョイフル登録・再読込、従来の保存データ保持を確認。
- ブラウザーのpage／consoleエラー0件。第3A-3操作中の自動外部サイトアクセス0件。
- 皿数・合計貫数・単位snapshotはbrowser-serving-units.cjsのテスト専用データで確認。実際の寿司商品を登録できたという結果ではありません。

ブラウザー検証：scripts配下のbrowser-check.cjs、browser-stage2.cjs、browser-stage3.cjs、browser-stage3a2.cjs、browser-stage3a3.cjs、browser-serving-units.cjs。既存Playwrightを使う場合はPLAYWRIGHT_MODULE、URLはAPP_URL=http://127.0.0.1:4175/meal-log/を設定します。結果と画像はGit対象外のtest-resultsへ保存します。

### iPhone実機での確認

1. GitHub Pages更新後、ホーム画面PWAの更新案内から新版へ切り替える。
2. 既存の食事・体重・設定・レシピ・お気に入り・セットが残っていること。
3. 外食トップの21店舗と「まぐろ」検索、店舗名・1皿／1貫／100ml／セットの表示。
4. ジョイフルのカート増減・登録と、KFC／CoCo壱／びっくりドンキーの従来操作。
5. PFC不足商品の検索・出典・お気に入りは可能で、登録は禁止されていること。
6. 初回更新完了後、機内モード→PWA終了→再起動し、検索・既存データ・登録可能商品の保存を確認。
7. 実際のノッチ・ホームインジケータ・日本語キーボード・ライト／ダークの使い勝手。

## 起動・公開・残る制約

```sh
pnpm install --frozen-lockfile
pnpm dev
pnpm test
pnpm run build
pnpm preview
```

GitHubへ反映する際は、差分を確認して利用者が実行してください。

```sh
git branch --show-current
git status --short
git diff --stat
pnpm test
pnpm run build
git add README.md src scripts data-sources/restaurants public/data/restaurants
git diff --cached --stat
git commit -m "Add stage 3A-3 restaurant data and serving units"
git push origin main
```

現在のブランチがmainであることを確認してください。mainへのpushで既存Actionsがtest→build→Pagesへデプロイします。raw・node_modules・dist・test-resultsは.gitignoreで除外済みです。

21チェーンの実商品収録は完了していますが、未公表PFC、提供量が特定できない値、原表内の矛盾、店舗限定品の網羅、今後のメニュー更新は制約として残ります。不足値を推測で埋めて登録可能にしていません。

引き続き未実装：ChatGPT取り込み、ショートカット本番連携、写真解析、バーコード、Open Food Facts、OCR、本格グラフ、自動傾向分析、体重×摂取カロリー分析、推定維持カロリー、残りPFC食事提案、CSV/JSON Export・Import、クラウド同期、アカウント、バックエンド。

以下は過去段階の記録です。件数・容量・未収録チェーンの記載は当時の状態を保存しています。

---

# 第3A-2時点の実装・検証記録

第3A-1の外食画面・カート・保存方式をそのまま使い、SUBWAY、なか卯、はなまるうどん、CoCo壱番屋、大戸屋、ロイヤルホスト、びっくりドンキーを追加しました。既存7チェーンのJSON・出典情報は変更していません。IndexedDBは **v3のまま**、追加のアプリ依存・バックエンド・有料サービスはありません。

**大戸屋は今回、検索・出典確認・お気に入りまでです。** 取得した公式資料に炭水化物が直接掲載されていないため、糖質と食物繊維を独自に合算せずCをnullで保持し、食事登録を制限しています。他チェーンも不明値は0にせず、必要な栄養値が揃わない商品を登録できない既存の安全処理を維持します。

## 第3A-2の収録データ

取得日はすべて **2026-09-08**。下表のvariantは公式表のサイズ・温冷・提供条件・店舗区分を区別した行数です。商品グループ数は `productGroupId` のユニーク数。公式に載っていることは、全店舗で現在販売していることを意味しません。

| チェーン | 商品グループ | variant | 登録不可 | JSON bytes | 公式資料・公開／更新日 |
| --- | ---: | ---: | ---: | ---: | --- |
| SUBWAY | 131 | 159 | 0 | 260,505 | [栄養成分表](https://subway.co.jp/documents/pdf/eiyo.pdf)、2026-09-02 |
| なか卯 | 159 | 349 | 0 | 602,487 | [栄養成分表](https://images.zensho.co.jp/materials/nakau/allergen/nutrition.pdf)、2026-09-04 |
| はなまるうどん | 246 | 449 | 0 | 779,273 | [栄養・アレルギー表](https://www.hanamaruudon.com/assets/pdf/allergy.pdf)、2026-09-03 |
| CoCo壱番屋 | 185 | 186 | 9 | 298,909 | [栄養成分表](https://www.ichibanya.co.jp/menu/pdf/nutrition.pdf)、2026-09-02 |
| 大戸屋 | 195 | 983 | 983 | 2,126,233 | [店舗別栄養情報](https://www.ootoya.com/menu_list/info/nutrition/27194)など6店舗、更新日記載なし |
| ロイヤルホスト | 563 | 2,978 | 37 | 5,640,064 | [公式資料一覧](https://www.royalhost.jp/safety/product_infomation.html)の10資料、2026-06-24／08-03／08-31 |
| びっくりドンキー | 198 | 369 | 0 | 695,104 | [栄養成分表](https://www.bikkuri-donkey.com/control-panel/uploads/2026/08/2026_0826_nutrition.pdf)、ページごとに2026-04-08／05-27／08-26 |
| 新7チェーン合計 | **1,677** | **5,473** | **1,029** | **10,402,575** | |
| 既存7チェーンを含む合計 | **2,793** | **7,452** | **1,032** | **13,738,853** | |

大戸屋は丸の内新東京ビル・小牧・宇都宮テラス・三田・泉北パンジョ・イオン相模原の6公式ページを収録。全店舗網羅ではありません。各URL・資料名・取得日・SHA-256・原資料名・変換方法は [sources.json](data-sources/restaurants/sources.json) の `sourceFiles` に保存しています。過去の7チェーンの出典記録も維持しています。

### 栄養素別の情報源内訳

以下は商品数ではなく、**各variantのkcal・P・F・Cの4セルを数えた件数**です。公式表の空欄等は出典URLを残した `unknown` とし、公式値に含めません。

| チェーン | official（現在公式） | official_old | secondary | estimate | unknown |
| --- | ---: | ---: | ---: | ---: | ---: |
| SUBWAY | 636 | 0 | 0 | 0 | 0 |
| なか卯 | 1,396 | 0 | 0 | 0 | 0 |
| はなまるうどん | 1,796 | 0 | 0 | 0 | 0 |
| CoCo壱番屋 | 724 | 0 | 0 | 0 | 20 |
| 大戸屋 | 2,949 | 0 | 0 | 0 | 983 |
| ロイヤルホスト | 11,802 | 0 | 0 | 0 | 110 |
| びっくりドンキー | 1,476 | 0 | 0 | 0 | 0 |
| 新7チェーン合計 | **20,779** | **0** | **0** | **0** | **1,113** |
| 14チェーン合計 | **28,690** | **0** | **0** | **0** | **1,118** |

新7チェーンの栄養値が一部不明のvariantは1,025件。これにCoCo壱の数値整合性を確認できない4件を加え、登録不可は1,029件です。現在の公式ページからリンクされている資料は、ページ更新月が古くても `official` とし、実際の更新日を栄養素ごとに残しています。現在商品へ過去・別サイズの値を流用していません。

### チェーンごとの計算・variant方針

- **SUBWAY**：おすすめのパン・ドレッシング等を含む公式標準構成と、パン・トッピング・ドリンク等の公式単品を区別。パン置換や野菜変更の独自差分計算はありません。単品を追加する際は、標準構成に既に含まれる材料の二重加算に注意してください。
- **なか卯**：公式に掲載された並盛・大盛等を選択。丼・麺・朝食・サイド等を公式の1食単位で収録。
- **はなまる**：公式のサイズ・温冷・沖縄／一部店舗等を分離。うどんと天ぷら・いなり等は別商品としてカートへ追加。PDF表境界の欠落セルは同じ原表の行と既知セルを照合して復元し、推測で埋めていません。
- **CoCo壱**：通常のライス300g、資料に明記された250gや100g／200g等だけをvariant化。基本カレー＋公式トッピング単品を合算し、米100gの独自足し引きはしません。パッケージ参照で値がない5件はnull。お子さまメニュー4件は公式掲載値を保存しつつ、kcalとPFCの整合性を解消できなかったため理由付きで登録不可です。
- **大戸屋**：糖質・食物繊維はCの原資料注記として残し、Cはnull。白ご飯込みの定食・単品・店舗を混同しません。糖質を炭水化物と同一視したり、合算値を現在公式Cとして登録したりしません。
- **ロイヤルホスト**：通常店、先行改定、都心中心部他、駒沢、那覇国際通り、駒沢パーククォーター、空港、九州大学病院、名古屋星ヶ丘、京都髙島屋S.C.の10資料を分離。朝食・ランチ・店舗限定の条件もvariantへ保持。同じ名前でも提供条件が違えば別行とし、37件の栄養不明商品は登録不可。
- **びっくりドンキー**：S／M／Lは公式表記のまま選択し、根拠のない150g等への換算はしません。ディッシュ・ステーキ・ランチ・持ち帰りを分離。符号付きの増減量は独立した食事商品として収録していません。

単純なセットの全組み合わせは生成しません。公式に独立した栄養値があるセット・定食は、その単位で収録します。数量を掛けた栄養値を商品ごとのMealEntryへ保存し、共通 `restaurantOrderId` で注文をまとめます。`restaurantSnapshot` は数量を掛ける前の1単位と栄養素別provenanceを保存します。

混在出典の代表 `sourceType` は既存規則を維持し、**estimate → secondary → official_old → official** の順に弱い情報源を優先。unknownを含む商品は保存前に拒否します。実データに過去公式・二次・推定は今回ありませんが、混在時の表示・保存をテストしています。公式JSONを更新しても過去MealEntryを再計算しません。

## 第3A-2の取得・変換・更新方法

通常の起動・build・GitHub Actionsでは取得も変換も行いません。生成済み7JSONをGitへ含め、raw PDF／HTML／抽出キャッシュは `.gitignore` の対象です。開発用のPythonには `beautifulsoup4` と `pdfplumber` が必要です。画像で照合する場合は `pypdfium2` を使います。

1. 各公式メニュー／栄養情報ページから現行資料を確認します。`fetch-stage3a2.py` のURL一覧は今回取得版です。新しいPDFへリンクが変わった場合は一覧も更新してください。
2. 未取得分だけの保存は `python scripts/restaurants/fetch-stage3a2.py --remaining`。既存ファイルは再取得しません。特定資料の更新は `--file nakau.pdf --refresh` 等で明示します。403／429を回避する処理はありません。
3. 自動取得できない資料は公式画面から手動保存します。CoCo壱は自動PDFダウンロードが403だったため、実際の公開PDF本文の読取結果を行単位で照合・転記しました。今回の再変換入力は [coco-reviewed.json](scripts/restaurants/coco-reviewed.json)。`prepare-coco-transcription.py` は今回版の全378行と日付を検証する補助スクリプトです。次版では公式PDFのページ・商品・分量・4栄養値・注記を照合して転記データを更新してください。SHA-256は保存した読取テキストに対するもので、PDFバイナリのハッシュではありません。
4. 必要なら `python scripts/restaurants/render-source.py hanamaru 6` のように資料名と1始まりのページ番号を指定し、rawディレクトリへ出力した画像で列境界を確認。取得日・公開日・原資料URLを更新し、新版の列位置・単位・商品名を確認してから変換します。
5. 今回取得版の再変換は `python scripts/restaurants/convert-stage3a2.py --retrieved-at 2026-09-08`。将来の再取得時は実際の取得日を指定します。`--chain nakau` 等で1チェーンのみの変換も可能。既存の `convert.py` は第3A-1の7JSONを再生成するため、今回の追加だけなら実行しません。
6. 必須列・特殊値・負値・ID重複・variant衝突・出典URL・件数下限を検証。新版の公開日が変わった場合も停止するため、日付だけ機械的に書き換えず原表と変換規則を再確認します。CoCo転記と大戸屋HTMLも、元資料の変更を人が照合してください。
7. `pnpm test` → `pnpm run build`。件数と差分を確認し、意図しない減少・サイズ混同・既存7JSONの変更があれば公開しません。旧7JSONのSHA-256一致を自動テストで確認します。名称変更によるID差分は確認が必要ですが、過去の記録はスナップショットなので残ります。

## 第3A-2のDB・PWA・検証結果

DB定義はv1／v2／v3をそのまま維持。テーブル追加・削除・clear・データ再計算はありません。静的JSONの読込対象と外食入口の表示を14チェーンへ拡張しただけで、カート・保存・集計・既存7チェーンの動作を再利用しています。

`/meal-log/`、manifest、アイコン、Service Worker、main push時の既存test → build → Pages workflowを維持。外食14JSON合計 **13,738,853 bytes（約13.10MiB）**。食品DBも含むprecache対象は30エントリー、重複URLを除く25ファイルの実サイズ合計 **15,419,024 bytes（約14.70MiB）**。最大JSONは約5.38MiBで、既存の1ファイル6MiB上限内です。raw資料は配信・precacheされません。キャッシュは数十MB未満ですが、実機の空き容量やSafariの保存領域管理まで保証するものではありません。

2026-09-09、ローカル本番ビルドを `/meal-log/` で確認しました。

| 確認項目 | 結果 |
| --- | --- |
| 依存インストール | frozen-lockfileで成功。追加アプリ依存なし |
| 全自動テスト | **143件成功**（既存101件＋第3A-2の42件）、6ファイル |
| TypeScript／本番build | `tsc -b`、`pnpm run build` とも成功、PWA生成成功 |
| データ品質 | 新7JSONの件数・ID・variant・出典・unknown・サイズ／分量、旧7JSONのSHA-256一致を確認 |
| 既存データ | v1→v3、v2→v3、v3再起動で既存記録を保持。v2／v3の全6テーブルと外食スナップショットも確認 |
| 新外食操作 | 新7店舗の検索・出典・variant・お気に入り。登録可能な6店舗の複数商品・数量・注文保存・ホーム・履歴反映。大戸屋はC不明と登録不可を確認 |
| 既存機能 | 第1・第2段階の食品・レシピ・セット等、およびKFCの検索→variant→出典→カート増減／削除→登録→履歴を回帰確認 |
| 画面 | Chromeの390×844／320px、ライト／ダーク、キーボードを想定した高さ440pxでも横スクロールなし |
| オフライン | 専用ブラウザー終了→通信OFF→再起動で新7店舗検索、食事登録、再読込、保存データ保持に成功。14JSONと食品DBをキャッシュ確認 |
| エラー | ブラウザーのページ／コンソールエラー0件。新7操作中の自動外部サイトアクセス0件 |

ブラウザー検証スクリプトは `scripts/browser-check.cjs`、`browser-stage2.cjs`、`browser-stage3.cjs`、`browser-stage3a2.cjs`。`APP_URL` を本番previewの `/meal-log/` URL、`PLAYWRIGHT_MODULE` を利用可能なPlaywrightへ設定して実行します。検証は専用の合成データ・ブラウザープロファイルを使い、利用者の保存データは開きません。結果・画像はGit対象外の `test-results/` へ保存します。実機Safariの検証とは区別してください。

第3A-3で残る実メニューDBは **ガスト、ジョイフル、天下一品、餃子の王将、スシロー、くら寿司、はま寿司**。既存21チェーン一覧は維持します。その他の今回未実装機能は末尾に記載しています。

## 第3A-1時点の実装・検証記録

以下の第3A-1／第2段階の件数・容量・対象チェーンは当時の記録です。第3A-2の現在値は上記を参照してください。起動方法、DB・食品・レシピ仕様は引き続き有効です。

iPhone 14向けのカロリー・PFC・体重記録PWA。React / TypeScript / Vite / Dexieを使用。追加料金0円、バックエンド・有料API・ログイン・クラウド同期なし。個人データは端末のIndexedDBだけに保存します。

第1・第2段階は利用者がGitHub Pages・iPhone 14実機・PWA更新・IndexedDB v1→v2移行・オフライン動作を確認済み。第3A-1では7チェーンの公式外食DBを追加します。commit / pushは自動実行しません。

## 第3A-1で追加した機能

- 店名・商品名・別名・サイズの横断検索。全半角、英字大小、ひらがな／カタカナを吸収。
- 店舗別検索・カテゴリー、商品からサイズ／地域／温冷を選択、栄養素別の出典表示。
- 商品を「今回の食事」へ追加。数量1〜99、削除、合計kcal/PFC、食事区分・日時を指定して一括保存。
- 店舗・外食商品のお気に入り保存／解除。外食トップと既存のお気に入り画面から再利用。
- 最近使った店はMealEntryから日時と頻度で導出。同じ注文の商品数で回数を水増ししません。
- 商品ごとのMealEntryと共通restaurantOrderIdを保存し、履歴に同じ外食の合計を表示。
- 栄養値・商品名・サイズ・出典・版をスナップショット保存。前日コピーでも保存値を維持し、注文IDだけ新しくします。

## 外食DBの出典・収録範囲

取得日 **2026年9月8日**。すべて実際に取得・確認した公式HTML／PDF／商品ページの値です。検索スニペット、第三者サイト、AIの推定値は使用していません。「現在」は取得時に公式栄養表へ掲載されていることを指し、各店舗の販売状況を保証しません。

| チェーン | 商品グループ | サイズ・地域別variant | 公開・更新日 | 公式資料 | JSON bytes |
| --- | ---: | ---: | --- | --- | ---: |
| マクドナルド | 142 | 201 | 2026-09-02 | [公式栄養成分一覧HTML](https://www.mcdonalds.co.jp/quality/allergy_Nutrition/nutrient/) | 329,446 |
| KFC | 46 | 65 | 2026-09-02 | [公式栄養成分表PDF](https://assets.ctfassets.net/jax7ylg56usf/63NsvjRmBbpZRdG8l926iQ/6e3ccb242aff8ffb2138f37b3243a5e8/44f7edfe-ba19-463b-9de5-3e8a383e833e.pdf) | 122,031 |
| モスバーガー | 173 | 205 | 2026-08-28 | [公式栄養成分表PDF](https://www.mos.jp/menu/pdf/nutrition.pdf) | 310,832 |
| すき家 | 191 | 499 | 2026-08-18 | [公式栄養成分一覧PDF](https://images.zensho.co.jp/materials/sukiya/allergen/nutrition.pdf) | 843,428 |
| 吉野家 | 158 | 226 | 2026-08-27、258号 | [公式メニュー情報PDF](https://www.yoshinoya.com/pdf/allergy/) | 340,023 |
| 松屋 | 348 | 656 | 2026-09-01／2026-06-23 | [通常店PDF](https://www.matsuyafoods.co.jp/matsuya/pdf/260901_nutritional_matsuya.pdf)、[PA・SA店PDF](https://www.matsuyafoods.co.jp/matsuya/pdf/260901_nutritional_matsuya_pa_sa.pdf)、[牧之原SA店PDF](https://www.matsuyafoods.co.jp/matsuya/pdf/260623_nutritional_matsuya_makinohara.pdf) | 1,190,070 |
| 丸亀製麺 | 58 | 127 | 栄養情報の更新日は記載なし | [公式メニュー](https://jp.marugame.com/menu/)内の58商品ページ | 200,448 |
| 合計 | **1,116** | **1,979** | | | **3,336,278** |

JSON合計は約3.34MB（3.18MiB）。サイズを除いた同一名を商品グループとして数えます。商品・variantとも更新日や栄養値をIDに使わず、チェーン＋正規化した正式名＋公式サイズ＋地域のSHA-256先頭16桁を利用。正式名称の変更時はIDが変わるため、更新時に差分確認が必要です。過去のMealEntryは旧IDでもスナップショットから表示できます。

資料ファイル・商品ページごとのURLとSHA-256、取得日、変換方法、件数は [sources.json](data-sources/restaurants/sources.json) に保存。松屋の2026年6月資料は現在も公式ページから案内される牧之原店用資料であり、現在商品のPFCを過去資料で穴埋めしたものではありません。

### 正確性のための区分・例外

- マクドナルド通常店とMcCafé by Barista、モスの中京エリアとモスバーガー＆カフェ、松屋の通常店・PA/SA・牧之原・沖縄を区別。同じ名称・サイズでも値が異なるものを混ぜません。
- 吉野家PDFの多言語重複は除外。同じPDFに載る別ブランド **C&C限定メニュー24行は対象外**。沖縄・店舗限定の吉野家商品は収録します。
- 松屋の「ライス量変更」「定食からセット変更」等の栄養増減行は食品ではないため除外。メインメニューは公式の注記どおりみそ汁込みです。みそ汁の重複追加に注意してください。
- モスの冷凍モスチキン・ローストチキンは公式の可食部100g単位と明記。1個の値へ換算しません。
- セットの全組み合わせは生成しません。バーガー、サイド、ドリンク、うどん、天ぷら等をカートで組み合わせます。公式表に独立した行として掲載された定食・弁当・小セットは、その公式単位を収録します。
- すき家・松屋のPDFの縦書きカテゴリーは目視照合した区切りで復元。KFCは公式表にカテゴリ列がないため商品名からUI用に分類し、正式商品名・値は維持します。
- 期間限定は公式ページに明示されたときだけtrue。明示情報がない表はnullであり、「通常販売」と推測しません。丸亀製麺は公式の期間限定アイコン情報と、実際に掲載されている温冷・サイズだけを使用します。

### 栄養素ごとのprovenance・不明値

各variantはkcal/P/F/Cそれぞれに `value / sourceType / sourceUrl / sourceTitle / publishedOrUpdatedAt / retrievedAt / notes` を持ちます。元のセル表記は `rawNutrients` に保持。現在公式・過去公式・二次情報・推定・不明を文字で区別します。

今回の1,979variantは全件が現在の公式資料由来です。**4栄養素がそろう1,977件、一部または全部不明2件**。栄養素単位では現在公式7,911値、不明5値、過去公式0・二次情報0・推定0です。公式自体が配合から計算した値も「公式」であり、アプリが推定した値とは区別します。

- 空欄、ダッシュ、未測定・未分析、参照記号「※」はnull。未対応の記号・負値は変換エラー。
- 松屋「生ジョッキ缶」のPは公式表が `0.68～1.36` の範囲表記。平均値や0へ置き換えず、Pをnullにして原表を表示します。
- 吉野家「ロースかつカレー」は公式表が別項目参照のため4値がnull。組み合わせを推測計算しません。
- 不明PFC2件は検索・出典参照・お気に入りのみ。**栄養値がそろわない商品のカート追加・食事登録はUIと保存処理の両方で拒否**します。従来の数値必須MealEntryと日次集計を変更せず、不明を0gとして集計することを防ぎます。
- ほかに吉野家の沖縄限定コカ・コーラは、原表の量欄がアイスの「シングル」と結合され、確実な量を判断できないため登録不可。隣の「さんぴん茶100ml」から量を流用しません。登録不可は合計3variantです。

食事には数量を掛けたkcal/PFC、数量、元商品の全情報を保存。`restaurantSnapshot` とprovenance内の値は登録時の**1単位当たり**です。履歴で栄養を手動編集すると「手入力」に変わり、元情報は「登録時の出典」として保持します。元商品更新・削除で過去の食事を再計算しません。

### 外食DBの更新方法

通常のインストール・build・GitHub Actionsでは外部サイトを取得せず、生成済みJSONだけを使用します。更新作業時のみPythonの無料ライブラリを使います（アプリの依存には追加していません）。

```sh
python -m pip install beautifulsoup4 pdfplumber
python scripts/restaurants/fetch-sources.py
python scripts/restaurants/fetch-marugame.py
python scripts/restaurants/convert.py --retrieved-at 2026-09-08
```

1. 各公式案内で公開版・URLを確認。将来の更新ではfetchスクリプトのURL、convert.pyのSOURCESの版・日付を実際の資料に合わせて変更します。PDFリンクは日付やファイルIDが変わります。
2. 既存raw資料を保存した上で、明示的に `--refresh` を付けて再取得。既定では取得済みファイルを再利用します。取得日は実際に取得した日を指定してください。
3. 403・429や取得エラーを無理に回避しません。必要なら公式ページからブラウザーで保存し、スクリプトに指定された `data-sources/restaurants/raw/` のファイル名へ配置。丸亀はページのHTML（公開 __NEXT_DATA__ を含む）を保存します。
4. 変換は必須列・版の日付・ページ構造・件数の下限・負値・未知記号・ID/variant衝突で停止します。すき家のカテゴリー境界の商品名が変わった場合も停止。想定外の変更はPDF/HTMLを目視確認し、変換規則を直してください。`inspect-pdf.py` で手元PDFの文字・表を抽出できます。
5. 名称、サイズ、地域、朝メニュー、付属品、100g単位を再照合。名称変更によるID差分、収録件数の増減、版・取得日・JSONサイズを確認し、READMEとテストの期待件数を更新します。各チェーンの全検証が成功するまで既存JSONを置き換えません。
6. `pnpm test` → `pnpm run build` → 本番プレビューでオフライン確認。生成済み7JSONとsources.jsonをGit対象にします。元PDF/HTML、キャッシュ、テスト結果は.gitignore対象です。

### 第3A-1の保存・オフライン仕様

IndexedDBはv3。v1・v2のスキーマを残し、既存6テーブルを消去・再作成せず、mealsへ店舗ID・注文IDのインデックスだけを追加。MealEntryの外食フィールドはすべてoptionalです。favoritesは既存テーブルに2種別を追加し、専用の店舗履歴テーブルは作りません。

7JSONはViteのpublic/dataに置き、Service Workerで事前キャッシュ。初回更新完了後は店検索・商品検索・詳細・カート・食事登録・お気に入り・最近使った店をオフライン利用できます。出典リンクは利用者が開いた場合だけ外部サイトへ移動します。PWAの `/meal-log/`、manifest、アイコン、更新通知、既存Actionsを維持します。

## 維持する第1・第2段階の機能

- 日本食品標準成分表2,538食品のオフライン検索。部分一致、全半角、英字大小、ひらがな／カタカナ、主要な日本語別名に対応。
- 重量指定による栄養計算と登録。50 / 100 / 150 / 200 / 250g、自由入力。
- 食事追加に最近使ったもの、食品検索、レシピ、お気に入り・履歴、セット、かんたん入力、手動入力、外食の入口。
- レシピの作成・検索・編集・複製。材料と食数による全体・1食分計算。食事登録は1食分または全体の1/2・1/3・1/4。
- 今回だけ材料変更、確認して元レシピを上書き、別名レシピとして保存。
- 食品＋重量、レシピ＋割合、セットのお気に入り保存・解除・再利用。
- 食品・レシピをまとめた「いつものセット」の作成・編集・一括登録。
- 表示日の前日の食事を区分ごとに選び、確認してコピー。コピー済み記録は除外。
- 名前省略可能なカロリーだけの入力。PFCは0g。
- 外食21チェーンの一覧を維持。今回の7チェーンを除く14チェーンは案内画面。

第1段階のホーム、履歴・詳細・編集・削除、手入力、体重、目標・表示設定、簡易分析は維持しています。

## 食品DBの出典・版

**日本食品標準成分表（八訂）増補2023年から引用・加工**。文部科学省の第2章Excel「表全体」シートを使い、第三者の栄養サイトや架空値は使用していません。

| 項目 | 内容 |
| --- | --- |
| 版 | 日本食品標準成分表（八訂）増補2023年 |
| 公式Excel更新日 | 2026年3月27日（正誤反映版） |
| 取得日 | 2026年9月7日 |
| 食品数 | 2,538件。未測定を含む1食品は検索・参照のみで自動登録不可 |
| 公式案内 | https://www.mext.go.jp/a_menu/syokuhinseibun/mext_00001.html |
| 取得Excel | https://www.mext.go.jp/content/20260327-mxt_kagsei-mext-000029402_02.xlsx |
| 正誤表 | https://www.mext.go.jp/content/20260327-mxt_kagsei-mext-000029402_16.xlsx |
| 抽出列コード | kcal: ENERC_KCAL / P: PROT- / F: FAT- / C: CHOCDF- |
| 基準 | 可食部100gあたりのkcalとg |

通常の「たんぱく質」「脂質」「炭水化物」を使い、アミノ酸組成・トリアシルグリセロール当量・利用可能炭水化物とは区別しています。エネルギーは公式kcalを使い、PFCの4/9/4から再推計しません。

更新済みExcelへ正誤表は二重適用しません。採用するPFC列に関する正誤2件（06372の炭水化物4.3g、10470の炭水化物12.2g）は取得ファイルで反映済みと照合しました。取得URL・版・件数・元ExcelのSHA-256は `data-sources/mext-source.json` に記録しています。

### 食品データの変換

Python 3.10以上と無料OSSのopenpyxlによる読み取り専用変換です。通常の起動・build・GitHub Actionsでは再取得やPythonは不要です。

```sh
python -m pip install openpyxl
python scripts/convert-foods.py --download --retrieved-at 2026-09-07
```

再取得時は実際の取得日へ変更してください。URLは今回検証した公式版に固定しています。新しい版を採用する場合は公式サイトの版・列・特殊値・正誤を確認してスクリプトを更新します。

ダウンロード済みExcelだけで再変換する場合：

```sh
python scripts/convert-foods.py --input data-sources/mext-2023-20260327.xlsx --retrieved-at 2026-09-07
```

食品番号を安定したID（例：mext-01088）にし、列コードでPFCを抽出します。別名は検索補助にだけ使い、正式食品名や栄養値を置き換えません。未知の特殊値、ID重複、想定外の少ない件数はエラーです。元ExcelはGit対象外、変換済み `public/data/mext-foods.json` と出典JSONはGitへ含めます。

### 特殊値の扱い

元表記は `Food.raw`、意味は `Food.status` に残します。[公式の表示記号説明](https://fooddb.mext.go.jp/help.html)に基づき、以下の規則を採用しています。

| 表記 | 保存・計算 |
| --- | --- |
| 数値・0 | 数値のまま。公式の0には表示限界未満や検出されない値を含む |
| (数値)・(0) | 数値と公式推定値の状態を保持。計算に利用し、注記を表示・食事へ保存 |
| Tr・(Tr) | 数値フィールドはnull。計算時だけ0として近似し、「微量を0として近似」の注記を表示・保存 |
| -・空欄・未測定 | null。0で補完せず、自動計算による食事登録・材料追加を停止 |

PFCのTrは最小記載量0.1gの1/10以上・5/10未満（0.01g以上0.05g未満）です。0への近似は実測ゼロを意味しません。量や材料数が多いと微量分が積み重なります。推定値はAI補完ではありません。

今回の4列には推定値846セル、Tr173セル、推定Tr6セル、未測定2セルがあります。未測定2セルは「わかめ カットわかめ 水煮の汁」のPとFです。

## 計算とスナップショット

- 食品：公式100g値 × 可食部の重量 / 100。生・ゆで・焼きなどは別食品です。
- レシピ全体：材料ごとの100g値 × 重量 / 100 の合計。1食分は全体 / 設定食数。
- 「全体の1/2・1/3・1/4」はレシピ全体に対する割合。「1食分」は食数の逆数です。
- **完成後の料理重量入力、完成品100gあたりの再計算は実装していません。**
- レシピ材料は選択時の食品の100g値・名前・版・注記を保持。食品DBを更新しても保存済み材料値は変わりません。最新値にするには食品を選び直してください。
- 食事は登録時点のkcal/PFCをコピーして保存。元食品・レシピを変更しても過去の食事は再計算しません。レシピ食事は材料・食数もスナップショット保存します。
- 今回だけの材料変更は元レシピへ保存せず、上書きは専用確認ボタン、別名保存・複製は新IDです。
- 小数は計算・保存で維持し、表示だけ丸めます。合算の浮動小数誤差は小数6桁で整えます。PFC小数表示設定は新画面にも反映します。

## お気に入り・最近使ったもの・セット

- お気に入りは種別・参照ID・量を保存。同じ食品の100gと200gは別候補。同じ種別・ID・量は重複しません。
- レシピのお気に入りは全体に対する割合を保存。元の食数を変更しても保存済み割合は維持します。お気に入りは現在の保存済みレシピ・セットを開きます。
- 最近使ったものはMealEntryから導出。使用ごとに `1 / (1 + 経過日数 / 7)` を足し、同点は直近日時で並べます。専用の利用履歴テーブルはありません。
- 最近の食品は前回重量、レシピは前回の材料と割合、セットは前回の登録グループから再構築した構成を初期値にします。セット内の複数MealEntryを使用回数として二重カウントしません。
- セットは構成要素の量・栄養スナップショット・合計を保持。元レシピ変更で自動更新されません。必要時に構成を追加し直すか、セットの量を編集します。
- セット登録はトランザクションで通常のMealEntry群を一括追加。一部だけの登録は起こらず、セット名と登録グループIDを参照できます。

## 前日コピー・かんたん入力

前日コピーは表示日の前日→表示日。区分を選んで確認し、元の栄養値・時刻・出典を新IDで複製します。`copiedFromId + copyTargetDate` をトランザクション内で確認するため、連打や同時実行でも同じ元記録を二重コピーしません。別途手動で登録した似た食事を自動判定して削除することはありません。

かんたん入力はカロリー必須、名前省略時は「かんたん入力」、PFCは0、sourceTypeはmanualです。

## IndexedDB v1 → v2 → v3

DB名は引き続き **meal-log**。`version(1)` の定義を残し、`version(2)` を追加。第3A-1ではv1・v2定義を両方残し、v3でmealsのrestaurantId / restaurantOrderIdインデックスだけを追加。Dexieによる追加スキーマ移行が初回起動時に自動で行われます。手作業によるデータ消去は不要です。

| テーブル | 変更 |
| --- | --- |
| meals | 既存行は無変更。sourceId、setId、コピー元・対象日の複合インデックス追加 |
| weights / settings | スキーマ・データとも維持 |
| recipes | v2の材料配列・食数・名前・日時を保持 |
| favorites | v2の既存行を保持。kindにrestaurant / restaurantMenuを追加。スキーマ変更なし |
| mealSets | v2の構成要素・合計・日時を保持 |

材料はrecipes内へ埋め込み、食数と原子的に保存します。食品・外食メニューは静的JSON、店舗は静的一覧。不要な空テーブルは作りません。

MealEntryへ追加したsourceId / quantity / unit / sourceVersion / notes / recipeSnapshot / setId / setName / setRunId / copiedFromId / copyTargetDateはすべてoptional。従来記録は補完や書換えなしで読めます。DBのclear・deleteによる初期化はありません。既存の食事編集でも出典等の追加フィールドを保持します。日次合計は従来どおりMealEntryから計算します。

テストでは旧DBに食事・体重・設定を入れて更新し、完全一致で残ることを確認します。ブラウザーテストも専用プロファイルに旧版のネイティブIndexedDBを作成して移行し、利用者のブラウザーデータには触れません。

## 次の第3A-2以降

実メニューデータが残る14チェーン：SUBWAY、なか卯、はなまるうどん、CoCo壱番屋、大戸屋、ロイヤルホスト、ガスト、びっくりドンキー、ジョイフル、天下一品、餃子の王将、スシロー、くら寿司、はま寿司。今回の実装には含めていません。

## 起動・テスト

Node.js 24 LTSを推奨。npmの場合：

```sh
npm install
npm run dev
npm test
npm run build
npm run preview
```

ロックファイルで依存関係を揃える場合（GitHub Actionsも同じ構成）：

```sh
npm install --global pnpm@11.19.0
pnpm install --frozen-lockfile
pnpm test
pnpm run build
pnpm run preview
```

開発は `http://localhost:5173/meal-log/`、本番プレビューは `http://localhost:4173/meal-log/`。開発モードのService Workerは無効なので、オフライン確認には本番プレビューを使います。自動テストは既存24件に食品・レシピ・お気に入り・セット・コピー・移行・再接続等を追加しています。

ChromeとPlaywrightを別途使える環境では、プレビュー起動後にブラウザーテストも可能です。Playwrightはアプリの依存に含めていません。既存のインストールを使う場合は `PLAYWRIGHT_MODULE` にモジュールへのパスを指定します。

```sh
node scripts/browser-check.cjs
node scripts/browser-stage2.cjs
node scripts/browser-stage3.cjs
```

第1段階のテストの既定URLはlocalhost:4173、stage2の既定URLは127.0.0.1:4175（いずれも末尾は /meal-log/）。別ポートでは `APP_URL` にプレビューURLを設定してください。出力と専用プロファイルはGit対象外の `test-results/` です。

## 第3A-1の最終確認結果

2026年9月8日、ローカルの本番ビルドを `/meal-log/` で確認。

| 確認 | 結果 |
| --- | --- |
| インストール | pnpm 11.19.0 / frozen-lockfile / キャッシュから成功。アプリ依存の追加なし |
| 自動テスト | **101件成功**（第1・第2段階69件＋外食32件）、5ファイル |
| TypeScript・本番build | `pnpm run build` 内の `tsc -b && vite build` 成功 |
| PWA | Service Worker・manifest生成成功。23ファイル、4,898.20KiBを事前キャッシュ |
| v1データ | 食事・体重・設定をv3で完全一致保持。単体テストと実ブラウザーで確認 |
| v2データ | 食事・体重・設定・レシピ・お気に入り・セットの全6テーブルを完全一致保持 |
| 第1・第2段階の回帰 | browser-check.cjs / browser-stage2.cjs 成功。手入力、体重、設定、履歴編集削除、食品、レシピ、セット、コピー等を確認 |
| 外食操作 | 横断検索、KFC、サイズ選択、出典、店舗・商品のお気に入り、数量増減・削除、合計、昼食一括登録、ホーム・履歴反映に成功 |
| 画面 | Chrome 390×844 / 320px、ライト／ダークで横スクロールなし。商品詳細を上まで戻してもカートバーを表示 |
| オフライン | 専用ブラウザー終了→通信OFF→再起動。7JSONをキャッシュから読込、検索・出典詳細・登録・再読込・既存データ保持に成功 |
| エラー | 3本のブラウザーテストでページ・コンソールエラー0件 |

自動テストの結果を実機Safariの結果とは扱っていません。iPhone 14では公開後、次を確認してください。

1. オンラインで既存PWAを開き、入力を保存して更新通知の「更新」を選ぶ。データ消去やPWAの削除は不要。
2. 既存の食事・体重・設定・レシピ・お気に入り・セットが残っていることを確認。
3. 外食でKFC等を選び、商品・サイズ・出典を確認。複数商品を追加し数量を変えて登録、ホームと履歴の合計を確認。
4. 店舗・商品の☆を登録し、次回も表示されることを確認。320px相当は自動確認済みですが、実機でキーボード・セーフエリア・スクロールも確認。
5. 機内モードでWi-FiもOFFにし、PWAを終了して再起動。検索・登録・再起動後の保存を確認。

ローカルの結果JSONと画面画像はGit対象外の `test-results/` に保存しています。commit / pushは実行していません。

## 第2段階完了時の確認記録（参考）

2026年9月7日、ローカルの本番ビルドを `/meal-log/` 配下で確認しました。

| 確認 | 結果 |
| --- | --- |
| 固定依存のインストール | pnpm 11.19.0、frozen-lockfileで成功。追加のアプリ依存なし |
| 全自動テスト | 69件成功（既存24件＋追加45件）、4ファイル |
| TypeScript・本番ビルド | `pnpm run build`（`tsc -b && vite build`）成功 |
| PWA生成 | 16ファイル、約1.6MiBを事前キャッシュ。食品JSONを含む |
| 旧データ移行 | v1の食事・体重・設定をv2で完全一致確認。単体テストと実ブラウザー双方で成功 |
| 第1段階の回帰確認 | 手入力、体重、設定、履歴の編集・削除、分析、再起動・保存を確認 |
| 第2段階の操作 | 食品・重量・お気に入り、レシピ作成・今回のみ変更・編集・複製、セット、コピーと重複防止、かんたん入力、外食案内を確認 |
| セットの異常入力 | 空欄・不正な量を検出し、修正後のリアルタイム再計算・登録を確認 |
| 画面 | Chromeで390×844、ライト・ダーク、320px幅の主要画面で横スクロールなし |
| オフライン | 専用ブラウザーを終了後、通信OFFで再起動。全テーブルの再読込、食品検索・登録、レシピ登録に成功 |
| コンソール | ブラウザーテスト2本ともページエラー・コンソールエラー0件 |

第2段階のiPhone実機Safari・ホーム画面PWAは、その後利用者が確認済みです。第3A-1は改めて実機で確認してください。ブラウザーテストはChromeのモバイル相当設定であり、実機検証と区別しています。結果JSONと画面画像はローカルの `test-results/` に保存します。

## PWA・オフライン・GitHub Pages

Vite base、manifestのid・start_url・scope、Service Worker、各アイコンは `/meal-log/` を維持。食品JSON約1.22MBもService Workerで事前キャッシュします。実行時の食品取得は自分自身の静的JSONのみで外部APIを呼びません。初回の準備完了後は新旧の全記録機能をオフライン利用できます。

既存の `.github/workflows/deploy.yml` を維持し、mainへのpushで固定依存インストール → 全テスト → build → Pages公開。変換済み食品JSONはGitへ含め、元Excel・node_modules・dist・テスト結果は含めません。[初回公開手順](docs/GITHUB_PAGES.md)

更新内容を利用者が確認して実行するコマンド：

```sh
git status --short
git add .
git commit -m "Add stage 3A-2 restaurant datasets and verification"
git push origin main
```

iPhoneではオンラインで既存PWAを起動し、入力を保存して更新通知の「更新」を選びます。旧記録・体重・設定の保持、食品検索・レシピ・セット・コピーを確認し、最後に機内モード（Wi-FiもOFF）で再起動・登録してください。SafariのWebサイトデータ消去やPWA削除による更新は不要です。

## 主要ファイル

- `src/pages/add/`：追加方法、食品、レシピ編集・一覧、セット、お気に入り、かんたん入力、外食。
- `src/pages/CopyMeals.tsx`：前日コピー。
- `src/domain/catalog.ts` / `foods.ts` / `recents.ts`：型、計算・検索、最近使用の導出。
- `src/data/db.ts` / `catalogRepository.ts` / `copyMeals.ts` / `foods.ts`：非破壊移行・保存・静的読込。
- `src/components/CatalogParts.tsx` / `src/styles/catalog.css`：共通UI。
- `public/data/mext-foods.json` / `scripts/convert-foods.py` / `data-sources/mext-source.json`：食品・変換・出典。
- `public/data/restaurants/*.json` / `scripts/restaurants/` / `data-sources/restaurants/sources.json`：14チェーンの静的メニュー・再取得変換・出典とSHA-256。
- `src/domain/restaurantMenus.ts` / `src/data/restaurantMenus.ts` / `restaurantRepository.ts`：検索・数量・合計・読込・注文保存。
- `src/pages/add/Restaurants.tsx` / `RestaurantDetail.tsx` / `RestaurantCart.tsx` / `src/components/RestaurantParts.tsx`：外食画面と栄養素別の出典表示。
- `src/data/restaurants.test.ts` / `src/data/stage3a2.test.ts` / `scripts/browser-stage3.cjs` / `scripts/browser-stage3a2.cjs`：外食データ・保存・v2/v3データ保持・ブラウザー・オフラインの検証。

## 今回未実装

残り7チェーン（ガスト、ジョイフル、天下一品、餃子の王将、スシロー、くら寿司、はま寿司）の実メニュー栄養DB、バーコード／Open Food Facts、OCR、ChatGPT取り込み、iPhoneショートカット本番連携、本格的なグラフ、自動分析、体重と摂取の関連分析、推定維持カロリー、献立提案、CSV/JSON出入力、クラウド同期、アカウント、バックエンド。料理完成後の重量入力も実装していません。
