import { ImageResponse } from "next/og";
import { GraphShareImage } from "./graph-share-image";

export const runtime = "edge";
export const alt = "FrankenSim project dependency graph";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function Image() {
  return new ImageResponse(<GraphShareImage height={size.height} />, { ...size });
}
