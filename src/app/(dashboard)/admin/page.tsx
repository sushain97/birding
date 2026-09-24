import { notFound } from "next/navigation";
import { Divider, Stack } from "@mantine/core";
import Config from "@/lib/config";
import { DescriptionSyncForm } from "@/components/admin/DescriptionSyncForm";
import { OrganizeAlbumsForm } from "@/components/admin/OrganizeAlbumsForm";
import { isAdminRequest } from "@/server/admin";

export default async function AdminPage() {
  if (!(await isAdminRequest())) notFound();

  return (
    <Stack gap="md">
      <DescriptionSyncForm immichBaseUrl={Config.immichBaseUrl} />
      <Divider />
      <OrganizeAlbumsForm immichBaseUrl={Config.immichBaseUrl} />
    </Stack>
  );
}
