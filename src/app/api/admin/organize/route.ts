import Config from "@/lib/config";
import {
  organizeAlbums,
  type OrganizeAlbumsReport,
} from "@/lib/immich/organize";

export type OrganizeAlbumsResponse = OrganizeAlbumsReport;

let organizeInFlight = false;

export async function POST(request: Request) {
  const { dryRun } = ((await request.json()) ?? {}) as { dryRun?: unknown };

  if (organizeInFlight) {
    return Response.json(
      { error: "An organize run is already in progress" },
      { status: 429 },
    );
  }

  organizeInFlight = true;
  try {
    const report = await organizeAlbums(
      Config.birdingAlbumId,
      Config.bestOfBirdingAlbumId,
      { dryRun: dryRun === true },
    );
    return Response.json(report satisfies OrganizeAlbumsResponse);
  } finally {
    organizeInFlight = false;
  }
}
