// Synthetic local profile only. Existing user browser/IndexedDB data is never opened.
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const out=path.resolve('test-results');fs.mkdirSync(out,{recursive:true});
const profile=fs.mkdtempSync(path.join(out,'stage3a3-profile-'));
const base=process.env.APP_URL||'http://127.0.0.1:4175/meal-log/';
const files=['mcdonalds','kfc','mos','sukiya','yoshinoya','matsuya','marugame','subway','nakau','hanamaru','coco','ootoya','royalhost','bikkuri','gusto','joyfull','tenka','ohsho','sushiro','kura','hama'];
const items=files.flatMap(f=>JSON.parse(fs.readFileSync(`public/data/restaurants/${f}.json`,'utf8')).items);
const find=(chain,name,size)=>{const r=items.find(i=>i.restaurantId==='restaurant:'+chain&&i.name===name&&(!size||i.size===size)&&(!i.region||['通常店','丸の内新東京ビル店'].includes(i.region)));assert.ok(r,`${chain}/${name}/${size}`);return r;};
const options={channel:'chrome',headless:true,viewport:{width:390,height:844},deviceScaleFactor:2,isMobile:true,hasTouch:true,locale:'ja-JP',timezoneId:'Asia/Tokyo'};
let context,page;const errors=[],checks=[],external=[];
function monitor(){page.on('pageerror',e=>errors.push(e.message));page.on('console',e=>{if(e.type()==='error')errors.push(e.text());});page.on('request',r=>{if(!r.url().startsWith(new URL(base).origin)&&!r.url().startsWith('data:'))external.push(r.url());});}
const store=name=>page.evaluate(name=>new Promise((resolve,reject)=>{const r=indexedDB.open('meal-log');r.onerror=()=>reject(r.error);r.onsuccess=()=>{const d=r.result,q=d.transaction(name).objectStore(name).getAll();q.onsuccess=()=>{resolve(q.result);d.close();};};}),name);
async function noOverflow(label){assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),label);if(await page.locator('dialog').count())assert.ok(await page.locator('dialog').evaluate(d=>d.scrollWidth<=d.clientWidth),label+' dialog');}
async function add(){await page.locator('nav').getByRole('button',{name:'食事を追加',exact:true}).click();await page.getByRole('button',{name:'昼食',exact:true}).click();await page.getByRole('button',{name:/^外食 21チェーン/}).click();await page.getByRole('searchbox').waitFor();}
const close=()=>page.getByRole('button',{name:'閉じる',exact:true}).click();
async function openStore(chain){await page.getByRole('searchbox').fill(chain);await page.locator('.catalog-row').filter({has:page.getByText(chain,{exact:true})}).first().click();await page.getByRole('searchbox',{name:chain+'の商品を検索'}).waitFor();}
async function detail(item){await page.getByRole('searchbox').fill(item.name);await page.locator('.menu-row .catalog-row').filter({has:page.getByText(item.name,{exact:true})}).first().click();const variant=page.getByRole('button',{name:item.variantName||'標準',exact:true});if(await variant.count())await variant.click();await page.getByRole('heading',{name:'栄養情報・出典'}).waitFor();assert.equal(await page.locator('.provenance-row').count(),4);await noOverflow(item.name);}
async function addItem(item){await detail(item);await page.getByRole('button',{name:'＋ 今回の食事へ追加',exact:true}).click();await page.getByRole('button',{name:'〈 商品一覧へ',exact:true}).click();}
async function top(){await page.getByRole('button',{name:'〈 外食一覧へ',exact:true}).click();}
async function waitMeals(n){await page.waitForFunction(n=>new Promise(resolve=>{const r=indexedDB.open('meal-log');r.onsuccess=()=>{const d=r.result,q=d.transaction('meals').objectStore('meals').count();q.onsuccess=()=>{resolve(q.result===n);d.close();};};}),n);}
async function run(){
 context=await chromium.launchPersistentContext(profile,options);page=context.pages()[0];monitor();
 await page.route(base,r=>r.fulfill({contentType:'text/html',body:'<!doctype html><link rel="icon" href="./favicon.svg"><p>v3 compatibility seed</p>'}));await page.goto(base);
 const legacy=await page.evaluate(async snapshot=>{
  const d=new Date(),date=`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`,now=d.toISOString();
  const meal={id:'legacy-manual',name:'従来の食事',restaurant:'',calories:420,protein:20,fat:12,carbs:50,mealType:'breakfast',eatenAt:new Date(date+'T08:00:00').toISOString(),createdAt:now,updatedAt:now,sourceType:'manual',confidence:null};
  const snapshots={meals:[meal,{...meal,id:'legacy-restaurant',name:snapshot.name,restaurant:'KFC',calories:snapshot.calories,protein:snapshot.protein,fat:snapshot.fat,carbs:snapshot.carbs,restaurantId:'restaurant:KFC',restaurantName:'KFC',restaurantOrderId:'legacy-order',restaurantSnapshot:snapshot,nutrientProvenance:snapshot.nutrientProvenance,sourceId:snapshot.id,sourceType:'official',sourceVersion:snapshot.sourceVersion,quantity:1,unit:'item'}],weights:[{id:'legacy-weight',date,weight:102.8,createdAt:now}],settings:[{id:'user',calorieTarget:2400,proteinTarget:180,fatTarget:70,carbsTarget:260,targetWeight:90,theme:'dark',showPfcDecimals:true}],recipes:[{id:'legacy-recipe',name:'以前のレシピ',servings:2,ingredients:[],createdAt:now,updatedAt:now}],favorites:[{id:'food:legacy:200',kind:'food',sourceId:'legacy-food',quantity:200,createdAt:now}],mealSets:[{id:'legacy-set',name:'以前のセット',items:[],createdAt:now,updatedAt:now}]};
  await new Promise((resolve,reject)=>{const r=indexedDB.open('meal-log',30);r.onupgradeneeded=()=>{const db=r.result;for(const name of Object.keys(snapshots)){const s=db.createObjectStore(name,{keyPath:'id'});const keys={meals:['eatenAt','mealType','sourceType','sourceId','setId','restaurantId','restaurantOrderId'],weights:['date'],settings:[],recipes:['name','updatedAt'],favorites:['kind','sourceId'],mealSets:['name','updatedAt']}[name];for(const key of keys)s.createIndex(key,key,{unique:name==='weights'});if(name==='meals')s.createIndex('[copiedFromId+copyTargetDate]',['copiedFromId','copyTargetDate']);}};r.onerror=()=>reject(r.error);r.onsuccess=()=>{const db=r.result,tx=db.transaction(Object.keys(snapshots),'readwrite');for(const [name,rows]of Object.entries(snapshots))for(const row of rows)tx.objectStore(name).add(row);tx.oncomplete=()=>{db.close();resolve();};tx.onerror=()=>reject(tx.error);};});return snapshots;
 },find('KFC','ダブルチキンフィレバーガー'));
 await page.unroute(base);await page.goto(base);await page.getByRole('button',{name:'記録',exact:true}).waitFor();for(const [name,rows] of Object.entries(legacy))assert.deepEqual(await store(name),rows);
 await page.evaluate(()=>navigator.serviceWorker.ready);if(await page.locator('.pwa-notice').isVisible())await page.locator('.pwa-notice').getByRole('button',{name:'閉じる'}).click();
 const urls=await page.evaluate(async()=>{const result=[];for(const name of await caches.keys())for(const r of await(await caches.open(name)).keys())result.push(r.url);return result;});for(const f of files)assert.ok(urls.some(u=>u.includes(`/meal-log/data/restaurants/${f}.json`)),f+' precache');assert.ok(urls.some(u=>u.includes('/data/mext-foods.json')));checks.push('v3 all six stores and existing KFC snapshot unchanged; twenty-one restaurant JSON + food data precached');

 const expected=[];await add();await noOverflow('top390');await page.screenshot({path:path.join(out,'stage3a3-top-dark-390.png'),fullPage:true});
 for(const name of ['ガスト','ジョイフル','天下一品','餃子の王将','スシロー','くら寿司','はま寿司'])assert.ok(await page.locator('.catalog-row').filter({has:page.getByText(name,{exact:true})}).count()>0);
 assert.equal(await page.getByText(/メニューデータは今後追加予定/).count(),0);
 const first=chain=>items.find(i=>i.restaurantId==='restaurant:'+chain);
 const blocked=[['ガスト',items.find(i=>i.restaurantId==='restaurant:ガスト'&&i.name.includes('ハンバーグ'))],['天下一品',first('天下一品')],['餃子の王将',items.find(i=>i.restaurantId==='restaurant:餃子の王将'&&i.name.startsWith('餃子')&&i.size.includes('ジャスト'))],['スシロー',first('スシロー')],['くら寿司',find('くら寿司','赤えび（一貫）')],['はま寿司',find('はま寿司','まぐろ')]];
 for(const [chain,item]of blocked){
   await openStore(chain);await page.getByRole('button',{name:'☆ 店舗をお気に入り',exact:true}).click();await detail(item);
   assert.ok(await page.getByRole('button',{name:'＋ 今回の食事へ追加',exact:true}).isDisabled());assert.equal(await page.locator('.serving-basis').textContent(),item.servingBasis);
   await page.getByRole('button',{name:'☆ この量でお気に入り'}).click();await page.screenshot({path:path.join(out,'stage3a3-'+item.id.split('-')[0]+'-source.png'),fullPage:true});
   await page.getByRole('button',{name:'〈 商品一覧へ',exact:true}).click();await top();checks.push(chain+' actual menu, condition/serving basis, four provenance rows, safe registration refusal, store/menu favorites');
 }
 // Full registration regression for the old KFC, CoCo and Bikkuri flows, plus Joyfull.
 const plans=[['ジョイフル',[first('ジョイフル'),items.find(i=>i.restaurantId==='restaurant:ジョイフル'&&i.name==='キッズうどん')]],['KFC',[find('KFC','フライドポテト','Ｓ')]],['CoCo壱番屋',[find('CoCo壱番屋','ポークカレー','ライス300g'),find('CoCo壱番屋','チーズ')]],['びっくりドンキー',[find('びっくりドンキー','レギュラーハンバーグディッシュ','M')]]];
 for(const [chain,menus]of plans){await openStore(chain);for(const item of menus){await addItem(item);expected.push(item);}await top();checks.push(chain+' search/variant/provenance/cart');}
 await page.getByRole('searchbox').fill('まぐろ');
 // Pagination must not hide the presence of a chain forever.
 while(await page.getByRole('button',{name:/さらに表示/}).count())await page.getByRole('button',{name:/さらに表示/}).click();
 for(const chain of ['スシロー','くら寿司','はま寿司'])assert.ok(await page.locator('.menu-row').filter({hasText:chain}).count()>0);
 await noOverflow('cross tuna390');await page.screenshot({path:path.join(out,'stage3a3-tuna-search.png'),fullPage:true});
 await page.getByRole('button',{name:'内容を確認',exact:true}).click();
 for(const item of expected){const line=page.locator('.cart-line').filter({has:page.getByRole('heading',{name:item.name,exact:true})});await line.getByRole('button',{name:/を1つ増やす/}).click();assert.equal(await line.locator('output').textContent(),'2'+(item.quantityUnit??''));}
 // Decrease then increase verifies both directions without changing the final expected total.
 await page.getByRole('button',{name:/を1つ減らす/}).first().click();await page.getByRole('button',{name:/を1つ増やす/}).first().click();
 const expectedCalories=expected.reduce((sum,i)=>sum+2*i.calories,0);
 await noOverflow('cart390');await page.screenshot({path:path.join(out,'stage3a3-cart.png'),fullPage:true});await page.getByRole('button',{name:'昼食として登録',exact:true}).click();await waitMeals(2+expected.length);
 const saved=(await store('meals')).filter(m=>!m.id.startsWith('legacy-'));assert.equal(new Set(saved.map(m=>m.restaurantOrderId)).size,1);
 for(const key of ['calories','protein','fat','carbs'])assert.ok(Math.abs(saved.reduce((sum,m)=>sum+m[key],0)-expected.reduce((sum,i)=>sum+2*i[key],0))<0.00001);
 for(const item of expected){const entry=saved.find(m=>m.sourceId===item.id);assert.deepEqual(entry.restaurantSnapshot,item);assert.deepEqual(entry.nutrientProvenance,item.nutrientProvenance);}
 const total=expectedCalories+legacy.meals.reduce((s,m)=>s+m.calories,0);await page.waitForFunction(expected=>document.querySelector('.calorie-meta')?.textContent.includes(expected),Math.round(total).toLocaleString('ja-JP'));
 await page.locator('nav').getByRole('button',{name:'履歴',exact:true}).click();
 for(const item of expected){await page.locator('.history-row').filter({hasText:item.name}).first().click();await page.getByRole('heading',{name:'栄養情報・出典'}).waitFor();await close();}
 checks.push('Joyfull + KFC/CoCo/Bikkuri quantity change, kcal/PFC total, atomic order group, full snapshots, home and each history detail');
 await add();await page.getByRole('heading',{name:'最近使った店',exact:true}).waitFor();await openStore('ジョイフル');await detail(first('ジョイフル'));await page.getByRole('button',{name:'☆ この量でお気に入り'}).click();await close();
 await page.locator('nav').getByRole('button',{name:'設定',exact:true}).click();await page.getByRole('button',{name:'ライト',exact:true}).click();await page.waitForFunction(()=>document.documentElement.dataset.theme==='light');await page.locator('nav').getByRole('button',{name:'ホーム',exact:true}).click();
 await page.setViewportSize({width:320,height:740});await add();await noOverflow('top320');await openStore('くら寿司');await page.getByRole('searchbox').focus();await page.setViewportSize({width:320,height:440});await detail(find('くら寿司','赤えび（一貫）'));await page.getByRole('button',{name:'★ お気に入りを解除'}).scrollIntoViewIfNeeded();await noOverflow('keyboard320');await page.screenshot({path:path.join(out,'stage3a3-keyboard-light-320.png'),fullPage:true});await close();
 checks.push('390x844 dark, 320px light, 440px keyboard viewport, scrollable detail, no horizontal overflow');
 const favorites=await store('favorites');await context.close();context=await chromium.launchPersistentContext(profile,options);await context.setOffline(true);page=context.pages()[0];monitor();await page.goto(base);await page.getByRole('button',{name:'記録',exact:true}).waitFor();
 assert.deepEqual((await store('meals')).filter(m=>!m.id.startsWith('legacy-')),saved);for(const name of ['weights','recipes','mealSets'])assert.deepEqual(await store(name),legacy[name]);assert.deepEqual(await store('favorites'),favorites);for(const meal of legacy.meals)assert.deepEqual((await store('meals')).find(m=>m.id===meal.id),meal);
 for(const chain of [...new Set(items.map(i=>i.restaurantId.replace('restaurant:','')))]){await add();await openStore(chain);assert.ok(await page.locator('.menu-row').count()>0);await close();}
 await add();await openStore('スシロー');await detail(first('スシロー'));assert.ok(await page.getByRole('button',{name:'＋ 今回の食事へ追加',exact:true}).isDisabled());await close();
 await add();await openStore('ジョイフル');await addItem(first('ジョイフル'));await page.getByRole('button',{name:'内容を確認',exact:true}).click();await page.getByRole('button',{name:'昼食として登録',exact:true}).click();await waitMeals(3+expected.length);await page.reload();await page.getByRole('button',{name:'記録',exact:true}).waitFor();await waitMeals(3+expected.length);
 checks.push('offline browser exit/restart, all 21 chains searchable, source/units/refusal, Joyfull registration/reload, legacy v3 six-table data/favorites retained');
 assert.deepEqual(errors,[]);assert.deepEqual(external,[]);checks.push('zero console/page errors and no automatic external site requests');fs.writeFileSync(path.join(out,'stage3a3-browser-report.json'),JSON.stringify({result:'PASS',checks,physicalSafariTested:false},null,2));console.log(JSON.stringify({result:'PASS',checks},null,2));
}
run().catch(e=>{console.error(e);process.exitCode=1;}).finally(async()=>{if(context)await context.close();});
