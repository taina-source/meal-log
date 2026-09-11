// Isolated profile and synthetic nutrition data; no production records are opened.
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path');
const out = path.resolve('test-results'); fs.mkdirSync(out, { recursive: true });
const profile = fs.mkdtempSync(path.join(out, 'smart-quotes-profile-'));
const base = process.env.APP_URL || 'http://127.0.0.1:4175/meal-log/';
const item = { name: '鶏肉と“ご飯”', restaurant: '', quantity: 1, unit: '写真の1皿分', calories: 700, protein: 40, fat: 20, carbs: 90, sourceType: 'estimate', sourceUrl: '', sourceTitle: '', confidence: 'medium', notes: 'ご飯約200g、日本語・油“少なめ”＋5g / 50% & <img src=x>' };
const smart = value => JSON.stringify(value).replace(/"(?:\\.|[^"\\])*"/g, token => `“${token.slice(1, -1)}”`);
let context, page; const errors = [], checks = [];
async function open(photo) { await page.locator('nav').getByRole('button', { name: '食事を追加', exact: true }).click(); await page.getByRole('button', { name: photo ? /^写真からChatGPT取り込み/ : /^ChatGPTから取り込み/ }).click(); }
async function paste(text) { await page.locator('label').filter({ has: page.getByText('JSONを貼り付け', { exact: true }) }).locator('textarea').fill(text); await page.getByRole('button', { name: '読み込む', exact: true }).click(); }
async function run() {
  context = await chromium.launchPersistentContext(profile, { channel: 'chrome', headless: true, viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, locale: 'ja-JP' });
  page = context.pages()[0]; page.on('pageerror', e => errors.push(e.message)); page.on('console', e => { if (e.type() === 'error') errors.push(e.text()); });
  await page.goto(base); await page.getByRole('button', { name: '記録', exact: true }).waitFor(); await page.evaluate(() => navigator.serviceWorker.ready);
  if (await page.locator('.pwa-notice').isVisible()) await page.locator('.pwa-notice').getByRole('button', { name: '閉じる' }).click();
  for (const type of ['photo', 'text', 'legacy']) {
    const value = type === 'legacy' ? item : { schemaVersion: 1, type: 'meal-log-chatgpt', inputType: type, items: [item] };
    await open(type === 'photo'); await paste(smart(value)); await page.getByLabel('商品名', { exact: true }).waitFor();
    assert.equal(await page.getByLabel('商品名', { exact: true }).inputValue(), item.name);
    await page.getByText(type === 'photo' ? '出典：ChatGPT写真推定' : '出典：ChatGPT推定', { exact: true }).waitFor();
    await page.getByText((type === 'photo' ? '推定時のメモ：' : '') + item.notes, { exact: true }).waitFor();
    assert.equal(await page.locator('.chatgpt-import img,.chatgpt-import script').count(), 0);
    assert.ok(await page.getByRole('button', { name: '登録する', exact: true }).isEnabled());
    if (type === 'photo') { await page.locator('dialog').evaluate(d => d.scrollTo(0, 0)); await page.screenshot({ path: path.join(out, 'smart-quotes-photo-390.png') }); }
    checks.push(`${type}: smart-quoted JSON reaches confirmation; name/notes preserved; HTML remains text`);
    await page.getByRole('button', { name: '閉じる', exact: true }).click();
  }
  await open(true); await paste(fs.readFileSync('src/testing/iphone-smart-quotes.txt', 'utf8'));
  await page.getByLabel('商品名', { exact: true }).waitFor();
  assert.equal(await page.getByLabel('商品名', { exact: true }).inputValue(), '鶏肉のソテー クリームきのこソース');
  assert.ok(await page.getByRole('button', { name: '登録する', exact: true }).isEnabled());
  checks.push('exact iPhone JSON with three U+201D empty strings reaches photo confirmation');
  await page.getByRole('button', { name: '閉じる', exact: true }).click();
  await open(true); await paste('{“schemaVersion”:1,“type”:“meal-log-chatgpt”,“inputType”:“photo”,}');
  await page.getByRole('alert').filter({ hasText: '読み込めませんでした' }).waitFor(); assert.equal(await page.getByRole('button', { name: '登録する', exact: true }).count(), 0);
  await paste(smart({ schemaVersion: 2, type: 'meal-log-chatgpt', inputType: 'photo', items: [item] })); await page.getByRole('alert').filter({ hasText: 'schemaVersion' }).waitFor();
  checks.push('invalid JSON and schema violation remain rejected');
  assert.deepEqual(errors, []); fs.writeFileSync(path.join(out, 'smart-quotes-browser-report.json'), JSON.stringify({ result: 'PASS', checks, errors }, null, 2)); console.log(JSON.stringify({ result: 'PASS', checks, errors }, null, 2)); await context.close();
}
run().catch(async error => { console.error(error); if (context) await context.close(); process.exitCode = 1; });
