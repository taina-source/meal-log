// UI calculation fixture only. No synthetic nutrition enters the distributed JSON.
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const base=process.env.APP_URL||'http://127.0.0.1:4175/meal-log/';
const output=path.resolve('test-results');fs.mkdirSync(output,{recursive:true});
const original=JSON.parse(fs.readFileSync('public/data/restaurants/sushiro.json','utf8'));
const nutrients=JSON.parse(fs.readFileSync('public/data/restaurants/joyfull.json','utf8')).items[0];
const fixture=[2,null].map((pieces,index)=>({...structuredClone(nutrients),id:'test-units-'+index,productGroupId:'test-units-'+index,restaurantId:'restaurant:スシロー',name:index?'貫数なしの数量テスト専用':'2貫の数量テスト専用',variantName:pieces?'2貫／1皿':'1皿',size:pieces?'2貫／1皿':'1皿',servingBasis:pieces?'2貫／1皿':'1皿',quantityUnit:'皿',piecesPerServing:pieces,notes:['ブラウザー計算検証専用。実商品・実栄養情報ではありません。']}));
let browser;
async function run(){
 browser=await chromium.launch({channel:'chrome',headless:true});
 const context=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true,locale:'ja-JP',serviceWorkers:'block'});
 await context.route('**/data/restaurants/sushiro.json',r=>r.fulfill({contentType:'application/json',body:JSON.stringify({...original,metadata:{...original.metadata,variantCount:2,productCount:2},items:fixture})}));
 const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto(base);await page.locator('nav').getByRole('button',{name:'食事を追加',exact:true}).click();await page.getByRole('button',{name:'昼食',exact:true}).click();await page.getByRole('button',{name:/^外食 21チェーン/}).click();
 for(const item of fixture){await page.getByRole('searchbox').fill(item.name);await page.locator('.menu-row .catalog-row').click();await page.getByRole('button',{name:'＋ 今回の食事へ追加',exact:true}).click();await page.getByRole('button',{name:'〈 商品一覧へ',exact:true}).click();}
 await page.getByRole('button',{name:'内容を確認',exact:true}).click();
 for(const [index,quantity]of [[0,3],[1,2]]){const row=page.locator('.cart-line').filter({hasText:fixture[index].name});for(let n=1;n<quantity;n++)await row.getByRole('button',{name:/を1つ増やす/}).click();assert.equal(await row.locator('output').textContent(),quantity+'皿');}
 assert.equal(await page.getByText('合計 6貫相当',{exact:true}).count(),1);assert.equal(await page.getByText(/合計 4貫相当/).count(),0);
 await page.setViewportSize({width:320,height:440});assert.ok(await page.locator('dialog').evaluate(d=>d.scrollWidth<=d.clientWidth));await page.screenshot({path:path.join(output,'serving-units-fixture-320.png')});
 await page.getByRole('button',{name:'昼食として登録',exact:true}).click();await page.getByRole('button',{name:'記録',exact:true}).waitFor();
 const saved=await page.evaluate(()=>new Promise(resolve=>{const r=indexedDB.open('meal-log');r.onsuccess=()=>{const d=r.result,q=d.transaction('meals').objectStore('meals').getAll();q.onsuccess=()=>{d.close();resolve(q.result);};};}));
 assert.equal(saved.length,2);for(const i of [0,1]){const entry=saved.find(m=>m.sourceId===fixture[i].id);assert.equal(entry.quantity,i?2:3);assert.deepEqual(entry.restaurantSnapshot,fixture[i]);}
 assert.equal(new Set(saved.map(m=>m.restaurantOrderId)).size,1);assert.equal(saved.reduce((n,m)=>n+m.calories,0),nutrients.calories*5);assert.deepEqual(errors,[]);
 const report={result:'PASS',syntheticFixtureOnly:true,actualSushiRegistration:'blocked (PFC unknown)',checks:['3皿 / 6貫相当','貫数不明は皿数のみ','320px・低いviewport','数量・提供単位・provenance snapshot','注文グループ・合計']};
 fs.writeFileSync(path.join(output,'serving-units-browser-report.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));
}
run().catch(e=>{console.error(e);process.exitCode=1;}).finally(async()=>{if(browser)await browser.close();});
