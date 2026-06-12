import React, { useState, useEffect, useMemo } from "react";

/* ────────────────────────────────────────────────────────────
   MERIDIAN — Issuer Intelligence & Liquidity Terminal
   Phase 2 — FULL 8-MODULE BUILD
   Live: CoinGecko Top 500 (2×250) · Persistent CRM (storage API)
   Per discovery: sidebar nav · 50 deep + 500 light · balanced
   density · kanban CRM · OTC comparison matrix · global search
   ──────────────────────────────────────────────────────────── */

const C = {
  bg: "#0B0F14", panel: "#11161D", panel2: "#161D26", border: "#1E2630",
  amber: "#FFB02E", green: "#2ECC8F", red: "#FF5C5C", blue: "#5B9DFF",
  text: "#E8EDF2", mute: "#8A97A6", dim: "#5A6675",
};

const SECTOR_MAP = {
  bitcoin: "Store of Value", ethereum: "L1", solana: "L1", "binancecoin": "Exchange",
  ripple: "Payments", cardano: "L1", avalanche2: "L1", tron: "L1", polkadot: "L1",
  chainlink: "Oracles", "matic-network": "L2 / Rollups", "polygon-ecosystem-token": "L2 / Rollups",
  litecoin: "Payments", "shiba-inu": "Memes", dogecoin: "Memes", pepe: "Memes", dogwifcoin: "Memes",
  uniswap: "DeFi", aave: "DeFi", maker: "DeFi", "lido-dao": "DeFi", "curve-dao-token": "DeFi",
  arbitrum: "L2 / Rollups", optimism: "L2 / Rollups", starknet: "L2 / Rollups", mantle: "L2 / Rollups",
  "immutable-x": "Gaming", gala: "Gaming", "the-sandbox": "Gaming", "axie-infinity": "Gaming",
  celestia: "Modular / DA", "injective-protocol": "L1 / DeFi", "sei-network": "L1", sui: "L1",
  aptos: "L1", near: "L1", "internet-computer": "Infra", filecoin: "DePIN", "render-token": "DePIN / AI",
  "fetch-ai": "AI", "bittensor": "AI", "artificial-superintelligence-alliance": "AI",
  "pyth-network": "Oracles", "jito-governance-token": "DeFi / MEV", ethena: "DeFi / Stables",
  wormhole: "Interop", "layerzero": "Interop", ondo: "RWA", "mantra-dao": "RWA",
  stellar: "Payments", cosmos: "Interop", "the-graph": "Infra", "theta-token": "Infra",
  monero: "Privacy", zcash: "Privacy", "eigenlayer": "Restaking", "ether-fi": "Restaking",
  "first-digital-usd": "Stables", "usd-coin": "Stables", tether: "Stables", dai: "Stables",
  "hyperliquid": "DeFi / Perps", "raydium": "DeFi", "jupiter-exchange-solana": "DeFi",
};
const sectorOf = (id) => SECTOR_MAP[id] || "Other";

const STABLE_IDS = new Set(["tether", "usd-coin", "dai", "first-digital-usd", "usds", "ethena-usde", "usdd", "true-usd", "paypal-usd", "frax"]);

/* ── Scoring (Phase-1 heuristics from live metrics) ── */
function score(m) {
  if (!m || !m.mcap) return null;
  const turnover = m.vol24 / m.mcap;
  const overhang = m.fdv && m.fdv > 0 ? m.fdv / m.mcap : 1;
  const liq = Math.max(2, Math.min(98, Math.round(turnover * 900)));
  const unlockRisk = Math.max(2, Math.min(98, Math.round((overhang - 1) * 38)));
  const mm = Math.max(2, Math.min(98, Math.round(100 - liq * 0.9)));
  const otc = Math.max(2, Math.min(98, Math.round(unlockRisk * 0.85 + 12)));
  const trsy = Math.max(2, Math.min(98, Math.round(unlockRisk * 0.5 + mm * 0.3 + 8)));
  const bd = Math.round(mm * 0.4 + otc * 0.35 + trsy * 0.25);
  return { turnover, overhang, liq, unlockRisk, mm, otc, trsy, bd };
}
function whyNow(t) {
  const s = t.s; if (!s) return "";
  const bits = [];
  if (s.mm >= 60) bits.push(`turnover only ${(s.turnover * 100).toFixed(1)}%/day for a ${fmtUSD(t.mcap)} token — MM angle`);
  if (s.otc >= 60) bits.push(`${s.overhang.toFixed(1)}x FDV overhang — unlock hedging / OTC angle`);
  if (Math.abs(t.chg24) >= 10) bits.push(`${t.chg24 > 0 ? "+" : ""}${t.chg24.toFixed(0)}% 24h — momentum window`);
  if (!bits.length) bits.push(`balanced profile · turnover ${(s.turnover * 100).toFixed(1)}%/day · overhang ${s.overhang.toFixed(1)}x`);
  return bits.join(" · ");
}

/* ── Claude API (deep-dives) ── */
async function askClaude(prompt) {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ model: "claude-sonnet-4-20250514", max_tokens: 1000, messages: [{ role: "user", content: prompt }] }),
  });
  if (!res.ok) throw new Error(`API ${res.status}`);
  const d = await res.json();
  return (d.content || []).filter((b) => b.type === "text").map((b) => b.text).join("\n");
}
function parseJson(text) {
  const c = text.replace(/```json|```/g, "").trim();
  return JSON.parse(c.slice(c.indexOf("{"), c.lastIndexOf("}") + 1));
}

/* ── Format helpers ── */
function fmtUSD(n) {
  if (n == null) return "—";
  if (n >= 1e9) return `$${(n / 1e9).toFixed(2)}B`;
  if (n >= 1e6) return `$${(n / 1e6).toFixed(0)}M`;
  return `$${Math.round(n).toLocaleString()}`;
}
const fmtPx = (p) => (p == null ? "—" : p < 0.01 ? `$${p.toFixed(5)}` : p < 1 ? `$${p.toFixed(4)}` : `$${p.toLocaleString(undefined, { maximumFractionDigits: 2 })}`);

/* ── Atoms ── */
const Mono = ({ children, style }) => <span style={{ fontFamily: "'IBM Plex Mono', monospace", ...style }}>{children}</span>;
const Eyebrow = ({ children, color = C.amber, mb = 8 }) => (
  <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 10, letterSpacing: "0.18em", textTransform: "uppercase", color, marginBottom: mb }}>{children}</div>
);
const Panel = ({ title, children, accent, style }) => (
  <div style={{ background: C.panel, border: `1px solid ${C.border}`, borderRadius: 6, padding: 14, marginBottom: 12, ...style }}>
    {title && <Eyebrow color={accent || C.amber}>{title}</Eyebrow>}
    {children}
  </div>
);
const Btn = ({ children, onClick, primary, disabled, small }) => (
  <button onClick={onClick} disabled={disabled} style={{
    background: primary ? C.amber : "transparent", color: primary ? "#0B0F14" : C.mute,
    border: primary ? "none" : `1px solid ${C.border}`, borderRadius: 4,
    padding: small ? "4px 9px" : "8px 14px", fontSize: small ? 10 : 11, fontWeight: primary ? 700 : 400,
    cursor: disabled ? "wait" : "pointer", fontFamily: "'IBM Plex Mono', monospace",
    letterSpacing: "0.06em", opacity: disabled ? 0.5 : 1,
  }}>{children}</button>
);
const ScoreChip = ({ val }) => {
  const col = val >= 70 ? C.green : val >= 45 ? C.amber : C.dim;
  return <Mono style={{ fontSize: 12, fontWeight: 600, color: col }}>{val ?? "—"}</Mono>;
};
const Chg = ({ v }) => v == null ? <Mono style={{ fontSize: 12, color: C.dim }}>—</Mono> :
  <Mono style={{ fontSize: 12, color: v >= 0 ? C.green : C.red }}>{v >= 0 ? "+" : ""}{v.toFixed(1)}%</Mono>;

/* ── MODULES ── */

/* M8: Executive Dashboard (home) — order per discovery: heatmap → alerts → opps → pipeline */
function ExecDashboard({ tokens, alerts, deals, openToken, goto }) {
  const sectors = useMemo(() => {
    const m = {};
    tokens.slice(0, 120).forEach((t) => {
      if (STABLE_IDS.has(t.id)) return;
      const sec = sectorOf(t.id); if (sec === "Other") return;
      (m[sec] = m[sec] || []).push(t.chg24 ?? 0);
    });
    return Object.entries(m).map(([name, a]) => ({ name, chg: a.reduce((x, y) => x + y, 0) / a.length }))
      .sort((a, b) => b.chg - a.chg);
  }, [tokens]);
  const opps = tokens.filter((t) => t.s && t.rank > 15 && !STABLE_IDS.has(t.id)).sort((a, b) => b.s.bd - a.s.bd).slice(0, 6);
  const active = deals.filter((d) => d.stage !== "Won" && d.stage !== "Lost");

  return (
    <div>
      <Eyebrow>Sector heat · 24h · live top 120</Eyebrow>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(112px, 1fr))", gap: 6, marginBottom: 20 }}>
        {sectors.map((s) => {
          const pos = s.chg >= 0, i = Math.min(Math.abs(s.chg) / 8, 1);
          return (
            <div key={s.name} style={{ background: pos ? `rgba(46,204,143,${0.08 + i * 0.28})` : `rgba(255,92,92,${0.08 + i * 0.28})`, border: `1px solid ${C.border}`, borderRadius: 4, padding: "9px 9px 7px" }}>
              <div style={{ fontSize: 10.5, color: C.text, marginBottom: 3 }}>{s.name}</div>
              <Mono style={{ fontSize: 12.5, fontWeight: 600, color: pos ? C.green : C.red }}>{pos ? "+" : ""}{s.chg.toFixed(1)}%</Mono>
            </div>
          );
        })}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: 14 }}>
        <div>
          <Eyebrow>Alerts · derived from live data</Eyebrow>
          {alerts.slice(0, 7).map((a, i) => (
            <div key={i} onClick={() => openToken(a.id)} style={{ padding: "8px 10px", marginBottom: 6, background: C.panel, border: `1px solid ${C.border}`, borderLeft: `3px solid ${a.sev === "crit" ? C.red : a.sev === "warn" ? C.amber : C.blue}`, borderRadius: 4, cursor: "pointer" }}>
              <Mono style={{ fontSize: 9, color: a.sev === "crit" ? C.red : a.sev === "warn" ? C.amber : C.blue, letterSpacing: "0.1em" }}>{a.tag}</Mono>
              <div style={{ fontSize: 11.5, color: C.text, marginTop: 3, lineHeight: 1.45 }}>{a.txt}</div>
            </div>
          ))}
        </div>
        <div>
          <Eyebrow>Top BD opportunities</Eyebrow>
          {opps.map((t, i) => (
            <div key={t.id} onClick={() => openToken(t.id)} style={{ display: "flex", alignItems: "center", gap: 10, padding: "9px 10px", marginBottom: 6, background: C.panel, border: `1px solid ${C.border}`, borderRadius: 4, cursor: "pointer" }}>
              <Mono style={{ fontSize: 10, color: C.dim, width: 18 }}>#{i + 1}</Mono>
              <div style={{ flex: 1, minWidth: 0 }}>
                <span style={{ fontSize: 12.5, fontWeight: 600 }}>{t.name}</span>
                <Mono style={{ fontSize: 10, color: C.amber, marginLeft: 6 }}>{t.sym}</Mono>
                <div style={{ fontSize: 10, color: C.dim, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{whyNow(t)}</div>
              </div>
              <div style={{ textAlign: "right" }}>
                <ScoreChip val={t.s.bd} />
                <div style={{ fontSize: 8.5, color: C.dim, fontFamily: "'IBM Plex Mono', monospace" }}>BD</div>
              </div>
            </div>
          ))}
          <Btn small onClick={() => goto("bd")}>OPEN OPPORTUNITY ENGINE →</Btn>
        </div>
        <div>
          <Eyebrow>Pipeline · {active.length} active deals</Eyebrow>
          {active.slice(0, 6).map((d) => (
            <div key={d.id} style={{ padding: "8px 10px", marginBottom: 6, background: C.panel, border: `1px solid ${C.border}`, borderRadius: 4 }}>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span style={{ fontSize: 12, fontWeight: 600 }}>{d.token} · {d.svc}</span>
                <Mono style={{ fontSize: 9.5, color: C.amber }}>{d.stage.toUpperCase()}</Mono>
              </div>
              {d.note && <div style={{ fontSize: 10.5, color: C.dim, marginTop: 2 }}>{d.note}</div>}
            </div>
          ))}
          {!active.length && <div style={{ fontSize: 11.5, color: C.dim, padding: "10px 0" }}>No deals yet — add your first from the CRM module or any project page.</div>}
          <Btn small onClick={() => goto("crm")}>OPEN CRM →</Btn>
        </div>
      </div>
    </div>
  );
}

/* M1: Issuer Intelligence — Top 500 screener. Column order per discovery: BD+why → liquidity → unlock → treasury */
function Screener({ tokens, openToken, search, sector, setSector }) {
  const [sortKey, setSortKey] = useState("rank");
  const [dir, setDir] = useState(1);
  const sectors = useMemo(() => ["All", ...new Set(tokens.map((t) => sectorOf(t.id)).filter((s) => s !== "Other"))], [tokens]);
  const rows = useMemo(() => {
    let r = tokens.filter((t) =>
      (!search || t.name.toLowerCase().includes(search) || t.sym.toLowerCase().includes(search)) &&
      (sector === "All" || sectorOf(t.id) === sector));
    const get = (t) => sortKey === "rank" ? t.rank : sortKey === "mcap" ? t.mcap : sortKey === "chg" ? t.chg24 ?? 0 :
      sortKey === "bd" ? t.s?.bd ?? -1 : sortKey === "liq" ? t.s?.liq ?? -1 : sortKey === "unlk" ? t.s?.unlockRisk ?? -1 : t.s?.overhang ?? -1;
    return r.sort((a, b) => (get(a) - get(b)) * dir);
  }, [tokens, search, sector, sortKey, dir]);
  const TH = ({ k, label, right }) => (
    <th onClick={() => { sortKey === k ? setDir(-dir) : (setSortKey(k), setDir(k === "rank" ? 1 : -1)); }}
      style={{ padding: "7px 10px", textAlign: right ? "right" : "left", fontSize: 9.5, letterSpacing: "0.12em", color: sortKey === k ? C.amber : C.dim, cursor: "pointer", fontFamily: "'IBM Plex Mono', monospace", whiteSpace: "nowrap", position: "sticky", top: 0, background: C.panel2 }}>
      {label}{sortKey === k ? (dir === 1 ? " ↑" : " ↓") : ""}
    </th>
  );
  return (
    <div>
      <div style={{ display: "flex", gap: 8, marginBottom: 10, flexWrap: "wrap", alignItems: "center" }}>
        <Eyebrow mb={0}>Token universe · {rows.length} shown</Eyebrow>
        <select value={sector} onChange={(e) => setSector(e.target.value)} style={{ marginLeft: "auto", background: C.panel, color: C.text, border: `1px solid ${C.border}`, borderRadius: 4, padding: "5px 8px", fontSize: 11 }}>
          {sectors.map((s) => <option key={s}>{s}</option>)}
        </select>
      </div>
      <div style={{ border: `1px solid ${C.border}`, borderRadius: 6, overflow: "auto", maxHeight: "70vh" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 880 }}>
          <thead><tr>
            <TH k="rank" label="#" /><th style={{ position: "sticky", top: 0, background: C.panel2 }}></th>
            <TH k="mcap" label="MCAP" right /><TH k="chg" label="24H" right />
            <TH k="bd" label="BD" right /><TH k="liq" label="LIQ" right />
            <TH k="unlk" label="UNLK" right /><TH k="ovh" label="FDV/MC" right />
            <th style={{ padding: "7px 10px", fontSize: 9.5, letterSpacing: "0.12em", color: C.dim, fontFamily: "'IBM Plex Mono', monospace", textAlign: "left", position: "sticky", top: 0, background: C.panel2 }}>WHY NOW</th>
          </tr></thead>
          <tbody>
            {rows.slice(0, 200).map((t) => (
              <tr key={t.id} onClick={() => openToken(t.id)} style={{ borderTop: `1px solid ${C.border}`, cursor: "pointer", background: t.rank <= 50 ? "rgba(255,176,46,0.03)" : "transparent" }}>
                <td style={{ padding: "7px 10px" }}><Mono style={{ fontSize: 11, color: C.dim }}>{t.rank}</Mono></td>
                <td style={{ padding: "7px 10px", whiteSpace: "nowrap" }}>
                  <span style={{ fontSize: 12.5, fontWeight: 600 }}>{t.name}</span>
                  <Mono style={{ fontSize: 10, color: C.amber, marginLeft: 6 }}>{t.sym}</Mono>
                  {t.rank <= 50 && <Mono style={{ fontSize: 8, color: C.amber, marginLeft: 6, border: `1px solid ${C.amber}44`, borderRadius: 3, padding: "1px 4px" }}>WATCH</Mono>}
                </td>
                <td style={{ padding: "7px 10px", textAlign: "right" }}><Mono style={{ fontSize: 11.5 }}>{fmtUSD(t.mcap)}</Mono></td>
                <td style={{ padding: "7px 10px", textAlign: "right" }}><Chg v={t.chg24} /></td>
                <td style={{ padding: "7px 10px", textAlign: "right" }}><ScoreChip val={t.s?.bd} /></td>
                <td style={{ padding: "7px 10px", textAlign: "right" }}><ScoreChip val={t.s?.liq} /></td>
                <td style={{ padding: "7px 10px", textAlign: "right" }}><ScoreChip val={t.s?.unlockRisk} /></td>
                <td style={{ padding: "7px 10px", textAlign: "right" }}><Mono style={{ fontSize: 11, color: t.s?.overhang >= 3 ? C.red : C.mute }}>{t.s ? t.s.overhang.toFixed(1) + "x" : "—"}</Mono></td>
                <td style={{ padding: "7px 10px", fontSize: 10.5, color: C.dim, maxWidth: 280, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{whyNow(t)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div style={{ fontSize: 10, color: C.dim, marginTop: 6 }}>Showing first 200 of {rows.length} matches — refine with search/sector. Top 50 flagged WATCH = deep-coverage tier.</div>
    </div>
  );
}

/* M2: Development Tracker — news-style feed derived from live market events + AI digests */
function DevTracker({ tokens, aiNotes, openToken }) {
  const events = useMemo(() => {
    const ev = [];
    tokens.slice(0, 150).forEach((t) => {
      if (STABLE_IDS.has(t.id)) return;
      if (Math.abs(t.chg24 ?? 0) >= 9) ev.push({ id: t.id, mag: Math.abs(t.chg24), txt: `${t.name} (${t.sym}) ${t.chg24 > 0 ? "rallied" : "dropped"} ${Math.abs(t.chg24).toFixed(1)}% in 24h — check announcements / governance before outreach.`, tag: t.chg24 > 0 ? "MOMENTUM" : "DRAWDOWN", col: t.chg24 > 0 ? C.green : C.red });
      if (t.s && t.s.turnover > 0.5) ev.push({ id: t.id, mag: t.s.turnover * 20, txt: `${t.name} volume spike: ${(t.s.turnover * 100).toFixed(0)}% of mcap traded in 24h (${fmtUSD(t.vol24)}) — possible listing, unlock, or news event.`, tag: "VOLUME SPIKE", col: C.amber });
    });
    return ev.sort((a, b) => b.mag - a.mag).slice(0, 20);
  }, [tokens]);
  return (
    <div>
      <Panel title="How this module works in production" accent={C.blue}>
        <div style={{ fontSize: 11.5, color: C.mute, lineHeight: 1.6 }}>
          Phase 3 wires the crawler: blogs, governance forums, GitHub velocity, X, Discord — summarized per project. In this build, the feed shows <b style={{ color: C.text }}>live market-derived events</b> (big moves, volume spikes), and any AI deep-dives you run appear here as digests.
        </div>
      </Panel>
      <Eyebrow>Live event feed · latest signals first</Eyebrow>
      {events.map((e, i) => (
        <div key={i} onClick={() => openToken(e.id)} style={{ padding: "10px 12px", marginBottom: 7, background: C.panel, border: `1px solid ${C.border}`, borderLeft: `3px solid ${e.col}`, borderRadius: 4, cursor: "pointer" }}>
          <Mono style={{ fontSize: 9, color: e.col, letterSpacing: "0.1em" }}>{e.tag}</Mono>
          <div style={{ fontSize: 12, color: C.text, marginTop: 3, lineHeight: 1.5 }}>{e.txt}</div>
        </div>
      ))}
      {Object.keys(aiNotes).length > 0 && (<>
        <Eyebrow mb={8}>Your AI digests</Eyebrow>
        {Object.entries(aiNotes).map(([id, n]) => {
          const t = tokens.find((x) => x.id === id);
          return t ? (
            <div key={id} onClick={() => openToken(id)} style={{ padding: "10px 12px", marginBottom: 7, background: C.panel, border: `1px solid ${C.border}`, borderLeft: `3px solid ${C.blue}`, borderRadius: 4, cursor: "pointer" }}>
              <Mono style={{ fontSize: 9, color: C.blue }}>AI DIGEST · {t.sym}</Mono>
              <div style={{ fontSize: 12, color: C.text, marginTop: 3, lineHeight: 1.5 }}>{n.building}</div>
            </div>
          ) : null;
        })}
      </>)}
    </div>
  );
}

/* M3: Liquidity Intelligence */
function LiquidityIntel({ tokens, openToken }) {
  const pain = tokens.filter((t) => t.s && t.mcap > 5e7 && !STABLE_IDS.has(t.id) && t.rank > 15)
    .sort((a, b) => a.s.liq - b.s.liq).slice(0, 25);
  return (
    <div>
      <Panel title="Liquidity pain ranking · lowest turnover for size = strongest MM angle">
        <div style={{ fontSize: 11, color: C.dim, marginBottom: 10, lineHeight: 1.5 }}>
          Phase-1 proxy: 24h volume ÷ mcap. Phase 2 adds order-book depth, spread-vs-peer, and venue fragmentation per the architecture.
        </div>
        {pain.map((t, i) => (
          <div key={t.id} onClick={() => openToken(t.id)} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 4px", borderTop: i ? `1px solid ${C.border}` : "none", cursor: "pointer" }}>
            <Mono style={{ fontSize: 10, color: C.dim, width: 22 }}>#{i + 1}</Mono>
            <div style={{ width: 170, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
              <span style={{ fontSize: 12.5, fontWeight: 600 }}>{t.name}</span>
              <Mono style={{ fontSize: 10, color: C.amber, marginLeft: 6 }}>{t.sym}</Mono>
            </div>
            <Mono style={{ fontSize: 11, color: C.mute, width: 70, textAlign: "right" }}>{fmtUSD(t.mcap)}</Mono>
            <div style={{ flex: 1 }}>
              <div style={{ height: 6, background: C.border, borderRadius: 3 }}>
                <div style={{ height: 6, width: `${Math.min(t.s.turnover * 1200, 100)}%`, background: t.s.liq < 25 ? C.red : C.amber, borderRadius: 3 }} />
              </div>
            </div>
            <Mono style={{ fontSize: 11, width: 86, textAlign: "right", color: t.s.liq < 25 ? C.red : C.amber }}>{(t.s.turnover * 100).toFixed(2)}%/day</Mono>
          </div>
        ))}
      </Panel>
    </div>
  );
}

/* M4: BD Opportunity Engine */
function BDEngine({ tokens, openToken }) {
  const [svc, setSvc] = useState("BD");
  const key = svc === "MM" ? "mm" : svc === "OTC" ? "otc" : svc === "TRSY" ? "trsy" : "bd";
  const opps = tokens.filter((t) => t.s && t.rank > 15 && !STABLE_IDS.has(t.id)).sort((a, b) => b.s[key] - a.s[key]).slice(0, 30);
  return (
    <div>
      <div style={{ display: "flex", gap: 6, marginBottom: 12 }}>
        {["BD", "MM", "OTC", "TRSY"].map((x) => (
          <button key={x} onClick={() => setSvc(x)} style={{ background: svc === x ? C.amber : "transparent", color: svc === x ? "#0B0F14" : C.mute, border: `1px solid ${svc === x ? C.amber : C.border}`, borderRadius: 4, padding: "5px 12px", fontSize: 10.5, fontWeight: 600, cursor: "pointer", fontFamily: "'IBM Plex Mono', monospace" }}>{x}</button>
        ))}
      </div>
      {opps.map((t, i) => (
        <div key={t.id} onClick={() => openToken(t.id)} style={{ background: C.panel, border: `1px solid ${C.border}`, borderRadius: 6, marginBottom: 8, cursor: "pointer", overflow: "hidden" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 12px", flexWrap: "wrap" }}>
            <Mono style={{ fontSize: 10, color: C.dim, width: 22 }}>#{i + 1}</Mono>
            <div style={{ minWidth: 150 }}>
              <span style={{ fontSize: 13.5, fontWeight: 600 }}>{t.name}</span>
              <Mono style={{ fontSize: 10, color: C.amber, marginLeft: 6 }}>{t.sym}</Mono>
              <div style={{ fontSize: 9.5, color: C.dim }}>{sectorOf(t.id)} · {fmtUSD(t.mcap)}</div>
            </div>
            <Chg v={t.chg24} />
            <div style={{ display: "flex", gap: 14, marginLeft: "auto" }}>
              {[["MM", t.s.mm], ["OTC", t.s.otc], ["TRSY", t.s.trsy], ["BD", t.s.bd]].map(([l, v]) => (
                <div key={l} style={{ textAlign: "center" }}>
                  <ScoreChip val={v} />
                  <div style={{ fontSize: 8, color: C.dim, fontFamily: "'IBM Plex Mono', monospace", letterSpacing: "0.1em" }}>{l}</div>
                </div>
              ))}
            </div>
          </div>
          <div style={{ borderTop: `1px solid ${C.border}`, borderLeft: `3px solid ${C.amber}`, padding: "7px 12px", fontSize: 11, color: C.mute, background: C.panel2 }}>
            <Mono style={{ color: C.amber, fontSize: 9.5, marginRight: 6 }}>WHY ▸</Mono>{whyNow(t)}
          </div>
        </div>
      ))}
    </div>
  );
}

/* M5: Treasury Intelligence */
function TreasuryIntel({ tokens, openToken }) {
  const risk = tokens.filter((t) => t.s && t.s.overhang >= 2 && t.mcap > 1e8 && !STABLE_IDS.has(t.id))
    .sort((a, b) => b.s.overhang - a.s.overhang).slice(0, 20);
  return (
    <div>
      <Panel title="Treasury & supply concentration · FDV overhang screen" accent={C.red}>
        <div style={{ fontSize: 11, color: C.dim, marginBottom: 10, lineHeight: 1.5 }}>
          High FDV/mcap = large non-circulating supply held by team, foundation, and investors — the diversification and unlock-hedging conversation. Phase 2 adds labeled-wallet treasury composition (stables/native/BTC/ETH split) per the architecture.
        </div>
        {risk.map((t, i) => (
          <div key={t.id} onClick={() => openToken(t.id)} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 4px", borderTop: i ? `1px solid ${C.border}` : "none", cursor: "pointer" }}>
            <div style={{ width: 170, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
              <span style={{ fontSize: 12.5, fontWeight: 600 }}>{t.name}</span>
              <Mono style={{ fontSize: 10, color: C.amber, marginLeft: 6 }}>{t.sym}</Mono>
            </div>
            <Mono style={{ fontSize: 11, color: C.mute, width: 70, textAlign: "right" }}>{fmtUSD(t.mcap)}</Mono>
            <div style={{ flex: 1 }}>
              <div style={{ display: "flex", height: 10, borderRadius: 3, overflow: "hidden", border: `1px solid ${C.border}` }}>
                <div style={{ width: `${(1 / t.s.overhang) * 100}%`, background: C.green, opacity: 0.7 }} title="circulating" />
                <div style={{ flex: 1, background: C.red, opacity: 0.55 }} title="locked / non-circulating" />
              </div>
            </div>
            <Mono style={{ fontSize: 11.5, width: 56, textAlign: "right", color: C.red }}>{t.s.overhang.toFixed(1)}x</Mono>
            <Mono style={{ fontSize: 10, width: 96, textAlign: "right", color: C.dim }}>{((1 - 1 / t.s.overhang) * 100).toFixed(0)}% locked</Mono>
          </div>
        ))}
        <div style={{ display: "flex", gap: 14, marginTop: 8 }}>
          <Mono style={{ fontSize: 9.5, color: C.green }}>■ circulating</Mono>
          <Mono style={{ fontSize: 9.5, color: C.red }}>■ locked / non-circulating</Mono>
        </div>
      </Panel>
    </div>
  );
}

/* M6: OTC Structures — comparison matrix per discovery */
const OTC_LIB = [
  { n: "Covered call program", obj: "Yield on native treasury", fit: "Large native holdings, neutral/bullish", tenor: "1–3m rolling", payoff: "Premium income; capped upside", risk: "Tokens called away in rallies", profile: (s) => s.trsy >= 50 },
  { n: "Zero-cost collar", obj: "Protect value pre-unlock", fit: "Cliff unlock 30–90 days out", tenor: "Match unlock date", payoff: "Floor + cap, no premium outlay", risk: "Upside capped through event", profile: (s) => s.unlockRisk >= 55 },
  { n: "Put spread", obj: "Cheap downside protection", fit: "Event risk, limited budget", tenor: "1–2m", payoff: "Defined protection band", risk: "Protection limited below lower strike", profile: (s) => s.unlockRisk >= 40 },
  { n: "Decumulator", obj: "Orderly monetization", fit: "Need to sell without market impact", tenor: "30–90 days", payoff: "Sells at premium to spot daily", risk: "Accelerated selling in drawdowns", profile: (s) => s.otc >= 55 },
  { n: "TWAP diversification mandate", obj: "Native → stables conversion", fit: "Concentrated treasury, thin books", tenor: "Programmatic, weeks", payoff: "Minimal footprint execution", risk: "Execution-window price drift", profile: (s) => s.trsy >= 60 && s.liq <= 45 },
  { n: "Stable yield enhancement", obj: "Yield on stable reserves", fit: "Post-diversification treasuries", tenor: "Open / rolling", payoff: "Enhanced stable yield", risk: "Counterparty / venue risk", profile: () => true },
];
function OTCMatrix({ tokens, openToken }) {
  const [sel, setSel] = useState("");
  const t = tokens.find((x) => x.id === sel);
  const watch = tokens.slice(0, 50).filter((x) => !STABLE_IDS.has(x.id));
  return (
    <div>
      <div style={{ display: "flex", gap: 10, alignItems: "center", marginBottom: 12, flexWrap: "wrap" }}>
        <Eyebrow mb={0}>Structure library · comparison matrix</Eyebrow>
        <select value={sel} onChange={(e) => setSel(e.target.value)} style={{ marginLeft: "auto", background: C.panel, color: C.text, border: `1px solid ${C.border}`, borderRadius: 4, padding: "5px 8px", fontSize: 11 }}>
          <option value="">Fit-check a token…</option>
          {watch.map((x) => <option key={x.id} value={x.id}>{x.name} ({x.sym})</option>)}
        </select>
      </div>
      <div style={{ border: `1px solid ${C.border}`, borderRadius: 6, overflow: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 860 }}>
          <thead><tr>
            {["STRUCTURE", "OBJECTIVE", "BEST FIT", "TENOR", "PAYOFF", "KEY RISK", t ? `FIT: ${t.sym}` : ""].map((h, i) => (
              <th key={i} style={{ padding: "8px 12px", textAlign: "left", fontSize: 9.5, letterSpacing: "0.12em", color: C.dim, fontFamily: "'IBM Plex Mono', monospace", background: C.panel2, whiteSpace: "nowrap" }}>{h}</th>
            ))}
          </tr></thead>
          <tbody>
            {OTC_LIB.map((o, i) => {
              const fits = t?.s ? o.profile(t.s) : null;
              return (
                <tr key={i} style={{ borderTop: `1px solid ${C.border}`, background: fits ? "rgba(46,204,143,0.05)" : "transparent" }}>
                  <td style={{ padding: "10px 12px", fontSize: 12.5, fontWeight: 600, whiteSpace: "nowrap" }}>{o.n}</td>
                  <td style={{ padding: "10px 12px", fontSize: 11.5, color: C.mute }}>{o.obj}</td>
                  <td style={{ padding: "10px 12px", fontSize: 11.5, color: C.mute }}>{o.fit}</td>
                  <td style={{ padding: "10px 12px" }}><Mono style={{ fontSize: 10.5, color: C.mute }}>{o.tenor}</Mono></td>
                  <td style={{ padding: "10px 12px", fontSize: 11.5, color: C.mute }}>{o.payoff}</td>
                  <td style={{ padding: "10px 12px", fontSize: 11.5, color: C.red, opacity: 0.85 }}>{o.risk}</td>
                  {t && <td style={{ padding: "10px 12px" }}><Mono style={{ fontSize: 10.5, color: fits ? C.green : C.dim }}>{fits ? "● STRONG FIT" : "○ secondary"}</Mono></td>}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {t && <div style={{ marginTop: 10 }}><Btn small onClick={() => openToken(t.id)}>OPEN {t.sym} PROJECT PAGE →</Btn></div>}
      <div style={{ fontSize: 10, color: C.dim, marginTop: 8 }}>INDICATIVE · PRE-TRADE · STRUCTURES SUBJECT TO COMPLIANCE & LEGAL REVIEW</div>
    </div>
  );
}

/* M7: CRM — Kanban with drag-and-drop, persisted via storage API */
const STAGES = ["Signal", "Qualified", "Contacted", "Meeting", "Proposal", "Won"];
function CRM({ deals, setDeals, tokens }) {
  const [dragId, setDragId] = useState(null);
  const [newToken, setNewToken] = useState("");
  const [newSvc, setNewSvc] = useState("MM");
  const watch = tokens.slice(0, 80).filter((x) => !STABLE_IDS.has(x.id));
  const add = () => {
    if (!newToken) return;
    const t = tokens.find((x) => x.id === newToken);
    setDeals([...deals, { id: Date.now().toString(), token: t ? t.sym : newToken, svc: newSvc, stage: "Signal", note: "" }]);
    setNewToken("");
  };
  const move = (id, stage) => setDeals(deals.map((d) => (d.id === id ? { ...d, stage } : d)));
  const del = (id) => setDeals(deals.filter((d) => d.id !== id));
  return (
    <div>
      <div style={{ display: "flex", gap: 8, marginBottom: 14, flexWrap: "wrap", alignItems: "center" }}>
        <select value={newToken} onChange={(e) => setNewToken(e.target.value)} style={{ background: C.panel, color: C.text, border: `1px solid ${C.border}`, borderRadius: 4, padding: "6px 8px", fontSize: 11 }}>
          <option value="">Select token…</option>
          {watch.map((x) => <option key={x.id} value={x.id}>{x.name} ({x.sym})</option>)}
        </select>
        <select value={newSvc} onChange={(e) => setNewSvc(e.target.value)} style={{ background: C.panel, color: C.text, border: `1px solid ${C.border}`, borderRadius: 4, padding: "6px 8px", fontSize: 11 }}>
          {["MM", "OTC", "Treasury", "Listing"].map((s) => <option key={s}>{s}</option>)}
        </select>
        <Btn primary onClick={add}>+ ADD DEAL</Btn>
        <Mono style={{ fontSize: 9.5, color: C.dim, marginLeft: "auto" }}>DRAG CARDS BETWEEN STAGES · SAVED TO YOUR DEVICE</Mono>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: `repeat(${STAGES.length}, minmax(150px, 1fr))`, gap: 8, overflowX: "auto" }}>
        {STAGES.map((st) => (
          <div key={st} onDragOver={(e) => e.preventDefault()} onDrop={() => dragId && move(dragId, st)}
            style={{ background: C.panel, border: `1px solid ${C.border}`, borderRadius: 6, padding: 8, minHeight: 220 }}>
            <Eyebrow color={st === "Won" ? C.green : C.amber}>{st} · {deals.filter((d) => d.stage === st).length}</Eyebrow>
            {deals.filter((d) => d.stage === st).map((d) => (
              <div key={d.id} draggable onDragStart={() => setDragId(d.id)} onDragEnd={() => setDragId(null)}
                style={{ background: C.panel2, border: `1px solid ${C.border}`, borderRadius: 4, padding: "8px 9px", marginBottom: 6, cursor: "grab" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                  <span style={{ fontSize: 12, fontWeight: 600 }}>{d.token}</span>
                  <span onClick={() => del(d.id)} style={{ fontSize: 10, color: C.dim, cursor: "pointer" }}>✕</span>
                </div>
                <Mono style={{ fontSize: 9.5, color: C.amber }}>{d.svc}</Mono>
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

/* Project detail */
function Detail({ t, ai, onAnalyze, analyzing, onBack, addDeal }) {
  const s = t.s;
  return (
    <div>
      <div style={{ display: "flex", gap: 8 }}>
        <Btn onClick={onBack}>← BACK</Btn>
        <Btn small onClick={() => addDeal(t)}>+ ADD TO PIPELINE</Btn>
      </div>
      <div style={{ display: "flex", alignItems: "baseline", gap: 12, flexWrap: "wrap", margin: "14px 0 4px" }}>
        <h1 style={{ fontSize: 24, fontWeight: 700, margin: 0 }}>{t.name}</h1>
        <Mono style={{ fontSize: 13, color: C.amber }}>{t.sym}</Mono>
        <span style={{ fontSize: 11.5, color: C.dim }}>{sectorOf(t.id)} · rank #{t.rank}</span>
        <Chg v={t.chg24} />
      </div>
      <div style={{ display: "flex", gap: 18, marginBottom: 14, flexWrap: "wrap", alignItems: "center" }}>
        {[["PRICE", fmtPx(t.price)], ["MCAP", fmtUSD(t.mcap)], ["FDV", fmtUSD(t.fdv)], ["VOL 24H", fmtUSD(t.vol24)],
          ...(s ? [["TURNOVER", `${(s.turnover * 100).toFixed(1)}%`], ["FDV/MC", `${s.overhang.toFixed(2)}x`]] : [])].map(([k, v]) => (
          <div key={k}>
            <Mono style={{ fontSize: 9, color: C.dim, letterSpacing: "0.14em" }}>{k}</Mono>
            <div><Mono style={{ fontSize: 13.5 }}>{v}</Mono></div>
          </div>
        ))}
        <div style={{ marginLeft: "auto" }}>
          <Btn primary onClick={onAnalyze} disabled={analyzing}>{analyzing ? "ANALYZING…" : ai ? "REFRESH DEEP-DIVE" : "RUN AI DEEP-DIVE"}</Btn>
        </div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 12 }}>
        <Panel title="Signal scores · live-metric heuristics">
          {s ? (<>
            {[["Liquidity turnover", s.liq, false], ["Unlock / FDV overhang", s.unlockRisk, true], ["MM opportunity", s.mm, false], ["OTC opportunity", s.otc, false], ["Treasury opportunity", s.trsy, false]].map(([l, v, inv]) => {
              const danger = inv ? v : 100 - v, col = danger >= 65 ? C.red : danger >= 40 ? C.amber : C.green;
              return (
                <div key={l} style={{ marginBottom: 9 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 3 }}>
                    <span style={{ fontSize: 11, color: C.mute }}>{l}</span><Mono style={{ fontSize: 11, color: col }}>{v}</Mono>
                  </div>
                  <div style={{ height: 4, background: C.border, borderRadius: 2 }}><div style={{ height: 4, width: `${v}%`, background: col, borderRadius: 2 }} /></div>
                </div>
              );
            })}
            <div style={{ borderLeft: `3px solid ${C.amber}`, paddingLeft: 10, marginTop: 10, fontSize: 11.5, color: C.mute, lineHeight: 1.55 }}>
              <Mono style={{ color: C.amber, fontSize: 9.5, marginRight: 6 }}>WHY NOW ▸</Mono>{whyNow(t)}
            </div>
          </>) : <div style={{ fontSize: 12, color: C.dim }}>No score data.</div>}
        </Panel>
        <Panel title="AI deep-dive · BD analysis" accent={C.blue}>
          {ai ? (<>
            <Mono style={{ fontSize: 9, color: C.blue, letterSpacing: "0.14em" }}>WHAT THEY'RE BUILDING</Mono>
            <div style={{ fontSize: 12.5, lineHeight: 1.6, margin: "4px 0 10px" }}>{ai.building}</div>
            <div style={{ borderLeft: `3px solid ${C.amber}`, paddingLeft: 10, marginBottom: 10 }}>
              <Mono style={{ fontSize: 9, color: C.amber, letterSpacing: "0.14em" }}>BD ANGLE</Mono>
              <div style={{ fontSize: 12.5, lineHeight: 1.6, marginTop: 4 }}>{ai.bd_angle}</div>
            </div>
            <div style={{ borderLeft: `3px solid ${C.green}`, paddingLeft: 10 }}>
              <Mono style={{ fontSize: 9, color: C.green, letterSpacing: "0.14em" }}>INDICATIVE STRUCTURE</Mono>
              <div style={{ fontSize: 12.5, lineHeight: 1.6, marginTop: 4 }}>{ai.otc_idea}</div>
              <Mono style={{ fontSize: 9, color: C.dim, display: "block", marginTop: 8 }}>AI-GENERATED · INDICATIVE · VERIFY BEFORE CLIENT USE</Mono>
            </div>
          </>) : <div style={{ fontSize: 12, color: C.mute, lineHeight: 1.6 }}>Run the deep-dive for a structured BD read on {t.name} grounded in its live metrics.</div>}
        </Panel>
      </div>
    </div>
  );
}

/* ── Sidebar modules ── */
const MODULES = [
  { id: "exec", label: "Executive Dashboard", icon: "◆" },
  { id: "screener", label: "Issuer Intelligence", icon: "▦" },
  { id: "dev", label: "Development Tracker", icon: "▲" },
  { id: "liq", label: "Liquidity Intelligence", icon: "≋" },
  { id: "bd", label: "BD Opportunity Engine", icon: "◎" },
  { id: "trsy", label: "Treasury Intelligence", icon: "▣" },
  { id: "otc", label: "OTC Structures", icon: "⧉" },
  { id: "crm", label: "CRM Pipeline", icon: "⊞" },
];

export default function Meridian() {
  const [tokens, setTokens] = useState([]);
  const [status, setStatus] = useState("idle");
  const [updated, setUpdated] = useState(null);
  const [err, setErr] = useState("");
  const [view, setView] = useState("exec");
  const [openId, setOpenId] = useState(null);
  const [search, setSearch] = useState("");
  const [sector, setSector] = useState("All");
  const [aiNotes, setAiNotes] = useState({});
  const [analyzing, setAnalyzing] = useState(false);
  const [deals, setDealsRaw] = useState([]);
  const [navOpen, setNavOpen] = useState(true);

  /* Persist CRM via storage API */
  useEffect(() => {
    (async () => {
      try {
        const r = await window.storage.get("meridian-crm-deals");
        if (r?.value) setDealsRaw(JSON.parse(r.value));
      } catch { /* no saved deals yet */ }
    })();
  }, []);
  const setDeals = (d) => {
    setDealsRaw(d);
    (async () => { try { await window.storage.set("meridian-crm-deals", JSON.stringify(d)); } catch (e) { console.error("save failed", e); } })();
  };

  /* Live data: Top 500 in two CoinGecko pages */
  async function refresh() {
    setStatus("loading"); setErr("");
    try {
      const all = [];
      for (let page = 1; page <= 2; page++) {
        const url = `https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&order=market_cap_desc&per_page=250&page=${page}&price_change_percentage=24h`;
        const res = await fetch(url, { headers: { accept: "application/json" } });
        if (!res.ok) throw new Error(`CoinGecko ${res.status}`);
        const rows = await res.json();
        all.push(...rows);
        if (page === 1) await new Promise((r) => setTimeout(r, 1200));
      }
      const mapped = all.map((r) => {
        const base = { id: r.id, sym: (r.symbol || "").toUpperCase(), name: r.name, rank: r.market_cap_rank ?? 999, price: r.current_price, mcap: r.market_cap, fdv: r.fully_diluted_valuation, vol24: r.total_volume, chg24: r.price_change_percentage_24h };
        return { ...base, s: score(base) };
      }).filter((t) => t.mcap);
      setTokens(mapped);
      setUpdated(new Date());
      setStatus("live");
    } catch (e) {
      console.error(e);
      setErr("Live fetch failed — CoinGecko free tier rate-limits bursts. Wait ~60s and hit REFRESH.");
      setStatus(tokens.length ? "live" : "error");
    }
  }
  useEffect(() => { refresh(); }, []);

  /* Derived alerts */
  const alerts = useMemo(() => {
    const a = [];
    tokens.slice(0, 200).forEach((t) => {
      if (STABLE_IDS.has(t.id) || !t.s) return;
      if (t.s.overhang >= 4 && t.mcap > 2e8) a.push({ id: t.id, sev: "crit", tag: "UNLOCK OVERHANG", txt: `${t.name} (${t.sym}): ${t.s.overhang.toFixed(1)}x FDV/mcap — ${((1 - 1 / t.s.overhang) * 100).toFixed(0)}% of supply locked. Unlock-hedging conversation.`, mag: t.s.overhang });
      else if (t.s.turnover < 0.012 && t.mcap > 3e8 && t.rank > 25) a.push({ id: t.id, sev: "warn", tag: "LIQUIDITY", txt: `${t.name} (${t.sym}): turnover ${(t.s.turnover * 100).toFixed(2)}%/day on ${fmtUSD(t.mcap)} mcap — thin for size, MM angle.`, mag: 3 + 1 / (t.s.turnover + 0.001) / 1000 });
      else if (Math.abs(t.chg24 ?? 0) >= 14) a.push({ id: t.id, sev: "info", tag: "MOMENTUM", txt: `${t.name} (${t.sym}) ${t.chg24 > 0 ? "+" : ""}${t.chg24.toFixed(1)}% 24h — engagement window.`, mag: Math.abs(t.chg24) / 5 });
    });
    return a.sort((x, y) => y.mag - x.mag);
  }, [tokens]);

  async function runDeepDive(id) {
    const t = tokens.find((x) => x.id === id);
    if (!t) return;
    setAnalyzing(true); setErr("");
    try {
      const prompt = `You are a senior BD analyst at a crypto market-making firm. Token: ${t.name} (${t.sym}), sector ${sectorOf(t.id)}, rank #${t.rank}. Live: mcap ${fmtUSD(t.mcap)}, FDV ${fmtUSD(t.fdv)}, 24h vol ${fmtUSD(t.vol24)}, FDV/mcap ${t.s ? t.s.overhang.toFixed(2) : "?"}x, turnover ${t.s ? (t.s.turnover * 100).toFixed(1) : "?"}%/day.
Respond ONLY with JSON, no markdown: {"building":"2-3 sentences on the project and current focus","bd_angle":"2-3 sentences: strongest reason an MM/OTC desk should engage now, grounded in these metrics","otc_idea":"1-2 sentences: one indicative treasury/OTC structure for this profile"}`;
      const obj = parseJson(await askClaude(prompt));
      setAiNotes((p) => ({ ...p, [id]: obj }));
    } catch (e) { console.error(e); setErr("AI deep-dive failed — retry in a moment."); }
    finally { setAnalyzing(false); }
  }

  const addDealFromToken = (t) => {
    setDeals([...deals, { id: Date.now().toString(), token: t.sym, svc: t.s && t.s.otc > t.s.mm ? "OTC" : "MM", stage: "Signal", note: "" }]);
    setView("crm"); setOpenId(null);
  };

  const openTok = tokens.find((x) => x.id === openId);
  const q = search.trim().toLowerCase();

  return (
    <div style={{ minHeight: "100vh", background: C.bg, color: C.text, fontFamily: "'Archivo', system-ui, sans-serif" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Archivo:wght@400;600;700&family=IBM+Plex+Mono:wght@400;600&display=swap');
        * { box-sizing: border-box; }
        ::-webkit-scrollbar { width: 8px; height: 8px; } ::-webkit-scrollbar-thumb { background: ${C.border}; border-radius: 4px; }
        button:focus-visible, select:focus-visible, input:focus-visible { outline: 2px solid ${C.amber}; outline-offset: 1px; }
        @media (prefers-reduced-motion: reduce) { * { transition: none !important; animation: none !important; } }
        @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:.35} }
      `}</style>

      {/* Top bar */}
      <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 16px", borderBottom: `1px solid ${C.border}`, background: C.panel, position: "sticky", top: 0, zIndex: 20, flexWrap: "wrap" }}>
        <button onClick={() => setNavOpen(!navOpen)} style={{ background: "none", border: `1px solid ${C.border}`, color: C.mute, borderRadius: 4, padding: "4px 8px", cursor: "pointer", fontSize: 12 }}>☰</button>
        <div style={{ width: 10, height: 10, background: C.amber, clipPath: "polygon(50% 0, 100% 100%, 0 100%)" }} />
        <Mono style={{ fontSize: 12.5, fontWeight: 600, letterSpacing: "0.22em" }}>MERIDIAN</Mono>
        <input
          value={search} onChange={(e) => setSearch(e.target.value)}
          placeholder="Search any token…"
          style={{ flex: 1, minWidth: 140, maxWidth: 340, background: C.bg, border: `1px solid ${C.border}`, borderRadius: 4, color: C.text, padding: "6px 10px", fontSize: 12, fontFamily: "'IBM Plex Mono', monospace" }}
        />
        <div style={{ marginLeft: "auto", display: "flex", gap: 12, alignItems: "center" }}>
          {status === "loading" && <Mono style={{ fontSize: 10, color: C.amber, animation: "pulse 1.2s infinite" }}>● FETCHING 500…</Mono>}
          {status === "live" && <Mono style={{ fontSize: 10, color: C.green }}>● LIVE · {tokens.length} TOKENS · {updated?.toLocaleTimeString()}</Mono>}
          {status === "error" && <Mono style={{ fontSize: 10, color: C.red }}>● OFFLINE</Mono>}
          <Btn small onClick={refresh} disabled={status === "loading"}>REFRESH</Btn>
        </div>
      </div>

      {/* Quick search results overlay */}
      {q && !openId && (
        <div style={{ padding: "10px 16px 0", maxWidth: 1380, margin: "0 auto" }}>
          <Eyebrow>Search results</Eyebrow>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 4 }}>
            {tokens.filter((t) => t.name.toLowerCase().includes(q) || t.sym.toLowerCase().includes(q)).slice(0, 12).map((t) => (
              <button key={t.id} onClick={() => { setOpenId(t.id); setSearch(""); }}
                style={{ background: C.panel, border: `1px solid ${C.border}`, color: C.text, borderRadius: 4, padding: "5px 10px", fontSize: 11.5, cursor: "pointer" }}>
                {t.name} <Mono style={{ color: C.amber, fontSize: 10 }}>{t.sym}</Mono>
              </button>
            ))}
          </div>
        </div>
      )}

      <div style={{ display: "flex", maxWidth: 1380, margin: "0 auto" }}>
        {/* Sidebar */}
        {navOpen && (
          <div style={{ width: 200, flexShrink: 0, borderRight: `1px solid ${C.border}`, padding: "14px 8px", minHeight: "calc(100vh - 49px)" }}>
            {MODULES.map((m) => (
              <button key={m.id} onClick={() => { setView(m.id); setOpenId(null); }}
                style={{
                  display: "flex", alignItems: "center", gap: 9, width: "100%", textAlign: "left",
                  background: view === m.id && !openId ? C.panel2 : "transparent",
                  border: "none", borderLeft: `3px solid ${view === m.id && !openId ? C.amber : "transparent"}`,
                  color: view === m.id && !openId ? C.text : C.mute, padding: "9px 10px", fontSize: 12,
                  cursor: "pointer", borderRadius: "0 4px 4px 0", marginBottom: 2, fontFamily: "'Archivo', sans-serif",
                }}>
                <span style={{ color: C.amber, fontSize: 11, width: 14 }}>{m.icon}</span>{m.label}
              </button>
            ))}
            <div style={{ marginTop: 18, padding: "0 10px" }}>
              <Mono style={{ fontSize: 8.5, color: C.dim, lineHeight: 1.7, display: "block" }}>
                PHASE 2 BUILD<br />LIVE: COINGECKO TOP 500<br />SCORES: HEURISTIC v1<br />CRM: PERSISTED LOCALLY
              </Mono>
            </div>
          </div>
        )}

        {/* Main */}
        <div style={{ flex: 1, minWidth: 0, padding: "16px 16px 40px" }}>
          {err && <div style={{ border: `1px solid ${C.red}`, borderRadius: 4, padding: "8px 12px", fontSize: 11.5, color: C.red, marginBottom: 12, lineHeight: 1.5 }}>{err}</div>}
          {status === "loading" && !tokens.length ? (
            <div style={{ padding: 60, textAlign: "center", color: C.dim, fontSize: 12.5 }}>Loading live data for the Top 500…</div>
          ) : openTok ? (
            <Detail t={openTok} ai={aiNotes[openId]} analyzing={analyzing} onAnalyze={() => runDeepDive(openId)} onBack={() => setOpenId(null)} addDeal={addDealFromToken} />
          ) : view === "exec" ? <ExecDashboard tokens={tokens} alerts={alerts} deals={deals} openToken={setOpenId} goto={setView} />
            : view === "screener" ? <Screener tokens={tokens} openToken={setOpenId} search={q} sector={sector} setSector={setSector} />
            : view === "dev" ? <DevTracker tokens={tokens} aiNotes={aiNotes} openToken={setOpenId} />
            : view === "liq" ? <LiquidityIntel tokens={tokens} openToken={setOpenId} />
            : view === "bd" ? <BDEngine tokens={tokens} openToken={setOpenId} />
            : view === "trsy" ? <TreasuryIntel tokens={tokens} openToken={setOpenId} />
            : view === "otc" ? <OTCMatrix tokens={tokens} openToken={setOpenId} />
            : <CRM deals={deals} setDeals={setDeals} tokens={tokens} />}
        </div>
      </div>
    </div>
  );
}
