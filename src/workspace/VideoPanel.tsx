import React, { useRef, useState, useEffect, useCallback } from 'react';
import { Box, Paper, Typography, Button, CircularProgress, Alert } from '@mui/material';
import { Save, Delete, RotateCcw } from 'lucide-react';
import { TimelineEditor } from './TimelineEditor';
import apiClient from '../api';
import type { Annotation, Task } from '../data/types';

interface VideoPanelProps {
  task: Task | null;
  onSaveAnnotations: (taskId: string, annotations: Annotation[]) => void;
  onDeleteAnnotations: (taskId: string, status: Task['status']) => void;
  annotations: Annotation[];
  onAnnotationsChange: React.Dispatch<React.SetStateAction<Annotation[]>>;
  onGenerateDefaultAnnotations: (task: Task, duration: number) => void;
  onUpdateTaskStatus: (taskId: string, newStatus: Task['status']) => void;
  isSubmitting: boolean;
}

export const VideoPanel = ({ 
  task, 
  onSaveAnnotations,
  onDeleteAnnotations,
  annotations,
  onAnnotationsChange,
  onGenerateDefaultAnnotations,
  onUpdateTaskStatus,
  isSubmitting,
}: VideoPanelProps) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isDirty, setIsDirty] = useState(false);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [videoLoading, setVideoLoading] = useState(false);
  const [videoError, setVideoError] = useState<string | null>(null);
  const [videoDuration, setVideoDuration] = useState<number>(0);

  useEffect(() => {
    setIsDirty(false);
    setVideoUrl(null);
    setVideoError(null);

    if (task) {
      setVideoLoading(true);
      apiClient.get(`/api/signed-video-url/${task.id}`)
        .then(response => {
          setVideoUrl(response.data.url);
        })
        .catch(error => {
          console.error("获取签名URL失败:", error);
          setVideoError('视频加载失败，请检查网络或联系管理员。');
        })
        .finally(() => {
          setVideoLoading(false);
        });
    } else {
      setVideoDuration(0);
    }
  }, [task]);

  const handleVideoMetadataLoaded = () => {
    if (videoRef.current && task) {
      const newDuration = videoRef.current.duration;
      setVideoDuration(newDuration);
      onGenerateDefaultAnnotations(task, newDuration);
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
    if (task && window.confirm(`确定要重置任务 "${task.video}" 的所有标注吗？此操作不可撤销。`)) {
      onDeleteAnnotations(task.id, task.status);
      setIsDirty(false);
    }
  };

  return (
    <Paper elevation={2} sx={{ p: 2, width: '100%', display: "flex", flexDirection: "column" }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Typography variant="h6">{task ? `当前任务: ${task.video}` : '视频与标注'}</Typography>
        {task && (
          <Box sx={{ display: 'flex', gap: 1 }}>
            <Button
              variant="contained"
              color="primary"
              startIcon={<Save />}
              onClick={handleSave}
              disabled={!isDirty || isSubmitting}
            >
              保存标注
            </Button>
            <Button
              variant="outlined"
              color="error"
              startIcon={task.status === '已完成' ? <RotateCcw /> : <Delete />}
              onClick={handleDelete}
              disabled={isSubmitting}
            >
              {task.status === '已完成' ? '重新标注' : '删除标注'}
            </Button>
          </Box>
        )}
      </Box>

      {task ? (
        <Box sx={{ flexGrow: 1, display: 'flex', flexDirection: 'column', gap: 2 }}>
          {/* 视频播放器区域 */}
          <Box sx={{ flexGrow: 1, backgroundColor: '#000', display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 360, position: 'relative' }}>
            {(videoLoading || isSubmitting) && (
              <Box sx={{ position: 'absolute', zIndex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1 }}>
                <CircularProgress color="inherit" />
                <Typography>{isSubmitting ? '正在提交...' : '正在加载视频...'}</Typography>
              </Box>
            )}
            {videoError && !isSubmitting && <Alert severity="error" sx={{width: '100%'}}>{videoError}</Alert>}
            {videoUrl && !videoError && (
              <video
                ref={videoRef}
                key={videoUrl}
                controls
                src={videoUrl}
                onLoadedMetadata={handleVideoMetadataLoaded}
                style={{ 
                  width: '100%', 
                  height: 'auto', 
                  visibility: isSubmitting ? 'hidden' : 'visible' 
                }}
              />
            )}
            {!videoLoading && !videoUrl && !videoError && !isSubmitting && (
              <Typography color="text.secondary">正在准备视频...</Typography>
            )}
          </Box>

          {/* 词目标注条 (TimelineEditor) */}
          <Box sx={{ height: '120px', flexShrink: 0 }}>
            {videoDuration > 0 ? (
              <TimelineEditor
                duration={videoDuration}
                annotations={annotations}
                onAnnotationsChange={handleAnnotationsChange}
                onSeek={handleSeek}
              />
            ) : (
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', border: '1px dashed grey', borderRadius: 1 }}>
                <Typography color="text.secondary">
                  {videoLoading ? '视频加载中...' : '等待视频加载以显示时间轴'}
                </Typography>
              </Box>
            )}
          </Box>
        </Box>
      ) : (
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'text.secondary', border: '1px dashed grey', borderRadius: 1 }}>
          <Typography>请从左侧选择一个任务</Typography>
        </Box>
      )}
    </Paper>
  );
};