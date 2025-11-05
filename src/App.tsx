import { useState, useEffect, useCallback } from 'react';
import { io } from 'socket.io-client';
import { AppLayout } from './layout/AppLayout';
import { ThemeProvider, createTheme, CssBaseline } from '@mui/material';
import type { Annotation, Task, Category } from './data/types';

const API_URL = 'https://sign-annotation-tool.onrender.com';

const socket = io(API_URL);

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
  const [isSubmitting, setIsSubmitting] = useState(false); // 新增：用于在保存/删除时锁定UI

  const fetchAllData = useCallback(async () => {
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

      // 关键修复：确保在数据刷新后，selectedTask也得到更新
      setSelectedTask(prevSelectedTask => {
        if (!prevSelectedTask) return null;
        const updatedTask = tasksData
          .flatMap(cat => cat.tasks)
          .find(t => t.id === prevSelectedTask.id);
        return updatedTask || prevSelectedTask; // 如果找不到，保持之前的状态
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
      if (task.status === '已完成') {
        const savedAnnotations = allAnnotations.filter(a => a.taskId === taskId);
        setEditingAnnotations(savedAnnotations);
      } else {
        setEditingAnnotations([]);
      }
    } else {
      setSelectedTask(null);
      setEditingAnnotations([]);
    }
  };

  const handleGenerateDefaultAnnotations = (task: Task, videoDuration: number) => {
    if (task.status === '已完成' && editingAnnotations.length > 0) {
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
    setIsSubmitting(true); // 开始提交，锁定UI
    try {
      await fetch(`${API_URL}/api/tasks/${taskId}/annotations`, {
        method: 'DELETE',
      });

      const newAnnotationsWithRealIds = annotationsToSave.map(anno => ({
        ...anno,
        id: `anno_${Date.now()}_${Math.random()}`
      }));

      await fetch(`${API_URL}/api/annotations/import`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newAnnotationsWithRealIds),
      });
      
      await fetch(`${API_URL}/api/tasks/${taskId}/status`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: '已完成' }),
      });

      await fetchAllData(); // 主动刷新数据
      setEditingAnnotations([]);
    } catch (error) {
      console.error("保存标注时出错:", error);
      alert("保存失败，请检查网络连接或联系管理员。");
    } finally {
      setIsSubmitting(false); // 结束提交，解锁UI
    }
  };

  const handleDeleteAnnotations = async (taskId: string, status: Task['status']) => {
    if (status === '待处理') return;
    
    setIsSubmitting(true); // 开始删除，锁定UI
    try {
      if (status === '已完成') {
        await fetch(`${API_URL}/api/tasks/${taskId}/annotations`, {
          method: 'DELETE',
        });
      }

      await fetch(`${API_URL}/api/tasks/${taskId}/status`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: '待处理' }),
      });

      await fetchAllData(); // 主动刷新数据
      setEditingAnnotations([]);
    } catch (error) {
      console.error("删除标注时出错:", error);
      alert("删除失败，请检查网络连接或联系管理员。");
    } finally {
      setIsSubmitting(false); // 结束删除，解锁UI
    }
  };

  const handleImportAnnotations = async (importedAnnotations: Annotation[]) => {
    // ... (此函数内容不变)
  };

  const handleUpdateTaskStatus = (taskId: string, newStatus: Task['status']) => {
    setTaskCategories(prevCategories => {
      return prevCategories.map(category => ({
        ...category,
        tasks: category.tasks.map(task => 
          task.id === taskId ? { ...task, status: newStatus } : task
        ),
      }));
    });
  };

  if (isLoading) return <div>正在加载...</div>;
  if (error) return <div>错误: {error}</div>;

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
        onDeleteAnnotations={handleDeleteAnnotations}
        editingAnnotations={editingAnnotations}
        onEditingAnnotationsChange={setEditingAnnotations}
        onGenerateDefaultAnnotations={handleGenerateDefaultAnnotations}
        onUpdateTaskStatus={handleUpdateTaskStatus}
        isSubmitting={isSubmitting} // 传递新状态
      />
    </ThemeProvider>
  );
}

export default App;