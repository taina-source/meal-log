import { useState } from 'react';
import { useRegisterSW } from 'virtual:pwa-register/react';
export function PwaStatus() {
  const [registrationError, setRegistrationError] = useState(false);
  const { needRefresh: [needRefresh, setNeedRefresh], offlineReady: [offlineReady, setOfflineReady], updateServiceWorker } = useRegisterSW({ onRegisterError() { setRegistrationError(true); } });
  if (!needRefresh && !offlineReady && !registrationError) return null;
  return <aside className="pwa-notice" role="status"><span>{registrationError ? 'オフラインの準備ができませんでした。オンラインで再読み込みしてください。' : needRefresh ? '新しいバージョンを利用できます。入力を保存してから更新してください。' : 'オフラインで使う準備ができました。'}</span><div>{needRefresh && <button onClick={() => void updateServiceWorker(true)}>更新</button>}<button onClick={() => { setNeedRefresh(false); setOfflineReady(false); setRegistrationError(false); }}>閉じる</button></div></aside>;
}
