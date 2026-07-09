import type { Metadata } from "next";
import E2eShowcase from "@/components/e2e-showcase";

export const metadata: Metadata = {
  title: "E2E Campaigns",
  description:
    "Ten certified end-to-end campaigns: FrankenSim crates that were never designed to meet, wired into a single pipeline that returns a proof, a frontier, a stop rule, or a credibility map — each running live in your browser via WebAssembly.",
};

export default function E2ePage() {
  return <E2eShowcase />;
}
