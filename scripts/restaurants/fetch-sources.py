"""Download public official files once, for local conversion (never part of build)."""
import sys, argparse, hashlib, urllib.request
from pathlib import Path
sys.stdout.reconfigure(encoding='utf-8')
ROOT = Path(__file__).resolve().parents[2] / 'data-sources/restaurants/raw'
ROOT.mkdir(parents=True, exist_ok=True)
URLS = {
 'mcdonalds.html':'https://www.mcdonalds.co.jp/quality/allergy_Nutrition/nutrient/',
 'marugame-current.html':'https://marugame.com/menu/',
 'matsuya.pdf':'https://www.matsuyafoods.co.jp/matsuya/pdf/260901_nutritional_matsuya.pdf',
 'matsuya-pa-sa.pdf':'https://www.matsuyafoods.co.jp/matsuya/pdf/260901_nutritional_matsuya_pa_sa.pdf',
 'matsuya-makinohara.pdf':'https://www.matsuyafoods.co.jp/matsuya/pdf/260623_nutritional_matsuya_makinohara.pdf',
 'kfc.pdf':'https://assets.ctfassets.net/jax7ylg56usf/63NsvjRmBbpZRdG8l926iQ/6e3ccb242aff8ffb2138f37b3243a5e8/44f7edfe-ba19-463b-9de5-3e8a383e833e.pdf',
 'mos.pdf':'https://www.mos.jp/menu/pdf/nutrition.pdf',
 'sukiya.pdf':'https://images.zensho.co.jp/materials/sukiya/allergen/nutrition.pdf',
 'yoshinoya.pdf':'https://www.yoshinoya.com/pdf/allergy/',
}
if __name__ == '__main__':
 parser=argparse.ArgumentParser();parser.add_argument('--refresh',action='store_true');args=parser.parse_args()
 for name,url in URLS.items():
  if (ROOT/name).exists() and not args.refresh:print(name,'already downloaded; use --refresh to update');continue
  raw=urllib.request.urlopen(url,timeout=30).read()
  if name.endswith('.pdf') and b'%PDF' not in raw[:32]:
   raise ValueError(name+': response is not a PDF; original local file retained')
  (ROOT/name).write_bytes(raw)
  print(name,len(raw),hashlib.sha256(raw).hexdigest())
