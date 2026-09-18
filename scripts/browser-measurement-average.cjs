const {chromium}=require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const assert=require('node:assert/strict'),fs=require('node:fs');
(async()=>{
const browser=await chromium.launch({channel:'chrome',headless:true});
try {
const context=await browser.newContext({viewport:{width:390,height:844},timezoneId:'Asia/Tokyo',locale:'ja-JP'});
const page=await context.newPage(),errors=[];
page.on('pageerror',e=>errors.push(e.message));page.on('console',e=>{if(e.type()==='error')errors.push(e.text());});
await page.goto(process.env.APP_URL || 'http://127.0.0.1:4176/meal-log/');
await page.getByRole('button',{name:'分析',exact:true}).click();
async function seed(one=false){await page.evaluate(async one=>{
const {db}=await import('/meal-log/src/data/db.ts');
const d=n=>{const v=new Date();v.setDate(v.getDate()+n);return `${v.getFullYear()}-${String(v.getMonth()+1).padStart(2,'0')}-${String(v.getDate()).padStart(2,'0')}`;};
await db.weights.clear();
await db.weights.bulkPut(one?[{id:'one',date:d(0),weightKg:80,bodyFatPercent:24.3,createdAt:'2026-09-01T00:00:00Z'}]:[
{id:'outside',date:d(-12),bodyFatPercent:20,waistCm:90,weightKg:80,createdAt:'2026-09-01T00:00:00Z'},
{id:'start',date:d(-6),bodyFatPercent:24,waistCm:88,weightKg:82,createdAt:'2026-09-02T00:00:00Z'},
]);},one);}
const fat=page.getByRole('region',{name:'体脂肪率概要'}),waist=page.getByRole('region',{name:'ウエスト概要'});
await seed();await fat.getByText('最新の7日平均：22%（2件）',{exact:true}).waitFor();
await waist.getByText('最新の7日平均：89cm（2件）',{exact:true}).waitFor();
assert.equal(await fat.locator('.chart-average rect').count(),1);assert.equal(await fat.locator('.chart-measured circle').count(),1);
await page.getByRole('region',{name:'体重概要'}).getByText('81 kg',{exact:true}).waitFor();
for(const label of ['30日','90日','全期間','7日']){await page.getByRole('button',{name:label,exact:true}).click();assert.equal(await fat.locator('.chart-average rect').count(),label==='7日'?1:2);}
for(const [width,height,scheme] of [[390,844,'light'],[320,440,'dark']]){
 await page.setViewportSize({width,height});await page.emulateMedia({colorScheme:scheme});await fat.scrollIntoViewIfNeeded();
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
 await page.screenshot({path:`test-results/measurement-average-${width}.png`,fullPage:true});
}
await seed(true);await fat.getByText('最新の7日平均：24.3%（1件）',{exact:true}).waitFor();
await waist.getByText('この期間のウエストは未記録です。',{exact:true}).waitFor();
assert.equal(await fat.locator('.chart-average rect').count(),1);
await page.evaluate(async()=>{const {db}=await import('/meal-log/src/data/db.ts');await db.weights.clear();});
await fat.getByText('この期間の体脂肪率は未記録です。',{exact:true}).waitFor();
await waist.getByText('最新の7日平均：—',{exact:true}).waitFor();
assert.deepEqual(errors,[]);
console.log('PASS: 390/320 light/dark, periods, pre-window samples, independent metrics, single/empty, weight regression, no overflow/errors');
}finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
