import type { OgCard, OgMetric, OgMixSlice } from "@/lib/og/model";

const BG = "#0a0a0a";
const FG = "#ededed";
const MUTED = "#a1a1a1";
const BORDER = "rgba(255,255,255,0.1)";
const CARD = "#111111";

export function OgImage({ card }: { card: OgCard }) {
  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        background: BG,
        color: FG,
        padding: "56px 64px",
        fontFamily: "Geist",
        fontFeatureSettings: '"liga" 0, "calt" 0',
      }}
    >
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <div
            style={{
              width: 36,
              height: 36,
              borderRadius: 8,
              border: `1px solid ${BORDER}`,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 16,
              fontWeight: 600,
            }}
          >
            G
          </div>
          <div style={{ fontSize: 22, fontWeight: 600 }}>Grid</div>
        </div>
        <div style={{ fontSize: 20, color: MUTED }}>{card.eyebrow}</div>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 16, marginTop: 36 }}>
        {card.kicker ? (
          <div style={{ fontSize: 22, color: MUTED }}>{card.kicker}</div>
        ) : null}
        <div
          style={{
            fontSize: card.title.length > 72 ? 40 : 52,
            fontWeight: 600,
            lineHeight: 1.15,
            maxWidth: 1040,
          }}
        >
          {card.title}
        </div>
      </div>

      {card.mix.length > 0 ? <MixRow slices={card.mix} /> : null}

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", gap: 32 }}>
        <div style={{ display: "flex", gap: 28, flexWrap: "wrap" }}>
          {card.metrics.map((metric) => (
            <Metric key={metric.label} metric={metric} />
          ))}
        </div>
        <div style={{ fontSize: 18, color: MUTED }}>{card.stamp ?? "grid.vahaah.com"}</div>
      </div>
    </div>
  );
}

function MixRow({ slices }: { slices: OgMixSlice[] }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12, marginTop: 8 }}>
      <div style={{ display: "flex", height: 16, borderRadius: 999, overflow: "hidden", background: CARD }}>
        {slices.map((slice) => (
          <div
            key={slice.fuel}
            style={{
              width: `${Math.max(slice.sharePct, 1)}%`,
              background: slice.color,
              height: "100%",
            }}
          />
        ))}
      </div>
      <div style={{ display: "flex", gap: 20, flexWrap: "wrap" }}>
        {slices.slice(0, 5).map((slice) => (
          <div key={slice.fuel} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 20 }}>
            <div style={{ width: 10, height: 10, borderRadius: 999, background: slice.color }} />
            <span style={{ color: MUTED }}>{slice.label}</span>
            <span style={{ fontWeight: 600 }}>{slice.sharePct.toFixed(0)}%</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function Metric({ metric }: { metric: OgMetric }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 4, minWidth: 140 }}>
      <div style={{ fontSize: 18, color: MUTED }}>{metric.label}</div>
      <div style={{ fontSize: 36, fontWeight: 600 }}>{metric.value}</div>
      {metric.hint ? <div style={{ fontSize: 16, color: MUTED }}>{metric.hint}</div> : null}
    </div>
  );
}
