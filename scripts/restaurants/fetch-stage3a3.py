"""Explicit development-time downloads. Never used by the app or CI.

Existing downloads are reused. HTTP 403/429 stop without retry or bypass.
"""
import argparse, hashlib, json, sys, urllib.request
from pathlib import Path
from bs4 import BeautifulSoup
sys.stdout.reconfigure(encoding='utf-8')
RAW=Path(__file__).resolve().parents[2]/'data-sources/restaurants/raw/stage3a3'
URLS={
 'gusto-index.html':'https://www.skylark.co.jp/gusto/menu/',
 'gusto-allergy.html':'https://allergy.skylark.co.jp/',
 'joyfull-index.html':'https://www.joyfull.co.jp/disclosure',
 'joyfull.pdf':'https://www.joyfull.co.jp/cal_pdf/cal.pdf',
 'tenka-index.html':'https://www.tenkaippin.co.jp/commitment/',
 'tenka-east.html':'https://www.tenkaippin.co.jp/allergy_e/',
 'ohsho-east.html':'https://www.ohsho.co.jp/menu/east/',
 'ohsho-west.html':'https://www.ohsho.co.jp/menu/west/',
 'ohsho-south.html':'https://www.ohsho.co.jp/menu/south/',
 'ohsho-detail.html':'https://www.ohsho.co.jp/menu/east/post.html',
 'ohsho-west-detail.html':'https://www.ohsho.co.jp/menu/west/post_374.html',
 'ohsho-south-detail.html':'https://www.ohsho.co.jp/menu/south/post_412.html',
 'tenka-info.html':'https://www.tenkaippin.co.jp/allergy101/',
 'gusto-menu.js':'https://www.skylark.co.jp/site_resource/common/js/brand/menu_202412.js?date=20260909',
 'gusto.json':'https://www.skylark.co.jp/gusto/menu/json/menu_detail.json',
 'gusto-categories.json':'https://www.skylark.co.jp/gusto/menu/json/index.json',
 'sushiro-normal.html':'https://www.akindo-sushiro.co.jp/menu/menu_detail/?s_id=869',
 'tenka-west.html':'https://www.tenkaippin.co.jp/allergy_w/',
 'sushiro-detail.html':'https://www.akindo-sushiro.co.jp/menu/menu_detail/?s_id=1019',
 'sushiro-faq.html':'https://www.akindo-sushiro.co.jp/faq/',
 'sushiro-index.html':'https://www.akindo-sushiro.co.jp/menu/',
 'sushiro-allergy.html':'https://www.akindo-sushiro.co.jp/menu/allergy.html',
 'sushiro.pdf':'https://www3.akindo-sushiro.co.jp/pdf/menu/allergy.pdf',
 'kura-index.html':'https://www.kurasushi.co.jp/menu/?area=area0',
 'kura.pdf':'https://www.kurasushi.co.jp/common/pdf/kura_allergen.pdf?260904=',
 'hama-index.html':'https://www.hama-sushi.co.jp/menu/',
 'hama.pdf':'https://images.zensho.co.jp/materials/hama-sushi/allergen/allergen.pdf',
}
def fetch(name,url,refresh=False):
 RAW.mkdir(parents=True,exist_ok=True);p=RAW/name
 if p.exists() and not refresh:return p.read_bytes()
 raw=urllib.request.urlopen(url,timeout=45).read()
 if name.endswith('.pdf') and not raw.startswith(b'%PDF'):raise ValueError('Not PDF: '+url)
 p.write_bytes(raw);return raw
if __name__=='__main__':
 p=argparse.ArgumentParser();p.add_argument('--file',choices=list(URLS));p.add_argument('--refresh',action='store_true');a=p.parse_args()
 failures=[]
 for name in [a.file] if a.file else URLS:
  if name in ['joyfull-index.html','joyfull.pdf'] and not (RAW/name).exists():print(name,'Manual capture required (HTTP 403 observed).');continue
  try:raw=fetch(name,URLS[name],a.refresh)
  except urllib.error.HTTPError as e:print('STOP',name,e.code,'No retry.');failures.append(name);continue
  print(name,len(raw),hashlib.sha256(raw).hexdigest())
  if name.endswith('.html'):
   soup=BeautifulSoup(raw,'html.parser')
   print([(x.get_text(' ',strip=True),x['href']) for x in soup.select('a[href]') if any(k in x['href'].lower()+x.get_text() for k in ['.pdf','栄養','allergy','nutrition','アレル'])])
 if failures:sys.exit(1)

