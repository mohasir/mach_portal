import type { ModalProps } from 'antd';

// The permission matrix needs more room than the default form modal on larger screens.
export const ROLE_MODAL_WIDTH: ModalProps['width'] = { xs: '94%', md: 720, xl: 880 };
