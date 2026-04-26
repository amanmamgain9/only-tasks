"use client";

import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import MyWorkplaceComponent from "./MyWorkplaceComponents/MyWorkplaceComponent";

export default function WorkspaceApp() {
  return (
    <BrowserRouter basename="/app">
      <Routes>
        <Route path="/" element={<Navigate to="/workspace/all-tasks" replace />} />
        <Route path="/workspace" element={<Navigate to="/workspace/all-tasks" replace />} />
        <Route path="/workspace/all-tasks" element={<MyWorkplaceComponent regionOrder={1} />} />
        <Route path="/workspace/today" element={<MyWorkplaceComponent regionOrder={1} dueDateFilter="today" />} />
        <Route path="/workspace/tomorrow" element={<MyWorkplaceComponent regionOrder={1} dueDateFilter="tomorrow" />} />
        <Route path="/workspace/this-week" element={<MyWorkplaceComponent regionOrder={1} dueDateFilter="this-week" />} />
        <Route path="*" element={<Navigate to="/workspace/all-tasks" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
