import { useState } from 'react';
import { List, ListItemButton, ListItemText, Collapse, Typography, Box } from '@mui/material';
import { ExpandLess, ExpandMore } from '@mui/icons-material';
import type { Category, Task } from '../data/types';

interface TaskListPanelProps {
  tasks: Category[];
  selectedTask: Task | null;
  onSelectTask: (taskId: string) => void;
}

// 任务状态对应的颜色
const statusColors: { [key: string]: string } = {
  '待处理': '#f44336', // 红色
  '部分完成': '#ff9800', // 橙色
  '已完成': '#4caf50', // 绿色
  '错误': '#f44336',
  '未知': '#9e9e9e', // 灰色
};

export const TaskListPanel = ({ tasks, selectedTask, onSelectTask }: TaskListPanelProps) => {
  const [openCategories, setOpenCategories] = useState<string[]>([]);

  const handleCategoryClick = (categoryName: string) => {
    setOpenCategories(prev =>
      prev.includes(categoryName)
        ? prev.filter(name => name !== categoryName)
        : [...prev, categoryName]
    );
  };

  if (!tasks || tasks.length === 0) {
    return (
      <Box sx={{ p: 2, textAlign: 'center' }}>
        <Typography>没有可用的数据</Typography>
      </Box>
    );
  }

  return (
    <List dense>
      <ListItemText primary="任务列表" sx={{ px: 2, mb: 1 }} />
      {tasks.map(category => (
        <div key={category.categoryName}>
          <ListItemButton onClick={() => handleCategoryClick(category.categoryName)}>
            <ListItemText primary={category.categoryName} />
            {openCategories.includes(category.categoryName) ? <ExpandLess /> : <ExpandMore />}
          </ListItemButton>
          <Collapse in={openCategories.includes(category.categoryName)} timeout="auto" unmountOnExit>
            <List component="div" disablePadding dense>
              {category.tasks.map(task => (
                <ListItemButton
                  key={task.id}
                  selected={selectedTask?.id === task.id}
                  onClick={() => onSelectTask(task.id)}
                  sx={{ pl: 4 }}
                >
                  <ListItemText
                    primary={task.video}
                    secondary={
                      <Box component="span" sx={{ display: 'flex', alignItems: 'center' }}>
                        <Box
                          component="span"
                          sx={{
                            width: 8,
                            height: 8,
                            borderRadius: '50%',
                            backgroundColor: statusColors[task.status] || statusColors['未知'],
                            mr: 1,
                          }}
                        />
                        {task.status}
                      </Box>
                    }
                  />
                </ListItemButton>
              ))}
            </List>
          </Collapse>
        </div>
      ))}
    </List>
  );
};