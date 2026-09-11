import { expect, it, vi } from 'vitest';
import { parseJsonWithSmartQuotes } from './jsonQuotes';
import { parseChatgptJson } from './chatgpt';
import iphoneJson from '../testing/iphone-smart-quotes.txt?raw';

const item = { name: '鶏肉と“ご飯”', restaurant: '', quantity: 1, unit: '写真の1皿分', calories: 700, protein: 40, fat: 20, carbs: 90, sourceType: 'estimate', sourceUrl: '', sourceTitle: '', confidence: 'medium', notes: 'ご飯約200g。「半分」＋油5g / “控えめ”, 50% & 日本語🙂' };
const payload = (inputType = 'photo') => ({ schemaVersion: 1, type: 'meal-log-chatgpt', inputType, items: [item] });
// Change JSON delimiters only; leave literal punctuation/escape sequences intact.
const smart = (text: string) => text.replace(/"(?:\\.|[^"\\])*"/g, token => `“${token.slice(1, -1)}”`);

it('正しいASCII JSONはJSON.parse1回のみ、本文のスマート引用符はそのまま', () => { const text = JSON.stringify(payload()); const spy = vi.spyOn(JSON, 'parse'); try { expect(parseChatgptJson(text)).toEqual(payload()); expect(spy).toHaveBeenCalledTimes(1); expect(spy).toHaveBeenCalledWith(text); } finally { spy.mockRestore(); } });
it.each(['photo', 'text'])('全キー・値がスマート引用符の%sを読み込む', type => expect(parseChatgptJson(smart(JSON.stringify(payload(type))))).toEqual(payload(type)));
it('legacy単品のスマート引用符を維持', () => { const parsed = parseChatgptJson(smart(JSON.stringify(item))); expect(parsed.items).toEqual([item]); expect(parsed.inputType).toBeUndefined(); });
it('スマート引用符のキーとASCIIの本文を混在できる', () => { const value = { notes: '単独の”や“もASCII本文なら保持' }; const text = JSON.stringify(value).replace('"notes"', '“notes”'); expect(parseJsonWithSmartQuotes(text)).toEqual(value); });
it('本文中の対になった引用符・日本語・構文に似た記号を保持', () => { const value = { notes: '“油”, “小さじ1”：{材料} [少なめ] と “入れ子“さらに”の引用”' }; expect(parseJsonWithSmartQuotes(smart(JSON.stringify(value)))).toEqual(value); });
it('改行・バックスラッシュ・ASCII引用符のエスケープを保持', () => { const value = { notes: '改行\n油 "少なめ" C:\\food\t終わり' }; expect(parseJsonWithSmartQuotes(smart(JSON.stringify(value)))).toEqual(value); });
it('Unicodeエスケープを文字として書き換えない', () => expect(parseJsonWithSmartQuotes('{“notes”:“\\u201C米\\u201D”}')).toEqual({ notes: '“米”' }));
it('通常parseが成功したschema違反でfallbackしない', () => { const spy = vi.spyOn(JSON, 'parse'); try { expect(() => parseChatgptJson(JSON.stringify({ ...payload(), schemaVersion: 2 }))).toThrow('schemaVersion'); expect(spy).toHaveBeenCalledTimes(1); } finally { spy.mockRestore(); } });
it.each([
  '{“notes”:“ご飯”,}', '{“notes”:“ご飯”', '{“notes” “ご飯”}', '{“notes”:“ご飯”} garbage',
  '{“notes”:“未対応の“引用”}', '{“notes”:"mixed”}', '{"notes”:“mixed”}', '{“notes”:“raw "quote"”}',
  '{“notes”:“bad\\q”}', '{“notes”:“line\nbreak”}', '{“quantity”:01}', '{“quantity”:NaN}',
  '{“notes”:“ご飯” /* comment */}', "{'notes':'single quotes'}",
])('補正しても不正なJSONは拒否：%s', text => expect(() => parseJsonWithSmartQuotes(text)).toThrow(SyntaxError));
it.each([
  { schemaVersion: 2 }, { type: 'other' }, { inputType: 'image' }, { items: [] }, { items: Array(21).fill(item) },
  { items: [{ ...item, protein: -1 }] }, { items: [{ ...item, quantity: 0 }] }, { items: [{ ...item, confidence: 'unknown' }] },
])('補正後もschema違反を拒否：%j', patch => expect(() => parseChatgptJson(smart(JSON.stringify({ ...payload(), ...patch })))).toThrow());
it('nullは補正後も0にしない', () => expect(parseChatgptJson(smart(JSON.stringify({ ...payload(), items: [{ ...item, protein: null }] }))).items[0].protein).toBeNull());
it('HTMLやURLを補正時に実行・加工しない', () => { const value = { ...item, notes: '<img src=x onerror=alert(1)>', sourceUrl: 'javascript:alert(1)' }; expect(parseChatgptJson(smart(JSON.stringify(value))).items[0]).toEqual(value); });
it('fallbackの過剰な再帰を拒否する', () => expect(() => parseJsonWithSmartQuotes('['.repeat(100) + '“value”' + ']'.repeat(100))).toThrow(SyntaxError));

// Previously rejected reversed openers are now accepted at strict token starts only.
it('U+201Dで始まるキーと値', () => expect(parseJsonWithSmartQuotes('{”notes”:”reverse”}')).toEqual({ notes: 'reverse' }));
it.each(['””', '“”', '""'])('空文字の区切り %s', quotes => expect(parseJsonWithSmartQuotes(`{“restaurant”:${quotes}}`)).toEqual({ restaurant: '' }));
it('閉じ引用符から始まる通常文字列', () => expect(parseJsonWithSmartQuotes('{“name”:”テスト”}')).toEqual({ name: 'テスト' }));
it('閉じ引用符開始でも本文の対になった引用符は保持', () => expect(parseJsonWithSmartQuotes('{“notes”:”油“少なめ”、日本語🙂”}')).toEqual({ notes: '油“少なめ”、日本語🙂' }));
it('ASCII本文の単独の閉じ引用符は補正対象外', () => expect(parseJsonWithSmartQuotes('{”notes”:"本文に”がある",“restaurant”:””}')).toEqual({ notes: '本文に”がある', restaurant: '' }));
it.each(['photo', 'text', 'legacy'])('実機JSONの%s回帰と空文字3項目', type => {
  const photo = parseChatgptJson(iphoneJson);
  const text = type === 'photo' ? iphoneJson : type === 'text' ? iphoneJson.replace('“photo”', '“text”') : iphoneJson.slice(iphoneJson.indexOf('[{') + 1, iphoneJson.lastIndexOf(']'));
  const parsed = parseChatgptJson(text);
  expect(parsed.inputType).toBe(type === 'legacy' ? undefined : type);
  expect(parsed.items).toEqual(photo.items);
  expect(parsed.items[0]).toMatchObject({ name: '鶏肉のソテー クリームきのこソース', restaurant: '', sourceUrl: '', sourceTitle: '', calories: 620, protein: 42, fat: 43, carbs: 14 });
  expect(parsed.items[0].notes).toBe('写真から、皮付き鶏肉の可食部約180〜200gと、きのこ入りクリームソース約150〜180gとして推定。鶏肉の皮・調理油・乳製品を含むソース量により脂質とカロリーの誤差が大きい。画面上部のご飯は別の器で一部のみ写っており、食べた量を判断できないため計上していない。');
});
it.each(['{“notes”:”””}', '{“notes”:”テスト“}', '{“notes”:”テスト”,}', '{“notes””value”}', '{“notes”:”本文”途中”}', '{“quantity”:1”}', '{”notes:”value”}'])('不正な閉じ引用符配置を拒否 %s', text => expect(() => parseJsonWithSmartQuotes(text)).toThrow(SyntaxError));
it('閉じ引用符補正後もschema違反は拒否', () => expect(() => parseChatgptJson(iphoneJson.replace('“schemaVersion”:1', '“schemaVersion”:2'))).toThrow('schemaVersion'));
