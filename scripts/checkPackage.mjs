import { lstat, mkdtemp, readlink, realpath, rm } from "node:fs/promises";
import { existsSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, relative, resolve } from "node:path";
import { spawnSync } from "node:child_process";

const packageJson = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8"));
const packageName = packageJson.name;
const packageVersion = packageJson.version;
const tarballName = `${packageName}-${packageVersion}.tgz`;
const npmCommand = process.platform === "win32" ? process.execPath : "npm";
const npmArgsPrefix = process.platform === "win32"
  ? [join(dirname(process.execPath), "node_modules", "npm", "bin", "npm-cli.js")]
  : [];
const cacheDir = resolve(".tmp", "npm-cache");
const helpText = [
  "md2pdf [OPTIONS] ENTRY [ENTRY ...]",
  "",
  "ENTRY                     a Markdown file or a directory of Markdown files",
  "-o, --output PATH         output path for a single-file conversion",
  "    --output-dir DIR      write every output PDF into DIR",
  "-f, --force-overwrite     overwrite existing output PDFs without prompting",
  "-h, --help                list options with one-line descriptions",
].join("\n");

run(npmCommand, [...npmArgsPrefix, "run", "build"]);

const pack = run(npmCommand, [...npmArgsPrefix, "pack", "--json", "--ignore-scripts", "--cache", cacheDir], {
  allowMixedJsonOutput: true,
});
const packOutput = parsePackOutput(pack.stdout);

if (packOutput.filename !== tarballName) {
  fail(`expected tarball ${tarballName}, observed ${packOutput.filename}`);
}

const filePaths = packOutput.files.map((file) => file.path).sort();
assertIncludes(filePaths, "package.json");
assertIncludes(filePaths, "dist/cli.js");
assertIncludes(filePaths, "assets/default.css");
assertIncludes(filePaths, "assets/highlight.css");
assertIncludes(filePaths, "README.md");
assertIncludes(filePaths, "ARTIFACT_FRESHNESS_POLICY.md");
assertIncludes(filePaths, "artifacts.json");
assertNoOrphanDistFiles(filePaths);

const prefix = await mkdtemp(join(tmpdir(), "md2pdf-package-"));
try {
  const tarballPath = resolve(packOutput.filename);
  const installArgs = [
    "install",
    "--global",
    "--prefix",
    prefix,
    "--cache",
    cacheDir,
    tarballPath,
    "--no-audit",
    "--no-fund",
    "--fetch-timeout=30000",
    "--fetch-retries=2",
  ];

  run(npmCommand, [...npmArgsPrefix, ...installArgs]);
  await assertInstalledBinary(prefix);
  runInstalledHelp(prefix);

  run(npmCommand, [...npmArgsPrefix, ...installArgs]);
  await assertInstalledBinary(prefix);
  runInstalledHelp(prefix);
} finally {
  await rm(prefix, { recursive: true, force: true });
}

console.log(
  [
    `Package smoke passed: ${packOutput.filename}`,
    `entryCount: ${packOutput.entryCount}`,
    `shasum: ${packOutput.shasum}`,
    `integrity: ${packOutput.integrity}`,
  ].join("\n"),
);

function run(command, args, options = {}) {
  const invocation = commandInvocation(command, args);
  const result = spawnSync(invocation.command, invocation.args, {
    cwd: process.cwd(),
    encoding: "utf8",
    maxBuffer: 50 * 1024 * 1024,
    stdio: ["ignore", "pipe", "pipe"],
  });

  if (result.status !== 0) {
    fail(
      [
        `command failed: ${command} ${args.join(" ")}`,
        `exit: ${result.status}`,
        result.error === undefined ? "" : String(result.error),
        result.stdout?.trim(),
        result.stderr?.trim(),
      ]
        .filter(Boolean)
        .join("\n"),
    );
  }

  if (!options.allowMixedJsonOutput) {
    process.stdout.write(result.stdout ?? "");
  }
  process.stderr.write(result.stderr ?? "");
  return result;
}

function parsePackOutput(stdout) {
  const end = stdout.lastIndexOf("]");
  if (end === -1) {
    fail(`npm pack did not print a JSON array:\n${stdout}`);
  }

  for (let start = stdout.indexOf("["); start !== -1; start = stdout.indexOf("[", start + 1)) {
    try {
      const parsed = JSON.parse(stdout.slice(start, end + 1));
      if (Array.isArray(parsed) && parsed.length === 1 && parsed[0]?.filename !== undefined) {
        return parsed[0];
      }
    } catch {
      // Keep scanning; npm lifecycle logs can contain brackets before the JSON.
    }
  }

  fail(`npm pack did not print the expected one-entry JSON array:\n${stdout}`);
}

function assertIncludes(filePaths, expectedPath) {
  if (!filePaths.includes(expectedPath)) {
    fail(`packlist is missing ${expectedPath}`);
  }
}

function assertNoOrphanDistFiles(filePaths) {
  const distOutputs = filePaths.filter((filePath) => filePath.startsWith("dist/"));
  for (const filePath of distOutputs) {
    const sourceStem = sourceStemForDistOutput(filePath);
    if (sourceStem === undefined) {
      continue;
    }

    const sourcePath = resolve("src", `${sourceStem}.ts`);
    if (!existsSync(sourcePath)) {
      fail(`packlist contains orphan dist output ${filePath}; missing ${relative(process.cwd(), sourcePath)}`);
    }
  }
}

function sourceStemForDistOutput(filePath) {
  const relativeDistPath = filePath.slice("dist/".length);
  for (const suffix of [".d.ts.map", ".d.ts", ".js.map", ".js"]) {
    if (relativeDistPath.endsWith(suffix)) {
      return relativeDistPath.slice(0, -suffix.length);
    }
  }
  return undefined;
}

async function assertInstalledBinary(prefix) {
  const packageCli = process.platform === "win32"
    ? join(prefix, "node_modules", packageName, "dist", "cli.js")
    : join(prefix, "lib", "node_modules", packageName, "dist", "cli.js");

  if (process.platform === "win32") {
    const cmdShim = join(prefix, "md2pdf.cmd");
    if (!existsSync(cmdShim)) {
      fail(`installed Windows command shim missing: ${cmdShim}`);
    }
    if (!existsSync(packageCli)) {
      fail(`installed package CLI missing: ${packageCli}`);
    }
    return;
  }

  const binPath = join(prefix, "bin", "md2pdf");
  const stat = await lstat(binPath);
  if (!stat.isSymbolicLink()) {
    fail(`installed POSIX bin is not a symlink: ${binPath}`);
  }

  const linkTarget = await readlink(binPath);
  const targetPath = resolve(dirname(binPath), linkTarget);
  const [realTarget, realCli] = await Promise.all([realpath(targetPath), realpath(packageCli)]);
  if (realTarget !== realCli) {
    fail(`installed POSIX bin points to ${linkTarget}, expected ${relative(dirname(binPath), packageCli)}`);
  }
}

function runInstalledHelp(prefix) {
  const command =
    process.platform === "win32"
      ? join(prefix, "md2pdf.cmd")
      : join(prefix, "bin", "md2pdf");
  const invocation = commandInvocation(command, ["--help"]);
  const result = spawnSync(invocation.command, invocation.args, {
    cwd: process.cwd(),
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });

  if (result.status !== 0) {
    fail(`installed md2pdf --help failed with exit ${result.status}\n${result.stderr}`);
  }

  if (result.stdout.trimEnd() !== helpText) {
    fail(`installed md2pdf --help output mismatch\n${result.stdout}`);
  }
}

function commandInvocation(command, args) {
  if (process.platform === "win32" && command.toLowerCase().endsWith(".cmd")) {
    return {
      command: process.env.ComSpec ?? "cmd.exe",
      args: ["/d", "/c", ["call", command, ...args].map(quoteCmdArgument).join(" ")],
    };
  }

  return { command, args };
}

function quoteCmdArgument(value) {
  const text = String(value);
  if (!/[\s&()<>|^"]/u.test(text)) {
    return text;
  }

  return `"${text.replaceAll('"', '""')}"`;
}

function fail(message) {
  console.error(message);
  process.exit(1);
}
