// Dedicated synthetic profile: never touches the user's Safari/Chrome records.
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path');
const output = path.resolve('test-results'); fs.mkdirSync(output, { recursive: true });
const profile = fs.mkdtempSync(path.join(output, 'stage3-profile-'));
const base = process.env.APP_URL || 'http://127.0.0.1:4175/meal-log/';
const options = { channel: 'chrome', headless: true, viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, locale: 'ja-JP', timezoneId: 'Asia/Tokyo' };
let context, page; const errors = [], checks = [];
function monitor() { page.on('pageerror', e => errors.push(e.message)); page.on('console', e => { if (e.type() === 'error') errors.push(e.text()); }); }
const store = name => page.evaluate(name => new Promise((resolve,reject) => { const r=indexedDB.open('meal-log'); r.onerror=()=>reject(r.error);r.onsuccess=()=>{const db=r.result,q=db.transaction(name).objectStore(name).getAll();q.onsuccess=()=>{resolve(q.result);db.close();};};}),name);
async function add() { await page.locator('nav').getByRole('button',{name:'食事を追加',exact:true}).click(); await page.getByRole('button',{name:'昼食',exact:true}).click(); await page.getByRole('button',{name:/^外食 7チェーン/}).click(); }
async function close() { await page.getByRole('button',{name:'閉じる',exact:true}).click(); }
async function overflow(label) { assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,label); if(await page.locator('dialog').count()) assert.equal(await page.locator('dialog').evaluate(d=>d.scrollWidth<=d.clientWidth),true,label+' dialog'); }
async function waitMeals(n) { await page.waitForFunction(n=>new Promise(resolve=>{const r=indexedDB.open('meal-log');r.onsuccess=()=>{const d=r.result,q=d.transaction('meals').objectStore('meals').count();q.onsuccess=()=>{resolve(q.result===n);d.close();};};}),n); }
async function run() {
  context=await chromium.launchPersistentContext(profile,options);page=context.pages()[0];monitor();
  await page.route(base,route=>route.fulfill({contentType:'text/html',body:'<!doctype html><link rel="icon" href="./favicon.svg"><p>v2 migration fixture</p>'}));
  await page.goto(base);
  const legacy=await page.evaluate(async()=>{
    const now=new Date().toISOString(),d=new Date(),date=d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');
    const meal={id:'legacy-meal',name:'第2段階の食事',restaurant:'',calories:420,protein:20,fat:12,carbs:50,mealType:'breakfast',eatenAt:new Date(date+'T08:00:00').toISOString(),createdAt:now,updatedAt:now,sourceType:'manual',confidence:null};
    const ingredient={id:'rice',foodId:'mext-01088',name:'ご飯',grams:200,per100g:{calories:156,protein:2.5,fat:.3,carbs:37.1},sourceVersion:'既存版',notes:[]};
    const snapshots={
      meals:[meal],weights:[{id:'legacy-weight',date,weight:102.8,createdAt:now}],
      settings:[{id:'user',calorieTarget:2300,proteinTarget:180,fatTarget:70,carbsTarget:260,targetWeight:90,theme:'dark',showPfcDecimals:true}],
      recipes:[{id:'legacy-recipe',name:'既存レシピ',ingredients:[ingredient],servings:2,createdAt:now,updatedAt:now}],
      favorites:[{id:'food:mext-01088:200',kind:'food',sourceId:'mext-01088',quantity:200,createdAt:now}],
      mealSets:[{id:'legacy-set',name:'既存セット',items:[{id:'part',kind:'food',sourceId:'mext-01088',name:'ご飯',quantity:200,unit:'g',nutrients:{calories:312,protein:5,fat:.6,carbs:74.2}}],total:{calories:312,protein:5,fat:.6,carbs:74.2},createdAt:now,updatedAt:now}]
    };
    await new Promise((resolve,reject)=>{
      const r=indexedDB.open('meal-log',20);r.onupgradeneeded=()=>{const db=r.result;
        for(const name of Object.keys(snapshots)){const s=db.createObjectStore(name,{keyPath:'id'});const indexes={meals:['eatenAt','mealType','sourceType','sourceId','setId'],weights:['date'],settings:[],recipes:['name','updatedAt'],favorites:['kind','sourceId'],mealSets:['name','updatedAt']}[name];for(const key of indexes)s.createIndex(key,key,{unique:name==='weights'});if(name==='meals')s.createIndex('[copiedFromId+copyTargetDate]',['copiedFromId','copyTargetDate']);}
      };r.onerror=()=>reject(r.error);r.onsuccess=()=>{const db=r.result,tx=db.transaction(Object.keys(snapshots),'readwrite');for(const [name,rows] of Object.entries(snapshots))for(const row of rows)tx.objectStore(name).add(row);tx.oncomplete=()=>{db.close();resolve();};tx.onerror=()=>reject(tx.error);};
    });return snapshots;
  });
  await page.unroute(base);await page.goto(base);await page.getByRole('button',{name:'記録',exact:true}).waitFor();
  for(const [name,rows] of Object.entries(legacy))assert.deepEqual(await store(name),rows);
  assert.equal(await page.evaluate(()=>new Promise(resolve=>{const r=indexedDB.open('meal-log');r.onsuccess=()=>{resolve(r.result.version);r.result.close();};})),30);
  checks.push('v2→v3: six tables preserved byte-for-byte');
  await page.evaluate(()=>navigator.serviceWorker.ready);
  if(await page.locator('.pwa-notice').isVisible())await page.locator('.pwa-notice').getByRole('button',{name:'閉じる'}).click();
  const urls=await page.evaluate(async()=>{const urls=[];for(const n of await caches.keys()){for(const r of await (await caches.open(n)).keys())urls.push(r.url);}return urls;});
  for(const name of ['mcdonalds','kfc','mos','sukiya','yoshinoya','matsuya','marugame'])assert.equal(urls.some(u=>u.includes('/meal-log/data/restaurants/'+name+'.json')),true,name+' cache');
  checks.push('all seven JSON files precached under /meal-log/');
  await add();await overflow('restaurant top');await page.getByRole('searchbox').fill('ダブルチキン');await page.locator('.menu-row .catalog-row').first().click();
  await page.getByRole('heading',{name:'栄養情報・出典'}).waitFor();assert.equal(await page.locator('.provenance-row').count(),4);assert.match(await page.locator('.provenance-row').nth(1).textContent(),/44.6/);await page.screenshot({path:path.join(output,'stage3-provenance-dark.png'),fullPage:true});
  await page.getByRole('button',{name:'☆ この量でお気に入り'}).click();await page.getByRole('button',{name:'＋ 今回の食事へ追加',exact:true}).click();
  await page.locator('dialog').evaluate(d=>d.scrollTo({top:0}));const bar=await page.locator('.restaurant-cart-bar').boundingBox();assert.equal(bar.y>=0 && bar.y+bar.height<=844,true,'cart bar visible without scrolling');await page.getByRole('button',{name:'〈 商品一覧へ',exact:true}).click();await page.getByRole('searchbox').fill('ｋｆｃ');await page.locator('.catalog-row').filter({has:page.getByText('KFC',{exact:true})}).first().click();
  await page.getByRole('button',{name:'☆ 店舗をお気に入り',exact:true}).click();await page.getByRole('searchbox',{name:'KFCの商品を検索'}).fill('ポテト');await page.locator('.menu-row .catalog-row').first().click();
  await page.getByRole('button',{name:'Ｓ',exact:true}).click();await page.getByRole('button',{name:'＋ 今回の食事へ追加',exact:true}).click();
  await page.getByRole('button',{name:'内容を確認',exact:true}).click();await page.getByRole('button',{name:'ダブルチキンフィレバーガーを1つ増やす',exact:true}).click();assert.match(await page.getByRole('region',{name:'合計',exact:true}).textContent(),/1,425/);
  await page.getByRole('button',{name:'フライドポテトを削除',exact:true}).click();assert.equal(await page.locator('.cart-line').count(),1);
  await page.getByRole('button',{name:'〈 商品選びを続ける',exact:true}).click();await page.getByRole('button',{name:'＋ 今回の食事へ追加',exact:true}).click();await page.getByRole('button',{name:'内容を確認',exact:true}).click();
  await overflow('cart 390');await page.screenshot({path:path.join(output,'stage3-cart-dark.png'),fullPage:true});await page.getByRole('button',{name:'昼食として登録',exact:true}).click();await waitMeals(3);
  await page.waitForFunction(()=>document.querySelector('.calorie-hero strong')?.textContent==='455');
  const saved=(await store('meals')).filter(m=>m.restaurantId);assert.equal(saved.length,2);assert.equal(saved[0].restaurantOrderId,saved[1].restaurantOrderId);assert.equal(saved.reduce((n,m)=>n+m.calories,0),1425);assert.equal((await store('favorites')).length,3);
  checks.push('cross-chain search, KFC variants, provenance, favorites, cart quantities/removal/total, lunch registration, home total');
  await page.locator('nav').getByRole('button',{name:'履歴',exact:true}).click();await page.getByText(/KFC · 同じ外食 1,425 kcal/).waitFor();await page.locator('.history-row').filter({hasText:'ダブルチキン'}).click();await page.getByRole('heading',{name:'栄養情報・出典'}).waitFor();await close();checks.push('history order grouping and source snapshot detail');
  await add();await page.getByRole('heading',{name:'最近使った店',exact:true}).waitFor();assert.equal(await page.locator('.catalog-row').filter({has:page.getByText('KFC',{exact:true})}).count()>=2,true);
  await close();await page.locator('nav').getByRole('button',{name:'設定',exact:true}).click();await page.getByRole('button',{name:'ライト',exact:true}).click();await page.waitForFunction(()=>document.documentElement.dataset.theme==='light');
  await page.locator('nav').getByRole('button',{name:'ホーム',exact:true}).click();await page.setViewportSize({width:320,height:740});await add();await overflow('top 320');await page.getByRole('searchbox').fill('牛丼');await overflow('search 320');await page.locator('.menu-row .catalog-row').first().click();await overflow('sizes 320');await page.screenshot({path:path.join(output,'stage3-sizes-light-320.png'),fullPage:true});await close();
  checks.push('390x844 and 320px, light/dark, no horizontal overflow');
  await context.close();context=await chromium.launchPersistentContext(profile,options);await context.setOffline(true);page=context.pages()[0];monitor();await page.goto(base);await page.getByRole('button',{name:'記録',exact:true}).waitFor();
  assert.deepEqual((await store('meals')).filter(m=>m.restaurantId),saved);
  for(const name of ['weights','recipes','mealSets'])assert.deepEqual(await store(name),legacy[name]);
  assert.equal((await store('favorites')).length,3);
  await add();await page.getByRole('searchbox').fill('ダブルチキン');await page.locator('.menu-row .catalog-row').first().click();await page.getByRole('heading',{name:'栄養情報・出典'}).waitFor();await page.getByRole('button',{name:'＋ 今回の食事へ追加',exact:true}).click();await page.getByRole('button',{name:'内容を確認',exact:true}).click();await page.getByRole('button',{name:'昼食として登録',exact:true}).click();await waitMeals(4);await page.reload();await page.getByRole('button',{name:'記録',exact:true}).waitFor();await waitMeals(4);
  checks.push('offline cold restart, search/detail/cart/save/reload and old records/favorites retained');
  assert.deepEqual(errors,[]);checks.push('zero console/page errors');fs.writeFileSync(path.join(output,'stage3-browser-report.json'),JSON.stringify({result:'PASS',checks,physicalSafariTested:false},null,2));console.log(JSON.stringify({result:'PASS',checks},null,2));
}
run().catch(e=>{console.error(e);process.exitCode=1;}).finally(async()=>{if(context)await context.close();});
