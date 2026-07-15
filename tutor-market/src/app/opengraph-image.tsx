import { ImageResponse } from "next/og";
export const runtime = "edge";
export const alt = "Kim Thanh Tutor";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export default function OpenGraphImage() { return new ImageResponse(<div style={{ background: "#1769e0", color: "white", width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 72, fontWeight: 700 }}>Kim Thanh Tutor</div>, size); }
