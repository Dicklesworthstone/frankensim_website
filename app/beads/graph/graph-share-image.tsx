type GraphShareImageProps = {
  height: number;
};

export function GraphShareImage({ height }: GraphShareImageProps) {
  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        position: "relative",
        overflow: "hidden",
        alignItems: "center",
        background: "linear-gradient(145deg, #02070a 0%, #06131a 52%, #080b18 100%)",
        color: "#f8fafc",
        fontFamily: "sans-serif",
        padding: height === 630 ? "54px 62px" : "42px 62px",
      }}
    >
      <div
        style={{
          position: "absolute",
          top: -210,
          left: -150,
          width: 600,
          height: 600,
          borderRadius: 9999,
          display: "flex",
          background: "radial-gradient(circle, rgba(6,182,212,0.18) 0%, rgba(6,182,212,0) 68%)",
        }}
      />
      <div
        style={{
          position: "absolute",
          right: -180,
          bottom: -260,
          width: 700,
          height: 700,
          borderRadius: 9999,
          display: "flex",
          background: "radial-gradient(circle, rgba(168,85,247,0.17) 0%, rgba(168,85,247,0) 68%)",
        }}
      />
      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          height: 3,
          display: "flex",
          background: "linear-gradient(90deg, #06b6d4 0%, #22d3ee 32%, #a855f7 72%, #7c3aed 100%)",
        }}
      />

      <div
        style={{
          width: 585,
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          position: "relative",
          zIndex: "2",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", marginBottom: 28 }}>
          <div
            style={{
              width: 45,
              height: 45,
              borderRadius: 12,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              background: "linear-gradient(135deg, #22d3ee 0%, #06b6d4 100%)",
              boxShadow: "0 0 34px rgba(34,211,238,0.28)",
              color: "#031014",
              fontSize: 27,
              fontWeight: 900,
            }}
          >
            F
          </div>
          <div style={{ display: "flex", flexDirection: "column", marginLeft: 14 }}>
            <span style={{ display: "flex", fontSize: 21, fontWeight: 800, letterSpacing: -0.4 }}>
              FrankenSim
            </span>
            <span
              style={{
                display: "flex",
                marginTop: 3,
                fontSize: 12,
                fontFamily: "monospace",
                fontWeight: 700,
                letterSpacing: 2.6,
                color: "#67e8f9",
              }}
            >
              PROJECT GRAPH
            </span>
          </div>
        </div>

        <div
          style={{
            display: "flex",
            flexDirection: "column",
            fontSize: 66,
            lineHeight: 0.98,
            letterSpacing: -3.5,
            fontWeight: 900,
          }}
        >
          <span style={{ display: "flex", color: "#f8fafc" }}>THE BUILD</span>
          <span
            style={{
              display: "flex",
              marginTop: 7,
              background: "linear-gradient(100deg, #67e8f9 0%, #22d3ee 42%, #c084fc 100%)",
              backgroundClip: "text",
              color: "transparent",
            }}
          >
            IS A GRAPH.
          </span>
        </div>

        <div
          style={{
            display: "flex",
            marginTop: 25,
            maxWidth: 525,
            color: "#94a3b8",
            fontSize: 20,
            lineHeight: 1.42,
            letterSpacing: -0.2,
          }}
        >
          Explore the live dependency structure, critical paths, bottlenecks, and execution frontier.
        </div>

        <div style={{ display: "flex", marginTop: 28, gap: 10 }}>
          <div
            style={{
              display: "flex",
              padding: "8px 12px",
              borderRadius: 8,
              border: "1px solid rgba(34,211,238,0.24)",
              background: "rgba(34,211,238,0.08)",
              color: "#67e8f9",
              fontFamily: "monospace",
              fontSize: 12,
              fontWeight: 700,
              letterSpacing: 1.3,
            }}
          >
            PAGERANK
          </div>
          <div
            style={{
              display: "flex",
              padding: "8px 12px",
              borderRadius: 8,
              border: "1px solid rgba(168,85,247,0.25)",
              background: "rgba(168,85,247,0.08)",
              color: "#d8b4fe",
              fontFamily: "monospace",
              fontSize: 12,
              fontWeight: 700,
              letterSpacing: 1.3,
            }}
          >
            CRITICAL PATH
          </div>
          <div
            style={{
              display: "flex",
              padding: "8px 12px",
              borderRadius: 8,
              border: "1px solid rgba(16,185,129,0.24)",
              background: "rgba(16,185,129,0.08)",
              color: "#6ee7b7",
              fontFamily: "monospace",
              fontSize: 12,
              fontWeight: 700,
              letterSpacing: 1.3,
            }}
          >
            LIVE DATA
          </div>
        </div>
      </div>

      <div
        style={{
          width: 465,
          height: height === 630 ? 486 : 448,
          display: "flex",
          position: "absolute",
          right: 58,
          top: height === 630 ? 72 : 66,
          borderRadius: 26,
          border: "1px solid rgba(148,163,184,0.17)",
          background: "linear-gradient(145deg, rgba(15,31,40,0.92) 0%, rgba(8,14,28,0.95) 100%)",
          boxShadow: "0 26px 70px rgba(0,0,0,0.44)",
          overflow: "hidden",
          zIndex: "2",
        }}
      >
        <div
          style={{
            position: "absolute",
            top: 20,
            left: 22,
            right: 22,
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <span
            style={{
              display: "flex",
              color: "#cbd5e1",
              fontFamily: "monospace",
              fontSize: 12,
              fontWeight: 700,
              letterSpacing: 1.5,
            }}
          >
            DEPENDENCY TOPOLOGY
          </span>
          <div style={{ display: "flex", alignItems: "center" }}>
            <div style={{ width: 7, height: 7, borderRadius: 99, display: "flex", background: "#34d399", boxShadow: "0 0 14px rgba(52,211,153,0.9)" }} />
            <span style={{ display: "flex", marginLeft: 7, color: "#6ee7b7", fontFamily: "monospace", fontSize: 10, fontWeight: 700, letterSpacing: 1.2 }}>
              KERNEL_ALIVE
            </span>
          </div>
        </div>

        <svg
          width="465"
          height={height === 630 ? "486" : "448"}
          viewBox="0 0 465 486"
          fill="none"
          style={{ display: "flex", filter: "drop-shadow(0 0 20px rgba(34,211,238,0.14))" }}
        >
          <defs>
            <linearGradient id="edgeGradient" x1="40" y1="50" x2="420" y2="430" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stopColor="#22d3ee" />
              <stop offset="52%" stopColor="#3b82f6" />
              <stop offset="100%" stopColor="#a855f7" />
            </linearGradient>
            <linearGradient id="nodeGradient" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#67e8f9" />
              <stop offset="100%" stopColor="#06b6d4" />
            </linearGradient>
          </defs>

          <line x1="64" y1="154" x2="142" y2="104" stroke="url(#edgeGradient)" strokeWidth="2" opacity="0.48" />
          <line x1="64" y1="154" x2="151" y2="204" stroke="url(#edgeGradient)" strokeWidth="2" opacity="0.42" />
          <line x1="142" y1="104" x2="238" y2="145" stroke="url(#edgeGradient)" strokeWidth="2.5" opacity="0.62" />
          <line x1="142" y1="104" x2="225" y2="79" stroke="url(#edgeGradient)" strokeWidth="1.5" opacity="0.34" />
          <line x1="151" y1="204" x2="238" y2="145" stroke="url(#edgeGradient)" strokeWidth="2.5" opacity="0.62" />
          <line x1="151" y1="204" x2="244" y2="250" stroke="url(#edgeGradient)" strokeWidth="2" opacity="0.5" />
          <line x1="238" y1="145" x2="327" y2="102" stroke="url(#edgeGradient)" strokeWidth="2" opacity="0.48" />
          <line x1="238" y1="145" x2="339" y2="190" stroke="url(#edgeGradient)" strokeWidth="3" opacity="0.72" />
          <line x1="225" y1="79" x2="327" y2="102" stroke="url(#edgeGradient)" strokeWidth="1.5" opacity="0.38" />
          <line x1="244" y1="250" x2="339" y2="190" stroke="url(#edgeGradient)" strokeWidth="2.5" opacity="0.6" />
          <line x1="244" y1="250" x2="329" y2="310" stroke="url(#edgeGradient)" strokeWidth="2" opacity="0.5" />
          <line x1="339" y1="190" x2="405" y2="146" stroke="url(#edgeGradient)" strokeWidth="2" opacity="0.5" />
          <line x1="339" y1="190" x2="401" y2="248" stroke="url(#edgeGradient)" strokeWidth="2.5" opacity="0.64" />
          <line x1="329" y1="310" x2="401" y2="248" stroke="url(#edgeGradient)" strokeWidth="2" opacity="0.45" />
          <line x1="329" y1="310" x2="397" y2="366" stroke="url(#edgeGradient)" strokeWidth="2" opacity="0.46" />
          <line x1="244" y1="250" x2="230" y2="362" stroke="url(#edgeGradient)" strokeWidth="2" opacity="0.42" />
          <line x1="230" y1="362" x2="329" y2="310" stroke="url(#edgeGradient)" strokeWidth="2.5" opacity="0.6" />
          <line x1="230" y1="362" x2="141" y2="407" stroke="url(#edgeGradient)" strokeWidth="1.5" opacity="0.4" />
          <line x1="141" y1="407" x2="79" y2="344" stroke="url(#edgeGradient)" strokeWidth="2" opacity="0.44" />
          <line x1="79" y1="344" x2="151" y2="204" stroke="url(#edgeGradient)" strokeWidth="1.5" opacity="0.34" />

          <circle cx="238" cy="145" r="31" fill="#22d3ee" opacity="0.08" />
          <circle cx="339" cy="190" r="36" fill="#a855f7" opacity="0.08" />
          <circle cx="244" cy="250" r="29" fill="#3b82f6" opacity="0.08" />

          <circle cx="64" cy="154" r="9" fill="#0f172a" stroke="#22d3ee" strokeWidth="3" />
          <circle cx="142" cy="104" r="13" fill="url(#nodeGradient)" stroke="#cffafe" strokeWidth="2" />
          <circle cx="151" cy="204" r="10" fill="#0f172a" stroke="#38bdf8" strokeWidth="3" />
          <circle cx="225" cy="79" r="7" fill="#0f172a" stroke="#67e8f9" strokeWidth="2" />
          <circle cx="238" cy="145" r="18" fill="#07151d" stroke="#22d3ee" strokeWidth="4" />
          <circle cx="238" cy="145" r="7" fill="#67e8f9" />
          <circle cx="244" cy="250" r="16" fill="#0b1225" stroke="#60a5fa" strokeWidth="4" />
          <circle cx="327" cy="102" r="9" fill="#0f172a" stroke="#818cf8" strokeWidth="3" />
          <circle cx="339" cy="190" r="20" fill="#110d22" stroke="#c084fc" strokeWidth="4" />
          <circle cx="339" cy="190" r="7" fill="#d8b4fe" />
          <circle cx="329" cy="310" r="13" fill="#0f172a" stroke="#a78bfa" strokeWidth="3" />
          <circle cx="405" cy="146" r="8" fill="#0f172a" stroke="#a855f7" strokeWidth="3" />
          <circle cx="401" cy="248" r="12" fill="#0f172a" stroke="#c084fc" strokeWidth="3" />
          <circle cx="397" cy="366" r="8" fill="#0f172a" stroke="#8b5cf6" strokeWidth="3" />
          <circle cx="230" cy="362" r="14" fill="#071a18" stroke="#34d399" strokeWidth="3" />
          <circle cx="141" cy="407" r="8" fill="#0f172a" stroke="#10b981" strokeWidth="3" />
          <circle cx="79" cy="344" r="10" fill="#0f172a" stroke="#2dd4bf" strokeWidth="3" />
        </svg>

        <div
          style={{
            position: "absolute",
            left: 22,
            right: 22,
            bottom: 19,
            display: "flex",
            justifyContent: "space-between",
            color: "#64748b",
            fontFamily: "monospace",
            fontSize: 10,
            fontWeight: 700,
            letterSpacing: 1.1,
          }}
        >
          <span style={{ display: "flex" }}>CRITICALITY / IMPACT / FLOW</span>
          <span style={{ display: "flex", color: "#a5b4fc" }}>INTERACTIVE</span>
        </div>
      </div>

      <div
        style={{
          position: "absolute",
          left: 62,
          bottom: 23,
          display: "flex",
          color: "#475569",
          fontFamily: "monospace",
          fontSize: 12,
          fontWeight: 700,
          letterSpacing: 1.7,
        }}
      >
        FRANKENSIM.ORG/BEADS/GRAPH
      </div>
    </div>
  );
}
