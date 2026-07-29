import { useState, useEffect, useCallback } from "react";

/* ────────────────────────────────────────────────────────────────────────
   THE 21 CURATED DATES — extracted from TCCA and Palm Beach 2026-27
   calendars, resolved per every decision made along the way.
──────────────────────────────────────────────────────────────────────── */
const DATES = [
  { date: "2026-09-07", tcca: true,  pbc: true,  type: "federal",     label: "Labor Day" },
  { date: "2026-09-16", tcca: true,  pbc: false, type: "half",        label: "Early Release" },
  { date: "2026-09-21", tcca: true,  pbc: true,  type: "school",      label: "Non-School Day" },
  { date: "2026-10-12", tcca: false, pbc: true,  type: "school",      label: "Duty/PDD, No School" },
  { date: "2026-10-14", tcca: true,  pbc: false, type: "half",        label: "Early Release" },
  { date: "2026-11-03", tcca: false, pbc: true,  type: "school",      label: "Duty/PDD, No School" },
  { date: "2026-11-11", tcca: true,  pbc: true,  type: "federal",     label: "Veterans Day" },
  { date: "2026-11-23", tcca: true,  pbc: true,  type: "break",       label: "Thanksgiving Break", breakEmoji: "🦃" },
  { date: "2026-12-21", tcca: true,  pbc: true,  type: "break",       label: "Winter Break", breakEmoji: "❄️" },
  { date: "2027-01-01", tcca: true,  pbc: true,  type: "federal",     label: "New Year's Day" },
  { date: "2027-01-04", tcca: true,  pbc: true,  type: "school",      label: "Teacher Work Day" },
  { date: "2027-01-18", tcca: true,  pbc: true,  type: "federal",     label: "MLK Day" },
  { date: "2027-02-15", tcca: false, pbc: true,  type: "federal",     label: "Presidents Day" },
  { date: "2027-02-22", tcca: true,  pbc: false, type: "school",      label: "Teacher PD" },
  { date: "2027-03-10", tcca: false, pbc: true,  type: "school",      label: "Spring Holiday" },
  { date: "2027-03-22", tcca: true,  pbc: true,  type: "break",       label: "Spring Break", breakEmoji: "🏖️" },
  { date: "2027-03-29", tcca: true,  pbc: true,  type: "school",      label: "Non-School / Duty-PDD" },
  { date: "2027-04-21", tcca: true,  pbc: false, type: "half",        label: "Early Release" },
  { date: "2027-05-26", tcca: true,  pbc: false, type: "half",        label: "Early Release" },
  { date: "2027-05-31", tcca: true,  pbc: true,  type: "federal",     label: "Memorial Day" },
  { date: "2027-06-17", tcca: false, pbc: true,  type: "federal",     label: "Juneteenth" },
];

const TYPE_META = {
  school:  { icon: "🎓", color: "#34D399", label: "School day off" },
  federal: { icon: "🎉", color: "#818CF8", label: "Federal holiday" },
  break:   { icon: "🗓️", color: "#FBBF24", label: "Break" },
  half:    { icon: "🕐", color: "#4a6080", label: "Half day" },
};

const HOTELS = [
  { id: "hardrock",     name: "Hard Rock",     emoji: "🎸" },
  { id: "portofino",    name: "Portofino Bay", emoji: "🌋" },
  { id: "royalpacific", name: "Royal Pacific", emoji: "🌊" },
  { id: "helios",       name: "Helios Grand",  emoji: "✨" },
];

function fmtDate(iso) {
  const d = new Date(iso + "T12:00:00");
  return d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", year: "numeric" });
}
function addDays(iso, n) {
  const d = new Date(iso + "T12:00:00");
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
}
function crowdColor(score) {
  if (score == null) return "#4a6080";
  if (score <= 25) return "#34D399";
  if (score <= 35) return "#FBBF24";
  return "#F87171";
}
function fmtMoney(n) {
  return n == null ? null : "$" + Math.round(n).toLocaleString();
}

const CSS = `
  @import url('https://fonts.googleapis.com/css2?family=Sora:wght@400;500;600;700;800&family=Space+Mono:wght@400;700&display=swap');
  *,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
  body{background:#05080f;font-family:'Sora',sans-serif;color:#f0f4ff}
  button{font-family:'Sora',sans-serif}
  ::-webkit-scrollbar{height:6px;width:6px}
  ::-webkit-scrollbar-thumb{background:#1e3a5f;border-radius:4px}
  .mono{font-family:'Space Mono',monospace}
`;

export default function App() {
  const [crowdScores, setCrowdScores] = useState({});
  const [rates, setRates] = useState({}); // { "2026-09-07": {hardrock:{rate,link}, ...} }
  const [loadingRates, setLoadingRates] = useState({});
  const [crowdStatus, setCrowdStatus] = useState("loading");
  const [lastUpdated, setLastUpdated] = useState(null);
  const [cooldown, setCooldown] = useState(0);

  const fetchCrowd = useCallback(async () => {
    setCrowdStatus("loading");
    try {
      const res = await fetch("/api/crowdcalendar");
      const data = await res.json();
      setCrowdScores(data.scores || {});
      setCrowdStatus(data.stale ? "stale" : "ok");
    } catch {
      setCrowdStatus("error");
    }
  }, []);

  const fetchRate = useCallback(async (dateEntry) => {
    const { date } = dateEntry;
    setLoadingRates(prev => ({ ...prev, [date]: true }));
    try {
      const chkOut = addDays(date, 1);
      const res = await fetch(`/api/hotelrates?chk_in=${date}&chk_out=${chkOut}`);
      const data = await res.json();
      setRates(prev => ({ ...prev, [date]: data.hotels || {} }));
    } catch {
      setRates(prev => ({ ...prev, [date]: null }));
    }
    setLoadingRates(prev => ({ ...prev, [date]: false }));
  }, []);

  const refreshAll = useCallback(() => {
    if (cooldown > 0) return;
    fetchCrowd();
    DATES.forEach(d => fetchRate(d));
    setLastUpdated(new Date());
    setCooldown(90);
  }, [cooldown, fetchCrowd, fetchRate]);

  useEffect(() => { refreshAll(); }, []); // eslint-disable-line

  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setInterval(() => setCooldown(c => Math.max(0, c - 1)), 1000);
    return () => clearInterval(t);
  }, [cooldown]);

  const cheapestFor = (date) => {
    const r = rates[date];
    if (!r) return null;
    let min = null, minId = null;
    HOTELS.forEach(h => {
      const rate = r[h.id]?.rate;
      if (rate != null && (min == null || rate < min)) { min = rate; minId = h.id; }
    });
    return minId;
  };

  return (
    <div style={{ minHeight: "100vh", paddingBottom: 40 }}>
      <style>{CSS}</style>

      {/* HEADER */}
      <div style={{
        position: "sticky", top: 0, zIndex: 10, background: "rgba(5,8,15,0.95)",
        backdropFilter: "blur(8px)", borderBottom: "1px solid rgba(255,255,255,0.08)",
        padding: "16px 16px 12px",
      }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 10 }}>
          <div>
            <div style={{ fontSize: 18, fontWeight: 800, color: "#FBBF24" }}>🎯 Best Day Finder</div>
            <div style={{ fontSize: 11, color: "#4a6080", marginTop: 3 }}>
              TCCA + Palm Beach school-off days · live rates · IOA crowd score
            </div>
          </div>
          <button onClick={refreshAll} disabled={cooldown > 0} style={{
            background: cooldown > 0 ? "#1a2a3a" : "linear-gradient(135deg,#6366f1,#4f46e5)",
            color: cooldown > 0 ? "#3d5470" : "#fff", border: "none", borderRadius: 10,
            padding: "10px 16px", fontSize: 12, fontWeight: 800, cursor: cooldown > 0 ? "default" : "pointer",
            whiteSpace: "nowrap", flexShrink: 0,
          }}>
            {cooldown > 0 ? `⏳ ${cooldown}s` : "🔄 Refresh"}
          </button>
        </div>
        {lastUpdated && (
          <div style={{ fontSize: 10, color: "#3d5470", marginTop: 8 }}>
            Last updated {lastUpdated.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}
            {crowdStatus === "stale" && " · crowd data is cached (source unavailable)"}
            {crowdStatus === "error" && " · crowd fetch failed"}
          </div>
        )}
      </div>

      {/* LEGEND */}
      <div style={{ display: "flex", gap: 14, flexWrap: "wrap", padding: "12px 16px 4px", fontSize: 10, color: "#4a6080" }}>
        {Object.entries(TYPE_META).map(([k, m]) => (
          <div key={k} style={{ display: "flex", alignItems: "center", gap: 4 }}>
            <span>{m.icon}</span><span>{m.label}</span>
          </div>
        ))}
      </div>

      {/* TABLE */}
      <div style={{ overflowX: "auto", padding: "8px 16px 20px" }}>
        <table style={{ borderCollapse: "collapse", width: "100%", minWidth: 820 }}>
          <thead>
            <tr>
              <th style={thStyle("left", 150)}>Date</th>
              <th style={thStyle("center", 54)}>TCCA</th>
              <th style={thStyle("center", 54)}>PBC</th>
              <th style={thStyle("left", 100)}>Type</th>
              <th style={thStyle("center", 70)}>IOA Crowd</th>
              {HOTELS.map(h => (
                <th key={h.id} style={thStyle("center", 100)}>{h.emoji} {h.name}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {DATES.map((d) => {
              const meta = TYPE_META[d.type];
              const score = crowdScores[d.date];
              const cheapest = cheapestFor(d.date);
              const rowRates = rates[d.date];
              const isLoading = loadingRates[d.date];
              return (
                <tr key={d.date} style={{ borderLeft: `3px solid ${meta.color}` }}>
                  <td style={{ ...tdStyle("left"), fontWeight: 700 }}>{fmtDate(d.date)}</td>
                  <td style={tdStyle("center")}>
                    <Dot on={d.tcca} color="#F59E0B" />
                  </td>
                  <td style={tdStyle("center")}>
                    <Dot on={d.pbc} color="#10B981" />
                  </td>
                  <td style={{ ...tdStyle("left"), fontSize: 11 }}>
                    <div>{d.breakEmoji || meta.icon} {d.label}</div>
                  </td>
                  <td style={tdStyle("center")}>
                    {score != null ? (
                      <span style={{
                        display: "inline-block", padding: "3px 9px", borderRadius: 20,
                        background: `${crowdColor(score)}22`, color: crowdColor(score),
                        fontWeight: 800, fontSize: 12,
                      }}>{score}</span>
                    ) : (
                      <span style={{ color: "#3d5470", fontSize: 11 }}>{crowdStatus === "loading" ? "…" : "—"}</span>
                    )}
                  </td>
                  {HOTELS.map(h => {
                    const rate = rowRates?.[h.id]?.rate;
                    const isCheapest = h.id === cheapest;
                    return (
                      <td key={h.id} style={tdStyle("center")}>
                        {isLoading ? (
                          <span style={{ color: "#2d4060", fontSize: 11 }}>···</span>
                        ) : rate != null ? (
                          <span className="mono" style={{
                            fontWeight: isCheapest ? 800 : 500,
                            color: isCheapest ? "#34D399" : "#f0f4ff",
                            fontSize: 13,
                          }}>
                            {isCheapest && "★ "}{fmtMoney(rate)}
                          </span>
                        ) : (
                          <span style={{ color: "#3d5470", fontSize: 11 }}>—</span>
                        )}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div style={{ padding: "0 16px", fontSize: 10, color: "#3d5470", lineHeight: 1.6 }}>
        Rates shown are public Google Hotels rates, not Florida Passholder rates — use these to spot which dates are worth checking directly on Universal's site.
        Crowd score is Islands of Adventure's predicted average wait time in minutes (Thrill Data). ★ marks the cheapest of the 4 hotels for that date.
      </div>
    </div>
  );
}

function Dot({ on, color }) {
  return (
    <div style={{
      width: 10, height: 10, borderRadius: "50%", margin: "0 auto",
      background: on ? color : "rgba(255,255,255,0.08)",
    }} />
  );
}

function thStyle(align, minWidth) {
  return {
    textAlign: align, padding: "10px 12px", fontSize: 10, fontWeight: 800,
    color: "#818cf8", borderBottom: "1px solid rgba(255,255,255,0.1)",
    whiteSpace: "nowrap", minWidth,
  };
}
function tdStyle(align) {
  return {
    textAlign: align, padding: "10px 12px", fontSize: 12,
    borderBottom: "1px solid rgba(255,255,255,0.05)", background: "rgba(255,255,255,0.015)",
  };
}
