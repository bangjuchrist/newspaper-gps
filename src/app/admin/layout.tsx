import AdminSidebar from "@/components/admin/AdminSidebar";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen bg-[#0f1117]">
      <AdminSidebar />
      <main className="flex-1 min-w-0 lg:ml-60">{children}</main>
    </div>
  );
}
