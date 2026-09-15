// Isolated test profile only; production user records are never opened.
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path');
const out = path.resolve('test-results');fs.mkdirSync(out,{recursive:true});
const base=process.env.APP_URL||'http://127.0.0.1:4175/meal-log/';
let context,page;const errors=[],checks=[];
const nav=label=>page.locator('nav').getByRole('button',{name:label,exact:true}).click();
async function noOverflow(){assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);}
async function records(){return page.evaluate(()=>new Promise(resolve=>{const r=indexedDB.open('meal-log');r.onsuccess=()=>{const db=r.result,q=db.transaction('meals').objectStore('meals').getAll();q.onsuccess=()=>{db.close();resolve(q.result);};};}));}
async function quick(){await nav('食事を追加');await page.getByRole('button',{name:/^かんたん入力/}).click();await page.getByRole('button',{name:'割合（%）',exact:true}).waitFor();}
async function save(){await page.getByRole('button',{name:'食事を記録',exact:true}).click();await page.locator('dialog').waitFor({state:'hidden'});}
async function run(){
 context=await chromium.launchPersistentContext(fs.mkdtempSync(path.join(out,'analysis-quick-profile-')),{channel:'chrome',headless:true,viewport:{width:390,height:844},isMobile:true,hasTouch:true,locale:'ja-JP',timezoneId:'Asia/Tokyo'});
 page=context.pages()[0];page.on('pageerror',e=>errors.push(e.message));page.on('console',e=>{if(e.type()==='error')errors.push(e.text());});
 await page.goto(base);await page.getByRole('button',{name:'記録',exact:true}).waitFor();
 await page.evaluate(()=>new Promise(resolve=>{const r=indexedDB.open('meal-log');r.onsuccess=()=>{const db=r.result,tx=db.transaction('meals','readwrite');for(let i=0;i<2;i++){const d=new Date();d.setHours(12,0,0,0);d.setDate(d.getDate()-i);const t=d.toISOString();tx.objectStore('meals').add({id:'old-'+i,name:'残す記録',restaurant:'',mealType:'lunch',eatenAt:t,createdAt:t,updatedAt:t,sourceType:'manual',confidence:null,calories:i?2000:1500,protein:100,fat:50,carbs:200});}tx.oncomplete=()=>{db.close();resolve();};};}));
 await page.reload();const original=await records();await nav('分析');
 await page.getByText('記録日 2 / 7日 · 分析対象 1日',{exact:true}).waitFor();await page.getByText('1,500 kcal以下の1日を平均から除外',{exact:true}).waitFor();
 await page.getByText('カロリーの日別データ',{exact:true}).click();await page.getByText('平均対象外',{exact:true}).waitFor();await noOverflow();
 await page.screenshot({path:path.join(out,'analysis-exclusion-390.png'),fullPage:true});
 await nav('設定');const toggle=page.getByRole('switch',{name:'低カロリー日を分析から除外'});assert.equal(await toggle.getAttribute('aria-checked'),'true');await toggle.click();await page.waitForFunction(()=>document.querySelector('#analysis-low')?.getAttribute('aria-checked')==='false');
 await nav('分析');await page.getByText('記録日 2 / 7日 · 分析対象 2日',{exact:true}).waitFor();assert.ok((await page.getByRole('region',{name:'摂取カロリー概要',exact:true}).innerText()).includes('1,750'));
 await nav('設定');await toggle.click();await page.waitForFunction(()=>document.querySelector('#analysis-low')?.getAttribute('aria-checked')==='true');await page.getByLabel('分析対象最低カロリー',{exact:false}).fill('2000');await page.getByRole('button',{name:'分析設定を保存',exact:true}).click();await page.getByText('分析設定を保存しました',{exact:true}).waitFor();await noOverflow();
 await nav('分析');await page.getByText('記録日 2 / 7日 · 分析対象 0日',{exact:true}).waitFor();checks.push('default ON/1500, OFF restores mean, threshold equality, counts and retained daily data');
 await quick();assert.equal(await page.locator('dialog').getByRole('spinbutton',{name:/^P たんぱく質/}).inputValue(),'25');await page.locator('dialog').getByRole('spinbutton',{name:/^カロリー/}).fill('900');await page.locator('dialog').getByRole('spinbutton',{name:/^P たんぱく質/}).fill('50');await page.getByLabel('食事名（任意）',{exact:true}).fill('割合テスト');await page.getByText(/割合の合計が100%から/).waitFor();
 await page.screenshot({path:path.join(out,'quick-percent-390.png'),fullPage:true});await save();
 await quick();assert.equal(await page.locator('dialog').getByRole('spinbutton',{name:/^P たんぱく質/}).inputValue(),'50');await page.getByRole('button',{name:'グラム',exact:true}).click();await page.locator('dialog').getByRole('spinbutton',{name:/^カロリー/}).fill('100');await page.locator('dialog').getByRole('spinbutton',{name:/^P たんぱく質/}).fill('100');await page.getByLabel('食事名（任意）',{exact:true}).fill('グラムテスト');await page.getByText(/入力カロリーとPFCの差が大きい/).waitFor();
 await page.setViewportSize({width:320,height:440});await noOverflow();await page.getByRole('button',{name:'食事を記録',exact:true}).scrollIntoViewIfNeeded();await page.screenshot({path:path.join(out,'quick-grams-320.png')});await save();
 await quick();await page.getByRole('button',{name:'PFCを入力しない',exact:true}).click();await page.getByText(/PFC分析でも0g/).waitFor();await page.locator('dialog').getByRole('spinbutton',{name:/^カロリー/}).fill('500');await page.getByLabel('食事名（任意）',{exact:true}).fill('PFCなしテスト');await noOverflow();await save();
 const saved=await records();assert.deepEqual(saved.filter(x=>x.id.startsWith('old-')),original);const pct=saved.find(x=>x.name==='割合テスト');assert.equal(pct.protein,112.5);assert.equal(pct.fat,30);assert.equal(pct.carbs,101.25);assert.equal(pct.sourceType,'manual');const grams=saved.find(x=>x.name==='グラムテスト');assert.equal(grams.protein,100);const none=saved.find(x=>x.name==='PFCなしテスト');assert.equal(none.protein+none.fat+none.carbs,0);
 await nav('設定');await noOverflow();await nav('分析');await noOverflow();checks.push('percentage reuse, gram 4/9/4 warning saves, no-PFC saves zero, old records unchanged, 390/320 layout');
 assert.deepEqual(errors,[]);console.log(JSON.stringify({result:'PASS',checks,errors},null,2));fs.writeFileSync(path.join(out,'analysis-quick-report.json'),JSON.stringify({result:'PASS',checks,errors},null,2));await context.close();
}
run().catch(async e=>{console.error(e);if(context)await context.close();process.exitCode=1;});
