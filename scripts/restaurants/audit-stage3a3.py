"""Offline integrity/capacity audit. No downloads, no DB operations."""
import collections, hashlib, json, re
from pathlib import Path
ROOT=Path(__file__).resolve().parents[2]
DATA=ROOT/'public/data/restaurants'
SOURCES=ROOT/'data-sources/restaurants'
KEYS=['calories','protein','fat','carbs']
NEW=['gusto','joyfull','tenka','ohsho','sushiro','kura','hama']
def sha(raw):return hashlib.sha256(raw).hexdigest()
def audit():
 baseline=json.loads((SOURCES/'stage3a2-baseline.json').read_text())
 for key,expected in baseline.items():assert sha((DATA/(key+'.json')).read_bytes())==expected,key+' changed'
 source_baseline=json.loads((SOURCES/'stage3a2-source-baseline.json').read_text(encoding='utf-8'))
 sources=json.loads((SOURCES/'sources.json').read_text(encoding='utf-8'))
 for chain,expected in source_baseline.items():
  entry=next(x for x in sources if x['chain']==chain)
  assert sha(json.dumps(entry,ensure_ascii=False,sort_keys=True,separators=(',',':')).encode())==expected,chain+' sources changed'
 totals=collections.Counter();reports=[];ids=set()
 for path in sorted(DATA.glob('*.json')):
  data=json.loads(path.read_text(encoding='utf-8'));rows=data['items'];meta=data['metadata'];counts=collections.Counter()
  assert len(rows)==meta['variantCount'] and len(rows)>0
  variants=set()
  for row in rows:
   assert row['id'] not in ids;ids.add(row['id'])
   variant=(row['productGroupId'],row['variantName']);assert variant not in variants;variants.add(variant)
   assert row['name'].strip() and row['restaurantId']==meta['restaurantId']
   for key in KEYS:
    value=row[key];p=row['nutrientProvenance'][key];assert p['value']==value
    assert p['sourceType'] in ['official','official_old','secondary','estimate','unknown']
    assert p['sourceUrl'].startswith('https://') and re.fullmatch(r'\d{4}-\d{2}-\d{2}',p['retrievedAt'])
    if value is None:assert p['sourceType']=='unknown' and row['rawNutrients'][key] not in ['0','0.0']
    else:assert value>=0
    counts[p['sourceType']]+=1
  report={'file':path.name,'groups':len({r['productGroupId'] for r in rows}),'variants':len(rows),'blocked':sum(any(r[k] is None for k in KEYS) or bool(r.get('registrationBlockedReason')) for r in rows),'bytes':path.stat().st_size,'nutrientSources':dict(counts)}
  reports.append(report)
  for key in ['groups','variants','blocked','bytes']:totals[key]+=report[key]
  totals.update(counts)
 assert len(reports)==21
 result={'chains':reports,'total':dict(totals),'newBytes':sum(r['bytes'] for r in reports if r['file'][:-5] in NEW),'maxJson':max(reports,key=lambda r:r['bytes']),'legacy14JsonAndSources':'PASS'}
 dist=ROOT/'dist';sw=dist/'sw.js'
 if sw.exists():
  text=sw.read_text(encoding='utf-8');urls=re.findall(r'\{url:"([^"]+)",revision:',text)
  paths={u.split('?')[0].removeprefix('/meal-log/').lstrip('/') for u in urls}
  assert urls and all((dist/p).is_file() for p in paths)
  assert all('raw/' not in p and not p.endswith(('.pdf','.xlsx')) for p in paths)
  for path in DATA.glob('*.json'):
   name='data/restaurants/'+path.name;assert name in paths
   assert (dist/name).read_bytes()==path.read_bytes(),name+' build is stale'
  assert 'data/mext-foods.json' in paths
  result['precache']={'entries':len(urls),'uniqueFiles':len(paths),'bytes':sum((dist/p).stat().st_size for p in paths)}
 return result
if __name__=='__main__':
 import sys
 sys.stdout.reconfigure(encoding='utf-8')
 result=audit();out=ROOT/'test-results';out.mkdir(exist_ok=True)
 (out/'stage3a3-data-audit.json').write_text(json.dumps(result,ensure_ascii=False,indent=2),encoding='utf-8')
 print(json.dumps(result,ensure_ascii=False,indent=2))
