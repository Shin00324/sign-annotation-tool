import { Box } from "@mui/material";
import { Header } from "./Header";
import { Footer } from "./Footer";
import { TaskListPanel } from "../workspace/TaskListPanel";
import { VideoPanel } from "../workspace/VideoPanel";
import { AnnotationListPanel } from "../workspace/AnnotationListPanel";
import type { Category, Task } from "../App";
import type { Annotation } from "../data/annotations";

interface AppLayoutProps {
  taskCategories: Category[];
  selectedTask: Task | null;
  onTaskSelect: (taskId: string) => void;
  allAnnotations: Annotation[];
  onImportAnnotations: (annotations: Annotation[]) => void;
  onSaveAnnotations: (taskId: string, annotations: Annotation[]) => void;
  // **新增/修改的 Props**
  editingAnnotations: Annotation[];
  onEditingAnnotationsChange: (annotations: Annotation[]) => void;
  onGenerateDefaultAnnotations: (task: Task, duration: number) => void;
  // **新增 Props**
  onUpdateTaskStatus: (taskId: string, status: Task['status']) => void;
}

export const AppLayout = (props: AppLayoutProps) => {
  // **关键修改**: 右侧列表的数据源现在是 editingAnnotations
  // 如果 editingAnnotations 为空，则尝试从 allAnnotations 中查找已保存的数据
  const annotationsForDisplay = 
    props.editingAnnotations.length > 0 
      ? props.editingAnnotations
      : props.selectedTask 
        ? props.allAnnotations.filter(a => a.taskId === props.selectedTask?.id)
        : [];

  const handlePlaySegment = (startTime: number, endTime: number) => {
    // 这个功能暂时未实现，因为 VideoPanel 现在是独立的
    console.log(`请求播放: ${startTime} - ${endTime}`);
  };

  return (
    <Box sx={{ display: "flex", flexDirection: "column", height: "100vh" }}>
      <Header allAnnotations={props.allAnnotations} onImportAnnotations={props.onImportAnnotations} />
      <Box component="main" sx={{ display: 'flex', flexGrow: 1, p: 2, gap: 2, overflow: 'hidden' }}>
        {/* 左侧栏: 任务列表 (不变) */}
        <Box sx={{ width: '20.83%', flexShrink: 0, border: '1px solid #444', borderRadius: 1, overflowY: 'auto' }}>
          <TaskListPanel
            tasks={props.taskCategories}
            selectedTask={props.selectedTask}
            onSelectTask={props.onTaskSelect}
          />
        </Box>

        {/* 中间栏: 视频与标注条 */}
        <Box sx={{ width: '58.34%', minWidth: 0, display: 'flex' }}>
          <VideoPanel
            task={props.selectedTask}
            onSaveAnnotations={props.onSaveAnnotations}
            // **新增/修改的 Props**
            annotations={props.editingAnnotations}
            onAnnotationsChange={props.onEditingAnnotationsChange}
            onGenerateDefaultAnnotations={props.onGenerateDefaultAnnotations}
            // **新增 Props**
            onUpdateTaskStatus={props.onUpdateTaskStatus}
          />
        </Box>

        {/* 右侧栏: 标注结果列表 */}
        <Box sx={{ width: '20.83%', flexShrink: 0 }}>
          <AnnotationListPanel
            annotations={annotationsForDisplay} // **使用新的数据源**
            onPlaySegment={handlePlaySegment}
          />
        </Box>
      </Box>
      <Footer />
    </Box>
  );
};