import {
  applyLocations,
  type LocationUpdate,
  type LocationUpdateResult,
} from "@/lib/immich/locations";

export interface LocationApplyResponse {
  results: LocationUpdateResult[];
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function parseUpdates(body: unknown): LocationUpdate[] | string {
  const { updates } = (body ?? {}) as { updates?: unknown };
  if (!Array.isArray(updates) || updates.length === 0) {
    return "No updates given";
  }

  const parsed: LocationUpdate[] = [];
  for (const update of updates as unknown[]) {
    const { assetId, latitude, longitude } = (update ?? {}) as Partial<
      Record<keyof LocationUpdate, unknown>
    >;
    if (
      typeof assetId !== "string" ||
      !isFiniteNumber(latitude) ||
      !isFiniteNumber(longitude) ||
      Math.abs(latitude) > 90 ||
      Math.abs(longitude) > 180
    ) {
      return "Each update needs an assetId and valid coordinates";
    }
    parsed.push({ assetId, latitude, longitude });
  }
  return parsed;
}

let applyInFlight = false;

export async function POST(request: Request) {
  const updates = parseUpdates(await request.json());
  if (typeof updates === "string") {
    return Response.json({ error: updates }, { status: 400 });
  }

  if (applyInFlight) {
    return Response.json(
      { error: "An apply is already running" },
      { status: 429 },
    );
  }

  applyInFlight = true;
  try {
    const results = await applyLocations(updates);
    return Response.json({ results } satisfies LocationApplyResponse);
  } finally {
    applyInFlight = false;
  }
}
