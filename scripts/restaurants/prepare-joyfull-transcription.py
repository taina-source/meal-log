"""Verify the complete official PDF reader capture before revising the reviewed input. No network."""
import importlib.util
from pathlib import Path
p=Path(__file__).with_name("convert-stage3a3.py")
spec=importlib.util.spec_from_file_location("conv",p);m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)
for name in ["RAW","clean","add"]:globals()[name]=getattr(m,name)
import re,json
m.c.RETRIEVED="2026-09-09"
def capture():
 # Reviewed line-preserving capture of the actual official PDF. Not search snippets.
 lines={}
 for path in sorted(RAW.glob('joyfull-reader-*.txt')):
  for line in path.read_text(encoding='utf-8').splitlines():
   m=re.match(r'L(\d+)@P(\d+)(?:-\d+)?: (.*)',line)
   if m:
    k=int(m[1]);value=(int(m[2])+1,m[3])
    if k in lines and lines[k]!=value:raise ValueError('Conflicting PDF capture')
    lines[k]=value
 if set(lines)!=set(range(1510)) or lines[0][1]!='2026年9月8日':raise ValueError('Joyfull edition or full capture changed')
 pattern=re.compile(r'^(.*?)\s+(\d+(?:\.\d+)?)\s+(\d+(?:\.\d+)?)\s+(\d+(?:\.\d+)?)\s+(\d+(?:\.\d+)?)\s+(\d+(?:\.\d+)?)(?:\s|$)')
 categories={'トッピングメニュー','町中華','ご当地系','キッズ','サラダ','アルコール','アペタイザー','バランスレシピ','おてごろモーニング','まんぞくモーニング','ライトミール','ハンバーグ','グリル','定食','デザート','カフェプレートランチ','日替りランチ','ランチアイス','ボリューム満点ランチ','コラボ','フェア','かき氷','ドリンクバー','スープバー'}
 result=[];cat='その他'
 for index,(page,text) in sorted(lines.items()):
  m=pattern.match(text)
  if m:
   name=clean(m[1]);size='持ち帰り・1提供分' if cat.startswith('テイクアウト') else '店内・1提供分'
   row=add('joyfull',name,list(m.groups()[1:5]),cat,size=size,page=page,notes=['ライスを使用するメニューは通常量。ドリンクバー・スープバー付きメニューにバーの栄養値は含まない。卓上調味料は含まない。'])
   result.append(row)
  elif text.strip() in categories or text.strip().startswith('テイクアウト（'):cat=text.strip()
 if len(result)!=356:raise ValueError(('Joyfull row count changed',len(result)))
 return result

if __name__=="__main__":
 rows=capture(); reviewed=json.loads(p.with_name("joyfull-reviewed.json").read_text(encoding="utf-8"))["rows"]
 actual=[{"name":r["name"],"category":r["category"],"size":r["size"],"page":int(r["notes"][-1].split()[1].replace("ページ","")),"values":[r["rawNutrients"][k] for k in m.KEYS]} for r in rows]
 assert actual==reviewed,"Reviewed transcription differs from complete PDF capture"
 print("PASS: all 356 rows / 1510 source lines / 11 PDF pages")
