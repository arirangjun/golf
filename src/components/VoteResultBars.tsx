"use client";

export interface VoteResults {
  agree: number;
  disagree: number;
  unsure: number;
  total: number;
}

const BARS: { key: keyof Omit<VoteResults, "total">; label: string; bar: string }[] = [
  { key: "agree", label: "찬성", bar: "bg-sky-500" },
  { key: "disagree", label: "반대", bar: "bg-rose-400" },
  { key: "unsure", label: "모르겠다", bar: "bg-gray-400" },
];

export function VoteResultBars({ results }: { results: VoteResults }) {
  return (
    <div className="space-y-3">
      <div className="flex items-baseline justify-between">
        <p className="text-sm font-semibold text-gray-900">투표 현황</p>
        <p className="text-xs text-gray-500">총 {results.total}표</p>
      </div>
      {BARS.map((item) => {
        const count = results[item.key];
        const pct = results.total > 0 ? Math.round((count / results.total) * 100) : 0;
        return (
          <div key={item.key}>
            <div className="mb-1 flex items-center justify-between text-xs text-gray-700">
              <span className="font-medium">{item.label}</span>
              <span>
                {count}표 ({pct}%)
              </span>
            </div>
            <div className="h-3 overflow-hidden rounded-full bg-gray-100">
              <div
                className={`h-full rounded-full ${item.bar}`}
                style={{ width: `${pct}%` }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}
