import type { FC } from 'react';

export interface ToastMessage {
  id: number;
  message: string;
  type: 'success' | 'error' | 'info';
}

const Toast: FC<{ message: ToastMessage }> = ({ message }) => (
  <div className={`toast toast-${message.type}`} role="alert">
    {message.type === 'success' && '✓ '}
    {message.type === 'error' && '✕ '}
    {message.message}
  </div>
);

export default Toast;
