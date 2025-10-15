import { Box, Typography } from "@mui/material";

export const Footer = () => {
  return (
    <Box
      component="footer"
      sx={{
        p: 1,
        textAlign: "center",
        borderTop: "1px solid #444",
      }}
    >
      <Typography variant="body2" color="text.secondary">
        © 2025 手语研究项目
      </Typography>
    </Box>
  );
};
