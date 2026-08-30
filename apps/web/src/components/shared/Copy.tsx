import dayjs from 'dayjs';
import { useTranslation } from 'react-i18next';

export function Copy() {
  const { t } = useTranslation('common');

  return (
    <div className="flex flex-col items-center gap-0.5">
      <p className="text-caption text-muted text-center">
        {t('footer.copyright', { year: dayjs().year(), appName: t('appName') })}
      </p>
      <p className="text-caption text-primary text-center">{t('footer.developedBy')}</p>
    </div>
  );
}
