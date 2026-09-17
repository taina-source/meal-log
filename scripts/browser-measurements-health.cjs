// Dedicated temporary Chrome profile; no real user data or Health writes.
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path');
const out = path.resolve('test-results'); fs.mkdirSync(out, { recursive: true });
let context, page; const errors = [];
const nav = name => page.locator('nav').getByRole('button', { name, exact: true }).click();
const click = name => page.getByRole('button', { name, exact: true }).click();
const field = name => page.locator('dialog').getByRole('spinbutton', { name: new RegExp('^' + name) });
async function close() { await page.locator('dialog').getByRole('button', { name: '閉じる', exact: true }).click(); }
async function save() { await click('身体測定を保存'); await page.locator('dialog').waitFor({ state: 'hidden' }); }
async function state() { return page.evaluate(() => new Promise(resolve => { const r = indexedDB.open('meal-log'); r.onsuccess = () => { const db = r.result, tx = db.transaction(['weights', 'settings']); const w = tx.objectStore('weights').getAll(), s = tx.objectStore('settings').get('user'); tx.oncomplete = () => { resolve({ weights: w.result, settings: s.result }); db.close(); }; }; })); }
async function layout() { assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false); if (await page.locator('dialog').count()) assert.equal(await page.locator('dialog').evaluate(el => el.scrollWidth > el.clientWidth), false); }
async function run() {
  context = await chromium.launchPersistentContext(fs.mkdtempSync(path.join(out, 'health-profile-')), { channel: 'chrome', headless: true, viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, locale: 'ja-JP', timezoneId: 'Asia/Tokyo' });
  page = context.pages()[0]; page.on('pageerror', e => errors.push(e.message)); page.on('console', e => { if (e.type() === 'error') errors.push(e.text()); });
  await page.goto(process.env.APP_URL || 'http://127.0.0.1:4176/meal-log/'); await page.getByRole('button', { name: '記録', exact: true }).waitFor();
  await click('記録'); await field('体重').fill('100.2'); await field('体脂肪率').fill('24.3'); await field('ウエスト').fill('98.4'); await save();
  await click('記録'); assert.equal(await field('体重').inputValue(), '100.2'); assert.equal(await field('体脂肪率').inputValue(), '24.3'); assert.equal(await field('ウエスト').inputValue(), '98.4');
  await field('体重').fill(''); await field('体脂肪率').fill(''); await layout(); await page.screenshot({ path: path.join(out, 'measurement-input-390.png') }); await save();
  await click('前日'); await click('記録'); await field('体脂肪率').fill('24'); await save();
  await click('前日'); await click('記録'); await field('体重').fill('100'); await save();
  assert.equal((await state()).weights.length, 3);
  await click('今日'); await page.getByText('最新の身体測定（表示日まで）', { exact: true }).click();
  const home = page.getByRole('region', { name: '身体測定', exact: true }); assert.match(await home.innerText(), /体重 100kg/); assert.match(await home.innerText(), /体脂肪率 24%/);
  await nav('分析'); await page.getByRole('region', { name: '体脂肪率概要', exact: true }).waitFor();
  for (const period of ['30日', '90日', '全期間', '7日']) await click(period);
  assert.match(await page.getByRole('region', { name: '体重概要', exact: true }).innerText(), /100/);
  await page.getByText('身体測定の日別データ', { exact: true }).click(); await layout();
  await nav('ホーム'); await click('ヘルスケアへ共有');
  await page.getByText('2日分・2項目を共有します', { exact: true }).waitFor();
  for (const scope of ['7', '30']) { await page.getByLabel('共有対象期間').selectOption(scope); await page.getByText('2日分・2項目を共有します', { exact: true }).waitFor(); }
  await page.getByLabel('共有対象期間').selectOption('today'); await page.getByText('未共有の身体測定はありません', { exact: true }).waitFor();
  await page.getByLabel('共有対象期間').selectOption('custom'); await page.getByLabel('開始日').waitFor(); await page.getByText('未共有の身体測定はありません', { exact: true }).waitFor();
  await page.getByLabel('共有対象期間').selectOption('all'); await click('共有内容を確認');
  let p = (await state()).settings.pendingHealthExport; assert.equal(p.payload.measurements.length, 2); assert.ok(p.payload.measurements.every(m => Object.keys(m).length === 2));
  assert.equal(await page.getByRole('link', { name: 'Meal Log Healthを開く', exact: true }).getAttribute('href'), 'shortcuts://run-shortcut?name=Meal%20Log%20Health');
  await page.evaluate(() => Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: async () => { throw new Error('denied'); } } }));
  await click('ショートカットで共有'); await page.getByText(/コピーできませんでした。連携用JSON欄/).waitFor();
  await click('もう一度ショートカットを開く'); assert.equal((await state()).settings.pendingHealthExport.payload.exportId, p.payload.exportId);
  await page.evaluate(() => Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: async text => { window.testCopiedHealthJson = text; } } }));
  await click('連携用JSONをコピー'); await page.getByText('JSONをコピーしました。', { exact: true }).waitFor(); assert.deepEqual(JSON.parse(await page.evaluate(() => window.testCopiedHealthJson)), p.payload);
  assert.equal((await state()).weights.some(w => w.healthExport), false);
  await page.setViewportSize({ width: 320, height: 440 }); await layout();
  await page.getByLabel('連携用JSON（手動コピー可）').scrollIntoViewIfNeeded(); await page.screenshot({ path: path.join(out, 'health-pending-320.png') });
  await page.reload(); await click('ヘルスケアへ共有'); await page.getByRole('region', { name: '共有確認待ち' }).waitFor(); assert.equal((await state()).settings.pendingHealthExport.payload.exportId, p.payload.exportId);
  await click('キャンセル'); assert.equal((await state()).settings.pendingHealthExport, undefined); assert.equal((await state()).weights.some(w => w.healthExport), false);
  await click('共有内容を確認'); p = (await state()).settings.pendingHealthExport;
  // Confirm after modifying the weight from two days ago; only pending snapshot is marked exported.
  await close(); await click('前日'); await click('前日'); await click('記録'); await field('体重').fill('99.8'); await save(); await click('ヘルスケアへ共有');
  await click('今回の共有を完了にする'); await page.locator('dialog').getByText('未共有 1日分・1項目', { exact: true }).waitFor();
  const saved = await state(), weight = saved.weights.find(w => w.weightKg !== undefined); assert.equal(weight.healthExport.weightKg.value, 100); assert.equal(weight.weightKg, 99.8); assert.ok(saved.weights.every(w => w.healthExport?.waistCm === undefined));
  await page.getByText('トラブル対応：再共有', { exact: true }).click(); await page.getByLabel('この期間をすべて再共有').check(); await page.getByText(/再共有モード/).waitFor(); await page.getByText('2日分・2項目を共有します', { exact: true }).waitFor(); await layout();
  await close(); await nav('分析'); await page.getByText('身体測定の日別データ', { exact: true }).click(); await layout();
  assert.deepEqual(errors, []);
  const report = { result: 'PASS', checks: ['three fields, prefill, same-day edit, body-fat-only, waist-only, independent latest', 'analysis periods and missing values', 'all/today/7/30/custom counts, batch preview', 'clipboard refusal manual fallback; no shortcut or Health write executed', 'pending reload, cancel, confirm snapshot after edit, resend warning', '390×844 and 320×440, no overflow'], errors };
  fs.writeFileSync(path.join(out, 'measurements-health-report.json'), JSON.stringify(report, null, 2)); console.log(JSON.stringify(report, null, 2)); await context.close();
}
run().catch(async e => { console.error(e); if (context) await context.close(); process.exitCode = 1; });
