"""Official restaurant sources -> bundled JSON. No network access during conversion.

Run fetch-sources.py / fetch-marugame.py explicitly before updating. Unknown cells
remain null. Each source has its own parser; schema/count drift is a hard error.
"""
import sys, json, re, hashlib, unicodedata, argparse
from pathlib import Path
from bs4 import BeautifulSoup
import pdfplumber

sys.stdout.reconfigure(encoding='utf-8')
ROOT=Path(__file__).resolve().parents[2]
RAW=ROOT/'data-sources/restaurants/raw'
OUT=ROOT/'public/data/restaurants'
KEYS=['calories','protein','fat','carbs']
NAMES=dict(mcdonalds='マクドナルド',kfc='KFC',mos='モスバーガー',sukiya='すき家',yoshinoya='吉野家',matsuya='松屋',marugame='丸亀製麺')
SOURCES={
 'mcdonalds':('https://www.mcdonalds.co.jp/quality/allergy_Nutrition/nutrient/','マクドナルド公式 栄養成分一覧表','2026-09-02','mcdonalds.html'),
 'kfc':('https://assets.ctfassets.net/jax7ylg56usf/63NsvjRmBbpZRdG8l926iQ/6e3ccb242aff8ffb2138f37b3243a5e8/44f7edfe-ba19-463b-9de5-3e8a383e833e.pdf','KFC公式 栄養成分表','2026-09-02','kfc.pdf'),
 'mos':('https://www.mos.jp/menu/pdf/nutrition.pdf','モスバーガー公式 栄養成分表','2026-08-28','mos.pdf'),
 'sukiya':('https://images.zensho.co.jp/materials/sukiya/allergen/nutrition.pdf','すき家公式 栄養成分一覧表','2026-08-18','sukiya.pdf'),
 'yoshinoya':('https://www.yoshinoya.com/pdf/allergy/','吉野家公式 メニュー情報258号','2026-08-27','yoshinoya.pdf'),
 'matsuya':('https://www.matsuyafoods.co.jp/matsuya/pdf/260901_nutritional_matsuya.pdf','松屋公式 栄養成分・アレルゲン一覧','2026-09-01','matsuya.pdf'),
 'marugame':('https://jp.marugame.com/menu/','丸亀製麺公式 商品別栄養情報',None,'marugame-current.html'),
}
def clean(v):return re.sub(r'\s+',' ',str(v or '')).strip()
def canonical(v):return re.sub(r'\s+','',unicodedata.normalize('NFKC',v))
def number(v):
 s=canonical('' if v is None else str(v)).replace(',','')
 if s in ['', '-', '－','—','―','※','未分析','未測定']:return None
 if re.fullmatch(r'\d+(?:\.\d+)?[~～〜]\d+(?:\.\d+)?',s):return None # published range; never average
 if not re.fullmatch(r'\d+(?:\.\d+)?',s):raise ValueError('Unknown numeric cell: '+repr(v))
 return float(s) if '.' in s else int(s)
def digest(v):return hashlib.sha256(v.encode()).hexdigest()[:16]
def filehash(path):return hashlib.sha256(path.read_bytes()).hexdigest()
def tables(key):
 path=RAW/(key+'.pdf'); sha=filehash(path); cache=RAW/(key+'.cache.json')
 with pdfplumber.open(path) as pdf:page_count=len(pdf.pages)
 if cache.exists():
  data=json.loads(cache.read_text(encoding='utf-8'))
  if data['sha256']==sha and len(data['pages'])==page_count:return data['pages']
 with pdfplumber.open(path) as pdf:pages=[{'text':p.extract_text() or '', 'tables':p.extract_tables()} for p in pdf.pages]
 cache.write_text(json.dumps({'sha256':sha,'pages':pages},ensure_ascii=False),encoding='utf-8');return pages
def split_size(name):
 # Only suffixes actually printed in the source; never invent a size or value.
 pattern=r'\s*[（(]((?:[SMLＳＭＬ]|小盛|並盛|大盛|特盛|あたま大盛|並|大|得|小))[）)]$|\s*([ＳＭＬ]|ＢＯＸ|BOX|[SML])$'
 m=re.search(pattern,name)
 if m:return name[:m.start()].strip(),m.group(1) or m.group(2)
 return name,''
def category_for(name):
 for words,cat in [(r'マフィン|グリドル|朝|モーニング','朝メニュー'),(r'バーガー|ツイスター|フィレオ|ビッグマック|エグチ|チキチー|フィレオ','バーガー'),(r'コーラ|コーヒー|ソーダ|ティー|ウーロン|ジュース|レモネード|シェイク|ラテ|紅茶|ジンジャー|オレンジ','ドリンク'),(r'チキン|ナゲット|ウイング','チキン'),(r'パイ|アイス|ソフト|プリン|スイーツ','デザート'),(r'ソース|シロップ|シュガー|フレッシュ|バター','別添品')]:
  if re.search(words,name):return cat
 return 'サイド・その他'
def item(chain,name,size,values,category,*,url=None,date=None,region='',notes=None,group=None,limited=None,page=None):
 name=clean(name);size=clean(size)
 if not name:raise ValueError('Empty product name')
 source=SOURCES[chain]; url=url or source[0]; date=date or source[2]
 raw_values=[str(v) if v is not None else '' for v in values]
 values=[number(v) for v in values]; notes=notes or []
 if page:notes=notes+[f'公式PDF {page}ページ']
 ident=chain+'-'+digest(canonical('|'.join([name,size,region])))
 provenance={k:{'value':v,'sourceType':'official' if v is not None else 'unknown','sourceUrl':url,'sourceTitle':source[1],'publishedOrUpdatedAt':date,'retrievedAt':RETRIEVED,'notes':[] if v is not None else ['公式資料の未記載・未分析・参照記号または範囲値。原表を保持し、0や平均値で補完しない。']} for k,v in zip(KEYS,values)}
 return {'id':ident,'restaurantId':'restaurant:'+NAMES[chain],'name':name,'aliases':[], 'category':category or 'その他','variantName':' / '.join(x for x in [region,size] if x),'size':size,'region':region,'productGroupId':chain+'-'+digest(canonical(group or name)),**dict(zip(KEYS,values)),'rawNutrients':dict(zip(KEYS,raw_values)),'nutrientProvenance':provenance,'isLimitedTime':limited,'isCurrent':True,'sourceVersion':f'{source[1]} {date or "更新日記載なし"} / 取得{RETRIEVED}','notes':notes}
def mcdonalds():
 soup=BeautifulSoup((RAW/'mcdonalds.html').read_text(encoding='utf-8'),'html.parser'); result=[]
 notes_by_category={}
 note_tables=soup.select('table.allergy-info__detail-table')
 if len(note_tables)!=4:raise ValueError('McDonald footnote layout changed')
 for cat,t in zip(['バーガー','サイド','ドリンク','バリスタ'],note_tables):
  notes_by_category[cat]={canonical(r.select('td')[0].get_text()).replace('備考',''):clean(r.select('td')[1].get_text()) for r in t.select('tr')}
 for t in soup.select('table.js-allergy-info__table'):
  headers=canonical(t.select_one('thead').get_text())
  if not all(x in headers for x in ['エネルギー','たんぱく質','脂質','炭水化物']):raise ValueError('McDonald headers changed')
  for row in t.select('tbody tr'):
   cells=[clean(c.get_text()) for c in row.select('td')]
   if not cells:continue
   if len(cells)!=9:raise ValueError(('McDonald columns',cells))
   name,size=split_size(cells[0]); cat=row.get('data-kind','その他');original_cat=cat
   if re.search('マフィン|グリドル|ベーコンエッグマックサンド|ホットケーキ',name):cat='朝マック'
   a=row.select_one('a[href]'); group=a['href'] if a else name
   note=notes_by_category.get(original_cat,{}).get(canonical(cells[8]).replace('備考',''))
   result.append(item('mcdonalds',name,size,[cells[i] for i in [1,2,3,5]],cat,group=name,region='McCafé by Barista' if cat=='バリスタ' else '',notes=[note] if note else []))
 return result
def kfc():
 pages=tables('kfc');result=[]
 if len(pages)!=10:raise ValueError('KFC page count changed; review Japanese/English split')
 for i,p in enumerate(pages[:5]):
  for t in p['tables']:
   if len(t[0])!=21 or 'エネル' not in str(t[:4]):raise ValueError('KFC headers changed')
   for row in t[4:]:
    name,size=split_size(clean(row[0])); columns=[str(row[j] or '').split('\n') for j in [1,2,3,4,5]]
    count=len(columns[1])
    if any(len(c)!=count for c in columns):raise ValueError(('KFC multiline',row))
    for j in range(count):
     printed=columns[0][j]; s=size or (printed if not re.fullmatch(r'[\d.]+',printed) else '')
     result.append(item('kfc',name,s,[c[j] for c in columns[1:]],category_for(name),page=i+1,notes=['別添ソース・シロップは別商品。数値は公式の1食当たり。']))
 return result
def mos():
 result=[];cat='その他';context_region=''
 for i,p in enumerate(tables('mos')):
  for t in p['tables']:
   if 'エネルギー' not in str(t[0]):raise ValueError('MOS headers changed')
   for row in t[1:]:
    raw=clean(row[0]);
    if raw.startswith('【'):cat=raw.split('】')[0].lstrip('【');continue
    if not raw:continue
    if row[2] is None:continue
    name,size=split_size(raw);notes=[]
    if name=='メープルシロップ':size=f'{number(row[1]):g}g'
    if ('トースト' in raw or '朝モスプレート' in raw) and 'バター含まず' not in raw:context_region='中京エリア' if '中京エリア' in raw else ''
    region='モスバーガー＆カフェ' if i==5 else context_region if ('トースト' in raw or '朝モスプレート' in raw) else ''
    if '100' in raw and ('あたり' in raw or '当たり' in raw):notes.append('可食部100g当たりの公式値。1個の値ではありません。');size='可食部100g'
    if '冷凍モスチキン' in raw or 'ローストチキン' in raw:notes.append('可食部100g当たりの公式値。');size='可食部100g'
    result.append(item('mos',name,size,row[2:6],cat,region=region,notes=notes,page=i+1,limited=True if '期間限定' in cat else None))
 return result
def sukiya():
 result=[];cat='牛丼';name='';seen=set()
 # Reviewed boundaries of the vertically printed category column. PDF extraction
 # splits the vertical letters over many rows; never treat each letter as a category.
 boundaries={'牛皿':'牛丼','牛丼ライト':'牛丼ライト','牛・お食事サラダ':'お食事サラダ','カレー':'カレー','旨だしとりそぼろ丼':'こだわり丼','うな皿':'うなぎ','牛皿定食':'定食','まぜのっけ朝食':'朝食','お子様牛丼':'お子様メニュー','すきすきセット（爽健美茶）':'すきすきセット','ごはん':'一品','りんごジュース':'ドリンク・デザート'}
 for i,p in enumerate(tables('sukiya')):
  for t in p['tables']:
   if len(t[0])!=8 or 'カロリー' not in str(t[:2]):raise ValueError('Sukiya columns changed')
   for row in t[2:]:
    if row[1] is not None:name=clean(row[1])
    if name in boundaries:cat=boundaries[name];seen.add(name)
    if not name:raise ValueError('Sukiya missing merged product')
    result.append(item('sukiya',name,clean(row[2]),row[3:7],cat,page=i+1,notes=['店内基準。テイクアウトと記載された商品は別商品。調味料は原則含まない。']))
 if seen!=set(boundaries):raise ValueError('Sukiya category boundary changed; review PDF categories')
 return result
def matsuya():
 result=[]
 for key,region in [('matsuya','通常店'),('matsuya-pa-sa','PA・SA店'),('matsuya-makinohara','牧之原SA店')]:
  cat='その他';url=SOURCES['matsuya'][0] if key=='matsuya' else f'https://www.matsuyafoods.co.jp/matsuya/pdf/{"260901_nutritional_matsuya_pa_sa" if key.endswith("pa-sa") else "260623_nutritional_matsuya_makinohara"}.pdf'
  for i,p in enumerate(tables(key)):
   for t in p['tables']:
    if len(t[0])!=35:raise ValueError(('Matsuya columns changed',key,i))
    for row in t:
     if row[1] is None:continue
     if '熱' in str(row[2]) or 'メニュー'==row[1] or row[2] is None:continue
     if '栄養成分増減分' in row[1] or '定食ライスミニ変更'==row[1]:continue # signed adjustment, not an edible product
     if row[0] is not None and row[0].strip():cat=canonical(row[0])
     # Vertical labels in regional PDFs span multiple physical cells.
     cat={'定':'定食','食':'定食','ロ':'ロカボ推進','カ':'ロカボ推進','ボ':'ロカボ推進','推':'ロカボ推進','進':'ロカボ推進','モー':'モーニング','ニン':'モーニング','グ':'モーニング','お子様ニメュー':'お子様メニュー'}.get(cat,cat)
     if clean(row[1])=='牛焼肉定食':cat='定食'
     if key=='matsuya-pa-sa' and i==4 and cat=='定食':cat='ロカボ推進'
     if key=='matsuya-makinohara' and i==3 and cat=='各麺セット':cat='モーニング'
     name,size=split_size(clean(row[1]));r=region+('・沖縄' if '沖縄' in cat else '')
     result.append(item('matsuya',name,size,row[2:6],cat,region=r,url=url,date='2026-06-23' if key.endswith('makinohara') else None,page=i+1,notes=['メインメニューはみそ汁を含む。サイドのライスは含まない。卓上調味料は別。']))
 return result
def yoshinoya():
 result=[];category='';name='';region='';size=''
 for i,p in enumerate(tables('yoshinoya')):
  if i not in [3,4,5]:continue # Japanese pages only, translations are duplicates.
  for t in p['tables']:
   n=5 if len(t[0])==38 else 4 if len(t[0])==37 else 0
   if not n or '熱' not in str(t[:5]):raise ValueError('Yoshinoya headers changed')
   cc=False
   for row in t[5:]:
    if row[n] is None:continue
    if i==5:
     if row[1] is not None:category=canonical(row[1])
     if row[2] is not None:name=clean(row[2])
     region=category
    else:
     if row[1] is not None:category=canonical(row[1])
     if row[2] is not None:name=clean(row[2])
     if row[3] is not None and row[3].strip():name=clean(row[3])
     if i==4 and canonical(clean(row[2]))=='大判豚肩ロース焼き丼(旨ダレ生姜)':cc=True
     if cc:continue # C&C is a separately labelled brand, outside these seven chains.
     region=''
    if 'C&C' in name or 'C＆C' in category:continue
    notes=[]
    if '※' in name:name,note=name.split('※',1);notes.append('※'+note)
    if not name:raise ValueError(('Yoshinoya missing name',row[:n+4]))
    if row[n-1] is not None:size=clean(row[n-1])
    record=item('yoshinoya',name,size,row[n:n+4],category,region=region,page=i+1,notes=notes)
    if name=='コカ・コーラ' and i==5:
     record['registrationBlockedReason']='公式表の量の欄がアイスの「シングル」と結合されており、飲料の量を確定できないため登録できません。'
     record['notes'].append(record['registrationBlockedReason'])
    result.append(record)
 return result
def marugame():
 from importlib.machinery import SourceFileLoader
 module=SourceFileLoader('fetch_marugame',str(Path(__file__).with_name('fetch-marugame.py'))).load_module()
 result=[];seen=set()
 for category in ['udon','tempura','topping','gohanmono','udonbento']:
  listing=json.loads((RAW/'marugame'/f'{category}.json').read_text(encoding='utf-8'))
  for menus in listing['menus'].values():
   for menu in menus:
    if menu['href'] in seen:continue
    seen.add(menu['href']);path=RAW/'marugame'/f'{category}-{menu["id"]}.html'
    if not path.exists():raise ValueError('Missing official page: '+menu['href'])
    data=module.props(path.read_bytes());nutrition=data.get('nutritionItemData');detail=data['detail']
    if not nutrition or not nutrition.get('items'):raise ValueError('No nutrition: '+menu['href'])
    for row in nutrition['items']:
     if not all(k in row for k in ['energy','protein','fat','carbohydrate','size','temperature']):raise ValueError('Marugame columns changed')
     size=' '.join(x for x in [row['temperature'],row['size']] if x)
     result.append(item('marugame',nutrition['productsName'],size,[row[k] for k in ['energy','protein','fat','carbohydrate']],nutrition['category'],url='https://jp.marugame.com'+menu['href'],date=None,limited=any('limited_time_item' in v for v in detail.get('icon_select',[])),notes=['公式の1食分。温冷・サイズは公式栄養情報にある組み合わせのみ。']))
 return result

def validate(chain,items,minimum=None):
 unique={}
 for row in items:
  if row['restaurantId']!='restaurant:'+NAMES[chain] or not row['name'].strip():raise ValueError('Invalid restaurant/name')
  if row['id'] in unique:
   old=unique[row['id']]
   if any(row[k]!=old[k] for k in KEYS):raise ValueError(('Conflicting duplicate',row['name'],row['variantName']))
   old['notes']=list(dict.fromkeys(old['notes']+row['notes']))
  else:unique[row['id']]=row
 items=list(unique.values())
 if minimum is None:minimum=dict(mcdonalds=140,kfc=60,mos=150,sukiya=400,yoshinoya=190,matsuya=400,marugame=90)[chain]
 if len(items)<minimum:raise ValueError(f'{chain}: suspiciously small count {len(items)} < {minimum}')
 ids=set();variants=set()
 for row in items:
  key=(row['productGroupId'],canonical(row['variantName']))
  if row['id'] in ids or key in variants:raise ValueError(('Duplicate ID/variant',row['name'],row['variantName']))
  ids.add(row['id']);variants.add(key)
  for k in KEYS:
   v=row[k];p=row['nutrientProvenance'][k]
   if v is not None and v<0:raise ValueError('Negative value')
   if p['value']!=v or not p['sourceUrl'].startswith('https://') or (v is None)!=(p['sourceType']=='unknown'):raise ValueError('Invalid provenance')
 return items

def source_files(chain):
 files=[{'sourceUrl':SOURCES[chain][0],'file':SOURCES[chain][3],'sha256':filehash(RAW/SOURCES[chain][3])}]
 if chain=='matsuya':
  for key,filename in [('matsuya-pa-sa','260901_nutritional_matsuya_pa_sa.pdf'),('matsuya-makinohara','260623_nutritional_matsuya_makinohara.pdf')]:
   files.append({'sourceUrl':'https://www.matsuyafoods.co.jp/matsuya/pdf/'+filename,'file':key+'.pdf','sha256':filehash(RAW/(key+'.pdf'))})
 if chain=='marugame':
  seen=set()
  for category in ['udon','tempura','topping','gohanmono','udonbento']:
   files.append({'sourceUrl':f'https://marugame.com/menu/{category}/','file':f'marugame/{category}.html','sha256':filehash(RAW/'marugame'/f'{category}.html')})
   data=json.loads((RAW/'marugame'/f'{category}.json').read_text(encoding='utf-8'))
   for menus in data['menus'].values():
    for menu in menus:
     if menu['href'] in seen:continue
     seen.add(menu['href']);filename=f'marugame/{category}-{menu["id"]}.html'
     files.append({'sourceUrl':'https://jp.marugame.com'+menu['href'],'file':filename,'sha256':filehash(RAW/filename)})
 return files

def verify_source_version(chain):
 date=SOURCES[chain][2]
 if not date:return
 if chain=='mcdonalds':
  raw=(RAW/'mcdonalds.html').read_text(encoding='utf-8')
  match=re.search(r'"DateModified"\s*:\s*"([^"T]+)',raw)
  if not match or match.group(1)!=date:raise ValueError('McDonald source date changed; review and update SOURCES')
 else:
  y,m,d=map(int,date.split('-'))
  if not re.search(fr'{y}(?:年|/)0?{m}(?:月|/)0?{d}(?:日|現在|\s)', ' '.join(p['text'] for p in tables(chain))):raise ValueError(chain+': source date changed; review and update SOURCES')

if __name__=='__main__':
 parser=argparse.ArgumentParser();parser.add_argument('--retrieved-at',required=True);parser.add_argument('--chain',choices=list(NAMES));args=parser.parse_args();RETRIEVED=args.retrieved_at
 OUT.mkdir(parents=True,exist_ok=True)
 reports=[];outputs=[]
 for chain in [args.chain] if args.chain else NAMES:
  verify_source_version(chain)
  rows=validate(chain,globals()[chain]())
  source=SOURCES[chain];meta={'chain':NAMES[chain],'restaurantId':'restaurant:'+NAMES[chain],'sourceUrl':source[0],'sourceTitle':source[1],'sourceType':'official','publishedOrUpdatedAt':source[2],'retrievedAt':RETRIEVED,'sha256':filehash(RAW/source[3]),'transformationMethod':'scripts/restaurants/convert.py: '+chain,'notes':[],'variantCount':len(rows),'productCount':len(set(r['productGroupId'] for r in rows)),'partialCount':sum(any(r[k] is None for k in KEYS) for r in rows)}
  meta['notes']=['栄養表に現掲載の値。店舗での販売を保証しない。期間限定表示が資料にない場合はnull。']
  meta['blockedCount']=sum(any(r[k] is None for k in KEYS) or bool(r.get('registrationBlockedReason')) for r in rows)
  meta['nutrientSourceCounts']={kind:sum(r['nutrientProvenance'][k]['sourceType']==kind for r in rows for k in KEYS) for kind in ['official','official_old','secondary','estimate','unknown']}
  payload=json.dumps({'metadata':meta,'items':rows},ensure_ascii=False,separators=(',',':'))
  outputs.append((OUT/(chain+'.json'),payload));meta['jsonBytes']=len(payload.encode('utf-8'));meta['sourceFiles']=source_files(chain);reports.append(meta);print(chain,len(rows),meta['productCount'],meta['partialCount'],meta['jsonBytes'])
 # Do not replace any generated dataset until every selected chain passes validation.
 for target,payload in outputs:target.write_text(payload,encoding='utf-8')
 if not args.chain:(ROOT/'data-sources/restaurants/sources.json').write_text(json.dumps(reports,ensure_ascii=False,indent=2),encoding='utf-8')
