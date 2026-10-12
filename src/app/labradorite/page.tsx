import type { Metadata } from "next";
import { redirect } from "next/navigation";
import {
  Anchor,
  Badge,
  Breadcrumbs,
  Button,
  Container,
  Group,
  Image,
  Stack,
  Text,
  Title,
} from "@mantine/core";
import { LiveFollower } from "@/components/labradorite/LiveFollower";
import { INaturalistIcon } from "@/components/labradorite/INaturalistIcon";
import { getCurrentTaxon, getTaxonDetails } from "@/lib/labradorite";
import { taxonPageUrl } from "@/lib/charts/taxonLinks";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Labradorite",
};

function NoData({ displayedTaxon }: { displayedTaxon: string }) {
  return (
    <Container size="sm" py="xl">
      <LiveFollower displayedTaxon={displayedTaxon} />
      <Text c="dimmed" ta="center">
        No data available.
      </Text>
    </Container>
  );
}

export default async function LabradoritePage({
  searchParams,
}: {
  searchParams: Promise<{ taxon?: string | string[] }>;
}) {
  const param = (await searchParams).taxon;
  const taxon = Array.isArray(param) ? param[0] : param;

  if (!taxon) {
    const current = await getCurrentTaxon();
    if (current.taxon) {
      redirect(`/labradorite?${new URLSearchParams({ taxon: current.taxon })}`);
    }
    return <NoData displayedTaxon="" />;
  }

  const details = await getTaxonDetails(taxon).catch((error: unknown) => {
    console.error(`Failed to load taxon details for ${taxon}`, error);
    return null;
  });
  if (!details) return <NoData displayedTaxon={taxon} />;

  return (
    <Container size="sm" py="lg" pb={96}>
      <LiveFollower displayedTaxon={taxon} />
      <Stack gap="md">
        {details.photo && (
          <Stack gap={4}>
            <Image
              src={details.photo.url}
              alt={details.preferredCommonName ?? details.name}
              radius="md"
              mah="60vh"
              fit="contain"
            />
            {details.photo.attribution && (
              <Text
                size="xs"
                c="dimmed"
                truncate
                title={details.photo.attribution}
              >
                {details.photo.attribution}
              </Text>
            )}
          </Stack>
        )}

        <Stack gap={4}>
          <Title order={1}>{details.preferredCommonName ?? details.name}</Title>
          <Group gap="xs">
            <Text fs="italic" c="dimmed" size="lg">
              {details.name}
            </Text>
            {details.rank && details.rank !== "species" && (
              <Badge variant="light" color="gray">
                {details.rank}
              </Badge>
            )}
            {details.conservationStatus && (
              <Badge
                variant="light"
                color="orange"
                title={[
                  details.conservationStatus.authority,
                  details.conservationStatus.place,
                ]
                  .filter(Boolean)
                  .join(" · ")}
              >
                {details.conservationStatus.name}
              </Badge>
            )}
          </Group>
        </Stack>

        {details.ancestors.length > 0 && (
          <Breadcrumbs
            separator="›"
            separatorMargin={4}
            style={{ flexWrap: "wrap" }}
          >
            {details.ancestors.map((ancestor) => (
              <Anchor
                key={ancestor.id}
                href={taxonPageUrl({ id: ancestor.id })}
                target="_blank"
                size="sm"
                title={ancestor.rank}
              >
                {ancestor.commonName ?? ancestor.name}
              </Anchor>
            ))}
          </Breadcrumbs>
        )}

        {details.wikipediaSummary && (
          <Text>
            {details.wikipediaSummary}{" "}
            {details.wikipediaUrl && (
              <Anchor href={details.wikipediaUrl} target="_blank">
                Read more
              </Anchor>
            )}
          </Text>
        )}

        <Button
          component="a"
          href={details.inatUrl}
          target="_blank"
          variant="light"
          size="md"
          leftSection={<INaturalistIcon />}
        >
          Open on iNaturalist
        </Button>
      </Stack>
    </Container>
  );
}
