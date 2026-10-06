#!/usr/bin/env node
import { runArchitectureCheck } from './cli/checks/architecture.mjs';

try {
  runArchitectureCheck();
} catch (error) {
  if (error instanceof Error) {
    console.error(error.message);
    if (Array.isArray(error.violations)) error.violations.forEach((entry) => console.error(entry));
  } else {
    console.error(error);
  }
  process.exit(1);
}
