import { Chip } from '@mui/material';
import type { Task } from '../App'; // Task 类型将从 App.tsx 导入

interface StatusChipProps {
  status: Task['status'];
}

export const StatusChip = ({ status }: StatusChipProps) => {
  const getColor = ():
    | 'default'
    | 'primary'
    | 'secondary'
    | 'error'
    | 'info'
    | 'success'
    | 'warning' => {
    switch (status) {
      case '已完成':
        return 'success';
      case '部分完成':
        return 'warning';
      case '错误':
        return 'error';
      case '待处理':
      default:
        return 'info';
    }
  };

  return <Chip label={status} color={getColor()} size="small" />;
};