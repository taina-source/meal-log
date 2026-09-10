import { expect, it, vi } from 'vitest';
import { parseJsonWithSmartQuotes } from './jsonQuotes';
import { parseChatgptJson } from './chatgpt';

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
  '{“notes”:“ご飯” /* comment */}', "{'notes':'single quotes'}", '{”notes”:”reverse”}',
])('補正しても不正なJSONは拒否：%s', text => expect(() => parseJsonWithSmartQuotes(text)).toThrow(SyntaxError));
it.each([
  { schemaVersion: 2 }, { type: 'other' }, { inputType: 'image' }, { items: [] }, { items: Array(21).fill(item) },
  { items: [{ ...item, protein: -1 }] }, { items: [{ ...item, quantity: 0 }] }, { items: [{ ...item, confidence: 'unknown' }] },
])('補正後もschema違反を拒否：%j', patch => expect(() => parseChatgptJson(smart(JSON.stringify({ ...payload(), ...patch })))).toThrow());
it('nullは補正後も0にしない', () => expect(parseChatgptJson(smart(JSON.stringify({ ...payload(), items: [{ ...item, protein: null }] }))).items[0].protein).toBeNull());
it('HTMLやURLを補正時に実行・加工しない', () => { const value = { ...item, notes: '<img src=x onerror=alert(1)>', sourceUrl: 'javascript:alert(1)' }; expect(parseChatgptJson(smart(JSON.stringify(value))).items[0]).toEqual(value); });
it('fallbackの過剰な再帰を拒否する', () => expect(() => parseJsonWithSmartQuotes('['.repeat(100) + '“value”' + ']'.repeat(100))).toThrow(SyntaxError));
