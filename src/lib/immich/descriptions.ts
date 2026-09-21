import { immichClient } from "./client";
import {
  BEST_OF_CLASSES,
  BEST_OF_CLASS_SYMBOLS,
  type BestOfClass,
} from "./best-of-classes";
import Config from "@/lib/config";

export type DescriptionSyncStatus =
  "updated" | "unchanged" | "skipped" | "error";

export interface DescriptionSyncEntry {
  assetId: string;
  fileName: string;
  date: string;
  owner: string;
  status: DescriptionSyncStatus;
  description?: string;
  previousDescription?: string;
  message?: string;
}

export interface DescriptionSyncOptions {
  /** Inclusive `YYYY-MM-DD` bounds on the asset's creation date. */
  startDate: string;
  endDate: string;
  overwriteExisting: boolean;
  dryRun: boolean;
}

/** The description implied by a photo's `Birding/<species>/<class>` tag. */
export function buildDescription(tags: string[]):
  | { description: string }
  | {
      error: string;
    } {
  const birdingTags = tags.filter(
    (tag) => tag.split("/").length === 3 && tag.startsWith("Birding/"),
  );

  if (birdingTags.length === 0) {
    return {
      error: tags.length
        ? `No birding tag among: ${tags.join(", ")}`
        : "No tags",
    };
  }
  if (birdingTags.length > 1) {
    return { error: `Multiple birding tags: ${birdingTags.join(", ")}` };
  }

  const [, species, klass] = birdingTags[0].split("/");
  if (!BEST_OF_CLASSES.includes(klass as BestOfClass)) {
    return { error: `Invalid class '${klass}'` };
  }

  const symbol = BEST_OF_CLASS_SYMBOLS[klass as BestOfClass];
  return { description: symbol ? `${species} ${symbol}` : species };
}

export async function syncDescriptions(
  albumId: string,
  options: DescriptionSyncOptions,
): Promise<DescriptionSyncEntry[]> {
  const assets = (await immichClient.getAlbumAssets(albumId))
    .filter((asset) => {
      const date = asset.fileCreatedAt.split("T")[0];
      return date >= options.startDate && date <= options.endDate;
    })
    .sort((a, b) => b.fileCreatedAt.localeCompare(a.fileCreatedAt));

  const entries: DescriptionSyncEntry[] = [];

  for (const asset of assets) {
    const entry: DescriptionSyncEntry = {
      assetId: asset.id,
      fileName: asset.id,
      date: asset.fileCreatedAt.split("T")[0],
      owner: asset.owner,
      status: "error",
    };

    try {
      const detail = await immichClient.getAsset(asset.id);
      const currentDescription = detail.exifInfo?.description ?? "";
      entry.fileName = detail.originalFileName;
      entry.previousDescription = currentDescription;

      const built = buildDescription((detail.tags ?? []).map((t) => t.value));
      if ("error" in built) {
        entries.push({ ...entry, status: "skipped", message: built.error });
        continue;
      }
      entry.description = built.description;

      if (currentDescription === built.description) {
        entries.push({ ...entry, status: "unchanged" });
        continue;
      }
      if (currentDescription && !options.overwriteExisting) {
        entries.push({
          ...entry,
          status: "skipped",
          message: "Description already set",
        });
        continue;
      }

      const apiKey = Config.immichOwnerApiKeys[asset.ownerId.toLowerCase()];
      if (!options.dryRun) {
        if (!apiKey) {
          entries.push({
            ...entry,
            message: `No IMMICH_API_KEY_<ownerId> set for ${asset.owner} (${asset.ownerId})`,
          });
          continue;
        }
        await immichClient.updateAssetDescription(
          asset.id,
          built.description,
          apiKey,
        );
      }
      entries.push({ ...entry, status: "updated" });
    } catch (error) {
      entries.push({
        ...entry,
        status: "error",
        message: error instanceof Error ? error.message : String(error),
      });
    }
  }

  return entries;
}
