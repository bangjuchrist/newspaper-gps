import AdminSidebar from "@/components/admin/AdminSidebar";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-screen overflow-hidden bg-[#0f1117]">
      <AdminSidebar />
      <main className="flex-1 min-w-0 lg:ml-60 overflow-auto">{children}</main>
    </div>
  );
}
