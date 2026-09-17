import { useRef, useState } from 'react';
import { backupCounts, backupFilename, type Backup } from '../domain/backup';
import { backupText, exportBackup, readBackupFile, restoreBackup } from '../data/backup';
import { FormError } from './Fields';

function Counts({ backup }: { backup: Backup }) {
  const counts = backupCounts(backup);
  return <p className="help">食事履歴 {counts.meals}件 · 身体測定 {counts.weights}日 · レシピ {counts.recipes}件 · セット {counts.mealSets}件 · お気に入り {counts.favorites}件 · 設定 {counts.settings}件</p>;
}
function download(file: File) {
  const url = URL.createObjectURL(file), link = document.createElement('a');
  link.href = url; link.download = file.name; document.body.append(link); link.click(); link.remove();
  // Keep the local Blob URL alive while Safari starts the download. No network request.
  window.setTimeout(() => URL.revokeObjectURL(url), 60000);
}
export function BackupSettings() {
  const [preview, setPreview] = useState<Backup>(), [created, setCreated] = useState<Backup>(), [file, setFile] = useState<File>();
  const [confirm, setConfirm] = useState(false), [busy, setBusy] = useState(false), [error, setError] = useState(''), [notice, setNotice] = useState('');
  const active = useRef(false);
  async function save() {
    if (active.current) return; active.current = true; setBusy(true); setError(''); setNotice('');
    try {
      const backup = await exportBackup(); const next = new File([backupText(backup)], backupFilename(new Date(backup.exportedAt)), { type: 'application/json' });
      setCreated(backup); setFile(next);
      let shareable = false; try { shareable = !!navigator.share && !!navigator.canShare?.({ files: [next] }); } catch { /* Fall back to download. */ }
      if (shareable) {
        try { await navigator.share({ files: [next], title: 'Meal Logバックアップ' }); setNotice('共有先で保存を確認してください。'); return; }
        catch (e) { if (e instanceof Error && e.name === 'AbortError') { setNotice('共有をキャンセルしました。必要ならファイルをダウンロードできます。'); return; } }
      }
      download(next); setNotice('バックアップファイルを作成しました。ダウンロード先で保存を確認してください。');
    } catch { setError('バックアップを作成できませんでした。端末の空き容量と保存データを確認してください。'); }
    finally { active.current = false; setBusy(false); }
  }
  async function choose(selected: File) {
    if (active.current) return; active.current = true; setBusy(true); setError(''); setNotice(''); setPreview(undefined); setConfirm(false);
    try { setPreview(await readBackupFile(selected)); }
    catch (e) { setError(`ファイルを確認できませんでした。${e instanceof Error ? e.message : ''} 現在のデータは変更されていません。`); }
    finally { active.current = false; setBusy(false); }
  }
  async function restore() {
    if (!preview || !confirm || active.current) return; active.current = true; setBusy(true); setError('');
    try { await restoreBackup(preview); setNotice(`復元しました。食事履歴 ${preview.data.meals.length}件・身体測定 ${preview.data.weights.length}日・レシピ ${preview.data.recipes.length}件・セット ${preview.data.mealSets.length}件・お気に入り ${preview.data.favorites.length}件。`); setPreview(undefined); setConfirm(false); }
    catch { setError('復元できませんでした。現在のデータは変更されていません。'); }
    finally { active.current = false; setBusy(false); }
  }
  return <section className="card settings-card form-stack" aria-label="バックアップと復元"><h2>バックアップと復元</h2><p className="help">ユーザーデータを1つのJSONへ保存します。クラウド同期ではありません。</p><p className="help">バックアップには食事・身体測定などのデータが含まれます。ファイルの保存先・共有先にご注意ください。</p><button className="button secondary" disabled={busy} onClick={save}>バックアップを保存</button>{created && <><Counts backup={created} /><p className="help">今回作成：{new Date(created.exportedAt).toLocaleString('ja-JP')}</p>{file && <button className="button secondary" disabled={busy} onClick={() => download(file)}>ファイルをダウンロード</button>}</>}<label className="field"><span>バックアップから復元</span><input type="file" accept=".json,application/json" disabled={busy} style={{ maxWidth: '100%', minWidth: 0 }} onChange={e => { const selected = e.target.files?.[0]; e.target.value = ''; if (selected) void choose(selected); }} /></label><p className="help">50MiBまで。ファイル選択だけでは復元しません。Healthの共有確認待ちは含めず、共有完了の記録は保持します。</p><FormError message={error} />{notice && <p role="status">{notice}</p>}{busy && <p role="status">処理中です…</p>}{preview && <section className="form-stack" aria-label="復元プレビュー"><h3>復元プレビュー</h3><p>{new Date(preview.exportedAt).toLocaleString('ja-JP')} のバックアップ</p><p className="help">formatVersion {preview.formatVersion} · dbVersion {preview.dbVersion}</p><Counts backup={preview} /><p>現在のMeal Logデータは、このバックアップの内容に置き換わります。データの混合は行いません。</p><p className="help">必要なら、復元前に現在のデータをバックアップしてください。</p><button className="button secondary" disabled={busy} onClick={save}>現在のデータをバックアップ</button>{confirm ? <div className="delete-confirm" role="alert"><h3>現在の全ユーザーデータを置き換えますか？</h3><p>食事・身体測定・設定・レシピ・セット・お気に入りを置き換えます。この操作は取り消せません。</p><button className="button danger" disabled={busy} onClick={restore}>置き換えて復元する</button><button className="button secondary" disabled={busy} onClick={() => setConfirm(false)}>戻る</button></div> : <button className="button secondary" disabled={busy} onClick={() => setConfirm(true)}>このバックアップで復元</button>}<button className="button secondary" disabled={busy} onClick={() => { setPreview(undefined); setConfirm(false); }}>復元をキャンセル</button></section>}</section>;
}
