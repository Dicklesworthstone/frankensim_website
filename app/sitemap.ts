import type { MetadataRoute } from "next";
import { siteConfig } from "@/lib/content";

export default function sitemap(): MetadataRoute.Sitemap {
  const baseUrl = siteConfig.url;
  const now = new Date();
  const routes = [
    { path: "", priority: 1.0, changeFrequency: "weekly" as const },
    { path: "/architecture", priority: 0.9, changeFrequency: "monthly" as const },
    { path: "/kernel", priority: 0.8, changeFrequency: "monthly" as const },
    { path: "/flagships", priority: 0.9, changeFrequency: "monthly" as const },
    { path: "/epistemics", priority: 0.8, changeFrequency: "monthly" as const },
    { path: "/roadmap", priority: 0.8, changeFrequency: "weekly" as const },
    { path: "/getting-started", priority: 0.7, changeFrequency: "monthly" as const },
    { path: "/glossary", priority: 0.6, changeFrequency: "monthly" as const },
  ];
  return routes.map((r) => ({
    url: `${baseUrl}${r.path}`,
    lastModified: now,
    changeFrequency: r.changeFrequency,
    priority: r.priority,
  }));
}
