import { ImageResponse } from "next/og";

export const size = { width: 32, height: 32 };
export const contentType = "image/png";

export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: 32,
          height: 32,
          borderRadius: 8,
          background: "linear-gradient(135deg, #22d3ee, #06b6d4)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <span style={{ color: "#04090d", fontSize: 20, fontWeight: 900, fontFamily: "sans-serif" }}>F</span>
      </div>
    ),
    { ...size }
  );
}
