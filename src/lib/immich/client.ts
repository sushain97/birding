import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import {
  AssetMediaSize,
  type AssetResponseDto,
  getAlbumInfo,
  getAssetInfo,
  getTimeBucket,
  getTimeBuckets,
  init,
  updateAsset,
  viewAsset,
} from "@immich/sdk";
import Config from "@/lib/config";

init({ baseUrl: `${Config.immichBaseUrl}/api`, apiKey: Config.immichApiKey });

const TAG_CACHE_DIR = path.join(Config.cacheDir, "immich-tags");

export interface AlbumAsset {
  id: string;
  fileCreatedAt: string;
  ownerId: string;
  owner: string;
}

function withApiKey(apiKey: string) {
  return { headers: { "x-api-key": apiKey } };
}

class ImmichClient {
  async getAlbumAssets(albumId: string): Promise<AlbumAsset[]> {
    const album = await getAlbumInfo({ id: albumId });
    const ownerById = new Map(
      album.albumUsers.map((entry) => [entry.user.id, entry.user.name]),
    );

    const buckets = await getTimeBuckets({ albumId, isTrashed: false });

    const assets: AlbumAsset[] = [];
    for (const { timeBucket } of buckets) {
      const bucket = await getTimeBucket({
        albumId,
        timeBucket,
        isTrashed: false,
      });
      for (let i = 0; i < bucket.id.length; i++) {
        assets.push({
          id: bucket.id[i],
          fileCreatedAt: bucket.fileCreatedAt[i],
          ownerId: bucket.ownerId[i],
          owner: ownerById.get(bucket.ownerId[i]) ?? bucket.ownerId[i],
        });
      }
    }

    return assets;
  }

  /** Tags never expire once cached. */
  async getAssetTags(assetId: string): Promise<string[]> {
    const cached = await this.readTagCache(assetId);
    if (cached) return cached;

    const asset = await getAssetInfo({ id: assetId });
    const tags = (asset.tags ?? []).map((tag) => tag.value);

    await this.writeTagCache(assetId, tags);
    return tags;
  }

  async getAsset(assetId: string): Promise<AssetResponseDto> {
    return await getAssetInfo({ id: assetId });
  }

  async updateAssetDescription(
    assetId: string,
    description: string,
    apiKey: string,
  ): Promise<void> {
    await updateAsset(
      { id: assetId, updateAssetDto: { description } },
      withApiKey(apiKey),
    );
  }

  async getAssetThumbnail(assetId: string): Promise<Buffer> {
    const blob = await viewAsset({
      id: assetId,
      size: AssetMediaSize.Thumbnail,
    });
    return Buffer.from(await blob.arrayBuffer());
  }

  private async readTagCache(assetId: string): Promise<string[] | null> {
    try {
      const raw = await readFile(
        path.join(TAG_CACHE_DIR, `${assetId}.json`),
        "utf-8",
      );
      const tags = JSON.parse(raw) as string[];
      return tags.length > 0 ? tags : null;
    } catch {
      return null;
    }
  }

  private async writeTagCache(assetId: string, tags: string[]): Promise<void> {
    await mkdir(TAG_CACHE_DIR, { recursive: true });
    await writeFile(
      path.join(TAG_CACHE_DIR, `${assetId}.json`),
      JSON.stringify(tags),
    );
  }
}

export const immichClient = new ImmichClient();
