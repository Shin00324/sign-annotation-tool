export interface Annotation {
  id: string;
  taskId: string;
  gloss: string;
  startTime: number;
  endTime: number;
}

export interface Task {
  id: string;
  video: string;
  glosses: string[];
  status: '待处理' | '部分完成' | '已完成' | '错误' | '未知';
}

export interface Category {
  categoryName: string;
  tasks: Task[];
}