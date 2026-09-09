"""Compact local inspection of extracted source rows; does not generate app data."""
import json,re,sys
from pathlib import Path
from bs4 import BeautifulSoup
sys.stdout.reconfigure(encoding='utf-8')
raw=Path(__file__).resolve().parents[2]/'data-sources/restaurants/raw/stage3a2'
for key in sys.argv[1:]:
 for file in sorted(raw.glob(key+'-*.tables.json'),key=lambda p:int(re.search(r'-(\d+)\.tables',p.name)[1])):
  tables=json.loads(file.read_text(encoding='utf-8'));print(file.name)
  for n,t in enumerate(tables):
   print('table',n,'rows',len(t),'cols',len(t[0]))
   for i,r in enumerate(t):
    print(i,repr(r[:8] if key in ['nakau','bikkuri'] else r[:7] if key=='hanamaru' else r[:6]))
 if key=='ootoya':
  for file in raw.glob('ootoya-*.html'):
   soup=BeautifulSoup(file.read_bytes(),'html.parser');print(file.name,soup.title.get_text() if soup.title else '')
   for t in soup.select('table'):
    print('TABLE',t.find_previous(['h2','h3','h4']).get_text(' ',strip=True) if t.find_previous(['h2','h3','h4']) else '',len(t.select('tr')))
    for r in t.select('tr')[:4]:print([c.get_text(' ',strip=True) for c in r.select('th,td')])
