import Config from "@/lib/config";
import {
  previewLocations,
  type LocationPreview,
  type LocationPreviewOptions,
} from "@/lib/immich/locations";

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export type LocationPreviewResponse = LocationPreview;

function parseOptions(body: unknown): LocationPreviewOptions | string {
  const { startDate, endDate, toleranceSeconds } = (body ?? {}) as Partial<
    Record<keyof LocationPreviewOptions, unknown>
  >;

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
  if (
    typeof toleranceSeconds !== "number" ||
    !Number.isInteger(toleranceSeconds) ||
    toleranceSeconds <= 0
  ) {
    return "Tolerance must be a positive number of seconds";
  }

  return {
    startDate,
    endDate,
    toleranceSeconds,
  };
}

export async function POST(request: Request) {
  const options = parseOptions(await request.json());
  if (typeof options === "string") {
    return Response.json({ error: options }, { status: 400 });
  }

  const preview = await previewLocations(Config.bestOfBirdingAlbumId, options);
  return Response.json(preview satisfies LocationPreviewResponse);
}
