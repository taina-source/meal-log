// All records and downloads belong to this isolated synthetic browser profile.
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path');
const out = path.resolve('test-results'); fs.mkdirSync(out,{recursive:true});
let context,page;const errors=[];
const tables=['meals','weights','settings','recipes','favorites','mealSets'];
const section=()=>page.getByRole('region',{name:'バックアップと復元',exact:true});
const click=name=>section().getByRole('button',{name,exact:true}).click();
const nav=name=>page.locator('nav').getByRole('button',{name,exact:true}).click();
async function raw(){return page.evaluate(tables=>new Promise((resolve,reject)=>{const r=indexedDB.open('meal-log');r.onsuccess=()=>{const d=r.result,t=d.transaction(tables),data={};for(const name of tables){const q=t.objectStore(name).getAll();q.onsuccess=()=>data[name]=q.result;}t.oncomplete=()=>{d.close();resolve(data);};t.onerror=()=>reject(t.error);};}),tables);}
async function seed(){await page.evaluate(tables=>new Promise((resolve,reject)=>{
  const r=indexedDB.open('meal-log');r.onsuccess=()=>{const d=r.result,t=d.transaction(tables,'readwrite');for(const name of tables)t.objectStore(name).clear();
    const now=new Date(),stamp=now.toISOString(),date=`${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}`;
    const m={id:'backup-meal',name:'バックアップ確認料理',restaurant:'',calories:600,protein:30,fat:20,carbs:75,sourceType:'manual',confidence:null,mealType:'lunch',eatenAt:stamp,createdAt:stamp,updatedAt:stamp};
    t.objectStore('meals').put(m);t.objectStore('weights').put({id:'backup-weight',date,weightKg:100,bodyFatPercent:24,waistCm:98,createdAt:stamp,healthExport:{weightKg:{value:100,exportedAt:stamp},bodyFatPercent:{value:24,exportedAt:stamp}}});
    t.objectStore('settings').put({id:'user',calorieTarget:2400,proteinTarget:180,fatTarget:70,carbsTarget:260,targetWeight:null,theme:'light',showPfcDecimals:true,pendingHealthExport:{createdAt:stamp,mode:'unshared',recordIds:{},payload:{schemaVersion:1,type:'meal-log-health-batch',exportId:'pending',measurements:[{date,weightKg:100}]}}});
    t.objectStore('favorites').put({id:'favorite',kind:'manualMeal',sourceId:m.id,quantity:1,createdAt:stamp,mealSnapshot:m});
    const ingredients=[{id:'i',foodId:'f',name:'材料',grams:100,per100g:{calories:100,protein:10,fat:1,carbs:15},sourceVersion:'test',notes:[]}];
    t.objectStore('recipes').put({id:'r',name:'確認レシピ',ingredients,servings:1,createdAt:stamp,updatedAt:stamp});
    t.objectStore('mealSets').put({id:'s',name:'確認セット',items:[{id:'i',kind:'food',sourceId:'f',name:'材料',quantity:100,unit:'g',nutrients:{calories:100,protein:10,fat:1,carbs:15}}],total:{calories:100,protein:10,fat:1,carbs:15},createdAt:stamp,updatedAt:stamp});
    t.oncomplete=()=>{d.close();resolve();};t.onerror=()=>reject(t.error);
  };
}),tables);await page.reload();await nav('設定');await section().waitFor();}
async function layout(){assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);}
async function file(text){await section().getByLabel('バックアップから復元',{exact:true}).setInputFiles({name:'synthetic.json',mimeType:'application/json',buffer:Buffer.from(text)});}
async function download(button){const pending=page.waitForEvent('download');await click(button);const item=await pending;const dest=path.join(out,`backup-${button==='バックアップを保存'?'export':'before'}.json`);await item.saveAs(dest);return {text:fs.readFileSync(dest,'utf8'),name:item.suggestedFilename()};}
async function run(){
  context=await chromium.launchPersistentContext(fs.mkdtempSync(path.join(out,'backup-profile-')),{channel:'chrome',headless:true,acceptDownloads:true,viewport:{width:390,height:844},isMobile:true,hasTouch:true,locale:'ja-JP',timezoneId:'Asia/Tokyo'});
  page=context.pages()[0];page.on('console',e=>{if(e.type()==='error')errors.push(e.text());});page.on('pageerror',e=>errors.push(e.message));
  await page.goto(process.env.APP_URL||'http://127.0.0.1:4176/meal-log/');await page.getByRole('button',{name:'記録',exact:true}).waitFor();await seed();
  // Simulate unavailable/denied file sharing; Blob download must remain usable.
  await page.evaluate(()=>{Object.defineProperty(navigator,'canShare',{configurable:true,value:()=>true});Object.defineProperty(navigator,'share',{configurable:true,value:async()=>{throw new Error('not supported');}});});
  const before=await raw(),exported=await download('バックアップを保存'),backup=JSON.parse(exported.text);assert.match(exported.name,/^meal-log-backup-\d{4}-\d{2}-\d{2}-\d{4}\.json$/);assert.equal(backup.type,'meal-log-backup');assert.equal(backup.data.settings[0].pendingHealthExport,undefined);assert.deepEqual(await raw(),before);
  await page.evaluate(()=>new Promise(resolve=>{const r=indexedDB.open('meal-log');r.onsuccess=()=>{const d=r.result,t=d.transaction('meals','readwrite');t.objectStore('meals').clear();t.oncomplete=()=>{d.close();resolve();};};}));
  const current=await raw();await file(exported.text);await page.getByRole('heading',{name:'復元プレビュー',exact:true}).waitFor();assert.deepEqual(await raw(),current);await layout();
  await download('現在のデータをバックアップ');assert.deepEqual(await raw(),current);
  await click('このバックアップで復元');await page.getByRole('heading',{name:'現在の全ユーザーデータを置き換えますか？'}).waitFor();assert.deepEqual(await raw(),current);await layout();await page.getByRole('region',{name:'復元プレビュー',exact:true}).scrollIntoViewIfNeeded();await page.screenshot({path:path.join(out,'backup-preview-390.png')});
  await click('置き換えて復元する');await section().getByRole('status').filter({hasText:'復元しました。'}).waitFor();assert.deepEqual(await raw(),backup.data);
  await nav('ホーム');await page.getByRole('region',{name:'カロリーの残り'}).getByText('600',{exact:true}).waitFor();assert.match(await page.getByRole('region',{name:'身体測定',exact:true}).innerText(),/体脂肪率 24%/);
  await nav('履歴');await page.getByText('バックアップ確認料理',{exact:true}).waitFor();
  await page.locator('nav').getByRole('button',{name:'食事を追加'}).click();await page.getByRole('button',{name:/お気に入り・履歴 よく使うものから/}).click();await page.locator('dialog').getByRole('button',{name:'手動入力',exact:true}).click();await page.getByText('★ バックアップ確認料理',{exact:true}).waitFor();await page.locator('dialog').getByRole('button',{name:'閉じる'}).click();
  await nav('設定');await page.getByRole('button',{name:'ダーク',exact:true}).click();await page.waitForFunction(()=>document.documentElement.dataset.theme==='dark');await page.setViewportSize({width:320,height:440});await file(exported.text);await page.getByRole('heading',{name:'復元プレビュー',exact:true}).waitFor();await layout();await section().scrollIntoViewIfNeeded();await page.screenshot({path:path.join(out,'backup-dark-320.png')});await click('復元をキャンセル');
  const unchanged=await raw();for(const bad of ['{broken',JSON.stringify({schemaVersion:1,type:'meal-log-chatgpt',items:[]})]){await file(bad);await section().getByRole('alert').waitFor();assert.deepEqual(await raw(),unchanged);assert.equal(await page.getByRole('heading',{name:'復元プレビュー',exact:true}).count(),0);}
  await context.setOffline(true);const offline=await download('バックアップを保存');await file(offline.text);await page.getByRole('heading',{name:'復元プレビュー',exact:true}).waitFor();await click('このバックアップで復元');await click('置き換えて復元する');await section().getByRole('status').filter({hasText:'復元しました。'}).waitFor();await layout();assert.deepEqual(await raw(),JSON.parse(offline.text).data);
  assert.deepEqual(errors,[]);const report={result:'PASS',checks:['390×844 light / 320×440 dark, no overflow','file-share failure fallback and JSON download','preview and confirmation before any write','full replacement, IDs/snapshots/Health metadata; no pending','Home / History / body measurements / saved favorite','invalid JSON / ChatGPT JSON rejected','offline export and restore'],syntheticBackupBytes:Buffer.byteLength(exported.text),errors};fs.writeFileSync(path.join(out,'backup-report.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));await context.close();
}
run().catch(async e=>{console.error(e);if(page)await page.screenshot({path:path.join(out,'backup-error.png')}).catch(()=>{});if(context)await context.close();process.exitCode=1;});
