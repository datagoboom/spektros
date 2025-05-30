import React from "react";
import { Container } from "@mui/material";
import { Outlet } from "react-router-dom";
import { useTheme } from "../theme";

// components
import Sidebar from "./common/Sidebar";

export default function Layout() {
  const theme = useTheme();

  return (
    <Container maxWidth={false} id="layout-main" disableGutters sx={{ display: "flex", flexDirection: "column" }}>
      <Container maxWidth={false} id="layout-body" disableGutters sx={{ display: "flex", flexDirection: "row"}}>
        <Sidebar />
        <Container
          id="layout-content"
          maxWidth={false}
          disableGutters
          sx={{
            backgroundColor: theme.palette.background.default,
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
            alignItems: "center",
            height: "100vh",
            width: "100%",
            color: theme.palette.text.primary,
          }}
        >
          <Outlet />
        </Container>
      </Container>
    </Container>
  );
}