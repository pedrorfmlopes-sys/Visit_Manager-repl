import path from "node:path";
import { chromium } from "@playwright/test";

const root = process.cwd();
const inputPath = path.join(root, "docs", "Manual_Odoo_Campos_Integracao.html");
const outputPath = path.join(root, "docs", "Manual_Odoo_Campos_Integracao.pdf");

const browser = await chromium.launch({ headless: true });

try {
  const page = await browser.newPage();
  await page.goto(`file:///${inputPath.replace(/\\/g, "/")}`, {
    waitUntil: "load",
  });

  await page.pdf({
    path: outputPath,
    format: "A4",
    printBackground: true,
    margin: {
      top: "14mm",
      right: "12mm",
      bottom: "14mm",
      left: "12mm",
    },
  });

  console.log(outputPath);
} finally {
  await browser.close();
}
