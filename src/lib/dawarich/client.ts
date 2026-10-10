import Config from "@/lib/config";

const POINTS_PAGE_SIZE = 10000;

export interface LocationPoint {
  timestamp: number;
  latitude: number;
  longitude: number;
}

interface PointResponse {
  timestamp: number;
  latitude: string | number;
  longitude: string | number;
}

class DawarichClient {
  /** Points between the inclusive unix-second bounds, oldest first. */
  async getPoints(startAt: number, endAt: number): Promise<LocationPoint[]> {
    if (!Config.dawarichApiKey) throw new Error("DAWARICH_API_KEY is not set");

    const points: LocationPoint[] = [];
    for (let page = 1, totalPages = 1; page <= totalPages; page++) {
      const url = new URL(`${Config.dawarichBaseUrl}/api/v1/points`);
      url.search = new URLSearchParams({
        start_at: String(startAt),
        end_at: String(endAt),
        order: "asc",
        slim: "true",
        per_page: String(POINTS_PAGE_SIZE),
        page: String(page),
      }).toString();

      const response = await fetch(url, {
        headers: { Authorization: `Bearer ${Config.dawarichApiKey}` },
      });
      if (!response.ok) {
        throw new Error(
          `Dawarich points request failed (${response.status}): ${await response.text()}`,
        );
      }

      for (const point of (await response.json()) as PointResponse[]) {
        points.push({
          timestamp: point.timestamp,
          latitude: Number(point.latitude),
          longitude: Number(point.longitude),
        });
      }
      totalPages = Number(response.headers.get("X-Total-Pages") ?? 1);
    }
    return points;
  }
}

export const dawarichClient = new DawarichClient();
