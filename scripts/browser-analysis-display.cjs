const {chromium}=require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const assert=require('node:assert/strict');
(async()=>{
 const browser=await chromium.launch({channel:'chrome',headless:true});
 try {
  const context=await browser.newContext({viewport:{width:390,height:844},timezoneId:'Asia/Tokyo',locale:'ja-JP'});
  const page=await context.newPage(),errors=[];
  page.on('pageerror',e=>errors.push(e.message));page.on('console',e=>{if(e.type()==='error')errors.push(e.text());});
  await page.clock.install({time:new Date('2026-09-23T12:00:00+09:00')});
  await page.goto(process.env.APP_URL || 'http://127.0.0.1:4176/meal-log/');
  await page.evaluate(async()=>{
   const {db}=await import('/meal-log/src/data/db.ts');const {defaultSettings}=await import('/meal-log/src/domain/types.ts');
   await db.settings.put({...defaultSettings,id:'user',theme:'system',calorieTarget:2600});
   const stamp='2026-09-01T00:00:00Z';
   await db.meals.bulkPut([['a','2026-09-23',2300,130,60,250],['b','2026-09-21',0,0,0,0],['c','2026-08-25',1900,100,50,200]].map(([id,date,calories,protein,fat,carbs])=>({id,name:id,restaurant:'',calories,protein,fat,carbs,mealType:'lunch',eatenAt:new Date(`${date}T12:00:00`).toISOString(),createdAt:stamp,updatedAt:stamp,sourceType:'manual',confidence:null})));
   await db.weights.bulkPut([{id:'w1',date:'2026-09-21',weightKg:80,bodyFatPercent:24,waistCm:90,createdAt:stamp},{id:'w2',date:'2026-09-23',weightKg:79,bodyFatPercent:22,waistCm:88,createdAt:stamp}]);
  });
  const button=name=>page.getByRole('button',{name,exact:true});
  const section=id=>page.locator(`[data-section="${id}"]`);
  const intake=section('intake');
  const check=name=>intake.getByRole('checkbox',{name,exact:true});
  // React takes its checked value from Settings after the IndexedDB/liveQuery round trip.
  // Click once, then retry the actual DOM state instead of Playwright check()'s immediate assertion.
  async function toggle(name,value) {
   const checkbox=check(name);
   if(await checkbox.isChecked()!==value) await checkbox.click();
   const element=await checkbox.elementHandle();
   await page.waitForFunction(({element,value})=>element.checked===value && !element.disabled,{element,value});
   await element.dispose();
  }
  const order=()=>page.locator('.analysis-section').evaluateAll(nodes=>nodes.map(n=>n.dataset.section));
  const saved=()=>page.evaluate(async()=>{const {db}=await import('/meal-log/src/data/db.ts');return db.settings.get('user');});
  await button('分析').click();await intake.getByRole('heading',{name:'摂取カロリー・PFC推移'}).waitFor();
  const initial=await order();assert.equal(initial.length,11);
  assert.equal(await check('kcal').isChecked(),true);assert.equal(await check('P (g)').isChecked(),false);
  for(const name of ['P (g)','F (g)','C (g)']) await toggle(name,true);
  assert.deepEqual((await saved()).analysisSeries,{calories:true,protein:true,fat:true,carbs:true});
  if(process.env.CHECKBOX_PROBE==='1'){console.log('PASS checkbox probe: correct accessible targets, DOM ON and persisted P/F/C, calorieTarget preserved');assert.equal((await saved()).calorieTarget,2600);return;}
  await intake.getByText(/左軸 kcal \/ 右軸 g/).waitFor();
  assert.equal(await intake.locator('svg .chart-measured').count(),4);
  assert.deepEqual(await intake.locator('svg > text').allTextContents(),['kcal','26/09/17','26/09/23']);
  await intake.locator('svg [aria-label="右軸 g"]').waitFor();
  assert.equal(await intake.locator('svg title').filter({hasText:'平均対象外：2026-09-21 P 0g'}).count(),1);
  for(const name of ['7日','30日','90日','全期間']) {await page.getByRole('group',{name:'分析期間'}).getByRole('button',{name,exact:true}).click();assert.equal(await check('P (g)').isChecked(),true);await intake.getByRole('img').waitFor();}
  // Native disclosure remains open while the keyed card moves.
  await intake.getByText('カロリーの日別データ',{exact:true}).click();
  await button('並び替え').click();
  assert.equal(await button('実績ベース推定維持カロリーを上へ').isDisabled(),true);
  assert.equal(await button('最近の傾向を下へ').isDisabled(),true);
  await button('摂取カロリー・PFC推移を上へ').click();
  await page.waitForFunction(()=>document.querySelectorAll('.analysis-section')[2]?.getAttribute('data-section')==='intake');
  assert.equal(await intake.locator('details').getAttribute('open'),'');
  await button('摂取カロリー・PFC推移を下へ').click();await page.waitForFunction(()=>document.querySelectorAll('.analysis-section')[3]?.getAttribute('data-section')==='intake');
  await button('摂取カロリー・PFC推移を上へ').click();await page.waitForFunction(()=>document.querySelectorAll('.analysis-section')[2]?.getAttribute('data-section')==='intake');
  await button('並び替えを完了').click();
  for(const [width,height,scheme] of [[390,844,'light'],[320,440,'dark']]){
   await page.setViewportSize({width,height});await page.emulateMedia({colorScheme:scheme});await intake.scrollIntoViewIfNeeded();
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
   await intake.screenshot({path:`test-results/analysis-display-${width}.png`});
  }
  await toggle('kcal',false);await intake.locator('svg').waitFor();assert.equal(await intake.locator('svg > text').first().textContent(),'g');assert.equal(await intake.locator('[aria-label="右軸 g"]').count(),0);
  for(const name of ['P (g)','F (g)','C (g)']) await toggle(name,false);
  await intake.getByText('表示する項目を選択してください',{exact:true}).waitFor();assert.equal(await intake.locator('svg').count(),0);
  await toggle('P (g)',true);await toggle('F (g)',true);
  const before=await saved();assert.equal(before.calorieTarget,2600);assert.equal(before.analysisSectionOrder[2],'intake');
  await page.reload();await button('分析').click();await intake.getByRole('checkbox',{name:'F (g)',exact:true}).waitFor();
  assert.equal(await check('kcal').isChecked(),false);assert.equal(await check('P (g)').isChecked(),true);assert.equal(await check('F (g)').isChecked(),true);assert.equal(await check('C (g)').isChecked(),false);assert.equal((await order())[2],'intake');
  await button('並び替え').click();await button('初期順に戻す').click();await page.waitForFunction(()=>document.querySelectorAll('.analysis-section')[3]?.getAttribute('data-section')==='intake');assert.deepEqual(await order(),initial);
  // Start a series save and immediately reorder another setting; neither patch may erase the other.
  await check('C (g)').click();
  await button('摂取カロリー・PFC推移を上へ').click();
  await page.waitForFunction(async()=>{const {db}=await import('/meal-log/src/data/db.ts');const row=await db.settings.get('user');return row.analysisSeries.carbs && row.analysisSectionOrder[2]==='intake';});
  // No fixed delays between clicks. Disabled controls naturally wait for the active save.
  for(const name of ['P (g)','F (g)','C (g)']) await check(name).click();
  await intake.getByText('表示する項目を選択してください',{exact:true}).waitFor();
  assert.deepEqual((await saved()).analysisSeries,{calories:false,protein:false,fat:false,carbs:false});
  await toggle('P (g)',true);
  assert.equal(await check('P (g)').isChecked(),true);
  assert.ok((await button('平均PFCを上へ').boundingBox()).height>=44);
  await section('bodyFat').getByText('最新の7日平均：23%（2件）',{exact:true}).waitFor();
  await section('waist').getByText('最新の7日平均：89cm（2件）',{exact:true}).waitFor();
  await section('relationship').getByText('相関は因果関係を示しません。',{exact:false}).waitFor();
  assert.deepEqual(errors,[]);console.log('PASS analysis display: 4 series/dual axes/none/periods/order/state/reload/reset/measurement+relationship regression/390+320 light+dark/no overflow/errors');
 } finally {await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
