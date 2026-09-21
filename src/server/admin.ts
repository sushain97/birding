import { headers } from "next/headers";

export async function isAdminRequest(): Promise<boolean> {
  return (
    process.env.NODE_ENV === "development" ||
    (await headers()).get("x-birding-admin") === "1"
  );
}
