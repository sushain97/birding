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
import { DatePickerInput } from "@mantine/dates";
import "@mantine/dates/styles.css";
import type { DescriptionSyncResponse } from "@/app/api/admin/descriptions/route";
import type {
  DescriptionSyncEntry,
  DescriptionSyncStatus,
} from "@/lib/immich/descriptions";

const STATUS_COLORS: Record<DescriptionSyncStatus, string> = {
  updated: "green",
  unchanged: "gray",
  skipped: "yellow",
  error: "red",
};

const STATUS_ORDER: DescriptionSyncStatus[] = [
  "updated",
  "error",
  "skipped",
  "unchanged",
];

export interface DescriptionSyncFormProps {
  immichBaseUrl: string;
}

function today(): string {
  return new Date().toLocaleDateString("sv");
}

export function DescriptionSyncForm({
  immichBaseUrl,
}: DescriptionSyncFormProps) {
  const [[startDate, endDate], setRange] = useState<
    [string | null, string | null]
  >(() => [today(), today()]);
  const [overwriteExisting, setOverwriteExisting] = useState(false);
  const [dryRun, setDryRun] = useState(false);
  const [entries, setEntries] = useState<DescriptionSyncEntry[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isRunning, setIsRunning] = useState(false);

  async function handleRun() {
    setIsRunning(true);
    setError(null);
    try {
      const response = await fetch("/api/admin/descriptions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ startDate, endDate, overwriteExisting, dryRun }),
      });
      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as {
          error?: string;
        } | null;
        setEntries(null);
        setError(body?.error ?? `Request failed (${response.status})`);
        return;
      }
      const body = (await response.json()) as DescriptionSyncResponse;
      setEntries(body.entries);
    } catch (e) {
      setEntries(null);
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setIsRunning(false);
    }
  }

  return (
    <Stack gap="md">
      <Title order={4}>Sync descriptions</Title>
      <Group align="flex-end" gap="sm">
        <DatePickerInput
          type="range"
          label="Dates"
          placeholder="Pick dates range"
          value={[startDate, endDate]}
          onChange={setRange}
          allowSingleDateInRange
        />
        <Button
          loading={isRunning}
          disabled={!startDate || !endDate}
          onClick={() => void handleRun()}
        >
          {dryRun ? "Preview" : "Update descriptions"}
        </Button>
      </Group>
      <Group gap="lg">
        <Checkbox
          label="Overwrite existing descriptions"
          checked={overwriteExisting}
          onChange={(e) => setOverwriteExisting(e.currentTarget.checked)}
        />
        <Checkbox
          label="Dry run"
          checked={dryRun}
          onChange={(e) => setDryRun(e.currentTarget.checked)}
        />
      </Group>
      {error && (
        <Alert color="red" title="Sync failed">
          {error}
        </Alert>
      )}
      {entries && (
        <SyncEntries entries={entries} immichBaseUrl={immichBaseUrl} />
      )}
    </Stack>
  );
}

function SyncEntries({
  entries,
  immichBaseUrl,
}: {
  entries: DescriptionSyncEntry[];
  immichBaseUrl: string;
}) {
  if (entries.length === 0) {
    return <Text c="dimmed">No photos in this date range.</Text>;
  }

  const counts = STATUS_ORDER.map(
    (status) =>
      [status, entries.filter((e) => e.status === status).length] as const,
  ).filter(([, count]) => count > 0);

  const sorted = [...entries].sort(
    (a, b) => STATUS_ORDER.indexOf(a.status) - STATUS_ORDER.indexOf(b.status),
  );

  return (
    <Stack gap="sm">
      <Group gap="xs">
        {counts.map(([status, count]) => (
          <Badge key={status} color={STATUS_COLORS[status]} variant="light">
            {count} {status}
          </Badge>
        ))}
      </Group>
      <Table highlightOnHover striped withTableBorder>
        <Table.Thead>
          <Table.Tr>
            <Table.Th>Date</Table.Th>
            <Table.Th>Photo</Table.Th>
            <Table.Th>Owner</Table.Th>
            <Table.Th>Status</Table.Th>
            <Table.Th>Description</Table.Th>
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {sorted.map((entry) => (
            <Table.Tr key={entry.assetId}>
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
                <DescriptionCell entry={entry} />
              </Table.Td>
            </Table.Tr>
          ))}
        </Table.Tbody>
      </Table>
    </Stack>
  );
}

function DescriptionCell({ entry }: { entry: DescriptionSyncEntry }) {
  const { description, previousDescription, message } = entry;
  const replaces = description && previousDescription;

  return (
    <Stack gap={0}>
      {replaces ? (
        <Text size="sm">
          <Text span td="line-through" c="dimmed" inherit>
            {previousDescription}
          </Text>{" "}
          → {description}
        </Text>
      ) : (
        (description ?? previousDescription) && (
          <Text size="sm">{description ?? previousDescription}</Text>
        )
      )}
      {message && (
        <Text size="xs" c="dimmed">
          {message}
        </Text>
      )}
    </Stack>
  );
}
