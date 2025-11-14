import { useState, useEffect, useCallback } from 'react';
import { ThemeProvider, createTheme, CssBaseline, Box, CircularProgress, Typography } from '@mui/material';
import { io } from 'socket.io-client';
import { AppLayout } from './layout/AppLayout';
import { Login } from './auth/Login'; // 新增
import apiClient from './api'; // 新增
import type { Annotation, Task, Category } from './data/types';

const API_URL = import.meta.env.VITE_API_URL || 'https://sign-annotation-tool.onrender.com';

const socket = io(API_URL);

const darkTheme = createTheme({
  palette: {
    mode: 'dark',
  },
});

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(!!localStorage.getItem('authToken')); // 新增
  const [taskCategories, setTaskCategories] = useState<Category[]>([]);
  const [allAnnotations, setAllAnnotations] = useState<Annotation[]>([]);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [editingAnnotations, setEditingAnnotations] = useState<Annotation[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const fetchAllData = useCallback(async () => {
    // 只有在认证通过后才执行
    if (!isAuthenticated) return;
    try {
      const [tasksResponse, annotationsResponse] = await Promise.all([
        apiClient.get('/api/tasks'),
        apiClient.get('/api/annotations'),
      ]);

      const categories: Category[] = tasksResponse.data;
      const annotations: Annotation[] = annotationsResponse.data;

      setTaskCategories(categories);
      setAllAnnotations(annotations);
      setError(null);
    } catch (e: any) {
      setError(e.message);
      console.error("获取数据时出错:", e);
    } finally {
      setIsLoading(false);
    }
  }, [isAuthenticated]); // 依赖 isAuthenticated

  useEffect(() => {
    // 认证状态变化时触发数据获取
    if (isAuthenticated) {
      setIsLoading(true);
      fetchAllData();

      socket.on('connect', () => console.log('已连接到 WebSocket 服务器'));
      socket.on('annotations_updated', () => {
        console.log('收到标注更新通知，重新获取数据...');
        fetchAllData();
      });

      return () => {
        socket.off('connect');
        socket.off('annotations_updated');
      };
    }
  }, [fetchAllData, isAuthenticated]);

  const handleLoginSuccess = () => {
    setIsAuthenticated(true);
  };

  const handleSelectTask = (taskId: string) => {
    const task = taskCategories.flatMap(cat => cat.tasks).find(t => t.id === taskId);
    if (task) {
      setSelectedTask(task);
      const taskAnnotations = allAnnotations.filter(a => a.taskId === taskId);
      setEditingAnnotations(taskAnnotations);
    } else {
      setSelectedTask(null);
      setEditingAnnotations([]);
    }
  };

  const handleGenerateDefaultAnnotations = (task: Task, videoDuration: number) => {
    // 只要任务是“已完成”状态，就直接返回，绝不生成默认标注。
    // 这样可以防止异步状态更新问题导致已保存的标注被覆盖。
    if (task.status === '已完成') {
      return;
    }

    const glossCount = task.glosses.length;
    if (glossCount === 0) {
      setEditingAnnotations([]);
      return;
    }
    
    const segmentDuration = videoDuration / glossCount;
    const defaultAnnotations: Annotation[] = task.glosses.map((gloss, index) => ({
      id: `temp_${task.id}_${index}`,
      taskId: task.id,
      gloss: gloss,
      startTime: index * segmentDuration,
      endTime: (index + 1) * segmentDuration,
    }));
    
    if (defaultAnnotations.length > 0) {
      defaultAnnotations[defaultAnnotations.length - 1].endTime = videoDuration;
    }

    setEditingAnnotations(defaultAnnotations);
  };

  const handleSaveAnnotations = async (taskId: string, annotationsToSave: Annotation[]) => {
    setIsSubmitting(true);
    try {
        // 关键修复：在保存前，为所有标注生成新的、永久的ID
      const annotationsWithPermanentIds = annotationsToSave.map(anno => ({
        ...anno,
        id: `anno_${Date.now()}_${Math.random()}`
      }));
      // 1. 先删除旧的标注
      await apiClient.delete(`/api/tasks/${taskId}/annotations`);
      
      // 2. 导入新的标注
      await apiClient.post('/api/annotations/import', annotationsWithPermanentIds);

      // 3. 更新任务状态
      await handleUpdateTaskStatus(taskId, '已完成');
      
      // 4. 重新获取所有数据以确保UI同步
      await fetchAllData();

    } catch (error) {
      console.error('保存标注失败:', error);
      setError('保存标注失败，请稍后重试。');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteAnnotations = async (taskId: string, status: Task['status']) => {
    setIsSubmitting(true);
    try {
      if (status === '已完成') {
        await apiClient.delete(`/api/tasks/${taskId}/annotations`);
      }
      // 统一将状态更新为“待处理”
      await handleUpdateTaskStatus(taskId, '待处理');
      
      // 重新获取所有数据
      await fetchAllData();

      // 如果删除的是当前选中的任务，则清空编辑区
      if (selectedTask?.id === taskId) {
        setEditingAnnotations([]); // 直接清空即可
      }
    } catch (error) {
      console.error('删除或重置标注失败:', error);
      setError('操作失败，请稍后重试。');
    } finally {
      setIsSubmitting(false);
    }
  };

  // const handleImportAnnotations = async (importedAnnotations: Annotation[]) => {
  //   await fetch(`${API_URL}/api/annotations/import`, {
  //     method: 'POST',
  //     headers: { 'Content-Type': 'application/json' },
  //     body: JSON.stringify(importedAnnotations),
  //   });
  // };

  const handleUpdateTaskStatus = async (taskId: string, newStatus: Task['status']) => {
    try {
      await apiClient.put(`/api/tasks/${taskId}/status`, { status: newStatus });
    } catch (error) {
      console.error('更新任务状态失败:', error);
      // 可以在这里向上抛出错误，以便调用者知道失败了
      throw error;
    }
  };

  // 新增：如果未认证，则显示登录页面
  if (!isAuthenticated) {
    return (
      <ThemeProvider theme={darkTheme}>
        <CssBaseline />
        <Login onLoginSuccess={handleLoginSuccess} />
      </ThemeProvider>
    );
  }

  if (isLoading) {
    return (
      <ThemeProvider theme={darkTheme}>
        <CssBaseline />
        <Box display="flex" justifyContent="center" alignItems="center" height="100vh">
          <CircularProgress />
          <Typography variant="h6" color="textSecondary" style={{ marginLeft: 16 }}>
            正在加载，请稍候...
          </Typography>
        </Box>
      </ThemeProvider>
    );
  }

  if (error) {
    return (
      <ThemeProvider theme={darkTheme}>
        <CssBaseline />
        <Box display="flex" flexDirection="column" alignItems="center" justifyContent="center" height="100vh">
          <Typography variant="h6" color="error">
            错误: {error}
          </Typography>
          <Typography variant="body1" color="textSecondary" align="center" style={{ maxWidth: 600, marginTop: 16 }}>
            请检查您的网络连接，或稍后重试。如果问题仍然存在，请联系管理员。
          </Typography>
        </Box>
      </ThemeProvider>
    );
  }

  return (
    <ThemeProvider theme={darkTheme}>
      <CssBaseline />
      <AppLayout
        taskCategories={taskCategories}
        selectedTask={selectedTask}
        onTaskSelect={handleSelectTask}
        allAnnotations={allAnnotations}
        onSaveAnnotations={handleSaveAnnotations}
        onDeleteAnnotations={handleDeleteAnnotations}
        editingAnnotations={editingAnnotations}
        onEditingAnnotationsChange={setEditingAnnotations}
        onGenerateDefaultAnnotations={handleGenerateDefaultAnnotations}
        onUpdateTaskStatus={handleUpdateTaskStatus}
        isSubmitting={isSubmitting}
      />
    </ThemeProvider>
  );
}

export default App;