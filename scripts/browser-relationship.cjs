// Isolated browser context, synthetic fixtures only.
const {chromium}=require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const assert=require('node:assert/strict');
(async()=>{
 const browser=await chromium.launch({channel:'chrome',headless:true});
 try {
 const context=await browser.newContext({viewport:{width:390,height:844},timezoneId:'Asia/Tokyo',locale:'ja-JP'});
 const page=await context.newPage(),errors=[];
 await page.clock.setFixedTime(new Date('2026-09-19T12:00:00+09:00'));
 page.on('pageerror',e=>errors.push(e.message));page.on('console',e=>{if(e.type()==='error')errors.push(e.text());});
 await page.goto(process.env.APP_URL || 'http://127.0.0.1:4176/meal-log/');
 await page.getByRole('button',{name:'分析',exact:true}).click();
 const card=page.getByRole('region',{name:'摂取カロリーと体重トレンド',exact:true});
 async function seed(mode='normal') {await page.evaluate(async mode=>{
 const {db}=await import('/meal-log/src/data/db.ts');const {defaultSettings}=await import('/meal-log/src/domain/types.ts');
 const {shiftDate}=await import('/meal-log/src/domain/date.ts');const meals=[],weights=[];
 for(let i=0;i<6;i++) {const end=shiftDate('2026-09-19',-7*i);
 for(let d=0;d<7;d++) {const date=shiftDate(end,-d),stamp=date+'T12:00:00+09:00';
 meals.push({id:`m${i}-${d}`,name:'関連分析テスト',restaurant:'',mealType:'lunch',eatenAt:stamp,createdAt:stamp,updatedAt:stamp,calories:mode==='low'?1500:mode==='equal'?2200:2000+i*100,protein:100,fat:50,carbs:200,sourceType:'manual',confidence:null});
 if(mode!=='sparse'||d===0)weights.push({id:`w${i}-${d}`,date,weightKg:80+(6-d)*(.01+i*.005),bodyFatPercent:24,waistCm:90,createdAt:stamp});
 }}
 await db.transaction('rw',db.meals,db.weights,db.settings,async()=>{await db.meals.clear();await db.weights.clear();await db.meals.bulkPut(meals);await db.weights.bulkPut(weights);await db.settings.put({...defaultSettings,id:'user',theme:'system',analysisExcludeLowCalories:true});});
 },mode);await page.reload();await page.getByRole('button',{name:'分析',exact:true}).click();}
 await seed();await card.getByRole('heading',{name:'データ不足',exact:true}).waitFor();
 assert.equal(await card.locator('svg').count(),0);
 const maintenance=page.getByRole('region',{name:'実績ベース推定維持カロリー',exact:true});const before=await maintenance.innerText();
 await page.getByRole('button',{name:'30日',exact:true}).click();await card.getByText('分析週：4週',{exact:false}).waitFor();assert.equal(await card.locator('svg').count(),0);
 await page.getByRole('button',{name:'90日',exact:true}).click();await card.getByText('分析週：6週',{exact:false}).waitFor();
 await card.getByText('記録上の相関：ρ = +1.00',{exact:true}).waitFor();
 await card.getByText('分析週が少ないため参考として確認してください。',{exact:true}).waitFor();
 assert.equal(await card.locator('circle').count(),6);assert.equal(await card.locator('.chart-target').count(),1);
 assert.ok((await card.locator('svg').textContent()).includes('平均摂取 kcal/日'));assert.ok((await card.locator('svg').textContent()).includes('体重トレンド kg/週'));
 assert.equal(await maintenance.innerText(),before);
 await page.getByRole('region',{name:'体脂肪率概要'}).getByText('最新の7日平均：24%（7件）',{exact:true}).waitFor();
 await page.getByRole('region',{name:'ウエスト概要'}).getByText('最新の7日平均：90cm（7件）',{exact:true}).waitFor();
 await card.getByText('週ごとの詳細',{exact:true}).click();await card.getByRole('heading',{name:'2026-09-13〜2026-09-19',exact:true}).waitFor();
 for(const [width,height,scheme] of [[390,844,'light'],[320,440,'dark']]){await page.setViewportSize({width,height});await page.emulateMedia({colorScheme:scheme});await card.scrollIntoViewIfNeeded();assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);await card.screenshot({path:`test-results/relationship-${width}.png`});}
 await page.getByRole('button',{name:'全期間',exact:true}).click();await card.getByText('分析週：6週',{exact:false}).waitFor();
 await seed('low');await page.getByRole('button',{name:'90日',exact:true}).click();await card.getByText('分析週：0週',{exact:false}).waitFor();
 await page.evaluate(async()=>{const {db}=await import('/meal-log/src/data/db.ts');await db.settings.update('user',{analysisExcludeLowCalories:false});});await card.getByText('分析週：6週',{exact:false}).waitFor();
 await card.getByText('値のばらつきがないため、相関係数を計算できません。',{exact:true}).waitFor();
 await seed('sparse');await page.getByRole('button',{name:'90日',exact:true}).click();await card.getByText('分析週：0週',{exact:false}).waitFor();
 await seed('equal');await page.getByRole('button',{name:'90日',exact:true}).click();await card.getByText('値のばらつきがないため、相関係数を計算できません。',{exact:true}).waitFor();assert.equal(await card.locator('circle').count(),6);
 assert.deepEqual(errors,[]);console.log('PASS: 390/320 light/dark, 7/30/90/all, scatter axes/zero/rho/count/details, low-cal ON/OFF, sparse/equal, 4B/5B regression, no overflow or errors');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
