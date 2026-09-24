"use client";

import { useState } from "react";
import {
  Alert,
  Anchor,
  Badge,
  Button,
  Checkbox,
  Group,
  Stack,
  Table,
  Text,
  Title,
} from "@mantine/core";
import type { OrganizeAlbumsResponse } from "@/app/api/admin/organize/route";
import type { OrganizeEntry, OrganizeStatus } from "@/lib/immich/organize";

const STATUS_COLORS: Record<OrganizeStatus, string> = {
  added: "green",
  removed: "blue",
  error: "red",
};

const STATUS_ORDER: OrganizeStatus[] = ["error", "removed", "added"];

export interface OrganizeAlbumsFormProps {
  immichBaseUrl: string;
}

export function OrganizeAlbumsForm({ immichBaseUrl }: OrganizeAlbumsFormProps) {
  const [dryRun, setDryRun] = useState(false);
  const [report, setReport] = useState<OrganizeAlbumsResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isRunning, setIsRunning] = useState(false);

  async function handleRun() {
    setIsRunning(true);
    setError(null);
    try {
      const response = await fetch("/api/admin/organize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dryRun }),
      });
      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as {
          error?: string;
        } | null;
        setReport(null);
        setError(body?.error ?? `Request failed (${response.status})`);
        return;
      }
      setReport((await response.json()) as OrganizeAlbumsResponse);
    } catch (e) {
      setReport(null);
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setIsRunning(false);
    }
  }

  return (
    <Stack gap="md">
      <Title order={4}>Organize albums</Title>
      <Group align="center" gap="lg">
        <Button loading={isRunning} onClick={() => void handleRun()}>
          {dryRun ? "Preview" : "Organize"}
        </Button>
        <Checkbox
          label="Dry run"
          checked={dryRun}
          onChange={(e) => setDryRun(e.currentTarget.checked)}
        />
      </Group>
      {error && (
        <Alert color="red" title="Organize failed">
          {error}
        </Alert>
      )}
      {report && <Report report={report} immichBaseUrl={immichBaseUrl} />}
    </Stack>
  );
}

function Report({
  report,
  immichBaseUrl,
}: {
  report: OrganizeAlbumsResponse;
  immichBaseUrl: string;
}) {
  const { entries, bestOfCount, birdingCount } = report;

  const counts = STATUS_ORDER.map(
    (status) =>
      [status, entries.filter((e) => e.status === status).length] as const,
  ).filter(([, count]) => count > 0);

  const sorted = [...entries].sort(
    (a, b) =>
      STATUS_ORDER.indexOf(a.status) - STATUS_ORDER.indexOf(b.status) ||
      b.date.localeCompare(a.date),
  );

  return (
    <Stack gap="sm">
      <Group gap="xs">
        {counts.map(([status, count]) => (
          <Badge key={status} color={STATUS_COLORS[status]} variant="light">
            {count} {status}
          </Badge>
        ))}
        <Text size="sm" c="dimmed">
          {bestOfCount}/{birdingCount} photos in Best of Birding (
          {birdingCount > 0
            ? ((bestOfCount / birdingCount) * 100).toFixed(2)
            : "0.00"}
          %)
        </Text>
      </Group>
      {sorted.length === 0 ? (
        <Text c="dimmed">Nothing to do.</Text>
      ) : (
        <Table highlightOnHover striped withTableBorder>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>Date</Table.Th>
              <Table.Th>Photo</Table.Th>
              <Table.Th>Owner</Table.Th>
              <Table.Th>Status</Table.Th>
              <Table.Th>Details</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {sorted.map((entry: OrganizeEntry) => (
              <Table.Tr key={`${entry.status}-${entry.assetId}`}>
                <Table.Td>{entry.date}</Table.Td>
                <Table.Td>
                  <Anchor
                    href={`${immichBaseUrl}/photos/${entry.assetId}`}
                    target="_blank"
                    size="sm"
                  >
                    {entry.fileName}
                  </Anchor>
                </Table.Td>
                <Table.Td>{entry.owner}</Table.Td>
                <Table.Td>
                  <Badge color={STATUS_COLORS[entry.status]} variant="light">
                    {entry.status}
                  </Badge>
                </Table.Td>
                <Table.Td>
                  <Text size="sm" c="dimmed">
                    {entry.message}
                  </Text>
                </Table.Td>
              </Table.Tr>
            ))}
          </Table.Tbody>
        </Table>
      )}
    </Stack>
  );
}
