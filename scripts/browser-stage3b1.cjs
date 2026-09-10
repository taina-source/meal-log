// Isolated test profile; never opens the user's Safari/Chrome database.
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path');
const base = process.env.APP_URL || 'http://127.0.0.1:4175/meal-log/';
const out = path.resolve('test-results'); fs.mkdirSync(out, { recursive: true });
const profile = fs.mkdtempSync(path.join(out, 'stage3b1-profile-'));
const options = { channel: 'chrome', headless: true, viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, locale: 'ja-JP', timezoneId: 'Asia/Tokyo' };
const original = { name: '取り込み試験バーガー', restaurant: '試験店', calories: 600, protein: 30, fat: 20, carbs: 75, sourceType: 'official', confidence: 'high' };
const envelope = items => JSON.stringify({ schemaVersion: 1, type: 'meal-log-chatgpt', items });
let context, page; const errors = [], requests = [], checks = [];
function monitor() { page.on('pageerror', e => errors.push(e.message)); page.on('console', e => { if (e.type() === 'error') errors.push(e.text()); }); page.on('request', r => requests.push(r.url())); }
const meals = () => page.evaluate(() => new Promise((resolve, reject) => { const r = indexedDB.open('meal-log'); r.onerror = () => reject(r.error); r.onsuccess = () => { const db = r.result, q = db.transaction('meals').objectStore('meals').getAll(); q.onsuccess = () => { db.close(); resolve(q.result); }; }; }));
async function count(n) { for (let i = 0; i < 50; i++) { if ((await meals()).length === n) return; await page.waitForTimeout(100); } assert.equal((await meals()).length, n); }
async function open() { await page.locator('nav').getByRole('button', { name: '食事を追加', exact: true }).click(); await page.getByRole('button', { name: /^ChatGPTから取り込み/ }).click(); }
async function paste(text) { await page.getByRole('textbox', { name: 'JSONを貼り付け', exact: true }).fill(text); await page.getByRole('button', { name: '読み込む', exact: true }).click(); }
async function cancel() { await page.getByRole('button', { name: '閉じる', exact: true }).click(); }
async function noOverflow(label) { assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), label); if (await page.locator('dialog').count()) assert.ok(await page.locator('dialog').evaluate(d => d.scrollWidth <= d.clientWidth), label + ' dialog'); }
async function run() {
  context = await chromium.launchPersistentContext(profile, options); page = context.pages()[0]; monitor();
  await page.goto(base); await page.getByRole('button', { name: '記録', exact: true }).waitFor();
  await page.evaluate(() => navigator.serviceWorker.ready);
  if (await page.locator('.pwa-notice').isVisible()) await page.locator('.pwa-notice').getByRole('button', { name: '閉じる' }).click();
  await page.evaluate(() => { Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { readText: () => Promise.reject(new Error('denied for test')) } }); });
  await open(); await page.getByRole('button', { name: 'クリップボードから読み込む' }).click();
  await page.getByRole('alert').filter({ hasText: '長押し' }).waitFor(); await noOverflow('paste390');
  await paste(JSON.stringify(original)); await page.getByText('ChatGPT経由・公式情報（出典URLなし）', { exact: false }).first().waitFor();
  assert.equal((await meals()).length, 0); await page.locator('dialog').evaluate(d => d.scrollTo(0, 0)); await page.screenshot({ path: path.join(out, 'stage3b1-fields-390.png') }); await page.getByLabel('商品名', { exact: true }).fill('確認後バーガー'); await page.getByLabel('店名', { exact: true }).fill('修正店');
  await page.getByLabel('数量', { exact: true }).fill('2'); await page.getByLabel('単位', { exact: true }).fill('個'); await page.getByLabel('カロリー（kcal）', { exact: true }).fill('650');
  await page.getByRole('button', { name: '昼食', exact: true }).click(); await page.getByText('ユーザー修正あり（元の値も保存します）').waitFor();
  await noOverflow('confirm390'); await page.screenshot({ path: path.join(out, 'stage3b1-confirm-390.png'), fullPage: true });
  await page.getByRole('button', { name: '登録する', exact: true }).click(); await count(1);
  const [saved] = await meals(); assert.equal(saved.calories, 1300); assert.equal(saved.protein, 60); assert.equal(saved.sourceType, 'chatgpt'); assert.equal(saved.chatgptSnapshot.calories, 600); assert.equal(saved.chatgptUserModified, true); assert.equal(saved.mealType, 'lunch');
  assert.ok((await page.locator('main').innerText()).includes('1,300'));
  await page.locator('nav').getByRole('button', { name: '履歴', exact: true }).click(); await page.getByText('ChatGPT取り込み · 1,300 kcal').waitFor();
  await page.locator('.history-row').filter({ hasText: '確認後バーガー' }).click(); await page.getByRole('heading', { name: 'ChatGPT取り込み情報' }).waitFor();
  await page.getByText('元入力情報（登録時のスナップショット）').click(); await page.getByText('カロリー：600 kcal').waitFor(); await page.getByRole('button', { name: '編集する', exact: true }).click(); await page.getByRole('heading', { name: 'ChatGPT取り込みを編集', exact: true }).waitFor(); await page.getByLabel('P たんぱく質', { exact: false }).fill(''); await page.getByRole('button', { name: '変更を保存', exact: true }).click(); await page.getByRole('alert').filter({ hasText: '未入力' }).waitFor(); await cancel();
  checks.push('legacy paste, clipboard denied fallback, eight editable fields, quantity totals, lunch/home/history, immutable snapshot, userModified');

  const multi = envelope([{ ...original, name: '推定ラーメン', sourceType: 'estimate', confidence: 'medium', quantity: 1, unit: '杯' }, { ...original, name: '餃子試験', sourceUrl: 'https://example.com/nutrition', sourceTitle: '確認用出典', quantity: 5, unit: '個', calories: 50, protein: 2, fat: 2, carbs: 6 }]);
  await page.goto(base + '#ml-import=' + encodeURIComponent(multi)); await page.getByRole('group', { name: '商品1', exact: true }).waitFor(); assert.equal(new URL(page.url()).hash, '');
  await page.getByText('出典：ChatGPT推定', { exact: true }).waitFor(); await page.getByText('信頼度：中（ChatGPTの申告）', { exact: true }).waitFor();
  assert.equal(await page.getByRole('link', { name: '確認用出典（外部サイト）' }).getAttribute('href'), 'https://example.com/nutrition'); assert.equal((await meals()).length, 1);
  await page.getByRole('button', { name: '登録する', exact: true }).click(); await count(3); const entries = (await meals()).filter(m => m.id !== saved.id); assert.equal(entries[0].chatgptImportId, entries[1].chatgptImportId); assert.notEqual(entries[0].chatgptImportId, saved.chatgptImportId);
  checks.push('startup fragment decode/clear; multi items; official URL vs estimate; no automatic save; import grouping');

  await page.evaluate(() => { location.hash = '#ml-import=%E0%A4%A'; }); await page.getByRole('textbox', { name: 'JSONを貼り付け' }).waitFor(); assert.equal(new URL(page.url()).hash, ''); await page.getByRole('alert').filter({ hasText: '読み込めませんでした' }).waitFor();
  await paste(envelope([{ ...original, name: '<img src=x onerror=alert(1)>', sourceUrl: 'javascript:alert(1)', notes: '<script>alert(1)</script>', protein: null }]));
  assert.ok(await page.getByRole('button', { name: '登録する', exact: true }).isDisabled()); assert.equal(await page.locator('.chatgpt-import img,.chatgpt-import script,.chatgpt-import a').count(), 0);
  for (const color of ['light', 'dark']) {
    await page.emulateMedia({ colorScheme: color }); await page.setViewportSize({ width: 320, height: 440 }); await noOverflow(color + '320x440');
    await page.getByLabel('P たんぱく質（g）', { exact: true }).fill('25'); await page.getByRole('button', { name: '登録する', exact: true }).scrollIntoViewIfNeeded();
    await page.screenshot({ path: path.join(out, `stage3b1-${color}-320x440.png`), fullPage: true });
  }
  await page.getByRole('button', { name: '登録する', exact: true }).click(); await count(4);
  const repaired = (await meals()).find(m => m.name.startsWith('<img')); assert.equal(repaired.chatgptSnapshot.protein, null); assert.equal(repaired.protein, 25); assert.equal(repaired.chatgptUserModified, true);
  checks.push('hashchange invalid cleanup; null blocks until repaired; literal HTML and unsafe URL; light/dark 320x440 keyboard-like scrolling');
  await page.setViewportSize({ width: 390, height: 844 }); await open(); await paste('{oops'); await page.getByRole('alert').filter({ hasText: '読み込めませんでした' }).waitFor(); await cancel();
  await open(); await page.evaluate(value => { Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { readText: () => Promise.resolve(value) } }); }, JSON.stringify(original));
  await page.getByRole('button', { name: 'クリップボードから読み込む' }).click(); await page.getByLabel('商品名', { exact: true }).waitFor(); await cancel(); assert.equal((await meals()).length, 4);
  await page.evaluate(value => { location.hash = '#ml-import=' + encodeURIComponent(value); }, envelope([{ ...original, name: '起動中の再受信' }])); await page.getByLabel('商品名', { exact: true }).waitFor(); assert.equal(await page.getByLabel('商品名', { exact: true }).inputValue(), '起動中の再受信'); assert.equal(new URL(page.url()).hash, ''); await cancel(); checks.push('invalid manual JSON; clipboard success; valid hashchange reception; history editing rejects blank PFC; cancellation never saves');
  const persisted = await meals(); await context.close();
  context = await chromium.launchPersistentContext(profile, options); await context.setOffline(true); page = context.pages()[0]; monitor(); await page.goto(base); await page.getByRole('button', { name: '記録', exact: true }).waitFor();
  assert.deepEqual(await meals(), persisted); await open(); await paste(envelope([{ ...original, name: 'オフライン入力', sourceType: 'estimate', confidence: 'low' }])); await page.getByRole('button', { name: '登録する', exact: true }).click(); await count(5);
  await page.locator('nav').getByRole('button', { name: '履歴', exact: true }).click(); await page.locator('.history-row').filter({ hasText: 'オフライン入力' }).waitFor();
  const cached = await page.evaluate(async () => (await Promise.all((await caches.keys()).map(async k => (await (await caches.open(k)).keys()).map(r => r.url)))).flat());
  assert.equal(cached.filter(u => /\/data\/restaurants\/[^/]+\.json/.test(u)).length, 21); assert.ok(cached.some(u => u.includes('mext-foods.json')));
  checks.push('offline process close/reopen preserves records; offline manual import/save/history; 21 restaurant JSON and food DB cached');
  assert.deepEqual(errors, []); assert.ok(requests.every(url => url.startsWith(new URL(base).origin) || url.startsWith('data:'))); assert.ok(requests.every(url => !url.includes('ml-import=') && !url.includes('取り込み')));
  fs.writeFileSync(path.join(out, 'stage3b1-browser-report.json'), JSON.stringify({ checks, errors, externalRequests: [], meals: 5, profile }, null, 2));
  console.log(JSON.stringify({ checks, errors, result: 'PASS' }, null, 2)); await context.close();
}
run().catch(async error => { console.error(error); if (page) { await page.screenshot({ path: path.join(out, 'stage3b1-failure.png'), fullPage: true }).catch(() => {}); fs.writeFileSync(path.join(out, 'stage3b1-failure.txt'), await page.locator('body').innerText().catch(() => '')); } if (context) await context.close(); process.exitCode = 1; });
