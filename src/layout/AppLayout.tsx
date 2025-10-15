import { Box } from "@mui/material";
import { Header } from "./Header";
import { Footer } from "./Footer";
import { TaskListPanel } from "../workspace/TaskListPanel";
import { VideoPanel } from "../workspace/VideoPanel";
import { GlossPanel } from "../workspace/GlossPanel";
import type { Category, Task } from "../App";
import type { Annotation } from "../data/annotations";

interface AppLayoutProps {
  taskCategories: Category[];
  selectedTask: Task | null;
  onTaskSelect: (taskId: string) => void;
  selectedGloss: string | null;
  onGlossSelect: (gloss: string) => void;
  annotations: Annotation[];
  allAnnotations: Annotation[];
  onAddAnnotation: (annotation: Omit<Annotation, "id" | "taskId">) => void;
  onDeleteAnnotation: (annotationId: string) => void;
  onImportAnnotations: (annotations: Annotation[]) => void;
  // **新增属性**: 定义微调功能相关的接口
  selectedAnnotationForEdit: Annotation | null;
  onSelectAnnotationForEdit: (annotation: Annotation | null) => void;
  onUpdateAnnotation: (annotationId: string, updates: Partial<Pick<Annotation, 'startTime' | 'endTime'>>) => void;
}

export const AppLayout = ({
  taskCategories,
  selectedTask,
  onTaskSelect,
  selectedGloss,
  onGlossSelect,
  annotations,
  allAnnotations,
  onAddAnnotation,
  onDeleteAnnotation,
  onImportAnnotations,
  // **新增属性**: 接收这些新属性
  selectedAnnotationForEdit,
  onSelectAnnotationForEdit,
  onUpdateAnnotation,
}: AppLayoutProps) => {
  return (
    <Box sx={{ display: "flex", flexDirection: "column", height: "100vh" }}>
      <Header allAnnotations={allAnnotations} onImportAnnotations={onImportAnnotations} />
      <Box component="main" sx={{ display: 'flex', flexGrow: 1, p: 2, gap: 2, overflow: 'hidden' }}>
        <Box sx={{ width: '20.83%', flexShrink: 0, border: '1px solid #444', borderRadius: 1, overflowY: 'auto' }}>
          <TaskListPanel
            tasks={taskCategories}
            selectedTask={selectedTask}
            onSelectTask={onTaskSelect}
          />
        </Box>

        <Box sx={{ flex: 1, minWidth: 0, display: 'flex' }}>
          <VideoPanel
            task={selectedTask}
            annotations={annotations}
            onAddAnnotation={onAddAnnotation}
            onDeleteAnnotation={onDeleteAnnotation}
            // **新增属性**: 将它们传递给 VideoPanel
            selectedAnnotationForEdit={selectedAnnotationForEdit}
            onSelectAnnotationForEdit={onSelectAnnotationForEdit}
            onUpdateAnnotation={onUpdateAnnotation}
          />
        </Box>

        <Box sx={{ width: '20.83%', flexShrink: 0 }}>
          <GlossPanel
            task={selectedTask}
            selectedGloss={selectedGloss}
            onGlossSelect={onGlossSelect}
          />
        </Box>
      </Box>
      <Footer />
    </Box>
  );
};