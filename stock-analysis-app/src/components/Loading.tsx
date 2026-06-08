import React from 'react';
import { Spin, Alert, Empty, Button } from 'antd';
import { LoadingOutlined } from '@ant-design/icons';

interface LoadingSpinnerProps {
  tip?: string;
}

export function LoadingSpinner({ tip = '加载中...' }: LoadingSpinnerProps) {
  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        minHeight: 400,
        flexDirection: 'column',
      }}
    >
      <Spin indicator={<LoadingOutlined style={{ fontSize: 48 }} spin />} />
      <p style={{ marginTop: 16, color: '#999' }}>{tip}</p>
    </div>
  );
}

interface ErrorStateProps {
  message: string;
  onRetry?: () => void;
}

export function ErrorState({ message, onRetry }: ErrorStateProps) {
  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        minHeight: 400,
      }}
    >
      <Alert
        message="出错了"
        description={message}
        type="error"
        showIcon
        action={
          onRetry ? (
            <Button size="small" danger onClick={onRetry}>
              重试
            </Button>
          ) : undefined
        }
        style={{ maxWidth: 400 }}
      />
    </div>
  );
}

interface EmptyStateProps {
  description?: string;
}

export function EmptyState({ description = '暂无数据' }: EmptyStateProps) {
  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        minHeight: 400,
      }}
    >
      <Empty description={description} />
    </div>
  );
}
