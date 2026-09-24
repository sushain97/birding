import { immichClient, type AlbumAsset } from "./client";

const LOOKUP_CONCURRENCY = 8;

export type OrganizeStatus = "added" | "removed" | "error";

export interface OrganizeEntry {
  assetId: string;
  fileName: string;
  date: string;
  owner: string;
  status: OrganizeStatus;
  message?: string;
}

export interface OrganizeAlbumsOptions {
  dryRun: boolean;
}

export interface OrganizeAlbumsReport {
  entries: OrganizeEntry[];
  bestOfCount: number;
  birdingCount: number;
}

export function baseName(fileName: string): string {
  return stem(fileName)
    .replace(/-Enhanced-NR-edited$/, "")
    .replace(/-edited$/, "");
}

export function isEdited(fileName: string): boolean {
  const name = stem(fileName);
  return name.endsWith("-Enhanced-NR-edited") || name.endsWith("-edited");
}

function stem(fileName: string): string {
  const dot = fileName.lastIndexOf(".");
  return dot > 0 ? fileName.slice(0, dot) : fileName;
}

async function mapLimit<T, R>(
  items: T[],
  fn: (item: T) => Promise<R>,
): Promise<R[]> {
  const results: R[] = new Array<R>(items.length);
  let next = 0;

  await Promise.all(
    Array.from({ length: Math.min(LOOKUP_CONCURRENCY, items.length) }, () =>
      (async () => {
        while (next < items.length) {
          const index = next++;
          results[index] = await fn(items[index]);
        }
      })(),
    ),
  );

  return results;
}

function entry(
  asset: AlbumAsset,
  status: OrganizeStatus,
  message?: string,
): OrganizeEntry {
  return {
    assetId: asset.id,
    fileName: asset.fileName,
    date: asset.fileCreatedAt.split("T")[0],
    owner: asset.owner,
    status,
    message,
  };
}

export async function organizeAlbums(
  birdingAlbumId: string,
  bestOfAlbumId: string,
  options: OrganizeAlbumsOptions,
): Promise<OrganizeAlbumsReport> {
  const [birdingAssets, bestOfAssets] = await Promise.all([
    immichClient.getAlbumAssets(birdingAlbumId),
    immichClient.getAlbumAssets(bestOfAlbumId),
  ]);

  const added = await addMissingBestOfAssets(
    birdingAlbumId,
    birdingAssets,
    bestOfAssets,
    options,
  );
  const removed = await removeStackedOriginals(
    birdingAlbumId,
    [...birdingAssets, ...added.assets],
    options,
  );
  const stackIssues = await findUnstackedBestOfAssets(bestOfAssets);

  return {
    entries: [...added.entries, ...removed, ...stackIssues],
    bestOfCount: bestOfAssets.length,
    birdingCount:
      birdingAssets.length +
      added.assets.length -
      removed.filter((e) => e.status === "removed").length,
  };
}

async function addMissingBestOfAssets(
  birdingAlbumId: string,
  birdingAssets: AlbumAsset[],
  bestOfAssets: AlbumAsset[],
  options: OrganizeAlbumsOptions,
): Promise<{ assets: AlbumAsset[]; entries: OrganizeEntry[] }> {
  const birdingIds = new Set(birdingAssets.map((asset) => asset.id));
  const missing = bestOfAssets.filter((asset) => !birdingIds.has(asset.id));

  if (missing.length === 0) return { assets: [], entries: [] };

  if (!options.dryRun) {
    await immichClient.addAssetsToAlbum(
      birdingAlbumId,
      missing.map((asset) => asset.id),
    );
  }

  return {
    assets: missing,
    entries: missing.map((asset) =>
      entry(asset, "added", "Missing from Birding"),
    ),
  };
}

async function removeStackedOriginals(
  birdingAlbumId: string,
  birdingAssets: AlbumAsset[],
  options: OrganizeAlbumsOptions,
): Promise<OrganizeEntry[]> {
  // Camera file numbers repeat across shoots, so an edit and its original are
  // only a pair when they also share a capture time.
  const groups = new Map<string, AlbumAsset[]>();
  for (const asset of birdingAssets) {
    const key = `${baseName(asset.fileName)}\n${asset.dateTimeOriginal ?? ""}`;
    groups.set(key, [...(groups.get(key) ?? []), asset]);
  }

  const entries: OrganizeEntry[] = [];
  const pairs: { edited: AlbumAsset; original: AlbumAsset }[] = [];

  for (const group of groups.values()) {
    if (group.length === 1) continue;

    const names = group.map((asset) => asset.fileName).join(", ");
    if (group.length > 2) {
      entries.push(
        entry(
          group[0],
          "error",
          `More than 2 photos share a base name: ${names}`,
        ),
      );
      continue;
    }

    const [a, b] = group;
    const aEdited = isEdited(a.fileName);
    if (aEdited === isEdited(b.fileName)) {
      entries.push(
        entry(
          a,
          "error",
          `Both photos are ${aEdited ? "edited" : "originals"}: ${names}`,
        ),
      );
      continue;
    }

    pairs.push(
      aEdited ? { edited: a, original: b } : { edited: b, original: a },
    );
  }

  const stacks = await mapLimit(pairs, async ({ edited, original }) => [
    await stackIdOf(edited),
    await stackIdOf(original),
  ]);

  const toRemove: string[] = [];
  pairs.forEach(({ edited, original }, i) => {
    const [editedStackId, originalStackId] = stacks[i];
    if (!editedStackId || editedStackId !== originalStackId) {
      entries.push(
        entry(original, "error", `Not stacked with '${edited.fileName}'`),
      );
      return;
    }

    toRemove.push(original.id);
    entries.push(
      entry(original, "removed", `Keeping edited '${edited.fileName}'`),
    );
  });

  if (!options.dryRun) {
    await immichClient.removeAssetsFromAlbum(birdingAlbumId, toRemove);
  }

  return entries;
}

async function stackIdOf(asset: AlbumAsset): Promise<string | undefined> {
  return (await immichClient.getAssetStack(asset))?.id;
}

async function findUnstackedBestOfAssets(
  bestOfAssets: AlbumAsset[],
): Promise<OrganizeEntry[]> {
  const stacks = await mapLimit(bestOfAssets, (asset) =>
    immichClient.getAssetStack(asset),
  );

  return bestOfAssets.flatMap((asset, i) => {
    const stack = stacks[i];
    const message = !stack
      ? "Best of Birding photo is not stacked with an original"
      : stack.assetCount !== 2
        ? `Best of Birding photo's stack holds ${stack.assetCount} photos`
        : null;
    return message ? [entry(asset, "error", message)] : [];
  });
}
