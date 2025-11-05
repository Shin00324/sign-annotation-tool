import { Box, CircularProgress } from "@mui/material";
import { Header } from "./Header";
import { Footer } from "./Footer";
import { TaskListPanel } from "../workspace/TaskListPanel";
import { VideoPanel } from "../workspace/VideoPanel";
import { AnnotationListPanel } from "../workspace/AnnotationListPanel";
import type { Annotation, Category, Task } from "../data/types";
import React from "react";

interface AppLayoutProps {
  taskCategories: Category[];
  selectedTask: Task | null;
  onTaskSelect: (taskId: string) => void;
  allAnnotations: Annotation[];
  onImportAnnotations: (annotations: Annotation[]) => void;
  onSaveAnnotations: (taskId: string, annotations: Annotation[]) => void;
  onDeleteAnnotations: (taskId: string, status: Task['status']) => void;
  editingAnnotations: Annotation[];
  onEditingAnnotationsChange: React.Dispatch<React.SetStateAction<Annotation[]>>;
  onGenerateDefaultAnnotations: (task: Task, duration: number) => void;
  onUpdateTaskStatus: (taskId: string, newStatus: Task['status']) => void;
  isSubmitting: boolean; // 新增
}

export const AppLayout = (props: AppLayoutProps) => {
  const annotationsForDisplay = 
    props.editingAnnotations.length > 0 
      ? props.editingAnnotations
      : props.selectedTask 
        ? props.allAnnotations.filter(a => a.taskId === props.selectedTask?.id)
        : [];

  const handlePlaySegment = (startTime: number, endTime: number) => {
    console.log(`请求播放: ${startTime} - ${endTime}`);
  };

  return (
    <Box sx={{ display: "flex", flexDirection: "column", height: "100vh", position: 'relative' }}>
      {/* 全局遮罩层 */}
      {props.isSubmitting && (
        <Box sx={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.5)',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          zIndex: 9999,
          color: 'white'
        }}>
          <CircularProgress color="inherit" />
        </Box>
      )}
      <Header allAnnotations={props.allAnnotations} onImportAnnotations={props.onImportAnnotations} />
      <Box component="main" sx={{ display: 'flex', flexGrow: 1, p: 2, gap: 2, overflow: 'hidden' }}>
        <Box sx={{ width: '20.83%', flexShrink: 0, border: '1px solid #444', borderRadius: 1, overflowY: 'auto' }}>
          <TaskListPanel
            tasks={props.taskCategories}
            selectedTask={props.selectedTask}
            onSelectTask={props.onTaskSelect}
          />
        </Box>

        <Box sx={{ width: '58.34%', minWidth: 0, display: 'flex' }}>
          <VideoPanel
            task={props.selectedTask}
            onSaveAnnotations={props.onSaveAnnotations}
            onDeleteAnnotations={props.onDeleteAnnotations}
            annotations={props.editingAnnotations}
            onAnnotationsChange={props.onEditingAnnotationsChange}
            onGenerateDefaultAnnotations={props.onGenerateDefaultAnnotations}
            onUpdateTaskStatus={props.onUpdateTaskStatus}
            isSubmitting={props.isSubmitting} // 传递
          />
        </Box>

        <Box sx={{ width: '20.83%', flexShrink: 0 }}>
          <AnnotationListPanel
            annotations={annotationsForDisplay}
            onPlaySegment={handlePlaySegment}
          />
        </Box>
      </Box>
      <Footer />
    </Box>
  );
};