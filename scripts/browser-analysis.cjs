// Synthetic records in an isolated profile only. Never opens a user's browser profile.
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path');
const out = path.resolve('test-results'); fs.mkdirSync(out, { recursive: true });
const profile = fs.mkdtempSync(path.join(out, 'analysis-profile-'));
const base = process.env.APP_URL || 'http://127.0.0.1:4175/meal-log/';
let context, page; const errors = [], checks = [];
async function open() { await page.locator('nav').getByRole('button', { name: '分析', exact: true }).click(); await page.getByRole('heading', { name: '摂取カロリー概要', exact: true }).waitFor(); }
async function overflow() { assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false); }
async function seed(mode) {
  await page.evaluate(async mode => {
    const date = offset => { const d = new Date(); d.setHours(12,0,0,0); d.setDate(d.getDate() - offset); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; };
    const meals = [], weights = [];
    if (['both','meal'].includes(mode)) for(let i=0;i<14;i++) {
      if ([1,3,5].includes(i)) continue;
      for(let j=0;j<(i===0?2:1);j++) {
        const calories=i===0?(j===0?1000:500):i<7?1500:1200, timestamp = new Date(`${date(i)}T12:00:00`).toISOString();
        meals.push({id:`meal-${i}-${j}`,name:'分析テスト',restaurant:'',mealType:'lunch',eatenAt:timestamp,createdAt:timestamp,updatedAt:timestamp,sourceType:'manual',confidence:null,calories,protein:calories/10,fat:calories/20,carbs:calories/5});
      }
    }
    if (['both','weight','one'].includes(mode)) for(const [i,value] of mode==='one'?[[0,80]]:[[0,80],[2,81],[6,82],[8,84]]) weights.push({id:`weight-${i}`,date:date(i),weight:value,createdAt:new Date().toISOString()});
    await new Promise((resolve,reject)=>{const r=indexedDB.open('meal-log');r.onerror=()=>reject(r.error);r.onsuccess=()=>{const db=r.result,tx=db.transaction(['meals','weights','settings'],'readwrite');for(const name of ['meals','weights'])tx.objectStore(name).clear();for(const row of meals)tx.objectStore('meals').put(row);for(const row of weights)tx.objectStore('weights').put(row);tx.objectStore('settings').put({id:'user',calorieTarget:2000,proteinTarget:160,fatTarget:70,carbsTarget:260,targetWeight:null,theme:'system',showPfcDecimals:true});tx.oncomplete=()=>{db.close();resolve();};tx.onerror=()=>reject(tx.error);};});
  }, mode);
  await page.reload(); await open();
}
async function run() {
  context=await chromium.launchPersistentContext(profile,{channel:'chrome',headless:true,viewport:{width:390,height:844},isMobile:true,hasTouch:true,locale:'ja-JP',timezoneId:'Asia/Tokyo'});
  page=context.pages()[0];page.on('pageerror',e=>errors.push(e.message));page.on('console',e=>{if(e.type()==='error')errors.push(e.text());});
  await page.goto(base);await open();
  await page.getByText('まだ分析できる記録がありません。ホームで食事や体重を記録してください。').waitFor();
  await overflow();await page.screenshot({path:path.join(out,'analysis-empty-390.png')});checks.push('empty state');
  await seed('both');
  const overview=page.getByRole('region',{name:'摂取カロリー概要',exact:true});
  await overview.getByText('記録日 4 / 7日',{exact:true}).waitFor();
  assert.ok((await overview.innerText()).includes('1,500'));assert.ok((await overview.innerText()).includes('-500'));
  await page.getByRole('region',{name:'体重概要'}).getByText('-2 kg',{exact:true}).waitFor();
  await page.getByRole('region',{name:'体重概要'}).getByText('81 kg',{exact:true}).waitFor();
  for(const label of ['30日','90日','全期間','7日']) {await page.getByRole('button',{name:label,exact:true}).click();await overflow();}
  await page.getByText('カロリーの日別データ',{exact:true}).click();await page.getByRole('table').filter({has:page.getByText('食事記録のある日の合計',{exact:true})}).waitFor();
  await page.getByText('体重の日別データ',{exact:true}).click();
  const trend=page.getByRole('region',{name:'最近の傾向'});await trend.scrollIntoViewIfNeeded();assert.ok((await trend.innerText()).includes('+300'));
  checks.push('periods, recorded-day means, target difference, weight change/average, accessible daily data, trends');
  for(const scheme of ['light','dark']) {
    await page.emulateMedia({colorScheme:scheme});
    for(const width of process.env.DEVELOPMENT_CHECK ? [390] : [390,320]) {
      await page.setViewportSize({width,height:844});await page.evaluate(()=>scrollTo(0,0));await overflow();
      await page.screenshot({path:path.join(out,`analysis-${scheme}-${width}.png`),fullPage:true});
      await trend.scrollIntoViewIfNeeded();await overflow();
    }
  }
  await seed('one');await page.getByText('比較するには2日以上の記録が必要です').waitFor();
  await seed('meal');await page.getByText('この期間の体重は未記録です。ホームから体重を記録できます。').waitFor();
  await seed('weight');await overview.getByText('記録日 0 / 7日',{exact:true}).waitFor();
  await page.getByText('記録が少ないため傾向判定なし（各期間4日以上が必要です）。').waitFor();
  checks.push(`${process.env.DEVELOPMENT_CHECK ? '390' : '390/320'} light/dark and scrolling; single weight, meals only, weights only, sparse trends`);
  assert.deepEqual(errors,[]);const report={result:'PASS',checks,errors};fs.writeFileSync(path.join(out,'analysis-browser-report.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));await context.close();
}
run().catch(async error=>{console.error(error);if(context)await context.close();process.exitCode=1;});
