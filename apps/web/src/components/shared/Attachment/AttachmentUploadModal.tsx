'use client';
import { useState } from 'react';
import type { ReactNode } from 'react';
import { App, Modal, Upload } from 'antd';
import type { UploadFile, UploadProps } from 'antd';
import { UploadCloud } from 'lucide-react';
import { ATTACHMENT_ALLOWED_MIME_TYPES, ATTACHMENT_MAX_SIZE_BYTES } from '@repo/schemas';
import { AttachmentUploadItem } from './AttachmentUploadItem';

interface AttachmentUploadModalProps {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  dragText: ReactNode;
  hintText: (maxSizeMb: number) => ReactNode;
  invalidTypeMessage: string;
  tooLargeMessage: string;
  action: string;
  onUploaded?: (response: unknown) => void;
  onUploadError?: (errorCode: string | undefined) => void;
  accept?: readonly string[];
  maxSizeBytes?: number;
  multiple?: boolean;
}

export function AttachmentUploadModal({
  open,
  onClose,
  title,
  dragText,
  hintText,
  invalidTypeMessage,
  tooLargeMessage,
  action,
  onUploaded,
  onUploadError,
  accept = ATTACHMENT_ALLOWED_MIME_TYPES,
  maxSizeBytes = ATTACHMENT_MAX_SIZE_BYTES,
  multiple = true,
}: AttachmentUploadModalProps) {
  const { message } = App.useApp();
  const [fileList, setFileList] = useState<UploadFile[]>([]);
  const maxSizeMb = Math.round(maxSizeBytes / (1024 * 1024));

  const onChange: UploadProps['onChange'] = (info) => {
    setFileList(info.fileList);
    if (info.file.status === 'done') {
      onUploaded?.(info.file.response);
    } else if (info.file.status === 'error') {
      const body = info.file.response as { errorCode?: string } | undefined;
      onUploadError?.(body?.errorCode);
    }
  };

  return (
    <Modal
      open={open}
      onCancel={onClose}
      title={title}
      footer={null}
      afterClose={() => setFileList([])}
    >
      {open && (
        <Upload.Dragger
          name="file"
          action={action}
          withCredentials
          multiple={multiple}
          fileList={fileList}
          onChange={onChange}
          itemRender={(_originNode, file, _fileList, { remove }) => (
            <AttachmentUploadItem file={file} onRemove={remove} />
          )}
          beforeUpload={(file) => {
            if (!accept.includes(file.type)) {
              message.error(invalidTypeMessage);
              return Upload.LIST_IGNORE;
            }
            if (file.size > maxSizeBytes) {
              message.error(tooLargeMessage);
              return Upload.LIST_IGNORE;
            }
            return true;
          }}
        >
          <p className="text-brown flex justify-center">
            <UploadCloud size={32} />
          </p>
          <p className="ant-upload-text">{dragText}</p>
          <p className="ant-upload-hint">{hintText(maxSizeMb)}</p>
        </Upload.Dragger>
      )}
    </Modal>
  );
}
