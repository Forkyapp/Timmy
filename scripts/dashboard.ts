#!/usr/bin/env ts-node
/**
 * Dashboard CLI - Pipeline Analytics and Monitoring
 *
 * Usage:
 *   npm run dashboard              # Show dashboard (last 7 days)
 *   npm run dashboard -- --days 30 # Show dashboard (last 30 days)
 *   npm run dashboard -- --json    # Export as JSON
 *   npm run dashboard -- --help    # Show help
 */

import { showDashboard, exportReport } from '../src/core/dashboard';

function printHelp(): void {
  console.log(`
🤖 Timmy Pipeline Dashboard

Usage:
  npm run dashboard              Show dashboard (last 7 days)
  npm run dashboard -- --days N  Show dashboard for last N days
  npm run dashboard -- --json    Export report as JSON
  npm run dashboard -- --help    Show this help

Examples:
  npm run dashboard
  npm run dashboard -- --days 30
  npm run dashboard -- --json > report.json
`);
}

function main(): void {
  const args = process.argv.slice(2);

  // Parse arguments
  let daysBack = 7;
  let outputJson = false;

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];

    if (arg === '--help' || arg === '-h') {
      printHelp();
      process.exit(0);
    }

    if (arg === '--days' || arg === '-d') {
      const days = parseInt(args[++i], 10);
      if (!isNaN(days) && days > 0) {
        daysBack = days;
      } else {
        console.error('Error: --days requires a positive number');
        process.exit(1);
      }
    }

    if (arg === '--json' || arg === '-j') {
      outputJson = true;
    }
  }

  if (outputJson) {
    const report = exportReport(daysBack);
    console.log(JSON.stringify(report, null, 2));
  } else {
    showDashboard(daysBack);
  }
}

main();
