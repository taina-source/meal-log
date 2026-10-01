const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const assert = require('node:assert/strict');
async function meals(page) {
  return page.evaluate(() => new Promise((resolve, reject) => {
    const r = indexedDB.open('meal-log'); r.onsuccess = () => {
      const db = r.result, q = db.transaction('meals').objectStore('meals').getAll();
      q.onsuccess = () => { db.close(); resolve(q.result); }; q.onerror = () => reject(q.error);
    };
  }));
}
async function seed(page) {
  await page.evaluate(() => new Promise((resolve, reject) => {
    const r = indexedDB.open('meal-log'); r.onsuccess = () => {
      const db = r.result, t = db.transaction(['meals', 'favorites'], 'readwrite'), stamp = new Date().toISOString();
      const names = ['選択ご飯', '選択みそ汁', '選択おかず', '単品ChatGPT'];
      names.forEach((name, i) => {
        const nutrition = { calories: [530, 40, 350, 100][i], protein: 10, fat: 2, carbs: 20 };
        const m = { id: `original-${i}`, name, restaurant: '', ...nutrition, quantity: 1, unit: 'item', chatgptUnit: '皿', sourceType: 'chatgpt', confidence: null, mealType: 'lunch', eatenAt: stamp, createdAt: stamp, updatedAt: stamp, chatgptImportId: i < 3 ? 'original-group' : 'single-group', chatgptSnapshot: { schemaVersion: 1, name, restaurant: '', ...nutrition, quantity: 1, unit: '皿', declaredSourceType: 'estimate', sourceUrl: '', sourceTitle: '', confidence: 'medium', notes: '保持する出典', importedAt: stamp } };
        t.objectStore('meals').put(m);
        if (i === 1) t.objectStore('favorites').put({ id: 'favorite-soup', kind: 'chatgptMeal', sourceId: m.id, quantity: 1, mealSnapshot: m, createdAt: stamp });
      });
      t.oncomplete = () => { db.close(); resolve(); }; t.onerror = () => reject(t.error);
    };
  }));
  await page.reload();
}
(async () => {
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  try {
    for (const viewport of [{ width: 390, height: 844 }, { width: 320, height: 440 }]) for (const colorScheme of ['light', 'dark']) {
      const context = await browser.newContext({ viewport, colorScheme, locale: 'ja-JP', timezoneId: 'Asia/Tokyo' }), page = await context.newPage(), errors = [];
      try {
        page.on('pageerror', e => errors.push(e.message)); page.on('console', e => { if (e.type() === 'error') errors.push(e.text()); });
        await page.goto(process.env.APP_URL || 'http://127.0.0.1:4176/meal-log/');
        await page.getByRole('button', { name: '記録', exact: true }).waitFor(); await seed(page); const originals = await meals(page);
        const nav = name => page.getByRole('navigation', { name: 'メインナビゲーション' }).getByRole('button', { name, exact: true });
        const d = page.getByRole('dialog', { name: '食事を追加', exact: true }), b = name => d.getByRole('button', { name, exact: true });
        const check = name => d.getByRole('checkbox', { name: `${name}を登録`, exact: true });
        async function open() { await nav('食事を追加').click(); await d.getByRole('searchbox').waitFor(); }
        async function search(name, category = '履歴') {
          await d.getByRole('searchbox').fill(name);
          await d.getByRole('group', { name: '検索カテゴリ' }).getByRole('button', { name: category, exact: true }).click();
          let results = d.getByRole('region', { name: `${category}の検索結果`, exact: true }).getByRole('button').filter({ hasText: name });
          if (name === '選択ご飯') results = results.filter({ hasText: '3品' });
          await results.first().click();
        }
        async function originalGroup() {
          await open(); await search('選択ご飯');
          await d.getByRole('heading', { name: '登録する食品を選択', exact: true }).waitFor();
        }
        async function amount(name, value) {
          const card = d.getByRole('region', { name: /^再登録 / }).filter({ has: page.getByRole('checkbox', { name: `${name}を登録`, exact: true }) });
          await card.getByRole('spinbutton', { name: '今回の数量 必須 皿', exact: true }).fill(value);
        }
        async function save(expected) {
          const before = await meals(page); await b('確認して再登録').click(); await d.waitFor({ state: 'hidden' });
          const after = await meals(page), oldIds = new Set(before.map(m => m.id)), added = after.filter(m => !oldIds.has(m.id));
          assert.deepEqual(added.map(m => m.name).sort(), [...expected].sort());
          assert.equal(new Set(added.map(m => m.chatgptImportId)).size, 1);
          assert.ok(added.every(m => !originals.some(o => o.chatgptImportId === m.chatgptImportId)));
          for (const m of added) assert.deepEqual(m.chatgptSnapshot, originals.find(o => o.name === m.name).chatgptSnapshot);
          await page.waitForFunction(total => document.querySelector('.calorie-meta b')?.textContent === new Intl.NumberFormat('ja-JP', { maximumFractionDigits: 0 }).format(total), after.reduce((s, m) => s + m.calories, 0));
          return added;
        }
        await originalGroup(); assert.equal(await d.getByRole('checkbox').count(), 3);
        assert.deepEqual(await d.getByRole('checkbox').evaluateAll(nodes => nodes.map(n => n.checked)), [true, true, true]);
        assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
        assert.equal(await d.evaluate(el => el.scrollWidth <= el.clientWidth), true);
        await page.screenshot({ path: `test-results/partial-${viewport.width}-${colorScheme}.png` });
        await b('すべて解除').click(); assert.equal(await b('確認して再登録').isDisabled(), true);
        await check('選択みそ汁').check(); await amount('選択みそ汁', '0.5');
        let added = await save(['選択みそ汁']); assert.equal(added[0].calories, 20); assert.equal(added[0].protein, 5);
        if (process.env.SINGLE_PROBE) { assert.deepEqual(errors, []); console.log('single selected item quantity and registration PASS'); return; }
        await nav('履歴').click(); await page.getByText('選択みそ汁', { exact: true }).first().waitFor(); await page.getByRole('link', { name: 'Meal Log ホーム', exact: true }).click();
        if (process.env.NAV_PROBE) { await page.locator('.calorie-meta b').waitFor(); assert.deepEqual(errors, []); console.log('History/Home navigation PASS'); return; }
        await originalGroup(); await check('選択みそ汁').uncheck();
        await amount('選択ご飯', '0.5'); await amount('選択おかず', '2');
        added = await save(['選択ご飯', '選択おかず']);
        assert.equal(added.find(m => m.name === '選択ご飯').calories, 265); assert.equal(added.find(m => m.name === '選択おかず').calories, 700);
        // Legacy Favorites/history entry reaches the same selection UI and supports all items.
        await open(); await d.getByRole('button').filter({ has: page.getByText('お気に入り・履歴', { exact: true }) }).click();
        await b('最近の履歴').click(); await b('ChatGPT').click();
        const group = d.locator('section').filter({ has: page.getByRole('heading', { name: 'ChatGPT取り込み · 3品', exact: true }) });
        await group.getByRole('button', { name: '確認して再利用', exact: true }).click();
        await b('すべて解除').click(); await b('すべて選択').click();
        await amount('選択みそ汁', '0'); assert.equal(await b('確認して再登録').isDisabled(), true);
        await check('選択みそ汁').uncheck(); assert.equal(await b('確認して再登録').isEnabled(), true);
        await check('選択みそ汁').check(); assert.equal(await b('確認して再登録').isDisabled(), true); await amount('選択みそ汁', '1');
        await b('〈 追加方法へ').click(); await search('選択ご飯');
        assert.deepEqual(await d.getByRole('checkbox').evaluateAll(nodes => nodes.map(n => n.checked)), [true, true, true]);
        await save(['選択ご飯', '選択みそ汁', '選択おかず']);
        await open(); await search('単品ChatGPT'); assert.equal(await d.getByRole('checkbox').count(), 0);
        await d.getByRole('spinbutton', { name: '今回の数量 必須 皿', exact: true }).fill('2'); added = await save(['単品ChatGPT']); assert.equal(added[0].calories, 200);
        await open(); await search('選択みそ汁', 'お気に入り'); assert.equal(await d.getByRole('checkbox').count(), 0); await save(['選択みそ汁']);
        const final = await meals(page); for (const original of originals) assert.deepEqual(final.find(m => m.id === original.id), original);
        await page.reload(); assert.deepEqual(await meals(page), final); assert.deepEqual(errors, []);
        console.log(`${viewport.width} ${colorScheme}: partial 1/2/all, amounts, legacy/search/favorite/single, zero, originals, reload, Home/History, layout/errors PASS`);
      } finally { await context.close(); }
    }
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
