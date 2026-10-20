import Config from "@/lib/config";
import {
  compareWithInat,
  parseEbirdLifeList,
  type EbirdComparisonEntry,
} from "@/lib/ebird";
import { getObservations } from "@/lib/inat/observations";
import { readObservationsSnapshot } from "@/lib/snapshot";

export interface EbirdComparisonResponse {
  entries: EbirdComparisonEntry[];
  ebirdSpeciesCount: number;
  inatUpdatedAt: string;
}

export async function POST(request: Request) {
  const file = (await request.formData()).get("file");
  if (!(file instanceof File)) {
    return Response.json({ error: "A CSV file is required" }, { status: 400 });
  }

  let ebirdTaxons: Map<string, string>;
  try {
    ebirdTaxons = parseEbirdLifeList(await file.text());
  } catch (e) {
    return Response.json(
      { error: e instanceof Error ? e.message : String(e) },
      { status: 400 },
    );
  }

  const snapshot = await readObservationsSnapshot();
  const { summary, updatedAt } = snapshot ?? {
    ...(await getObservations(Config.inatUserId)),
    updatedAt: new Date(),
  };

  return Response.json({
    entries: compareWithInat(ebirdTaxons, summary),
    ebirdSpeciesCount: ebirdTaxons.size,
    inatUpdatedAt: updatedAt.toISOString(),
  } satisfies EbirdComparisonResponse);
}
