"""Explicit development-only fetch of public official sources; cached by default."""
import argparse, hashlib, sys, urllib.request
from pathlib import Path
from bs4 import BeautifulSoup
sys.stdout.reconfigure(encoding='utf-8')
ROOT=Path(__file__).resolve().parents[2]/'data-sources/restaurants/raw/stage3a2'
URLS={
 'subway-index.html':'https://subway.co.jp/menu/allergy/',
 'subway.pdf':'https://subway.co.jp/documents/pdf/eiyo.pdf',
 'nakau-index.html':'https://www.nakau.co.jp/jp/menu/',
 'nakau.pdf':'https://images.zensho.co.jp/materials/nakau/allergen/nutrition.pdf',
 'hanamaru-index.html':'https://www.hanamaruudon.com/menu/',
 'hanamaru.pdf':'https://www.hanamaruudon.com/assets/pdf/allergy.pdf',
 'coco-index.html':'https://www.ichibanya.co.jp/menu/',
 'coco.pdf':'https://www.ichibanya.co.jp/menu/pdf/nutrition.pdf',
 'royalhost-index.html':'https://www.royalhost.jp/safety/product_infomation.html',
 'ootoya-index.html':'https://www.ootoya.com/menu',
 'ootoya-marunouchi.html':'https://www.ootoya.com/menu_list/info/nutrition/27194',
 'bikkuri-index.html':'https://www.bikkuri-donkey.com/menu/',
 'bikkuri-sources.html':'https://www.bikkuri-donkey.com/producing/',
 'royalhost.pdf':'https://www.royalhost.jp/safety/images/default_allergen_list_260831.pdf',
 'bikkuri.pdf':'https://www.bikkuri-donkey.com/control-panel/uploads/2026/08/2026_0826_nutrition.pdf',
 'royalhost-pre.pdf':'https://www.royalhost.jp/safety/images/pre_allergen_list_260831.pdf',
 'royalhost-central.pdf':'https://www.royalhost.jp/safety/images/central_allergen_list_260803.pdf',
 'royalhost-komazawa.pdf':'https://www.royalhost.jp/safety/images/komazawa_allergen_list_260831.pdf',
 'royalhost-naha.pdf':'https://www.royalhost.jp/safety/images/nahakokusaidori_allergen_list_260831.pdf',
 'royalhost-park.pdf':'https://www.royalhost.jp/safety/images/parkquarter_allergen_list_260831.pdf',
 'royalhost-airport.pdf':'https://www.royalhost.jp/safety/images/airport_allergen_list_260831.pdf',
 'royalhost-hospital.pdf':'https://www.royalhost.jp/safety/images/kyusyu-university-hospital_allergen_list_260624.pdf',
 'royalhost-nagoya.pdf':'https://www.royalhost.jp/safety/images/nagoya-hoshigaoka_allergen_list_260831.pdf',
 'royalhost-kyoto.pdf':'https://www.royalhost.jp/safety/images/kyototakasimaya_allergen_list_260831.pdf',
 'ootoya-utsunomiya.html':'https://www.ootoya.com/menu_list/info/nutrition/101003',
 'ootoya-komaki.html':'https://www.ootoya.com/menu_list/info/nutrition/27465',
 'ootoya-mita.html':'https://www.ootoya.com/menu_list/info/nutrition/27342',
 'ootoya-panjo.html':'https://www.ootoya.com/menu_list/info/nutrition/27303',
 'ootoya-sagamihara.html':'https://www.ootoya.com/menu_list/info/nutrition/129184',
}
def fetch(name,url,refresh=False):
 ROOT.mkdir(parents=True,exist_ok=True);path=ROOT/name
 if path.exists() and not refresh:return path.read_bytes()
 raw=urllib.request.urlopen(url,timeout=45).read()
 if name.endswith('.pdf') and b'%PDF' not in raw[:32]:raise ValueError('Not a PDF: '+url)
 path.write_bytes(raw);return raw
if __name__=='__main__':
 p=argparse.ArgumentParser();p.add_argument('--refresh',action='store_true');p.add_argument('--file',choices=list(URLS));p.add_argument('--remaining',action='store_true');a=p.parse_args()
 failed=[]
 selected=[a.file] if a.file else [n for n in URLS if not a.remaining or (not (ROOT/n).exists() and not n.startswith('coco'))]
 for name in selected:
  try:raw=fetch(name,URLS[name],a.refresh)
  except urllib.error.HTTPError as e:print('FAILED',name,e.code,'No retry or bypass. Manual source retrieval may be needed.');failed.append(name);continue
  print(name,len(raw),hashlib.sha256(raw).hexdigest())
  if name.endswith('.html'):
   soup=BeautifulSoup(raw,'html.parser')
   for link in soup.select('a[href]'):
    href=link['href'];label=link.get_text(' ',strip=True)
    if any(s in href.lower()+label for s in ['.pdf','栄養','nutrition','アレル','アレルギー','allerg']):print(label,href)
 if failed:sys.exit(1)
