import { readFile } from "node:fs/promises";
import { join } from "node:path";

export const runtime = "nodejs";

const shareMetadata = `
  <link rel="canonical" href="https://frankensim.org/beads/graph">
  <meta name="description" content="Explore FrankenSim's live issue dependency graph, critical paths, bottlenecks, cycles, and execution frontier.">
  <meta property="og:type" content="website">
  <meta property="og:site_name" content="FrankenSim">
  <meta property="og:url" content="https://frankensim.org/beads/graph">
  <meta property="og:title" content="FrankenSim Project Graph">
  <meta property="og:description" content="The build is a graph. Explore critical paths, bottlenecks, cycles, and the live execution frontier.">
  <meta property="og:image" content="https://frankensim.org/beads/graph/opengraph-image?v=1">
  <meta property="og:image:secure_url" content="https://frankensim.org/beads/graph/opengraph-image?v=1">
  <meta property="og:image:type" content="image/png">
  <meta property="og:image:width" content="1200">
  <meta property="og:image:height" content="630">
  <meta property="og:image:alt" content="FrankenSim project dependency graph">
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="FrankenSim Project Graph">
  <meta name="twitter:description" content="The build is a graph. Explore critical paths, bottlenecks, cycles, and the live execution frontier.">
  <meta name="twitter:image" content="https://frankensim.org/beads/graph/twitter-image?v=1">
  <meta name="twitter:image:alt" content="FrankenSim project dependency graph">
`;

export async function GET() {
  const indexPath = join(process.cwd(), "public", "beads", "index.html");
  const source = await readFile(indexPath, "utf8");
  const html = source
    .replace("<title>FrankenSim · Project Graph</title>", "<title>FrankenSim Project Graph</title>")
    .replace("</head>", `${shareMetadata}</head>`);

  return new Response(html, {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "public, max-age=0, must-revalidate",
    },
  });
}
