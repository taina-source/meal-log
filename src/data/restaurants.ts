import type { Restaurant } from '../domain/catalog';
const groups: [Restaurant['category'], string[]][] = [
  ['ファストフード', ['マクドナルド', 'KFC', 'モスバーガー', 'SUBWAY']],
  ['牛丼・丼', ['すき家', '吉野家', '松屋', 'なか卯']],
  ['麺類', ['丸亀製麺', 'はなまるうどん', '天下一品', '餃子の王将']],
  ['カレー', ['CoCo壱番屋']],
  ['回転寿司', ['スシロー', 'くら寿司', 'はま寿司']],
  ['定食・ファミレス', ['大戸屋', 'ロイヤルホスト', 'ガスト', 'びっくりドンキー', 'ジョイフル']],
];
export const restaurants: Restaurant[] = groups.flatMap(([category, names]) => names.map(name => ({ id: `restaurant:${name}`, name, category, aliases: name === 'マクドナルド' ? ['マック', 'マクド', 'McDonalds'] : name === 'KFC' ? ['ケンタッキー', 'ケンタ'] : name === 'SUBWAY' ? ['サブウェイ'] : name === 'CoCo壱番屋' ? ['ココイチ', 'ココ壱'] : [] })));
