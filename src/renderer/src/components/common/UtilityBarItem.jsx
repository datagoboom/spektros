// this should accept an icon, label, and a click handler
// it should be style to look like a top nav Container 

import { Container } from "@mui/material";
import { useTheme } from "../../theme";

export default function UtilityBarItem({ icon, label, iconColor, onClick, disabled = false }) {
  const theme = useTheme();
  
  return (
    <Container
      id="utility-bar-item"
      onClick={disabled ? undefined : onClick}
      sx={{
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        alignItems: "center",
        cursor: disabled ? "not-allowed" : "pointer",
        height: "62px",
        width: "64px",
        margin: "0",
        padding: "0",
        fontSize: "12px",
        color: disabled ? theme.palette.text.disabled : iconColor,
        opacity: disabled ? 0.5 : 1,
        transition: "all 0.2s ease-in-out",
        "&:hover": {
          backgroundColor: disabled ? "transparent" : theme.palette.background.sidebar,
        }
      }}
    >
      {icon}
    </Container>
  );
}
