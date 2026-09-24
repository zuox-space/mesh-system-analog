// src/app/dashboard/DashboardShell.tsx
"use client";

import { useState } from "react";
import { Sidebar } from "@/components/Sidebar";
import { Header } from "@/components/Header";

export function DashboardShell({
  user,
  children,
}: {
  user: {
    firstName?: string | null;
    lastName?: string | null;
    role: string;
  };
  children: React.ReactNode;
}) {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="flex min-h-screen w-full">
      <Sidebar
        role={user.role as "TEACHER" | "ADMIN"}
        open={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
      />
      <div className="flex-1 flex flex-col min-w-0 w-full">
        <Header
          title="Личный кабинет"
          user={user}
          onMenuClick={() => setSidebarOpen(true)}
        />
        <main className="flex-1 p-4 overflow-y-auto w-full">{children}</main>
      </div>
    </div>
  );
}