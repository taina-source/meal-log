# GitHub Pagesへの初回公開

このプロジェクトは、既存のリポジトリ **meal-log** へソースをpushすると、GitHub Actionsがテスト・ビルドし、GitHub Pagesに公開する設定です。こちらではGitの初期化・コミット・push・GitHub側の設定変更は行っていません。

以下の `YOUR_NAME` はGitHubのユーザー名（リポジトリが組織にある場合は組織名）へ置き換えてください。

## 1. GitHub側の公開設定を選ぶ

ブラウザーで作成済みの `meal-log` リポジトリを開きます。

1. リポジトリ名の横に **Public** とあることを確認します。GitHub FreeでPagesを無料利用する場合は公開リポジトリを使います。
2. **Settings** → 左側の **Pages** を開きます。
3. **Build and deployment** の **Source** を **GitHub Actions** に変更します。「Deploy from a branch」は選びません。

空のリポジトリではPages設定がまだ表示されない場合があります。その場合は初回push後に上記を設定し、Actions画面で **Re-run all jobs** を押してください。

独自ドメイン・有料プラン・個人アクセストークンのSecrets登録は不要です。workflowはGitHubが発行する `GITHUB_TOKEN` を使います。[無料利用条件](https://docs.github.com/en/pages/getting-started-with-github-pages)、[ActionsによるPages公開](https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages)

## 2. リポジトリが空か確認する

GitHubの **Code** タブを見ます。

- **Quick setup** が表示され、ファイルがない場合：次の「3」へ進みます。
- READMEやLICENSEなど、すでにファイルがある場合：後半の「既存ファイルがある場合」を使います。既存の履歴を消す必要はありません。

## 3. PowerShellでプロジェクトを開く

Windowsのターミナル／PowerShellを開いて、次を実行します。

```powershell
cd "C:\Users\n_tai\Documents\Meal-Log"
git --version
```

`git` が見つからない場合は [Git for Windows](https://git-scm.com/download/win) をインストールし、ターミナルを開き直してください。

## 4. Gitを初期化する

ローカルフォルダーはまだGit管理されていないため、次を実行します。

```powershell
git init -b main
```

Gitの名前・メールをまだ設定していない場合は、次も実行します。名前はコミットに表示する名前、メールはGitHubのSettings → Emailsにある自分のメールまたはnoreplyアドレスに置き換えます。このリポジトリだけに適用されます。

```powershell
git config user.name "あなたの表示名"
git config user.email "あなたのメールアドレス"
```

## 5. ファイルを登録し、確認する

```powershell
git add .
git status --short
```

`src`、`public`、`.github/workflows/deploy.yml`、`package.json`、`pnpm-lock.yaml`などが表示されます。`node_modules`、`dist`、`.pnpm-store`、`test-results`は `.gitignore` により除外されます。`dist`を手動で追加する必要はありません。

確認後、コミット（ローカルでの保存）を作成します。

```powershell
git commit -m "Prepare Meal Log for GitHub Pages"
```

## 6. GitHubリポジトリと接続する

GitHubの **Code** → **HTTPS** からURLをコピーし、次のURL部分に使ってください。

```powershell
git remote add origin https://github.com/YOUR_NAME/meal-log.git
git remote -v
```

表示されるURLが自分の `meal-log` であることを確認します。

## 7. 初回pushする

このコマンドで初めてGitHubへ送信され、公開処理が始まります。

```powershell
git push -u origin main
```

ブラウザーでサインインを求められたら、自分のGitHubアカウントでログインしてください。

`rejected` や `fetch first` と表示された場合は、GitHub側にすでにコミットがある可能性があります。`--force` は使わず、「既存ファイルがある場合」の手順を使ってください。

## 8. 公開完了を確認する

1. GitHubの **Actions** タブを開きます。
2. **Deploy Meal Log to GitHub Pages** の実行を開きます。
3. `build` と `deploy` の両方に緑のチェックが付くまで待ちます。
4. **Settings → Pages → Visit site**、または実行結果の公開URLを開きます。

通常の公開URLは `https://YOUR_NAME.github.io/meal-log/` です。実際のURLはPages画面で確認できます。

赤いチェックの場合は失敗した工程を開きます。Pages未設定なら手順1を済ませて再実行してください。組織のActions制限などがある場合は、表示されたエラーを確認します。ローカルでのテスト・ビルドは確認済みですが、GitHub上での実行は初回push後に確認します。

## 9. iPhoneのホーム画面に追加する

Safariで公開URLを開き、オフラインの準備完了を確認してから、共有メニュー → **ホーム画面に追加** を選びます。ホーム画面から起動して食事を登録し、一度閉じて再起動してください。さらに機内モード（Wi-FiもOFF）で起動・保存を確認します。

ローカルプレビューとGitHub Pagesは別の保存先です。ローカルに登録した食事は公開先へ自動転送されません。アプリには端末データをGitHubへ送る処理はありません。

## 次回からの更新

変更を保存して次を実行すると、同じworkflowが自動で公開します。

```powershell
git add .
git commit -m "Update Meal Log"
git push
```

更新後、アプリに更新通知が出たら、入力を保存してから「更新」を選びます。

## 既存ファイルがある場合

GitHubにREADME等がある場合は、そのリポジトリを**別の新しいフォルダー**へcloneし、今回のソースをコピーします。以下の `meal-log-publish` がまだ存在しない状態で実行してください。

```powershell
cd "C:\Users\n_tai\Documents"
git clone https://github.com/YOUR_NAME/meal-log.git meal-log-publish
```

cloneが成功したら、エクスプローラーで元の `Meal-Log` から次のファイル・フォルダーだけを `meal-log-publish` にコピーします。README等の同名ファイルは今回の内容へ置き換えます。

- `.github`、`docs`、`public`、`scripts`、`src`
- `.gitignore`、`index.html`、`package.json`、`pnpm-lock.yaml`、`pnpm-workspace.yaml`
- `README.md`、`tsconfig.json`、`vite.config.ts`

`.git`、`node_modules`、`dist`、`test-results`、`.pnpm-store`はコピーしません。コピー先に元からある`.git`はそのままにします。

```powershell
cd "C:\Users\n_tai\Documents\meal-log-publish"
git switch -C main
git add .
git status --short
git commit -m "Prepare Meal Log for GitHub Pages"
git push -u origin main
```

名前・メールのエラーが出たら、このフォルダー内で手順4の `git config` を実行し、コミットをやり直します。公開確認は手順8に進みます。以後はこのコピー先で開発を続けます。
