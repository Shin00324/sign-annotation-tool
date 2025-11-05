import {
  Box,
  Paper,
  Typography,
  List,
  ListItem,
  ListItemText,
  IconButton,
  Tooltip,
} from '@mui/material';
import { Play } from 'lucide-react';
import type { Annotation } from '../data/annotations';

interface AnnotationListPanelProps {
  annotations: Annotation[];
  onPlaySegment: (startTime: number, endTime: number) => void;
}

const formatTime = (time: number) => {
  if (isNaN(time) || time < 0) return '0.000';
  return time.toFixed(3);
};

export const AnnotationListPanel = ({ annotations, onPlaySegment }: AnnotationListPanelProps) => {
  return (
    <Paper elevation={2} sx={{ p: 2, height: '100%', display: 'flex', flexDirection: 'column' }}>
      <Typography variant="h6" gutterBottom sx={{ flexShrink: 0 }}>
        标注结果
      </Typography>
      <Box sx={{ flexGrow: 1, overflowY: 'auto' }}>
        <List dense>
          {annotations.map((anno) => (
            <ListItem
              key={anno.id}
              secondaryAction={
                <Tooltip title="播放此片段">
                  <IconButton edge="end" onClick={() => onPlaySegment(anno.startTime, anno.endTime)}>
                    <Play size={18} />
                  </IconButton>
                </Tooltip>
              }
            >
              <ListItemText
                primary={anno.gloss}
                secondary={`时间: ${formatTime(anno.startTime)}s - ${formatTime(anno.endTime)}s`}
              />
            </ListItem>
          ))}
        </List>
      </Box>
    </Paper>
  );
};