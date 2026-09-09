"""Prepare a reviewable table from a manually saved reading of the official PDF.

Specific to 2026-09-02. Extracted line numbers are checked; subsequent editions
must be reviewed, never accepted as if their layout were unchanged.
"""
import json,re,sys
from pathlib import Path
sys.stdout.reconfigure(encoding='utf-8')
HERE=Path(__file__).resolve().parent;raw=HERE.parents[1]/'data-sources/restaurants/raw/stage3a2';lines={}
for f in ['coco-web-extract.txt','coco-web-end.txt','coco-web-last.txt']:
 for line in (raw/f).read_text(encoding='utf-8').splitlines():
  m=re.match(r'L(\d+)@P(\d+)(?:-\d+)?: (.*)',line)
  if m:lines[int(m[1])]=(int(m[2])+1,m[3])
if set(lines)!=set(range(378)) or lines[1][1]!='2026年9月2日現在':raise ValueError('Incomplete or changed official extraction')
rows=[];name='';notes=[]
for i,(page,text) in sorted(lines.items()):
 if i<13 or 29<=i<=38 or 49<=i<=59 or 65<=i<=82 or 111<=i<=121 or 129<=i<=138 or 141<=i<=150 or 161<=i<=170 or 185<=i<=203 or 215<=i<=224 or 277<=i<=285 or 314<=i<=315 or 319<=i<=328 or 330<=i<=339 or i==377:continue
 text=text.replace('citeトッピング','（トッピング）').replace('ドリンク エネルギー','')
 match=re.search(r'([\d,]+)\s+(\d+\.\d+)\s+(\d+\.\d+)\s+(\d+\.\d+)\s+(\d+\.\d+)$',text)
 head=text[:match.start()].strip() if match else text.strip()
 if head.startswith('＊'):notes.append(head)
 elif head:name=head
 if not match:continue
 values=list(match.groups()[:4]);cat=('数量限定' if i<29 else '期間限定' if i<49 else 'カレー' if i<111 else '麺・その他カレー' if i<141 else 'お子さま' if i<192 else 'サラダ' if i<215 else 'トッピング' if i<277 else 'ドリンク' if i<319 else 'デザート' if i<330 else 'その他')
 if not name:raise ValueError(('Missing name',i))
 if name.startswith('（トッピング）'):name=name[len('（トッピング）'):];cat='トッピング'
 if i in [151,152]:name='ニコニコジュニアカレー '+name;notes+=['選択トッピング・ドリンクは含まず。掲載の基本ソースとライスのみ。']
 size='';limited=True if i<49 else None
 if i<111 and cat!='トッピング':size='ライス250g' if i==28 else 'ライス300g';notes+=['掲載のライス量のみ。米100g分の独自加減算をしない。']
 m=re.search(r'（ライス(\d+)g）',name)
 if m:size='ライス'+m[1]+'g';name=name[:m.start()]
 if cat=='サラダ':notes+=['シーザーサラダ以外はドレッシングを含まない。']
 if cat=='トッピング':notes+=['公式の追加1単位。カレー本体に含まれる分を二重加算しない。']
 record={'name':name,'size':size,'values':values,'category':cat,'page':page,'notes':notes,'limited':limited,'sourceLine':i}
 if i in [172,174,176,178]:record['blocked']='公式表のkcalとPFCの整合性を確認できないため登録できません。原表の値を保持しています。'
 rows.append(record);name='';notes=[]
# PDF text reading order displaced the low-carbohydrate row's carbohydrate and
# salt cells; retain the explicit printed 25.1 g, not a guessed zero.
rows.append({'name':'低糖質カレー','size':'カリフラワーライス＋ポークソース','values':['255','8.0','15.4','25.1'],'category':'その他カレー','page':2,'notes':['公式表の炭水化物25.1g（糖質19.7g・食物繊維5.4g）。'],'sourceLine':190})
for name,page in [('リンゴドリンク',2),('カルピスキッズ',2),('野菜生活100 マンゴーサラダ',2),('キリン ノンアルコールビール',4),('キリン一番搾り',4)]:
 rows.append({'name':name,'size':'','values':[None]*4,'category':'ドリンク','page':page,'notes':['公式表はパッケージ表示参照。数値未掲載のため登録不可。']})
if len(rows)<150:raise ValueError('Suspiciously few CoCo rows')
(HERE/'coco-reviewed.json').write_text(json.dumps(rows,ensure_ascii=False,indent=2),encoding='utf-8');print(len(rows))
