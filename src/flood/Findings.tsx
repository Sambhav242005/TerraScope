import { useMemo } from "react";
import { AlertTriangle, ChevronRight, Info, Sparkles } from "lucide-react";
import { buildFindings, type Finding } from "./findingsCore";
import type { ScreeningRun } from "./storage/storageSearch";
import type { HistoryRow } from "./historySeries";

function FindingItem({ finding }: { finding: Finding }) {
  const Icon = finding.tone === "watch" ? AlertTriangle : Info;
  return (
    <li className={`finding finding-${finding.tone}`}>
      <div className="finding-head">
        <Icon size={13} aria-hidden="true" />
        <strong>{finding.title}</strong>
      </div>
      <p className="finding-detail">{finding.detail}</p>
      <small className="finding-evidence">{finding.evidence}</small>
    </li>
  );
}

export default function Findings({
  historyRows,
  manifest,
  storageRun,
  proposalCount,
  replayDate,
  ensoYear,
  onOpenEnso,
}: {
  historyRows: HistoryRow[] | null | undefined;
  manifest: Array<{ id: string; retrieved?: string; sha256?: string }>;
  storageRun: ScreeningRun | null;
  proposalCount: number;
  replayDate: string;
  ensoYear: number;
  onOpenEnso: () => void;
}) {
  const findings = useMemo(
    () =>
      buildFindings({
        history: historyRows ?? null,
        manifest,
        storageRun,
        proposalCount,
        replayDate,
        ensoYear,
      }),
    [historyRows, manifest, storageRun, proposalCount, replayDate, ensoYear],
  );

  return (
    <details className="findings-card">
      <summary>
        <Sparkles size={15} aria-hidden="true" />
        Findings — computed automatically
        <span className="finding-count">{findings.length}</span>
      </summary>
      <p className="finding-disclaimer">
        Derived after the review centre settles. Descriptive, not a forecast, warning or approval.
      </p>
      <ul className="findings-list" role="list">
        {findings.map((finding) => (
          <FindingItem key={finding.id} finding={finding} />
        ))}
      </ul>
      <button type="button" className="text-action finding-enso-button" onClick={onOpenEnso}>
        Open ENSO climate context
        <ChevronRight size={13} aria-hidden="true" />
      </button>
    </details>
  );
}
