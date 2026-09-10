import { useState } from 'react';
import prompt from '../prompts/chatgpt-photo.txt?raw';
export const photoPrompt = prompt.replace(/\r\n/g, '\n').trim();

export function PhotoImportInstructions() {
  const [showPrompt, setShowPrompt] = useState(false), [status, setStatus] = useState(''), [copying, setCopying] = useState(false);
  async function copy() {
    setCopying(true);
    try {
      if (!navigator.clipboard?.writeText) throw new Error('unsupported');
      await navigator.clipboard.writeText(photoPrompt);
      setStatus('プロンプトをコピーしました。ChatGPTアプリへ切り替え、写真を添付して貼り付けてください。');
    } catch { setShowPrompt(true); setStatus('コピーできませんでした。下のプロンプト欄を長押しして、すべて選択・コピーしてください。'); }
    finally { setCopying(false); }
  }
  return <section className="form-stack photo-instructions" aria-label="写真取り込みの手順"><p>食事写真をChatGPTで解析した結果を取り込みます。</p>
    <ol><li>ChatGPTアプリで写真を添付</li><li>下のプロンプトを貼り付け、量などを補足</li><li>回答のJSONをコピー</li><li>普段のホーム画面Meal Logへ戻って読み込み</li></ol>
    <button className="button secondary" disabled={copying} onClick={copy}>{copying ? 'コピー中…' : '写真解析プロンプトをコピー'}</button>
    {status && <p className="help" role="status">{status}</p>}
    <button className="text-button" aria-expanded={showPrompt} onClick={() => setShowPrompt(!showPrompt)}>{showPrompt ? 'プロンプトを閉じる' : 'プロンプトを表示・手動コピー'}</button>
    {showPrompt && <label className="field"><span>写真解析プロンプト</span><textarea aria-label="写真解析プロンプト" rows={8} readOnly value={photoPrompt} onFocus={event => event.currentTarget.select()} /></label>}
    <p className="catalog-note">写真からの量・油・調味料等は推定です。登録前に確認してください。写真はMeal Logへ送信・保存しません。</p>
  </section>;
}

export function PhotoEstimateNotice() {
  return <aside className="catalog-note" aria-label="写真推定の注意"><strong>写真からのChatGPT推定</strong><p>写真だけでは量・油・調味料・隠れた材料を正確に判断できない場合があります。</p><p>公式情報の申告を含む場合も、Meal Logが検証した値ではありません。</p></aside>;
}
