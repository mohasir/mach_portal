'use client';
import { useRef, useState } from 'react';
import { Button, Carousel, ConfigProvider, Tag } from 'antd';
import type { CarouselRef } from 'antd/es/carousel';
import { useTranslation } from 'react-i18next';
import type { AppLocale } from '@repo/schemas';
import { WrapperModal } from '@/components/shared/WrapperModal';
import { MB } from '@/theme/antd';
import type { ReleaseNote } from '../types';
import { ReleaseNoteHero } from './ReleaseNoteHero';

interface ReleaseNotesModalProps {
  note: ReleaseNote;
  locale: AppLocale;
  onDone: () => void;
}

export function ReleaseNotesModal({ note, locale, onDone }: ReleaseNotesModalProps) {
  const { t } = useTranslation('releaseNotes');
  const carousel = useRef<CarouselRef>(null);
  const [index, setIndex] = useState(0);

  const total = note.slides.length;
  const isFirst = index === 0;
  const isLast = index === total - 1;

  return (
    <WrapperModal
      open
      width={{ xs: '90%', md: 480 }}
      closable={false}
      onCancel={onDone}
      title={
        <div className="flex items-center justify-between gap-2 h-6">
          <div className="flex items-center gap-2">
            <span>{t('title')}</span>
            <Tag>{t('version', { version: note.version })}</Tag>
          </div>
          {!isLast && (
            <Button type="text" size="small" onClick={onDone}>
              {t('skip')}
            </Button>
          )}
        </div>
      }
    >
      {/* Carousel paints its dots with colorBgContainer (white), invisible on the white modal. */}
      <ConfigProvider theme={{ components: { Carousel: { colorBgContainer: MB.olive } } }}>
        <Carousel
          ref={carousel}
          dots={total > 1}
          infinite={false}
          beforeChange={(_, next) => setIndex(next)}
          className={total > 1 ? 'pb-6' : undefined}
        >
          {note.slides.map((slide, slideIndex) => (
            <div key={slideIndex}>
              <div className="flex flex-col gap-4">
                {slide.icon && <ReleaseNoteHero icon={slide.icon} />}
                <div className="flex min-h-24 flex-col gap-2 text-center">
                  <h3 className="m-0 text-lg font-semibold">{slide.title[locale]}</h3>
                  <p className="mb-2 text-sm text-gray-500">{slide.description[locale]}</p>
                </div>
              </div>
            </div>
          ))}
        </Carousel>
      </ConfigProvider>

      <div className="mt-2 flex gap-2">
        {total > 1 && (
          <Button className="flex-1" disabled={isFirst} onClick={() => carousel.current?.prev()}>
            {t('back')}
          </Button>
        )}
        <Button
          className="flex-1"
          type="primary"
          onClick={() => (isLast ? onDone() : carousel.current?.next())}
        >
          {isLast ? t('continue') : t('next')}
        </Button>
      </div>
    </WrapperModal>
  );
}
