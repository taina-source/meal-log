const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const assert = require('node:assert/strict');
(async () => {
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  try {
    const context = await browser.newContext({ viewport: { width: 390, height: 844 }, timezoneId: 'Asia/Tokyo', locale: 'ja-JP' });
    const page = await context.newPage(), errors = [];
    page.on('pageerror', e => errors.push(e.message));
    page.on('console', e => { if (e.type() === 'error') errors.push(e.text()); });
    await page.clock.install({ time: new Date('2026-09-19T12:00:00+09:00') });
    await page.goto(process.env.APP_URL || 'http://127.0.0.1:4176/meal-log/');
    await page.evaluate(async () => {
      const { db } = await import('/meal-log/src/data/db.ts');
      const { defaultSettings } = await import('/meal-log/src/domain/types.ts');
      await db.settings.put({ ...defaultSettings, id: 'user', theme: 'system' });
      await db.meals.bulkPut([['a',19,600,'KFC','lunch'],['b',19,800,'','dinner'],['zero',18,0,'','snack'],['future',25,1200,'','breakfast']].map(([id,day,calories,restaurant,mealType]) => ({ id, name:id, restaurant, mealType, calories, protein:30,fat:20,carbs:50, sourceType:'manual',confidence:null,eatenAt:new Date(`2026-09-${day}T00:15:00`).toISOString(),createdAt:'2026-09-01T00:00:00Z',updatedAt:'2026-09-01T00:00:00Z' })));
      await db.weights.bulkPut([{id:'legacy',date:'2026-09-19',weight:80,createdAt:''},{id:'fat',date:'2026-09-17',bodyFatPercent:20,createdAt:''},{id:'waist',date:'2026-09-16',waistCm:90,createdAt:''}]);
    });
    const button = name => page.getByRole('button', { name, exact:true });
    const cal = page.getByRole('region', { name:'月カレンダー' });
    const day = (n, suffix) => cal.getByRole('button', {name:`2026年9月${n}日、${suffix}`,exact:true});
    await button('履歴').click(); assert.equal(await button('一覧').getAttribute('aria-pressed'),'true');
    const query=page.getByRole('searchbox',{name:'全履歴を検索'});
    await query.fill('KFC'); await button('選択').click(); await button('表示中をすべて選択').click(); await page.getByText('1件選択中',{exact:true}).waitFor();
    await button('カレンダー').click(); await day(19,'1,400キロカロリー、身体測定あり').waitFor();
    assert.equal(await day(19,'1,400キロカロリー、身体測定あり').getAttribute('aria-current'),'date');
    assert.deepEqual(await cal.locator('.calendar-weekday').allTextContents(),['日','月','火','水','木','金','土']);
    assert.equal(await cal.locator('.calendar-grid > *').count(),42); // seven headers + five weeks
    await day(18,'0キロカロリー').waitFor(); await day(20,'食事記録なし').waitFor(); await day(25,'1,200キロカロリー').waitFor();
    await day(17,'食事記録なし、身体測定あり').waitFor(); await day(16,'食事記録なし、身体測定あり').waitFor();
    await button('一覧').click(); assert.equal(await query.inputValue(),'KFC'); await button('選択').click(); await page.getByText('0件選択中',{exact:true}).waitFor();
    await button('カレンダー').click(); await day(19,'1,400キロカロリー、身体測定あり').click();
    assert.equal(await button('一覧').getAttribute('aria-pressed'),'true'); assert.equal(await query.inputValue(),'');
    await page.getByRole('region',{name:'履歴検索'}).getByText('2件',{exact:true}).waitFor();
    await page.getByText('絞り込み',{exact:true}).click(); assert.equal(await page.getByLabel('開始日',{exact:true}).inputValue(),'2026-09-19');
    assert.equal(await page.getByRole('combobox',{name:'食事区分で絞り込み'}).inputValue(),''); assert.equal(await page.getByRole('combobox',{name:'入力元',exact:true}).inputValue(),'');
    await button('カレンダー').click(); await day(17,'食事記録なし、身体測定あり').click(); await page.getByText('この日の食事記録はありません',{exact:true}).waitFor();
    await button('カレンダー').click(); await button('前月').click(); await cal.getByRole('heading',{name:'2026年8月'}).waitFor(); assert.equal(await cal.locator('.calendar-grid > *').count(),49);
    for(let i=0;i<8;i++) await button('前月').click(); await cal.getByRole('heading',{name:'2025年12月'}).waitFor(); await button('次月').click(); await cal.getByRole('heading',{name:'2026年1月'}).waitFor(); await button('今月').click();
    await day(19,'1,400キロカロリー、身体測定あり').waitFor();
    // Live updates use only this isolated browser context's DB.
    await page.evaluate(async()=>{const {db}=await import('/meal-log/src/data/db.ts'); await db.meals.update('b',{calories:900}); await db.weights.delete('legacy');});
    await day(19,'1,500キロカロリー').waitFor();
    await page.evaluate(async()=>{const {db}=await import('/meal-log/src/data/db.ts');await db.weights.put({id:'new',date:'2026-09-20',weightKg:75,bodyFatPercent:22,waistCm:88,createdAt:''});const a=await db.meals.get('a');await db.meals.put({...a,id:'new-meal',eatenAt:new Date('2026-09-20T12:00:00').toISOString()});});
    await day(20,'600キロカロリー、身体測定あり').waitFor();
    await page.evaluate(async()=>{const {db}=await import('/meal-log/src/data/db.ts');await db.meals.update('new-meal',{eatenAt:new Date('2026-09-21T12:00:00').toISOString()});await db.weights.update('new',{date:'2026-09-21'});});
    await day(20,'食事記録なし').waitFor(); await day(21,'600キロカロリー、身体測定あり').waitFor();
    for(const [width,height,scheme] of [[390,844,'light'],[320,440,'dark']]) {
      await page.setViewportSize({width,height});await page.emulateMedia({colorScheme:scheme});await cal.scrollIntoViewIfNeeded();
      assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
      await page.screenshot({path:`test-results/calendar-${width}.png`,fullPage:true});
    }
    await day(19,'1,500キロカロリー').click();await button('選択').click();await button('表示中をすべて選択').click();await button('選択した記録を削除').click();await page.getByRole('dialog').getByRole('button',{name:'削除する',exact:true}).click();await page.getByText('2件削除しました',{exact:true}).waitFor();
    await button('カレンダー').click();await day(19,'食事記録なし').waitFor();await button('元に戻す').click();await day(19,'1,500キロカロリー').waitFor();
    await page.reload();await button('履歴').click();assert.equal(await button('一覧').getAttribute('aria-pressed'),'true');
    assert.deepEqual(errors,[]);console.log('PASS calendar: month navigation/years/5+6 weeks/local totals/zero/markers/today/search separation/selection clear/day navigation/live changes/delete+Undo/390+320/light+dark/no overflow/errors');
  } finally { await browser.close(); }
})().catch(e=>{console.error(e);process.exitCode=1;});
