import { ImageResponse } from "next/og";

export const runtime = "edge";
export const alt = "FrankenSim: The Certified Simulation & Design Kernel for Rust";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          background: "linear-gradient(145deg, #04090d 0%, #08131a 50%, #04090d 100%)",
          fontFamily: "sans-serif",
          position: "relative",
          overflow: "hidden",
        }}
      >
        <div style={{ position: "absolute", top: "-120px", left: "-120px", width: "440px", height: "440px", borderRadius: "9999px", background: "radial-gradient(circle, rgba(34,211,238,0.16) 0%, transparent 70%)", display: "flex" }} />
        <div style={{ position: "absolute", bottom: "-100px", right: "-100px", width: "380px", height: "380px", borderRadius: "9999px", background: "radial-gradient(circle, rgba(168,85,247,0.14) 0%, transparent 70%)", display: "flex" }} />
        <div style={{ position: "absolute", top: "60px", right: "80px", width: "12px", height: "12px", borderRadius: "9999px", backgroundColor: "#a855f7", display: "flex" }} />

        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", width: "76px", height: "76px", borderRadius: "18px", background: "linear-gradient(135deg, #22d3ee, #06b6d4)", marginBottom: "32px" }}>
          <span style={{ color: "#04090d", fontSize: "46px", fontWeight: 900 }}>F</span>
        </div>

        <div style={{ display: "flex", fontSize: "76px", fontWeight: 800, color: "#F1F5F9", letterSpacing: "-2px", lineHeight: 1.1 }}>
          FrankenSim
        </div>

        <div style={{ display: "flex", width: "140px", height: "4px", background: "linear-gradient(90deg, #22d3ee, #a855f7)", borderRadius: "2px", marginTop: "28px", marginBottom: "28px" }} />

        <div style={{ display: "flex", fontSize: "30px", fontWeight: 600, color: "#67e8f9", letterSpacing: "-0.5px" }}>
          Simulation that returns proofs.
        </div>

        <div style={{ display: "flex", fontSize: "20px", fontWeight: 500, color: "#64748B", marginTop: "16px", letterSpacing: "0.5px" }}>
          Geometry · Physics · Optimization · Rendering · Pure Rust
        </div>

        <div style={{ position: "absolute", bottom: "40px", display: "flex", alignItems: "center", gap: "8px", fontSize: "18px", fontWeight: 500, color: "#64748B" }}>
          <span style={{ color: "#a855f7" }}>{">"}</span>
          <span>frankensim.org</span>
        </div>
      </div>
    ),
    { ...size }
  );
}
