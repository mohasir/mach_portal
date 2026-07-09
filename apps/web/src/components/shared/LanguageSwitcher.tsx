'use client';
import { useEffect } from 'react';
import { Button } from 'antd';
import { Languages } from 'lucide-react';
import i18n from '@/lib/i18n/config';
import { useLocaleStore } from '@/lib/stores/locale.store';

export function LanguageSwitcher() {
  const locale = useLocaleStore((s) => s.locale);
  const setLocale = useLocaleStore((s) => s.setLocale);

  useEffect(() => {
    if (i18n.language !== locale) i18n.changeLanguage(locale);
  }, [locale]);

  const toggle = () => setLocale(locale === 'es' ? 'en' : 'es');

  return (
    <Button className='px-1'  type="text" icon={<Languages size={16} />} onClick={toggle}>
      {locale.toUpperCase()}
    </Button>
  );
}
