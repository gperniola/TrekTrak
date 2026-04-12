import { useEffect } from 'react';

let lockCount = 0;

export function useBodyScrollLock(active: boolean): void {
  useEffect(() => {
    if (!active) return;
    lockCount++;
    if (lockCount === 1) {
      document.body.style.overflow = 'hidden';
    }
    return () => {
      lockCount--;
      if (lockCount === 0) {
        document.body.style.overflow = '';
      }
    };
  }, [active]);
}
