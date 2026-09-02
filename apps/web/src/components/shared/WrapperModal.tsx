'use client';
import { Modal, type ModalProps } from 'antd';
import { TbX } from 'react-icons/tb';
import { IconBadge } from './IconBadge';

export function WrapperModal({ classNames, closeIcon, ...props }: ModalProps) {
  return (
    <Modal
      footer={null}
      centered
      width={{ xs: '90%', md: 520 }}
      closeIcon={
        closeIcon ?? (
          <IconBadge
            icon={TbX}
            shape="square"
            badgeSize="sm"
            className="bg-primary/10 text-primary"
            rounded="rounded-lg"
          />
        )
      }
      classNames={{ container: 'rounded-3xl!', header: 'mb-4', ...classNames }}
      {...props}
    />
  );
}
