"""Stage 3A-2 only. Offline conversion; never rewrites the seven Stage 3A-1 JSONs.

Inputs: explicit official PDFs/HTML saved by fetch-stage3a2.py. CoCo's reviewed
PDF transcription is a separate input because automated downloads returned 403.
Unknowns remain null. Source layout/version changes fail closed.
"""
import argparse,importlib.util,json,re,sys
from pathlib import Path
from bs4 import BeautifulSoup

HERE=Path(__file__).resolve().parent
spec=importlib.util.spec_from_file_location('common',HERE/'convert.py');c=importlib.util.module_from_spec(spec);spec.loader.exec_module(c)
spec=importlib.util.spec_from_file_location('fetch2',HERE/'fetch-stage3a2.py');fetch2=importlib.util.module_from_spec(spec);spec.loader.exec_module(fetch2)
RAW=c.RAW/'stage3a2';OUT=c.OUT;KEYS=c.KEYS
NAMES=dict(subway='SUBWAY',nakau='なか卯',hanamaru='はなまるうどん',coco='CoCo壱番屋',ootoya='大戸屋',royalhost='ロイヤルホスト',bikkuri='びっくりドンキー')
DATES=dict(subway='2026-09-02',nakau='2026-09-04',hanamaru='2026-09-03',coco='2026-09-02',ootoya=None,royalhost='2026-08-31',bikkuri='2026-08-26')
MINIMUM=dict(subway=150,nakau=340,hanamaru=440,coco=180,ootoya=970,royalhost=2900,bikkuri=360)
c.NAMES.update(NAMES)
for key in NAMES:c.SOURCES[key]=(fetch2.URLS.get(key+'.pdf',fetch2.URLS.get('ootoya-marunouchi.html')),NAMES[key]+'公式 栄養成分情報',DATES[key],key+'.pdf')
clean=c.clean;canonical=c.canonical
def pages(key):return c.tables('stage3a2/'+key)
def add(chain,name,size,values,cat,**kwargs):return c.item(chain,name,size,values,cat,**kwargs)
def sizes(name):
 m=re.search(r'^([ＳＭＬSML]{1,2})\s+(.+)$',name)
 if m:return m[2],canonical(m[1])
 m=re.search(r'\s*[（(]((?:[SMLＳＭＬ]|小盛り|並盛|大盛|小盛|シングル|ダブル|ライス\d+[gｇ]))[）)]$',name)
 if m:return name[:m.start()].strip(),canonical(m[1])
 m=re.search(r'\s*([ＳＭＬSML])$',name)
 if m:return name[:m.start()].strip(),canonical(m[1])
 return name,''

def subway():
 result=[];cat='';limited=None;region=''
 for pno,p in enumerate(pages('subway'),1):
  for table in p['tables']:
   if len(table[0]) not in [7,8,9] or 'エネルギー' not in str(table[:3]):raise ValueError('SUBWAY columns changed')
   for r in table:
    offset=2 if len(r)==9 else 1
    name=clean(''.join(x or '' for x in r[:offset]))
    if '更新版' in name:continue
    if '限定店舗' in name:region='限定店舗'
    if '【' in name:
     limited=True if '期間限定' in name else None
     cat=name.split('】')[0].split('【')[-1]
     if pno==3 and cat!='サイドメニュー':region=''
     continue
    if name=='メニュー名' or not name:continue
    if not r[offset]:raise ValueError(('SUBWAY unexpected row',r))
    name,size=sizes(name);notes=['公式表に明記された1提供単位。パン・ドレッシングの置換差分は計算しない。']
    basis=''
    if cat=='サンドイッチ':basis='レギュラー・おすすめ構成';notes+=['パン・ドレッシング・野菜は各商品のおすすめ構成を含む完成品。部品を重複加算しないでください。']
    elif cat=='サラダ':basis='サラダ・ドレッシングなし'
    elif cat in ['パン','トッピング','野菜','ドレッシング・ソース・マスタード他']:basis=cat+'単品';notes+=['公式表の部品1提供分。追加分のみカートで加算。標準構成に含まれる分を重複加算しないでください。']
    result.append(add('subway',name,size or basis,r[offset:offset+4],cat,region=region,limited=limited,page=pno,group=cat+'|'+name,notes=notes))
   limited=None;region=''
 return result

def nakau():
 result=[];name=''
 for pno,p in enumerate(pages('nakau'),1):
  for t in p['tables']:
   if len(t[0])!=8 or 'たんぱく質' not in str(t[0]):raise ValueError('Nakau columns changed')
   for r in t[2:]:
    if clean(r[1]):name=clean(r[1])
    cat={1:'親子丼・牛すき丼',2:'丼',3:'カレー・うな重',4:'うどん',5:'そば',6:'定食',7:'朝食',8:'サイド・トッピング',9:'お子様・ドリンク・デザート'}[pno]
    result.append(add('nakau',name,clean(r[2]),r[3:7],cat,page=pno,notes=['公式表の1食当たり。店舗によって取り扱いが異なる。お好みの紅生姜・醤油・七味・山椒・ドレッシングは含まない。']))
 return result

def hanamaru():
 result=[];cat='うどん';name=''
 for pno,p in enumerate(pages('hanamaru'),1):
  if pno in [1,13]:continue
  region='吉野家コラボ店舗' if pno>=10 else ''
  for t in p['tables']:
   if len(t[0])!=36 or '蛋白質' not in str(t[:2]):raise ValueError('Hanamaru columns changed')
   # Some PDF cells overlap the header's bottom boundary. Recover only numeric
   # text physically extracted into that nutrient's header, never another row.
   for col in range(3,7):
    m=re.search(r'\n(\d+(?:\.\d+)?)$',t[1][col] or '')
    if m:
     if t[2][col] is not None:raise ValueError('Hanamaru header recovery changed')
     t[2][col]=m[1]
   for r in t[2:]:
    if any(r[col] is None for col in [2,4,6]) and r[3]:
     candidates=[]
     for line in p['text'].splitlines():
      m=re.match(r'^([小中大])\s+(\d+)\s+(\d+\.\d+)\s+(\d+\.\d+)\s+(\d+\.\d+)\s+',line)
      if m and m[2]==r[3] and all(r[col] is None or c.number(r[col])==c.number(m[col-1]) for col in [4,5,6]):candidates.append(m.groups())
     if len(candidates)==1:
      values=candidates[0]
      for col in [2,4,6]:
       if r[col] is None:r[col]=values[0 if col==2 else col-2]
    label=re.sub(r'2026年9\s*月3日改.*','',clean(r[0])).strip()
    if label:
     if '沖縄' in label:region='沖縄・一部店舗';cat='地域限定'
     elif label=='一部 店舗':region='一部店舗'
     elif label=='吉野家':cat='吉野家コラボ'
     else:cat=label
    if clean(r[1]):name=clean(r[1])
    if not name:raise ValueError(('Hanamaru missing merged name',pno,r[:8]))
    result.append(add('hanamaru',name,clean(r[2]),r[3:7],cat,region=region,page=pno,limited=True if '季節メニュー' in p['text'] else None,notes=['公式1食単位。温冷・サイズ・米や仕込品の種類は表記がある組み合わせのみ。※は店舗で油調。']))
 return result

def ootoya():
 result=[]
 for filename in ['ootoya-marunouchi.html','ootoya-komaki.html','ootoya-utsunomiya.html','ootoya-mita.html','ootoya-panjo.html','ootoya-sagamihara.html']:
  soup=BeautifulSoup((RAW/filename).read_bytes(),'html.parser');store=re.search(r'大戸屋ごはん処 (.+?)メニュー一覧',soup.title.get_text())[1]
  tabs={el.get('aria-controls'):clean(el.get_text()) for el in soup.select('[role="tab"]')}
  for table in soup.select('table'):
   headers=canonical(table.select('tr')[0].get_text())
   if not all(x in headers for x in ['商品名','エネルギー','たんぱく質','脂質','糖質','食物繊維']):raise ValueError('Ootoya columns changed')
   parent=table.find_parent(attrs={'role':'tabpanel'});cat=tabs.get(parent.get('id') if parent else None)
   if not cat:raise ValueError('Ootoya category layout changed')
   for r in table.select('tr')[1:]:
    cells=[clean(x.get_text()) for x in r.select('th,td')]
    if len(cells)!=7:raise ValueError('Ootoya row changed')
    raw=[re.sub(r'\s*(?:kcal|g)$','',s) for s in cells[1:6]]
    # Keep the two published components in the raw/provenance fields. The current
    # source does not directly publish C; do not label an inferred sum official C.
    for value in raw:c.number(value)
    name,size=sizes(cells[0]);basis=cat+('・白ご飯込み' if cat=='定食' and filename!='ootoya-sagamihara.html' else '')
    row=add('ootoya',name,' / '.join(x for x in [basis,size] if x),raw[:3]+[None],cat,region=store,url=fetch2.URLS[filename],notes=['公式確認店舗：'+store+'。他店舗での提供・栄養値の一致は保証しない。','公式の定食値は白ご飯の場合。ご飯の置換・差分計算は行わない。'])
    row['rawNutrients']['carbs']=f'炭水化物の直接掲載なし（糖質 {raw[3]}g・食物繊維 {raw[4]}g）'
    row['nutrientProvenance']['carbs']['notes']=['糖質は炭水化物そのものではありません。公式の糖質・食物繊維を保持しますが、合計を公式Cとみなす変換はせずnullとします。']
    row['registrationBlockedReason']='公式の炭水化物値を直接確認できずPFC情報が不足しているため登録できません。糖質・食物繊維は出典欄で確認できます。'
    result.append(row)
 return result

ROYAL={'royalhost':'通常店','royalhost-pre':'先行改定店舗','royalhost-central':'都心中心部他','royalhost-komazawa':'駒沢店','royalhost-naha':'那覇国際通り店','royalhost-park':'駒沢パーククォーター店','royalhost-airport':'空港店舗','royalhost-hospital':'九州大学病院店','royalhost-nagoya':'名古屋星ヶ丘店','royalhost-kyoto':'京都髙島屋S.C.店'}
def royalhost():
 result=[]
 for key,region in ROYAL.items():
  for pno,p in enumerate(pages(key),1):
   if not p['tables']:continue
   dm=re.search(r'更新日[：:]\s*(\d{4})/(\d{2})/(\d{2})',p['text'])
   if not dm:continue # cover/information pages, no nutrition table
   date='-'.join(dm.groups());major='';position=0;ctext=canonical(p['text'])
   headings=[(len(canonical(p['text'][:m.start()])),m[1]) for m in re.finditer(r'^【([^】]+)】\s*$',p['text'],re.M)]
   footnotes={m[1]:clean(m[2]) for m in re.finditer(r'^※(\d+)[：:](.+)$',p['text'],re.M)}
   cat=''
   for t in p['tables']:
    if len(t[0])<35:continue
    caption=next((r[0] for r in t if 'kcal' in str(r[1])),None)
    if not caption:raise ValueError(('Royal missing caption',key,pno))
    found=ctext.find(canonical(caption.split('\n')[0]),position)
    if found<0:raise ValueError(('Royal table heading missing',key,pno,t[0][0]))
    preceding=[title for pos,title in headings if pos<found]
    if preceding:major=preceding[-1]
    position=found+len(canonical(caption.split('\n')[0]))
    for r in t:
     if 'kcal' in str(r[1]):cat=clean(r[0]);continue
     if not clean(r[0]) or r[1] is None:continue
     if not cat:raise ValueError(('Royal missing header',key,pno,r[:5]))
     notes=[footnotes.get(n,'公式備考 '+n) for n in re.findall(r'\d+',clean(r[6]))]
     if major=='ドリンクバー':notes+=['各1杯当たり。砂糖・ガムシロップ・コーヒーフレッシュ等は含まない。']
     restriction=' / '.join(n for n in notes if any(w in n for w in ['店舗','空港','のみ','除く']))
     name,size=sizes(clean(r[0]));basis=' / '.join(dict.fromkeys(x for x in [major,cat,size,restriction] if x))
     result.append(add('royalhost',name,basis,r[1:5],major or cat,region=region,url=fetch2.URLS[key+'.pdf'],date=date,page=pno,limited=True if 'フェア' in major else None,notes=notes))
 return result

def bikkuri():
 result=[]
 for pno,p in enumerate(pages('bikkuri'),1):
  dm=re.search(r'(20\d{2})/(\d{1,2})/(\d{1,2})更新',canonical(p['text']))
  date='-'.join([dm[1],dm[2].zfill(2),dm[3].zfill(2)]) if dm else None
  for ti,t in enumerate(p['tables']):
   if len(t[0]) not in [6,7]:continue # separate allergen-only tables
   if 'kcal' not in str(t[:3]):raise ValueError('Bikkuri headers changed')
   cat={1:'ディッシュ',2:'ステーキ・サイド',3:'お子様・デザート',4:'ドリンク',5:'ランチ' if ti==0 else 'モーニング'}.get(pno,'その他')
   basis='';previous='';region='テイクアウト・宅配' if pno>=11 else '';size=''
   for ri,r in enumerate(t):
    offset=len(r)-5;label=clean(r[0]);name=clean(''.join(x or '' for x in r[:offset]));values=r[offset:offset+4]
    if 'kcal' in str(values) or not name or canonical(name)=='商品名':continue
    if label.startswith('★'):
     cat=label[1:];basis=cat if pno==5 and ti==0 or cat in ['ライトセット','トッピング'] else '';continue
    if not any(v for v in values):continue
    if any(str(v).startswith(('＋','+','－','-')) for v in values):continue # published signed adjustments, not standalone foods
    if offset==2 and pno<=2 and clean(r[1]):
     if pno==1 and ti==0:size='S' if 6<=ri<=18 else 'M' if 19<=ri<=31 else ''
     elif pno==1 and ti==1:size='L' if 2<=ri<=14 else ''
     elif pno==2 and ti==0:size='S' if 2<=ri<=9 else 'M' if 10<=ri<=17 else 'L' if 18<=ri<=25 else ''
     name=clean(r[1])
    else:name,size=sizes(name)
    if pno==5 and ti==1 and ri+1<len(t) and not any(t[ri+1][1:]) and clean(t[ri+1][0]).startswith('（'):name+=clean(t[ri+1][0])
    if '〃' in name:
     if pno==4 and ti==2:name=name.replace('〃','いろどりディッシュ')
     else:
      base='プチトッピング' if pno==3 and ti==0 else previous
      name=name.replace('〃',base)
    else:previous=name.split('（')[0] if name.startswith(('モーニングセット','卵かけご飯')) else name
    if pno==3 and ti==2 and name in ['中','小']:name,size='ドンキーハウスビール〈樽生〉',name
    if pno==3 and ti==2 and name.endswith(' 大'):name,size=name[:-2],'大'
    if pno==3 and ti==0 and name.startswith('・'):name,size='ぶ～ちゃんのおこさまランチ',name[1:]
    if pno==3 and ti==1 and ri>=14:region='ソフトサーバー洗浄時'
    if '店舗限定' in cat:region='店舗限定'
    # Printed names are preserved, including a typographical abbreviation in L.
    group='ベーコンエッグベネバーグディッシュ' if name=='ベーコンエッグベネバーグディッシ' else name
    if not date:raise ValueError(('Bikkuri source date missing',pno))
    result.append(add('bikkuri',name,' / '.join(x for x in [basis,size] if x),values,cat,region=region,date=date,page=pno,group=group,notes=['公式の1食当たり。S/M/Lは公式表記のまま。重量gへの置換・ライス増減の推定はしない。']))
 return result

def coco():
 # Reviewed transcription is generated from the actual official PDF, not snippets.
 rows=json.loads((HERE/'coco-reviewed.json').read_text(encoding='utf-8'))
 result=[]
 for r in rows:
  row=add('coco',r['name'],r['size'],r['values'],r['category'],page=r['page'],notes=r['notes'],limited=r.get('limited'))
  if r.get('blocked'):row['registrationBlockedReason']=r['blocked']
  result.append(row)
 return result

def verify_version(key):
 if key in ['ootoya','coco']:return
 for filename in ROYAL if key=='royalhost' else [key]:
  date=DATES[key]
  if key=='royalhost':
   stamp=re.search(r'_(\d{6})\.pdf$',fetch2.URLS[filename+'.pdf'])[1]
   date='20'+stamp[:2]+'-'+stamp[2:4]+'-'+stamp[4:]
  y,m,d=map(int,date.split('-'));text=' '.join(p['text'] for p in pages(filename))
  if not re.search(fr'{y}(?:年|/)0?{m}(?:月|/)0?{d}(?:日|現在|更新|\s)',canonical(text)):
   raise ValueError(filename+': publication date changed; inspect source and update parser/version together')

def main():
 parser=argparse.ArgumentParser();parser.add_argument('--retrieved-at',required=True);parser.add_argument('--chain',choices=list(NAMES));args=parser.parse_args();c.RETRIEVED=args.retrieved_at
 original=json.loads((c.ROOT/'data-sources/restaurants/sources.json').read_text(encoding='utf-8'));reports=[];outputs=[]
 for key in [args.chain] if args.chain else NAMES:
  verify_version(key)
  rows=c.validate(key,globals()[key](),MINIMUM[key]);source=c.SOURCES[key]
  meta={'chain':NAMES[key],'restaurantId':'restaurant:'+NAMES[key],'sourceUrl':source[0],'sourceTitle':source[1],'sourceType':'official','publishedOrUpdatedAt':DATES[key],'retrievedAt':args.retrieved_at,'transformationMethod':'scripts/restaurants/convert-stage3a2.py: '+key,'notes':['取得時点の公式掲載値。全店舗で現在販売中という意味ではない。'],'variantCount':len(rows),'productCount':len({r['productGroupId'] for r in rows}),'partialCount':sum(any(r[k] is None for k in KEYS) for r in rows),'blockedCount':sum(any(r[k] is None for k in KEYS) or bool(r.get('registrationBlockedReason')) for r in rows)}
  meta['nutrientSourceCounts']={kind:sum(r['nutrientProvenance'][k]['sourceType']==kind for r in rows for k in KEYS) for kind in ['official','official_old','secondary','estimate','unknown']}
  files=([x+'.pdf' for x in ROYAL] if key=='royalhost' else [p.name for p in RAW.glob('ootoya-*.html') if p.name!='ootoya-index.html'] if key=='ootoya' else [key+'.pdf'])
  if key=='coco':files=['coco-web-extract.txt','coco-web-end.txt','coco-web-last.txt']
  meta['sourceFiles']=[{'chain':NAMES[key],'sourceUrl':fetch2.URLS.get(f,source[0]),'sourceTitle':source[1],'sourceType':'official','publishedOrUpdatedAt':DATES[key],'retrievedAt':args.retrieved_at,'localRawFile':'stage3a2/'+f,'sha256':c.filehash(RAW/f),'transformationMethod':meta['transformationMethod'],'notes':['SHA-256は公式PDFの読取テキストに対するもの（PDFバイナリではない）。自動ダウンロード403のため公開PDF本文の読取結果を行単位で確認・転記。'] if key=='coco' else []} for f in files]
  for entry in meta['sourceFiles']:
   if key=='royalhost':
    stamp=re.search(r'_(\d{6})\.pdf$',entry['sourceUrl'])[1];entry['publishedOrUpdatedAt']='20'+stamp[:2]+'-'+stamp[2:4]+'-'+stamp[4:]
   if key=='bikkuri':entry['notes']=['現在公式からリンクされる資料。各ページの更新日（4/8・5/27・8/26等）は栄養素別provenanceに保持。']
  payload=json.dumps({'metadata':meta,'items':rows},ensure_ascii=False,separators=(',',':'));outputs.append((OUT/(key+'.json'),payload));meta['jsonBytes']=len(payload.encode());reports.append(meta);print(key,meta['productCount'],len(rows),meta['partialCount'],meta['blockedCount'],meta['jsonBytes'])
 for path,payload in outputs:path.write_text(payload,encoding='utf-8')
 names={r['chain'] for r in reports};original=[r for r in original if r['chain'] not in names]+reports
 (c.ROOT/'data-sources/restaurants/sources.json').write_text(json.dumps(original,ensure_ascii=False,indent=2),encoding='utf-8')
if __name__=='__main__':main()
