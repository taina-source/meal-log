"""Read-only MEXT conversion. Python 3.10+ / openpyxl; network only with --download."""
import argparse
import datetime
import hashlib
import json
from pathlib import Path
import re
import unicodedata
import urllib.request
import openpyxl
ROOT = Path(__file__).resolve().parents[1]
URL = 'https://www.mext.go.jp/content/20260327-mxt_kagsei-mext-000029402_02.xlsx'
PAGE = 'https://www.mext.go.jp/a_menu/syokuhinseibun/mext_00001.html'
VERSION = '日本食品標準成分表（八訂）増補2023年・2026年3月27日更新'
CATEGORIES = ['穀類','いも及びでん粉類','砂糖及び甘味類','豆類','種実類','野菜類','果実類','きのこ類','藻類','魚介類','肉類','卵類','乳類','油脂類','菓子類','し好飲料類','調味料及び香辛料類','調理済み流通食品類']
CODES = {'calories': 'ENERC_KCAL', 'protein': 'PROT-', 'fat': 'FAT-', 'carbs': 'CHOCDF-'}

def parse_value(raw):
    text = unicodedata.normalize('NFKC', str(raw)).strip() if raw is not None else ''
    if text in ('Tr', '(Tr)'): return None, 'estimated-trace' if text.startswith('(') else 'trace', text
    if text in ('', '-', '－', '—', '未測定'): return None, 'missing', text
    estimated = text.startswith('(') and text.endswith(')')
    number = text[1:-1] if estimated else text
    if not re.fullmatch(r'\d+(?:\.\d+)?', number): raise ValueError(f'Unexpected nutrient value: {raw!r}')
    return float(number), 'estimated' if estimated else 'numeric', text

def aliases(name, code):
    result = []
    for original, alias in [('にわとり','鶏肉'),('ぶた','豚肉'),('うし','牛肉'),('鶏卵','卵 たまご 玉子'),('しょうゆ','醤油'),('ほうれんそう','ほうれん草'),('じゃがいも','馬鈴薯'),('さけ','鮭'),('さば','鯖')]:
        if original in name: result.append(alias)
    if 'にわとり' in name and 'むね' in name: result += ['鶏むね 鶏胸肉 とりむね とり胸 鳥むね']
    if 'にわとり' in name and 'もも' in name: result += ['鶏もも 鶏もも肉 とりもも']
    if '水稲めし' in name and '精白米' in name: result += ['ご飯 ごはん 白ごはん 白ご飯 白米 ライス']
    if code == '01088': result += ['ご飯', '白ごはん', '白米', 'ごはん']
    if '鶏卵' in name: result += [name.replace('鶏卵', '卵')]
    return result

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--input', type=Path, default=ROOT/'data-sources/mext-2023-20260327.xlsx')
    parser.add_argument('--download', action='store_true')
    parser.add_argument('--retrieved-at', default=datetime.date.today().isoformat())
    args = parser.parse_args()
    if args.download:
        args.input.parent.mkdir(parents=True, exist_ok=True)
        urllib.request.urlretrieve(URL, args.input)
    workbook = openpyxl.load_workbook(args.input, read_only=True, data_only=True)
    rows = list(workbook['表全体'].values)
    header = next(row for row in rows[:20] if 'ENERC_KCAL' in row)
    columns = {key: header.index(code) for key, code in CODES.items()}
    foods, ids, special = [], set(), {}
    for row in rows:
        code = str(row[1])
        if not re.fullmatch(r'\d{5}', code): continue
        if code in ids: raise ValueError(f'Duplicate food number: {code}')
        ids.add(code)
        name = re.sub(r'\s+', ' ', row[3]).strip()
        item = {'id': 'mext-'+code, 'name': name, 'category': CATEGORIES[int(row[0])-1], 'aliases': aliases(name, code), 'source': '文部科学省', 'sourceVersion': VERSION, 'raw': {}, 'status': {}}
        for key, column in columns.items():
            value, status, raw = parse_value(row[column])
            item[key+'Per100g'] = value
            item['raw'][key] = raw
            item['status'][key] = status
            if status != 'numeric': special[status] = special.get(status, 0) + 1
        foods.append(item)
    workbook.close()
    if len(foods) < 2000: raise ValueError('Unexpected row count; inspect workbook before publishing.')
    metadata = {'name': '日本食品標準成分表（八訂）増補2023年', 'version': VERSION, 'sourceUrl': URL, 'sourcePage': PAGE, 'retrievedAt': args.retrieved_at, 'sha256': hashlib.sha256(args.input.read_bytes()).hexdigest(), 'foodCount': len(foods), 'specialValueCounts': special, 'columns': CODES, 'workbookUpdatedAt': '2026-03-27'}
    output = ROOT/'public/data/mext-foods.json'
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(json.dumps({'metadata': metadata, 'foods': foods}, ensure_ascii=False, separators=(',', ':')), encoding='utf-8')
    (ROOT/'data-sources/mext-source.json').write_text(json.dumps(metadata, ensure_ascii=False, indent=2)+'\n', encoding='utf-8')
    print(json.dumps(metadata, ensure_ascii=False, indent=2))
if __name__ == '__main__': main()
