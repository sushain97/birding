import { Anchor, Stack, Text, Title } from "@mantine/core";
import { LinkSimpleIcon } from "@phosphor-icons/react/dist/ssr";
import styles from "./page.module.css";
import { readObservationsSnapshot } from "@/lib/snapshot";
import { buildLifetimeSpeciesFigure } from "@/lib/charts/lifetimeSpecies";
import { buildTopDaysFigure } from "@/lib/charts/topDays";
import { buildNewSpeciesDaysFigure } from "@/lib/charts/newSpeciesDays";
import { buildLocalitiesFigure } from "@/lib/charts/localities";
import { buildMostSeenFigure } from "@/lib/charts/mostSeen";
import { buildWingspanCoverageFigure } from "@/lib/charts/wingspanCoverage";
import { needsIdByDayRows } from "@/lib/charts/needsIdByDay";
import { BarChart } from "@/components/charts/BarChart";
import { BarChartWithSpeciesDialog } from "@/components/charts/BarChartWithSpeciesDialog";
import { NeedsIdByDayList } from "@/components/NeedsIdByDayList";

// Reads the on-disk snapshot the background scheduler keeps refreshing —
// must never be statically prerendered at build time.
export const dynamic = "force-dynamic";

function slugify(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  const id = slugify(title);
  return (
    <Stack gap="xs">
      <Title id={id} order={4} className={styles.sectionTitle}>
        {title}
        <Anchor
          href={`#${id}`}
          component="a"
          c="dimmed"
          underline="never"
          className={styles.anchorIcon}
          aria-label={`Link to ${title}`}
        >
          <LinkSimpleIcon size="0.7em" weight="bold" />
        </Anchor>
      </Title>
      {children}
    </Stack>
  );
}

export default async function InatPage() {
  const observations = await readObservationsSnapshot();

  if (!observations) {
    return <Text c="dimmed">Loading observations…</Text>;
  }

  const { summary, placeNames } = observations;

  const {
    figure: wingspanFigure,
    totalResearchGrade,
    totalBirds,
  } = buildWingspanCoverageFigure(summary);

  return (
    <Stack gap="xl">
      <Section title="Lifetime species by iconic taxon">
        <BarChartWithSpeciesDialog
          figure={buildLifetimeSpeciesFigure(summary)}
        />
      </Section>

      <Section title="Top days by unique species observed">
        <BarChartWithSpeciesDialog figure={buildTopDaysFigure(summary)} />
      </Section>

      <Section title="Top days by new research grade species">
        <BarChartWithSpeciesDialog
          figure={buildNewSpeciesDaysFigure(summary)}
        />
      </Section>

      <Section title="Top localities by new research grade species">
        <BarChartWithSpeciesDialog
          figure={buildLocalitiesFigure(summary, placeNames)}
        />
      </Section>

      <Section title="Needs ID species by day (last 30 days)">
        <NeedsIdByDayList rows={needsIdByDayRows(summary)} />
      </Section>

      <Section title="Most seen research grade species (unique days)">
        <BarChart {...buildMostSeenFigure(summary)} />
      </Section>

      <Section
        title={`Wingspan set coverage (${totalResearchGrade}/${totalBirds})`}
      >
        <BarChartWithSpeciesDialog figure={wingspanFigure} />
      </Section>
    </Stack>
  );
}
