import sys,json
from pathlib import Path
import pdfplumber
sys.stdout.reconfigure(encoding='utf-8')
root=Path(__file__).resolve().parents[2]/'data-sources/restaurants/raw'
for key in sys.argv[1:] or ['kfc','mos','sukiya','yoshinoya','matsuya']:
 path=root/(key+'.pdf')
 if not path.exists():continue
 with pdfplumber.open(path) as pdf:
  print(key,len(pdf.pages))
  for i,p in enumerate(pdf.pages):
   text=p.extract_text() or ''
   (root/f'{key}-{i+1}.txt').write_text(text,encoding='utf-8')
   tables=p.extract_tables()
   (root/f'{key}-{i+1}.tables.json').write_text(json.dumps(tables,ensure_ascii=False),encoding='utf-8')
   print(i+1,'tables',[(len(t),len(t[0])) for t in tables],text[:250])
   if i==0 and tables: print(str(tables[0][:5])[:1800])
