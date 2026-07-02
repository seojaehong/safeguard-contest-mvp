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
  };
  export default nextConfig;
}
