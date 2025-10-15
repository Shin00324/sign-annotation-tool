import { Box, Chip, List, ListItem, Paper, Typography } from "@mui/material";
import type { Task } from "../App"; // 确保从 App.tsx 导入

interface GlossPanelProps {
  task: Task | null;
  selectedGloss: string | null;
  onGlossSelect: (gloss: string) => void;
}

export const GlossPanel = ({
  task,
  selectedGloss,
  onGlossSelect,
}: GlossPanelProps) => {
  return (
    <Paper elevation={2} sx={{ p: 2, height: "100%", display: "flex", flexDirection: "column" }}>
      <Typography variant="h6" gutterBottom>词目标注</Typography>
      {task ? (
        <List sx={{ overflowY: "auto" }}>
          {task.glosses.map((gloss, index) => (
            <ListItem key={index}>
              <Chip
                label={gloss}
                variant={selectedGloss === gloss ? "filled" : "outlined"}
                color={selectedGloss === gloss ? "primary" : "default"}
                onClick={() => onGlossSelect(gloss)}
                sx={{ width: "100%", cursor: "pointer" }}
              />
            </ListItem>
          ))}
        </List>
      ) : (
        <Box sx={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%", color: "text.secondary" }}>
          <Typography>请从左侧选择一个任务</Typography>
        </Box>
      )}
    </Paper>
  );
};