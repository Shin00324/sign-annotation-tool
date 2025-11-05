import { useState, useEffect, useCallback } from 'react';
import { ThemeProvider, createTheme, CssBaseline } from '@mui/material';
import { io } from 'socket.io-client';
import { AppLayout } from './layout/AppLayout';
import type { Annotation } from './data/annotations';

const API_URL = 'https://sign-annotation-tool.onrender.com'; // 指向云端后端进行开发

const socket = io(API_URL);

export interface Task {
  id: string;
  video: string;
  glosses: string[];
  status: '待处理' | '部分完成' | '已完成' | '错误' | '未知';
}

export interface Category {
  categoryName: string;
  tasks: Task[];
}

const darkTheme = createTheme({
  palette: {
    mode: 'dark',
  },
});

function App() {
  const [taskCategories, setTaskCategories] = useState<Category[]>([]);
  const [allAnnotations, setAllAnnotations] = useState<Annotation[]>([]);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [editingAnnotations, setEditingAnnotations] = useState<Annotation[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // **关键修复**: 移除 fetchAllData 对 selectedTask 的依赖，打破循环
  const fetchAllData = useCallback(async (currentTaskId: string | null) => {
    try {
      // 仅在初次加载时显示全局 loading
      if (!currentTaskId) {
        setIsLoading(true);
      }

      const [tasksResponse, annotationsResponse] = await Promise.all([
        fetch(`${API_URL}/api/tasks`),
        fetch(`${API_URL}/api/annotations`),
      ]);

      if (!tasksResponse.ok || !annotationsResponse.ok) {
        throw new Error('网络响应错误');
      }

      const tasksData: Category[] = await tasksResponse.json();
      const annotationsData: Annotation[] = await annotationsResponse.json();

      setTaskCategories(tasksData);
      setAllAnnotations(annotationsData);
      
      // 如果有已选中的任务，刷新它的信息
      if (currentTaskId) {
        const refreshedTask = tasksData.flatMap(c => c.tasks).find(t => t.id === currentTaskId);
        setSelectedTask(refreshedTask || null);
      }

    } catch (e: any) {
      setError(e.message);
      console.error("获取数据失败:", e);
    } finally {
      // 仅在初次加载时关闭全局 loading
      if (!currentTaskId) {
        setIsLoading(false);
      }
    }
  }, []); // **关键修复**: 移除依赖数组中的 selectedTask

  useEffect(() => {
    // 传入 null 表示是初次加载
    fetchAllData(null);

    const handleAnnotationsUpdated = () => {
      console.log('接收到 annotations_updated 事件，重新获取数据...');
      // 传入当前任务ID，避免全局loading
      fetchAllData(selectedTask?.id ?? null);
    };

    socket.on('connect', () => console.log('已连接到 WebSocket 服务器'));
    socket.on('annotations_updated', handleAnnotationsUpdated);

    return () => {
      socket.off('connect');
      socket.off('annotations_updated', handleAnnotationsUpdated);
    };
  }, [fetchAllData, selectedTask?.id]); // **关键修复**: 依赖 selectedTask.id 而不是整个对象

  const handleSelectTask = (taskId: string) => {
    const task = taskCategories.flatMap(cat => cat.tasks).find(t => t.id === taskId);
    if (!task) return;

    setSelectedTask(task);

    if (task.status === '已完成') {
      const savedAnnotations = allAnnotations.filter(anno => anno.taskId === taskId);
      const sortedAnnotations = savedAnnotations.sort((a, b) => 
        task.glosses.indexOf(a.gloss) - task.glosses.indexOf(b.gloss)
      );
      setEditingAnnotations(sortedAnnotations);
    } else {
      setEditingAnnotations([]);
    }
  };

  const handleGenerateDefaultAnnotations = (task: Task, videoDuration: number) => {
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
    try {
      await fetch(`${API_URL}/api/tasks/${taskId}/annotations`, {
        method: 'DELETE',
      });

      const newAnnotationsWithRealIds = annotationsToSave.map(anno => ({
        ...anno,
        id: `anno_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
      }));

      await fetch(`${API_URL}/api/annotations/import`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newAnnotationsWithRealIds),
      });
      
      await handleUpdateTaskStatus(taskId, '已完成');

      setAllAnnotations(prev => {
        const otherAnnotations = prev.filter(a => a.taskId !== taskId);
        return [...otherAnnotations, ...newAnnotationsWithRealIds];
      });

    } catch (error) {
      console.error("保存标注失败:", error);
      alert("保存失败，请检查网络连接或联系管理员。");
    }
  };

  const handleUpdateTaskStatus = async (taskId: string, status: Task['status']) => {
    setTaskCategories(prev =>
      prev.map(cat => ({
        ...cat,
        tasks: cat.tasks.map(t =>
          t.id === taskId ? { ...t, status: status } : t
        ),
      }))
    );

    try {
      await fetch(`${API_URL}/api/tasks/${taskId}/status`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: status }),
      });
    } catch (error) {
      console.error(`Failed to update status for task ${taskId}:`, error);
      fetchAllData(taskId); 
    }
  };

  const handleImportAnnotations = async (importedAnnotations: Annotation[]) => {
    await fetch(`${API_URL}/api/annotations/import`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(importedAnnotations),
    });
  };

  if (isLoading) return <ThemeProvider theme={darkTheme}><CssBaseline /><div style={{ padding: '20px' }}>正在加载数据...</div></ThemeProvider>;
  if (error) return <ThemeProvider theme={darkTheme}><CssBaseline /><div style={{ padding: '20px', color: 'red' }}>错误: {error}</div></ThemeProvider>;

  return (
    <ThemeProvider theme={darkTheme}>
      <CssBaseline />
      <AppLayout
        taskCategories={taskCategories}
        selectedTask={selectedTask}
        onTaskSelect={handleSelectTask}
        allAnnotations={allAnnotations}
        onImportAnnotations={handleImportAnnotations}
        onSaveAnnotations={handleSaveAnnotations}
        editingAnnotations={editingAnnotations}
        onEditingAnnotationsChange={setEditingAnnotations}
        onGenerateDefaultAnnotations={handleGenerateDefaultAnnotations}
        onUpdateTaskStatus={handleUpdateTaskStatus}
      />
    </ThemeProvider>
  );
}

export default App;