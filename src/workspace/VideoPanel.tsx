import { useRef, useState, useEffect, useCallback } from 'react';
import { Box, Paper, Typography, Button } from '@mui/material';
import { Save, Trash2 } from 'lucide-react';
import type { Annotation, Task } from '../data/types';
import { TimelineEditor } from './TimelineEditor';
import React from 'react';

const R2_BASE_URL = "https://pub-1614b7bb5b3540b9898ae99f84787635.r2.dev/";

const getVideoUrl = (videoPath: string) => {
  if (videoPath.startsWith('http')) return videoPath;
  return `${R2_BASE_URL.replace(/\/$/, '')}/${videoPath}`;
};

interface VideoPanelProps {
  task: Task | null;
  onSaveAnnotations: (taskId: string, annotations: Annotation[]) => void;
  onDeleteAnnotations: (taskId: string, status: Task['status']) => void;
  annotations: Annotation[];
  onAnnotationsChange: React.Dispatch<React.SetStateAction<Annotation[]>>;
  onGenerateDefaultAnnotations: (task: Task, duration: number) => void;
  onUpdateTaskStatus: (taskId: string, newStatus: Task['status']) => void;
  isSubmitting: boolean; // 新增
}

export const VideoPanel = ({ 
  task, 
  onSaveAnnotations,
  onDeleteAnnotations,
  annotations,
  onAnnotationsChange,
  onGenerateDefaultAnnotations,
  onUpdateTaskStatus,
  isSubmitting, // 新增
}: VideoPanelProps) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isDirty, setIsDirty] = useState(false);

  useEffect(() => {
    setIsDirty(false);
  }, [task]);

  const handleVideoMetadataLoaded = () => {
    if (videoRef.current && task) {
      onGenerateDefaultAnnotations(task, videoRef.current.duration);
    }
  };

  const handleSeek = useCallback((time: number) => {
    if (videoRef.current) {
      videoRef.current.currentTime = time;
    }
  }, []);

  const handleAnnotationsChange = (newAnnotations: Annotation[]) => {
    onAnnotationsChange(newAnnotations);
    if (!isDirty) {
      setIsDirty(true);
      if (task && task.status === '待处理') {
        onUpdateTaskStatus(task.id, '部分完成');
      }
    }
  };

  const handleSave = () => {
    if (task) {
      onSaveAnnotations(task.id, annotations);
      // alert 已被移除，因为现在有全局遮罩
      setIsDirty(false);
    }
  };

  const handleDelete = () => {
    if (task) {
      const confirmationText = task.status === '已完成'
        ? '确定要删除此任务的全部标注记录吗？该操作将重置任务状态为“待处理”，且不可恢复。'
        : '确定要重置此任务的状态为“待处理”吗？';
      
      if (window.confirm(confirmationText)) {
        onDeleteAnnotations(task.id, task.status);
      }
    }
  };

  return (
    <Paper elevation={2} sx={{ p: 2, width: '100%', display: "flex", flexDirection: "column" }}>
      <Typography variant="h6" gutterBottom sx={{ flexShrink: 0 }}>
        视频标注工作区
      </Typography>
      {task ? (
        <Box sx={{ display: 'flex', flexDirection: 'column', flexGrow: 1, minHeight: 0 }}>
          <Box sx={{ backgroundColor: '#000', mb: 2, flexShrink: 0 }}>
            <video
              ref={videoRef}
              controls
              width="100%"
              style={{ display: 'block', maxHeight: '60vh' }}
              key={task.id}
              src={getVideoUrl(task.video)}
              onLoadedMetadata={handleVideoMetadataLoaded}
            />
          </Box>

          <TimelineEditor
            duration={videoRef.current?.duration || 0}
            annotations={annotations}
            onAnnotationsChange={handleAnnotationsChange}
            onSeek={handleSeek}
          />

          <Box sx={{ mt: 'auto', pt: 2, display: 'flex', justifyContent: 'flex-end', gap: 2 }}>
            <Button
              variant="outlined"
              color="error"
              startIcon={<Trash2 />}
              onClick={handleDelete}
              disabled={!task || task.status === '待处理' || isSubmitting} // 更新禁用逻辑
            >
              删除标记
            </Button>
            <Button
              variant="contained"
              color="primary"
              startIcon={<Save />}
              onClick={handleSave}
              disabled={!isDirty || isSubmitting} // 更新禁用逻辑
            >
              标注完成
            </Button>
          </Box>
        </Box>
      ) : (
        <Box sx={{ display: "flex", justifyContent: "center", alignItems: "center", height: "100%" }}>
          <Typography>请在左侧选择一个任务以开始</Typography>
        </Box>
      )}
    </Paper>
  );
};