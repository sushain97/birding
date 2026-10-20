"use client";

import { useState } from "react";
import {
  Alert,
  Anchor,
  Badge,
  Button,
  FileInput,
  Group,
  Stack,
  Table,
  Text,
  Title,
} from "@mantine/core";
import { FileCsvIcon } from "@phosphor-icons/react";
import type { EbirdComparisonResponse } from "@/app/api/admin/ebird/route";
import type { EbirdComparisonEntry, EbirdComparisonStatus } from "@/lib/ebird";

const EBIRD_LIFE_LIST_CSV_URL =
  "https://ebird.org/lifelist?r=world&time=life&fmt=csv";

const STATUS_LABELS: Record<EbirdComparisonStatus, string> = {
  "missing-in-inat": "missing in iNat",
  "needs-id": "needs ID in iNat",
  "missing-in-ebird": "missing in eBird",
};

const STATUS_COLORS: Record<EbirdComparisonStatus, string> = {
  "missing-in-inat": "orange",
  "needs-id": "yellow",
  "missing-in-ebird": "blue",
};

const STATUS_ORDER: EbirdComparisonStatus[] = [
  "missing-in-inat",
  "needs-id",
  "missing-in-ebird",
];

function inatUrl(entry: EbirdComparisonEntry): string {
  return entry.inatTaxonId
    ? `https://www.inaturalist.org/taxa/${entry.inatTaxonId}`
    : `https://www.inaturalist.org/taxa/search?q=${encodeURIComponent(entry.scientificName)}`;
}

export function EbirdCompareForm() {
  const [file, setFile] = useState<File | null>(null);
  const [response, setResponse] = useState<EbirdComparisonResponse | null>(
    null,
  );
  const [error, setError] = useState<string | null>(null);
  const [isRunning, setIsRunning] = useState(false);

  async function handleCompare() {
    if (!file) return;
    setIsRunning(true);
    setError(null);
    try {
      const formData = new FormData();
      formData.set("file", file);
      const res = await fetch("/api/admin/ebird", {
        method: "POST",
        body: formData,
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as {
          error?: string;
        } | null;
        setResponse(null);
        setError(body?.error ?? `Request failed (${res.status})`);
        return;
      }
      setResponse((await res.json()) as EbirdComparisonResponse);
    } catch (e) {
      setResponse(null);
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setIsRunning(false);
    }
  }

  return (
    <Stack gap="md">
      <Title order={4}>Compare with eBird</Title>
      <Text size="sm" c="dimmed">
        <Anchor href={EBIRD_LIFE_LIST_CSV_URL} inherit>
          Download your eBird life list
        </Anchor>{" "}
        and upload it here.
      </Text>
      {/* FileInput only opens a picker, so accept drops on the whole row. */}
      <Group
        align="flex-end"
        gap="sm"
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault();
          if (e.dataTransfer.files.length > 0) {
            setFile(e.dataTransfer.files[0]);
          }
        }}
      >
        <FileInput
          label="Life list CSV"
          placeholder="ebird_world_life_list.csv"
          accept=".csv,text/csv"
          leftSection={<FileCsvIcon size={18} />}
          value={file}
          onChange={setFile}
          clearable
          w={300}
        />
        <Button
          loading={isRunning}
          disabled={!file}
          onClick={() => void handleCompare()}
        >
          Compare
        </Button>
      </Group>
      {error && (
        <Alert color="red" title="Comparison failed">
          {error}
        </Alert>
      )}
      {response && <ComparisonEntries response={response} />}
    </Stack>
  );
}

function ComparisonEntries({
  response: { entries, ebirdSpeciesCount, inatUpdatedAt },
}: {
  response: EbirdComparisonResponse;
}) {
  const summary = (
    <Text size="sm" c="dimmed">
      {ebirdSpeciesCount} eBird species, compared against iNat data from{" "}
      {new Date(inatUpdatedAt).toLocaleString()}.
    </Text>
  );

  if (entries.length === 0) {
    return (
      <Stack gap="sm">
        {summary}
        <Text>eBird and iNaturalist agree.</Text>
      </Stack>
    );
  }

  const counts = STATUS_ORDER.map(
    (status) =>
      [status, entries.filter((e) => e.status === status).length] as const,
  ).filter(([, count]) => count > 0);

  const sorted = [...entries].sort(
    (a, b) =>
      STATUS_ORDER.indexOf(a.status) - STATUS_ORDER.indexOf(b.status) ||
      a.commonName.localeCompare(b.commonName),
  );

  return (
    <Stack gap="sm">
      {summary}
      <Group gap="xs">
        {counts.map(([status, count]) => (
          <Badge key={status} color={STATUS_COLORS[status]} variant="light">
            {count} {STATUS_LABELS[status]}
          </Badge>
        ))}
      </Group>
      <Table highlightOnHover striped withTableBorder>
        <Table.Thead>
          <Table.Tr>
            <Table.Th>Species</Table.Th>
            <Table.Th>Scientific name</Table.Th>
            <Table.Th>Status</Table.Th>
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {sorted.map((entry) => (
            <Table.Tr key={entry.scientificName}>
              <Table.Td>{entry.commonName}</Table.Td>
              <Table.Td>
                <Anchor href={inatUrl(entry)} target="_blank" size="sm">
                  <i>{entry.scientificName}</i>
                </Anchor>
              </Table.Td>
              <Table.Td>
                <Badge color={STATUS_COLORS[entry.status]} variant="light">
                  {STATUS_LABELS[entry.status]}
                </Badge>
              </Table.Td>
            </Table.Tr>
          ))}
        </Table.Tbody>
      </Table>
    </Stack>
  );
}
