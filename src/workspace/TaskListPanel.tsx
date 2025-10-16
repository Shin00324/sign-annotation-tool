import React, { useState, useEffect } from 'react';
import {
  List,
  ListItemButton,
  ListItemText,
  Collapse,
  ListSubheader,
  Box,
  Typography,
} from '@mui/material';
import { ExpandLess, ExpandMore } from '@mui/icons-material';
import type { Category, Task } from '../App';
import { StatusChip } from './StatusChip';

interface TaskListPanelProps {
  tasks: Category[];
  selectedTask: Task | null;
  onSelectTask: (taskId: string) => void;
}

export function TaskListPanel({
  tasks,
  selectedTask,
  onSelectTask,
}: TaskListPanelProps) {
  const [openCategories, setOpenCategories] = useState<string[]>(() => {
    // 初始化时，如果任务列表不为空，默认展开第一个
    return tasks.length > 0 ? [tasks[0].categoryName] : [];
  });

  // **关键修改**: 调整 useEffect 逻辑
  useEffect(() => {
    if (selectedTask) {
      // 找到选中任务所属的大类
      const parentCategory = tasks.find(cat => cat.tasks.some(t => t.id === selectedTask.id));
      
      if (parentCategory) {
        // 使用函数式更新，以获取最新的 openCategories 状态
        setOpenCategories(prevOpen => {
          // 如果该大类尚未展开，则将其加入展开列表
          if (!prevOpen.includes(parentCategory.categoryName)) {
            return [...prevOpen, parentCategory.categoryName];
          }
          // 如果已经展开，则保持不变
          return prevOpen;
        });
      }
    }
  }, [selectedTask, tasks]); // 依赖 selectedTask 和 tasks

  const handleCategoryClick = (categoryName: string) => {
    setOpenCategories(prevOpen => {
      if (prevOpen.includes(categoryName)) {
        return prevOpen.filter(name => name !== categoryName); // 如果已展开，则关闭
      } else {
        return [...prevOpen, categoryName]; // 如果未展开，则展开
      }
    });
  };

  if (tasks.length === 0) {
    return <Box sx={{ p: 2 }}><Typography>没有可用的任务。</Typography></Box>;
  }

  return (
    <List
      sx={{ width: '100%', bgcolor: 'background.paper' }}
      component="nav"
      subheader={<ListSubheader component="div">任务列表</ListSubheader>}
    >
      {tasks.map((category) => (
        <React.Fragment key={category.categoryName}>
          <ListItemButton onClick={() => handleCategoryClick(category.categoryName)}>
            <ListItemText primary={category.categoryName} />
            {openCategories.includes(category.categoryName) ? <ExpandLess /> : <ExpandMore />}
          </ListItemButton>
          <Collapse in={openCategories.includes(category.categoryName)} timeout="auto" unmountOnExit>
            <List component="div" disablePadding>
              {category.tasks.map((task) => (
                <ListItemButton
                  key={task.id}
                  selected={selectedTask?.id === task.id}
                  onClick={() => onSelectTask(task.id)}
                  sx={{ pl: 4 }}
                >
                  <ListItemText
                    primary={task.video}
                    secondary={<StatusChip status={task.status} />}
                  />
                </ListItemButton>
              ))}
            </List>
          </Collapse>
        </React.Fragment>
      ))}
    </List>
  );
}