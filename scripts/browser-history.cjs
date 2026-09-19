const {chromium}=require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const assert=require('node:assert/strict');
(async()=>{
const browser=await chromium.launch({channel:'chrome',headless:true});
try{
 const context=await browser.newContext({viewport:{width:390,height:844},timezoneId:'Asia/Tokyo',locale:'ja-JP'}), page=await context.newPage(), errors=[];
 page.on('pageerror',e=>errors.push(e.message));page.on('console',e=>{if(e.type()==='error')errors.push(e.text());});
 await page.clock.install({time:new Date('2026-09-19T12:00:00+09:00')});
 await page.goto(process.env.APP_URL||'http://127.0.0.1:4176/meal-log/');
 await page.getByRole('button',{name:'履歴',exact:true}).click();
 await page.evaluate(async()=>{const {db}=await import('/meal-log/src/data/db.ts');const {defaultSettings}=await import('/meal-log/src/domain/types.ts');
 const rows=['a','b','c'].map((id,i)=>({id,name:i===2?'味噌汁':`チキン${id}`,restaurant:i===2?'':'KFC',eatenAt:new Date(`2026-09-${i===1?'18':'19'}T12:35:42.123`).toISOString(),mealType:'lunch',sourceType:'manual',confidence:null,calories:600,protein:30,fat:20,carbs:70,createdAt:'2026-09-01T00:00:00Z',updatedAt:'2026-09-01T00:00:00Z'}));
 await db.meals.bulkPut(rows);await db.settings.put({...defaultSettings,id:'user',theme:'system'});});
 const tools=page.getByRole('region',{name:'履歴検索'}),query=page.getByRole('searchbox',{name:'全履歴を検索'});
 await tools.getByText('3件',{exact:true}).waitFor();
 await query.fill('味噌');await tools.getByText('1件',{exact:true}).waitFor();
 await query.fill(' kfc ');await tools.getByText('2件',{exact:true}).waitFor();
 await query.fill('不存在');await page.getByText('条件に一致する記録がありません',{exact:true}).waitFor();
 await query.fill('KFC');await tools.getByText('絞り込み',{exact:true}).click();
 await page.getByRole('combobox',{name:'期間',exact:true}).selectOption('30');await page.getByRole('combobox',{name:'入力元',exact:true}).selectOption('manual');
 await page.getByRole('button',{name:'選択',exact:true}).click();
 await page.getByRole('checkbox',{name:'チキンaを選択',exact:true}).check();await page.getByText('1件選択中',{exact:true}).waitFor();
 await page.getByRole('checkbox',{name:'チキンbを選択',exact:true}).check();await page.getByText('2件選択中',{exact:true}).waitFor();
 await page.getByRole('button',{name:'選択解除',exact:true}).click();await page.getByText('0件選択中',{exact:true}).waitFor();
 await page.getByRole('button',{name:'表示中をすべて選択',exact:true}).click();
 await page.getByRole('combobox',{name:'変更先の食事区分',exact:true}).selectOption('dinner');
 await page.getByRole('button',{name:'食事区分を一括変更',exact:true}).click();
 const read=()=>page.evaluate(async()=>{const {db}=await import('/meal-log/src/data/db.ts');return db.meals.toArray();});
 assert.equal((await read()).filter(m=>m.mealType==='dinner').length,0);
 await page.getByRole('dialog').getByRole('button',{name:'変更する',exact:true}).click();await page.getByText('0件選択中',{exact:true}).waitFor();assert.equal((await read()).filter(m=>m.mealType==='dinner').length,2);
 await page.getByRole('button',{name:'表示中をすべて選択',exact:true}).click();await page.getByLabel('変更先の日付',{exact:true}).fill('2026-09-19');await page.getByRole('button',{name:'日付を一括変更',exact:true}).click();await page.getByRole('dialog').getByRole('button',{name:'変更する',exact:true}).click();await page.getByText('0件選択中',{exact:true}).waitFor();
 const before=await read();assert.ok(before.every(m=>m.eatenAt==='2026-09-19T03:35:42.123Z'));
 await page.getByRole('button',{name:'表示中をすべて選択',exact:true}).click();await page.getByRole('combobox',{name:'食事区分で絞り込み',exact:true}).selectOption('dinner');await page.getByText('0件選択中',{exact:true}).waitFor();
 await page.getByRole('button',{name:'表示中をすべて選択',exact:true}).click();await query.fill('チキン');await page.getByText('0件選択中',{exact:true}).waitFor();
 for(const [width,height,scheme] of [[390,844,'light'],[320,440,'dark']]){await page.setViewportSize({width,height});await page.emulateMedia({colorScheme:scheme});await tools.scrollIntoViewIfNeeded();assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);await page.screenshot({path:`test-results/history-${width}.png`,fullPage:true});}
 await page.getByRole('button',{name:'表示中をすべて選択',exact:true}).click();await page.getByRole('button',{name:'選択した記録を削除',exact:true}).click();assert.equal((await read()).length,3);await page.getByRole('dialog').getByText('1日分 · 削除後約15秒は元に戻せます。',{exact:true}).waitFor();await page.getByRole('dialog').getByRole('button',{name:'削除する',exact:true}).click();
 await page.getByText('2件削除しました',{exact:true}).waitFor();assert.equal((await read()).length,1);
 await page.getByRole('button',{name:'ホーム',exact:true}).click();await page.locator('.calorie-meta b').getByText('600',{exact:true}).waitFor();
 await page.getByRole('button',{name:'元に戻す',exact:true}).click();await page.locator('.calorie-meta b').getByText('1,800',{exact:true}).waitFor();assert.deepEqual(await read(),before);
 await page.getByRole('button',{name:'履歴',exact:true}).click();await page.locator('.history-row').filter({hasText:'チキンa'}).click();
 await page.getByRole('button',{name:'☆ この料理をお気に入り',exact:true}).click();await page.getByRole('button',{name:'★ お気に入りを解除',exact:true}).waitFor();
 await page.getByRole('button',{name:'編集する',exact:true}).click();await page.getByPlaceholder('例：鶏むね肉とご飯').fill('編集後チキン');await page.getByRole('button',{name:'変更を保存',exact:true}).click();
 await page.getByRole('button',{name:'履歴',exact:true}).click();await page.locator('.history-row').filter({hasText:'編集後チキン'}).click();
 await page.getByRole('button',{name:'この食事を削除',exact:true}).click();await page.getByRole('button',{name:'削除する',exact:true}).click();await page.getByText('1件削除しました',{exact:true}).waitFor();await page.getByRole('button',{name:'元に戻す',exact:true}).click();await page.locator('.history-row').filter({hasText:'編集後チキン'}).waitFor();
 assert.equal(await page.evaluate(async()=>{const {db}=await import('/meal-log/src/data/db.ts');return db.favorites.count();}),1);
 await page.locator('.history-row').filter({hasText:'編集後チキン'}).click();await page.getByRole('button',{name:'この食事を削除',exact:true}).click();await page.getByRole('button',{name:'削除する',exact:true}).click();await page.getByText('1件削除しました',{exact:true}).waitFor();await page.clock.runFor(15001);await page.getByRole('button',{name:'元に戻す',exact:true}).waitFor({state:'hidden'});assert.equal((await read()).length,2);
 // Isolated second timezone: nonexistent local time must not silently shift.
 const dst=await browser.newContext({timezoneId:'America/New_York'}), dp=await dst.newPage();await dp.goto(process.env.APP_URL||'http://127.0.0.1:4176/meal-log/');
 assert.equal(await dp.evaluate(async()=>{const {editHistoryEntry}=await import('/meal-log/src/domain/history.ts');try{editHistoryEntry({eatenAt:'2026-03-07T02:30:42.123-05:00'},{kind:'date',date:'2026-03-08'});return false;}catch{return true;}}),true);await dst.close();
 assert.deepEqual(errors,[]);console.log('PASS: search/filter/select/confirm/batch type+date+delete/Undo/Home/detail/edit/favorite, 390+320 light+dark, DST rejection, no overflow/errors');
}finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
