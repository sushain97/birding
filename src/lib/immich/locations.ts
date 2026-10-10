import { geoDistance, geoInterpolate } from "d3-geo";
import { minBy, sortedLastIndexBy } from "lodash-es";
import { immichClient, type AlbumAsset } from "./client";
import Config from "@/lib/config";
import { dawarichClient, type LocationPoint } from "@/lib/dawarich/client";

// Matches the way Dawarich's own Immich enrichment locates photos: interpolate
// between the two surrounding points when both are within the tolerance, else
// take the nearest point within it. Every asset is matched against the one
// Dawarich timeline, no matter who owns it.

export interface Coordinates {
  latitude: number;
  longitude: number;
}

export type LocationMatchMethod = "interpolated" | "nearest";

export type LocationPreviewStatus =
  "matched" | "unchanged" | "unmatched" | "error";

const EARTH_RADIUS_METERS = 6_371_008.8;

const UNCHANGED_METERS = 1;

export interface LocationPreviewEntry {
  assetId: string;
  fileName: string;
  /** ISO capture time the photo was matched at. */
  takenAt: string;
  owner: string;
  status: LocationPreviewStatus;
  current?: Coordinates;
  proposed?: Coordinates;
  method?: LocationMatchMethod;
  /** Seconds between the photo and the nearest point used. */
  deltaSeconds?: number;
  message?: string;
}

export interface LocationPreviewOptions {
  /** Inclusive `YYYY-MM-DD` bounds on the asset's creation date. */
  startDate: string;
  endDate: string;
  /** Max seconds between a photo and a point. */
  toleranceSeconds: number;
}

export interface LocationPreview {
  entries: LocationPreviewEntry[];
}

export interface LocationUpdate extends Coordinates {
  assetId: string;
}

export interface LocationUpdateResult {
  assetId: string;
  status: "updated" | "error";
  message?: string;
}

function hasGps(asset: AlbumAsset): boolean {
  return Boolean(asset.latitude) && Boolean(asset.longitude);
}

function takenAt(asset: AlbumAsset): string {
  return asset.dateTimeOriginal ?? asset.fileCreatedAt;
}

function unixSeconds(iso: string): number {
  return Math.floor(Date.parse(iso) / 1000);
}

/** Merges each photo's ±tolerance window so a burst of photos is a single
 * request and gaps between trips aren't fetched at all. */
async function fetchPointsAround(
  timestamps: number[],
  tolerance: number,
): Promise<LocationPoint[]> {
  const windows: [number, number][] = [];
  for (const ts of [...timestamps].sort((a, b) => a - b)) {
    const last = windows.at(-1);
    if (last && ts - tolerance <= last[1]) {
      last[1] = ts + tolerance;
    } else {
      windows.push([ts - tolerance, ts + tolerance]);
    }
  }

  const byTimestamp = new Map<number, LocationPoint>();
  for (const [startAt, endAt] of windows) {
    for (const point of await dawarichClient.getPoints(startAt, endAt)) {
      byTimestamp.set(point.timestamp, point);
    }
  }
  return [...byTimestamp.values()].sort((a, b) => a.timestamp - b.timestamp);
}

function distanceMeters(a: Coordinates, b: Coordinates): number {
  return (
    geoDistance([a.longitude, a.latitude], [b.longitude, b.latitude]) *
    EARTH_RADIUS_METERS
  );
}

function greatCircleInterpolate(
  before: Coordinates,
  after: Coordinates,
  fraction: number,
): Coordinates {
  // d3-geo works in [longitude, latitude].
  const [longitude, latitude] = geoInterpolate(
    [before.longitude, before.latitude],
    [after.longitude, after.latitude],
  )(fraction);
  return { latitude, longitude };
}

function match(
  ts: number,
  points: LocationPoint[],
  tolerance: number,
):
  (Coordinates & { deltaSeconds: number; method: LocationMatchMethod }) | null {
  // Index of the first point strictly after `ts`.
  const idx = sortedLastIndexBy<Pick<LocationPoint, "timestamp">>(
    points,
    { timestamp: ts },
    "timestamp",
  );
  const before = idx > 0 ? points[idx - 1] : undefined;
  const after = idx < points.length ? points[idx] : undefined;

  if (before && after && after.timestamp - before.timestamp <= tolerance) {
    const span = after.timestamp - before.timestamp;
    const fraction = span ? (ts - before.timestamp) / span : 0;
    return {
      ...greatCircleInterpolate(before, after, fraction),
      deltaSeconds: Math.min(ts - before.timestamp, after.timestamp - ts),
      method: "interpolated",
    };
  }

  const candidates = [before, after].filter(
    (p): p is LocationPoint =>
      p !== undefined && Math.abs(ts - p.timestamp) <= tolerance,
  );
  const nearest = minBy(candidates, (p) => Math.abs(ts - p.timestamp));
  if (!nearest) return null;

  return {
    latitude: nearest.latitude,
    longitude: nearest.longitude,
    deltaSeconds: Math.abs(ts - nearest.timestamp),
    method: "nearest",
  };
}

export async function previewLocations(
  albumId: string,
  options: LocationPreviewOptions,
): Promise<LocationPreview> {
  const assets = (await immichClient.getAlbumAssets(albumId))
    .filter((asset) => {
      const date = asset.fileCreatedAt.split("T")[0];
      return date >= options.startDate && date <= options.endDate;
    })
    .sort((a, b) => takenAt(a).localeCompare(takenAt(b)));

  const points = await fetchPointsAround(
    assets.map((asset) => unixSeconds(takenAt(asset))),
    options.toleranceSeconds,
  );

  const entries = assets.map((asset): LocationPreviewEntry => {
    const entry: LocationPreviewEntry = {
      assetId: asset.id,
      fileName: asset.fileName,
      takenAt: takenAt(asset),
      owner: asset.owner,
      status: "unmatched",
      current: hasGps(asset)
        ? { latitude: asset.latitude!, longitude: asset.longitude! }
        : undefined,
    };

    const result = match(
      unixSeconds(entry.takenAt),
      points,
      options.toleranceSeconds,
    );
    if (!result) return entry;

    const { latitude, longitude, deltaSeconds, method } = result;
    if (
      entry.current &&
      distanceMeters(entry.current, { latitude, longitude }) < UNCHANGED_METERS
    ) {
      return { ...entry, status: "unchanged" };
    }

    if (!(asset.ownerId.toLowerCase() in Config.immichOwnerApiKeys)) {
      return {
        ...entry,
        status: "error",
        message: `No IMMICH_API_KEY_<ownerId> set for ${asset.owner} (${asset.ownerId})`,
      };
    }

    return {
      ...entry,
      status: "matched",
      proposed: { latitude, longitude },
      method,
      deltaSeconds,
    };
  });

  return {
    entries,
  };
}

export async function applyLocations(
  updates: LocationUpdate[],
): Promise<LocationUpdateResult[]> {
  const results: LocationUpdateResult[] = [];

  for (const { assetId, latitude, longitude } of updates) {
    try {
      const { ownerId } = await immichClient.getAsset(assetId);
      const apiKey = Config.immichOwnerApiKeys[ownerId.toLowerCase()];
      if (!apiKey) {
        results.push({
          assetId,
          status: "error",
          message: `No IMMICH_API_KEY_<ownerId> set for ${ownerId}`,
        });
        continue;
      }
      await immichClient.updateAssetLocation(
        assetId,
        latitude,
        longitude,
        apiKey,
      );
      results.push({ assetId, status: "updated" });
    } catch (error) {
      results.push({
        assetId,
        status: "error",
        message: error instanceof Error ? error.message : String(error),
      });
    }
  }

  return results;
}
