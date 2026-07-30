import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import TurndownService from "turndown";
import { writeFileSync } from "node:fs";

function isHtmlContent(content) {
  const trimmed = content.trim();
  if (!trimmed) return false;
  return /^<[a-z][\s\S]*>/i.test(trimmed);
}

const turndown = new TurndownService({ headingStyle: "atx", bulletListMarker: "-" });
const prisma = new PrismaClient();
const test = await prisma.test.findFirst({
  where: { title: "Reading Test 1" },
  select: { partABookletHtml: true }
});
const html = test?.partABookletHtml ?? "";
const md = isHtmlContent(html) ? turndown.turndown(html).trim() : html;
writeFileSync("tmp-booklet.md", md);
console.log("written", md.length);
await prisma.$disconnect();
