// Synthetic records in an isolated browser profile. No real user records.
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path');
const out = path.resolve('test-results'); fs.mkdirSync(out, { recursive: true });
let context, page; const errors = [];
const card = () => page.getByRole('region', { name: '実績ベース推定維持カロリー', exact: true });
async function open() { await page.locator('nav').getByRole('button', { name: '分析', exact: true }).click(); await card().waitFor(); }
async function seed(mode) {
  await page.evaluate(mode => new Promise((resolve, reject) => {
    const request = indexedDB.open('meal-log'); request.onerror = () => reject(request.error);
    request.onsuccess = () => { const db = request.result, tx = db.transaction(['meals', 'weights'], 'readwrite');
      tx.objectStore('meals').clear(); tx.objectStore('weights').clear();
      for (let i = 0; i < 30; i++) {
        const d = new Date(2026, 7, 19 + i, 12), date = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`, stamp = d.toISOString();
        if (mode !== 'reference' || i < 21) tx.objectStore('meals').put({ id: `meal-${i}`, name: '試験', restaurant: '', mealType: 'lunch', eatenAt: stamp, createdAt: stamp, updatedAt: stamp, sourceType: 'manual', confidence: null, calories: 2200, protein: 100, fat: 70, carbs: 250 });
        if (mode !== 'reference' || [8, 11, 14, 17, 20, 23, 26, 29].includes(i)) tx.objectStore('weights').put({ id: `weight-${i}`, date, createdAt: stamp, weightKg: 100 - i * (mode === 'hold' ? .25 : .05), bodyFatPercent: 24, waistCm: 98 });
      }
      tx.oncomplete = () => { db.close(); resolve(); }; tx.onerror = () => reject(tx.error);
    };
  }), mode);
  await page.reload(); await open();
}
async function run() {
  context = await chromium.launchPersistentContext(fs.mkdtempSync(path.join(out, 'maintenance-profile-')), { channel: 'chrome', headless: true, viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, locale: 'ja-JP', timezoneId: 'Asia/Tokyo' });
  page = context.pages()[0]; page.on('pageerror', e => errors.push(e.message)); page.on('console', e => { if (e.type() === 'error') errors.push(e.text()); });
  await page.goto(process.env.APP_URL || 'http://127.0.0.1:4176/meal-log/'); await open(); await card().getByRole('heading', { name: 'データ不足', exact: true }).waitFor();
  await seed('enough'); await card().getByText('約 2,600', { exact: false }).waitFor(); assert.match(await card().innerText(), /2026-08-19 ～ 2026-09-17/);
  for (const period of ['30日', '90日', '全期間', '7日']) { await page.getByRole('button', { name: period, exact: true }).click(); await card().getByText('約 2,600', { exact: false }).waitFor(); }
  await card().getByText('算出方法を見る', { exact: true }).click(); assert.match(await card().innerText(), /Theil–Sen/); await card().scrollIntoViewIfNeeded(); await page.screenshot({ path: path.join(out, 'maintenance-390.png'), fullPage: true });
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
  await seed('reference'); await card().getByText('データ充足度：参考', { exact: true }).waitFor(); await card().getByText('約 2,600', { exact: false }).waitFor();
  await seed('hold'); await card().getByRole('heading', { name: '推定保留', exact: true }).waitFor(); assert.equal(await card().locator('.analysis-number').count(), 0);
  assert.deepEqual(errors, []); const report = { result: 'PASS', viewport: '390×844', checks: ['insufficient, reference, sufficient, rapid-change hold', 'independent of Analysis period selection', 'method explanation, no overflow'], errors };
  fs.writeFileSync(path.join(out, 'maintenance-report.json'), JSON.stringify(report, null, 2)); console.log(JSON.stringify(report, null, 2)); await context.close();
}
run().catch(async e => { console.error(e); if (context) await context.close(); process.exitCode = 1; });
