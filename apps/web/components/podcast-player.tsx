"use client";

import { useEffect, useRef, useState } from "react";
import { Pause, Play, RotateCcw, RotateCw } from "lucide-react";

const SPEEDS = [1, 1.25, 1.5, 0.75];
const BACK = 15;
const FORWARD = 30;

function clock(s: number) {
  if (!Number.isFinite(s) || s < 0) s = 0;
  const m = Math.floor(s / 60);
  return `${m}:${String(Math.floor(s % 60)).padStart(2, "0")}`;
}

/**
 * Reproductor del podcast diario. Recuerda por dónde ibas en cada episodio y se puede
 * controlar desde la pantalla de bloqueo y los auriculares (Media Session).
 */
export function PodcastPlayer({ id, src, title, subtitle, duration }: { id: string; src: string; title: string; subtitle: string; duration?: number | null }) {
  const audio = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);
  const [time, setTime] = useState(0);
  const [total, setTotal] = useState(duration ?? 0);
  const [speed, setSpeed] = useState(1);
  const [failed, setFailed] = useState(false);
  const key = `podcast:${id}`;

  // Posición guardada y controles del sistema
  useEffect(() => {
    const a = audio.current;
    if (!a) return;
    const saved = Number(localStorage.getItem(key));
    const restore = () => { if (saved > 0 && saved < a.duration - 5) a.currentTime = saved; };
    a.addEventListener("loadedmetadata", restore, { once: true });

    if ("mediaSession" in navigator) {
      navigator.mediaSession.metadata = new MediaMetadata({ title, artist: "Personal Hub", album: "Resumen diario", artwork: [{ src: "/icon.png", sizes: "512x512", type: "image/png" }] });
      const set = (action: MediaSessionAction, fn: MediaSessionActionHandler) => { try { navigator.mediaSession.setActionHandler(action, fn); } catch { /* acción no soportada */ } };
      set("play", () => void a.play());
      set("pause", () => a.pause());
      set("seekbackward", (d) => { a.currentTime = Math.max(0, a.currentTime - (d.seekOffset ?? BACK)); });
      set("seekforward", (d) => { a.currentTime = Math.min(a.duration || Infinity, a.currentTime + (d.seekOffset ?? FORWARD)); });
      set("seekto", (d) => { if (d.seekTime != null) a.currentTime = d.seekTime; });
    }
    return () => a.removeEventListener("loadedmetadata", restore);
  }, [key, title]);

  const toggle = () => {
    const a = audio.current;
    if (!a) return;
    if (a.paused) void a.play().catch(() => setFailed(true));
    else a.pause();
  };
  const skip = (s: number) => {
    const a = audio.current;
    if (a) a.currentTime = Math.min(Math.max(0, a.currentTime + s), a.duration || Infinity);
  };
  const cycleSpeed = () => {
    const next = SPEEDS[(SPEEDS.indexOf(speed) + 1) % SPEEDS.length];
    setSpeed(next);
    if (audio.current) audio.current.playbackRate = next;
  };

  const pct = total ? Math.min(100, (time / total) * 100) : 0;

  return (
    <div>
      <audio
        ref={audio}
        src={src}
        preload="metadata"
        onPlay={() => setPlaying(true)}
        onPause={() => { setPlaying(false); localStorage.setItem(key, String(audio.current?.currentTime ?? 0)); }}
        onEnded={() => { setPlaying(false); localStorage.removeItem(key); }}
        onTimeUpdate={(e) => {
          const t = e.currentTarget.currentTime;
          setTime(t);
          if (Math.floor(t) % 10 === 0) localStorage.setItem(key, String(t));
        }}
        onLoadedMetadata={(e) => Number.isFinite(e.currentTarget.duration) && setTotal(e.currentTarget.duration)}
        onError={() => setFailed(true)}
      />
      <p className="text-[15px] font-medium leading-snug">{title}</p>
      <p className="text-[12px] text-ink-3">{subtitle}</p>

      <div className="mt-3">
        <label htmlFor={`seek-${id}`} className="sr-only">Posición</label>
        <input
          id={`seek-${id}`} type="range" min={0} max={total || 0} step={1} value={Math.min(time, total || 0)}
          onChange={(e) => { if (audio.current) audio.current.currentTime = Number(e.target.value); }}
          className="h-1.5 w-full cursor-pointer appearance-none rounded-full bg-surface-2 accent-[var(--color-accent)]"
          style={{ background: `linear-gradient(to right, var(--color-accent) ${pct}%, var(--color-surface-2) ${pct}%)` }}
        />
        <div className="tnum mt-1 flex justify-between text-[12px] text-ink-3">
          <span>{clock(time)}</span>
          <span>−{clock(total - time)}</span>
        </div>
      </div>

      <div className="mt-2 flex items-center justify-center gap-3">
        <button type="button" onClick={() => skip(-BACK)} aria-label={`Retroceder ${BACK} segundos`} className="press relative grid size-11 place-items-center rounded-full text-ink-2 hover:bg-surface-2">
          <RotateCcw size={22} aria-hidden />
          <span className="absolute text-[8px] font-bold">{BACK}</span>
        </button>
        <button type="button" onClick={toggle} aria-label={playing ? "Pausar" : "Reproducir"} className="press grid size-14 place-items-center rounded-full bg-accent text-white">
          {playing ? <Pause size={24} fill="currentColor" aria-hidden /> : <Play size={24} fill="currentColor" className="ml-0.5" aria-hidden />}
        </button>
        <button type="button" onClick={() => skip(FORWARD)} aria-label={`Adelantar ${FORWARD} segundos`} className="press relative grid size-11 place-items-center rounded-full text-ink-2 hover:bg-surface-2">
          <RotateCw size={22} aria-hidden />
          <span className="absolute text-[8px] font-bold">{FORWARD}</span>
        </button>
        <button type="button" onClick={cycleSpeed} aria-label={`Velocidad ${speed}x`} className="press tnum ml-1 h-8 min-w-12 rounded-lg border border-line px-2 text-[13px] font-semibold text-ink-2">
          {speed.toLocaleString("es-ES")}×
        </button>
      </div>
      {failed ? <p className="mt-2 text-center text-[12px] text-bad">No se pudo cargar el audio. Recarga la página para pedir un enlace nuevo.</p> : null}
    </div>
  );
}
