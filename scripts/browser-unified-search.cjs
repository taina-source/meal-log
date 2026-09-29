const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const index = require('../public/data/restaurant-search.json');
const food = require('../public/data/mext-foods.json').foods.find(f=>f.id==='mext-12004');
const rice = require('../public/data/mext-foods.json').foods.find(f=>f.id==='mext-01088');
const url = process.env.APP_URL || 'http://127.0.0.1:4176/meal-log/';
const blocked = index.items.find(i=>i.calories===null);
const royal = index.items.find(i=>i.chainId==='restaurant:ロイヤルホスト'&&i.registrable);
async function raw(page) { return page.evaluate(()=>new Promise((resolve,reject)=>{const r=indexedDB.open('meal-log');r.onsuccess=()=>{const d=r.result,t=d.transaction('meals'),q=t.objectStore('meals').getAll();q.onsuccess=()=>resolve(q.result);t.oncomplete=()=>d.close();t.onerror=()=>reject(t.error);};})); }
async function seed(page) {
 await page.getByRole('button',{name:'記録',exact:true}).waitFor();
 await page.evaluate(({food})=>new Promise((resolve,reject)=>{const r=indexedDB.open('meal-log');r.onsuccess=()=>{const d=r.result,t=d.transaction(['meals','recipes','favorites','mealSets'],'readwrite'),now=new Date().toISOString();
 const nutrition={calories:142,protein:12.2,fat:10.2,carbs:0.4};
 const make=(id,name)=>({id,name,restaurant:'テスト店',...nutrition,confidence:null,mealType:'lunch',sourceType:'manual',eatenAt:now,createdAt:now,updatedAt:now});
 for(let i=0;i<45;i++) t.objectStore('meals').put(make('m'+i,'卵の履歴'+i));
 for(let i=0;i<5;i++) {
  const ingredient={id:'i',foodId:food.id,name:food.name,grams:100,per100g:nutrition,sourceVersion:food.sourceVersion,notes:[]};
  t.objectStore('recipes').put({id:'r'+i,name:'卵レシピ'+i,ingredients:[ingredient],servings:2,createdAt:now,updatedAt:now});
  const item={id:'i',kind:'food',sourceId:food.id,name:food.name,quantity:100,unit:'g',nutrients:nutrition,sourceVersion:food.sourceVersion};
  t.objectStore('mealSets').put({id:'s'+i,name:'卵セット'+i,items:[item],total:nutrition,createdAt:now,updatedAt:now});
  t.objectStore('favorites').put({id:'f'+i,kind:'manualMeal',sourceId:'fav'+i,quantity:1,createdAt:now,mealSnapshot:make('fav'+i,'卵お気に入り'+i)});
  t.objectStore('meals').put({...make('food'+i,food.name),restaurant:'',sourceType:'database',sourceId:'mext-1200'+(i+4),quantity:100,unit:'g'});
 }
 t.objectStore('favorites').put({id:'g-food',kind:'food',sourceId:food.id,quantity:125,createdAt:now});
 t.oncomplete=()=>{d.close();resolve();};t.onerror=()=>reject(t.error);};}),{food});
}
async function run(viewport,colorScheme,browser) {
 const context=await browser.newContext({viewport,colorScheme,locale:'ja-JP',timezoneId:'Asia/Tokyo',serviceWorkers:process.env.OFFLINE_ONLY?'allow':'block'});
 const page=await context.newPage(),errors=[],requests=[];
 page.on('pageerror',e=>errors.push(e.message));page.on('console',e=>{if(e.type()==='error')errors.push(e.text());});
 page.on('request',r=>requests.push(r.url()));
 const nav=name=>page.getByRole('navigation',{name:'メインナビゲーション'}).getByRole('button',{name,exact:true});
 const dialog=page.getByRole('dialog',{name:'食事を追加',exact:true});
 const search=()=>dialog.getByRole('searchbox',{name:'食品・料理・店名を検索',exact:true});
 const tabs=()=>dialog.getByRole('group',{name:'検索カテゴリ',exact:true});
 const section=name=>dialog.getByRole('region',{name:name+'の検索結果',exact:true});
 const result=(cat,name)=>section(cat).getByRole('button').filter({has:page.getByText(name,{exact:true})});
 const button=name=>dialog.getByRole('button',{name,exact:true});
 async function query(q,cat='すべて') {await search().fill(q);await tabs().getByRole('button',{name:cat,exact:true}).click();}
 async function open(){await nav('食事を追加').click();await search().waitFor();await dialog.getByRole('group',{name:'食事区分'}).getByRole('button',{name:'昼食',exact:true}).click();}
 async function back(){await button('〈 追加方法へ').click();await search().waitFor();await dialog.getByRole('group',{name:'食事区分'}).getByRole('button',{name:'昼食',exact:true}).click();}
 async function layout(){assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);assert.equal(await dialog.evaluate(d=>d.scrollWidth<=d.clientWidth),true);}
 async function save(name){const before=(await raw(page)).length;await button(name).click();await dialog.waitFor({state:'hidden'});const after=await raw(page);assert.ok(after.length>before);const calories=after.reduce((s,m)=>s+m.calories,0);await page.waitForFunction(n=>document.querySelector('.calorie-meta b')?.textContent===new Intl.NumberFormat('ja-JP',{maximumFractionDigits:0}).format(n),calories);return after;}
 try {
 await page.goto(url);await seed(page);await page.reload();
 if(process.env.PROBE_FOOD) { await open();await query(food.name,'お気に入り');await result('お気に入り',food.name).click();assert.equal(await dialog.getByRole('spinbutton',{name:'自由入力（重量） g',exact:true}).inputValue(),'125');console.log('favorite grams selector PASS');return; }
 if(process.env.OFFLINE_ONLY) {
  await page.evaluate(async()=>{await navigator.serviceWorker.ready;});
  await page.waitForFunction(async()=>{const keys=await caches.keys();for(const key of keys){const c=await caches.open(key),rs=await c.keys();if(rs.some(r=>r.url.includes('restaurant-search.json'))&&rs.filter(r=>r.url.includes('/data/restaurants/')).length===21)return true;}return false;});
  const before=await raw(page);await context.setOffline(true);await page.reload();await open();await query(royal.name,'外食');await result('外食',royal.name).first().waitFor();await result('外食',royal.name).first().click();await button('＋ 今回の食事へ追加').waitFor();await layout();assert.equal(await button('＋ 今回の食事へ追加').isEnabled(),true);assert.deepEqual(await raw(page),before);await back();await query(rice.name,'食品');await result('一般食品',rice.name).click();await dialog.getByRole('combobox',{name:'単位',exact:true}).selectOption('cooked-go');await page.getByText('換算後の合計重量：340 g',{exact:true}).waitFor();
  console.log('OFFLINE restart: index + chain + FoodPicker; data retained; errors=0');
 } else {
 await open();assert.equal(await search().inputValue(),'');assert.equal(await dialog.getByRole('heading',{name:'最近使ったもの',exact:true}).count(),0);assert.equal(await dialog.getByRole('region',{name:'お気に入りの候補'}).count(),0);assert.equal(await dialog.getByRole('region',{name:'統合検索',exact:true}).evaluate(el=>el.nextElementSibling?.textContent),'追加方法');assert.equal(await tabs().getByRole('button').count(),7);await layout();
 await query('卵');await section('外食').getByRole('button').first().waitFor();
 for(const c of ['お気に入り','履歴','レシピ','セット','一般食品','外食']) assert.equal(await section(c).locator('.catalog-list > button').count(),3,c);
 assert.equal(requests.filter(u=>u.includes('/data/restaurants/')).length,0,'no formal JSON at unified search');
 await dialog.getByRole('button',{name:'履歴をもっと見る'}).click();assert.equal(await section('履歴').locator('.catalog-list > button').count(),20);await dialog.getByRole('button',{name:'履歴をもっと見る'}).click();assert.equal(await section('履歴').locator('.catalog-list > button').count(),40);
 await query('卵の履歴44','履歴');await result('履歴','卵の履歴44').click();await page.getByRole('heading',{name:'保存した食事を再登録'}).waitFor();await save('確認して再登録');
 await open();await query('卵お気に入り0','お気に入り');await result('お気に入り','卵お気に入り0').click();await save('確認して再登録');
 await open();await query('卵レシピ0','レシピ');await result('レシピ','卵レシピ0').click();await save('この量で食事に登録');
 await open();await query('卵セット0','セット');await result('セット','卵セット0').click();await save('このセットをまとめて登録');
 await open();await query(food.name,'食品');await result('一般食品',food.name).click();await dialog.getByRole('combobox',{name:'単位',exact:true}).selectOption('piece');await dialog.getByRole('spinbutton',{name:/^数量(?: |$)/}).fill('2');await page.getByText('換算後の合計重量：100 g',{exact:true}).waitFor();let saved=await save('食事に登録');assert.ok(saved.some(m=>m.sourceId===food.id&&m.quantity===100&&m.unit==='g'&&m.calories===food.caloriesPer100g));
 await open();await query(food.name,'お気に入り');await result('お気に入り',food.name).click();assert.equal(await dialog.getByRole('spinbutton',{name:'自由入力（重量） g',exact:true}).inputValue(),'125');await back();
 const start=Date.now();for(const q of ['ロ','ロイ','ロイヤルホスト','','ＫＦＣ','ケンタ','卵'])await query(q);await section('外食').getByRole('button').first().waitFor();console.log('sequential query operations ms:',Date.now()-start);
 await query(royal.name,'外食');await result('外食',royal.name).first().click();await button('＋ 今回の食事へ追加').waitFor();assert.equal(await button('＋ 今回の食事へ追加').isEnabled(),true);await layout();await button('＋ 今回の食事へ追加').click();await button('内容を確認').click();await save('昼食として登録');
 const formal=requests.filter(u=>u.includes('/data/restaurants/'));assert.equal(formal.length,1);assert.match(formal[0],/royalhost.json/);
 await open();await query(royal.name,'外食');await result('外食',royal.name).first().click();await button('＋ 今回の食事へ追加').waitFor();assert.equal(requests.filter(u=>u.includes('/data/restaurants/')).length,1);await back();
 await query(blocked.name,'外食');const blockedResult=section('外食').getByRole('button').filter({has:page.getByText(blocked.name,{exact:true})}).filter({hasText:'kcal不明'}).first();await blockedResult.click();await button('＋ 今回の食事へ追加').waitFor();assert.equal(await button('＋ 今回の食事へ追加').isDisabled(),true);await layout();await back();
 await query('存在しない検索語xyz');for(const c of ['お気に入り','履歴','レシピ','セット','一般食品','外食'])assert.equal(await section(c).locator('.catalog-list > button').count(),0);
 await query('');assert.equal(await dialog.getByRole('heading',{name:'追加方法',exact:true}).count(),1);await layout();fs.mkdirSync('test-results',{recursive:true});await page.screenshot({path:`test-results/unified-${viewport.width}-${colorScheme}.png`});await button('閉じる').click();
 const before=await raw(page);await page.reload();assert.deepEqual(await raw(page),before);await nav('履歴').click();await page.getByText('卵お気に入り0',{exact:true}).first().waitFor();
 console.log(`${viewport.width} ${colorScheme}: 6 categories, units, all registration, blocked, cache, reload, layout OK; index requests=${requests.filter(u=>u.endsWith('restaurant-search.json')).length}`);
 }
 assert.deepEqual(errors,[]);
 } finally { await context.close(); }
}
(async()=>{const browser=await chromium.launch({channel:'chrome',headless:true});try{for(const viewport of process.env.OFFLINE_ONLY?[{width:390,height:844}]:[{width:390,height:844},{width:320,height:440}])for(const theme of process.env.OFFLINE_ONLY?['light']:['light','dark'])await run(viewport,theme,browser);}finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
