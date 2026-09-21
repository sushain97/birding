import { Container, Group, Stack, Title } from "@mantine/core";
import { RefreshButton } from "@/components/RefreshButton";
import { TabNav } from "@/components/TabNav";
import { isAdminRequest } from "@/server/admin";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const isAdmin = await isAdminRequest();

  return (
    <Container size="lg" py="lg">
      <Stack gap="md">
        <Group justify="space-between">
          <Title order={2}>🦜 Birding</Title>
          {isAdmin && <RefreshButton />}
        </Group>
        <TabNav showAdmin={isAdmin} />
        {children}
      </Stack>
    </Container>
  );
}
