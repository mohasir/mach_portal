'use client';
import { Progress } from 'antd';
import type { UploadFile } from 'antd';
import { Check, FileText, Image as ImageIcon, X } from 'lucide-react';

interface AttachmentUploadItemProps {
  file: UploadFile;
  onRemove: () => void;
}

export function AttachmentUploadItem({ file, onRemove }: AttachmentUploadItemProps) {
  const isImage = (file.type ?? '').startsWith('image/');
  const isDone = file.status === 'done';
  const isError = file.status === 'error';
  const percent = Math.round(file.percent ?? 0);

  return (
    <div className="border-line flex items-center gap-3 border-t py-3 first:border-t-0">
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded bg-gray-100 text-gray-500">
        {isImage ? <ImageIcon size={16} /> : <FileText size={16} />}
      </span>
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-medium">{file.name}</div>
        <div className="flex items-center gap-2">
          <Progress
            percent={percent}
            size="small"
            showInfo={false}
            status={isError ? 'exception' : undefined}
            className="mb-0 flex-1"
          />
          {!isDone && (
            <span className="w-9 shrink-0 text-right text-xs text-gray-500">{percent}%</span>
          )}
        </div>
      </div>
      {isDone ? (
        <Check size={16} className="shrink-0 text-green-600" />
      ) : (
        <button
          type="button"
          onClick={onRemove}
          className="shrink-0 text-gray-400 hover:text-red-600"
        >
          <X size={16} />
        </button>
      )}
    </div>
  );
}
