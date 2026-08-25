'use client';
import { useEffect, useState } from 'react';

const LG_QUERY = '(min-width: 992px)';

export function useIsDesktop(): boolean {
  const [isDesktop, setIsDesktop] = useState(true);

  useEffect(() => {
    const mq = window.matchMedia(LG_QUERY);
    const update = () => setIsDesktop(mq.matches);
    update();
    mq.addEventListener('change', update);
    return () => mq.removeEventListener('change', update);
  }, []);

  return isDesktop;
}
