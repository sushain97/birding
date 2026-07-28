import { refreshBestOf, refreshObservations } from "./refresh";

const OBSERVATIONS_INTERVAL_MS = 60 * 60 * 1000; // every 60 minutes
const BEST_OF_INTERVAL_MS = 15 * 60 * 1000; // every 15 minutes

let started = false;

async function runInitialRefresh(): Promise<void> {
  try {
    await refreshObservations();
    console.log("Initial observations refresh done");
    await refreshBestOf();
    console.log("Initial best-of refresh done");
  } catch (err) {
    console.error("Initial refresh failed", err);
  }
}

async function runObservationsRefresh(): Promise<void> {
  try {
    await refreshObservations();
    console.log("Observations refresh done");
  } catch (err) {
    console.error("Observations refresh failed", err);
  }
}

async function runBestOfRefresh(): Promise<void> {
  try {
    await refreshBestOf();
    console.log("Best-of refresh done");
  } catch (err) {
    console.error("Best-of refresh failed", err);
  }
}

export function startScheduler(): void {
  // Idempotent — guards against double-start (e.g. dev-mode module
  // re-evaluation).
  if (started) return;
  started = true;

  void runInitialRefresh();

  setInterval(() => void runObservationsRefresh(), OBSERVATIONS_INTERVAL_MS);
  setInterval(() => void runBestOfRefresh(), BEST_OF_INTERVAL_MS);
}
