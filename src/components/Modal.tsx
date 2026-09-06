import { useEffect, useRef, type ReactNode } from 'react';
import { Icon } from './Icon';
export function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = ref.current;
    const focus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    dialog?.showModal();
    return () => { dialog?.close(); document.body.style.overflow = previousOverflow; focus?.focus(); };
  }, []);
  return <dialog ref={ref} className="sheet" aria-labelledby="sheet-title" onCancel={event => { event.preventDefault(); onClose(); }}><div className="sheet-handle" /><header className="sheet-header"><h2 id="sheet-title">{title}</h2><button className="icon-button" aria-label="閉じる" onClick={onClose}><Icon name="close" /></button></header>{children}</dialog>;
}
