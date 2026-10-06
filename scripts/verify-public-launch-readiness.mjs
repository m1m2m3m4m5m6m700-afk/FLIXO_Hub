#!/usr/bin/env node
import { runLaunchReadinessCheck } from './cli/checks/launch-readiness.mjs';

try {
  runLaunchReadinessCheck();
} catch (error) {
  if (error instanceof Error) {
    console.error(error.message);
    if (Array.isArray(error.missing)) error.missing.forEach((entry) => console.error(` - ${entry}`));
  } else {
    console.error(error);
  }
  process.exit(1);
}
