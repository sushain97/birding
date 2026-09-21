import { Stack } from "@mantine/core";
import Config from "@/lib/config";
import { DescriptionSyncForm } from "@/components/admin/DescriptionSyncForm";

export default function AdminPage() {
  return (
    <Stack gap="md">
      <DescriptionSyncForm immichBaseUrl={Config.immichBaseUrl} />
    </Stack>
  );
}
