import { GridMark } from "@/components/grid-mark";
import { formatHeadlineGw } from "@/lib/facts";
import { formatSharePercent, showsInlineShareLabel } from "@/lib/generation-share";
import { OG_FOOTER, type OgBalance, type OgCard, type OgMetric, type OgMixSlice } from "@/lib/og/model";

const BG = "#0a0a0a";
const BALANCE_BG = "#000000";
const FG = "#ededed";
const MUTED = "#a1a1a1";
const OPERATOR = "#8f8f8f";
const CARD = "#111111";

export function OgImage({ card }: { card: OgCard }) {
  if (card.balance) {
    return <BalanceOgImage card={card} balance={card.balance} />;
  }
  return <MetricsOgImage card={card} />;
}

function MetricsOgImage({ card }: { card: OgCard }) {
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
        padding: "48px 56px",
        fontFamily: "Geist",
        fontFeatureSettings: "tnum",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <GridMark size={40} color={FG} />
          <div style={{ fontSize: 22, fontWeight: 600 }}>Grid</div>
        </div>
        <div style={{ fontSize: 20, color: MUTED, flexShrink: 0 }}>{card.eyebrow}</div>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 14, marginTop: 28 }}>
        {card.kicker ? (
          <div style={{ fontSize: 22, color: MUTED }}>{card.kicker}</div>
        ) : null}
        <div
          style={{
            fontSize: card.title.length > 72 ? 40 : 52,
            fontWeight: 600,
            lineHeight: 1.15,
            maxWidth: 1040,
            fontFeatureSettings: "tnum",
          }}
        >
          {card.title}
        </div>
      </div>

      {card.mix.length > 0 ? <MixRow slices={card.mix} /> : null}

      <div style={{ display: "flex", flexDirection: "column", gap: 14, marginTop: 20 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", gap: 32 }}>
          <div style={{ display: "flex", gap: 28, flexWrap: "wrap", flex: 1, minWidth: 0 }}>
            {card.metrics.map((metric) => (
              <Metric key={metric.label} metric={metric} />
            ))}
          </div>
          {card.stamp ? (
            <div style={{ fontSize: 18, color: MUTED, flexShrink: 0, whiteSpace: "nowrap" }}>
              {card.stamp}
            </div>
          ) : null}
        </div>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-end",
            gap: 24,
          }}
        >
          <div style={{ fontSize: 16, color: MUTED, maxWidth: 860 }}>
            {card.source ?? ""}
          </div>
          <div style={{ fontSize: 16, color: MUTED, flexShrink: 0 }}>{OG_FOOTER}</div>
        </div>
      </div>
    </div>
  );
}

function BalanceOgImage({ card, balance }: { card: OgCard; balance: OgBalance }) {
  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        background: BALANCE_BG,
        color: FG,
        padding: "56px 64px",
        fontFamily: "Geist",
        fontFeatureSettings: "tnum",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <GridMark size={40} color={FG} />
          <div style={{ fontSize: 22, fontWeight: 600 }}>Grid</div>
        </div>
        <div
          style={{
            fontSize: 20,
            fontFamily: "Geist Mono",
            fontFeatureSettings: "tnum",
            flexShrink: 0,
          }}
        >
          {balance.periodStamp}
        </div>
      </div>

      <div
        style={{
          display: "flex",
          marginTop: 36,
          fontSize: 40,
          fontWeight: 600,
          letterSpacing: "-0.03em",
          lineHeight: 1.15,
          maxHeight: 96,
          overflow: "hidden",
        }}
      >
        {card.title}
      </div>

      <div style={{ display: "flex", alignItems: "flex-end", marginTop: 36 }}>
        {balance.terms.flatMap((term) => {
          const cells = [];
          if (term.operator) {
            cells.push(
              <div
                key={`${term.label}-op`}
                style={{
                  width: 56,
                  display: "flex",
                  justifyContent: "center",
                  fontSize: 44,
                  color: OPERATOR,
                  paddingBottom: 8,
                }}
              >
                {term.operator}
              </div>
            );
          }
          cells.push(<BalanceTerm key={term.label} term={term} figurePx={balance.figurePx} />);
          return cells;
        })}
      </div>

      {card.mix.length > 0 ? <BalanceMix slices={card.mix} /> : null}

      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-end",
          marginTop: "auto",
          paddingTop: 28,
        }}
      >
        <div style={{ fontSize: 18, color: MUTED }}>{balance.sources}</div>
        <div style={{ fontSize: 18, color: MUTED }}>{OG_FOOTER}</div>
      </div>
    </div>
  );
}

function BalanceTerm({
  term,
  figurePx,
}: {
  term: OgBalance["terms"][number];
  figurePx: 72 | 60;
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", flexGrow: 1, flexBasis: 0, minWidth: 0 }}>
      <div style={{ fontSize: 22, fontWeight: 500, color: MUTED }}>{term.label}</div>
      <div style={{ display: "flex", alignItems: "flex-end", marginTop: 10 }}>
        <div
          style={{
            fontSize: figurePx,
            fontWeight: 600,
            letterSpacing: "-0.04em",
            fontFeatureSettings: "tnum",
            lineHeight: 1,
          }}
        >
          {term.gw}
        </div>
        <div style={{ fontSize: 30, color: OPERATOR, marginLeft: 8, paddingBottom: 6 }}>GW</div>
      </div>
    </div>
  );
}

function BalanceMix({ slices }: { slices: OgMixSlice[] }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", marginTop: 32 }}>
      <div style={{ display: "flex", gap: 2 }}>
        {slices.map((slice) => (
          <div
            key={slice.fuel}
            style={{
              display: "flex",
              flexGrow: slice.displayPct,
              flexBasis: 0,
              minWidth: 0,
              overflow: "hidden",
            }}
          >
            {showsInlineShareLabel(slice.displayPct, false) ? (
              <div style={{ display: "flex", fontSize: 18, fontFeatureSettings: "tnum" }}>
                <span style={{ fontWeight: 600 }}>{slice.label}</span>
                <span style={{ color: MUTED, marginLeft: 8 }}>{formatSharePercent(slice.displayPct)}%</span>
              </div>
            ) : null}
          </div>
        ))}
      </div>
      <div style={{ display: "flex", height: 14, gap: 2, borderRadius: 2, overflow: "hidden", marginTop: 8 }}>
        {slices.map((slice) => (
          <div
            key={slice.fuel}
            style={{
              flexGrow: slice.displayPct,
              flexBasis: 0,
              minWidth: 0,
              height: "100%",
              background: slice.color,
            }}
          />
        ))}
      </div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 16, marginTop: 12 }}>
        {slices
          .filter((slice) => !showsInlineShareLabel(slice.displayPct, false))
          .map((slice) => (
            <div key={slice.fuel} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 20 }}>
              <div style={{ width: 8, height: 8, borderRadius: 2, background: slice.color }} />
              <span>{slice.label}</span>
              <span style={{ color: MUTED, fontFeatureSettings: "tnum" }}>
                {formatHeadlineGw(slice.mw)} GW · {formatSharePercent(slice.displayPct)}%
              </span>
            </div>
          ))}
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
              flexGrow: slice.displayPct,
              flexBasis: 0,
              background: slice.color,
              height: "100%",
            }}
          />
        ))}
      </div>
      <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
        {slices.map((slice) => (
          <div key={slice.fuel} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 18 }}>
            <div style={{ width: 10, height: 10, borderRadius: 999, background: slice.color }} />
            <span style={{ color: MUTED }}>{slice.label}</span>
            <span style={{ fontWeight: 600, fontFeatureSettings: "tnum" }}>{formatSharePercent(slice.displayPct)}%</span>
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
      <div style={{ fontSize: 36, fontWeight: 600, fontFeatureSettings: "tnum" }}>{metric.value}</div>
      {metric.hint ? <div style={{ fontSize: 16, color: MUTED }}>{metric.hint}</div> : null}
    </div>
  );
}
