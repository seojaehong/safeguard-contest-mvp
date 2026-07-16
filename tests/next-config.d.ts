declare module "@/next.config.mjs" {
  interface HeaderEntry {
    key: string;
    value: string;
  }
  interface HeaderRule {
    source: string;
    headers: HeaderEntry[];
  }
  const nextConfig: {
    headers: () => Promise<HeaderRule[]>;
    outputFileTracingIncludes?: Record<string, readonly string[]>;
  };
  export default nextConfig;
}
