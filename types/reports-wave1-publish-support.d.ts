declare module "@/scripts/reports_wave1_publish_support.mjs" {
  export const REPORTS_WAVE1_EVIDENCE_RELATIVE_DIR: string;
  export const REPORTS_WAVE1_BUILD_MANIFEST_FILENAME: string;
  export const REPORTS_WAVE1_PRODUCT_ENTRY_FILES: string[];
  export const REPORTS_WAVE1_PRODUCT_RELATIVE_FILES: string[];
  export const REPORTS_WAVE1_PUBLISHER_RELATIVE_FILES: string[];
  export const REPORTS_WAVE1_PUBLISHER: string;
  export const REPORTS_WAVE1_SOURCE_IDENTITY_ALGORITHM: "git-head-runtime-contract-blob-oids-sha256-v2";

  export function listFilesRecursively(directory: string): string[];
  export function digestFiles(baseDirectory: string, files: string[]): string;
  export function collectReportsWave1ProductFiles(root: string, commitSha?: string): string[];
  export function getReportsWave1ProductIdentity(
    root: string,
    relativeFiles?: string[],
  ): {
    sourceSha: string;
    sourceIdentity: string;
    sourceFiles: string[];
  };
  export function computeNextBuildIdentity(options?: {
    root?: string;
    buildDirectory?: string;
  }): {
    buildDirectory: string;
    relativeBuildDirectory: string;
    buildId: string;
    buildIdentity: string;
    buildFileCount: number;
  };
  export function resolveReportsWave1OutputDirectory(options?: {
    root?: string;
    env?: Record<string, string | undefined>;
    prefix?: string;
    tempRoot?: string;
    makeTempDirectory?: (prefix: string) => string;
  }): {
    directory: string;
    publish: boolean;
    cleanup: boolean;
  };
  export function cleanupReportsWave1OutputDirectory(
    output: {
      directory: string;
      publish: boolean;
      cleanup: boolean;
    },
    options?: { tempRoot?: string },
  ): void;
  export function writeReportsWave1BuildManifest(options?: {
    root?: string;
    buildDirectory?: string;
    outputPath?: string;
    publisherCommand?: string;
    publisherCommitSha?: string;
    productIdentity?: {
      sourceSha: string;
      sourceIdentity: string;
      sourceFiles: string[];
    };
  }): {
    schemaVersion: number;
    publisher: string;
    generatedAt: string;
    publisherCommitSha: string;
    publisherCommand: string;
    publisherSourceFiles: string[];
    productSourceSha: string;
    productSourceIdentityAlgorithm: string;
    productSourceIdentity: string;
    productSourceFiles: string[];
    buildDirectory: string;
    buildId: string;
    buildIdentity: string;
    buildFileCount: number;
  };
  export function validateReportsWave1BuildManifest(options?: {
    root?: string;
    manifestPath?: string;
    expectedBuildDirectory?: string;
    productIdentity?: {
      sourceSha: string;
      sourceIdentity: string;
      sourceFiles: string[];
    };
  }): {
    schemaVersion: number;
    publisher: string;
    generatedAt: string;
    publisherCommitSha: string;
    publisherCommand: string;
    publisherSourceFiles: string[];
    productSourceSha: string;
    productSourceIdentityAlgorithm: string;
    productSourceIdentity: string;
    productSourceFiles: string[];
    buildDirectory: string;
    buildId: string;
    buildIdentity: string;
    buildFileCount: number;
    absoluteManifestPath: string;
    absoluteBuildDirectory: string;
  };
}
