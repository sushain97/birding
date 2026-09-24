import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import {
  AssetMediaSize,
  type AssetResponseDto,
  addAssetsToAlbum,
  getAlbumInfo,
  getAssetInfo,
  init,
  removeAssetFromAlbum,
  searchAssets,
  updateAsset,
  viewAsset,
} from "@immich/sdk";
import Config from "@/lib/config";

init({ baseUrl: `${Config.immichBaseUrl}/api`, apiKey: Config.immichApiKey });

const TAG_CACHE_DIR = path.join(Config.cacheDir, "immich-tags");
const STACK_CACHE_DIR = path.join(Config.cacheDir, "immich-stacks");

export interface AlbumAsset {
  id: string;
  fileName: string;
  fileCreatedAt: string;
  dateTimeOriginal?: string;
  updatedAt: string;
  ownerId: string;
  owner: string;
}

export interface AssetStack {
  id: string;
  assetCount: number;
}

interface CachedStack {
  updatedAt: string;
  stack: AssetStack | null;
}

const SEARCH_PAGE_SIZE = 1000;

function withApiKey(apiKey: string) {
  return { headers: { "x-api-key": apiKey } };
}

class ImmichClient {
  async getAlbumAssets(albumId: string): Promise<AlbumAsset[]> {
    const album = await getAlbumInfo({ id: albumId });
    const ownerById = new Map(
      album.albumUsers.map((entry) => [entry.user.id, entry.user.name]),
    );

    const assets: AlbumAsset[] = [];
    for (let page = 1; ; page++) {
      const { assets: results } = await searchAssets({
        metadataSearchDto: {
          albumIds: [albumId],
          page,
          size: SEARCH_PAGE_SIZE,
          withExif: true,
        },
      });

      for (const asset of results.items) {
        assets.push({
          id: asset.id,
          fileName: asset.originalFileName,
          fileCreatedAt: asset.fileCreatedAt,
          dateTimeOriginal: asset.exifInfo?.dateTimeOriginal ?? undefined,
          updatedAt: asset.updatedAt,
          ownerId: asset.ownerId,
          owner: ownerById.get(asset.ownerId) ?? asset.ownerId,
        });
      }

      if (!results.nextPage) return assets;
    }
  }

  async getAssetTags(assetId: string): Promise<string[]> {
    const cached = await this.readCache<string[]>(TAG_CACHE_DIR, assetId);
    if (cached?.length) return cached;

    const asset = await getAssetInfo({ id: assetId });
    const tags = (asset.tags ?? []).map((tag) => tag.value);
    if (tags.length === 0) return tags;

    await this.writeCache(TAG_CACHE_DIR, assetId, tags);
    return tags;
  }

  async getAssetStack(asset: AlbumAsset): Promise<AssetStack | null> {
    const cached = await this.readCache<CachedStack>(STACK_CACHE_DIR, asset.id);
    if (cached?.updatedAt === asset.updatedAt) return cached.stack;

    const detail = await getAssetInfo({ id: asset.id });
    const stack = detail.stack ?? null;

    await this.writeCache(STACK_CACHE_DIR, asset.id, {
      updatedAt: asset.updatedAt,
      stack,
    } satisfies CachedStack);
    return stack;
  }

  async getAsset(assetId: string): Promise<AssetResponseDto> {
    return await getAssetInfo({ id: assetId });
  }

  async addAssetsToAlbum(albumId: string, assetIds: string[]): Promise<void> {
    if (assetIds.length === 0) return;
    await addAssetsToAlbum({ id: albumId, bulkIdsDto: { ids: assetIds } });
  }

  async removeAssetsFromAlbum(
    albumId: string,
    assetIds: string[],
  ): Promise<void> {
    if (assetIds.length === 0) return;
    await removeAssetFromAlbum({ id: albumId, bulkIdsDto: { ids: assetIds } });
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

  private async readCache<T>(dir: string, assetId: string): Promise<T | null> {
    try {
      const raw = await readFile(path.join(dir, `${assetId}.json`), "utf-8");
      return JSON.parse(raw) as T;
    } catch {
      return null;
    }
  }

  private async writeCache(
    dir: string,
    assetId: string,
    value: unknown,
  ): Promise<void> {
    await mkdir(dir, { recursive: true });
    await writeFile(path.join(dir, `${assetId}.json`), JSON.stringify(value));
  }
}

export const immichClient = new ImmichClient();
