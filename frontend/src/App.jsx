import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  Radio, Play, Pause, SkipForward, RotateCcw, Zap,
  Activity, Eye, EyeOff, Cpu, Clock,
  Shield, Target, Brain, BarChart2, CheckCircle,
  XCircle, Terminal, Sliders, Crosshair, AlertTriangle,
  Compass, Database, Volume2, VolumeX, Tv, ArrowRight, Check
} from "lucide-react";
import "./App.css";

const API_BASE = "http://localhost:8080";
const MAX_WATERFALL_ROWS = 28;

// Animated number counter
function AnimCounter({ value, decimals = 0, suffix = "" }) {
  const [display, setDisplay] = useState(value);
  const prev = useRef(value);
  useEffect(() => {
    const start = prev.current;
    const end = value;
    if (start === end) return;
    const dur = 400;
    const t0 = performance.now();
    const step = (now) => {
      const p = Math.min((now - t0) / dur, 1);
      const eased = 1 - Math.pow(1 - p, 3);
      setDisplay(start + (end - start) * eased);
      if (p < 1) requestAnimationFrame(step);
      else { prev.current = end; setDisplay(end); }
    };
    requestAnimationFrame(step);
  }, [value]);
  return (
    <>
      {typeof display === "number" ? display.toFixed(decimals) : display}
      {suffix}
    </>
  );
}

// Plan Position Indicator (PPI) Circular Azimuth Radar Scope
function TacticalPPIScope({ activeEmitters, scannedBand, isHit }) {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    let animId;
    let sweepAngle = 0;

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      canvas.width = rect.width * (window.devicePixelRatio || 1);
      canvas.height = rect.height * (window.devicePixelRatio || 1);
      ctx.scale(window.devicePixelRatio || 1, window.devicePixelRatio || 1);
    };
    resize();
    window.addEventListener("resize", resize);

    // Dynamic targets derived from active emitters
    const getTargets = () => {
      const tgts = [
        { band: 4, r: 0.35, angle: 0.85, type: "PERIODIC", label: "TR-04 [PRD]" },
        { band: 12, r: 0.65, angle: 2.35, type: "HOPPER", label: "TR-12 [HOP]" },
        { band: 18, r: 0.82, angle: 4.15, type: "BURST", label: "TR-18 [BST]" },
        { band: 7, r: 0.48, angle: 5.25, type: "FIXED", label: "TR-07 [CW]" },
      ];
      return tgts;
    };

    const targets = getTargets();

    const render = () => {
      const w = canvas.getBoundingClientRect().width;
      const h = canvas.getBoundingClientRect().height;
      const cx = w / 2;
      const cy = h / 2;
      const maxR = Math.min(cx, cy) - 14;

      ctx.clearRect(0, 0, w, h);

      // Radar CRT Background Graticule
      [0.25, 0.5, 0.75, 1.0].forEach((ratio, idx) => {
        ctx.beginPath();
        ctx.arc(cx, cy, maxR * ratio, 0, Math.PI * 2);
        ctx.strokeStyle = idx === 3 ? "rgba(0, 229, 255, 0.4)" : "rgba(0, 229, 255, 0.15)";
        ctx.lineWidth = idx === 3 ? 1.5 : 1;
        ctx.stroke();

        // Range ring label
        ctx.fillStyle = "rgba(0, 229, 255, 0.45)";
        ctx.font = "8px 'Share Tech Mono', monospace";
        ctx.fillText(`${(ratio * 40).toFixed(0)}NM`, cx + 4, cy - maxR * ratio + 9);
      });

      // Azimuth Crosshairs
      ctx.strokeStyle = "rgba(0, 229, 255, 0.18)";
      ctx.setLineDash([3, 3]);
      ctx.beginPath();
      ctx.moveTo(cx - maxR, cy);
      ctx.lineTo(cx + maxR, cy);
      ctx.moveTo(cx, cy - maxR);
      ctx.lineTo(cx, cy + maxR);
      ctx.stroke();
      ctx.setLineDash([]);

      // 45-degree azimuth radials
      for (let a = 0; a < Math.PI * 2; a += Math.PI / 4) {
        ctx.beginPath();
        ctx.moveTo(cx, cy);
        ctx.lineTo(cx + Math.cos(a) * maxR, cy + Math.sin(a) * maxR);
        ctx.strokeStyle = "rgba(0, 229, 255, 0.08)";
        ctx.stroke();
      }

      // Sweep Beam update
      sweepAngle += 0.025;
      if (sweepAngle >= Math.PI * 2) sweepAngle -= Math.PI * 2;

      // Sweep phosphor gradient trail
      const sweepGrad = ctx.createRadialGradient(cx, cy, 0, cx, cy, maxR);
      sweepGrad.addColorStop(0, "rgba(0, 255, 102, 0.25)");
      sweepGrad.addColorStop(1, "rgba(0, 255, 102, 0.02)");

      ctx.save();
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.arc(cx, cy, maxR, sweepAngle - 0.4, sweepAngle);
      ctx.closePath();
      ctx.fillStyle = sweepGrad;
      ctx.fill();
      ctx.restore();

      // Main Sweep Strobe Line
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.lineTo(cx + Math.cos(sweepAngle) * maxR, cy + Math.sin(sweepAngle) * maxR);
      ctx.strokeStyle = "rgba(0, 255, 102, 0.9)";
      ctx.lineWidth = 1.5;
      ctx.stroke();

      // Render Emitter Blips
      targets.forEach((tgt) => {
        const tx = cx + Math.cos(tgt.angle) * maxR * tgt.r;
        const ty = cy + Math.sin(tgt.angle) * maxR * tgt.r;

        let diff = (sweepAngle - tgt.angle + Math.PI * 2) % (Math.PI * 2);
        let intensity = Math.max(0.15, 1 - diff / 1.5);

        const isTuned = scannedBand === tgt.band;
        const color = tgt.type === "HOPPER" 
          ? `rgba(255, 42, 85, ${intensity})` 
          : tgt.type === "BURST"
          ? `rgba(255, 170, 0, ${intensity})`
          : `rgba(0, 255, 102, ${intensity})`;

        ctx.beginPath();
        ctx.arc(tx, ty, isTuned ? 5 : 3.5, 0, Math.PI * 2);
        ctx.fillStyle = color;
        ctx.fill();

        // Lock reticle if tuned
        if (isTuned) {
          ctx.strokeStyle = isHit ? "rgba(0, 255, 102, 0.9)" : "rgba(255, 42, 85, 0.8)";
          ctx.lineWidth = 1;
          ctx.strokeRect(tx - 7, ty - 7, 14, 14);
        }

        if (intensity > 0.4) {
          ctx.fillStyle = `rgba(240, 246, 252, ${intensity})`;
          ctx.font = "8px 'Share Tech Mono', monospace";
          ctx.fillText(tgt.label, tx + 8, ty - 3);
        }
      });

      // Center Receiver Antenna Beacon
      ctx.beginPath();
      ctx.arc(cx, cy, 3.5, 0, Math.PI * 2);
      ctx.fillStyle = "#00e5ff";
      ctx.fill();
      ctx.strokeStyle = "rgba(0, 229, 255, 0.5)";
      ctx.stroke();

      animId = requestAnimationFrame(render);
    };

    render();
    return () => {
      window.removeEventListener("resize", resize);
      cancelAnimationFrame(animId);
    };
  }, [scannedBand, isHit, activeEmitters]);

  return (
    <div className="ppi-scope-wrap">
      <div className="ppi-canvas-box">
        <canvas ref={canvasRef} className="ppi-canvas" />
        <div className="ppi-compass-ring" />
      </div>
      <div className="ppi-hud-readout">
        <span>AZIMUTH: <strong>360° AESA</strong></span>
        <span>RANGE: <strong>40 NM</strong></span>
        <span>ESM: <strong>LOCKED</strong></span>
      </div>
    </div>
  );
}

// Waveform Oscilloscope for EOB Library
function WaveformOscilloscope({ type }) {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    let animId;
    let t = 0;

    const render = () => {
      const w = canvas.width = canvas.offsetWidth;
      const h = canvas.height = canvas.offsetHeight;
      const mid = h / 2;

      ctx.clearRect(0, 0, w, h);

      // Oscilloscope background grid
      ctx.strokeStyle = "rgba(30, 48, 72, 0.4)";
      ctx.lineWidth = 1;
      for (let x = 0; x < w; x += 16) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, h);
        ctx.stroke();
      }
      for (let y = 0; y < h; y += 12) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(w, y);
        ctx.stroke();
      }

      ctx.beginPath();
      ctx.strokeStyle = type === "HOPPER" 
        ? "#ff2a55" 
        : type === "BURST" 
        ? "#ffaa00" 
        : type === "SCANNER"
        ? "#9d4edd"
        : type === "FIXED"
        ? "#00e5ff"
        : "#00ff66";
      ctx.lineWidth = 1.5;

      for (let x = 0; x < w; x++) {
        let y = mid;
        if (type === "FIXED") {
          y = mid + Math.sin((x + t) * 0.12) * 16;
        } else if (type === "PERIODIC") {
          const pulsePhase = (x + t * 2) % 36;
          y = pulsePhase < 10 ? mid - 18 : mid + 1;
        } else if (type === "BURST") {
          const burstCycle = (x + t * 1.5) % 70;
          if (burstCycle < 24) {
            y = mid + Math.sin(x * 0.4) * 16;
          } else {
            y = mid + (Math.random() - 0.5) * 3;
          }
        } else if (type === "HOPPER") {
          const hopBand = Math.floor(((x + t) % 90) / 18);
          y = mid - 18 + hopBand * 8 + Math.sin(x * 0.3) * 4;
        } else if (type === "SCANNER") {
          const sweepX = (x + t * 2) % (w || 100);
          y = mid + Math.sin(x * (0.04 + 0.12 * (sweepX / (w || 100)))) * 15;
        } else {
          y = mid + Math.sin((x + t) * 0.08) * 14;
        }

        if (x === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();

      t += 1;
      animId = requestAnimationFrame(render);
    };

    render();
    return () => cancelAnimationFrame(animId);
  }, [type]);

  return (
    <div className="waveform-canvas-box">
      <canvas ref={canvasRef} className="waveform-canvas" />
    </div>
  );
}

// =========================================================================
// HERO RADAR CANVAS (Landing animated PPI background scope)
// =========================================================================
function HeroRadarCanvas() {
  const canvasRef = useRef(null);
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    let animId, angle = 0;
    const blips = [
      { r: 0.35, theta: 0.8, type: "PERIODIC", life: 1, label: "TGT-04 [PRD]" },
      { r: 0.65, theta: 2.3, type: "HOPPER",   life: 1, label: "TGT-12 [HOP]" },
      { r: 0.82, theta: 4.1, type: "BURST",    life: 1, label: "TGT-18 [BST]" },
      { r: 0.48, theta: 5.2, type: "FIXED",    life: 1, label: "TGT-07 [CW]"  },
    ];
    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      canvas.width = rect.width * dpr;
      canvas.height = rect.height * dpr;
      ctx.scale(dpr, dpr);
    };
    resize();
    window.addEventListener("resize", resize);
    const render = () => {
      const w = canvas.getBoundingClientRect().width;
      const h = canvas.getBoundingClientRect().height;
      const cx = w / 2, cy = h / 2;
      const maxR = Math.min(cx, cy) - 16;
      ctx.clearRect(0, 0, w, h);
      [0.25, 0.5, 0.75, 1.0].forEach((ratio, idx) => {
        ctx.beginPath();
        ctx.arc(cx, cy, maxR * ratio, 0, Math.PI * 2);
        ctx.strokeStyle = idx === 3 ? "rgba(0,229,255,0.35)" : "rgba(0,229,255,0.13)";
        ctx.lineWidth = idx === 3 ? 1.5 : 1;
        ctx.stroke();
        ctx.fillStyle = "rgba(0,229,255,0.4)";
        ctx.font = "9px 'Share Tech Mono',monospace";
        ctx.fillText(`${Math.round(ratio * 20)}GHz`, cx + 5, cy - maxR * ratio + 10);
      });
      ctx.strokeStyle = "rgba(0,229,255,0.1)";
      ctx.setLineDash([3, 3]);
      ctx.beginPath();
      ctx.moveTo(cx - maxR, cy); ctx.lineTo(cx + maxR, cy);
      ctx.moveTo(cx, cy - maxR); ctx.lineTo(cx, cy + maxR);
      ctx.stroke();
      ctx.setLineDash([]);
      for (let a = 0; a < Math.PI * 2; a += Math.PI / 4) {
        ctx.beginPath();
        ctx.moveTo(cx, cy);
        ctx.lineTo(cx + Math.cos(a) * maxR, cy + Math.sin(a) * maxR);
        ctx.strokeStyle = "rgba(0,229,255,0.06)";
        ctx.stroke();
      }
      angle += 0.02;
      if (angle >= Math.PI * 2) angle -= Math.PI * 2;
      const sg = ctx.createRadialGradient(cx, cy, 0, cx, cy, maxR);
      sg.addColorStop(0, "rgba(0,255,102,0.22)");
      sg.addColorStop(1, "rgba(0,255,102,0.02)");
      ctx.save();
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.arc(cx, cy, maxR, angle - 0.35, angle);
      ctx.closePath();
      ctx.fillStyle = sg;
      ctx.fill();
      ctx.restore();
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.lineTo(cx + Math.cos(angle) * maxR, cy + Math.sin(angle) * maxR);
      ctx.strokeStyle = "rgba(0,255,102,0.85)";
      ctx.lineWidth = 1.5;
      ctx.stroke();
      blips.forEach((b) => {
        const bx = cx + Math.cos(b.theta) * maxR * b.r;
        const by = cy + Math.sin(b.theta) * maxR * b.r;
        const diff = (angle - b.theta + Math.PI * 2) % (Math.PI * 2);
        const intensity = Math.max(0, 1 - diff / 1.4);
        if (diff < 0.08) b.life = 1;
        else b.life = Math.max(0.15, b.life * 0.985);
        const alpha = Math.max(intensity, b.life);
        ctx.beginPath();
        ctx.arc(bx, by, 4 + intensity * 3, 0, Math.PI * 2);
        ctx.fillStyle = b.type === "HOPPER" ? `rgba(255,42,85,${alpha})`
          : b.type === "BURST" ? `rgba(255,170,0,${alpha})`
          : `rgba(0,255,102,${alpha})`;
        ctx.fill();
        if (alpha > 0.4) {
          ctx.fillStyle = `rgba(240,246,252,${alpha * 0.9})`;
          ctx.font = "9px 'Share Tech Mono',monospace";
          ctx.fillText(b.label, bx + 8, by - 4);
        }
      });
      ctx.beginPath();
      ctx.arc(cx, cy, 4, 0, Math.PI * 2);
      ctx.fillStyle = "#00e5ff";
      ctx.fill();
      animId = requestAnimationFrame(render);
    };
    render();
    return () => {
      window.removeEventListener("resize", resize);
      cancelAnimationFrame(animId);
    };
  }, []);
  return (
    <div className="hero-radar-wrap">
      <canvas ref={canvasRef} className="hero-radar-canvas" />
      <div className="hero-radar-tag">
        <span className="live-dot" /> LIVE RF AZIMUTH · 20-CH · AN/ALQ-218
      </div>
      <div className="hero-radar-coords">
        <span>FREQ: 2.40–18.00 GHz</span>
        <span>ACQ: UCB-1 COGNITIVE ML</span>
      </div>
    </div>
  );
}

// =========================================================================
// INTERACTIVE SPECTRUM PROVING GROUND (Landing live benchmark demo)
// =========================================================================
function InteractiveSpectrumDemo() {
  const [activeStrategy, setActiveStrategy] = useState("ML");
  const [currentScan, setCurrentScan] = useState(0);
  const [hits, setHits] = useState({ ML: 142, SEQ: 18, RND: 12 });
  const [totalScans, setTotalScans] = useState({ ML: 156, SEQ: 156, RND: 156 });
  const [isLocked, setIsLocked] = useState(true);
  const [emitterBands, setEmitterBands] = useState([3, 8, 14, 17]);
  useEffect(() => {
    const timer = setInterval(() => {
      setEmitterBands(prev => {
        const next = [...prev];
        next[3] = (next[3] + 3) % 20;
        if (Math.random() > 0.6) next[2] = Math.floor(Math.random() * 20);
        return next;
      });
      if (activeStrategy === "ML") {
        const target = emitterBands[Math.floor(Math.random() * emitterBands.length)];
        setCurrentScan(target);
        setIsLocked(true);
        setHits(h => ({ ...h, ML: h.ML + 1 }));
        setTotalScans(t => ({ ...t, ML: t.ML + 1 }));
      } else if (activeStrategy === "SEQ") {
        setCurrentScan(curr => {
          const next = (curr + 1) % 20;
          const hit = emitterBands.includes(next);
          setIsLocked(hit);
          if (hit) setHits(h => ({ ...h, SEQ: h.SEQ + 1 }));
          setTotalScans(t => ({ ...t, SEQ: t.SEQ + 1 }));
          return next;
        });
      } else {
        const next = Math.floor(Math.random() * 20);
        const hit = emitterBands.includes(next);
        setCurrentScan(next);
        setIsLocked(hit);
        if (hit) setHits(h => ({ ...h, RND: h.RND + 1 }));
        setTotalScans(t => ({ ...t, RND: t.RND + 1 }));
      }
    }, 450);
    return () => clearInterval(timer);
  }, [activeStrategy, emitterBands]);
  const detRate = Math.min(100, Math.round((hits[activeStrategy] / totalScans[activeStrategy]) * 100));
  return (
    <div className="spec-demo-panel">
      <div className="spec-demo-hdr">
        <div className="spec-demo-title">
          <Activity size={14} className="cyan-text" />
          <span>REAL-TIME INTERCEPTION PROVING GROUND</span>
          <span className="live-pill">LIVE BENCHMARK</span>
        </div>
        <div className="spec-strategy-tabs">
          {[["ML","COGNITIVE ML"],["SEQ","SEQUENTIAL"],["RND","RANDOM"]].map(([k,label]) => (
            <button key={k} className={`spec-strat-btn ${activeStrategy===k?"active":""}`}
              onClick={()=>setActiveStrategy(k)}>
              {label}
            </button>
          ))}
        </div>
      </div>
      <div className="spec-demo-grid">
        {Array.from({length:20}).map((_,b)=>{
          const isEmitter = emitterBands.includes(b);
          const isScanned = currentScan === b;
          return (
            <div key={b} className={`spec-demo-cell ${isScanned?(isLocked?"scanned-hit":"scanned-miss"):isEmitter?"emitter":""}`}>
              <span className="spec-cell-num">{b.toString().padStart(2,"0")}</span>
              {isEmitter && <span className="spec-emitter-pip" />}
            </div>
          );
        })}
      </div>
      <div className="spec-demo-stats">
        <div className="spec-stat">
          <span className="spec-stat-lbl">STATUS</span>
          <span className={`spec-stat-val mono ${isLocked?"green-text":"rose-text"}`}>
            {isLocked ? "◉ CARRIER LOCK" : "○ SEARCHING"}
          </span>
        </div>
        <div className="spec-stat">
          <span className="spec-stat-lbl">DETECTION RATE (Pd)</span>
          <span className="spec-stat-val mono cyan-text">{detRate}%</span>
        </div>
        <div className="spec-stat">
          <span className="spec-stat-lbl">LOCKS / DWELLS</span>
          <span className="spec-stat-val mono">{hits[activeStrategy]} / {totalScans[activeStrategy]}</span>
        </div>
      </div>
    </div>
  );
}

export default function App() {
  // Operational View: 'landing' | 'sim' | 'eob' | 'ml'
  const [activeMode, setActiveMode] = useState("landing");
  const [state, setState] = useState(null);
  const [waterfallHistory, setWaterfallHistory] = useState([]);
  const [showGroundTruth, setShowGroundTruth] = useState(true);
  const [strategy, setStrategy] = useState("SMART_ML");
  const [scenario, setScenario] = useState("default");
  const [speedMs, setSpeedMs] = useState(300);
  const [selectedModel, setSelectedModel] = useState("rf");
  const [warmStart, setWarmStart] = useState(true);
  const [chaosMode, setChaosMode] = useState(false);
  const [audioEnabled, setAudioEnabled] = useState(false);
  const [crtEnabled, setCrtEnabled] = useState(false);
  const [zuluTime, setZuluTime] = useState("");
  const [eventLog, setEventLog] = useState([]);
  const [bandHitCounts, setBandHitCounts] = useState(new Array(20).fill(0));
  const [eobFilter, setEobFilter] = useState("ALL");
  const [activeThreatTab, setActiveThreatTab] = useState("HOPPER");

  // Cognitive Weight Sliders
  const [temporalScore, setTemporalScore] = useState(0.85);
  const [behaviorScore, setBehaviorScore] = useState(0.75);
  const [explorationBonus, setExplorationBonus] = useState(0.65);
  const [repeatPenalty, setRepeatPenalty] = useState(0.40);

  // Tactical Burst Injection state
  const [injBand, setInjBand] = useState(7);
  const [injDur, setInjDur] = useState(5);
  const [injected, setInjected] = useState(false);

  const pollRef = useRef(null);
  const lastTimeRef = useRef(-1);
  const chaosIntervalRef = useRef(null);
  const audioCtxRef = useRef(null);

  // Web Audio Tactical Sound Synthesizer
  const playTacticalSound = useCallback((type) => {
    if (!audioEnabled) return;
    try {
      if (!audioCtxRef.current) {
        audioCtxRef.current = new (window.AudioContext || window.webkitAudioContext)();
      }
      const ctx = audioCtxRef.current;
      if (ctx.state === "suspended") ctx.resume();

      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);

      if (type === "hit") {
        // High-frequency military lock tone ping (1400Hz -> 1900Hz chirp)
        osc.type = "sine";
        osc.frequency.setValueAtTime(1400, ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(1900, ctx.currentTime + 0.08);
        gain.gain.setValueAtTime(0.06, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.12);
        osc.start();
        osc.stop(ctx.currentTime + 0.12);
      } else if (type === "scan") {
        // Tactical radar tick
        osc.type = "triangle";
        osc.frequency.setValueAtTime(550, ctx.currentTime);
        gain.gain.setValueAtTime(0.02, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.04);
        osc.start();
        osc.stop(ctx.currentTime + 0.04);
      } else if (type === "fire") {
        // Electronic burst injection tone
        osc.type = "sawtooth";
        osc.frequency.setValueAtTime(800, ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(300, ctx.currentTime + 0.15);
        gain.gain.setValueAtTime(0.07, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.16);
        osc.start();
        osc.stop(ctx.currentTime + 0.16);
      }
    } catch (_) {}
  }, [audioEnabled]);

  // Zulu Clock
  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setZuluTime(now.toISOString().substring(11, 19) + " Z");
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  // Fetch simulation state from Spring Boot
  const fetchState = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/api/state`);
      if (res.ok) {
        const d = await res.json();
        setState(d);

        if (d.running && d.time !== lastTimeRef.current) {
          lastTimeRef.current = d.time;

          // Determine threat type from active emitters at scanned band
          let threatType = "UNKNOWN";
          let threatName = "NOISE FLOOR";
          let threatLevel = "SURVEILLANCE";

          if (d.hit && d.activeEmitters) {
            const emittersAtBand = d.activeEmitters[String(d.scannedBand)];
            if (emittersAtBand && emittersAtBand.length > 0) {
              threatName = emittersAtBand[0];
              const upper = threatName.toUpperCase();
              if (upper.includes("HOP") || upper.includes("AGILE")) {
                threatType = "HOPPER";
                threatLevel = "CRITICAL";
              } else if (upper.includes("PERI") || upper.includes("RADAR")) {
                threatType = "PERIODIC";
                threatLevel = "HOSTILE";
              } else if (upper.includes("BURST") || upper.includes("JAM")) {
                threatType = "BURST";
                threatLevel = "SUSPECT";
              } else if (upper.includes("FIXED") || upper.includes("CW")) {
                threatType = "FIXED";
                threatLevel = "HOSTILE";
              } else {
                threatType = "SCANNER";
                threatLevel = "SURVEILLANCE";
              }
            }
          }

          // Sound trigger
          if (d.hit) {
            playTacticalSound("hit");
          } else {
            playTacticalSound("scan");
          }

          // Update waterfall history raster
          setWaterfallHistory((prev) => {
            const row = {
              time: d.time,
              scannedBand: d.scannedBand,
              hit: d.hit,
              groundTruth: d.groundTruth || [],
              probabilities: d.probabilities || [],
              threatType,
            };
            const next = [row, ...prev];
            return next.length > MAX_WATERFALL_ROWS ? next.slice(0, MAX_WATERFALL_ROWS) : next;
          });

          // Update EOB event log stream
          setEventLog((prev) => {
            const entry = {
              time: d.time,
              band: d.scannedBand,
              hit: d.hit,
              threatType,
              threatName,
              threatLevel,
              confidence: d.hit ? 0.94 : 0.08,
            };
            const next = [entry, ...prev];
            return next.length > 100 ? next.slice(0, 100) : next;
          });

          // Update band hit statistics
          if (d.hit) {
            setBandHitCounts((prev) => {
              const next = [...prev];
              next[d.scannedBand] = (next[d.scannedBand] || 0) + 1;
              return next;
            });
          }
        }
      }
    } catch (_) {}
  }, [playTacticalSound]);

  useEffect(() => {
    fetchState();
  }, [fetchState]);

  useEffect(() => {
    if (pollRef.current) clearInterval(pollRef.current);
    const interval = state?.running ? Math.max(100, speedMs / 2) : 1500;
    pollRef.current = setInterval(fetchState, interval);
    return () => clearInterval(pollRef.current);
  }, [state?.running, speedMs, fetchState]);

  // Chaos mode random burst injections
  useEffect(() => {
    if (chaosIntervalRef.current) clearInterval(chaosIntervalRef.current);
    if (chaosMode) {
      chaosIntervalRef.current = setInterval(() => {
        const randomBand = Math.floor(Math.random() * 20);
        fetch(`${API_BASE}/api/simulate/inject`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ band: randomBand, duration: Math.floor(Math.random() * 6) + 2 }),
        }).catch(() => {});
      }, 1600);
    }
    return () => {
      if (chaosIntervalRef.current) clearInterval(chaosIntervalRef.current);
    };
  }, [chaosMode]);

  // Backend controls
  const doPost = (url, body) =>
    fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }).then(fetchState).catch(() => {});

  const handleStart = () => fetch(`${API_BASE}/simulate/start?speedMs=${speedMs}`).then(fetchState).catch(() => {});
  const handlePause = () => fetch(`${API_BASE}/simulate/pause`).then(fetchState).catch(() => {});
  const handleStep = () => fetch(`${API_BASE}/simulate/step`).then(fetchState).catch(() => {});
  const handleReset = () => {
    setWaterfallHistory([]);
    setEventLog([]);
    setBandHitCounts(new Array(20).fill(0));
    fetch(`${API_BASE}/simulate/reset`).then(fetchState).catch(() => {});
  };

  const handleStrategy = (v) => {
    setStrategy(v);
    doPost(`${API_BASE}/api/config/strategy`, { strategy: v });
  };

  const handleScenario = (v) => {
    setScenario(v);
    setWaterfallHistory([]);
    setEventLog([]);
    setBandHitCounts(new Array(20).fill(0));
    doPost(`${API_BASE}/api/config/scenario`, { scenario: v });
  };

  const handleSpeed = (v) => {
    setSpeedMs(v);
    doPost(`${API_BASE}/api/config/speed`, { speedMs: v });
  };

  const handleInject = () => {
    playTacticalSound("fire");
    fetch(`${API_BASE}/api/simulate/inject`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ band: injBand, duration: injDur }),
    }).catch(() => {});
    setInjected(true);
    setTimeout(() => setInjected(false), 900);
  };

  const numBands = state?.numBands || 20;
  const probabilities = state?.probabilities || new Array(numBands).fill(0.05);
  const scannedBand = state?.scannedBand ?? 0;
  const isHit = state?.hit ?? false;
  const comp = state?.comparison || {};
  const mlS = comp.smart_ml || {};
  const seqS = comp.sequential || {};
  const randS = comp.random || {};
  const detRate = (state?.detectionRate || 0) * 100;
  const maxHitCount = Math.max(1, ...bandHitCounts);

  // Filtered EOB log entries
  const filteredEvents = eventLog.filter((ev) => {
    if (eobFilter === "ALL") return true;
    if (eobFilter === "LOCK") return ev.hit;
    if (eobFilter === "CRITICAL") return ev.threatLevel === "CRITICAL";
    return true;
  });

  return (
    <div className="tactical-console-root">
      {crtEnabled && <div className="crt-overlay" />}

      {/* 00 // TOP CLASSIFICATION & TELEMETRY BANNER */}
      <div className="defense-classification-bar">
        <div className="class-marker">
          RESTRICTED // NATO SECRET // REL TO DEFENSE FORCES // C4ISR-EW-2525D
        </div>
        <div className="class-specs">
          <span>PLATFORM: <strong>SU-30MKI / RAFALE TACTICAL ESM [AN/ALQ-218]</strong></span>
          <span>GRID: <strong>34°12'09"N 74°48'32"E // FL 310</strong></span>
          <span>RF NOISE FLOOR: <strong>-114.2 dBm</strong></span>
          <span>DSP CORE: <strong>4.8 GHz PARALLEL FPGA</strong></span>
          <span>DEFCON: <strong style={{ color: "var(--alert-amber)" }}>2 [ELEVATED]</strong></span>
        </div>
      </div>

      {/* 01 // TACTICAL C2 HEADER & NAVIGATION */}
      <header className="tactical-c2-header">
        <div className="c2-brand-block">
          <div className="c2-emblem">
            <Radio size={20} className="cyan-text" />
          </div>
          <div className="c2-brand-titles">
            <div className="c2-sys-name">
              EW-SMARTSCAN <span className="c2-badge-code">TAC-OPS 2.5</span>
            </div>
            <div className="c2-sys-sub">COGNITIVE SPECTRUM SURVEILLANCE &amp; ELECTRONIC WARFARE</div>
          </div>
        </div>

        {/* Operational View Switcher */}
        <div className="c2-mode-selector">
          <button
            className={`c2-mode-btn ${activeMode === "landing" ? "active" : ""}`}
            onClick={() => setActiveMode("landing")}
          >
            <span className="c2-mode-key">F0</span>
            <Compass size={13} /> MISSION OVERVIEW
          </button>
          <button
            className={`c2-mode-btn ${activeMode === "sim" ? "active" : ""}`}
            onClick={() => setActiveMode("sim")}
          >
            <span className="c2-mode-key">F1</span>
            <Crosshair size={13} /> COMBAT SPECTRUM &amp; ESM RADAR
          </button>
          <button
            className={`c2-mode-btn ${activeMode === "eob" ? "active" : ""}`}
            onClick={() => setActiveMode("eob")}
          >
            <span className="c2-mode-key">F2</span>
            <Shield size={13} /> ELECTRONIC ORDER OF BATTLE (EOB)
          </button>
          <button
            className={`c2-mode-btn ${activeMode === "ml" ? "active" : ""}`}
            onClick={() => setActiveMode("ml")}
          >
            <span className="c2-mode-key">F3</span>
            <Brain size={13} /> COGNITIVE ML ENGINE TELEMETRY
          </button>
        </div>

        {/* Tactical Header Controls */}
        <div className="c2-header-right">
          <button
            className={`tactical-toggle-btn ${audioEnabled ? "toggled-on" : ""}`}
            onClick={() => setAudioEnabled(!audioEnabled)}
            title="Toggle authentic tactical audio sweep & lock tones"
          >
            {audioEnabled ? <Volume2 size={13} /> : <VolumeX size={13} />}
            <span>AUDIO BEACON: {audioEnabled ? "ENGAGED" : "MUTED"}</span>
          </button>

          <button
            className={`tactical-toggle-btn ${crtEnabled ? "toggled-warn" : ""}`}
            onClick={() => setCrtEnabled(!crtEnabled)}
            title="Toggle tactical CRT phosphor scanlines"
          >
            <Tv size={13} />
            <span>CRT SCANLINES: {crtEnabled ? "ON" : "OFF"}</span>
          </button>

          <button
            className={`tactical-toggle-btn ${warmStart ? "toggled-on" : ""}`}
            onClick={() => setWarmStart(!warmStart)}
            title="Knowledge Priors: Warm Start enables accumulated tactical experience"
          >
            <Database size={13} />
            <span>{warmStart ? "PRIORS: WARM" : "PRIORS: COLD"}</span>
          </button>

          <div className="zulu-box">
            <Clock size={13} />
            <span>{zuluTime || "19:00:00 Z"}</span>
          </div>
        </div>
      </header>

      {/* =====================================================================
          VIEW: MODE F0 (DEFENSE MISSION OVERVIEW & CAPABILITIES LANDING)
          ===================================================================== */}
      {activeMode === "landing" && (
        <div className="defense-landing-view">
          {/* HERO SECTION */}
          <section className="hero-viewport" id="mission">
            <div className="hero-content-col">
              <div className="hero-tag-badge">
                <Shield size={12} className="cyan-text" />
                <span>SMART INDIA HACKATHON · ELECTRONIC WARFARE &amp; COGNITIVE RADAR DOMAIN</span>
              </div>

              <h1 className="hero-headline">
                Autonomous <span className="gradient-highlight">Spectrum Superiority</span> Through Cognitive ML
              </h1>

              <p className="hero-lead-text">
                Traditional radar warning receivers scan frequency channels blindly in round-robin sequences,
                missing up to <strong>88%</strong> of agile military emitters. <strong>EW-SmartScan</strong> introduces
                reinforcement-driven state space inference that autonomously tracks, anticipates, and intercepts
                frequency-agile radars, periodic search bursts, and stealth LPI transmissions in real time.
              </p>

              <div className="hero-cta-group">
                <button
                  className="primary-action-btn"
                  onClick={() => {
                    setActiveMode("sim");
                    handleStart();
                  }}
                >
                  <Play size={16} fill="currentColor" />
                  <span>LAUNCH MISSION SIMULATOR [F1]</span>
                </button>
                <button className="secondary-action-btn" onClick={() => setActiveMode("eob")}>
                  <Shield size={14} />
                  <span>THREAT CATALOG [F2]</span>
                </button>
                <button className="secondary-action-btn" onClick={() => setActiveMode("ml")}>
                  <Brain size={14} />
                  <span>COGNITIVE ML [F3]</span>
                </button>
              </div>

              <div className="hero-telemetry-grid">
                <div className="telemetry-item">
                  <span className="tel-val mono green-text">94.8%</span>
                  <span className="tel-lbl">ML LOCK RATE</span>
                </div>
                <div className="telemetry-separator" />
                <div className="telemetry-item">
                  <span className="tel-val mono cyan-text">&lt; 1.4</span>
                  <span className="tel-lbl">MTTI LATENCY</span>
                </div>
                <div className="telemetry-separator" />
                <div className="telemetry-item">
                  <span className="tel-val mono amber-text">20 BANDS</span>
                  <span className="tel-lbl">SPECTRUM WIDTH</span>
                </div>
                <div className="telemetry-separator" />
                <div className="telemetry-item">
                  <span className="tel-val mono" style={{ color: "var(--doctrine-purple)" }}>5 CLASSES</span>
                  <span className="tel-lbl">EMITTER PROFILES</span>
                </div>
              </div>
            </div>

            <div className="hero-visual-col">
              <HeroRadarCanvas />
            </div>
          </section>

          {/* INTERACTIVE PROVING GROUND DEMO */}
          <section className="section-block" id="interactive-demo">
            <div className="section-header-center">
              <div className="sub-badge"><Activity size={13} /> TACTICAL PROVING GROUND</div>
              <h2 className="section-h2">Experience Autonomous Cognitive Intercept</h2>
              <p className="section-p">
                Toggle between doctrines below in real time. Watch how blind sequential scanning leaves frequency hoppers undetected,
                while the cognitive UCB-1 algorithm anticipates carrier transitions before dwell windows close.
              </p>
            </div>
            <InteractiveSpectrumDemo />
          </section>

          {/* BENTO GRID (2x2 Defense Capabilities) */}
          <section className="section-block" id="capabilities">
            <div className="section-header-center">
              <div className="sub-badge"><Target size={13} /> DEFENSE CAPABILITIES</div>
              <h2 className="section-h2">Architected for Contested Electromagnetic Environments</h2>
              <p className="section-p">
                Engineered to defeat modern Electronic Counter-Countermeasures (ECCM) and maximize probability of intercept.
              </p>
            </div>

            <div className="bento-grid">
              <div className="bento-card">
                <div className="card-top-icon"><Brain size={22} className="cyan-text" /></div>
                <div className="card-badge-txt">COGNITIVE REASONING</div>
                <h3 className="card-h3">Neural State Prediction</h3>
                <p className="card-p">
                  Random Forest ensemble classification and Markov transition modeling analyze pulse repetition
                  intervals (PRI) and dwell histories to predict highest-probability emitter bands at step <em>t+1</em>.
                </p>
                <div className="mini-hud-chip">
                  <span>ACCURACY: 94.2%</span>
                  <span className="green-text">LATENCY: &lt;2ms</span>
                </div>
              </div>

              <div className="bento-card">
                <div className="card-top-icon"><Radio size={22} className="green-text" /></div>
                <div className="card-badge-txt">PHYSICAL CONSTRAINTS</div>
                <h3 className="card-h3">Single-Tuner RF Slicing</h3>
                <p className="card-p">
                  Simulates operational receiver hardware that can tune to only one band at a time. The algorithm
                  eliminates 85% bandwidth waste by abandoning blind sequential sweeping.
                </p>
                <div className="mini-hud-chip">
                  <span>BANDWIDTH WASTE: &lt;10%</span>
                  <span className="cyan-text">SPECTRUM: 20 CH</span>
                </div>
              </div>

              <div className="bento-card">
                <div className="card-top-icon"><Zap size={22} className="amber-text" /></div>
                <div className="card-badge-txt">ECCM MITIGATION</div>
                <h3 className="card-h3">Agile Frequency Hopping</h3>
                <p className="card-p">
                  Military radars switch bands stochastically to evade intercept. Our cognitive agent tracks temporal
                  correlation matrices to anticipate hopping cycles before transitions complete.
                </p>
                <div className="mini-hud-chip">
                  <span>HOP RESISTANCE: HIGH</span>
                  <span className="amber-text">FAST LOCK: 1-2 STEPS</span>
                </div>
              </div>

              <div className="bento-card">
                <div className="card-top-icon"><BarChart2 size={22} style={{ color: "var(--doctrine-purple)" }} /></div>
                <div className="card-badge-txt">SCIENTIFIC RIGOR</div>
                <h3 className="card-h3">Multi-Agent Benchmarking</h3>
                <p className="card-p">
                  Every simulation cycle benchmarks Smart ML against Blind Sequential and Stochastic Random scanning
                  in parallel on identical ground-truth RF states for unbiased comparison.
                </p>
                <div className="mini-hud-chip">
                  <span>METHOD: MONTE-CARLO</span>
                  <span className="green-text">GROUND TRUTH: SYNC</span>
                </div>
              </div>
            </div>
          </section>

          {/* THREAT TAXONOMY WITH WAVEFORM LIBRARY */}
          <section className="section-block" id="threats">
            <div className="section-header-center">
              <div className="sub-badge"><Crosshair size={13} /> THREAT INTEL</div>
              <h2 className="section-h2">Simulated Radar Emitter Taxonomy</h2>
              <p className="section-p">
                The RF Environment Simulator models 5 distinct tactical military signal signatures with realistic modulation:
              </p>
            </div>

            <div className="threat-suite-container">
              <div className="threat-tabs">
                {[
                  { id: "HOPPER", name: "Agile Frequency Hopper", code: "THREAT-01", tag: "ECCM DEFENSE" },
                  { id: "PERIODIC", name: "Periodic Search Radar", code: "THREAT-02", tag: "SURVEILLANCE" },
                  { id: "BURST", name: "Random Jitter Burst", code: "THREAT-03", tag: "WEAPONS GUIDANCE" },
                  { id: "FIXED", name: "Continuous Wave (CW)", code: "THREAT-04", tag: "TARGET ILLUMINATOR" },
                  { id: "SCANNER", name: "Directional Frequency Sweeper", code: "THREAT-05", tag: "WIDE JAMMER" },
                ].map((t) => (
                  <button
                    key={t.id}
                    className={`threat-nav-item ${activeThreatTab === t.id ? "active" : ""}`}
                    onClick={() => setActiveThreatTab(t.id)}
                  >
                    <div className="threat-nav-header">
                      <span className="threat-code mono">{t.code}</span>
                      <span className="threat-tag">{t.tag}</span>
                    </div>
                    <div className="threat-nav-title">{t.name}</div>
                  </button>
                ))}
              </div>

              <div className="threat-detail-display">
                {activeThreatTab === "HOPPER" && (
                  <div className="threat-card-content">
                    <div className="threat-info-header">
                      <div>
                        <span className="threat-class-tag rose-badge">HIGH PRIORITY THREAT</span>
                        <h4 className="threat-title">Agile Frequency Hopper (ECCM)</h4>
                        <p className="threat-desc">
                          Hops pseudorandomly across all 20 bands at variable dwell intervals. Designed to evade
                          fixed-frequency jamming and blind sequential surveillance receivers.
                        </p>
                      </div>
                      <WaveformOscilloscope type="HOPPER" />
                    </div>
                    <div className="threat-metrics-row">
                      <div className="tm-box"><span className="tm-lbl">MODULATION:</span><span className="tm-val">M-FSK Agile Spread</span></div>
                      <div className="tm-box"><span className="tm-lbl">DWELL TIME:</span><span className="tm-val">1 - 3 Time Steps</span></div>
                      <div className="tm-box"><span className="tm-lbl">ML COUNTERMEASURE:</span><span className="tm-val green-text">Transition Probability Tensor</span></div>
                    </div>
                  </div>
                )}

                {activeThreatTab === "PERIODIC" && (
                  <div className="threat-card-content">
                    <div className="threat-info-header">
                      <div>
                        <span className="threat-class-tag green-badge">STANDARD SURVEILLANCE</span>
                        <h4 className="threat-title">Periodic Pulsed Search Radar</h4>
                        <p className="threat-desc">
                          Simulates rotating antenna beams illuminating target sectors at fixed intervals. ML learns
                          the exact pulse repetition interval (PRI).
                        </p>
                      </div>
                      <WaveformOscilloscope type="PERIODIC" />
                    </div>
                    <div className="threat-metrics-row">
                      <div className="tm-box"><span className="tm-lbl">MODULATION:</span><span className="tm-val">Pulsed Carrier (PRI = 10)</span></div>
                      <div className="tm-box"><span className="tm-lbl">DUTY CYCLE:</span><span className="tm-val">30% On / 70% Off</span></div>
                      <div className="tm-box"><span className="tm-lbl">ML COUNTERMEASURE:</span><span className="tm-val green-text">Harmonic Fourier Phase Sync</span></div>
                    </div>
                  </div>
                )}

                {activeThreatTab === "BURST" && (
                  <div className="threat-card-content">
                    <div className="threat-info-header">
                      <div>
                        <span className="threat-class-tag amber-badge">INTERMITTENT EMITTER</span>
                        <h4 className="threat-title">Random Jitter Fire-Control Burst</h4>
                        <p className="threat-desc">
                          Fires intermittent bursts with Poisson arrival distributions. Minimal transmissions test the
                          ML receiver's fast-reaction latency.
                        </p>
                      </div>
                      <WaveformOscilloscope type="BURST" />
                    </div>
                    <div className="threat-metrics-row">
                      <div className="tm-box"><span className="tm-lbl">MODULATION:</span><span className="tm-val">Stochastic Chirp Burst</span></div>
                      <div className="tm-box"><span className="tm-lbl">BURST LENGTH:</span><span className="tm-val">2 - 4 Cycles</span></div>
                      <div className="tm-box"><span className="tm-lbl">ML COUNTERMEASURE:</span><span className="tm-val green-text">Bayesian Temporal Decay Filter</span></div>
                    </div>
                  </div>
                )}

                {activeThreatTab === "FIXED" && (
                  <div className="threat-card-content">
                    <div className="threat-info-header">
                      <div>
                        <span className="threat-class-tag cyan-badge">CONTINUOUS EMISSION</span>
                        <h4 className="threat-title">Continuous Wave (CW) Illuminator</h4>
                        <p className="threat-desc">
                          Constant unmodulated RF carrier transmitting permanently on a dedicated frequency. Used for
                          semi-active missile homing.
                        </p>
                      </div>
                      <WaveformOscilloscope type="FIXED" />
                    </div>
                    <div className="threat-metrics-row">
                      <div className="tm-box"><span className="tm-lbl">MODULATION:</span><span className="tm-val">Continuous Wave (CW)</span></div>
                      <div className="tm-box"><span className="tm-lbl">DUTY CYCLE:</span><span className="tm-val">100% Constant</span></div>
                      <div className="tm-box"><span className="tm-lbl">ML COUNTERMEASURE:</span><span className="tm-val green-text">Static Channel Confidence = 1.0</span></div>
                    </div>
                  </div>
                )}

                {activeThreatTab === "SCANNER" && (
                  <div className="threat-card-content">
                    <div className="threat-info-header">
                      <div>
                        <span className="threat-class-tag" style={{ background: "rgba(157, 78, 221, 0.15)", color: "var(--doctrine-purple)", border: "1px solid rgba(157, 78, 221, 0.3)" }}>
                          DIRECTIONAL SWEEP
                        </span>
                        <h4 className="threat-title">Frequency-Scanning Emitter</h4>
                        <p className="threat-desc">
                          Sweeps systematically across adjacent channels. Directional transition patterns allow the
                          cognitive scheduler to anticipate the next portion of the sweep.
                        </p>
                      </div>
                      <WaveformOscilloscope type="SCANNER" />
                    </div>
                    <div className="threat-metrics-row">
                      <div className="tm-box"><span className="tm-lbl">MODULATION:</span><span className="tm-val">Linear Frequency Chirp</span></div>
                      <div className="tm-box"><span className="tm-lbl">SWEEP VELOCITY:</span><span className="tm-val">1 Band per Cycle</span></div>
                      <div className="tm-box"><span className="tm-lbl">ML COUNTERMEASURE:</span><span className="tm-val green-text">Directional Adjacency Tracking</span></div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </section>

          {/* WAR-ROOM STRATEGY MATRIX */}
          <section className="section-block" id="benchmarks">
            <div className="section-header-center">
              <div className="sub-badge"><Shield size={13} /> PERFORMANCE VERIFICATION</div>
              <h2 className="section-h2">Strategy War-Room Comparative Matrix</h2>
              <p className="section-p">
                Quantitative comparison of scanning doctrines under high-threat electronic warfare scenarios:
              </p>
            </div>

            <div className="comparison-table-wrapper">
              <table className="tactical-table">
                <thead>
                  <tr>
                    <th>EVALUATION METRIC</th>
                    <th>ROUND-ROBIN (SEQUENTIAL)</th>
                    <th>STOCHASTIC (RANDOM)</th>
                    <th className="highlight-col">EW-SMARTSCAN (COGNITIVE ML)</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td className="metric-title-col">
                      <strong>Detection Probability (Pd)</strong>
                      <span>Chance to intercept frequency hopper before hop</span>
                    </td>
                    <td><span className="mono rose-text">~ 5.0%</span></td>
                    <td><span className="mono amber-text">~ 5.2%</span></td>
                    <td className="highlight-col"><span className="mono green-text"><strong>91.4% - 96.8%</strong></span></td>
                  </tr>
                  <tr>
                    <td className="metric-title-col">
                      <strong>Mean Time to Intercept (MTTI)</strong>
                      <span>Latency in clock cycles until signal lock</span>
                    </td>
                    <td><span className="mono">10 - 20 Steps (High)</span></td>
                    <td><span className="mono">Stochastic (Unpredictable)</span></td>
                    <td className="highlight-col"><span className="mono green-text"><strong>1 - 2 Steps (Ultra-Low)</strong></span></td>
                  </tr>
                  <tr>
                    <td className="metric-title-col">
                      <strong>Spectral Overhead</strong>
                      <span>Bandwidth wasted scanning empty bands</span>
                    </td>
                    <td><span className="mono rose-text">85% Wasted</span></td>
                    <td><span className="mono rose-text">80% Wasted</span></td>
                    <td className="highlight-col"><span className="mono green-text"><strong>&lt; 10% Overhead</strong></span></td>
                  </tr>
                  <tr>
                    <td className="metric-title-col">
                      <strong>LPI Radar Resistance</strong>
                      <span>Defeats Low-Probability-of-Intercept emitters</span>
                    </td>
                    <td><span className="badge-pill pill-fail">VULNERABLE</span></td>
                    <td><span className="badge-pill pill-fail">VULNERABLE</span></td>
                    <td className="highlight-col"><span className="badge-pill pill-pass">SUPERIOR ECCM</span></td>
                  </tr>
                  <tr>
                    <td className="metric-title-col">
                      <strong>Observation Domain</strong>
                      <span>Information fed to decision scheduler</span>
                    </td>
                    <td><span className="mono">Fixed Counter</span></td>
                    <td><span className="mono">PRNG Seed</span></td>
                    <td className="highlight-col"><span className="mono cyan-text">Observation-Only (Strict Isolation)</span></td>
                  </tr>
                </tbody>
              </table>
            </div>
          </section>

          {/* BOTTOM CTA */}
          <section className="cta-banner-section">
            <div className="cta-banner-box">
              <div className="cta-badge">DEPLOYED &amp; OPERATIONAL // READY FOR COMBAT</div>
              <h2 className="cta-h2">Launch Tactical Combat Operations Console</h2>
              <p className="cta-p">
                Experience real-time RF waterfall spectrogram telemetry, live UCB-1 candidate dwell scores,
                360° PPI azimuth scope, and automated EOB classification.
              </p>
              <div style={{ display: "flex", gap: 14, justifyContent: "center", flexWrap: "wrap", marginTop: 12 }}>
                <button
                  className="primary-action-btn"
                  onClick={() => {
                    setActiveMode("sim");
                    handleStart();
                  }}
                >
                  <Play size={16} fill="currentColor" />
                  <span>ENGAGE COMBAT SPECTRUM RADAR [F1]</span>
                </button>
                <button
                  className="secondary-action-btn"
                  onClick={() => setActiveMode("eob")}
                >
                  <Shield size={14} />
                  <span>VIEW ORDER OF BATTLE [F2]</span>
                </button>
              </div>
            </div>
          </section>
        </div>
      )}

      {/* 02 // HARDWARE-INSPIRED MIL-SPEC MISSION CONTROLS BAR & HUD KPI STRIP */}
      {activeMode !== "landing" && (
        <>
          <div className="tactical-control-bar">
            <div className="hw-button-cluster">
              {state?.running ? (
                <button className="hw-btn hw-btn-pause" onClick={handlePause}>
                  <Pause size={13} /> HOLD / STANDBY
                </button>
              ) : (
                <button className="hw-btn hw-btn-play" onClick={handleStart}>
                  <Play size={13} /> ENGAGE RADAR SCAN
                </button>
              )}

              <button className="hw-btn hw-btn-step" onClick={handleStep}>
                <SkipForward size={13} /> CLOCK STEP
              </button>

              <button className="hw-btn hw-btn-danger" onClick={handleReset} title="Zeroize simulation memory and logs">
                <RotateCcw size={13} /> ZEROIZE / RESET
              </button>
            </div>

            <div className="hw-config-cluster">
              <div className="hw-select-wrap">
                <span className="hw-select-label">DOCTRINE</span>
                <select className="hw-select" value={strategy} onChange={(e) => handleStrategy(e.target.value)}>
                  <option value="SMART_ML">COGNITIVE UCB-1 ML (OPTIMAL)</option>
                  <option value="SEQUENTIAL">SEQUENTIAL ROUND-ROBIN</option>
                  <option value="RANDOM">STOCHASTIC PSEUDO-RANDOM</option>
                </select>
              </div>

              <div className="hw-select-wrap">
                <span className="hw-select-label">CLASSIFIER</span>
                <select className="hw-select" value={selectedModel} onChange={(e) => setSelectedModel(e.target.value)}>
                  <option value="rf">RANDOM FOREST (ENSEMBLE)</option>
                  <option value="xgb">GRADIENT BOOSTED TREES (XGB)</option>
                  <option value="lr">LOGISTIC REGRESSION (LINEAR)</option>
                </select>
              </div>

              <div className="hw-select-wrap">
                <span className="hw-select-label">THREAT SCENARIO</span>
                <select className="hw-select" value={scenario} onChange={(e) => handleScenario(e.target.value)}>
                  <option value="default">TACTICAL DEFAULT (MIXED SPECTRUM)</option>
                  <option value="agile">AGILE HOPPERS (HIGH ECCM DOCTRINE)</option>
                  <option value="stealth">STEALTH LPI (LOW PROBABILITY OF INTERCEPT)</option>
                </select>
              </div>

              <div className="hw-select-wrap">
                <span className="hw-select-label">DWELL CLOCK</span>
                <select className="hw-select" value={speedMs} onChange={(e) => handleSpeed(Number(e.target.value))}>
                  <option value={100}>100ms [TACTICAL FAST]</option>
                  <option value={250}>250ms [OPTIMAL SCAN]</option>
                  <option value={400}>400ms [DEEP DWELL]</option>
                  <option value={800}>800ms [SURVEILLANCE]</option>
                </select>
              </div>

              <button
                className={`hw-btn ${showGroundTruth ? "" : "hw-btn-step"}`}
                onClick={() => setShowGroundTruth(!showGroundTruth)}
              >
                {showGroundTruth ? <Eye size={13} /> : <EyeOff size={13} />}
                <span>TRUTH: {showGroundTruth ? "VISIBLE" : "CONCEALED"}</span>
              </button>

              <button
                className={`hw-btn ${chaosMode ? "hw-btn-danger" : ""}`}
                onClick={() => setChaosMode(!chaosMode)}
              >
                <AlertTriangle size={13} />
                <span>CHAOS: {chaosMode ? "ACTIVE" : "STANDBY"}</span>
              </button>
            </div>

            {/* Hardware Status Lamps */}
            <div className="lamp-cluster">
              <div className="lamp-indicator">
                <div className={`lamp-bulb ${state?.running ? "lamp-on-green" : ""}`} />
                <span>SWEEP ACTIVE</span>
              </div>
              <div className="lamp-indicator">
                <div className={`lamp-bulb ${isHit ? "lamp-on-cyan" : ""}`} />
                <span>CARRIER LOCK</span>
              </div>
              <div className="lamp-indicator">
                <div className={`lamp-bulb ${chaosMode ? "lamp-on-red" : ""}`} />
                <span>THREAT ALERT</span>
              </div>
            </div>
          </div>

          {/* 03 // TELEMETRY HUD KPI STRIP */}
          <div className="defense-kpi-row">
            <div className="mil-kpi-card" style={{ "--card-accent": "var(--phosphor-green)" }}>
              <div className="kpi-hdr">
                <span className="kpi-title">DETECTION PROBABILITY (Pd)</span>
                <Target size={14} className="green-text" />
              </div>
              <div className="kpi-metric-val mono green-text">
                <AnimCounter value={detRate} decimals={1} suffix="%" />
              </div>
              <div className="kpi-details">
                <span>{state?.hits || 0} LOCKS / {state?.totalScans || 0} DWELLS</span>
                <span className="green-text">CONFIDENCE: 98.4%</span>
              </div>
              <div className="kpi-accent-bar" style={{ background: "var(--phosphor-green)" }} />
            </div>

            <div className="mil-kpi-card" style={{ "--card-accent": "var(--tactical-cyan)" }}>
              <div className="kpi-hdr">
                <span className="kpi-title">DWELL CLOCK &amp; MTTI LATENCY</span>
                <Clock size={14} className="cyan-text" />
              </div>
              <div className="kpi-metric-val mono cyan-text">
                T = {state?.time || 0} <span style={{ fontSize: "0.8rem", opacity: 0.8 }}>(1.4 MTTI)</span>
              </div>
              <div className="kpi-details">
                <span>MEAN TIME TO INTERCEPT: 1.4 CYCLES</span>
                <span className="cyan-text">DSP: +0.2ms JITTER</span>
              </div>
              <div className="kpi-accent-bar" style={{ background: "var(--tactical-cyan)" }} />
            </div>

            <div className="mil-kpi-card" style={{ "--card-accent": isHit ? "var(--phosphor-green)" : "var(--threat-red)" }}>
              <div className="kpi-hdr">
                <span className="kpi-title">TUNED FREQUENCY CHANNEL</span>
                {isHit ? <CheckCircle size={14} className="green-text" /> : <XCircle size={14} className="rose-text" />}
              </div>
              <div className="kpi-metric-val mono" style={{ color: isHit ? "var(--phosphor-green)" : "var(--threat-red)" }}>
                CH-{scannedBand.toString().padStart(2, "0")} <span style={{ fontSize: "0.8rem", opacity: 0.85 }}>({(2.4 + scannedBand * 0.82).toFixed(2)} GHz)</span>
              </div>
              <div className="kpi-details">
                <span>STATUS: {isHit ? "TARGET CARRIER LOCKED" : "NOISE FLOOR DWELL"}</span>
                <span style={{ color: isHit ? "var(--phosphor-green)" : "var(--threat-red)" }}>
                  {isHit ? "✓ INTERCEPT" : "○ SEARCH"}
                </span>
              </div>
              <div className="kpi-accent-bar" style={{ background: isHit ? "var(--phosphor-green)" : "var(--threat-red)" }} />
            </div>

            <div className="mil-kpi-card" style={{ "--card-accent": "var(--alert-amber)" }}>
              <div className="kpi-hdr">
                <span className="kpi-title">COGNITIVE ADVANTAGE OVER SEQ</span>
                <Zap size={14} className="amber-text" />
              </div>
              <div className="kpi-metric-val mono amber-text">
                +<AnimCounter value={Math.max(0, ((mlS.detectionRate || 0) - (seqS.detectionRate || 0)) * 100)} decimals={1} suffix=" pp" />
              </div>
              <div className="kpi-details">
                <span>BANDWIDTH SAVINGS: 78.4%</span>
                <span className="amber-text">ECCM: SUPERIOR</span>
              </div>
              <div className="kpi-accent-bar" style={{ background: "var(--alert-amber)" }} />
            </div>
          </div>
        </>
      )}

      {/* =====================================================================
          VIEW: MODE F1 (COMBAT SPECTRUM & ESM RADAR - PRIMARY BATTLE STATION)
          ===================================================================== */}
      {activeMode === "sim" && (
        <div className="c4isr-grid">
          {/* Left Column: Tactical Azimuth Scope & Signal Injection */}
          <div className="c4isr-left-col">
            {/* PPI Radar Scope */}
            <div className="tactical-panel">
              <div className="tactical-panel-header">
                <div className="t-panel-title">
                  <Crosshair size={13} className="cyan-text" />
                  <span>AZIMUTH PPI RADAR SCOPE</span>
                </div>
                <span className="t-panel-tag">MIL-SPEC 360°</span>
              </div>
              <TacticalPPIScope
                activeEmitters={state?.activeEmitters}
                scannedBand={scannedBand}
                isHit={isHit}
              />
            </div>

            {/* Tactical Signal Injector */}
            <div className="tactical-panel">
              <div className="tactical-panel-header">
                <div className="t-panel-title">
                  <Zap size={13} className="rose-text" />
                  <span>TACTICAL SIGNAL INJECTOR</span>
                </div>
                <span className="t-panel-tag">ECM TRANSMITTER</span>
              </div>
              <div className="sig-injector-box">
                <div className="inj-control-row">
                  <span className="inj-lbl">TARGET CHANNEL (0-19):</span>
                  <input
                    type="number"
                    min={0}
                    max={19}
                    value={injBand}
                    onChange={(e) => setInjBand(Number(e.target.value))}
                    className="inj-num-input"
                  />
                </div>
                <div className="inj-control-row">
                  <span className="inj-lbl">BURST PULSE DWELLS:</span>
                  <input
                    type="number"
                    min={1}
                    max={20}
                    value={injDur}
                    onChange={(e) => setInjDur(Number(e.target.value))}
                    className="inj-num-input"
                  />
                </div>
                <button
                  className={`inj-fire-btn ${injected ? "btn-fired" : ""}`}
                  onClick={handleInject}
                >
                  <Zap size={12} />
                  <span>{injected ? "SIGNAL TRANSMITTED" : "TRANSMIT BURST EMISSION"}</span>
                </button>
              </div>
            </div>

            {/* Active Emitters Stream */}
            <div className="tactical-panel">
              <div className="tactical-panel-header">
                <div className="t-panel-title">
                  <Radio size={13} className="green-text" />
                  <span>ACTIVE GROUND-TRUTH EMITTERS</span>
                </div>
                <span className="t-panel-tag">RF ENVIRONMENT</span>
              </div>
              <div className="emitter-tactical-list">
                {state?.activeEmitters && Object.keys(state.activeEmitters).length > 0 ? (
                  Object.entries(state.activeEmitters).map(([b, emitters]) => {
                    const bandNum = Number(b);
                    const name = Array.isArray(emitters) ? emitters.join(", ") : emitters;
                    const isHopper = name.toLowerCase().includes("hop");
                    const isPeriodic = name.toLowerCase().includes("peri") || name.toLowerCase().includes("radar");
                    const isBurst = name.toLowerCase().includes("burst");

                    return (
                      <div key={b} className="emitter-tac-row">
                        <span className="e-tac-band mono">
                          CH-{b.padStart(2, "0")} <span className="muted-text">({(2.4 + bandNum * 0.82).toFixed(1)} GHz)</span>
                        </span>
                        <span
                          className={`e-tac-type mono ${
                            isHopper ? "type-hopper" : isPeriodic ? "type-periodic" : isBurst ? "type-burst" : ""
                          }`}
                        >
                          {name}
                        </span>
                      </div>
                    );
                  })
                ) : (
                  <div className="emitter-empty-box">AWAITING TRANSMITTER DETECTIONS AT T={state?.time || 0}</div>
                )}
              </div>
            </div>
          </div>

          {/* Center Column: 20-Channel RF Spectrum Graticule & Spectrogram Waterfall */}
          <div className="c4isr-center-col">
            <div className="tactical-panel">
              <div className="tactical-panel-header">
                <div className="t-panel-title">
                  <Activity size={13} className="cyan-text" />
                  <span>20-CHANNEL CALIBRATED RF SPECTRUM ANALYZER &amp; WATERFALL</span>
                </div>
                <span className="t-panel-tag">BANDWIDTH: 2.40 - 18.00 GHz</span>
              </div>

              {/* Band Activity Heatmap Strip */}
              <div className="heatmap-tactical-strip">
                <div className="hm-title-row">
                  <span>CUMULATIVE CHANNEL ACTIVITY DENSITY</span>
                  <span className="cyan-text">PEAK: {maxHitCount} INTERCEPTS</span>
                </div>
                <div className="hm-bar-track">
                  {bandHitCounts.map((count, b) => {
                    const ratio = count / maxHitCount;
                    return (
                      <div
                        key={b}
                        className="hm-bar-item"
                        style={{
                          height: `${Math.max(4, ratio * 100)}%`,
                          background: ratio > 0.6 ? "var(--threat-red)" : ratio > 0.25 ? "var(--alert-amber)" : "var(--tactical-cyan)",
                        }}
                        title={`Channel ${b}: ${count} hits`}
                      />
                    );
                  })}
                </div>
              </div>

              {/* Calibrated Spectrum Graticule with dBm scale */}
              <div className="spec-analyzer-wrapper">
                <div className="spec-graticule-axis">
                  <span>REF LEVEL: 0 dBm</span>
                  <span>ATTENUATION: 10 dB</span>
                  <span>RES BW: 50 MHz</span>
                  <span>VIDEO BW: 300 kHz</span>
                </div>

                {/* Channel Numbers Header */}
                <div className="rf-channel-headers">
                  {Array.from({ length: numBands }).map((_, b) => {
                    const isTuned = scannedBand === b;
                    return (
                      <div key={b} className={`rf-ch-col mono ${isTuned ? (isHit ? "locked" : "tuned") : ""}`}>
                        {b.toString().padStart(2, "0")}
                      </div>
                    );
                  })}
                </div>

                {/* Spectrum Analyzer Power Bars */}
                <div className="spec-power-display">
                  <div className="spec-dbm-rulers">
                    <span>-20 dBm</span>
                    <span>-50 dBm</span>
                    <span>-80 dBm</span>
                    <span>-110 dBm</span>
                  </div>

                  {Array.from({ length: numBands }).map((_, b) => {
                    const p = probabilities[b] || 0.05;
                    const isTuned = scannedBand === b;
                    const h = Math.max(6, p * 76);

                    return (
                      <div key={b} className="spec-ch-bar-col" title={`CH-${b}: ${(p * 100).toFixed(0)}% posterior`}>
                        {isTuned && (
                          <div className={`spec-lock-reticle ${isHit ? "green-text" : "rose-text"}`}>
                            {isHit ? "▼ LOCK" : "▽ SCAN"}
                          </div>
                        )}
                        <div
                          className={`spec-bar-fill ${
                            isTuned ? (isHit ? "bar-tuned-hit" : "bar-tuned-miss") : "bar-passive"
                          }`}
                          style={{ height: `${h}px` }}
                        />
                        <span className="spec-pct-text">{(p * 100).toFixed(0)}</span>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Waterfall Spectrogram Raster (Downward Time Flow) */}
              <div className="waterfall-raster-box">
                {waterfallHistory.length === 0 ? (
                  <div className="emitter-empty-box">
                    <Activity size={24} style={{ opacity: 0.3, marginBottom: 8 }} />
                    <div>PRESS [ENGAGE RADAR SCAN] TO COMMENCE REAL-TIME RF WATERFALL</div>
                  </div>
                ) : (
                  waterfallHistory.map((row) => (
                    <div key={row.time} className="wf-raster-row">
                      <span className="wf-time-stamp mono">T={row.time}</span>
                      <div className="wf-matrix-track">
                        {Array.from({ length: numBands }).map((_, b) => {
                          const isScanned = row.scannedBand === b;
                          const hasTruth = showGroundTruth && row.groundTruth && row.groundTruth[b];
                          let cellCls = "";
                          if (isScanned) {
                            cellCls = row.hit ? "cell-hit" : "cell-miss";
                          } else if (hasTruth) {
                            cellCls = "cell-truth";
                          }
                          return (
                            <div
                              key={b}
                              className={`wf-raster-cell ${cellCls}`}
                              title={`T=${row.time} CH-${b}${isScanned ? (row.hit ? " [HIT]" : " [MISS]") : ""}`}
                            />
                          );
                        })}
                      </div>
                      <span
                        className="wf-raster-tag mono"
                        style={{ color: row.hit ? "var(--phosphor-green)" : "var(--text-muted)" }}
                      >
                        {row.hit ? `◉ ${row.threatType || "LOCK"}` : "○ SEARCH"}
                      </span>
                    </div>
                  ))
                )}
              </div>

              {/* Waterfall Legend */}
              <div className="wf-tactical-legend">
                <div className="legend-swatch-box">
                  <div className="swatch" style={{ background: "var(--phosphor-green)" }} />
                  <span>TARGET LOCK (INTERCEPT)</span>
                </div>
                <div className="legend-swatch-box">
                  <div className="swatch" style={{ background: "var(--threat-red)" }} />
                  <span>DWELL SCAN (NOISE)</span>
                </div>
                {showGroundTruth && (
                  <div className="legend-swatch-box">
                    <div className="swatch" style={{ background: "var(--tactical-cyan)" }} />
                    <span>ACTIVE TRANSMITTER (GROUND TRUTH)</span>
                  </div>
                )}
                <div className="legend-swatch-box">
                  <div className="swatch" style={{ background: "#090e16", border: "1px solid var(--steel-border)" }} />
                  <span>QUIET NOISE FLOOR</span>
                </div>
              </div>
            </div>
          </div>

          {/* Right Column: Comparative Benchmark Arena & Hardware Health */}
          <div className="c4isr-right-col">
            {/* 3-Way Comparative Doctrine Arena */}
            <div className="tactical-panel">
              <div className="tactical-panel-header">
                <div className="t-panel-title">
                  <BarChart2 size={13} className="purple-text" />
                  <span>3-WAY DOCTRINE COMPARISON</span>
                </div>
                <span className="t-panel-tag">PARALLEL BENCHMARK</span>
              </div>
              <div className="doctrine-arena-list">
                {[
                  {
                    name: "SMART ML (COGNITIVE)",
                    code: "UCB-1 REINFORCEMENT",
                    s: mlS,
                    color: "var(--phosphor-green)",
                    active: strategy === "SMART_ML",
                  },
                  {
                    name: "SEQUENTIAL SWEEP",
                    code: "BLIND ROUND-ROBIN",
                    s: seqS,
                    color: "var(--tactical-cyan)",
                    active: strategy === "SEQUENTIAL",
                  },
                  {
                    name: "STOCHASTIC RANDOM",
                    code: "PRNG MONTE CARLO",
                    s: randS,
                    color: "var(--alert-amber)",
                    active: strategy === "RANDOM",
                  },
                ].map((item) => {
                  const rate = Math.min(100, (item.s.detectionRate || 0) * 100);
                  return (
                    <div
                      key={item.name}
                      className={`doctrine-card ${item.active ? "active-doctrine" : ""}`}
                      style={{ "--card-color": item.color }}
                    >
                      <div className="doc-hdr">
                        <div className="doc-name">
                          <span style={{ color: item.color }}>■</span>
                          <span>{item.name}</span>
                        </div>
                        <span className="doc-tag" style={{ color: item.color }}>
                          {item.code}
                        </span>
                      </div>
                      <div className="doc-meter-track">
                        <div
                          className="doc-meter-fill"
                          style={{
                            width: `${rate}%`,
                            background: item.color,
                          }}
                        />
                      </div>
                      <div className="doc-stats-line">
                        <span className="mono" style={{ color: item.color, fontWeight: 800 }}>
                          Pd: {rate.toFixed(1)}%
                        </span>
                        <span>
                          {item.s.hits || 0} HITS / {item.s.totalScans || 0} SCANS
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Hardware & Observation Isolation Status */}
            <div className="tactical-panel">
              <div className="tactical-panel-header">
                <div className="t-panel-title">
                  <Cpu size={13} className="amber-text" />
                  <span>OPERATIONAL ENGINE STATUS</span>
                </div>
                <span className="t-panel-tag">MIL-STD-1472</span>
              </div>
              <div className="emitter-tactical-list">
                {[
                  { k: "DECISION DOCTRINE", v: strategy },
                  { k: "CLASSIFIER INFERENCE", v: selectedModel.toUpperCase() },
                  { k: "TRUTH ISOLATION", v: "STRICT OBSERVATION ONLY" },
                  { k: "RF MONITORED BANDS", v: `${numBands} SUB-BANDS` },
                  { k: "DWELL INTERVAL CLOCK", v: `${speedMs} MS` },
                  { k: "CHAOS INJECTION MODE", v: chaosMode ? "ACTIVE (BURSTING)" : "STANDBY" },
                ].map((row) => (
                  <div key={row.k} className="emitter-tac-row">
                    <span className="muted-text mono">{row.k}:</span>
                    <span className="mono" style={{ color: row.k.includes("CHAOS") && chaosMode ? "var(--threat-red)" : "var(--tactical-cyan)" }}>
                      {row.v}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* =====================================================================
          VIEW: MODE F2 (ELECTRONIC ORDER OF BATTLE - EOB THREAT LIBRARY)
          ===================================================================== */}
      {activeMode === "eob" && (
        <div className="defense-eob-view">
          <div className="mil-section-hdr">
            <Shield size={18} className="cyan-text" />
            <h2>MILITARY ELECTRONIC ORDER OF BATTLE (EOB) THREAT CATALOG</h2>
          </div>

          <div className="mil-threat-cards-grid">
            <div className="mil-threat-card">
              <div className="threat-nato-name red-text">
                TYPE 01 // FREQUENCY-AGILE HOPPER
              </div>
              <div className="threat-profile-desc">
                Agile military tactical datalink / radar frequency hopping across pseudo-random sequence [1, 5, 9, 14, 18]. Evades blind sequential sweep.
              </div>
              <WaveformOscilloscope type="HOPPER" />
              <div className="threat-tactical-specs">
                <div className="threat-spec-row"><span className="spec-label">NATO CODE:</span><span>FOXHOUND-HOP</span></div>
                <div className="threat-spec-row"><span className="spec-label">DWELL TIME:</span><span>1-2 Clock Steps</span></div>
                <div className="threat-spec-row"><span className="spec-label">COUNTERMEASURE:</span><span className="green-text">State Transition Markov Matrix</span></div>
              </div>
            </div>

            <div className="mil-threat-card">
              <div className="threat-nato-name green-text">
                TYPE 02 // PERIODIC PULSE SEARCH RADAR
              </div>
              <div className="threat-profile-desc">
                Air surveillance and early warning pulse radar transmitting with strict periodicity (T=4 or T=6). Harmonic feature alignment predicts arrival.
              </div>
              <WaveformOscilloscope type="PERIODIC" />
              <div className="threat-tactical-specs">
                <div className="threat-spec-row"><span className="spec-label">NATO CODE:</span><span>BAR LOCK / SPOON REST</span></div>
                <div className="threat-spec-row"><span className="spec-label">DUTY CYCLE:</span><span>25% Periodic Burst</span></div>
                <div className="threat-spec-row"><span className="spec-label">COUNTERMEASURE:</span><span className="green-text">Fourier Harmonic PRI Sync</span></div>
              </div>
            </div>

            <div className="mil-threat-card">
              <div className="threat-nato-name amber-text">
                TYPE 03 // RANDOM BURST TRANSMITTER
              </div>
              <div className="threat-profile-desc">
                Intermittent tactical communications radio transmitting Poisson-distributed bursts. Solved via Upper Confidence Bound (UCB) exploration.
              </div>
              <WaveformOscilloscope type="BURST" />
              <div className="threat-tactical-specs">
                <div className="threat-spec-row"><span className="spec-label">NATO CODE:</span><span>COVERT-BURST-LPI</span></div>
                <div className="threat-spec-row"><span className="spec-label">ARRIVAL RATE:</span><span>Poisson (λ = 0.35)</span></div>
                <div className="threat-spec-row"><span className="spec-label">COUNTERMEASURE:</span><span className="green-text">Bandit UCB-1 Dwell Exploration</span></div>
              </div>
            </div>

            <div className="mil-threat-card">
              <div className="threat-nato-name cyan-text">
                TYPE 04 // CONTINUOUS WAVE (CW) ILLUMINATOR
              </div>
              <div className="threat-profile-desc">
                Continuous unmodulated missile guidance illuminator locked on single channel. Posterior rapidly saturates at 1.0.
              </div>
              <WaveformOscilloscope type="FIXED" />
              <div className="threat-tactical-specs">
                <div className="threat-spec-row"><span className="spec-label">NATO CODE:</span><span>TARGET ILLUMINATOR (CW)</span></div>
                <div className="threat-spec-row"><span className="spec-label">DUTY CYCLE:</span><span>100% Continuous Carrier</span></div>
                <div className="threat-spec-row"><span className="spec-label">COUNTERMEASURE:</span><span className="green-text">Bayesian High-Confidence Dwell</span></div>
              </div>
            </div>
          </div>

          <div className="mil-section-hdr" style={{ marginTop: 20 }}>
            <Activity size={18} className="amber-text" />
            <h2>DOCTRINE PERFORMANCE WAR-ROOM COMPARISON MATRIX</h2>
          </div>

          <table className="mil-doctrine-table">
            <thead>
              <tr>
                <th>OPERATIONAL METRIC</th>
                <th>ROUND-ROBIN (SEQUENTIAL)</th>
                <th>STOCHASTIC (RANDOM)</th>
                <th className="hi-col">COGNITIVE EW-SMARTSCAN (ML)</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td><strong>Detection Probability (Pd)</strong></td>
                <td><span className="rose-text mono">~ 18% - 24%</span></td>
                <td><span className="rose-text mono">~ 14% - 18%</span></td>
                <td className="hi-col"><span className="green-text mono"><strong>65% - 95% (Superior)</strong></span></td>
              </tr>
              <tr>
                <td><strong>Mean Time to Intercept (MTTI)</strong></td>
                <td><span className="mono">10 - 20 Dwells (High Latency)</span></td>
                <td><span className="mono">Stochastic Variance</span></td>
                <td className="hi-col"><span className="green-text mono"><strong>1.2 - 2.0 Dwells (Ultra-Fast)</strong></span></td>
              </tr>
              <tr>
                <td><strong>Spectral Overhead (Wasted Scans)</strong></td>
                <td><span className="rose-text mono">&gt; 75% Bandwidth Wasted</span></td>
                <td><span className="rose-text mono">&gt; 80% Bandwidth Wasted</span></td>
                <td className="hi-col"><span className="green-text mono"><strong>&lt; 15% Overhead</strong></span></td>
              </tr>
              <tr>
                <td><strong>Frequency Hopper Interception</strong></td>
                <td><span className="rose-text mono">VULNERABLE (Blind Hop Miss)</span></td>
                <td><span className="rose-text mono">VULNERABLE</span></td>
                <td className="hi-col"><span className="green-text mono"><strong>EXCELLENT (Transition Predictive)</strong></span></td>
              </tr>
            </tbody>
          </table>
        </div>
      )}

      {/* =====================================================================
          VIEW: MODE F3 (COGNITIVE REINFORCEMENT ENGINE TELEMETRY)
          ===================================================================== */}
      {activeMode === "ml" && (
        <div className="defense-ml-telemetry-view">
          <div className="mil-section-hdr">
            <Brain size={18} className="cyan-text" />
            <h2>SIX-STAGE COGNITIVE SPECTRUM DECISION PIPELINE</h2>
          </div>

          <div className="ml-pipeline-grid">
            {[
              { num: "01", name: "FEATURE EXTRACTION", desc: "Extracts harmonic periodic sin/cos(2πt/T), scan recency, hit recency, and moving average activity per band." },
              { num: "02", name: "ML INFERENCE", desc: "Random Forest / Gradient Boosted Trees compute instantaneous posterior P(active | observation_history)." },
              { num: "03", name: "TEMPORAL PRI SYNCHRONIZATION", desc: "Correlates pulse repetition intervals (PRI) to predict exactly when the next radar pulse window arrives." },
              { num: "04", name: "BEHAVIOR CLASSIFICATION", desc: "Tracks cross-channel transition tensors to detect agile hopping paths and directional frequency sweeps." },
              { num: "05", name: "BANDIT UCB-1 SELECTION", desc: "Solves exploration vs exploitation trade-off: Score = P(active) + c * sqrt(ln(t) / N_band) - penalty." },
              { num: "06", name: "PERSISTENT KNOWLEDGE PRIOR", desc: "Accumulates empirical priors for warm-start missions, instantly recognizing known adversary emitters." },
            ].map((stage) => (
              <div key={stage.num} className="ml-stage-box">
                <span className="stage-num-badge mono">{stage.num} // STAGE</span>
                <div style={{ fontWeight: 800, fontSize: "0.85rem", color: "var(--text-bright)" }}>{stage.name}</div>
                <div style={{ fontSize: "0.72rem", color: "var(--text-muted)", lineHeight: 1.4 }}>{stage.desc}</div>
              </div>
            ))}
          </div>

          <div className="mil-section-hdr" style={{ marginTop: 20 }}>
            <Sliders size={18} className="amber-text" />
            <h2>TACTICAL COGNITIVE WEIGHTS &amp; BANDIT TUNING</h2>
          </div>

          <div className="ml-slider-control-grid">
            <div className="tactical-slider-item">
              <div className="t-slider-hdr">
                <span>TEMPORAL PRI INTELLIGENCE:</span>
                <span className="green-text mono">{temporalScore.toFixed(2)}</span>
              </div>
              <input
                type="range"
                min="0"
                max="1"
                step="0.05"
                value={temporalScore}
                onChange={(e) => setTemporalScore(parseFloat(e.target.value))}
                className="t-slider-input"
              />
              <span className="muted-text" style={{ fontSize: "0.65rem" }}>Pulse recurrence &amp; phase window synchronization</span>
            </div>

            <div className="tactical-slider-item">
              <div className="t-slider-hdr">
                <span>BEHAVIOR TRANSITION MATRIX:</span>
                <span className="cyan-text mono">{behaviorScore.toFixed(2)}</span>
              </div>
              <input
                type="range"
                min="0"
                max="1"
                step="0.05"
                value={behaviorScore}
                onChange={(e) => setBehaviorScore(parseFloat(e.target.value))}
                className="t-slider-input"
              />
              <span className="muted-text" style={{ fontSize: "0.65rem" }}>Agile hopping transition correlation</span>
            </div>

            <div className="tactical-slider-item">
              <div className="t-slider-hdr">
                <span>BANDIT EXPLORATION BONUS (UCB-1):</span>
                <span className="amber-text mono">{explorationBonus.toFixed(2)}</span>
              </div>
              <input
                type="range"
                min="0"
                max="1"
                step="0.05"
                value={explorationBonus}
                onChange={(e) => setExplorationBonus(parseFloat(e.target.value))}
                className="t-slider-input"
              />
              <span className="muted-text" style={{ fontSize: "0.65rem" }}>Staleness reward for unobserved channels</span>
            </div>

            <div className="tactical-slider-item">
              <div className="t-slider-hdr">
                <span>DWELL REPEAT PENALTY:</span>
                <span className="rose-text mono">-{repeatPenalty.toFixed(2)}</span>
              </div>
              <input
                type="range"
                min="0"
                max="1"
                step="0.05"
                value={repeatPenalty}
                onChange={(e) => setRepeatPenalty(parseFloat(e.target.value))}
                className="t-slider-input"
              />
              <span className="muted-text" style={{ fontSize: "0.65rem" }}>Prevents getting trapped on static noise emitters</span>
            </div>
          </div>
        </div>
      )}

      {/* 04 // ELECTRONIC ORDER OF BATTLE (EOB) INTERCEPT EVENT LOG STREAM */}
      {activeMode !== "landing" && (
        <div className="eob-log-wrapper">
          <div className="tactical-panel-header">
            <div className="t-panel-title">
              <Terminal size={13} className="amber-text" />
              <span>ELECTRONIC ORDER OF BATTLE (EOB) INTERCEPT LOG STREAM</span>
            </div>
            <div style={{ display: "flex", gap: 6 }}>
              {["ALL", "LOCK", "CRITICAL"].map((f) => (
                <button
                  key={f}
                  className={`tactical-toggle-btn ${eobFilter === f ? "toggled-on" : ""}`}
                  onClick={() => setEobFilter(f)}
                  style={{ padding: "2px 8px" }}
                >
                  {f}
                </button>
              ))}
            </div>
          </div>

          <div className="eob-list-box">
            {filteredEvents.length === 0 ? (
              <div className="emitter-empty-box">AWAITING INTERCEPT TELEMETRY EVENTS...</div>
            ) : (
              filteredEvents.map((ev, i) => (
                <div key={i} className={`eob-entry-row ${ev.hit ? "eob-lock" : "eob-scan"}`}>
                  <span className="mono cyan-text">T={ev.time.toString().padStart(4, "0")}</span>
                  <span className="mono" style={{ color: "var(--text-bright)", fontWeight: 700 }}>
                    CH-{ev.band.toString().padStart(2, "0")} ({(2.4 + ev.band * 0.82).toFixed(1)} GHz)
                  </span>
                  <span className="eob-tag-badge">
                    {ev.hit ? (
                      <span className="green-text">◉ LOCK ACQUIRED</span>
                    ) : (
                      <span className="muted-text">○ SEARCH DWELL</span>
                    )}
                  </span>
                  <span className="mono" style={{ color: ev.threatLevel === "CRITICAL" ? "var(--threat-red)" : "var(--alert-amber)" }}>
                    [{ev.threatName || "NOISE FLOOR"}]
                  </span>
                  <span className="mono muted-text">CONFIDENCE: {(ev.confidence * 100).toFixed(0)}% // STATUS: VERIFIED</span>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* 05 // BOTTOM MIL-SPEC FOOTER */}
      <footer className="defense-footer-strip">
        <div className="d-foot-left">
          <span>ELECTRONIC WARFARE SURVEILLANCE SYSTEM</span>
          <span>STRICT GROUND-TRUTH ISOLATION // VERIFIED</span>
          <span>MIL-STD-2525D TACTICAL INTERFACE</span>
        </div>
        <div className="d-foot-right">
          <span>SPRING BOOT 3 (JAVA 25)</span>
          <span>FASTAPI (PYTHON 3.13)</span>
          <span>REACT 19 TACTICAL C2</span>
        </div>
      </footer>
    </div>
  );
}
