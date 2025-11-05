import { Chip } from '@mui/material';
import type { Task } from '../data/types'; // **关键修改**

const statusConfig: {
  [key in Task['status']]: { label: string; color: 'success' | 'warning' | 'error' | 'default' };
} = {
  '已完成': { label: '已完成', color: 'success' },
  '部分完成': { label: '进行中', color: 'warning' },
  '待处理': { label: '待处理', color: 'error' },
  '错误': { label: '错误', color: 'error' },
  '未知': { label: '未知', color: 'default' },
};

interface StatusChipProps {
  status: Task['status'];
}

export const StatusChip = ({ status }: StatusChipProps) => {
  const config = statusConfig[status] || statusConfig['未知'];
  return <Chip label={config.label} color={config.color} size="small" />;
};