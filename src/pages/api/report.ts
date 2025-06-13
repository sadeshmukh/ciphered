export const prerender = false;

import type { APIRoute } from "astro";
import fs from "fs/promises";
import path from "path";

const MAX_REPORTS = 1000;
const MAX_FILE_SIZE = 5 * 1024 * 1024;
const MAX_AGE_DAYS = 30;

type ReportData = {
  word: string;
  pattern: string;
  cipherText: string;
  substitutions: Record<string, string>;
};

type Report = ReportData & {
  timestamp: string;
};

function cleanupReports(reports: Report[]): Report[] {
  const now = new Date();
  const cutoffDate = new Date(
    now.getTime() - MAX_AGE_DAYS * 24 * 60 * 60 * 1000
  );

  return reports
    .filter((report) => new Date(report.timestamp) > cutoffDate)
    .slice(-MAX_REPORTS);
}

export const POST: APIRoute = async ({ request }) => {
  try {
    const data: ReportData = await request.json();

    if (!data.word || !data.pattern) {
      return new Response(
        JSON.stringify({ message: "Missing required fields" }),
        {
          status: 400,
          headers: {
            "Content-Type": "application/json",
          },
        }
      );
    }

    const reportsDir = path.join(process.cwd(), "reports");
    try {
      await fs.access(reportsDir);
    } catch {
      await fs.mkdir(reportsDir);
    }

    const timestamp = new Date().toISOString();
    const report = {
      ...data,
      timestamp,
    };

    const reportsFile = path.join(reportsDir, "word_reports.json");
    let reports: Report[] = [];

    try {
      const stats = await fs.stat(reportsFile);
      if (stats.size > MAX_FILE_SIZE) {
        reports = [];
      } else {
        const content = await fs.readFile(reportsFile, "utf-8");
        reports = JSON.parse(content);
      }
    } catch {
      // file doesn't exist or is invalid, start with empty array
    }

    reports.push(report);
    reports = cleanupReports(reports);

    await fs.writeFile(reportsFile, JSON.stringify(reports, null, 2));

    return new Response(
      JSON.stringify({ message: "Report received successfully" }),
      {
        status: 200,
        headers: {
          "Content-Type": "application/json",
        },
      }
    );
  } catch (error) {
    console.error("Error processing report:", error);
    return new Response(JSON.stringify({ message: "Internal server error" }), {
      status: 500,
      headers: {
        "Content-Type": "application/json",
      },
    });
  }
};
