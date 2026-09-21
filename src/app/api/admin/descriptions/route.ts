import Config from "@/lib/config";
import {
  syncDescriptions,
  type DescriptionSyncEntry,
  type DescriptionSyncOptions,
} from "@/lib/immich/descriptions";

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export interface DescriptionSyncResponse {
  entries: DescriptionSyncEntry[];
}

function parseOptions(body: unknown): DescriptionSyncOptions | string {
  const { startDate, endDate, overwriteExisting, dryRun } = (body ??
    {}) as Partial<Record<keyof DescriptionSyncOptions, unknown>>;

  if (
    typeof startDate !== "string" ||
    typeof endDate !== "string" ||
    !DATE_PATTERN.test(startDate) ||
    !DATE_PATTERN.test(endDate)
  ) {
    return "Start and end dates are required";
  }
  if (startDate > endDate) {
    return "Start date must not be after the end date";
  }

  return {
    startDate,
    endDate,
    overwriteExisting: overwriteExisting === true,
    dryRun: dryRun === true,
  };
}

let syncInFlight = false;

export async function POST(request: Request) {
  const options = parseOptions(await request.json());
  if (typeof options === "string") {
    return Response.json({ error: options }, { status: 400 });
  }

  if (syncInFlight) {
    return Response.json(
      { error: "A sync is already running" },
      { status: 429 },
    );
  }

  syncInFlight = true;
  try {
    const entries = await syncDescriptions(
      Config.bestOfBirdingAlbumId,
      options,
    );
    return Response.json({ entries } satisfies DescriptionSyncResponse);
  } finally {
    syncInFlight = false;
  }
}
