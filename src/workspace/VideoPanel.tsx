import { useRef, useState, useEffect, useCallback } from 'react';
import { Box, Paper, Typography, Button } from '@mui/material';
import { Save } from 'lucide-react';
import type { Annotation } from '../data/annotations';
import type { Task } from '../App';
import { TimelineEditor } from './TimelineEditor';

const R2_BASE_URL = "https://pub-1614b7bb5b3540b9898ae99f84787635.r2.dev/";

const getVideoUrl = (videoPath: string) => {
  if (videoPath.startsWith('http')) return videoPath;
  return `${R2_BASE_URL.replace(/\/$/, '')}/${videoPath}`;
};

interface VideoPanelProps {
  task: Task | null;
  onSaveAnnotations: (taskId: string, annotations: Annotation[]) => void;
  // **新增/修改的 Props**
  annotations: Annotation[];
  onAnnotationsChange: (annotations: Annotation[]) => void;
  onGenerateDefaultAnnotations: (task: Task, duration: number) => void;
  // **新增 Prop**
  onUpdateTaskStatus: (taskId: string, status: Task['status']) => void;
}

export const VideoPanel = ({ 
  task, 
  onSaveAnnotations,
  annotations,
  onAnnotationsChange,
  onGenerateDefaultAnnotations,
  onUpdateTaskStatus // **新增 Prop**
}: VideoPanelProps) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isDirty, setIsDirty] = useState(false); // 跟踪用户是否拖动过

  // 当任务切换时，重置 isDirty 状态
  useEffect(() => {
    setIsDirty(false);
  }, [task]);

  const handleVideoMetadataLoaded = () => {
    if (videoRef.current && task) {
      // 当视频元数据加载后，调用父组件的函数来生成默认标注
      onGenerateDefaultAnnotations(task, videoRef.current.duration);
    }
  };

  const handleSeek = useCallback((time: number) => {
    if (videoRef.current) {
      videoRef.current.currentTime = time;
    }
  }, []);

  const handleAnnotationsChange = (newAnnotations: Annotation[]) => {
    onAnnotationsChange(newAnnotations); // 调用父组件的函数更新状态
    if (!isDirty && task) {
      setIsDirty(true); // 用户第一次修改
      // **关键新增**: 首次修改时，立即更新任务状态为 "部分完成"
      onUpdateTaskStatus(task.id, '部分完成');
    }
  };

  const handleSave = () => {
    if (task) {
      onSaveAnnotations(task.id, annotations);
      alert('标注已完成并保存！');
      setIsDirty(false); // 保存后重置 dirty 状态
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
            annotations={annotations} // **使用从 props 传入的 annotations**
            onAnnotationsChange={handleAnnotationsChange}
            onSeek={handleSeek}
          />

          <Box sx={{ mt: 'auto', pt: 2, display: 'flex', justifyContent: 'flex-end' }}>
            <Button
              variant="contained"
              color="primary"
              startIcon={<Save />}
              onClick={handleSave}
              disabled={!isDirty} // 如果从未修改过，则禁用按钮
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