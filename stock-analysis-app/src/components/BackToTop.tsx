import React from 'react';
import { FloatButton } from 'antd';
import { VerticalAlignTopOutlined } from '@ant-design/icons';

export default function BackToTop() {
  return (
    <FloatButton.BackTop
      icon={<VerticalAlignTopOutlined />}
      type="primary"
      tooltip="回到顶部"
      visibilityHeight={400}
      style={{ right: 24, bottom: 24 }}
    />
  );
}
