interface FlagDefinition {
  readonly description: string;
  readonly defaultValue: boolean;
  readonly owner: string;
  readonly trackingIssue: string;
}

const flags = {
  WIDGET: {
    description: "Embeddable iframe widget with optional JWT auto-login for host app integration",
    defaultValue: false,
    owner: "sriramgopalan",
    trackingIssue: "gap-7-widget",
  },
  ADMIN_DASHBOARD_V2: {
    description: "Richer admin overview: stat-card deltas, activity chart, leaderboards, needs-attention",
    defaultValue: false,
    owner: "sriramgopalan",
    trackingIssue: "admin-dashboard-v2",
  },
} as const satisfies Record<string, FlagDefinition>;

type FeatureFlag = keyof typeof flags;

export function isEnabled(flag: FeatureFlag): boolean {
  const override = process.env[`FEATURE_${flag}`];
  if (override === "true") return true;
  if (override === "false") return false;
  return flags[flag].defaultValue;
}
