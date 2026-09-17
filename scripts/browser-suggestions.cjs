// Isolated synthetic IndexedDB; never uses a real user profile.
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path');
const out = path.resolve('test-results'); fs.mkdirSync(out, { recursive: true });
let context, page; const errors = [], requests = [];
const click = name => page.getByRole('button', { name, exact: true }).click();
const close = () => page.locator('dialog').getByRole('button', {name:'閉じる'}).click();
const rows = () => page.getByRole('region',{name:'バランス重視',exact:true}).locator('button.catalog-row');
async function layout() { assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false); if(await page.locator('dialog').count()) assert.equal(await page.locator('dialog').evaluate(e=>e.scrollWidth>e.clientWidth),false); }
async function records() { return page.evaluate(()=>new Promise(resolve=>{const r=indexedDB.open('meal-log');r.onsuccess=()=>{const d=r.result,t=d.transaction('meals'),q=t.objectStore('meals').getAll();t.oncomplete=()=>{resolve(q.result);d.close();};};})); }
async function seed(mode='normal',scale=3) {
  await page.evaluate(({mode,scale})=>new Promise((resolve,reject)=>{
    const request=indexedDB.open('meal-log');request.onsuccess=()=>{const d=request.result,t=d.transaction(['meals','settings'],'readwrite'),m=t.objectStore('meals'),s=t.objectStore('settings');m.clear();
      const today=new Date(),old=new Date(today);old.setDate(old.getDate()-1);old.setHours(12,0,0,0);
      const values={calories:300,protein:20,fat:5,carbs:30};
      for(let i=0;i<3;i++)m.put({id:`m${i}`,name:`試験料理${i}`,restaurant:'',...values,quantity:1,unit:'item',sourceType:'manual',confidence:null,mealType:'lunch',eatenAt:old.toISOString(),createdAt:new Date(old.getTime()+i*1000).toISOString(),updatedAt:old.toISOString()});
      if(mode!=='normal'){const v= mode==='near'?{calories:850,protein:58,fat:14,carbs:85}:mode==='all'?{calories:900,protein:60,fat:15,carbs:90}:{calories:1050,protein:40,fat:25,carbs:110};m.put({id:'today',name:'今日の記録',restaurant:'',...v,sourceType:'manual',confidence:null,mealType:'breakfast',eatenAt:today.toISOString(),createdAt:today.toISOString(),updatedAt:today.toISOString()});}
      const get=s.get('user');get.onsuccess=()=>s.put({...get.result,id:'user',calorieTarget:300*scale,proteinTarget:20*scale,fatTarget:5*scale,carbsTarget:30*scale});t.oncomplete=()=>{d.close();resolve();};t.onerror=()=>reject(t.error);
    };
  }),{mode,scale});await page.reload();await click('食事候補を見る 〉');await page.getByText('今日の残り',{exact:true}).last().waitFor();
}
async function run(){
  context=await chromium.launchPersistentContext(fs.mkdtempSync(path.join(out,'suggestions-profile-')),{channel:'chrome',headless:true,viewport:{width:390,height:844},isMobile:true,hasTouch:true,locale:'ja-JP',timezoneId:'Asia/Tokyo'});
  page=context.pages()[0];page.on('pageerror',e=>errors.push(e.message));page.on('console',e=>{if(e.type()==='error')errors.push(e.text());});page.on('request',r=>requests.push(r.url()));
  // Empty catalogue only for deterministic 1/2/3-part UI scenarios. Real catalogue checked below.
  await page.route('**/data/mext-foods.json',r=>r.fulfill({json:{metadata:{foodCount:0},foods:[]}}));
  await page.goto(process.env.APP_URL||'http://127.0.0.1:4176/meal-log/');await page.getByRole('button',{name:'食事候補を見る 〉',exact:true}).waitFor();
  const style=await page.getByRole('button',{name:'食事候補を見る 〉',exact:true}).evaluate(e=>({position:getComputedStyle(e).position,cls:e.className}));assert.ok(!['fixed','sticky'].includes(style.position));assert.equal(style.cls,'');
  await click('前日');assert.equal(await page.getByRole('button',{name:'食事候補を見る 〉',exact:true}).count(),0);await click('今日');
  for(const count of [1,2,3]){await seed('normal',count);await rows().first().waitFor();assert.match(await rows().first().innerText(),new RegExp(`^${count}品`));await layout();}
  for(const name of ['バランス重視','たんぱく質重視','いつもの食事から'])await page.getByRole('heading',{name,exact:true}).waitFor();
  assert.equal(requests.filter(u=>u.includes('/data/restaurants/')).length,0);
  const before=await records();await rows().first().click();await page.getByRole('heading',{name:'食事候補の確認'}).waitFor();assert.equal((await records()).length,before.length);
  await page.getByRole('spinbutton').first().fill('2');assert.match(await page.getByRole('region',{name:'登録する合計'}).innerText(),/1,200/);
  await page.locator('dialog').getByRole('combobox').selectOption('lunch');await layout();await click('確認して食事に登録');await page.locator('dialog').waitFor({state:'hidden'});
  await page.getByRole('region',{name:'カロリーの残り'}).getByText('1,200',{exact:true}).waitFor();const saved=await records();assert.equal(saved.length,6);for(const m of before)assert.deepEqual(saved.find(n=>n.id===m.id),m);
  await seed('near');await page.getByText('今日の目標にかなり近づいています。',{exact:true}).waitFor();
  await seed('all');await page.getByRole('button',{name:'それでも候補を見る'}).waitFor();assert.equal(await rows().count(),0);await click('それでも候補を見る');await rows().first().waitFor();
  await seed('mixed');await rows().first().waitFor();assert.match(await page.locator('dialog').innerText(),/150 kcal超過/);await layout();
  await page.setViewportSize({width:320,height:440});await page.evaluate(()=>document.documentElement.dataset.theme='dark');await layout();await rows().first().click();await page.getByRole('heading',{name:'食事候補の確認'}).waitFor();await layout();await page.screenshot({path:path.join(out,'suggestions-review-320.png')});await click('〈 候補へ戻る');
  await page.getByText('外食から探す',{exact:true}).click();const external=page.locator('details').filter({has:page.locator('summary').filter({hasText:'外食から探す'})});await external.locator('button.catalog-row').first().waitFor();await layout();await external.locator('button.catalog-row').first().click();await page.getByRole('button',{name:'＋ 今回の食事へ追加',exact:true}).waitFor();await click('＋ 今回の食事へ追加');await click('内容を確認');await page.getByRole('button',{name:/として登録/}).waitFor();await layout();
  await close();await page.unroute('**/data/mext-foods.json');await page.reload();await page.setViewportSize({width:390,height:844});await page.evaluate(()=>document.documentElement.dataset.theme='light');
  const start=Date.now();await click('食事候補を見る 〉');await rows().first().waitFor();await page.getByText('食品データを読み込み中…',{exact:true}).waitFor({state:'hidden'});const realCatalogueMs=Date.now()-start;await layout();await page.screenshot({path:path.join(out,'suggestions-real-390.png')});
  assert.deepEqual(errors,[]);const report={result:'PASS',checks:['today-only quiet Home link','1/2/3-part candidates; 3 modes','confirmation, quantity recalculation, atomic save, Home totals','near/collapsed/mixed','lazy restaurant details and existing cart','390×844 light; 320×440 dark; no overflow','real MEXT catalogue'],realCatalogueMs,errors};fs.writeFileSync(path.join(out,'suggestions-report.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));await context.close();
}
run().catch(async e=>{console.error(e);if(page)await page.screenshot({path:path.join(out,'suggestions-error.png')}).catch(()=>{});if(context)await context.close();process.exitCode=1;});
