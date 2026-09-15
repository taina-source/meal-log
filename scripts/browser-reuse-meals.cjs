// Isolated test profile only. Never opens real user data.
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path');
const out = path.resolve('test-results'); fs.mkdirSync(out, { recursive: true });
let context, page; const errors = [];
const nav = name => page.locator('nav').getByRole('button', { name, exact: true }).click();
async function favorites(kind, recent = true) {
  await nav('食事を追加'); await page.getByRole('button', { name: /^お気に入り・履歴/ }).click();
  await page.getByRole('button', { name: kind, exact: true }).click();
  if (recent) await page.getByRole('button', { name: '最近の履歴', exact: true }).click();
}
async function records(table = 'meals') { return page.evaluate(table => new Promise(resolve => { const r = indexedDB.open('meal-log'); r.onsuccess = () => { const db = r.result, q = db.transaction(table).objectStore(table).getAll(); q.onsuccess = () => { db.close(); resolve(q.result); }; }; }), table); }
async function save() { await page.getByRole('button', { name: '確認して再登録', exact: true }).click(); await page.locator('dialog').waitFor({ state: 'hidden' }); }
async function layout() { assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false); assert.equal(await page.locator('dialog').evaluate(el => el.scrollWidth > el.clientWidth), false); }
async function run() {
  context = await chromium.launchPersistentContext(fs.mkdtempSync(path.join(out, 'reuse-profile-')), { channel: 'chrome', headless: true, viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, locale: 'ja-JP', timezoneId: 'Asia/Tokyo' });
  page = context.pages()[0]; page.on('pageerror', e => errors.push(e.message)); page.on('console', e => { if (e.type() === 'error') errors.push(e.text()); });
  await page.goto(process.env.APP_URL || 'http://127.0.0.1:4176/meal-log/'); await page.getByRole('button', { name: '記録', exact: true }).waitFor();
  await page.evaluate(() => new Promise(resolve => { const r = indexedDB.open('meal-log'); r.onsuccess = () => { const db = r.result, tx = db.transaction('meals', 'readwrite');
    const t = '2026-09-14T03:00:00.000Z';
    const meal = { restaurant: '', mealType: 'lunch', eatenAt: t, createdAt: t, updatedAt: t, confidence: null, calories: 600, protein: 30, fat: 20, carbs: 75 };
    const snap = { schemaVersion: 1, inputType: 'photo', name: '元料理', restaurant: '', quantity: 1, unit: '皿', calories: 500, protein: 30, fat: 20, carbs: 50, declaredSourceType: 'estimate', sourceUrl: '', sourceTitle: '', confidence: 'medium', notes: '写真の量を推定', importedAt: t };
    for (let i = 0; i < 2; i++) tx.objectStore('meals').add({ ...meal, id: 'chat-' + i, name: '再利用料理' + i, sourceType: 'chatgpt', chatgptImportId: 'original-group', quantity: 2, unit: 'item', chatgptUnit: '皿', chatgptSnapshot: snap, chatgptUserModified: true });
    tx.objectStore('meals').add({ ...meal, id: 'manual', name: '手動試験料理', sourceType: 'manual' });
    tx.oncomplete = () => { db.close(); resolve(); }; }; }));
  await page.reload(); const original = await records();
  await favorites('ChatGPT'); await page.getByRole('heading', { name: 'ChatGPT取り込み · 2品', exact: true }).waitFor();
  await page.getByRole('button', { name: '☆ この料理をお気に入り', exact: true }).first().click();
  await page.getByRole('button', { name: '★ お気に入りを解除', exact: true }).waitFor();
  await layout(); await page.screenshot({ path: path.join(out, 'reuse-history-390.png') });
  await page.getByRole('button', { name: '確認して再利用', exact: true }).click();
  const first = page.getByRole('region', { name: '再登録 1品目', exact: true });
  assert.equal(await first.getByRole('spinbutton', { name: /^カロリー/ }).inputValue(), '600');
  await first.getByRole('spinbutton', { name: /^カロリー/ }).fill('700');
  await first.getByText('元のChatGPT出典・メモ', { exact: true }).click();
  await first.getByText('写真の量を推定', { exact: false }).waitFor();
  await page.getByRole('button', { name: '昼食', exact: true }).click(); await save();
  const after = await records(), next = after.filter(m => !original.some(o => o.id === m.id));
  assert.equal(next.length, 2); assert.equal(next.reduce((n, m) => n + m.calories, 0), 1300); assert.equal(new Set(next.map(m => m.chatgptImportId)).size, 1); assert.notEqual(next[0].chatgptImportId, 'original-group');
  assert.deepEqual(after.filter(m => original.some(o => o.id === m.id)), original);
  await nav('履歴'); await page.getByText('再利用料理0', { exact: true }).first().waitFor();
  await favorites('手動入力'); await page.getByRole('button', { name: '☆ この料理をお気に入り', exact: true }).click(); await page.getByRole('button', { name: '★ お気に入りを解除', exact: true }).waitFor();
  // Delete only the synthetic source row, proving that favorites do not depend on it.
  await page.evaluate(() => new Promise(resolve => { const r = indexedDB.open('meal-log'); r.onsuccess = () => { const db = r.result, tx = db.transaction('meals', 'readwrite'); tx.objectStore('meals').delete('manual'); tx.oncomplete = () => { db.close(); resolve(); }; }; }));
  await page.getByRole('button', { name: 'お気に入り', exact: true }).click();
  await page.setViewportSize({ width: 320, height: 440 }); await layout();
  await page.getByRole('button', { name: /★ 手動試験料理/ }).click();
  await page.getByRole('spinbutton', { name: /^カロリー/ }).fill('800'); await layout();
  await page.getByRole('button', { name: '確認して再登録' }).scrollIntoViewIfNeeded(); await page.screenshot({ path: path.join(out, 'reuse-edit-320.png') }); await save();
  const favBefore = await records('favorites'); assert.equal(favBefore.find(f => f.kind === 'manualMeal').mealSnapshot.calories, 600);
  await favorites('ChatGPT', false); await page.getByRole('button', { name: /★ 再利用料理/ }).click(); await save();
  assert.deepEqual(await records('favorites'), favBefore);
  await page.reload(); await nav('履歴'); await page.getByText('手動試験料理', { exact: true }).waitFor();
  assert.deepEqual(errors, []);
  const result = { result: 'PASS', checks: ['ChatGPT group, final totals, edit, provenance, new importId', 'individual ChatGPT and manual favorites', 'source deletion and edited reuse preserve favorite', 'Home/History and reload', '390×844 and 320×440 layout'], errors };
  fs.writeFileSync(path.join(out, 'reuse-meals-report.json'), JSON.stringify(result, null, 2)); console.log(JSON.stringify(result, null, 2)); await context.close();
}
run().catch(async e => { console.error(e); if (context) await context.close(); process.exitCode = 1; });
