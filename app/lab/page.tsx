import type { Metadata } from "next";
import WasmLab from "@/components/wasm-lab";

export const metadata: Metadata = {
  title: "The Lab",
  description:
    "Real FrankenSim kernels, compiled to WebAssembly and computing live in your browser — no mocks.",
};

export default function LabPage() {
  return (
    <main id="main-content">
      <WasmLab />
    </main>
  );
}
