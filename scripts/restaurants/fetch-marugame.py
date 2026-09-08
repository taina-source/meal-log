"""Read public menu pages and their embedded __NEXT_DATA__; no private API."""
import json,sys,time,urllib.request,argparse
from pathlib import Path
from bs4 import BeautifulSoup
sys.stdout.reconfigure(encoding='utf-8')
ROOT=Path(__file__).resolve().parents[2]/'data-sources/restaurants/raw/marugame'
ROOT.mkdir(parents=True,exist_ok=True)
REFRESH=False
def fetch(url,name):
 path=ROOT/name
 if path.exists() and not REFRESH:return path.read_bytes()
 raw=urllib.request.urlopen(url,timeout=30).read(); path.write_bytes(raw);time.sleep(.2);return raw
def props(raw):return json.loads(BeautifulSoup(raw,'html.parser').select_one('#__NEXT_DATA__').string)['props']['pageProps']
if __name__=='__main__':
 parser=argparse.ArgumentParser();parser.add_argument('--refresh',action='store_true');args=parser.parse_args();REFRESH=args.refresh
 seen=set(); failures=[]
 for category in ['udon','tempura','topping','gohanmono','udonbento']:
  data=props(fetch(f'https://marugame.com/menu/{category}/',f'{category}.html'))
  print(category,list(data))
  (ROOT/f'{category}.json').write_text(json.dumps(data,ensure_ascii=False,indent=2),encoding='utf-8')
  for mode,menus in data['menus'].items():
   for menu in menus:
    href=menu['href']
    if href in seen:continue
    seen.add(href)
    name=category+'-'+menu['id']+'.html'
    try: detail=props(fetch('https://jp.marugame.com'+href,name))
    except urllib.error.HTTPError as error:
     if error.code in [403,429]:raise
     failures.append({'url':'https://jp.marugame.com'+href,'error':error.code});print('FAILED',href,error.code);continue
    if 'nutritionItemData' not in detail: raise ValueError('Missing nutritionItemData: '+href)
    print(name,len((detail['nutritionItemData'] or {}).get('items',[])))
 print('Total product pages',len(seen))
 (ROOT/'failures.json').write_text(json.dumps(failures,ensure_ascii=False,indent=2),encoding='utf-8')
 if failures:raise RuntimeError('Some official pages could not be fetched; do not publish a partial update')
