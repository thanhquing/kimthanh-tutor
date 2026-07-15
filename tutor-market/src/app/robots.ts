import type { MetadataRoute } from "next";
import { absoluteUrl } from "@/lib/config";
export default function robots(): MetadataRoute.Robots { return { rules: { userAgent: "*", allow: "/", disallow: ["/account", "/students", "/classes", "/dashboard", "/billing", "/checkout", "/notifications", "/login", "/activation", "/consent"] }, sitemap: absoluteUrl("/sitemap.xml") }; }
