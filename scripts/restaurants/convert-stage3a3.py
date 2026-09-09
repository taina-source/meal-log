"""Stage 3A-3 only: saved official sources -> seven static datasets.

No network. Existing fourteen datasets are checked before and after conversion.
Unknown PFC stays null; plate counts are never inferred from calories or price.
"""
import argparse, collections, datetime, importlib.util, json, re
from pathlib import Path
from bs4 import BeautifulSoup
HERE=Path(__file__).resolve().parent
def module(name,path):
 spec=importlib.util.spec_from_file_location(name,path);m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m);return m
c=module('common',HERE/'convert.py');f=module('fetch3',HERE/'fetch-stage3a3.py')
RAW=f.RAW;KEYS=c.KEYS
NAMES=dict(gusto='ガスト',joyfull='ジョイフル',tenka='天下一品',ohsho='餃子の王将',sushiro='スシロー',kura='くら寿司',hama='はま寿司')
DATES=dict(gusto=None,joyfull='2026-09-08',tenka='2025-08-01',ohsho=None,sushiro=None,kura='2026-09-04',hama='2026-09-08')
SOURCES=dict(gusto='gusto.json',joyfull='joyfull.pdf',tenka='tenka-east.html',ohsho='ohsho-detail.html',sushiro='sushiro-normal.html',kura='kura.pdf',hama='hama.pdf')
MINIMUM=dict(gusto=300,joyfull=340,tenka=30,ohsho=240,sushiro=150,kura=350,hama=570)
c.NAMES.update(NAMES)
for key in NAMES:c.SOURCES[key]=(f.URLS[SOURCES[key]],NAMES[key]+'公式 メニュー・栄養情報',DATES[key],SOURCES[key])
clean=c.clean;canonical=c.canonical
def html(file):return BeautifulSoup((RAW/file).read_text(encoding='utf-8'),'html.parser')
def plain(s):return clean(BeautifulSoup(s or '', 'html.parser').get_text(' ',strip=True))
def unit(name,sushi=False):
 text=canonical(name);m=re.search(r'(\d+|[一二三四五六八十])貫',text)
 count=int(m[1]) if m and m[1].isdigit() else {'一':1,'二':2,'三':3,'四':4,'五':5,'六':6,'八':8,'十':10}.get(m[1]) if m else None
 if sushi:return ((str(count)+'貫／1皿') if count else '1皿'),'皿',count
 m=re.search(r'1人前[:：](\d+)(個|本)',text)
 if m:return f'1人前・{m[1]}{m[2]}','人前',None
 return '公式の1提供分','点',None
def add(key,name,values,category,*,size='',region='',basis=None,quantity_unit=None,pieces=None,url=None,page=None,notes=None,group=None,limited=None):
 basis=basis or '公式の1提供分';size=size or basis
 if group is None and key in ['kura','hama','sushiro']:
  group=re.sub(r'[（(]?(?:[0-9０-９一二三四五六八十]+貫)[）)]?$', '',name).strip()
  if region:group=re.sub(r'^[（(][^）)]*(?:限定|以外)[）)]','',group).strip()
 row=c.item(key,name,size,values,category,url=url,region=region,page=page,notes=notes or [],group=group,limited=limited)
 row.update(servingBasis=basis,quantityUnit=quantity_unit or '点',piecesPerServing=pieces)
 if any(row[k] is None for k in KEYS):
  row['registrationBlockedReason']='栄養情報が不足しているため登録できません。公開されていない値は推測・0補完していません。'
  for k in KEYS:
   if row[k] is None:row['nutrientProvenance'][k]['notes']=['確認した公式資料に、この商品・提供単位の値がありません。別商品・別サイズや一般的な料理の値を流用しません。']
 return row

def gusto():
 data=json.loads((RAW/'gusto.json').read_text(encoding='utf-8'));result=[]
 if set(data)!= {'list'}:raise ValueError('Gusto root changed')
 for r in data['list']:
  if not all(k in r for k in ['menu_name','menu_uid','category_name','menu_type','menu_time','valiation']):raise ValueError('Gusto columns changed')
  for v in r['valiation']:
   if not all(k in v for k in ['name','calorie','salt','sugar']):raise ValueError('Gusto nutrition columns changed')
   name=plain(r['menu_name']);size=' / '.join(filter(None,[plain(v['name']),r['menu_type'],r['menu_time']]))
   notes=list(filter(None,[plain(r.get('note')),plain(r.get('menu_description'))]))
   notes+=['公式JSONはカロリー・塩分・一部糖質のみ。糖質を炭水化物へ置換せずP/F/Cを不明とする。']
   result.append(add('gusto',name,[v['calorie'],None,None,None],r['category_name'],size=size,notes=notes,url='https://www.skylark.co.jp/gusto/menu/menu_detail.html?mid='+r['menu_uid'],limited=True if r.get('pickup_category_limited')=='1' else None))
 return result

def joyfull():
 data=json.loads((HERE/'joyfull-reviewed.json').read_text(encoding='utf-8'))
 if data['sourceUrl']!=f.URLS['joyfull.pdf'] or data['publishedOrUpdatedAt']!=DATES['joyfull'] or len(data['rows'])!=356:raise ValueError('Joyfull reviewed edition changed')
 return [add('joyfull',r['name'],r['values'],r['category'],size=r['size'],page=r['page'],notes=['ライスを使用するメニューは通常量。ドリンクバー・スープバー付きメニューにバーの栄養値は含まない。卓上調味料は含まない。']) for r in data['rows']]

def tenka():
 result=[]
 for file,region in [('tenka-east.html','北海道・東北・関東・中部・近畿地方'),('tenka-west.html','中国・四国・九州地方')]:
  soup=html(file);cat=''
  if '2025年8月1日更新' not in soup.get_text():raise ValueError('Tenka date changed')
  for img in soup.select('main img'):
   name=img.get('alt','')
   if name in ['ラーメン','サイドメニュー','トッピング']:cat=name;continue
   if not cat or not name or name=='ボタン':continue
   result.append(add('tenka',name,[None]*4,cat,region=region,basis='提供量・サイズの栄養情報未公表',url=f.URLS[file],notes=['現在公式の地域別アレルギー一覧に掲載される実商品。店内の量・サイズ別kcal/PFCを確認できず全て不明。家麺・市販監修品・一般的なラーメンの値は使わない。']))
 return result

def ohsho():
 result=[]
 for file,region in [('ohsho-detail.html','北海道・東北・関東・甲信越'),('ohsho-west-detail.html','北陸・東海・関西・四国・中国（岡山・鳥取）'),('ohsho-south-detail.html','中国（広島・山口）・九州')]:
  soup=html(file);nav=soup.select_one('ul.navList')
  if not nav:raise ValueError('Ohsho menu navigation missing')
  for section in nav.select(':scope > li.navItem'):
   category=section.select_one(':scope > a').get_text(' ',strip=True)
   for link in section.select('ul.navChildren a[href]'):
    name=link.get_text(' ',strip=True);basis,qu,pieces=unit(name)
    just='ジャストサイズ' in name;group=re.sub(r'[（(]1人前[^）)]*[）)]','',name);group=re.sub(r'[（(]ジャストサイズ[）)]','',group)
    size=('ジャストサイズ' if just else '通常サイズ')+' / '+basis
    result.append(add('ohsho',name,[None]*4,category,region=region,size=size,basis=basis,quantity_unit=qu,group=group,url=f.URLS[file],notes=['公式の地域別商品一覧の提供単位を保持。通常とジャストサイズの栄養値を流用しない。kcal/PFCを直接支持する現在公式資料を確認できず不明。大阪王将・通販商品とは別。'],limited=True if '限定' in name else None))
 return result

def sushiro():
 result=[];seen={}
 for file,store in [('sushiro-normal.html','新宿三丁目店'),('sushiro-detail.html','道頓堀店')]:
  soup=html(file)
  categories=[el.get_text(strip=True) for el in soup.select('.category-tab__item')]
  sections=[el for el in soup.select('.swiper-slide') if el.select('.menu-items')]
  if len(sections)!=len(categories) or not categories:raise ValueError('Sushiro categories changed')
  for category,section in zip(categories,sections):
   for el in section.select('.menu-item[data-target]'):
    name=el.select_one('.menu-item__name').get_text(' ',strip=True);cal=el.select_one('.menu-item__calorie').get_text(strip=True)
    if cal and not re.fullmatch(r'(?:100mlあたり)?\d+(?:\.\d+)?kcal',cal):raise ValueError(('Sushiro calorie',cal))
    sushi=category in ['にぎり','軍艦・巻物','フェア商品']
    basis,qu,pieces=unit(name,sushi)
    if category=='ドリンク':basis,qu,pieces='公式の1提供分','点',None
    if cal.startswith('100mlあたり'):basis,qu,pieces='100ml当たり（1杯の値ではありません）','100ml分',None;cal=cal.removeprefix('100mlあたり')
    if category=='お持ち帰りメニュー':basis,qu,pieces='持ち帰り商品1セット（商品名の人数・内容）','セット',None
    notes=plain(str(el.select_one('.menu-item__annotation') or ''))
    key=(canonical(name),basis,cal)
    if key in seen:
     if store not in seen[key]['notes'][-1]:seen[key]['notes'].append('同一商品・同一提供表記・同一カロリーを公式 '+store+' ページでも確認。価格差ではvariantを増やさない。')
     continue
    region=store if any(k[:2]==key[:2] for k in seen) else ''
    row=add('sushiro',name,[cal[:-4] if cal else None,None,None,None],category,region=region,basis=basis,quantity_unit=qu,pieces=pieces,url=f.URLS[file],notes=list(filter(None,[notes,plain(str(el.select_one('.menu-item__setdetail') or ''))]))+['公式FAQ：寿司のカロリーは1皿当たり。その他栄養分は非公表。確認店舗：'+store+'。全店舗共通の販売を保証しない。','https://www.akindo-sushiro.co.jp/faq/'],limited=True if '販売予定総数' in notes or '期間限定' in notes else None)
    seen[key]=row;result.append(row)
 return result

def kura():
 result=[];pages=c.tables('stage3a3/kura')
 if '2026年9月4日現在' not in canonical(pages[0]['text']):raise ValueError('Kura date changed')
 for page,p in enumerate(pages,1):
  for table in p['tables']:
   category={1:'定番寿司',2:'限定商品',3:'サイドメニュー',4:'サイドメニュー',5:'その他'}[page]
   if category not in p['text'].splitlines():raise ValueError('Kura category changed')
   expected=28 if page==5 else 29
   if len(table[0])!=expected or '品' not in table[0][0]:raise ValueError('Kura columns changed')
   for cells in table[1:]:
    name=clean(cells[0]);cal=cells[1] if page!=5 else None
    if not name:raise ValueError('Kura empty name')
    sushi=page<=2;basis,qu,pieces=unit(name,sushi)
    if not sushi:basis='1皿／1杯（公式掲載単位）' if page<5 else '公式の掲載商品（提供量・栄養値未掲載）'
    result.append(add('kura',name,[cal,None,None,None],{1:'定番寿司',2:'限定商品',3:'サイドメニュー',4:'サイドメニュー',5:'その他'}[page],basis=basis,quantity_unit=qu,pieces=pieces,page=page,notes=['原表のカロリーは1皿（サイド等は1皿・1杯）当たり。貫数が原文にない場合は不明のまま。シャリハーフやシャリなしの独自差分計算なし。']))
 return result

def hama():
 result=[];cat='';corrected=set()
 if c.filehash(RAW/'hama.pdf')!='d80d1b64f4da4c64e06eb0a7c3f84c42fa274d2e55b5a4254f2c70eadcd7e252':
  raise ValueError('Hama PDF changed: re-review exact overflow corrections and duplicate entries before conversion')
 pages=c.tables('stage3a3/hama')
 if '2026/9/8' not in canonical(pages[0]['text']):raise ValueError('Hama date changed')
 for page,p in enumerate(pages,1):
  for table in p['tables']:
   if len(table[0])!=31 or '一\n皿' not in str(table[0][2]):raise ValueError('Hama columns changed')
   for cells in table[4:]:
    if cells[0]:cat=clean(cells[0])
    name=clean(cells[1]);cal=cells[2]
    # Three source names overflow the kcal column. Verified on rendered PDF
    # pages 5/6; exact cell matching deliberately fails if the source changes.
    corrections={
     ('(北海道限定)レアステーキ三種盛り(びんちょう、サーモン、ア','カイ1カ68)'):('(北海道限定)レアステーキ三種盛り(びんちょう、サーモン、アカイカ)','168'),
     ('(北海道以外)サーモン三種(サーモン・大トロサーモン・レアス','テー1キ57)'):('(北海道以外)サーモン三種(サーモン・大トロサーモン・レアステーキ)','157'),
     ('(北海道限定)サーモン三種(サーモン・大トロサーモン・レアス','テー1キ64)'):('(北海道限定)サーモン三種(サーモン・大トロサーモン・レアステーキ)','164'),
    }
    correction_note=[]
    if (name,cal) in corrections:
     corrected.add((name,cal));name,cal=corrections[(name,cal)]
     correction_note=['原PDF画像で熱量と列位置を照合した補正行。北海道レアステーキの抽出文字列末尾は二重閉じ括弧のため、商品名では括弧対を整えた。栄養値は変更していない。']
    if not name or name=='商品名':continue
    sushi=any(w in cat for w in ['にぎり','軍艦','巻','寿司','握','すし'])
    basis,qu,pieces=unit(name,sushi)
    amount=re.search(r'[（(]([^）)]*あたり)[）)]',name)
    if amount:basis=amount[1];qu='提供分'
    region_match=re.match(r'[（(]([^）)]*(?:限定|以外))[）)]',name)
    region=region_match[1] if region_match else ''
    result.append(add('hama',name,[cal,None,None,None],cat,size=('朝食 / '+basis) if page==14 else basis,region=region,basis=basis,quantity_unit=qu,pieces=pieces,page=page,notes=correction_note+['公式店内用一覧の熱量は一皿単位。商品名に別途5g・一袋等の記載がある場合はその単位。PFC未掲載。関西等の地域条件は公式商品名のまま保持。']))
 if len(corrected)!=3:raise ValueError('Hama exact correction cells changed')
 # The same S/M matcha-latte names occur twice on page 12 with different kcal
 # and no stated serving distinction. Do not invent a variant condition.
 groups=collections.defaultdict(list)
 for row in result:groups[row['id']].append(row)
 conflicts=[]
 for group in groups.values():
  values=sorted({r['calories'] for r in group})
  if len(values)<=1:continue
  if canonical(group[0]['name']) not in ['ホット抹茶ラテS','ホット抹茶ラテM']:raise ValueError('New Hama conflicting duplicate')
  conflicts.append(group[0]['name'])
  for row in group:
   row['calories']=None;row['rawNutrients']['calories']=' / '.join(map(str,values))
   row['nutrientProvenance']['calories'].update(value=None,sourceType='unknown',notes=['同一名・サイズの公式重複記載で熱量が相違：'+row['rawNutrients']['calories']+' kcal。提供条件を特定できず採用値を不明とした。'])
   row['notes']+=row['nutrientProvenance']['calories']['notes']
 if len(conflicts)!=2:raise ValueError('Hama duplicate calorie conditions changed; re-review')
 return result

def main():
 p=argparse.ArgumentParser();p.add_argument('--retrieved-at',required=True);p.add_argument('--chain',choices=list(NAMES));a=p.parse_args();c.RETRIEVED=a.retrieved_at
 datetime.date.fromisoformat(a.retrieved_at)
 baseline=json.loads((c.ROOT/'data-sources/restaurants/stage3a2-baseline.json').read_text())
 for key,expected in baseline.items():
  if c.filehash(c.OUT/(key+'.json'))!=expected:raise ValueError('Existing Stage 3A-2 JSON changed: '+key)
 existing={path.name:c.filehash(path) for path in c.OUT.glob('*.json') if path.stem not in NAMES}
 reports=json.loads((c.ROOT/'data-sources/restaurants/sources.json').read_text(encoding='utf-8'));outputs=[];metas=[]
 source_baseline=json.loads((c.ROOT/'data-sources/restaurants/stage3a2-source-baseline.json').read_text(encoding='utf-8'))
 for chain,expected in source_baseline.items():
  old=next(r for r in reports if r['chain']==chain)
  actual=f.hashlib.sha256(json.dumps(old,ensure_ascii=False,sort_keys=True,separators=(',',':')).encode()).hexdigest()
  if actual!=expected:raise ValueError('Existing source metadata changed: '+chain)
 for key in [a.chain] if a.chain else NAMES:
  rows=c.validate(key,globals()[key](),MINIMUM[key]);counts=collections.Counter(v['sourceType'] for r in rows for v in r['nutrientProvenance'].values())
  sourcefiles=[x for x in f.URLS if x.startswith(key+'-') or x==SOURCES[key]]
  if key=='joyfull':sourcefiles=[x.name for x in RAW.glob('joyfull-reader-*')]
  sourcefiles=[x for x in sourcefiles if (RAW/x).exists()]
  meta={'chain':NAMES[key],'restaurantId':'restaurant:'+NAMES[key],'sourceUrl':f.URLS[SOURCES[key]],'sourceTitle':c.SOURCES[key][1],'sourceType':'official','publishedOrUpdatedAt':DATES[key],'retrievedAt':a.retrieved_at,'transformationMethod':'scripts/restaurants/convert-stage3a3.py: '+key,'productCount':len({r['productGroupId'] for r in rows}),'variantCount':len(rows),'blockedCount':sum(any(r[k] is None for k in KEYS) or bool(r.get('registrationBlockedReason')) for r in rows),'nutrientSourceCounts':{k:counts[k] for k in ['official','official_old','secondary','estimate','unknown']},'notes':['実商品を収録。栄養値の不明はnullで保持。現掲載は全店舗での販売保証ではない。'],'sourceFiles':[{'chain':NAMES[key],'sourceUrl':f.URLS.get(file,f.URLS[SOURCES[key]]),'sourceTitle':c.SOURCES[key][1],'sourceType':'official','publishedOrUpdatedAt':DATES[key],'retrievedAt':a.retrieved_at,'localRawFile':'stage3a3/'+file,'sha256':c.filehash(RAW/file),'transformationMethod':'scripts/restaurants/convert-stage3a3.py','notes':['公開PDFの読取テキスト。ハッシュはPDFバイナリではなくテキストに対するもの。自動取得403を回避しない。'] if key=='joyfull' else []} for file in sourcefiles]}
  payload=json.dumps({'metadata':meta,'items':rows},ensure_ascii=False,separators=(',',':'));outputs.append((c.OUT/(key+'.json'),payload));meta['jsonBytes']=len(payload.encode('utf-8'));metas.append(meta);print(key,meta['productCount'],len(rows),meta['blockedCount'],meta['jsonBytes'])
 for path,payload in outputs:path.write_text(payload,encoding='utf-8')
 names={m['chain'] for m in metas};reports=[r for r in reports if r['chain'] not in names]+metas
 (c.ROOT/'data-sources/restaurants/sources.json').write_text(json.dumps(reports,ensure_ascii=False,indent=2),encoding='utf-8')
 assert all(c.filehash(c.OUT/name)==sha for name,sha in existing.items()),'Existing data modified'
if __name__=='__main__':main()
