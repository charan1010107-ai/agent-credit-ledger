/** Graduated risk response model — safe to import on client and server. */

export type RiskStage = "healthy" | "warning" | "throttled" | "frozen";

export const RISK_ORDER: RiskStage[] = ["healthy", "warning", "throttled", "frozen"];

export function nextStage(stage: string): RiskStage {
  const i = RISK_ORDER.indexOf(stage as RiskStage);
  return RISK_ORDER[Math.min(RISK_ORDER.length - 1, (i < 0 ? 0 : i) + 1)]!;
}

export function stageMeta(stage: string): {
  label: string;
  className: string;
  panelClassName: string;
  blurb: string;
} {
  switch (stage) {
    case "warning":
      return {
        label: "Warning",
        className: "border-warning/60 bg-warning/12 text-warning",
        panelClassName: "border-warning/50",
        blurb: "Minor anomaly detected — monitoring only, no functional restriction yet.",
      };
    case "throttled":
      return {
        label: "Throttled",
        className: "border-orange/60 bg-orange/12 text-orange",
        panelClassName: "border-orange/50",
        blurb: "Anomaly persisted — credit limit cut by 50% until behaviour normalises.",
      };
    case "frozen":
      return {
        label: "Frozen",
        className: "border-destructive/60 bg-destructive/15 text-destructive",
        panelClassName: "border-destructive/60",
        blurb: "Access revoked — wallet disabled and open loans frozen.",
      };
    default:
      return {
        label: "Healthy",
        className: "border-success/50 bg-success/12 text-success",
        panelClassName: "",
        blurb: "No anomalies on the current monitoring window.",
      };
  }
}

export function stageActionLabel(stage: string): string {
  switch (stage) {
    case "healthy":
      return "Raise warning";
    case "warning":
      return "Escalate to throttled";
    default:
      return "Escalate to frozen";
  }
}
