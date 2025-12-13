#!/usr/bin/env node
/* global process, console, setImmediate */
/* eslint-disable @typescript-eslint/no-require-imports */
/**
 * Production Health Check Script
 * Phase 06: Production Deployment
 *
 * Verifies:
 * - Filesystem access (can write to data directory)
 * - Memory usage (heap not exhausted)
 * - Event loop responsiveness (not blocked)
 */

import { writeFileSync, unlinkSync } from "fs";
import { join } from "path";

async function healthCheck() {
  const checks = {
    filesystem: false,
    memory: false,
    eventLoop: false,
  };

  const errors = [];

  // Check 1: Filesystem access
  try {
    const dataPath = process.env.DATA_PATH || "/app/data";
    const testFile = join(dataPath, ".healthcheck");

    // Try to write
    writeFileSync(testFile, Date.now().toString());
    unlinkSync(testFile);
    checks.filesystem = true;
  } catch (err) {
    errors.push(`Filesystem: ${err.message}`);
  }

  // Check 2: Memory usage
  try {
    const used = process.memoryUsage();
    const heapPercent = used.heapUsed / used.heapTotal;

    if (heapPercent < 0.9) {
      checks.memory = true;
    } else {
      errors.push(`Memory: Heap usage at ${(heapPercent * 100).toFixed(1)}%`);
    }
  } catch (err) {
    errors.push(`Memory: ${err.message}`);
  }

  // Check 3: Event loop responsiveness
  try {
    const start = Date.now();
    await new Promise((resolve) => setImmediate(resolve));
    const delay = Date.now() - start;

    if (delay < 100) {
      checks.eventLoop = true;
    } else {
      errors.push(`Event loop: ${delay}ms delay (>100ms threshold)`);
    }
  } catch (err) {
    errors.push(`Event loop: ${err.message}`);
  }

  // Evaluate results
  const healthy = Object.values(checks).every(Boolean);

  if (!healthy) {
    console.error("Health check FAILED");
    console.error("Checks:", JSON.stringify(checks, null, 2));
    console.error("Errors:", errors);
    process.exit(1);
  }

  // Success - exit quietly (don't spam logs)
  process.exit(0);
}

healthCheck().catch((err) => {
  console.error("Health check error:", err);
  process.exit(1);
});
