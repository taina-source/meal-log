const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const assert = require('node:assert/strict');
const catalog = require('../public/data/mext-foods.json');
(async () => {
 const browser = await chromium.launch({channel:'chrome',headless:true});
 try {
  for (const viewport of [{width:390,height:844},{width:320,height:440}]) for (const colorScheme of ['light','dark']) {
   // Fresh nonpersistent context: no user profile or user database is touched.
   const context=await browser.newContext({viewport,colorScheme,locale:'ja-JP',timezoneId:'Asia/Tokyo'});
   const page=await context.newPage(),errors=[];
   page.on('pageerror',e=>errors.push(e.message));page.on('console',e=>{if(e.type()==='error')errors.push(e.text());});
   const url=process.env.APP_URL || 'http://127.0.0.1:4176/meal-log/';
   await page.goto(url);
   const button=name=>(name === '食事を追加' ? page.getByRole('navigation',{name:'メインナビゲーション'}) : page).getByRole('button',{name,exact:true});
   const dialog=page.getByRole('dialog',{name:'食事を追加',exact:true});
   const weight=dialog.getByRole('spinbutton',{name:/^1単位あたりの換算重量(?: |$)/});
   const quantity=dialog.getByRole('spinbutton',{name:/^数量(?: |$)/});
   const unit=page.getByRole('combobox',{name:'単位',exact:true});
   const register=()=>button('食事に登録');
   async function layout() {
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
    assert.equal(await page.evaluate(()=>{const d=document.querySelector('dialog');return !d || d.scrollWidth<=d.clientWidth;}),true);
   }
   async function choose(id, open=true) {
    if(open) { await button('食事を追加').click();await page.getByRole('button',{name:/^食品を検索/}).click(); }
    const name=catalog.foods.find(f=>f.id===id).name;
    await page.getByRole('searchbox',{name:'食品を検索',exact:true}).fill(name);
    await page.getByRole('button').filter({has:page.getByText(name,{exact:true})}).click();
    assert.equal(await page.getByRole('spinbutton',{name:'自由入力（重量）'}).inputValue(),'100');
   }
   let total=0,count=0;
   async function save(id,grams) {
    const f=catalog.foods.find(f=>f.id===id); total+=f.caloriesPer100g*grams/100;count++;
    await layout();await register().click();await page.getByRole('dialog').waitFor({state:'hidden'});
    await page.waitForFunction(expected=>document.querySelector('.calorie-meta b')?.textContent===new Intl.NumberFormat('ja-JP',{maximumFractionDigits:0}).format(expected),total);
    const rows=await page.evaluate(async()=>{const {db}=await import('/meal-log/src/data/db.ts');return db.meals.toArray();});
    assert.equal(rows.length,count);assert.ok(rows.some(r=>r.sourceId===id && r.quantity===grams && r.unit==='g' && Math.abs(r.calories-f.caloriesPer100g*grams/100)<1e-9));
   }
   await choose('mext-01088');await unit.selectOption('cooked-go');
   await page.getByText('換算後の合計重量：340 g',{exact:true}).waitFor();
   await weight.fill('350');await button('〈 食品検索へ').click();await choose('mext-01088',false);await unit.selectOption('cooked-go');assert.equal(await weight.inputValue(),'340');await quantity.fill('0.5');
   await page.getByText('換算後の合計重量：170 g',{exact:true}).waitFor();await save('mext-01088',170);
   await choose('mext-12004');await unit.selectOption('piece');await quantity.fill('2');await save('mext-12004',100);
   await choose('mext-12005');await unit.selectOption('piece');await quantity.fill('2');
   await page.getByText('換算後の合計重量：100 g',{exact:true}).waitFor();assert.ok((await page.getByRole('region',{name:'今回',exact:true}).innerText()).includes('134'));await weight.fill('55');await save('mext-12005',110);
   await choose('mext-12005');await unit.selectOption('piece');assert.equal(await weight.inputValue(),'50');
   await quantity.fill('');assert.equal(await register().isDisabled(),true);await quantity.fill('0');assert.equal(await register().isDisabled(),true);
   await quantity.fill('2');await unit.selectOption('g');await page.getByRole('spinbutton',{name:'自由入力（重量）'}).fill('25');await save('mext-12005',25);
   await choose('mext-01026');await unit.selectOption('slice');assert.equal(await weight.inputValue(),'');assert.equal(await register().isDisabled(),true);
   await weight.fill('60');await quantity.fill('2');await save('mext-01026',120);
   await choose('mext-01026');await unit.selectOption('slice');assert.equal(await weight.inputValue(),'');await button('閉じる').click();
   for(const [id,small,big] of [['mext-03003',3,9],['mext-14001',4,12],['mext-17007',6,18]]) {
    await choose(id);await unit.selectOption('tsp');assert.equal(await weight.inputValue(),String(small));await page.getByText('換算後の合計重量：'+small+' g',{exact:true}).waitFor();
    await unit.selectOption('tbsp');assert.equal(await weight.inputValue(),String(big));await save(id,big);
   }
   await choose('mext-13003');await unit.selectOption('ml');await quantity.fill('200');await save('mext-13003',206);
   await choose('mext-01083');await unit.selectOption('go');await page.getByText('換算後の合計重量：150 g',{exact:true}).waitFor();
   await quantity.fill('0.5');await page.getByText('換算後の合計重量：75 g',{exact:true}).waitFor();await weight.fill('160');await save('mext-01083',80);
   await choose('mext-01083');await unit.selectOption('go');assert.equal(await weight.inputValue(),'150');await save('mext-01083',150);
   await choose('mext-12004');await unit.selectOption('piece');await quantity.fill('2');await weight.fill('55');
   await button('〈 食品検索へ').click();await choose('mext-01085',false);assert.equal(await unit.count(),0);await button('閉じる').click();
   await choose('mext-01088');await unit.selectOption('g');await page.getByRole('spinbutton',{name:'自由入力（重量）'}).fill('125');
   await button('☆ この量でお気に入り').click();await button('★ お気に入りを解除').waitFor();await save('mext-01088',125);
   assert.equal(await page.evaluate(async()=>{const {db}=await import('/meal-log/src/data/db.ts');return (await db.favorites.toArray())[0].quantity;}),125);
   // The same picker supplies grams to recipe and set editors.
   await button('食事を追加').click();await page.getByRole('button',{name:/^レシピ/}).click();await page.getByRole('button',{name:/新しいレシピを作る/}).click();
   await page.getByRole('textbox',{name:'レシピ名',exact:true}).fill('単位テストレシピ');await button('＋ 食品DBから材料を追加').click();await choose('mext-12004',false);await unit.selectOption('piece');await quantity.fill('2');await button('材料に追加').click();
   assert.equal(await page.getByRole('spinbutton',{name:/^材料1の重量/}).inputValue(),'100');await button('レシピを保存').click();await button('今回だけ材料を変更').waitFor();await button('閉じる').click();
   await button('食事を追加').click();await page.getByRole('button',{name:/^いつものセット/}).click();await button('＋ 新しいセットを作る').click();await page.getByRole('textbox',{name:'セット名',exact:true}).fill('単位テストセット');await button('＋ 食品').click();await choose('mext-01088',false);await unit.selectOption('cooked-go');await quantity.fill('0.5');await button('セットに追加').click();
   assert.equal(await page.getByRole('spinbutton',{name:/^構成1の重量/}).inputValue(),'170');await button('セットを保存').click();await button('このセットをまとめて登録').waitFor();await button('閉じる').click();
   const saved=await page.evaluate(async()=>{const {db}=await import('/meal-log/src/data/db.ts');return {recipe:(await db.recipes.toArray())[0],set:(await db.mealSets.toArray())[0]};});
   assert.equal(saved.recipe.ingredients[0].grams,100);assert.equal(saved.set.items[0].quantity,170);
   const before=await page.evaluate(async()=>{const {db}=await import('/meal-log/src/data/db.ts');return db.meals.toArray();});
   await page.reload();await button('履歴').click();await page.getByText('こめ ［水稲めし］ 精白米 うるち米',{exact:true}).first().waitFor();await layout();
   const after=await page.evaluate(async()=>{const {db}=await import('/meal-log/src/data/db.ts');return db.meals.toArray();});assert.deepEqual(after,before);
   assert.deepEqual(errors,[]);console.log(viewport.width+' '+colorScheme+': saved '+count+' meals; reload/layout/errors OK');
   await context.close();
  }
 } finally {await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
