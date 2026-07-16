'use client';
import { Card } from 'antd';
import type { QuoteCard as QuoteCardType } from '../../types';
import { QuoteCardBody } from './QuoteCardBody';

interface QuoteCardPreviewProps {
  card: QuoteCardType;
}

export function QuoteCardPreview({ card }: QuoteCardPreviewProps) {
  return (
    <Card size="small" className="shadow-lg">
      <QuoteCardBody card={card} />
    </Card>
  );
}
