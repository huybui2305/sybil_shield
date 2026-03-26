"use client";

import { useState, useEffect, useRef } from "react";
import {
  ShieldAlert, ShieldCheck, Activity, Terminal,
  ExternalLink, Zap, BrainCircuit, Waves, Eye,
} from "lucide-react";
import { motion, AnimatePresence, useMotionValue, useSpring, useTransform } from "framer-motion";

interface ScanResult {
  wallet: string;
  metrics: {
    tx_count: number;
    age_days: number;
    eth_balance: number;
    distinct_contracts: number;
    has_tornado_cash_interaction: boolean;
    is_suspicious_pattern: boolean;
  };
  analysis: {
    sybil_probability: number;
    risk_tier: string;
    summary: string;
    flags: string[];
  };
  explorer_url: string;
}

const loadingTexts = [
  "Initializing TEE Enclave...",
  "Fetching on-chain interaction graph...",
  "Extracting node adjacencies...",
  "Evaluating heuristic risk models...",
  "Validating cryptographic signature...",
  "Finalizing Sybil probability...",
];

// ─── Particle canvas ──────────────────────────────────────────────────────────
function ParticleField() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d")!;
    let animId: number;
    const resize = () => { canvas.width = window.innerWidth; canvas.height = window.innerHeight; };
    resize();
    window.addEventListener("resize", resize);
    const dots = Array.from({ length: 80 }, () => ({
      x: Math.random() * window.innerWidth, y: Math.random() * window.innerHeight,
      vx: (Math.random() - 0.5) * 0.25, vy: (Math.random() - 0.5) * 0.25,
      r: Math.random() * 1 + 0.3, o: Math.random() * 0.35 + 0.1,
    }));
    const draw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      dots.forEach(d => {
        d.x += d.vx; d.y += d.vy;
        if (d.x < 0) d.x = canvas.width; if (d.x > canvas.width) d.x = 0;
        if (d.y < 0) d.y = canvas.height; if (d.y > canvas.height) d.y = 0;
        ctx.beginPath(); ctx.arc(d.x, d.y, d.r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(99,102,241,${d.o})`; ctx.fill();
      });
      for (let i = 0; i < dots.length; i++) for (let j = i + 1; j < dots.length; j++) {
        const dx = dots[i].x - dots[j].x, dy = dots[i].y - dots[j].y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < 130) {
          ctx.beginPath(); ctx.moveTo(dots[i].x, dots[i].y); ctx.lineTo(dots[j].x, dots[j].y);
          ctx.strokeStyle = `rgba(99,102,241,${0.055 * (1 - dist / 130)})`;
          ctx.lineWidth = 0.5; ctx.stroke();
        }
      }
      animId = requestAnimationFrame(draw);
    };
    draw();
    return () => { cancelAnimationFrame(animId); window.removeEventListener("resize", resize); };
  }, []);
  return <canvas ref={canvasRef} className="fixed inset-0 pointer-events-none z-0" />;
}

// ─── Glitch text ──────────────────────────────────────────────────────────────
function GlitchText({ children, className = "" }: { children: string; className?: string }) {
  const [g, setG] = useState(false);
  useEffect(() => {
    const loop = () => setTimeout(() => { setG(true); setTimeout(() => { setG(false); loop(); }, 180); }, 3000 + Math.random() * 5000);
    loop();
  }, []);
  return (
    <span className={`relative inline-block ${className}`}>
      {children}
      {g && <>
        <span className="absolute inset-0 pointer-events-none" style={{ clipPath: "polygon(0 28%,100% 28%,100% 48%,0 48%)", transform: "translateX(-3px)", color: "#f43f5e", opacity: 0.8 }}>{children}</span>
        <span className="absolute inset-0 pointer-events-none" style={{ clipPath: "polygon(0 62%,100% 62%,100% 80%,0 80%)", transform: "translateX(3px)", color: "#34d399", opacity: 0.8 }}>{children}</span>
      </>}
    </span>
  );
}

// ─── Corner brackets ──────────────────────────────────────────────────────────
function CB({ color = "rgba(99,102,241,0.4)", s = 14 }: { color?: string; s?: number }) {
  const b = 1.5;
  const base: React.CSSProperties = { position: "absolute", width: s, height: s };
  return <>
    <span style={{ ...base, top: 0, left: 0, borderTop: `${b}px solid ${color}`, borderLeft: `${b}px solid ${color}` }} />
    <span style={{ ...base, top: 0, right: 0, borderTop: `${b}px solid ${color}`, borderRight: `${b}px solid ${color}` }} />
    <span style={{ ...base, bottom: 0, left: 0, borderBottom: `${b}px solid ${color}`, borderLeft: `${b}px solid ${color}` }} />
    <span style={{ ...base, bottom: 0, right: 0, borderBottom: `${b}px solid ${color}`, borderRight: `${b}px solid ${color}` }} />
  </>;
}

// ─── Typing cursor text ───────────────────────────────────────────────────────
function TypeText({ text, speed = 28 }: { text: string; speed?: number }) {
  const [d, setD] = useState("");
  useEffect(() => {
    setD(""); let i = 0;
    const t = setInterval(() => {
      if (i < text.length) { setD(text.slice(0, ++i)); } else clearInterval(t);
    }, speed);
    return () => clearInterval(t);
  }, [text, speed]);
  return <span>{d}<motion.span className="inline-block w-[2px] h-[0.85em] bg-current align-middle ml-px" animate={{ opacity: [1, 0] }} transition={{ duration: 0.5, repeat: Infinity, repeatType: "reverse" }} /></span>;
}

// ─── Scanline overlay ─────────────────────────────────────────────────────────
function Scanlines() {
  return <div className="fixed inset-0 pointer-events-none z-50 opacity-[0.022]"
    style={{ backgroundImage: "repeating-linear-gradient(0deg,transparent,transparent 2px,rgba(0,0,0,1) 2px,rgba(0,0,0,1) 4px)" }} />;
}

// ─── Hex grid ─────────────────────────────────────────────────────────────────
function HexBg() {
  return <div className="fixed inset-0 pointer-events-none z-0 opacity-[0.028]"
    style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='56' height='100'%3E%3Cpath d='M28 66L0 50V17L28 0l28 17v33L28 66zM0 50l28 17 28-17' fill='none' stroke='%236366f1' stroke-width='1'/%3E%3C/svg%3E")`, backgroundSize: "56px 100px" }} />;
}

// ─── Main ─────────────────────────────────────────────────────────────────────
export default function Home() {
  const [wallet, setWallet] = useState("");
  const [scanning, setScanning] = useState(false);
  const [loadingStep, setLoadingStep] = useState(0);
  const [result, setResult] = useState<ScanResult | null>(null);
  const [error, setError] = useState("");
  const [focused, setFocused] = useState(false);
  const [mouse, setMouse] = useState({ x: 0, y: 0 });
  const [hoverBtn, setHoverBtn] = useState(false);

  const mx = useMotionValue(0), my = useMotionValue(0);
  const smx = useSpring(mx, { stiffness: 50, damping: 18 });
  const smy = useSpring(my, { stiffness: 50, damping: 18 });
  const rotX = useTransform(smy, [-400, 400], [3, -3]);
  const rotY = useTransform(smx, [-400, 400], [-3, 3]);

  useEffect(() => {
    const h = (e: MouseEvent) => {
      mx.set(e.clientX - window.innerWidth / 2);
      my.set(e.clientY - window.innerHeight / 2);
      setMouse({ x: e.clientX, y: e.clientY });
    };
    window.addEventListener("mousemove", h);
    return () => window.removeEventListener("mousemove", h);
  }, [mx, my]);

  useEffect(() => {
    if (!scanning) return;
    setLoadingStep(0);
    const iv = setInterval(() => setLoadingStep(p => p < loadingTexts.length - 1 ? p + 1 : p), 1800);
    return () => clearInterval(iv);
  }, [scanning]);

  const handleScan = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!wallet.startsWith("0x") || wallet.length !== 42) { setError("Invalid — 42-char EVM address required, starting with 0x."); return; }
    setError(""); setScanning(true); setResult(null);
    const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
    try {
      const res = await fetch(`${API_URL}/scan`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ wallet }) });
      if (!res.ok) throw new Error("Backend returned error");
      const data = await res.json();
      setTimeout(() => { setResult(data); setScanning(false); }, 1500);
    } catch (err: any) {
      setError(err.message || "Connection failed — ensure backend is running."); setScanning(false);
    }
  };

  const r = result;
  const tier = r ? r.analysis.risk_tier.toLowerCase() : "";
  const isLow = tier === "low" || tier === "safe";
  const isMed = tier === "medium" || tier === "warning";
  const A = isLow
    ? { hex: "#34d399", glow: "rgba(52,211,153", cls: "text-emerald-400", border: "rgba(52,211,153,0.18)", bg: "rgba(52,211,153,0.04)" }
    : isMed
    ? { hex: "#fbbf24", glow: "rgba(251,191,36", cls: "text-amber-400", border: "rgba(251,191,36,0.18)", bg: "rgba(251,191,36,0.04)" }
    : { hex: "#f43f5e", glow: "rgba(244,63,94", cls: "text-rose-400", border: "rgba(244,63,94,0.18)", bg: "rgba(244,63,94,0.04)" };

  return (
    <div className="min-h-screen bg-[#010308] text-slate-100 overflow-x-hidden"
      style={{ fontFamily: "'GeistMono','Fira Code','Courier New',monospace", cursor: "crosshair" }}>

      <ParticleField />
      <HexBg />
      <Scanlines />

      {/* Custom cursor */}
      <motion.div className="fixed pointer-events-none z-[999] rounded-full" style={{ width: 16, height: 16, left: mouse.x - 8, top: mouse.y - 8, border: "1px solid rgba(99,102,241,0.7)", mixBlendMode: "screen" as unknown as any }} animate={{ scale: (focused || hoverBtn) ? 2.2 : 1 }} transition={{ duration: 0.15 }} />
      <div className="fixed pointer-events-none z-[999] w-1 h-1 rounded-full bg-indigo-400" style={{ left: mouse.x - 2, top: mouse.y - 2 }} />

      {/* Ambient glows */}
      <div className="fixed top-0 left-1/2 -translate-x-1/2 w-[1100px] h-[450px] pointer-events-none z-0" style={{ background: "radial-gradient(ellipse at 50% -5%,rgba(99,102,241,0.14) 0%,transparent 65%)" }} />
      <div className="fixed bottom-0 right-0 w-[700px] h-[550px] pointer-events-none z-0" style={{ background: "radial-gradient(ellipse at 100% 100%,rgba(52,211,153,0.055) 0%,transparent 60%)" }} />

      {/* NAV */}
      <motion.nav initial={{ y: -20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ duration: 0.5, ease: [0.22,1,0.36,1] }}
        className="fixed top-0 inset-x-0 h-14 z-50 flex items-center px-6 md:px-12"
        style={{ background: "rgba(1,3,8,0.75)", backdropFilter: "blur(24px)", borderBottom: "1px solid rgba(99,102,241,0.07)" }}>

        <div className="flex items-center gap-3">
          <div className="relative w-8 h-8 flex items-center justify-center">
            <CB color="rgba(99,102,241,0.55)" s={8} />
            <ShieldCheck className="w-4 h-4 text-indigo-400" />
          </div>
          <div>
            <div className="text-xs font-bold tracking-[0.18em] text-white uppercase">SybilShield</div>
            <div className="text-[9px] text-indigo-600 tracking-widest">v2 · TEE ACTIVE</div>
          </div>
        </div>

        <div className="hidden md:flex items-center gap-8 mx-auto text-[10px] tracking-widest text-slate-400 uppercase">
          {["Enclave Ready", "EVM", "Model v2.1"].map((s, i) => (
            <div key={i} className="flex items-center gap-1.5">
              <motion.span className="w-1 h-1 rounded-full bg-emerald-500" animate={{ opacity: [1, 0.4, 1] }} transition={{ duration: 2, delay: i * 0.5, repeat: Infinity }} style={{ boxShadow: "0 0 5px #34d399" }} />
              {s}
            </div>
          ))}
        </div>

        <div className="flex items-center gap-5 ml-auto text-[10px] tracking-widest text-slate-500 uppercase">
          <a href="https://docs.opengradient.ai" target="_blank" rel="noreferrer" className="hover:text-indigo-400 transition-colors">Docs</a>
          <a href="https://opengradient.ai" target="_blank" rel="noreferrer" className="hover:text-indigo-400 transition-colors">OpenGradient</a>
        </div>
      </motion.nav>

      {/* MAIN */}
      <main className="relative z-10 flex flex-col items-center pt-40 pb-32 px-4 max-w-4xl mx-auto">

        {/* Hero */}
        <div className="text-center mb-16 space-y-6 w-full">
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
            className="inline-flex items-center gap-2 text-[10px] tracking-[0.28em] uppercase text-indigo-400">
            <motion.span className="w-1.5 h-1.5 rounded-full bg-indigo-400" animate={{ opacity: [1, 0.3, 1] }} transition={{ duration: 1.8, repeat: Infinity }} style={{ boxShadow: "0 0 8px rgba(99,102,241,0.9)" }} />
            AI Risk Engine · Verifiable · On-Chain
            <motion.span className="w-1.5 h-1.5 rounded-full bg-indigo-400" animate={{ opacity: [1, 0.3, 1] }} transition={{ duration: 1.8, delay: 0.9, repeat: Infinity }} style={{ boxShadow: "0 0 8px rgba(99,102,241,0.9)" }} />
          </motion.div>

          <motion.h1 initial={{ opacity: 0, y: 22 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2, duration: 0.7, ease: [0.22,1,0.36,1] }}
            className="text-[clamp(3rem,7.5vw,5.8rem)] font-black tracking-[-0.05em] leading-[0.92] text-white">
            <GlitchText>Unmask</GlitchText>{" "}
            <span style={{ background: "linear-gradient(90deg,#818cf8 0%,#c084fc 35%,#34d399 70%,#818cf8 100%)", backgroundSize: "200% 100%", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", animation: "gshift 4s linear infinite" }}>
              Sybil
            </span>
            <br />
            <span className="text-slate-300">Attackers.</span>
          </motion.h1>

          <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.4 }}
            className="text-slate-300 text-sm leading-relaxed max-w-lg mx-auto tracking-wide">
            Scan any EVM wallet — instant forensic risk score via verifiable AI inside a Trusted Execution Environment.
          </motion.p>
        </div>

        {/* Search bar */}
        <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.32, duration: 0.55, ease: [0.22,1,0.36,1] }} className="w-full max-w-2xl mb-4">
          <form onSubmit={handleScan}>
            <div className="relative">
              <CB color={focused ? "rgba(99,102,241,0.7)" : "rgba(99,102,241,0.18)"} s={12} />
              <motion.div className="absolute -inset-px pointer-events-none" animate={{ opacity: focused ? 1 : 0 }} style={{ boxShadow: "0 0 40px rgba(99,102,241,0.18), 0 0 0 1px rgba(99,102,241,0.3)" }} />

              <div className="flex items-center transition-all duration-300"
                style={{ background: "#050912", border: `1px solid ${focused ? "rgba(99,102,241,0.28)" : "rgba(255,255,255,0.055)"}` }}>
                <div className="flex items-center gap-1.5 pl-4 text-[10px] tracking-widest text-indigo-700 uppercase shrink-0">
                  <Eye className="w-3.5 h-3.5" />
                </div>
                <div className="w-px h-5 bg-white/[0.05] mx-3 shrink-0" />
                <input type="text" placeholder="0x0000...0000  ·  EVM wallet address"
                  value={wallet} onChange={e => setWallet(e.target.value)}
                  onFocus={() => setFocused(true)} onBlur={() => setFocused(false)}
                  disabled={scanning}
                  className="w-full bg-transparent text-slate-200 py-4 outline-none placeholder:text-slate-700 text-sm tracking-widest" />
                <div className="p-2 shrink-0">
                  <motion.button type="submit" disabled={scanning} whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.96 }}
                    onMouseEnter={() => setHoverBtn(true)} onMouseLeave={() => setHoverBtn(false)}
                    className="relative flex items-center gap-2 px-5 py-2.5 text-[11px] tracking-[0.18em] uppercase font-bold text-white disabled:opacity-40 disabled:cursor-not-allowed overflow-hidden"
                    style={{ background: "linear-gradient(135deg,#4f46e5,#7c3aed)", clipPath: "polygon(8px 0%,100% 0%,calc(100% - 8px) 100%,0% 100%)", boxShadow: "0 0 24px rgba(99,102,241,0.35)" }}>
                    <motion.div className="absolute inset-0 pointer-events-none"
                      style={{ background: "linear-gradient(90deg,transparent 0%,rgba(255,255,255,0.18) 50%,transparent 100%)" }}
                      animate={{ x: ["-100%", "200%"] }} transition={{ duration: 2.2, repeat: Infinity, repeatDelay: 0.8 }} />
                    {scanning ? <Waves className="w-3.5 h-3.5 animate-pulse" /> : <BrainCircuit className="w-3.5 h-3.5" />}
                    {scanning ? "Scanning" : "Analyze"}
                  </motion.button>
                </div>
              </div>
            </div>
          </form>

          <AnimatePresence>
            {error && (
              <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }}
                className="mt-2 px-4 py-2.5 flex items-center gap-2 text-xs text-rose-400 tracking-wide border border-rose-500/12"
                style={{ background: "rgba(244,63,94,0.04)" }}>
                <motion.span className="w-1 h-1 rounded-full bg-rose-500 shrink-0" animate={{ opacity: [1, 0.3, 1] }} transition={{ duration: 1, repeat: Infinity }} style={{ boxShadow: "0 0 6px rgba(244,63,94,0.8)" }} />
                {error}
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>

        {/* Dynamic */}
        <div className="w-full max-w-4xl mt-6">
          <AnimatePresence mode="wait">

            {/* SCANNING */}
            {scanning && (
              <motion.div key="scan" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                className="relative overflow-hidden flex flex-col items-center gap-8 p-16"
                style={{ background: "#030810", border: "1px solid rgba(99,102,241,0.08)" }}>
                <CB color="rgba(99,102,241,0.25)" s={20} />

                {/* Horizontal scan beam */}
                <motion.div className="absolute inset-x-0 h-px pointer-events-none"
                  style={{ background: "linear-gradient(90deg,transparent,rgba(99,102,241,0.5),rgba(139,92,246,0.5),transparent)" }}
                  animate={{ top: ["0%", "100%", "0%"] }} transition={{ duration: 3.5, repeat: Infinity, ease: "linear" }} />

                {/* Radar */}
                <div className="relative w-36 h-36 flex items-center justify-center">
                  {[1, 0.68, 0.36].map((sc, i) => (
                    <motion.div key={i} className="absolute rounded-full border border-indigo-500/15"
                      style={{ width: `${sc * 100}%`, height: `${sc * 100}%` }}
                      animate={{ opacity: [0.3, 0.7, 0.3], scale: [1, 1.02, 1] }} transition={{ duration: 2.5, delay: i * 0.5, repeat: Infinity }} />
                  ))}
                  <motion.div className="absolute inset-0 rounded-full"
                    style={{ background: "conic-gradient(from 0deg, transparent 65%, rgba(99,102,241,0.55) 100%)" }}
                    animate={{ rotate: 360 }} transition={{ duration: 2, repeat: Infinity, ease: "linear" }} />
                  <div className="w-2 h-2 rounded-full bg-indigo-400 z-10" style={{ boxShadow: "0 0 14px rgba(99,102,241,0.95)" }} />
                  {[{ t: "22%", l: "63%", d: 0.4 }, { t: "67%", l: "28%", d: 1.1 }, { t: "42%", l: "77%", d: 0.75 }].map((b, i) => (
                    <motion.div key={i} className="absolute w-1 h-1 rounded-full bg-emerald-400"
                      style={{ top: b.t, left: b.l, boxShadow: "0 0 8px rgba(52,211,153,0.95)" }}
                      animate={{ opacity: [0, 1, 0], scale: [0.5, 1.2, 0.5] }} transition={{ duration: 2, delay: b.d, repeat: Infinity, repeatDelay: 0.8 }} />
                  ))}
                </div>

                <AnimatePresence mode="wait">
                  <motion.div key={loadingStep} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }}
                    className="text-[11px] tracking-[0.28em] uppercase text-indigo-400">
                    <TypeText text={loadingTexts[loadingStep]} speed={22} />
                  </motion.div>
                </AnimatePresence>

                <div className="flex gap-2">
                  {loadingTexts.map((_, i) => (
                    <motion.div key={i} style={{ width: 24, height: 2, borderRadius: 2 }}
                      animate={{ background: i <= loadingStep ? "#6366f1" : "rgba(255,255,255,0.05)", boxShadow: i === loadingStep ? "0 0 10px rgba(99,102,241,0.9)" : "none" }}
                      transition={{ duration: 0.3 }} />
                  ))}
                </div>
              </motion.div>
            )}

            {/* RESULT */}
            {result && !scanning && (
              <motion.div key="result" initial={{ opacity: 0, y: 22 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.55, ease: [0.22,1,0.36,1] }} style={{ perspective: "1200px" }}>
                <motion.div 
                  className="relative overflow-hidden rounded-2xl"
                  style={{ 
                    rotateX: rotX, 
                    rotateY: rotY, 
                    transformStyle: "preserve-3d" as unknown as any,
                    background: "#030810", 
                    border: `1px solid ${A.border}`, 
                    boxShadow: `0 0 90px ${A.glow},0.07), 0 40px 100px rgba(0,0,0,0.6)` 
                  }}>
                  <CB color={A.border} s={20} />

                  {/* Mouse-follow glow inside card */}
                  <div className="absolute w-80 h-80 rounded-full pointer-events-none" style={{ background: `radial-gradient(circle,${A.glow},0.055) 0%,transparent 70%)`, left: mouse.x - 160, top: mouse.y - 160, filter: "blur(50px)", transition: "left 0.12s,top 0.12s" }} />

                  {/* Card top bar */}
                  <div className="px-6 py-3 flex items-center justify-between text-[10px] tracking-widest uppercase" style={{ borderBottom: "1px solid rgba(255,255,255,0.035)" }}>
                    <div className="flex items-center gap-2 text-slate-300">
                      <Terminal className="w-3 h-3" />
                      <span>Scan Report</span>
                      <span className="text-slate-600">·</span>
                      <span className="font-mono">{result.wallet.slice(0, 10)}…{result.wallet.slice(-6)}</span>
                    </div>
                    <a href={result.explorer_url} target="_blank" rel="noreferrer"
                      className="flex items-center gap-1.5 text-indigo-500 hover:text-indigo-300 transition-colors">
                      <Zap className="w-3 h-3" /> OpenGradient TEE <ExternalLink className="w-3 h-3" />
                    </a>
                  </div>

                  <div className="p-8 md:p-10 space-y-10">
                    {/* Score row */}
                    <div className="flex flex-col md:flex-row gap-8 items-start md:items-center">
                      {/* SVG circle */}
                      <div className="relative shrink-0">
                        <svg className="w-36 h-36 -rotate-90" viewBox="0 0 144 144">
                          <circle cx="72" cy="72" r="60" fill="none" stroke="rgba(255,255,255,0.025)" strokeWidth="8" />
                          <circle cx="72" cy="72" r="60" fill="none" stroke="rgba(255,255,255,0.04)" strokeWidth="8" strokeDasharray="4 10" />
                          <motion.circle cx="72" cy="72" r="60" fill="none" stroke={A.hex} strokeWidth="8" strokeLinecap="round"
                            strokeDasharray={376.99} strokeDashoffset={376.99}
                            animate={{ strokeDashoffset: 376.99 - (376.99 * result.analysis.sybil_probability) / 100 }}
                            transition={{ duration: 1.8, ease: "easeOut" }}
                            style={{ filter: `drop-shadow(0 0 10px ${A.hex})` }} />
                        </svg>
                        <div className="absolute inset-0 flex flex-col items-center justify-center">
                          <AnimatedNumber value={result.analysis.sybil_probability} />
                          <span className="text-[9px] tracking-widest text-slate-600 uppercase mt-0.5">Sybil %</span>
                        </div>
                      </div>

                      {/* Tier */}
                      <div className="flex-1 space-y-3">
                        <div>
                          <p className="text-[10px] tracking-[0.22em] text-slate-600 uppercase mb-1">Risk Classification</p>
                          <motion.h2 initial={{ opacity: 0, x: -12 }} animate={{ opacity: 1, x: 0 }}
                            className={`text-5xl font-black tracking-[-0.04em] uppercase ${A.cls}`}
                            style={{ textShadow: `0 0 50px ${A.hex}45` }}>
                            {result.analysis.risk_tier}
                          </motion.h2>
                        </div>
                        <p className="text-slate-200 text-sm leading-relaxed max-w-xs tracking-wide">{result.analysis.summary}</p>
                      </div>

                      {/* Bar chart */}
                      <div className="hidden md:flex gap-1 items-end h-20 shrink-0">
                        {Array.from({ length: 12 }, (_, i) => {
                          const pct = result.analysis.sybil_probability;
                          const filled = (i / 11) * 100 <= pct;
                          return (
                            <motion.div key={i} className="w-2 rounded-sm"
                              initial={{ scaleY: 0 }}
                              animate={{ scaleY: 1 }}
                              transition={{ delay: 0.8 + i * 0.045, duration: 0.35, ease: "easeOut" }}
                              style={{ height: `${20 + (i / 11) * 80}%`, transformOrigin: "bottom", background: filled ? A.hex : "rgba(255,255,255,0.05)", boxShadow: filled ? `0 0 8px ${A.hex}55` : "none" }} />
                          );
                        })}
                      </div>
                    </div>

                    <div className="flex items-center gap-4">
                      <div className="flex-1 h-px bg-white/[0.035]" />
                      <span className="text-[9px] tracking-[0.28em] text-slate-400 uppercase">Detail Analysis</span>
                      <div className="flex-1 h-px bg-white/[0.035]" />
                    </div>

                    {/* Two columns */}
                    <div className="grid md:grid-cols-2 gap-8">
                      {/* Flags */}
                      <div>
                        <div className="flex items-center gap-2 text-[10px] tracking-[0.2em] text-slate-300 uppercase mb-4">
                          <ShieldAlert className="w-3.5 h-3.5 text-rose-500" /> Detected Flags
                        </div>
                        <div className="space-y-2">
                          <AnimatePresence>
                            {result.analysis.flags.length === 0 && !result.metrics.has_tornado_cash_interaction && !result.metrics.is_suspicious_pattern && (
                              <motion.div initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }}
                                className="flex items-center gap-3 p-3 text-xs border border-emerald-500/10 text-emerald-400 tracking-wide"
                                style={{ background: "rgba(52,211,153,0.04)" }}>
                                <ShieldCheck className="w-3.5 h-3.5 shrink-0" /> Zero critical flags — clean organic behavior.
                              </motion.div>
                            )}
                            {result.analysis.flags.map((flag, i) => <FlagRow key={i} text={flag} color="rose" delay={i * 0.07} />)}
                            {result.metrics.has_tornado_cash_interaction && <FlagRow text="Interaction with Tornado Cash / obfuscation routers detected." color="amber" delay={0.1} />}
                            {result.metrics.is_suspicious_pattern && <FlagRow text="High tx / low contract ratio — strong Airdrop Farming Script signal." color="rose" delay={0.18} />}
                          </AnimatePresence>
                        </div>
                      </div>

                      {/* Metrics */}
                      <div>
                        <div className="flex items-center gap-2 text-[10px] tracking-[0.2em] text-slate-300 uppercase mb-4">
                          <Activity className="w-3.5 h-3.5 text-indigo-400" /> On-Chain Footprint
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          <MetricCard label="Txs Executed" value={result.metrics.tx_count} alert={result.metrics.tx_count > 1000} />
                          <MetricCard label="Wallet Age" value={`${result.metrics.age_days}d`} />
                          <MetricCard label="ETH Balance" value={`${result.metrics.eth_balance.toFixed(4)} Ξ`} accent />
                          <MetricCard label="Protocols" value={result.metrics.distinct_contracts}
                            alert={result.metrics.distinct_contracts < 5 && result.metrics.tx_count > 50} />
                        </div>
                      </div>
                    </div>
                  </div>
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Bottom tagline */}
        {!scanning && !result && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.65 }}
            className="mt-12 flex flex-wrap items-center justify-center gap-6 text-[10px] tracking-[0.2em] text-slate-400 uppercase">
            {["EVM Compatible", "Zero-Knowledge Ready", "TEE Verified", "Tamper-Proof"].map((t, i) => (
              <div key={i} className="flex items-center gap-1.5">
                <span className="w-1 h-1 rounded-full bg-indigo-900" /> {t}
              </div>
            ))}
          </motion.div>
        )}
      </main>

      <style>{`
        @keyframes gshift {
          0%   { background-position: 0% 50%; }
          100% { background-position: 200% 50%; }
        }
      `}</style>
    </div>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function FlagRow({ text, color, delay = 0 }: { text: string; color: "rose" | "amber"; delay?: number }) {
  const c = color === "rose"
    ? { dot: "#f43f5e", shadow: "rgba(244,63,94,0.85)", border: "rgba(244,63,94,0.1)", bg: "rgba(244,63,94,0.04)" }
    : { dot: "#fbbf24", shadow: "rgba(245,158,11,0.85)", border: "rgba(251,191,36,0.1)", bg: "rgba(251,191,36,0.04)" };
  return (
    <motion.div initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay }}
      className="flex items-start gap-3 p-3 text-xs tracking-wide relative"
      style={{ background: c.bg, border: `1px solid ${c.border}` }}>
      <span className="w-1 h-1 rounded-full shrink-0 mt-1.5" style={{ background: c.dot, boxShadow: `0 0 6px ${c.shadow}` }} />
      <span className="text-slate-200 leading-relaxed">{text}</span>
    </motion.div>
  );
}

function MetricCard({ label, value, alert = false, accent = false }: { label: string; value: any; alert?: boolean; accent?: boolean }) {
  return (
    <motion.div whileHover={{ scale: 1.02, brightness: 1.1 } as unknown as any} className="p-3.5 relative group cursor-default"
      style={{ background: alert ? "rgba(244,63,94,0.04)" : "rgba(255,255,255,0.018)", border: `1px solid ${alert ? "rgba(244,63,94,0.14)" : "rgba(255,255,255,0.04)"}` }}>
      <CB color={alert ? "rgba(244,63,94,0.28)" : accent ? "rgba(99,102,241,0.18)" : "rgba(255,255,255,0.05)"} s={6} />
      <p className="text-[9px] tracking-[0.2em] text-slate-400 uppercase mb-2">{label}</p>
      <p className={`text-lg font-black tabular-nums ${alert ? "text-rose-400" : accent ? "text-indigo-400" : "text-slate-300"}`}
        style={{ textShadow: alert ? "0 0 18px rgba(244,63,94,0.4)" : accent ? "0 0 18px rgba(99,102,241,0.4)" : "none" }}>
        {value}
      </p>
    </motion.div>
  );
}

function AnimatedNumber({ value }: { value: number }) {
  const [d, setD] = useState(0);
  useEffect(() => {
    let cur = 0; const steps = 80; const inc = value / steps;
    const t = setInterval(() => { cur += inc; if (cur >= value) { setD(value); clearInterval(t); } else setD(Math.floor(cur)); }, 18);
    return () => clearInterval(t);
  }, [value]);
  return <span className="text-4xl font-black text-white tabular-nums">{d}</span>;
}
