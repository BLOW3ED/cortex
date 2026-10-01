import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // No dejar que `next dev` escriba reglas para agentes en CLAUDE.md/AGENTS.md (decisión D4).
  agentRules: false,
  poweredByHeader: false,
};

export default nextConfig;
