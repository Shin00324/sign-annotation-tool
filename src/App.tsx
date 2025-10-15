import React, { useState, useEffect, useCallback } from 'react';
import { io } from 'socket.io-client';
import { AppLayout } from './layout/AppLayout';
import type { Annotation } from './data/annotations';
import { ThemeProvider, createTheme, CssBaseline } from '@mui/material';

const API_URL = 'http://localhost:3001';
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
  const [selectedGloss, setSelectedGloss] = useState<string | null>(null);
  // **新增状态**: 用于追踪正在被微调的标注
  const [selectedAnnotationForEdit, setSelectedAnnotationForEdit] = useState<Annotation | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchAllData = useCallback(async () => {
    setError(null);
    try {
      const [tasksResponse, annotationsResponse] = await Promise.all([
        fetch(`${API_URL}/api/tasks`),
        fetch(`${API_URL}/api/annotations`),
      ]);

      if (!tasksResponse.ok || !annotationsResponse.ok) {
        throw new Error('从服务器获取数据失败。');
      }

      const tasksData: Category[] = await tasksResponse.json();
      const annotationsData: Annotation[] = await annotationsResponse.json();

      setTaskCategories(tasksData);
      setAllAnnotations(annotationsData);

      setSelectedTask(prevSelectedTask => {
        if (!prevSelectedTask) return null;
        const updatedTask = tasksData
          .flatMap(cat => cat.tasks)
          .find(t => t.id === prevSelectedTask.id);
        return updatedTask || null;
      });

    } catch (e: any) {
      setError(e.message);
      console.error("获取数据时出错:", e);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    setIsLoading(true);
    fetchAllData();

    socket.on('connect', () => console.log('已连接到 WebSocket 服务器'));
    socket.on('annotations_updated', () => {
      console.log('收到标注更新事件，正在后台重新获取数据...');
      fetchAllData();
    });

    return () => {
      socket.off('connect');
      socket.off('annotations_updated');
    };
  }, [fetchAllData]);

  const handleSelectTask = (taskId: string) => {
    const task = taskCategories.flatMap(cat => cat.tasks).find(t => t.id === taskId);
    if (task) {
      setSelectedTask(task);
      setSelectedGloss(null);
      setSelectedAnnotationForEdit(null); // 切换任务时，取消微调状态
    }
  };

  const handleAddAnnotation = useCallback((annotation: Omit<Annotation, 'id' | 'taskId'>) => {
    if (!selectedTask) return;

    const newAnnotation = {
      ...annotation,
      taskId: selectedTask.id,
      id: `anno_${Date.now()}`
    };
    
    setAllAnnotations(currentAnnotations => [...currentAnnotations, newAnnotation]);

    fetch(`${API_URL}/api/annotations`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newAnnotation),
    }).catch(error => {
      console.error("添加标注失败:", error);
      setAllAnnotations(currentAnnotations => currentAnnotations.filter(a => a.id !== newAnnotation.id));
    });
  }, [selectedTask]);

  // **新增功能**: 处理标注更新的函数
  const handleUpdateAnnotation = async (annotationId: string, updates: Partial<Pick<Annotation, 'startTime' | 'endTime'>>) => {
    // 乐观更新UI
    setAllAnnotations(prev => prev.map(anno =>
      anno.id === annotationId ? { ...anno, ...updates } : anno
    ));

    // 将更新发送到服务器
    await fetch(`${API_URL}/api/annotations/${annotationId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates),
    });
    // 后续由 socket.io 的 'annotations_updated' 事件来保证最终数据一致性
  };

  const handleDeleteAnnotation = async (annotationId: string) => {
    setAllAnnotations(prev => prev.filter(a => a.id !== annotationId));
    await fetch(`${API_URL}/api/annotations/${annotationId}`, { method: 'DELETE' });
  };

  const handleImportAnnotations = async (importedAnnotations: Annotation[]) => {
    await fetch(`${API_URL}/api/annotations/import`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(importedAnnotations),
    });
  };

  const annotationsForSelectedTask = selectedTask
    ? allAnnotations.filter(a => a.taskId === selectedTask.id)
    : [];

  if (isLoading) return <div>正在加载...</div>;
  if (error) return <div>错误: {error}</div>;

  return (
    <ThemeProvider theme={darkTheme}>
      <CssBaseline />
      <AppLayout
        taskCategories={taskCategories}
        selectedTask={selectedTask}
        onTaskSelect={handleSelectTask}
        selectedGloss={selectedGloss}
        onGlossSelect={setSelectedGloss}
        annotations={annotationsForSelectedTask}
        allAnnotations={allAnnotations}
        onAddAnnotation={handleAddAnnotation}
        onDeleteAnnotation={handleDeleteAnnotation}
        onImportAnnotations={handleImportAnnotations}
        // **新增属性**: 将状态和处理函数传递下去
        selectedAnnotationForEdit={selectedAnnotationForEdit}
        onSelectAnnotationForEdit={setSelectedAnnotationForEdit}
        onUpdateAnnotation={handleUpdateAnnotation}
      />
    </ThemeProvider>
  );
}

export default App;