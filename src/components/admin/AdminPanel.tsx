"use client";

import { useSyncExternalStore } from "react";
import { Box, Flex, NavLink, Stack } from "@mantine/core";
import {
  BinocularsIcon,
  MapPinIcon,
  StackIcon,
  TextAaIcon,
  type Icon,
} from "@phosphor-icons/react";
import { DescriptionSyncForm } from "./DescriptionSyncForm";
import { EbirdCompareForm } from "./EbirdCompareForm";
import { LocationEnrichForm } from "./LocationEnrichForm";
import { OrganizeAlbumsForm } from "./OrganizeAlbumsForm";

interface AdminToolDefinition {
  label: string;
  icon: Icon;
  Component: React.ComponentType<{ immichBaseUrl: string }>;
}

const ADMIN_TOOLS = {
  descriptions: {
    label: "Sync descriptions",
    icon: TextAaIcon,
    Component: DescriptionSyncForm,
  },
  organize: {
    label: "Organize albums",
    icon: StackIcon,
    Component: OrganizeAlbumsForm,
  },
  locations: {
    label: "Enrich locations",
    icon: MapPinIcon,
    Component: LocationEnrichForm,
  },
  ebird: {
    label: "Compare with eBird",
    icon: BinocularsIcon,
    Component: EbirdCompareForm,
  },
} satisfies Record<string, AdminToolDefinition>;

type AdminTool = keyof typeof ADMIN_TOOLS;

const DEFAULT_TOOL: AdminTool = "descriptions";

function subscribeToHash(onChange: () => void): () => void {
  window.addEventListener("hashchange", onChange);
  return () => window.removeEventListener("hashchange", onChange);
}

function activeToolFromHash(): AdminTool {
  const hash = window.location.hash.slice(1);
  return Object.hasOwn(ADMIN_TOOLS, hash) ? (hash as AdminTool) : DEFAULT_TOOL;
}

export interface AdminPanelProps {
  immichBaseUrl: string;
}

export function AdminPanel({ immichBaseUrl }: AdminPanelProps) {
  const active = useSyncExternalStore(
    subscribeToHash,
    activeToolFromHash,
    () => null,
  );

  return (
    <Flex direction={{ base: "column", sm: "row" }} gap="lg" align="flex-start">
      <Stack gap={4} w={{ base: "100%", sm: 200 }} style={{ flexShrink: 0 }}>
        {Object.entries(ADMIN_TOOLS).map(([id, { label, icon: ToolIcon }]) => (
          <NavLink
            key={id}
            href={`#${id}`}
            label={label}
            leftSection={<ToolIcon size={18} />}
            active={id === active}
          />
        ))}
      </Stack>
      <Box flex={1} miw={0} w="100%">
        {Object.entries(ADMIN_TOOLS).map(([id, { Component }]) => (
          <Box key={id} display={id === active ? undefined : "none"}>
            <Component immichBaseUrl={immichBaseUrl} />
          </Box>
        ))}
      </Box>
    </Flex>
  );
}
