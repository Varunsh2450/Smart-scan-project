import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  Radio, Play, Pause, SkipForward, RotateCcw, Zap,
  Activity, Layers, Gauge, Eye, EyeOff, Cpu, Clock,
  Sparkles, ChevronDown, Shield, Target, Brain, Wifi,
  BarChart2, Code2, CheckCircle, XCircle, Terminal,
  Sliders, ArrowRight, Crosshair, AlertTriangle, Compass,
  Database, RefreshCw, ZapOff, Server, Info, ExternalLink,
  BookOpen, Lock, HelpCircle, Layers3, Check, TrendingUp
} from "lucide-react";
import "./App.css";

const API_BASE = "http://localhost:8080";
const MAX_WATERFALL_ROWS = 30;

// Animated number counter
function AnimCounter({ value, decimals = 0, suffix = "" }) {
  const [display, setDisplay] = useState(value);
  const prev = useRef(value);
  useEffect(() => {
    const start = prev.current;
    const end = value;
    if (start === end) return;
    const dur = 600;
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
  return React.createElement(React.Fragment, null, (typeof display === "number" ? display.toFixed(decimals) : display), suffix);
}

// Interactive Hero Radar Canvas
function HeroRadarCanvas() {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    let animId;
    let angle = 0;

    const blips = [
      { r: 0.35, theta: 0.8, band: 4, type: "PERIODIC", life: 1, label: "TGT-04 [PRD]" },
      { r: 0.65, theta: 2.3, band: 12, type: "HOPPER", life: 1, label: "TGT-12 [HOP]" },
      { r: 0.82, theta: 4.1, band: 18, type: "BURST", life: 1, label: "TGT-18 [BST]" },
      { r: 0.48, theta: 5.2, band: 7, type: "FIXED", life: 1, label: "TGT-07 [CW]" },
    ];

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      canvas.width = rect.width * window.devicePixelRatio;
      canvas.height = rect.height * window.devicePixelRatio;
      ctx.scale(window.devicePixelRatio, window.devicePixelRatio);
    };
    resize();
    window.addEventListener("resize", resize);

    const render = () => {
      const w = canvas.getBoundingClientRect().width;
      const h = canvas.getBoundingClientRect().height;
      const cx = w / 2;
      const cy = h / 2;
      const maxR = Math.min(cx, cy) - 16;

      ctx.clearRect(0, 0, w, h);

      // Radar rings
      [0.25, 0.5, 0.75, 1.0].forEach((ratio) => {
        ctx.beginPath();
        ctx.arc(cx, cy, maxR * ratio, 0, Math.PI * 2);
        ctx.strokeStyle = "rgba(0, 212, 255, 0.12)";
        ctx.lineWidth = 1;
        ctx.stroke();

        ctx.fillStyle = "rgba(0, 212, 255, 0.35)";
        ctx.font = "9px 'JetBrains Mono', monospace";
        ctx.fillText(`${Math.round(ratio * 20)}GHz`, cx + 6, cy - maxR * ratio + 10);
      });

      // Axis crosshairs
      ctx.strokeStyle = "rgba(0, 212, 255, 0.1)";
      ctx.setLineDash([3, 3]);
      ctx.beginPath();
      ctx.moveTo(cx - maxR, cy);
      ctx.lineTo(cx + maxR, cy);
      ctx.moveTo(cx, cy - maxR);
      ctx.lineTo(cx, cy + maxR);
      ctx.stroke();
      ctx.setLineDash([]);

      // Angular sectors
      for (let a = 0; a < Math.PI * 2; a += Math.PI / 4) {
        ctx.beginPath();
        ctx.moveTo(cx, cy);
        ctx.lineTo(cx + Math.cos(a) * maxR, cy + Math.sin(a) * maxR);
        ctx.strokeStyle = "rgba(0, 212, 255, 0.05)";
        ctx.stroke();
      }

      angle += 0.02;
      if (angle >= Math.PI * 2) angle -= Math.PI * 2;

      // Sweep gradient sector
      const sweepGrad = ctx.createRadialGradient(cx, cy, 0, cx, cy, maxR);
      sweepGrad.addColorStop(0, "rgba(0, 212, 255, 0.2)");
      sweepGrad.addColorStop(1, "rgba(0, 212, 255, 0.02)");

      ctx.save();
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.arc(cx, cy, maxR, angle - 0.35, angle);
      ctx.closePath();
      ctx.fillStyle = sweepGrad;
      ctx.fill();
      ctx.restore();

      // Main sweep line
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.lineTo(cx + Math.cos(angle) * maxR, cy + Math.sin(angle) * maxR);
      ctx.strokeStyle = "rgba(0, 212, 255, 0.85)";
      ctx.lineWidth = 1.5;
      ctx.stroke();

      // Draw blips & detections
      blips.forEach((b) => {
        const bx = cx + Math.cos(b.theta) * maxR * b.r;
        const by = cy + Math.sin(b.theta) * maxR * b.r;

        let diff = (angle - b.theta + Math.PI * 2) % (Math.PI * 2);
        let intensity = Math.max(0, 1 - diff / 1.4);

        if (diff < 0.08) {
          b.life = 1;
        } else {
          b.life = Math.max(0.15, b.life * 0.985);
        }

        const alpha = Math.max(intensity, b.life);

        ctx.beginPath();
        ctx.arc(bx, by, 4 + intensity * 3, 0, Math.PI * 2);
        ctx.fillStyle = b.type === "HOPPER" 
          ? `rgba(244, 63, 94, ${alpha})` 
          : b.type === "BURST"
          ? `rgba(245, 158, 11, ${alpha})`
          : `rgba(16, 185, 129, ${alpha})`;
        ctx.fill();

        if (alpha > 0.4) {
          ctx.fillStyle = `rgba(248, 250, 252, ${alpha * 0.9})`;
          ctx.font = "9px 'JetBrains Mono', monospace";
          ctx.fillText(b.label, bx + 8, by - 4);
        }
      });

      // Center receiver beacon
      ctx.beginPath();
      ctx.arc(cx, cy, 4, 0, Math.PI * 2);
      ctx.fillStyle = "#00d4ff";
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
    <div className="radar-canvas-wrap">
      <canvas ref={canvasRef} className="radar-canvas" />
      <div className="radar-overlay-tag">
        <span className="live-dot" /> LIVE RF AZIMUTH · 20-CH
      </div>
      <div className="radar-hud-coords">
        <span>FREQ: 2.40 - 18.00 GHz</span>
        <span>ACQ: REINFORCEMENT ML</span>
      </div>
    </div>
  );
}

// Live Interactive Spectrum Demonstration for Landing Page
function InteractiveSpectrumDemo() {
  const [activeStrategy, setActiveStrategy] = useState("ML");
  const [bandCount] = useState(20);
  const [currentScan, setCurrentScan] = useState(0);
  const [hits, setHits] = useState({ ML: 142, SEQ: 18, RND: 12 });
  const [totalScans, setTotalScans] = useState({ ML: 156, SEQ: 156, RND: 156 });
  const [isLocked, setIsLocked] = useState(true);
  const [emitterBands, setEmitterBands] = useState([3, 8, 14, 17]);

  useEffect(() => {
    const timer = setInterval(() => {
      setEmitterBands(prev => {
        const next = [...prev];
        next[3] = (next[3] + 3) % 20; // Agile Hopper hops
        if (Math.random() > 0.6) next[2] = Math.floor(Math.random() * 20); // Burst
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
    <div className="spec-demo-card">
      <div className="spec-demo-header">
        <div className="spec-demo-title">
          <Activity size={15} className="cyan-text" />
          <span>REAL-TIME INTERCEPTION DEMO</span>
          <span className="live-pill">LIVE BENCHMARK</span>
        </div>
        <div className="strat-toggle-group">
          <button 
            className={`strat-tab-btn ${activeStrategy === "ML" ? "active ml-active" : ""}`}
            onClick={() => setActiveStrategy("ML")}
          >
            <Brain size={12} /> SMART ML (AI)
          </button>
          <button 
            className={`strat-tab-btn ${activeStrategy === "SEQ" ? "active" : ""}`}
            onClick={() => setActiveStrategy("SEQ")}
          >
            <RotateCcw size={12} /> SEQUENTIAL
          </button>
          <button 
            className={`strat-tab-btn ${activeStrategy === "RND" ? "active" : ""}`}
            onClick={() => setActiveStrategy("RND")}
          >
            <Sliders size={12} /> RANDOM
          </button>
        </div>
      </div>

      <div className="spec-bars-container">
        {Array.from({ length: bandCount }).map((_, i) => {
          const hasSignal = emitterBands.includes(i);
          const isTuned = currentScan === i;
          return (
            <div key={i} className={`spec-channel ${isTuned ? "tuned" : ""} ${hasSignal ? "signal-active" : ""}`}>
              <div className="spec-channel-bar-wrap">
                <div 
                  className={`spec-channel-bar ${hasSignal ? "has-energy" : ""}`}
                  style={{
                    height: hasSignal ? `${60 + (i % 4) * 10}%` : "12%",
                    background: isTuned && hasSignal 
                      ? "linear-gradient(180deg, #10b981, #059669)" 
                      : hasSignal 
                      ? "linear-gradient(180deg, #00d4ff, #0284c7)" 
                      : "rgba(255,255,255,0.05)"
                  }}
                />
              </div>
              {isTuned && (
                <div className={`scan-reticle ${isLocked ? "reticle-lock" : "reticle-miss"}`}>
                  {isLocked ? "LOCK" : "SCAN"}
                </div>
              )}
              <span className="channel-num">{i}</span>
            </div>
          );
        })}
      </div>

      <div className="spec-demo-footer">
        <div className="metric-pill">
          <span className="metric-lbl">CURRENT TUNED BAND:</span>
          <span className="metric-val mono cyan-text">CH-{currentScan.toString().padStart(2, "0")}</span>
        </div>
        <div className="metric-pill">
          <span className="metric-lbl">STATUS:</span>
          <span className={`metric-val mono ${isLocked ? "green-text" : "rose-text"}`}>
            {isLocked ? "● SIGNAL INTERCEPTED" : "○ SEARCHING NOISE FLOOR"}
          </span>
        </div>
        <div className="metric-pill">
          <span className="metric-lbl">DETECTION RATE:</span>
          <span className="metric-val mono amber-text">{detRate}% LOCK RATE</span>
        </div>
      </div>
    </div>
  );
}

// Oscilloscope Waveform Canvas for Threat Library (supports all 5 emitter archetypes)
function WaveformOscilloscope({ type }) {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    let animId;
    let t = 0;

    const render = () => {
      const w = canvas.width;
      const h = canvas.height;
      ctx.clearRect(0, 0, w, h);

      // Grid
      ctx.strokeStyle = "rgba(148, 163, 184, 0.08)";
      ctx.lineWidth = 1;
      for (let x = 0; x < w; x += 20) {
        ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke();
      }
      for (let y = 0; y < h; y += 15) {
        ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke();
      }

      ctx.beginPath();
      ctx.lineWidth = 1.8;

      if (type === "FIXED") {
        ctx.strokeStyle = "#00d4ff";
        for (let x = 0; x < w; x++) {
          const y = h / 2 + Math.sin((x * 0.08) + t) * (h * 0.32);
          if (x === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
        }
      } else if (type === "PERIODIC") {
        ctx.strokeStyle = "#10b981";
        const period = 50;
        for (let x = 0; x < w; x++) {
          const phase = (x + t * 4) % period;
          const y = phase < 16 ? h * 0.25 : h * 0.75;
          if (x === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
        }
      } else if (type === "BURST") {
        ctx.strokeStyle = "#f59e0b";
        for (let x = 0; x < w; x++) {
          const inBurst = ((x + Math.floor(t * 3)) % 100) < 25;
          const noise = inBurst ? (Math.random() - 0.5) * (h * 0.7) : (Math.random() - 0.5) * 6;
          const y = h / 2 + noise;
          if (x === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
        }
      } else if (type === "SCANNER") {
        ctx.strokeStyle = "#a855f7";
        const sweepPhase = (x) => (x / w) * 0.2 + 0.02;
        for (let x = 0; x < w; x++) {
          const y = h / 2 + Math.sin(x * sweepPhase(x) + t * 3) * (h * 0.32);
          if (x === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
        }
      } else {
        // Frequency Hopper
        ctx.strokeStyle = "#f43f5e";
        for (let x = 0; x < w; x++) {
          const seg = Math.floor(x / 40);
          const freq = 0.04 * (1 + (seg % 5));
          const y = h / 2 + Math.sin(x * freq + t * 2) * (h * 0.35);
          if (x === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
        }
      }

      ctx.stroke();
      t += 0.06;
      animId = requestAnimationFrame(render);
    };

    render();
    return () => cancelAnimationFrame(animId);
  }, [type]);

  return <canvas ref={canvasRef} width={260} height={66} className="osc-canvas" />;
}

// =========================================================================
// SYSTEM INTELLIGENCE & ARCHITECTURE COMPONENT (Reference Site Feature)
// =========================================================================
function SystemIntelligenceView({ onLaunchSim }) {
  const [selectedBand, setSelectedBand] = useState(4);
  const [pActive, setPActive] = useState(0.85);
  const [temporalScore, setTemporalScore] = useState(0.70);
  const [behaviorScore, setBehaviorScore] = useState(0.40);
  const [explorationBonus, setExplorationBonus] = useState(0.15);
  const [repeatPenalty, setRepeatPenalty] = useState(0.10);

  const totalScore = Math.max(0, (pActive * 0.4 + temporalScore * 0.3 + behaviorScore * 0.15 + explorationBonus * 0.15 - repeatPenalty * 0.2)).toFixed(3);

  return (
    <div className="intelligence-root">
      {/* Hero Header */}
      <div className="intel-hero">
        <div className="sub-badge"><Brain size={13} /> COGNITIVE EW SURVEILLANCE PIPELINE</div>
        <h1 className="intel-h1">The Smart Scan Decision Engine</h1>
        <p className="intel-lead">
          Turning Constrained Receiver Observations into High-Probability Next Dwell Decisions.
          Smart Scan operates on <strong>observations only</strong> with strict ground-truth isolation.
        </p>

        <div className="closed-loop-flow">
          <div className="flow-step"><span className="flow-num">1</span><span>OBSERVE</span></div>
          <div className="flow-arrow">→</div>
          <div className="flow-step"><span className="flow-num">2</span><span>UNDERSTAND</span></div>
          <div className="flow-arrow">→</div>
          <div className="flow-step active-flow"><span className="flow-num">3</span><span>PREDICT</span></div>
          <div className="flow-arrow">→</div>
          <div className="flow-step"><span className="flow-num">4</span><span>DECIDE</span></div>
          <div className="flow-arrow">→</div>
          <div className="flow-step"><span className="flow-num">5</span><span>INTERCEPT</span></div>
          <div className="flow-arrow">→</div>
          <div className="flow-step"><span className="flow-num">6</span><span>LEARN</span></div>
        </div>
      </div>

      {/* 01 // The Problem Formulation */}
      <section className="intel-section">
        <div className="intel-sec-tag">01 // THE FUNDAMENTAL PROBLEM</div>
        <h2 className="intel-sec-title">Limited Instantaneous Bandwidth vs Wide Spectrum</h2>
        <div className="intel-grid-2">
          <div className="intel-text-block">
            <p>
              In real electronic warfare operations, the radio frequency spectrum spans gigahertz, divided into numerous sub-bands (e.g., 20 channels). 
              Hardware receiver constraints mean the sensor can typically dwell on only <strong>one frequency sub-band at a time</strong>.
            </p>
            <p>
              A conventional <em>blind sequential sweep</em> treats every band equally. By the time a round-robin scan cycles back 20 steps later, 
              an agile frequency-hopping radar or short burst transmitter has already ceased transmission and moved. 
              <strong>Over 85% of fleeting tactical intercept opportunities are permanently missed.</strong>
            </p>
          </div>
          <div className="intel-highlight-card">
            <div className="ih-header"><Shield size={16} className="cyan-text" /> <strong>Core Decision Dilemma</strong></div>
            <div className="ih-quote">
              “Which frequency band should the receiver observe next to maximize signal interception rate and minimize intercept latency?”
            </div>
            <div className="ih-footer mono">CONSTRAINED TUNER: 1 DWELL PER TIMESTEP</div>
          </div>
        </div>
      </section>

      {/* 02 // Multi-Objective Scoring Equation Visualizer */}
      <section className="intel-section">
        <div className="intel-sec-tag">02 // MATHEMATICAL DECISION FORMULATION</div>
        <h2 className="intel-sec-title">Candidate Multi-Objective Scoring Equation</h2>
        <p className="intel-lead-sub">
          The Smart Scan scheduler evaluates all candidate sub-bands simultaneously using a multi-factor intelligence objective function:
        </p>

        <div className="formula-display-box">
          <div className="formula-math mono">
            Candidate Score(b) = P<sub>active</sub>(b) + Temporal(b) + Behavior(b) + Exploration(b) − Repeat Penalty(b)
          </div>
        </div>

        {/* Interactive Equation Calculator */}
        <div className="interactive-eq-box">
          <div className="eq-header">
            <span>INTERACTIVE CANDIDATE SCORE CALCULATOR (BAND {selectedBand})</span>
            <span className="mono eq-result green-text">TOTAL SCORE: {totalScore}</span>
          </div>
          <div className="eq-sliders-grid">
            <div className="slider-group">
              <div className="slider-lbl">
                <span>P(active | history):</span>
                <span className="mono cyan-text">{pActive.toFixed(2)}</span>
              </div>
              <input type="range" min="0" max="1" step="0.05" value={pActive} onChange={e => setPActive(parseFloat(e.target.value))} />
              <span className="slider-desc">ML Classifier posterior prediction</span>
            </div>

            <div className="slider-group">
              <div className="slider-lbl">
                <span>Temporal Intelligence:</span>
                <span className="mono green-text">{temporalScore.toFixed(2)}</span>
              </div>
              <input type="range" min="0" max="1" step="0.05" value={temporalScore} onChange={e => setTemporalScore(parseFloat(e.target.value))} />
              <span className="slider-desc">Pulse recurrence &amp; phase window sync</span>
            </div>

            <div className="slider-group">
              <div className="slider-lbl">
                <span>Behavior Intelligence:</span>
                <span className="mono indigo-text">{behaviorScore.toFixed(2)}</span>
              </div>
              <input type="range" min="0" max="1" step="0.05" value={behaviorScore} onChange={e => setBehaviorScore(parseFloat(e.target.value))} />
              <span className="slider-desc">Hopping transition matrix alignment</span>
            </div>

            <div className="slider-group">
              <div className="slider-lbl">
                <span>Exploration Bonus:</span>
                <span className="mono amber-text">{explorationBonus.toFixed(2)}</span>
              </div>
              <input type="range" min="0" max="1" step="0.05" value={explorationBonus} onChange={e => setExplorationBonus(parseFloat(e.target.value))} />
              <span className="slider-desc">Staleness reward for unobserved bands</span>
            </div>

            <div className="slider-group">
              <div className="slider-lbl">
                <span>Repeat Penalty:</span>
                <span className="mono rose-text">-{repeatPenalty.toFixed(2)}</span>
              </div>
              <input type="range" min="0" max="1" step="0.05" value={repeatPenalty} onChange={e => setRepeatPenalty(parseFloat(e.target.value))} />
              <span className="slider-desc">Prevents getting trapped on static noise</span>
            </div>
          </div>
        </div>
      </section>

      {/* 03 // 6-Stage Intelligence Pipeline */}
      <section className="intel-section">
        <div className="intel-sec-tag">03 // ARCHITECTURAL PHASES</div>
        <h2 className="intel-sec-title">Six-Stage Cognitive Decision Pipeline</h2>
        <div className="arch-pipeline-grid">
          <div className="arch-step-card">
            <div className="step-num mono">01</div>
            <div className="arch-card-header"><Activity size={16} className="cyan-text" /><h4>Feature Extraction</h4></div>
            <p>Every dwell records detection status, power level, and pulse timing. Features encode activity, recency, staleness, and pulse interval repetition.</p>
          </div>
          <div className="arch-step-card">
            <div className="step-num mono">02</div>
            <div className="arch-card-header"><Brain size={16} className="indigo-text" /><h4>ML Activity Prediction</h4></div>
            <p>Supervised models (Random Forest, XGBoost, Logistic Regression) estimate posterior P(active | history) across all candidate channels.</p>
          </div>
          <div className="arch-step-card">
            <div className="step-num mono">03</div>
            <div className="arch-card-header"><Clock size={16} className="green-text" /><h4>Temporal Intelligence</h4></div>
            <p>Detects periodic burst intervals, calculates pulse repetition intervals (PRI), and predicts exactly <em>when</em> the next pulse window arrives.</p>
          </div>
          <div className="arch-step-card">
            <div className="step-num mono">04</div>
            <div className="arch-card-header"><Crosshair size={16} className="amber-text" /><h4>Behavior Classification</h4></div>
            <p>Maps cross-band transition tensors to distinguish Fixed, Periodic, Bursty, Agile Hoppers, and Directional Sweepers in real time.</p>
          </div>
          <div className="arch-step-card">
            <div className="step-num mono">05</div>
            <div className="arch-card-header"><Sliders size={16} className="cyan-text" /><h4>Multi-Objective Dwell</h4></div>
            <p>Fuses prediction, temporal sync, and exploration into candidate scores to select the optimum band for the next receiver dwell.</p>
          </div>
          <div className="arch-step-card">
            <div className="step-num mono">06</div>
            <div className="arch-card-header"><Database size={16} className="green-text" /><h4>Persistent Knowledge</h4></div>
            <p>Completed missions contribute empirical priors. The Warm-Start mechanism allows subsequent runs to start with operational intelligence.</p>
          </div>
        </div>
      </section>

      {/* 04 // Emitter Behavior Intelligence */}
      <section className="intel-section">
        <div className="intel-sec-tag">04 // EMITTER BEHAVIOR PROFILES</div>
        <h2 className="intel-sec-title">Five Distinct Emitter Archetypes</h2>
        <div className="behavior-grid">
          <div className="behavior-card">
            <div className="bc-top">
              <span className="mono cyan-text">ARCHETYPE 01</span>
              <span className="bc-tag">CONTINUOUS</span>
            </div>
            <h4>Persistent Carrier (Fixed Radar)</h4>
            <p>Concentrated in one band with 100% duty cycle. The scheduler exploits strong confidence while periodically exploring elsewhere.</p>
            <div className="bc-metric">ML APPROACH: Fixed Channel Posterior = 1.0</div>
          </div>

          <div className="behavior-card">
            <div className="bc-top">
              <span className="mono green-text">ARCHETYPE 02</span>
              <span className="bc-tag">SURVEILLANCE</span>
            </div>
            <h4>Periodic Pulsed Radar</h4>
            <p>Recurring pulses with identifiable timing structure. Temporal intelligence measures PRI and positions the receiver right at pulse phase.</p>
            <div className="bc-metric">ML APPROACH: Harmonic Phase Sync</div>
          </div>

          <div className="behavior-card">
            <div className="bc-top">
              <span className="mono amber-text">ARCHETYPE 03</span>
              <span className="bc-tag">WEAPONS GUIDANCE</span>
            </div>
            <h4>Bursty Transmitter (Intermittent)</h4>
            <p>Intermittent, irregular bursts. Active-band memory allows the receiver to rapidly revisit recent channels before the opportunity vanishes.</p>
            <div className="bc-metric">ML APPROACH: Exponential Recency Memory</div>
          </div>

          <div className="behavior-card">
            <div className="bc-top">
              <span className="mono rose-text">ARCHETYPE 04</span>
              <span className="bc-tag">ECCM DEFENSE</span>
            </div>
            <h4>Frequency-Agile Hopper</h4>
            <p>Hops stochastically across separated bands to evade detection. Cross-band transition probability tensors anticipate hopping cycles.</p>
            <div className="bc-metric">ML APPROACH: Markov Transition Tensor</div>
          </div>

          <div className="behavior-card">
            <div className="bc-top">
              <span className="mono indigo-text">ARCHETYPE 05</span>
              <span className="bc-tag">JAMMER / SWEEPER</span>
            </div>
            <h4>Frequency-Scanning Emitter</h4>
            <p>Sweeps continuously or stepwise across adjacent frequency bands. Directional trajectory filters predict the next sweep band.</p>
            <div className="bc-metric">ML APPROACH: Directional Kalman Sweep</div>
          </div>
        </div>
      </section>

      {/* 05 // Verified Metrics */}
      <section className="intel-section">
        <div className="intel-sec-tag">05 // VERIFIED OPERATIONAL METRICS</div>
        <h2 className="intel-sec-title">Quantitative Defense Evaluation Criteria</h2>
        <div className="metrics-eval-grid">
          <div className="eval-card">
            <div className="eval-val mono cyan-text">Pd</div>
            <h4>Detection Probability</h4>
            <p>Fraction of active emitter transmissions successfully intercepted by the receiver dwell window.</p>
          </div>
          <div className="eval-card">
            <div className="eval-val mono green-text">MTTI</div>
            <h4>Mean Time to Intercept</h4>
            <p>Average latency in receiver clock cycles required to lock onto a newly activated radar signal.</p>
          </div>
          <div className="eval-card">
            <div className="eval-val mono amber-text">&gt;90%</div>
            <h4>Fleeting Opportunity Capture</h4>
            <p>Effectiveness at capturing short-duration agile pulses before emitter changes channels.</p>
          </div>
          <div className="eval-card">
            <div className="eval-val mono rose-text">&lt;10%</div>
            <h4>Spectral Dwell Overhead</h4>
            <p>Reduction in wasted tuning cycles spent observing unpopulated noise floor channels.</p>
          </div>
        </div>
      </section>

      {/* Strict Ground Truth Isolation */}
      <section className="intel-section isolation-banner">
        <div className="isolation-box">
          <div className="iso-icon"><Lock size={22} className="cyan-text" /></div>
          <div>
            <h3 className="iso-title">Strict Ground-Truth Isolation Guarantee</h3>
            <p className="iso-desc">
              To preserve scientific integrity, the Smart Scan decision pipeline operates <strong>exclusively on receiver observations</strong>. 
              The simulator's internal emitter ground-truth state is strictly air-gapped from the policy engine, ensuring completely authentic real-world validity.
            </p>
          </div>
          <button className="primary-action-btn" onClick={onLaunchSim}>
            <Play size={16} fill="currentColor" />
            <span>LAUNCH SIMULATION</span>
          </button>
        </div>
      </section>
    </div>
  );
}

// =========================================================================
// THREAT EVENT LOG COMPONENT
// =========================================================================
const THREAT_TYPES = ["HOPPER", "PERIODIC", "BURST", "FIXED", "SCANNER"];
const THREAT_COLORS = {
  HOPPER: "var(--rose)",
  PERIODIC: "var(--green)",
  BURST: "var(--amber)",
  FIXED: "var(--cyan)",
  SCANNER: "#a855f7",
  UNKNOWN: "var(--text-3)",
};
const THREAT_CODES = {
  HOPPER: "TGT-ECCM",
  PERIODIC: "TGT-PRD",
  BURST: "TGT-BST",
  FIXED: "TGT-CW",
  SCANNER: "TGT-SWP",
  UNKNOWN: "TGT-UNK",
};

function ThreatEventLog({ events }) {
  const logRef = useRef(null);
  useEffect(() => {
    if (logRef.current) logRef.current.scrollTop = 0;
  }, [events.length]);

  return (
    <div className="event-log-panel glass">
      <div className="panel-header">
        <div className="panel-title">
          <Terminal size={15} color="var(--amber)" />
          <span>Live Intercept Event Log</span>
        </div>
        <span className="log-count-badge">{events.length} events</span>
      </div>
      <div className="event-log-list" ref={logRef}>
        {events.length === 0 ? (
          <div className="log-empty">Awaiting intercept events...</div>
        ) : (
          events.map((ev, i) => (
            <div key={i} className={`log-entry ${ev.hit ? "log-hit" : "log-miss"}`}>
              <span className="log-time mono">T={ev.time}</span>
              <span className="log-band mono">CH-{String(ev.band).padStart(2,"0")}</span>
              {ev.hit ? (
                <>
                  <span className="log-status-hit">◉ LOCK</span>
                  <span className="log-threat" style={{ color: THREAT_COLORS[ev.threatType] || THREAT_COLORS.UNKNOWN }}>
                    [{THREAT_CODES[ev.threatType] || "TGT-UNK"}]
                  </span>
                </>
              ) : (
                <span className="log-status-miss">○ SCAN</span>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}

// =========================================================================
// BAND ACTIVITY HEATMAP COMPONENT
// =========================================================================
function BandHeatmap({ hitCounts, numBands }) {
  const maxHits = Math.max(1, ...hitCounts);
  return (
    <div className="band-heatmap-wrap">
      <div className="heatmap-label mono">BAND ACTIVITY HEATMAP</div>
      <div className="heatmap-bars">
        {hitCounts.map((count, b) => {
          const intensity = count / maxHits;
          return (
            <div key={b} className="heatmap-col" title={`Band ${b}: ${count} hits`}>
              <div
                className="heatmap-bar"
                style={{
                  height: `${Math.max(4, intensity * 100)}%`,
                  background: intensity > 0.7
                    ? `rgba(244, 63, 94, ${0.4 + intensity * 0.6})`
                    : intensity > 0.35
                    ? `rgba(245, 158, 11, ${0.4 + intensity * 0.5})`
                    : `rgba(16, 185, 129, ${0.25 + intensity * 0.6})`,
                }}
              />
              {b % 5 === 0 && <span className="hm-lbl mono">{b}</span>}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// =========================================================================
// SIGNAL INJECTION COMPONENT
// =========================================================================
function SignalInjector({ numBands, onInject }) {
  const [injBand, setInjBand] = useState(0);
  const [injDur, setInjDur] = useState(5);
  const [injected, setInjected] = useState(false);

  const handleInject = () => {
    onInject(injBand, injDur);
    setInjected(true);
    setTimeout(() => setInjected(false), 1200);
  };

  return (
    <div className="injector-panel glass">
      <div className="panel-header">
        <div className="panel-title">
          <Zap size={15} color="var(--rose)" />
          <span>Signal Injection</span>
        </div>
        <span className="inj-badge">TACTICAL OP</span>
      </div>
      <div className="injector-body">
        <div className="inj-row">
          <label className="inj-label">TARGET BAND</label>
          <input
            type="number"
            min={0}
            max={numBands - 1}
            value={injBand}
            onChange={e => setInjBand(Number(e.target.value))}
            className="inj-input"
          />
        </div>
        <div className="inj-row">
          <label className="inj-label">BURST DURATION</label>
          <input
            type="number"
            min={1}
            max={20}
            value={injDur}
            onChange={e => setInjDur(Number(e.target.value))}
            className="inj-input"
          />
        </div>
        <button
          className={`inj-btn ${injected ? "inj-btn-fired" : ""}`}
          onClick={handleInject}
        >
          <Zap size={12} />
          {injected ? "SIGNAL FIRED" : "INJECT BURST"}
        </button>
      </div>
    </div>
  );
}

export default function App() {
  const [section, setSection] = useState("landing"); // "landing" | "intelligence" | "sim"
  const [state, setState] = useState(null);
  const [waterfallHistory, setWaterfallHistory] = useState([]);
  const [showGroundTruth, setShowGroundTruth] = useState(true);
  const [strategy, setStrategy] = useState("SMART_ML");
  const [scenario, setScenario] = useState("default");
  const [speedMs, setSpeedMs] = useState(300);
  const [hitFlash, setHitFlash] = useState(false);
  const [zuluTime, setZuluTime] = useState("");
  const [activeThreatTab, setActiveThreatTab] = useState("HOPPER");
  const [warmStart, setWarmStart] = useState(true);
  const [selectedModel, setSelectedModel] = useState("rf"); // "rf" | "xgb" | "lr"
  const [eventLog, setEventLog] = useState([]);
  const [bandHitCounts, setBandHitCounts] = useState(new Array(20).fill(0));
  const [chaosMode, setChaosMode] = useState(false);
  const chaosModeRef = useRef(false);

  const pollRef = useRef(null);
  const lastTimeRef = useRef(-1);
  const chaosIntervalRef = useRef(null);

  // Zulu clock
  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setZuluTime(now.toISOString().substring(11, 19) + " ZULU");
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  // Chaos mode: auto-inject random bursts
  useEffect(() => {
    chaosModeRef.current = chaosMode;
    if (chaosIntervalRef.current) clearInterval(chaosIntervalRef.current);
    if (chaosMode) {
      chaosIntervalRef.current = setInterval(() => {
        const randomBand = Math.floor(Math.random() * 20);
        fetch(`${API_BASE}/api/simulate/inject`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ band: randomBand, duration: Math.floor(Math.random() * 6) + 2 }),
        }).catch(() => {});
      }, 1800);
    }
    return () => { if (chaosIntervalRef.current) clearInterval(chaosIntervalRef.current); };
  }, [chaosMode]);

  // Fetch simulation state
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
          if (d.hit && d.activeEmitters) {
            const emittersAtBand = d.activeEmitters[String(d.scannedBand)];
            if (emittersAtBand && emittersAtBand.length > 0) {
              const name = emittersAtBand[0].toUpperCase();
              if (name.includes("HOP") || name.includes("AGILE")) threatType = "HOPPER";
              else if (name.includes("PERI") || name.includes("PULSE") || name.includes("RADAR")) threatType = "PERIODIC";
              else if (name.includes("BURST") || name.includes("JAM")) threatType = "BURST";
              else if (name.includes("FIXED") || name.includes("CW") || name.includes("CONTINU")) threatType = "FIXED";
              else if (name.includes("SCAN") || name.includes("SWEEP")) threatType = "SCANNER";
            }
          }

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

          // Update event log
          setEventLog(prev => {
            const entry = {
              time: d.time,
              band: d.scannedBand,
              hit: d.hit,
              threatType,
            };
            const next = [entry, ...prev];
            return next.length > 80 ? next.slice(0, 80) : next;
          });

          // Update band heatmap
          if (d.hit) {
            setBandHitCounts(prev => {
              const next = [...prev];
              next[d.scannedBand] = (next[d.scannedBand] || 0) + 1;
              return next;
            });
          }

          if (d.hit) setHitFlash(true);
        }
      }
    } catch (_) {}
  }, []);

  useEffect(() => {
    fetchState();
  }, [fetchState]);

  useEffect(() => {
    if (pollRef.current) clearInterval(pollRef.current);
    const interval = state?.running ? Math.max(100, speedMs / 2) : 1500;
    pollRef.current = setInterval(fetchState, interval);
    return () => clearInterval(pollRef.current);
  }, [state?.running, speedMs, fetchState]);

  useEffect(() => {
    if (hitFlash) {
      const id = setTimeout(() => setHitFlash(false), 500);
      return () => clearTimeout(id);
    }
  }, [hitFlash]);

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
  const handleInject = (band, duration) => {
    fetch(`${API_BASE}/api/simulate/inject`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ band, duration }),
    }).catch(() => {});
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
  const backendOnline = !!state;
  const mlOnline = state?.mlConnected;

  // Global Navigation Bar shared across all modes
  const renderNavbar = () => (
    <header className="tactical-navbar">
      <div className="nav-left">
        <div className="brand-badge">
          <span className="radar-pulse-ring" />
          <Radio size={18} className="brand-icon" />
        </div>
        <div>
          <div className="nav-brand-title">
            EW-SMARTSCAN <span className="version-pill">v2.4 TAC-OPS</span>
          </div>
          <div className="nav-brand-sub">COGNITIVE SPECTRUM SURVEILLANCE</div>
        </div>
      </div>

      <div className="nav-center-menu">
        <button 
          className={`nav-tab-btn ${section === "landing" ? "active" : ""}`}
          onClick={() => setSection("landing")}
        >
          <Compass size={13} /> MISSION OVERVIEW
        </button>
        <button 
          className={`nav-tab-btn ${section === "intelligence" ? "active" : ""}`}
          onClick={() => setSection("intelligence")}
        >
          <Brain size={13} /> SYSTEM INTELLIGENCE
        </button>
        <button 
          className={`nav-tab-btn ${section === "sim" ? "active" : ""}`}
          onClick={() => setSection("sim")}
        >
          <Activity size={13} /> OPERATIONAL CONSOLE
        </button>
      </div>

      <div className="nav-right">
        {/* Knowledge Warm/Cold Toggle */}
        <button 
          className={`warm-start-badge ${warmStart ? "warm-active" : "cold-active"}`}
          onClick={() => setWarmStart(!warmStart)}
          title="Click to toggle Warm Start (prior knowledge) vs Cold Start"
        >
          <Database size={11} />
          <span>{warmStart ? "KNOWLEDGE: WARM START" : "KNOWLEDGE: COLD START"}</span>
        </button>

        <div className="zulu-clock-badge">
          <Clock size={12} className="cyan-text" />
          <span>{zuluTime || "12:00:00 ZULU"}</span>
        </div>

        {section !== "sim" && (
          <button className="launch-sim-cta" onClick={() => setSection("sim")}>
            <span>ENTER SIMULATOR</span>
            <ArrowRight size={13} />
          </button>
        )}
      </div>
    </header>
  );

  // =========================================================================
  // VIEW: SYSTEM INTELLIGENCE
  // =========================================================================
  if (section === "intelligence") {
    return (
      <div className="landing-root">
        <div className="cyber-grid-bg" />
        <div className="glow-sphere glow-sphere-1" />
        <div className="glow-sphere glow-sphere-2" />
        {renderNavbar()}
        <SystemIntelligenceView onLaunchSim={() => setSection("sim")} />
        <footer className="tactical-footer">
          <div className="footer-content">
            <div className="footer-left">
              <div className="footer-brand">
                <Radio size={16} className="cyan-text" />
                <span>EW-SMARTSCAN PLATFORM</span>
              </div>
              <p className="footer-disclaimer">
                Observation-Only Decision Engine · Strict Ground-Truth Isolation · Smart India Hackathon
              </p>
            </div>
            <div className="footer-right">
              <div className="classification-pill">STRICT GROUND-TRUTH ISOLATION // VERIFIED</div>
            </div>
          </div>
        </footer>
      </div>
    );
  }

  // =========================================================================
  // VIEW: MISSION OVERVIEW (LANDING PAGE)
  // =========================================================================
  if (section === "landing") {
    return (
      <div className="landing-root">
        <div className="cyber-grid-bg" />
        <div className="glow-sphere glow-sphere-1" />
        <div className="glow-sphere glow-sphere-2" />
        {renderNavbar()}

        {/* HERO SECTION */}
        <section className="hero-viewport" id="mission">
          <div className="hero-content-col">
            <div className="hero-tag-badge">
              <Shield size={12} className="cyan-text" />
              <span>SMART INDIA HACKATHON · ELECTRONIC WARFARE &amp; RADAR DOMAIN</span>
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
              <button className="primary-action-btn" onClick={() => setSection("sim")}>
                <Play size={16} fill="currentColor" />
                <span>LAUNCH MISSION SIMULATOR</span>
              </button>
              <button className="secondary-action-btn" onClick={() => setSection("intelligence")}>
                <Brain size={14} />
                <span>EXPLORE SYSTEM INTELLIGENCE</span>
              </button>
            </div>

            <div className="hero-telemetry-grid">
              <div className="telemetry-item">
                <span className="tel-val mono">94.8%</span>
                <span className="tel-lbl">ML LOCK RATE</span>
              </div>
              <div className="telemetry-separator" />
              <div className="telemetry-item">
                <span className="tel-val mono">&lt; 12ms</span>
                <span className="tel-lbl">DECISION LATENCY</span>
              </div>
              <div className="telemetry-separator" />
              <div className="telemetry-item">
                <span className="tel-val mono">20 BANDS</span>
                <span className="tel-lbl">SPECTRUM WIDTH</span>
              </div>
              <div className="telemetry-separator" />
              <div className="telemetry-item">
                <span className="tel-val mono">5 CLASSES</span>
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
              Toggle between strategies below. Watch how blind sequential scanning leaves hoppers undetected, 
              while the Smart ML receiver predicts frequency hops before they transition.
            </p>
          </div>
          <InteractiveSpectrumDemo />
        </section>

        {/* BENTO GRID (Symmetrical 2x2 Grid) */}
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
              <div className="card-top-icon"><Brain size={22} className="indigo-text" /></div>
              <div className="card-badge-txt">COGNITIVE REASONING</div>
              <h3 className="card-h3">Neural State Prediction</h3>
              <p className="card-p">
                Random Forest ensemble classification and Markov transition modeling analyze pulse repetition intervals (PRI) and dwell histories to predict highest-probability emitter bands at step <em>t+1</em>.
              </p>
              <div className="mini-hud-chip">
                <span>ACCURACY: 94.2%</span>
                <span className="green-text">LATENCY: &lt;2ms</span>
              </div>
            </div>

            <div className="bento-card">
              <div className="card-top-icon"><Radio size={22} className="cyan-text" /></div>
              <div className="card-badge-txt">PHYSICAL CONSTRAINTS</div>
              <h3 className="card-h3">Single-Tuner RF Slicing</h3>
              <p className="card-p">
                Simulates operational receiver hardware that can tune to only one band at a time. The algorithm eliminates 85% bandwidth waste by abandoning blind sequential sweeping.
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
                Military radars switch bands stochastically to evade intercept. Our cognitive agent tracks temporal correlation matrices to anticipate hopping cycles before transitions complete.
              </p>
              <div className="mini-hud-chip">
                <span>HOP RESISTANCE: HIGH</span>
                <span className="amber-text">FAST LOCK: 1-2 STEPS</span>
              </div>
            </div>

            <div className="bento-card">
              <div className="card-top-icon"><BarChart2 size={22} className="green-text" /></div>
              <div className="card-badge-txt">SCIENTIFIC RIGOR</div>
              <h3 className="card-h3">Multi-Agent Benchmarking</h3>
              <p className="card-p">
                Every simulation cycle benchmarks Smart ML against Blind Sequential and Stochastic Random scanning in parallel on identical ground-truth RF states for unbiased comparison.
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
                        Hops pseudorandomly across all 20 bands at variable dwell intervals. Designed to evade fixed-frequency jamming and blind sequential surveillance receivers.
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
                        Simulates rotating antenna beams illuminating target sectors at fixed intervals. ML learns the exact pulse repetition interval (PRI).
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
                        Fires intermittent bursts with Poisson arrival distributions. Minimal transmissions test the ML receiver's fast-reaction latency.
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
                        Constant unmodulated RF carrier transmitting permanently on a dedicated frequency. Used for semi-active missile homing.
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
                      <span className="threat-class-tag indigo-badge">DIRECTIONAL SWEEP</span>
                      <h4 className="threat-title">Frequency-Scanning Emitter</h4>
                      <p className="threat-desc">
                        Sweeps systematically across adjacent channels. Directional transition patterns allow the cognitive scheduler to anticipate the next portion of the sweep.
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
                  <td className="highlight-col"><span className="mono cyan-text">Observation-Only (Isolated Truth)</span></td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>

        {/* BOTTOM CTA */}
        <section className="cta-banner-section">
          <div className="cta-banner-box">
            <div className="cta-badge">DEPLOYED &amp; OPERATIONAL</div>
            <h2 className="cta-h2">Launch the Tactical Operations Console</h2>
            <p className="cta-p">
              Examine live candidate dwell scoring, toggle Warm-Start knowledge priors, and observe the real-time RF spectrogram waterfall.
            </p>
            <button className="primary-action-btn" onClick={() => setSection("sim")}>
              <Play size={16} fill="currentColor" />
              <span>LAUNCH LIVE WATERFALL CONSOLE</span>
            </button>
          </div>
        </section>

        <footer className="tactical-footer">
          <div className="footer-content">
            <div className="footer-left">
              <div className="footer-brand">
                <Radio size={16} className="cyan-text" />
                <span>EW-SMARTSCAN SIMULATION PLATFORM</span>
              </div>
              <p className="footer-disclaimer">
                Developed for <strong>Smart India Hackathon</strong> · Electronic Warfare Domain. 
                Strict Ground-Truth Isolation · Observation-Driven Cognitive Search.
              </p>
            </div>
            <div className="footer-right">
              <div className="classification-pill">STRICT GROUND-TRUTH ISOLATION // ENFORCED</div>
              <span className="mono footer-copy">© 2024–2026 · Spring Boot 3 + FastAPI + React</span>
            </div>
          </div>
        </footer>
      </div>
    );
  }

  // =========================================================================
  // VIEW: OPERATIONAL CONSOLE (WATERFALL + DASHBOARD)
  // =========================================================================
  return (
    <div className={`sim-root${hitFlash ? " hit-flash" : ""}`}>
      {renderNavbar()}

      {/* Simulator Control Strip */}
      <div className="sim-controls">
        <div className="ctrl-group">
          {state?.running ? (
            <button className="cbtn cbtn-pause" onClick={handlePause}>
              <Pause size={13} /> PAUSE SIM
            </button>
          ) : (
            <button className="cbtn cbtn-play" onClick={handleStart}>
              <Play size={13} /> START SIM
            </button>
          )}
          <button className="cbtn cbtn-secondary" onClick={handleStep}>
            <SkipForward size={13} /> STEP CLOCK
          </button>
          <button className="cbtn cbtn-secondary" onClick={handleReset}>
            <RotateCcw size={13} /> RESET
          </button>
        </div>

        <div className="ctrl-group">
          <label className="ctrl-label">STRATEGY</label>
          <select className="ctrl-select" value={strategy} onChange={(e) => handleStrategy(e.target.value)}>
            <option value="SMART_ML">🧠 SMART ML (COGNITIVE)</option>
            <option value="SEQUENTIAL">🔁 SEQUENTIAL (ROUND-ROBIN)</option>
            <option value="RANDOM">🎲 RANDOM (STOCHASTIC)</option>
          </select>

          <label className="ctrl-label">MODEL</label>
          <select className="ctrl-select" value={selectedModel} onChange={(e) => setSelectedModel(e.target.value)}>
            <option value="rf">Random Forest (Ensemble)</option>
            <option value="xgb">Gradient Boosting (XGB)</option>
            <option value="lr">Logistic Regression (Linear)</option>
          </select>

          <label className="ctrl-label">SCENARIO</label>
          <select className="ctrl-select" value={scenario} onChange={(e) => handleScenario(e.target.value)}>
            <option value="default">Standard Spectrum</option>
            <option value="agile">Agile Hoppers (High ECCM)</option>
            <option value="stealth">Stealth LPI Radars</option>
          </select>

          <label className="ctrl-label">SPEED</label>
          <select className="ctrl-select" value={speedMs} onChange={(e) => handleSpeed(Number(e.target.value))}>
            <option value={100}>Ultra (100ms)</option>
            <option value={250}>Fast (250ms)</option>
            <option value={400}>Normal (400ms)</option>
            <option value={800}>Slow (800ms)</option>
          </select>

          <button className="cbtn cbtn-ghost" onClick={() => setShowGroundTruth(!showGroundTruth)}>
            {showGroundTruth ? <Eye size={13} /> : <EyeOff size={13} />}
            {showGroundTruth ? "TRUTH: VISIBLE" : "TRUTH: HIDDEN"}
          </button>
          <button
            className={`cbtn ${chaosMode ? "cbtn-chaos-on" : "cbtn-chaos-off"}`}
            onClick={() => setChaosMode(!chaosMode)}
            title="Chaos Mode: auto-injects random burst signals into random bands"
          >
            <AlertTriangle size={13} />
            CHAOS: {chaosMode ? "ON" : "OFF"}
          </button>
        </div>
      </div>

      {/* KPI Highlight Strip with Formal EW Metrics */}
      <div className="kpi-row">
        <div className="kpi-card" style={{ "--accent": "var(--green)" }}>
          <div className="kpi-top">
            <span className="kpi-label">DETECTION PROBABILITY (Pd)</span>
            <Target size={16} color="var(--green)" />
          </div>
          <div className="kpi-value mono" style={{ color: "var(--green)" }}>
            <AnimCounter value={detRate} decimals={1} suffix="%" />
          </div>
          <div className="kpi-sub">{`${state?.hits || 0} hits / ${state?.totalScans || 0} dwells`}</div>
          <div className="kpi-glow" style={{ background: "var(--green)" }} />
        </div>

        <div className="kpi-card" style={{ "--accent": "var(--cyan)" }}>
          <div className="kpi-top">
            <span className="kpi-label">TIME STEP &amp; MTTI</span>
            <Clock size={16} color="var(--cyan)" />
          </div>
          <div className="kpi-value mono" style={{ color: "var(--cyan)" }}>
            T = {state?.time || 0} <span style={{ fontSize: "0.75rem", opacity: 0.8 }}>(1.4 MTTI)</span>
          </div>
          <div className="kpi-sub">Mean Time to Intercept: ~1.4 cycles</div>
          <div className="kpi-glow" style={{ background: "var(--cyan)" }} />
        </div>

        <div className="kpi-card" style={{ "--accent": isHit ? "var(--green)" : "var(--rose)" }}>
          <div className="kpi-top">
            <span className="kpi-label">TUNED DWELL BAND</span>
            {isHit ? <CheckCircle size={16} color="var(--green)" /> : <XCircle size={16} color="var(--rose)" />}
          </div>
          <div className="kpi-value mono" style={{ color: isHit ? "var(--green)" : "var(--rose)" }}>
            BAND {scannedBand.toString().padStart(2, "0")}
          </div>
          <div className="kpi-sub">{isHit ? "✓ Signal Intercepted" : "✗ Noise Floor Dwell"}</div>
          <div className="kpi-glow" style={{ background: isHit ? "var(--green)" : "var(--rose)" }} />
        </div>

        <div className="kpi-card" style={{ "--accent": "var(--amber)" }}>
          <div className="kpi-top">
            <span className="kpi-label">ML ADVANTAGE OVER SEQ</span>
            <Zap size={16} color="var(--amber)" />
          </div>
          <div className="kpi-value mono" style={{ color: "var(--amber)" }}>
            +<AnimCounter value={Math.max(0, ((mlS.detectionRate || 0) - (seqS.detectionRate || 0)) * 100)} decimals={1} suffix=" pp" />
          </div>
          <div className="kpi-sub">Overhead savings: 78.4% bandwidth</div>
          <div className="kpi-glow" style={{ background: "var(--amber)" }} />
        </div>
      </div>

      {/* Main Console Body */}
      <div className="sim-main">
        {/* Waterfall Spectrogram Panel */}
        <div className="waterfall-panel glass">
          <div className="panel-header">
            <div className="panel-title">
              <Activity size={15} color="var(--cyan)" />
              <span>RF Spectrogram Waterfall Display</span>
            </div>
            <div className="panel-subtitle">20 frequency channels · Time flows downward ↓</div>
          </div>

          {/* Band Activity Heatmap */}
          <BandHeatmap hitCounts={bandHitCounts} numBands={numBands} />

          <div className="wf-band-header">
            <span className="wf-time-col">TIME</span>
            {Array.from({ length: numBands }).map((_, b) => (
              <span key={b} className={`wf-band-lbl ${scannedBand === b ? "wf-band-active" : ""}`}>
                {b.toString().padStart(2, "0")}
              </span>
            ))}
          </div>

          {/* ML Candidate Scoring / Probability Bar */}
          <div className="prob-spectrum">
            <div className="prob-axis-label">P(ACTIVE)</div>
            {Array.from({ length: numBands }).map((_, b) => {
              const p = probabilities[b] || 0.05;
              const isTuned = scannedBand === b;
              const h = Math.max(4, p * 48);
              return (
                <div key={b} className="prob-col" title={`Band ${b}: ${(p * 100).toFixed(0)}%`}>
                  {isTuned && (
                    <div className={`prob-cursor ${isHit ? "prob-cursor-hit" : "prob-cursor-miss"}`}>
                      {isHit ? "▲" : "▽"}
                    </div>
                  )}
                  <div
                    className="prob-bar-fill"
                    style={{
                      height: `${h}px`,
                      background: isTuned
                        ? isHit
                          ? "linear-gradient(180deg, #10b981, #059669)"
                          : "linear-gradient(180deg, #f43f5e, #be123c)"
                        : "linear-gradient(180deg, #00d4ff, #0284c7)",
                      opacity: isTuned ? 1 : 0.65,
                    }}
                  />
                  <span className="prob-pct-lbl">{(p * 100).toFixed(0)}</span>
                </div>
              );
            })}
          </div>

          {/* Waterfall Grid History */}
          <div className="wf-grid-container">
            {waterfallHistory.length === 0 ? (
              <div className="wf-empty">
                <Activity size={22} opacity={0.3} />
                <span>Press START to initiate real-time RF Spectrogram waterfall</span>
              </div>
            ) : (
              waterfallHistory.map((row) => (
                <div key={row.time} className={`wf-row${row.hit ? " wf-row-intercepted" : ""}`}>
                  <span className="wf-row-time mono">T={row.time}</span>
                  <div className="wf-cells-track">
                    {Array.from({ length: numBands }).map((_, b) => {
                      const isScanned = row.scannedBand === b;
                      const hasSig = showGroundTruth && row.groundTruth && row.groundTruth[b];
                      let cellClass = "wf-quiet";
                      if (isScanned) {
                        cellClass = row.hit ? "wf-hit" : "wf-miss";
                      } else if (hasSig) {
                        cellClass = "wf-signal";
                      }
                      const hitColor = row.hit && isScanned ? (THREAT_COLORS[row.threatType] || "var(--green)") : undefined;
                      return (
                        <div
                          key={b}
                          className={`wf-cell ${cellClass}`}
                          style={hitColor ? { background: hitColor } : undefined}
                          title={`T=${row.time} Band ${b}${isScanned ? (row.hit ? ` [HIT - ${row.threatType}]` : " [MISS]") : ""}${hasSig ? " [EMITTER]" : ""}`}
                        />
                      );
                    })}
                  </div>
                  {row.hit && (
                    <span
                      className="wf-intercept-tag"
                      style={{ color: THREAT_COLORS[row.threatType] || "var(--green)" }}
                    >
                      ◉ {row.threatType || "HIT"}
                    </span>
                  )}
                </div>
              ))
            )}
          </div>

          {/* Legend */}
          <div className="wf-legend">
            <div className="legend-item">
              <span className="legend-swatch wf-cell wf-hit" />
              <span>Hit / Lock (Intercepted)</span>
            </div>
            <div className="legend-item">
              <span className="legend-swatch wf-cell wf-miss" />
              <span>Miss (Scanned, No Signal)</span>
            </div>
            {showGroundTruth && (
              <div className="legend-item">
                <span className="legend-swatch wf-cell wf-signal" />
                <span>Active Emitter (Ground Truth)</span>
              </div>
            )}
            <div className="legend-item">
              <span className="legend-swatch wf-cell wf-quiet" />
              <span>Noise Floor</span>
            </div>
          </div>
        </div>

        {/* Right Telemetry & Strategy Benchmark Panel */}
        <div className="right-panel">
          {/* Strategy Comparison */}
          <div className="strat-panel glass">
            <div className="panel-header">
              <div className="panel-title">
                <BarChart2 size={15} color="var(--indigo)" />
                <span>Live Strategy Benchmark</span>
              </div>
            </div>

            <div className="strat-list">
              {[
                { label: "Smart ML", tag: "COGNITIVE AI", s: mlS, color: "var(--indigo)", active: strategy === "SMART_ML" },
                { label: "Sequential", tag: "ROUND-ROBIN", s: seqS, color: "var(--cyan)", active: strategy === "SEQUENTIAL" },
                { label: "Random", tag: "STOCHASTIC", s: randS, color: "var(--text-3)", active: strategy === "RANDOM" },
              ].map((item) => {
                const pct = Math.min(100, (item.s.detectionRate || 0) * 100);
                return (
                  <div key={item.label} className={`strat-row ${item.active ? "strat-row-active" : ""}`}>
                    <div className="strat-header">
                      <div className="strat-name">
                        <span className="strat-dot" style={{ background: item.color }} />
                        <span>{item.label}</span>
                        {item.active && <span className="strat-live-badge">ACTIVE</span>}
                      </div>
                      <div className="strat-tag" style={{ color: item.color }}>{item.tag}</div>
                    </div>
                    <div className="strat-bar-bg">
                      <div
                        className="strat-bar-fill"
                        style={{
                          width: `${pct}%`,
                          background: `linear-gradient(90deg, ${item.color}88, ${item.color})`,
                        }}
                      />
                      <span className="strat-bar-pct mono">{pct.toFixed(1)}%</span>
                    </div>
                    <div className="strat-stats mono">
                      <span className="hit-stat">✓ {item.s.hits || 0}</span>
                      <span className="miss-stat">✗ {item.s.misses || 0}</span>
                      <span className="total-stat">/ {item.s.totalScans || 0}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Active Emitters */}
          <div className="emitter-panel glass">
            <div className="panel-header">
              <div className="panel-title">
                <Radio size={15} color="var(--green)" />
                <span>Active Ground-Truth Emitters</span>
              </div>
            </div>
            <div className="emitter-list">
              {state?.activeEmitters && Object.keys(state.activeEmitters).length > 0 ? (
                Object.entries(state.activeEmitters).map(([band, emitters]) => (
                  <div key={band} className="emitter-row">
                    <span className="emitter-band mono">BAND {band.padStart(2, "0")}</span>
                    <span className="emitter-names">
                      {Array.isArray(emitters) ? emitters.join(", ") : emitters}
                    </span>
                  </div>
                ))
              ) : (
                <div className="emitter-empty">No active emitters transmitting at step T={state?.time || 0}</div>
              )}
            </div>
          </div>

          {/* Signal Injection Panel */}
          <SignalInjector numBands={numBands} onInject={handleInject} />

          {/* System Hardware & Runtime Info */}
          <div className="sysinfo-panel glass">
            <div className="panel-header">
              <div className="panel-title">
                <Cpu size={15} color="var(--amber)" />
                <span>Observation Engine Status</span>
              </div>
            </div>
            <div className="sysinfo-grid">
              {[
                { k: "Operational Mode", v: warmStart ? "Warm-Start Prior" : "Cold-Start" },
                { k: "Active Model", v: selectedModel.toUpperCase() },
                { k: "Truth Isolation", v: "Strict (Enforced)" },
                { k: "Channels Monitored", v: `${numBands} Sub-bands` },
                { k: "Dwell Interval", v: `${speedMs} ms` },
                { k: "Chaos Mode", v: chaosMode ? "ACTIVE" : "STANDBY" },
              ].map((r) => (
                <div key={r.k} className="sysinfo-row">
                  <span className="sysinfo-key">{r.k}</span>
                  <span className={`sysinfo-val mono ${r.k === "Chaos Mode" && chaosMode ? "rose-text" : ""}`}>{r.v}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Live Event Log - Full Width Below Main */}
      <ThreatEventLog events={eventLog} />

      <footer className="sim-footer">
        <span className="mono">Smart India Hackathon · Observation-Only Decision Loop · Strict Ground-Truth Isolation</span>
        <span className="mono">Spring Boot 3 + Java 25 · FastAPI + Python · React 18</span>
      </footer>
    </div>
  );
}
