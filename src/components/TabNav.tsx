"use client";

import { usePathname, useRouter } from "next/navigation";
import { Tabs } from "@mantine/core";

const TABS = [
  { value: "/inat", label: "iNat" },
  { value: "/best-of", label: "Best of Birding" },
];

const ADMIN_TAB = { value: "/admin", label: "Admin" };

export function TabNav({ showAdmin }: { showAdmin: boolean }) {
  const pathname = usePathname();
  const router = useRouter();
  const tabs = showAdmin ? [...TABS, ADMIN_TAB] : TABS;
  const active = tabs.find((t) => t.value === pathname)?.value ?? tabs[0].value;

  return (
    <Tabs value={active} onChange={(value) => value && router.push(value)}>
      <Tabs.List>
        {tabs.map((tab) => (
          <Tabs.Tab key={tab.value} value={tab.value}>
            {tab.label}
          </Tabs.Tab>
        ))}
      </Tabs.List>
    </Tabs>
  );
}
