import React, { useRef, useState, useEffect } from 'react';
import {
  Box,
  Paper,
  Typography,
  Button,
  List,
  ListItem,
  ListItemText,
  IconButton,
  Tooltip,
  Divider,
  ListItemButton,
} from '@mui/material';
import { Play, Trash2, AlertTriangle, Save, XCircle } from 'lucide-react';
import type { Annotation } from '../data/annotations';
import type { Task } from '../App';

// --- 您需要修改这里 ---
// 请将下面的 URL 替换为您自己的 Cloudflare R2 存储桶的公开访问 URL
const R2_BASE_URL = "https://pub-1614b7bb5b3540b9898ae99f84787635.r2.dev"; 
// --------------------

// 后端 API 的 URL 保持不变
const API_URL = 'http://localhost:3001';

interface VideoPanelProps {
  task: Task | null;
  annotations: Annotation[];
  onAddAnnotation: (annotation: Omit<Annotation, 'id' | 'taskId'>) => void;
  onDeleteAnnotation: (annotationId: string) => void;
  selectedAnnotationForEdit: Annotation | null;
  onSelectAnnotationForEdit: (annotation: Annotation | null) => void;
  onUpdateAnnotation: (annotationId: string, updates: Partial<Pick<Annotation, 'startTime' | 'endTime'>>) => void;
}

const formatTime = (time: number) => {
  if (isNaN(time) || time < 0) return '0.000';
  return time.toFixed(3);
};

// **新增功能**: 动态构建视频 URL 的辅助函数
const getVideoUrl = (videoPath: string) => {
  // 如果 videoPath 已经是完整的 URL，则直接返回
  if (videoPath.startsWith('http')) {
    return videoPath;
  }
  // 否则，将其与 R2 基础 URL 拼接
  return `${R2_BASE_URL.replace(/\/$/, '')}/${videoPath}`;
};


const FineTunePanel = ({
  annotation,
  videoElement,
  onUpdate,
  onCancel,
}: {
  annotation: Annotation;
  videoElement: HTMLVideoElement | null;
  onUpdate: (id: string, updates: { startTime?: number; endTime?: number }) => void;
  onCancel: () => void;
}) => {
  const [newStartTime, setNewStartTime] = useState(annotation.startTime);
  const [newEndTime, setNewEndTime] = useState(annotation.endTime);

  useEffect(() => {
    setNewStartTime(annotation.startTime);
    setNewEndTime(annotation.endTime);
  }, [annotation]);

  const handleSetStart = () => {
    if (videoElement) setNewStartTime(videoElement.currentTime);
  };

  const handleSetEnd = () => {
    if (videoElement) setNewEndTime(videoElement.currentTime);
  };

  const handleSave = () => {
    if (newStartTime >= newEndTime) {
      alert('错误：开始时间必须小于结束时间。');
      return;
    }
    onUpdate(annotation.id, { startTime: newStartTime, endTime: newEndTime });
  };

  return (
    <Paper variant="outlined" sx={{ p: 2, mb: 2, borderColor: 'primary.main', borderWidth: 2 }}>
      <Typography variant="h6" sx={{ mb: 2 }}>微调标注: "{annotation.gloss}"</Typography>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap' }}>
        <Button variant="outlined" onClick={handleSetStart}>设为开始时间</Button>
        <Typography sx={{ minWidth: '80px' }}>{formatTime(newStartTime)}s</Typography>
        <Divider orientation="vertical" flexItem />
        <Button variant="outlined" onClick={handleSetEnd}>设为结束时间</Button>
        <Typography sx={{ minWidth: '80px' }}>{formatTime(newEndTime)}s</Typography>
        <Box sx={{ flexGrow: 1 }} />
        <Button variant="contained" color="primary" startIcon={<Save />} onClick={handleSave}>保存更改</Button>
        <IconButton onClick={onCancel}><XCircle /></IconButton>
      </Box>
    </Paper>
  );
};


export const VideoPanel = ({
  task,
  annotations,
  onAddAnnotation,
  onDeleteAnnotation,
  selectedAnnotationForEdit,
  onSelectAnnotationForEdit,
  onUpdateAnnotation,
}: VideoPanelProps) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [playingSegment, setPlayingSegment] = useState<{ endTime: number } | null>(null);
  const [lastMarkTime, setLastMarkTime] = useState<number>(0);
  const [nextGlossIndex, setNextGlossIndex] = useState<number>(0);

  useEffect(() => {
    if (task) {
      const sortedAnnotations = [...annotations].sort((a, b) => a.endTime - b.endTime);
      const lastAnnotation = sortedAnnotations[sortedAnnotations.length - 1];
      setNextGlossIndex(sortedAnnotations.length);
      setLastMarkTime(lastAnnotation ? lastAnnotation.endTime : 0);
    } else {
      setNextGlossIndex(0);
      setLastMarkTime(0);
    }
    if (videoRef.current) {
      videoRef.current.load();
    }
  }, [task?.id]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    const handleTimeUpdate = () => {
      if (playingSegment && video.currentTime >= playingSegment.endTime) {
        video.pause();
        setPlayingSegment(null);
      }
    };
    video.addEventListener('timeupdate', handleTimeUpdate);
    return () => {
      video.removeEventListener('timeupdate', handleTimeUpdate);
    };
  }, [playingSegment]);

  const handleMarkGlossEnd = () => {
    const video = videoRef.current;
    if (!video || !task || nextGlossIndex >= task.glosses.length) return;
    const currentTime = video.currentTime;
    if (currentTime <= lastMarkTime) {
      alert("错误：结束时间必须大于上一个标记时间点。");
      return;
    }
    const glossToAnnotate = task.glosses[nextGlossIndex];
    onAddAnnotation({
      gloss: glossToAnnotate,
      startTime: lastMarkTime,
      endTime: currentTime,
    });
    setLastMarkTime(currentTime);
    setNextGlossIndex(prevIndex => prevIndex + 1);
  };

  const handlePlaySegment = (startTime: number, endTime: number) => {
    const video = videoRef.current;
    if (video) {
      setPlayingSegment({ endTime });
      video.currentTime = startTime;
      video.play();
    }
  };

  const handleSaveFineTune = (id: string, updates: { startTime?: number; endTime?: number }) => {
    onUpdateAnnotation(id, updates);
    onSelectAnnotationForEdit(null);
  };

  const isAllGlossesMarked = task ? nextGlossIndex >= task.glosses.length : true;
  const nextGlossToMark = task && !isAllGlossesMarked ? task.glosses[nextGlossIndex] : null;
  const sortedAnnotations = [...annotations].sort((a, b) => a.endTime - b.endTime);

  return (
    <Paper elevation={2} sx={{ p: 2, width: '100%', display: "flex", flexDirection: "column" }}>
      <Typography variant="h6" gutterBottom sx={{ flexShrink: 0 }}>视频与标注</Typography>
      {task ? (
        <Box sx={{ display: 'flex', flexDirection: 'column', flexGrow: 1, minHeight: 0 }}>
          <Box sx={{ backgroundColor: '#000', mb: 2, flexShrink: 0 }}>
            <video
              ref={videoRef}
              controls
              width="100%"
              style={{ display: 'block', maxHeight: '40vh' }}
              key={task.id}
              // **关键修改**: 使用辅助函数来构建最终的视频 URL
              src={getVideoUrl(task.video)}
            />
          </Box>
          
          {selectedAnnotationForEdit ? (
            <FineTunePanel
              annotation={selectedAnnotationForEdit}
              videoElement={videoRef.current}
              onUpdate={handleSaveFineTune}
              onCancel={() => onSelectAnnotationForEdit(null)}
            />
          ) : (
            <Paper variant="outlined" sx={{ p: 2, mb: 2, flexShrink: 0 }}>
              <Typography variant="h6" sx={{ mb: 2 }}>顺序标注控制</Typography>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                <Button
                  variant="contained"
                  color="primary"
                  onClick={handleMarkGlossEnd}
                  disabled={isAllGlossesMarked}
                  size="large"
                >
                  {isAllGlossesMarked ? '全部词目已标注' : `标记词尾: ${nextGlossToMark}`}
                </Button>
                <Box>
                  <Typography variant="body2" color="text.secondary">上个标记时间点</Typography>
                  <Typography variant="h5" component="div">{formatTime(lastMarkTime)}s</Typography>
                </Box>
              </Box>
            </Paper>
          )}

          <Typography variant="subtitle1" sx={{ mt: 2, mb: 1, flexShrink: 0 }}>
            已有标注 ({sortedAnnotations.length} / {task.glosses.length})
          </Typography>
          
          <Box sx={{ flexGrow: 1, overflowY: 'auto' }}>
            <List dense>
              {sortedAnnotations.map((anno) => (
                <ListItemButton
                  key={anno.id}
                  selected={selectedAnnotationForEdit?.id === anno.id}
                  onClick={() => onSelectAnnotationForEdit(anno)}
                >
                  <Tooltip title="播放此片段" placement="top-start">
                    <IconButton edge="start" sx={{ mr: 1 }} onClick={(e) => { e.stopPropagation(); handlePlaySegment(anno.startTime, anno.endTime); }}>
                      <Play size={18} />
                    </IconButton>
                  </Tooltip>
                  <ListItemText
                    primary={anno.gloss}
                    secondary={`时间: ${formatTime(anno.startTime)}s - ${formatTime(anno.endTime)}s`}
                  />
                  <IconButton edge="end" aria-label="delete" onClick={(e) => { e.stopPropagation(); onDeleteAnnotation(anno.id); }}>
                    <Trash2 size={18} />
                  </IconButton>
                </ListItemButton>
              ))}
              {sortedAnnotations.length === 0 && (
                <ListItem>
                  <AlertTriangle size={18} style={{ marginRight: '8px' }} />
                  <ListItemText secondary="暂无标注。请使用上方的“顺序标注控制”面板开始。" />
                </ListItem>
              )}
            </List>
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