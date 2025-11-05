import { useRef, useState, useCallback, useMemo, useEffect } from 'react';
import { Box, Typography } from '@mui/material';
import type { Annotation } from '../data/types';

interface TimelineEditorProps {
  duration: number;
  annotations: Annotation[];
  onAnnotationsChange: (newAnnotations: Annotation[]) => void;
  onSeek: (time: number) => void;
}

const HANDLE_WIDTH = 8; // 拖拽手柄的宽度
const ANNOTATION_COUNT_THRESHOLD = 20; // 模式切换的词目数量阈值
const MIN_SEGMENT_WIDTH_PX = 60; // 滚动模式下每个分段的初始宽度

export const TimelineEditor = ({
  duration,
  annotations,
  onAnnotationsChange,
  onSeek,
}: TimelineEditorProps) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [draggingInfo, setDraggingInfo] = useState<{
    splitterIndex: number; // 拖拽的分割点索引 (0 to N-2)
    initialX: number;
    initialTime: number;
  } | null>(null);

  const isScrollMode = useMemo(() => annotations.length > ANNOTATION_COUNT_THRESHOLD, [annotations.length]);

  const totalTimelineWidth = useMemo(() => {
    if (!isScrollMode || !containerRef.current) {
      return containerRef.current?.offsetWidth || 0;
    }
    return annotations.length * MIN_SEGMENT_WIDTH_PX;
  }, [isScrollMode, annotations.length, containerRef.current?.offsetWidth]);

  const timeToPixels = useCallback(
    (time: number) => {
      if (!duration || totalTimelineWidth === 0) return 0;
      return (time / duration) * totalTimelineWidth;
    },
    [duration, totalTimelineWidth]
  );

  const pixelsToTime = useCallback(
    (pixels: number) => {
      if (!duration || totalTimelineWidth === 0) return 0;
      return (pixels / totalTimelineWidth) * duration;
    },
    [duration, totalTimelineWidth]
  );

  const handleMouseDown = (
    e: React.MouseEvent,
    splitterIndex: number
  ) => {
    e.stopPropagation();
    setDraggingInfo({
      splitterIndex,
      initialX: e.clientX,
      initialTime: annotations[splitterIndex].endTime, // 分割点的时间就是左侧分段的结束时间
    });
  };

  const handleMouseMove = useCallback(
    (e: MouseEvent) => {
      if (!draggingInfo || !containerRef.current) return;

      const dx = e.clientX - draggingInfo.initialX;
      const dt = pixelsToTime(dx);
      const newAnnotations = [...annotations];
      
      const leftSegment = newAnnotations[draggingInfo.splitterIndex];
      const rightSegment = newAnnotations[draggingInfo.splitterIndex + 1];

      const leftBoundary = leftSegment.startTime;
      const rightBoundary = rightSegment.endTime;

      let newTime = draggingInfo.initialTime + dt;
      newTime = Math.max(leftBoundary, Math.min(newTime, rightBoundary));
      
      leftSegment.endTime = newTime;
      rightSegment.startTime = newTime;

      onSeek(newTime);
      onAnnotationsChange(newAnnotations);
    },
    [draggingInfo, annotations, onAnnotationsChange, onSeek, pixelsToTime]
  );

  const handleMouseUp = useCallback(() => {
    setDraggingInfo(null);
  }, []);

  useEffect(() => {
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [handleMouseMove, handleMouseUp]);

  if (duration === 0) {
    return <Typography color="text.secondary">等待视频加载...</Typography>;
  }

  return (
    <Box sx={{ flexGrow: 1, display: 'flex', flexDirection: 'column', minHeight: 100 }}>
      <Typography variant="subtitle2" sx={{ mb: 1 }}>词条分割</Typography>
      <Box
        ref={containerRef}
        sx={{
          width: '100%',
          overflowX: 'auto',
          '&::-webkit-scrollbar': { height: '8px' },
          '&::-webkit-scrollbar-track': { backgroundColor: '#2b2b2b' },
          '&::-webkit-scrollbar-thumb': { backgroundColor: '#6b6b6b', borderRadius: '4px' },
          '&::-webkit-scrollbar-thumb:hover': { backgroundColor: '#858585' }
        }}
      >
        <Box
          sx={{
            position: 'relative',
            width: isScrollMode ? `${totalTimelineWidth}px` : '100%',
            height: 60,
            backgroundColor: '#333',
            borderRadius: 1,
          }}
        >
          {annotations.map((anno, index) => {
            const left = timeToPixels(anno.startTime);
            const width = timeToPixels(anno.endTime) - left;

            return (
              <Box
                key={anno.id || index}
                sx={{
                  position: 'absolute',
                  left: `${left}px`,
                  width: `${width}px`,
                  height: '100%',
                  backgroundColor: `hsla(${index * 40}, 70%, 50%, 0.7)`,
                  borderRight: index < annotations.length - 1 ? '2px solid #fff' : 'none',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  overflow: 'hidden',
                  // **关键修改**: 移除了 minWidth 属性
                }}
                onClick={(e) => {
                    const rect = e.currentTarget.getBoundingClientRect();
                    const clickX = e.clientX - rect.left;
                    onSeek(anno.startTime + pixelsToTime(clickX));
                }}
              >
                <Typography noWrap sx={{ color: 'white', fontSize: '0.8rem', px: 1, pointerEvents: 'none' }}>
                  {anno.gloss}
                </Typography>
              </Box>
            );
          })}

          {/* 渲染所有可拖拽的共享分割点 */}
          {annotations.slice(0, -1).map((anno, index) => (
            <Box
              key={`splitter-${index}`}
              sx={{
                position: 'absolute',
                left: `${timeToPixels(anno.endTime) - HANDLE_WIDTH / 2}px`,
                top: 0,
                width: HANDLE_WIDTH,
                height: '100%',
                cursor: 'ew-resize',
                zIndex: 10,
              }}
              onMouseDown={(e) => handleMouseDown(e, index)}
            />
          ))}
        </Box>
      </Box>
    </Box>
  );
};