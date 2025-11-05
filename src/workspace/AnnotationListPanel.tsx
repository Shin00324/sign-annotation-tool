import { List, ListItem, ListItemText, Typography, Box, Paper, ListItemButton } from '@mui/material';
import type { Annotation } from '../data/types';

interface AnnotationListPanelProps {
  annotations: Annotation[];
  onPlaySegment: (startTime: number, endTime: number) => void;
}

export const AnnotationListPanel = ({ annotations, onPlaySegment }: AnnotationListPanelProps) => {
  return (
    <Paper elevation={2} sx={{ p: 2, height: '100%', overflowY: 'auto' }}>
      <Typography variant="h6" gutterBottom>
        标注结果
      </Typography>
      {annotations.length > 0 ? (
        <List dense>
          {annotations.map((anno, index) => (
            <ListItem
              key={anno.id || index}
              disablePadding
              divider
            >
              <ListItemButton onClick={() => onPlaySegment(anno.startTime, anno.endTime)}>
                <ListItemText
                  primary={`${index + 1}. ${anno.gloss}`}
                  secondary={`时间: ${anno.startTime.toFixed(2)}s - ${anno.endTime.toFixed(2)}s`}
                />
              </ListItemButton>
            </ListItem>
          ))}
        </List>
      ) : (
        <Box sx={{ textAlign: 'center', mt: 4 }}>
          <Typography color="text.secondary">
            暂无标注数据
          </Typography>
        </Box>
      )}
    </Paper>
  );
};