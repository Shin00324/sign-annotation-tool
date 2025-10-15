import { AppBar, Toolbar, Typography, Button } from "@mui/material";
import { Film, Download, Upload } from "lucide-react";
import type { Annotation } from "../data/annotations";
import { useRef } from "react";

interface HeaderProps {
  allAnnotations: Annotation[];
  onImportAnnotations: (annotations: Annotation[]) => void;
}

export const Header = ({ allAnnotations, onImportAnnotations }: HeaderProps) => {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleExport = () => {
    if (allAnnotations.length === 0) {
      alert("没有可导出的标注。");
      return;
    }

    const dataStr = JSON.stringify(allAnnotations, null, 2);
    const dataUri = "data:application/json;charset=utf-8," + encodeURIComponent(dataStr);

    const exportFileDefaultName = `annotations_${new Date().toISOString()}.json`;

    const linkElement = document.createElement("a");
    linkElement.setAttribute("href", dataUri);
    linkElement.setAttribute("download", exportFileDefaultName);
    linkElement.click();
  };

  const handleImportClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const text = e.target?.result;
        if (typeof text === "string") {
          const importedData = JSON.parse(text);
          // TODO: Add more robust validation here
          if (Array.isArray(importedData)) {
            onImportAnnotations(importedData);
            alert(`成功导入 ${importedData.length} 条标注。`);
          }
        }
      } catch (error) {
        console.error("Error parsing JSON file:", error);
        alert("导入失败：文件格式错误或内容不是有效的JSON。");
      }
    };
    reader.readAsText(file);

    // Reset file input to allow importing the same file again
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  return (
    <AppBar position="static">
      <Toolbar>
        <Film size={24} style={{ marginRight: 16 }} />
        <Typography variant="h6" component="div" sx={{ flexGrow: 1 }}>
          手语视频标注工具
        </Typography>

        <input
          type="file"
          accept=".json"
          style={{ display: "none" }}
          ref={fileInputRef}
          onChange={handleFileChange}
        />
        <Button
          color="inherit"
          startIcon={<Upload />}
          onClick={handleImportClick}
        >
          导入标注
        </Button>

        <Button
          color="inherit"
          startIcon={<Download />}
          onClick={handleExport}
          disabled={allAnnotations.length === 0}
        >
          导出标注
        </Button>
      </Toolbar>
    </AppBar>
  );
};
