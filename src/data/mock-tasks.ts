// c:\Users\ASUS\Desktop\sign-annotation-tool\src\data\mock-tasks.ts

export interface Task {
  id: string;
  videoName: string;
  translator: string;
  glosses: string[];
  status?: '待处理' | '部分完成' | '已完成' | '错误'; // Add status property
}

// The mock data is no longer used in App.tsx, but we keep it for reference or testing.
export const MOCK_TASKS: Task[] = [
  {
    id: "task_001",
    videoName: "video_001.mp4",
    translator: "张三",
    glosses: ["你", "好", "吗"],
  },
  {
    id: "task_002",
    videoName: "video_002.mp4",
    translator: "李四",
    glosses: ["我", "很", "好"],
  },
  {
    id: "task_003",
    videoName: "video_003.mp4",
    translator: "王五",
    glosses: ["谢谢", "你", "再见"],
  },
  {
    id: "task_004",
    videoName: "video_004.mp4",
    translator: "张三",
    glosses: ["不", "客气", "明天", "见"],
  },
];