import React from "react";
import { Container } from "@mui/material";
import { Outlet } from "react-router-dom";
import { useTheme } from "../theme";


import Sidebar from "./common/Sidebar";

export default function Layout() {
  const theme = useTheme();

  return (
    <Container 
      maxWidth={false} 
      id="layout-main" 
      disableGutters 
      sx={{ 
        display: "flex", 
        flexDirection: "column",
        height: "100vh",
        overflow: "hidden" 
      }}
    >
      <Container 
        maxWidth={false} 
        id="layout-body" 
        disableGutters 
        sx={{ 
          display: "flex", 
          flexDirection: "row",
          flex: 1,
          overflow: "hidden" 
        }}
      >
        <Sidebar />
        <Container
          id="layout-content"
          maxWidth={false}
          disableGutters
          sx={{
            backgroundColor: theme.palette.background.default,
            display: "flex",
            flexDirection: "column",
            flex: 1,
            overflow: "hidden", 
            color: theme.palette.text.primary,
          }}
        >
          <Outlet />
        </Container>
      </Container>
    </Container>
  );
}