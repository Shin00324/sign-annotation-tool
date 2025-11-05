import { AppBar, Toolbar, Typography, Button, Box } from '@mui/material';
import { Upload } from 'lucide-react';
import type { Annotation } from '../data/types';

interface HeaderProps {
  allAnnotations: Annotation[];
  onImportAnnotations?: (annotations: Annotation[]) => void; // **关键修改**：变为可选属性
}

export const Header = ({ allAnnotations, onImportAnnotations }: HeaderProps) => {
  const handleExport = () => {
    const dataStr = JSON.stringify(allAnnotations, null, 2);
    const dataUri = 'data:application/json;charset=utf-8,' + encodeURIComponent(dataStr);
    const exportFileDefaultName = 'annotations.json';
    const linkElement = document.createElement('a');
    linkElement.setAttribute('href', dataUri);
    linkElement.setAttribute('download', exportFileDefaultName);
    linkElement.click();
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file && onImportAnnotations) { // **关键修改**：增加判断
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const content = e.target?.result;
          if (typeof content === 'string') {
            const importedAnnotations = JSON.parse(content);
            onImportAnnotations(importedAnnotations);
            alert('标注已成功导入！');
          }
        } catch (error) {
          console.error('导入失败:', error);
          alert('导入失败，请确保文件是正确的JSON格式。');
        }
      };
      reader.readAsText(file);
    }
  };

  return (
    <AppBar position="static">
      <Toolbar>
        <Typography variant="h6" component="div" sx={{ flexGrow: 1 }}>
          手语标注工具
        </Typography>
        <Box>
          {/* 只有在 onImportAnnotations 存在时才显示导入按钮 */}
          {onImportAnnotations && (
            <Button
              variant="outlined"
              color="inherit"
              component="label"
              startIcon={<Upload />}
              sx={{ mr: 2 }}
            >
              导入标注
              <input type="file" accept=".json" hidden onChange={handleFileChange} />
            </Button>
          )}
          <Button color="inherit" onClick={handleExport}>
            导出全部标注
          </Button>
        </Box>
      </Toolbar>
    </AppBar>
  );
};