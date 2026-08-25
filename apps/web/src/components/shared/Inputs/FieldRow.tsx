import type { ReactNode } from 'react';
import { Col, Row } from 'antd';
import { FieldLabel } from './FieldLabel';

interface FieldRowProps {
  title?: string;
  caption?: string;
  required?: boolean;
  label?: ReactNode;
  children: ReactNode;
}

export function FieldRow({ title, caption, required, label, children }: FieldRowProps) {
  return (
    <Row gutter={[16, 12]} align="top" className="mb-5">
      <Col xs={24} sm={19}>
        {label ?? <FieldLabel title={title} caption={caption} required={required} />}
      </Col>
      <Col xs={24} sm={5}>
        {children}
      </Col>
    </Row>
  );
}
