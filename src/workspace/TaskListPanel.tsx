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
  const [openCategories, setOpenCategories] = useState<string[]>([]);

  // 默认展开第一个分类，或者展开当前选中任务所在的分类
  useEffect(() => {
    const newOpenCategories: string[] = [];
    if (tasks.length > 0) {
      // 默认展开第一个
      newOpenCategories.push(tasks[0].categoryName);
    }
    if (selectedTask) {
      const parentCategory = tasks.find(cat => cat.tasks.some(t => t.id === selectedTask.id));
      if (parentCategory && !newOpenCategories.includes(parentCategory.categoryName)) {
        // 如果选中任务的分类不在已展开列表中，也把它加进去
        newOpenCategories.push(parentCategory.categoryName);
      }
    }
    setOpenCategories(newOpenCategories);
  }, [tasks, selectedTask]); // 依赖 tasks 和 selectedTask

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