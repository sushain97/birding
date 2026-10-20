import { countBy, groupBy, maxBy, sortBy } from "lodash-es";
import { countryFlag } from "./localities";
import { taxonLabel } from "./taxonLabels";
import type { ChartSeries } from "@/components/charts/BarChart";
import type { Observation, ObservationSummary } from "@/lib/inat/observations";
import { paletteColor } from "@/components/charts/palette";

const START_DATE = "2025-09-01";
const US_PLACE_ID = 1;

const regionNames = new Intl.DisplayNames(["en"], { type: "region" });

export interface SpeciesOverTimeRow {
  /** Day timestamp (ms). */
  t: number;
  /** Cumulative research grade species as of this day. */
  total: number;
  /** Key into `groups`: the day's majority country, or state in the US. */
  group: string;
  /** e.g. "Krabi, Thailand" */
  placeLabel: string;
  /** New species that day, by iconic taxon label, largest first. */
  deltas: [label: string, count: number][];
}

export interface SpeciesOverTimeFigure {
  data: SpeciesOverTimeRow[];
  groups: ChartSeries[];
}

export function buildSpeciesOverTimeFigure(
  summary: ObservationSummary,
  placeNames: ReadonlyMap<number, string>,
): SpeciesOverTimeFigure {
  const firsts = summary.firstResearchObservations.filter(
    (o) => o.place_ids.length > 1,
  );

  // Localities (states/provinces) are named like "Krabi, TH".
  const localityParts = (obs: Observation) => {
    const display = placeNames.get(obs.place_ids[1]) ?? "";
    const [name, code] = display.split(/,\s*(?=[A-Z]{2}$)/);
    return { name, code, display };
  };
  const countryName = (obs: Observation) => {
    const { code } = localityParts(obs);
    return (code && regionNames.of(code)) ?? String(obs.place_ids[0]);
  };
  const isUS = (obs: Observation) => obs.place_ids[0] === US_PLACE_ID;
  /** Country, except the US is split by state. */
  const groupOf = (obs: Observation) =>
    String(isUS(obs) ? obs.place_ids[1] : obs.place_ids[0]);

  const priorTotal = summary.firstResearchObservations.filter(
    (o) => o.observed_on < START_DATE,
  ).length;
  const days = Object.entries(
    groupBy(
      firsts.filter((o) => o.observed_on >= START_DATE),
      (o) => o.observed_on,
    ),
  );

  /** Each day's representative observation, from its majority locality. */
  const dayObs = new Map(
    days.map(([day, obsList]) => {
      const byLocality = groupBy(obsList, (o) => o.place_ids[1]);
      return [day, maxBy(Object.values(byLocality), (g) => g.length)![0]];
    }),
  );

  const groupDays = countBy([...dayObs.values()], groupOf);
  const ranked = sortBy(Object.keys(groupDays), (g) => -groupDays[g]);

  let total = priorTotal;
  const data = days.map(([day, obsList]) => {
    total += obsList.length;
    const obs = dayObs.get(day)!;
    const taxonCounts = countBy(obsList, (o) => o.taxon.iconic_taxon_name);
    return {
      t: Date.parse(day),
      total,
      group: groupOf(obs),
      placeLabel:
        `${countryFlag(localityParts(obs).display)} ${localityParts(obs).name}, ${countryName(obs)}`.trim(),
      deltas: sortBy(
        Object.entries(taxonCounts).map(
          ([taxon, n]) => [taxonLabel(taxon), n] as [string, number],
        ),
        ([, n]) => -n,
      ),
    };
  });

  const groupLabel = (key: string) => {
    const obs = firsts.find((o) => groupOf(o) === key)!;
    const flag = countryFlag(localityParts(obs).display);
    const name = isUS(obs) ? localityParts(obs).name : countryName(obs);
    return flag ? `${flag} ${name}` : name;
  };

  return {
    data,
    groups: ranked.map((k, i) => ({
      key: k,
      name: groupLabel(k),
      color: paletteColor(i),
    })),
  };
}
