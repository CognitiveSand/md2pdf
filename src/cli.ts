#!/usr/bin/env node
import { runCli } from "./runCli.js";

const exitCode = runCli(process.argv.slice(2), {
  stdout: process.stdout,
  stderr: process.stderr,
});

process.exitCode = exitCode;
