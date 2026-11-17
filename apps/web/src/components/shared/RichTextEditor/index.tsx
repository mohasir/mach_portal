'use client';
import dynamic from 'next/dynamic';
import { Skeleton } from 'antd';

export type { RichTextEditorProps } from './RichTextEditorField';

// The editor needs the DOM and is heavy, so it loads in the browser only, after the page.
export const RichTextEditor = dynamic(
  () => import('./RichTextEditorField').then((mod) => mod.RichTextEditorField),
  { ssr: false, loading: () => <Skeleton.Input active block className="h-24!" /> },
);
