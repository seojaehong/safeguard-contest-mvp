import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

const fixedIdentityPaths = [
  "app/globals.css",
  "lib/frontend-design-contract.ts",
  "package.json",
  "next.config.mjs",
  "scripts/frontend_audit_source_identity.mjs",
  "scripts/frontend_consistency_audit.mjs",
  "scripts/frontend_consistency_browser_audit.mjs",
  "scripts/frontend_audit_bundle_contract.mjs",
  "lib/frontend-audit/GlobalBoundaryProbe.audit.tsx",
  "lib/frontend-audit/GlobalBoundaryProbe.noop.tsx",
  "types/audit-error-escalation.d.ts",
];

function listRelativeFiles(root, directory, predicate) {
  const absoluteDirectory = path.join(root, directory);
  const files = [];
  for (const entry of fs.readdirSync(absoluteDirectory, { withFileTypes: true })) {
    const relativePath = path.posix.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...listRelativeFiles(root, relativePath, predicate));
    else if (predicate(relativePath)) files.push(relativePath);
  }
  return files;
}

export function canonicalFrontendIdentityFiles(root) {
  const relativeFiles = [
    ...fixedIdentityPaths,
    ...listRelativeFiles(root, "app", (filePath) => filePath.endsWith(".tsx")),
    ...listRelativeFiles(root, "components", (filePath) => filePath.endsWith(".tsx")),
  ].sort();
  const uniqueRelativeFiles = [...new Set(relativeFiles)];
  const absoluteFiles = uniqueRelativeFiles.map((relativePath) => path.join(root, relativePath));
  for (const filePath of absoluteFiles) {
    if (!fs.existsSync(filePath)) throw new Error(`Missing frontend identity file: ${filePath}`);
  }
  return absoluteFiles;
}

export function canonicalFrontendSourceIdentity(root) {
  const files = canonicalFrontendIdentityFiles(root);
  const identity = crypto.createHash("sha256");
  for (const filePath of files) {
    identity.update(path.relative(root, filePath).replaceAll("\\", "/"));
    identity.update("\0");
    identity.update(fs.readFileSync(filePath));
    identity.update("\0");
  }
  return {
    sourceIdentity: identity.digest("hex"),
    newestMtime: Math.max(...files.map((filePath) => fs.statSync(filePath).mtimeMs)),
    files: files.map((filePath) => path.relative(root, filePath).replaceAll("\\", "/")),
  };
}
