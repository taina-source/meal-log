import { db } from './db';
import { createId } from './id';
import { defaultSettings } from '../domain/types';
import { confirmedHealthMetadata, pendingHealthExport } from '../domain/healthExport';
export async function beginHealthExport(range?: { start: string; end: string }, resend = false) {
  return db.transaction('rw', db.settings, db.weights, async () => {
    const settings = (await db.settings.get('user')) ?? { ...defaultSettings, id: 'user' };
    if (settings.pendingHealthExport) throw new Error('前回の共有確認待ちがあります。先に完了またはキャンセルしてください。');
    const pending = pendingHealthExport(await db.weights.toArray(), createId(), new Date().toISOString(), range, resend);
    if (!pending.payload.measurements.length) throw new Error('未共有の身体測定はありません。');
    await db.settings.put({ ...settings, pendingHealthExport: pending }); return pending;
  });
}
export async function finishHealthExport(exportId: string, confirm: boolean) {
  return db.transaction('rw', db.settings, db.weights, async () => {
    const settings = await db.settings.get('user'), pending = settings?.pendingHealthExport;
    if (!settings || !pending || pending.payload.exportId !== exportId) throw new Error('共有確認待ちの内容が変わりました。画面を開き直してください。');
    const now = new Date().toISOString();
    if (confirm) for (const row of pending.payload.measurements) {
      const entry = await db.weights.get(pending.recordIds[row.date]);
      if (entry && entry.date === row.date) await db.weights.update(entry.id, { healthExport: confirmedHealthMetadata(entry, row, now) });
    }
    delete settings.pendingHealthExport; await db.settings.put(settings);
  });
}
