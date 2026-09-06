import { Component, type ErrorInfo, type ReactNode } from 'react';
export class ErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  componentDidCatch(_error: Error, _info: ErrorInfo) { /* The recovery UI keeps storage failures visible. */ }
  render() {
    if (this.state.failed) return <main className="app-shell"><section className="card empty-state" role="alert"><h1>データを読み込めませんでした</h1><p>Safariの保存設定・空き容量を確認してから、再読み込みしてください。</p><button className="button primary" onClick={() => window.location.reload()}>再読み込み</button></section></main>;
    return this.props.children;
  }
}
