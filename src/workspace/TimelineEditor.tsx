import { Box, Tooltip, Typography } from '@mui/material';
import { useRef, useState, useEffect } from 'react';
import type { Annotation } from '../data/annotations';

interface TimelineEditorProps {
  duration: number;
  annotations: Annotation[];
  onAnnotationsChange: (newAnnotations: Annotation[]) => void;
  onSeek: (time: number) => void;
}

// 为词目分段生成一组固定的、可循环的颜色
const segmentColors = [
  '#F44336', '#E91E63', '#9C27B0', '#673AB7', '#3F51B5',
  '#2196F3', '#03A9F4', '#00BCD4', '#009688', '#4CAF50',
  '#8BC34A', '#CDDC39', '#FFEB3B', '#FFC107', '#FF9800',
  '#FF5722', '#795548', '#9E9E9E', '#607D8B'
];

// 新增常量
const GLOSS_THRESHOLD = 20; // 切换到滚动模式的词目数量阈值
const MIN_GLOSS_WIDTH_PX = 60; // 滚动模式下每个词目的最小宽度

export const TimelineEditor = ({ duration, annotations, onAnnotationsChange, onSeek }: TimelineEditorProps) => {
  const timelineRef = useRef<HTMLDivElement>(null);
  const [draggingHandle, setDraggingHandle] = useState<number | null>(null);

  const handleMouseDown = (handleIndex: number) => {
    setDraggingHandle(handleIndex);
  };

  const handleMouseUp = () => {
    setDraggingHandle(null);
  };

  const handleMouseMove = (event: MouseEvent) => {
    if (draggingHandle === null || !timelineRef.current || duration === 0) return;

    const timelineEl = timelineRef.current;
    const timelineRect = timelineEl.getBoundingClientRect();
    
    // 关键修改: 考虑滚动偏移量
    // newX 是鼠标在整个可滚动区域内的绝对像素位置
    const newX = event.clientX - timelineRect.left + timelineEl.scrollLeft;
    
    // 关键修改: 使用 scrollWidth (内容总宽度) 而不是 clientWidth (可见部分宽度)
    const totalWidth = timelineEl.scrollWidth;
    
    // 确保 newX 在有效范围内
    const clampedX = Math.max(0, Math.min(newX, totalWidth));
    
    const percentage = clampedX / totalWidth;
    const newTime = percentage * duration;

    const updatedAnnotations = [...annotations];
    
    // 更新当前拖动的分割线右侧分段的 startTime
    if (draggingHandle < updatedAnnotations.length) {
      updatedAnnotations[draggingHandle].startTime = newTime;
    }
    // 更新当前拖动的分割线左侧分段的 endTime
    if (draggingHandle > 0) {
      updatedAnnotations[draggingHandle - 1].endTime = newTime;
    }

    // 确保时间不会重叠 (此逻辑保持不变)
    if (updatedAnnotations[draggingHandle]?.startTime > updatedAnnotations[draggingHandle]?.endTime) {
        updatedAnnotations[draggingHandle].startTime = updatedAnnotations[draggingHandle].endTime;
    }
    if (draggingHandle > 0 && updatedAnnotations[draggingHandle - 1]?.startTime > updatedAnnotations[draggingHandle - 1]?.endTime) {
        updatedAnnotations[draggingHandle - 1].endTime = updatedAnnotations[draggingHandle - 1].startTime;
    }

    onAnnotationsChange(updatedAnnotations);
    onSeek(newTime);
  };

  useEffect(() => {
    if (draggingHandle !== null) {
      // 使用 'global' 事件监听器，即使鼠标移出组件也能响应
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
    }
    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [draggingHandle, annotations, duration]); // 依赖项保持不变

  if (duration === 0 || annotations.length === 0) {
    return null;
  }

  // 根据词目数量决定是否进入滚动模式
  const isScrollMode = annotations.length > GLOSS_THRESHOLD;
  
  // 动态计算内部容器宽度
  const timelineInnerWidth = isScrollMode 
    ? `${annotations.length * MIN_GLOSS_WIDTH_PX}px`
    : '100%';

  // 根据词目数量决定字体大小
  const fontSize = annotations.length > 25 ? '0.7rem' : '0.85rem';

  return (
    <Box sx={{ mt: 2, userSelect: 'none' }}>
      <Typography variant="subtitle2" sx={{ mb: 1 }}>词目标注条</Typography>
      {/* 外层容器，用于实现滚动 */}
      <Box
        ref={timelineRef}
        sx={{
          position: 'relative',
          width: '100%',
          height: '65px', // 增加高度以容纳滚动条
          backgroundColor: '#2E2E2E',
          cursor: draggingHandle !== null ? 'ew-resize' : 'default',
          overflowX: isScrollMode ? 'auto' : 'hidden', // 按需显示滚动条
          overflowY: 'hidden',
        }}
      >
        {/* 内层容器，其宽度可超出外层容器 */}
        <Box sx={{
          position: 'relative',
          width: timelineInnerWidth,
          height: '50px', // 保持原有的标注条高度
          display: 'flex',
        }}>
          {annotations.map((anno, index) => {
            const leftPercent = (anno.startTime / duration) * 100;
            const widthPercent = ((anno.endTime - anno.startTime) / duration) * 100;
            const color = segmentColors[index % segmentColors.length];

            return (
              <Tooltip key={anno.id} title={anno.gloss} placement="top">
                <Box
                  onClick={() => onSeek(anno.startTime)}
                  sx={{
                    position: 'absolute',
                    left: `${leftPercent}%`,
                    width: `${widthPercent}%`,
                    height: '100%',
                    backgroundColor: color,
                    borderRight: '1px solid #FFF',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#FFF',
                    fontSize: fontSize,
                    cursor: 'pointer',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                    px: 0.5,
                  }}
                >
                  {anno.gloss}
                </Box>
              </Tooltip>
            );
          })}

          {/* 渲染可拖拽的分割线 */}
          {annotations.slice(0, -1).map((anno, index) => {
            const handlePositionPercent = (anno.endTime / duration) * 100;
            return (
              <Box
                key={`handle-${index}`}
                onMouseDown={() => handleMouseDown(index + 1)}
                sx={{
                  position: 'absolute',
                  left: `calc(${handlePositionPercent}% - 4px)`,
                  top: 0,
                  width: '8px',
                  height: '100%',
                  cursor: 'ew-resize',
                  zIndex: 10,
                  // background: 'rgba(255,0,0,0.2)' // 用于调试拖拽区域
                }}
              />
            );
          })}
        </Box>
      </Box>
    </Box>
  );
};