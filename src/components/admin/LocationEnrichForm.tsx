"use client";

import { useState } from "react";
import {
  Alert,
  Anchor,
  Badge,
  Button,
  Checkbox,
  Group,
  NumberInput,
  Stack,
  Table,
  Text,
  Title,
} from "@mantine/core";
import { DatePickerInput } from "@mantine/dates";
import "@mantine/dates/styles.css";
import type { LocationPreviewResponse } from "@/app/api/admin/locations/route";
import type { LocationApplyResponse } from "@/app/api/admin/locations/apply/route";
import type {
  Coordinates,
  LocationMatchMethod,
  LocationPreviewEntry,
  LocationUpdateResult,
} from "@/lib/immich/locations";

// A pending match is shown by how it was matched rather than as "matched".
type RowStatus =
  | Exclude<LocationPreviewEntry["status"], "matched">
  | LocationMatchMethod
  | LocationUpdateResult["status"];

// Interpolating between two nearby points is more trustworthy than snapping
// to a single one.
const STATUS_COLORS: Record<RowStatus, string> = {
  interpolated: "teal",
  nearest: "orange",
  unchanged: "green",
  unmatched: "gray",
  updated: "blue",
  error: "red",
};

const STATUS_ORDER: RowStatus[] = [
  "error",
  "interpolated",
  "nearest",
  "updated",
  "unchanged",
  "unmatched",
];

function rowStatus(
  entry: LocationPreviewEntry,
  result: LocationUpdateResult | undefined,
): RowStatus {
  if (result) return result.status;
  if (entry.status === "matched") return entry.method ?? "unmatched";
  return entry.status;
}

export interface LocationEnrichFormProps {
  immichBaseUrl: string;
}

function today(): string {
  return new Date().toLocaleDateString("sv");
}

async function postJson<T>(url: string, body: unknown): Promise<T> {
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    const error = (await response.json().catch(() => null)) as {
      error?: string;
    } | null;
    throw new Error(error?.error ?? `Request failed (${response.status})`);
  }
  return (await response.json()) as T;
}

function errorMessage(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}

export function LocationEnrichForm({ immichBaseUrl }: LocationEnrichFormProps) {
  const [[startDate, endDate], setRange] = useState<
    [string | null, string | null]
  >(() => [today(), today()]);
  const [toleranceMinutes, setToleranceMinutes] = useState<number>(15);
  const [preview, setPreview] = useState<LocationPreviewResponse | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [results, setResults] = useState<Map<string, LocationUpdateResult>>(
    new Map(),
  );
  const [error, setError] = useState<string | null>(null);
  const [isPreviewing, setIsPreviewing] = useState(false);
  const [isApplying, setIsApplying] = useState(false);

  async function handlePreview() {
    setIsPreviewing(true);
    setError(null);
    try {
      const body = await postJson<LocationPreviewResponse>(
        "/api/admin/locations",
        {
          startDate,
          endDate,
          toleranceSeconds: Math.round(toleranceMinutes * 60),
        },
      );
      setPreview(body);
      setResults(new Map());
      // Replacing a location a photo already has is opt-in per row.
      setSelected(
        new Set(
          body.entries
            .filter((entry) => entry.status === "matched" && !entry.current)
            .map((entry) => entry.assetId),
        ),
      );
    } catch (e) {
      setPreview(null);
      setError(errorMessage(e));
    } finally {
      setIsPreviewing(false);
    }
  }

  async function handleApply() {
    if (!preview) return;
    setIsApplying(true);
    setError(null);
    try {
      const updates = preview.entries
        .filter((entry) => selected.has(entry.assetId) && entry.proposed)
        .map((entry) => ({ assetId: entry.assetId, ...entry.proposed! }));
      const body = await postJson<LocationApplyResponse>(
        "/api/admin/locations/apply",
        { updates },
      );
      setResults((prev) => {
        const next = new Map(prev);
        for (const result of body.results) next.set(result.assetId, result);
        return next;
      });
      setSelected((prev) => {
        const next = new Set(prev);
        for (const result of body.results) {
          if (result.status === "updated") next.delete(result.assetId);
        }
        return next;
      });
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setIsApplying(false);
    }
  }

  return (
    <Stack gap="md">
      <Title order={4}>Enrich locations</Title>
      <Group align="flex-end" gap="sm">
        <DatePickerInput
          type="range"
          label="Dates"
          placeholder="Pick date range"
          value={[startDate, endDate]}
          onChange={setRange}
          maxDate={today()}
          weekendDays={[]}
          allowSingleDateInRange
        />
        <NumberInput
          label="Tolerance (minutes)"
          value={toleranceMinutes}
          onChange={(value) => setToleranceMinutes(Number(value) || 0)}
          min={1}
          allowDecimal={false}
          w={160}
        />
        <Button
          loading={isPreviewing}
          disabled={!startDate || !endDate || toleranceMinutes <= 0}
          onClick={() => void handlePreview()}
        >
          Preview
        </Button>
      </Group>
      {error && (
        <Alert color="red" title="Location enrichment failed">
          {error}
        </Alert>
      )}
      {preview && (
        <PreviewTable
          preview={preview}
          results={results}
          selected={selected}
          onSelectedChange={setSelected}
          onApply={() => void handleApply()}
          isApplying={isApplying}
          immichBaseUrl={immichBaseUrl}
        />
      )}
    </Stack>
  );
}

function PreviewTable({
  preview,
  results,
  selected,
  onSelectedChange,
  onApply,
  isApplying,
  immichBaseUrl,
}: {
  preview: LocationPreviewResponse;
  results: Map<string, LocationUpdateResult>;
  selected: Set<string>;
  onSelectedChange: (selected: Set<string>) => void;
  onApply: () => void;
  isApplying: boolean;
  immichBaseUrl: string;
}) {
  const { entries } = preview;

  const rows = entries
    .map((entry) => {
      const result = results.get(entry.assetId);
      return {
        entry,
        status: rowStatus(entry, result),
        message: result?.message ?? entry.message,
        selectable: entry.status === "matched" && result?.status !== "updated",
      };
    })
    .sort(
      (a, b) =>
        STATUS_ORDER.indexOf(a.status) - STATUS_ORDER.indexOf(b.status) ||
        a.entry.takenAt.localeCompare(b.entry.takenAt),
    );

  const selectableIds = rows
    .filter((row) => row.selectable)
    .map((row) => row.entry.assetId);
  const selectedCount = selectableIds.filter((id) => selected.has(id)).length;
  const allSelected =
    selectableIds.length > 0 && selectedCount === selectableIds.length;

  const locatedCount = rows.filter(
    (row) => row.entry.current ?? row.status === "updated",
  ).length;

  const counts = STATUS_ORDER.map(
    (status) =>
      [status, rows.filter((row) => row.status === status).length] as const,
  ).filter(([, count]) => count > 0);

  function toggle(assetId: string, checked: boolean) {
    const next = new Set(selected);
    if (checked) next.add(assetId);
    else next.delete(assetId);
    onSelectedChange(next);
  }

  return (
    <Stack gap="sm">
      <Group gap="xs">
        <Text size="sm" fw={600}>
          {locatedCount}/{rows.length} located
        </Text>
        {counts.map(([status, count]) => (
          <Badge key={status} color={STATUS_COLORS[status]} variant="light">
            {count} {status}
          </Badge>
        ))}
      </Group>
      {rows.length === 0 ? (
        <Text c="dimmed">No photos found in this date range.</Text>
      ) : (
        <>
          <Group>
            <Button
              loading={isApplying}
              disabled={selectedCount === 0}
              onClick={onApply}
            >
              Apply {selectedCount} selected
            </Button>
          </Group>
          <Table highlightOnHover striped withTableBorder>
            <Table.Thead>
              <Table.Tr>
                <Table.Th w={40}>
                  <Checkbox
                    aria-label="Select all"
                    checked={allSelected}
                    indeterminate={selectedCount > 0 && !allSelected}
                    disabled={selectableIds.length === 0}
                    onChange={() =>
                      onSelectedChange(
                        allSelected ? new Set() : new Set(selectableIds),
                      )
                    }
                  />
                </Table.Th>
                <Table.Th>Taken</Table.Th>
                <Table.Th>Photo</Table.Th>
                <Table.Th>Owner</Table.Th>
                <Table.Th>Status</Table.Th>
                <Table.Th>Location</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {rows.map(({ entry, status, message, selectable }) => (
                <Table.Tr key={entry.assetId}>
                  <Table.Td>
                    <Checkbox
                      aria-label={`Select ${entry.fileName}`}
                      checked={selectable && selected.has(entry.assetId)}
                      disabled={!selectable}
                      onChange={(e) =>
                        toggle(entry.assetId, e.currentTarget.checked)
                      }
                    />
                  </Table.Td>
                  <Table.Td>
                    {new Date(entry.takenAt).toLocaleString("sv")}
                  </Table.Td>
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
                    <Group gap="xs" wrap="nowrap">
                      <Badge
                        color={STATUS_COLORS[status]}
                        variant="light"
                        style={{ flexShrink: 0 }}
                      >
                        {status}
                      </Badge>
                      {entry.deltaSeconds !== undefined &&
                        status === entry.method && (
                          <Text
                            size="sm"
                            c="dimmed"
                            style={{ whiteSpace: "nowrap" }}
                          >
                            ±{formatDelta(entry.deltaSeconds)}
                          </Text>
                        )}
                    </Group>
                  </Table.Td>
                  <Table.Td>
                    <LocationCell entry={entry} message={message} />
                  </Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        </>
      )}
    </Stack>
  );
}

function LocationCell({
  entry,
  message,
}: {
  entry: LocationPreviewEntry;
  message?: string;
}) {
  const { current, proposed, distanceMeters } = entry;

  return (
    <Stack gap={0}>
      {current && proposed ? (
        <>
          <Text size="sm">
            <Text span td="line-through" c="dimmed" inherit>
              <MapLink coordinates={current} />
            </Text>{" "}
            →
          </Text>
          <Text size="sm" style={{ whiteSpace: "nowrap" }}>
            <MapLink coordinates={proposed} />
            {distanceMeters !== undefined && (
              <Text span c="dimmed" inherit>
                {" "}
                ({formatDistance(distanceMeters)})
              </Text>
            )}
          </Text>
        </>
      ) : (
        (proposed ?? current) && (
          <Text size="sm">
            <MapLink coordinates={(proposed ?? current)!} />
          </Text>
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

function MapLink({ coordinates }: { coordinates: Coordinates }) {
  const latitude = coordinates.latitude.toFixed(6);
  const longitude = coordinates.longitude.toFixed(6);
  return (
    <Anchor
      href={`https://www.openstreetmap.org/?mlat=${latitude}&mlon=${longitude}#map=17/${latitude}/${longitude}`}
      target="_blank"
      inherit
    >
      {coordinates.latitude.toFixed(3)}, {coordinates.longitude.toFixed(3)}
    </Anchor>
  );
}

const METERS_PER_FOOT = 0.3048;
const FEET_PER_MILE = 5280;

function formatDistance(meters: number): string {
  const feet = meters / METERS_PER_FOOT;
  if (feet >= FEET_PER_MILE) return `${(feet / FEET_PER_MILE).toFixed(1)} mi`;
  return `${Math.round(feet).toLocaleString()} ft`;
}

function formatDelta(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  const rest = seconds % 60;
  return rest ? `${minutes}m ${rest}s` : `${minutes}m`;
}
