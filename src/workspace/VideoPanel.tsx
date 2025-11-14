import React, { useRef, useEffect, useState, useCallback } from 'react';
import { Paper, Typography, Box, Button, CircularProgress } from '@mui/material';
import { Save, Trash2 } from 'lucide-react';
import { TimelineEditor } from './TimelineEditor';
import type { Annotation, Task } from '../data/types';
import apiClient from '../api'; // 新增

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
  const [videoUrl, setVideoUrl] = useState<string | null>(null); // 新增
  const [videoLoading, setVideoLoading] = useState(false); // 新增
  const [videoError, setVideoError] = useState<string | null>(null); // 新增

  useEffect(() => {
    setIsDirty(false);
    setVideoUrl(null); // 任务切换时清空旧的视频URL
    setVideoError(null);

    if (task) {
      setVideoLoading(true);
      apiClient.get(`/api/signed-video-url/${task.id}`)
        .then(response => {
          setVideoUrl(response.data.url);
        })
        .catch(error => {
          console.error("获取视频URL失败:", error);
          setVideoError("无法加载视频，请检查网络或联系管理员。");
        })
        .finally(() => {
          setVideoLoading(false);
        });
    }
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
          <Box sx={{ flexGrow: 1, backgroundColor: '#000', display: 'flex', justifyContent: 'center', alignItems: 'center', position: 'relative', minHeight: 300 }}>
            {videoLoading && <CircularProgress color="inherit" sx={{ color: 'white' }} />}
            {videoError && <Typography sx={{ color: 'red' }}>{videoError}</Typography>}
            {videoUrl && !videoError && (
              <video
                ref={videoRef}
                key={videoUrl} // 使用key确保在URL变化时重新渲染video元素
                controls
                src={videoUrl}
                onLoadedMetadata={handleVideoMetadataLoaded}
                style={{ maxWidth: '100%', maxHeight: '100%', display: videoLoading ? 'none' : 'block' }}
              />
            )}
            {!videoUrl && !videoLoading && !videoError && (
              <Typography sx={{ color: 'grey.500' }}>视频加载中...</Typography>
            )}
          </Box>

          <TimelineEditor
            duration={videoRef.current?.duration || 0}
            annotations={annotations}
            onAnnotationsChange={handleAnnotationsChange}
            onSeek={handleSeek}
          />

          <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 2, p: 1, flexShrink: 0 }}>
            <Button
              variant="outlined"
              color="error"
              startIcon={<Trash2 />}
              onClick={handleDelete}
              disabled={isSubmitting}
            >
              删除标记
            </Button>
            <Button
              variant="contained"
              color="primary"
              startIcon={<Save />}
              onClick={handleSave}
              disabled={!isDirty || isSubmitting}
            >
              标注完成
            </Button>
          </Box>
        </Box>
      ) : (
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'text.secondary' }}>
          <Typography>请从左侧选择一个任务开始标注</Typography>
        </Box>
      )}
    </Paper>
  );
};