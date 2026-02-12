import React from "react";

export default function ScreenShell({ children }) {
  return (
    <div style={{
      height: "100%",
      width: "100%",
      display: "grid",
      placeItems: "center",
      padding: 18,
    }}>
      <div style={{
        width: "min(860px, 100%)",
      }}>
        {children}
      </div>
    </div>
  );
}
