import { notFound } from "next/navigation";
import Config from "@/lib/config";
import { AdminPanel } from "@/components/admin/AdminPanel";
import { isAdminRequest } from "@/server/admin";

export default async function AdminPage() {
  if (!(await isAdminRequest())) notFound();

  return <AdminPanel immichBaseUrl={Config.immichBaseUrl} />;
}
