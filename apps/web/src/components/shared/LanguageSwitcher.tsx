'use client';
import { useEffect } from 'react';
import { Button } from 'antd';
import { Languages } from 'lucide-react';
import i18n from '@/lib/i18n/config';
import { useLocaleStore } from '@/lib/stores/locale.store';

interface LanguageSwitcherProps {
  block?: boolean;
  className?: string;
}

export function LanguageSwitcher({ block, className = 'px-1' }: LanguageSwitcherProps = {}) {
  const locale = useLocaleStore((s) => s.locale);
  const setLocale = useLocaleStore((s) => s.setLocale);

  useEffect(() => {
    if (i18n.language !== locale) i18n.changeLanguage(locale);
  }, [locale]);

  const toggle = () => setLocale(locale === 'es' ? 'en' : 'es');

  return (
    <Button
      type="text"
      block={block}
      icon={<Languages size={16} />}
      onClick={toggle}
      className={className}
    >
      {locale.toUpperCase()}
    </Button>
  );
}
