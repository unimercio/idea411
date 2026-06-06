import { useEffect, useMemo, useRef, useState } from "react";
import { Download, Headphones, Loader2, Pause, Play, Square, VolumeX } from "lucide-react";

export type Turn = { speaker: string; text: string };

/**
 * Parse a (possibly partial) focus-group transcript into ordered speaker turns.
 * Matches lines like `**Maya Chen:** ...` (the format produced by
 * formatFocusGroupTranscript in vetting.tsx). Content continues until the next
 * speaker line or a Markdown heading.
 */
export function parseTurns(transcript: string): Turn[] {
  if (!transcript) return [];
  const lines = transcript.replace(/\r\n/g, "\n").split("\n");
  const out: Turn[] = [];
  let cur: Turn | null = null;
  const speaker = /^\s*\*\*([A-Z][A-Za-z .''\-]{1,60}):\*\*\s*(.*)$/;
  const heading = /^#{1,6}\s+/;
  const flush = () => {
    if (cur && cur.text.trim()) out.push({ ...cur, text: cur.text.trim() });
    cur = null;
  };
  for (const raw of lines) {
    if (heading.test(raw)) {
      flush();
      continue;
    }
    const m = raw.match(speaker);
    if (m) {
      flush();
      cur = { speaker: m[1].trim(), text: m[2] };
    } else if (cur) {
      if (raw.trim()) cur.text += " " + raw.trim();
    }
  }
  flush();
  return out;
}

function hashStr(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

/** Deterministically map a persona name → a SpeechSynthesisVoice. */
function pickVoice(
  name: string,
  voices: SpeechSynthesisVoice[],
): SpeechSynthesisVoice | undefined {
  if (!voices.length) return undefined;
  const en = voices.filter((v) => /^en(-|_|$)/i.test(v.lang));
  const pool = en.length ? en : voices;
  return pool[hashStr(name.toLowerCase()) % pool.length];
}

/** Vary pitch/rate slightly per persona for extra distinctiveness. */
function pickProsody(name: string): { pitch: number; rate: number } {
  const h = hashStr(name.toLowerCase());
  const pitch = 0.85 + ((h % 40) / 100); // 0.85 – 1.24
  const rate = 0.92 + (((h >> 4) % 22) / 100); // 0.92 – 1.13
  return { pitch, rate };
}

function stripMd(s: string): string {
  return s
    .replace(/`{1,3}[^`]*`{1,3}/g, "")
    .replace(/\*\*|\*|__|_/g, "")
    .replace(/\[(.+?)\]\(.+?\)/g, "$1")
    .replace(/\s+/g, " ")
    .trim();
}

type Mode = "idle" | "playing" | "paused";

export function FocusGroupAudio({
  transcript,
  live,
  ended,
}: {
  transcript: string;
  /** True while the model is still streaming. Enables "listen in". */
  live: boolean;
  /** True once the live session finished (enables replay UI). */
  ended: boolean;
}) {
  const turns = useMemo(() => parseTurns(transcript), [transcript]);
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [listenLive, setListenLive] = useState(false);
  const [mode, setMode] = useState<Mode>("idle");
  const [currentIdx, setCurrentIdx] = useState<number | null>(null);
  const [speed, setSpeed] = useState<number>(1);
  const speedRef = useRef<number>(1);
  useEffect(() => {
    speedRef.current = speed;
  }, [speed]);
  const spokenIdxRef = useRef<number>(-1); // last index queued/spoken in live mode
  const replayIdxRef = useRef<number>(0);
  const supported =
    typeof window !== "undefined" && "speechSynthesis" in window;

  // Load voices (async on some browsers).
  useEffect(() => {
    if (!supported) return;
    const load = () => setVoices(window.speechSynthesis.getVoices());
    load();
    window.speechSynthesis.onvoiceschanged = load;
    return () => {
      window.speechSynthesis.onvoiceschanged = null;
    };
  }, [supported]);

  // Stop everything on unmount.
  useEffect(() => {
    return () => {
      if (supported) window.speechSynthesis.cancel();
    };
  }, [supported]);

  function speakTurn(turn: Turn, onEnd?: () => void) {
    if (!supported) return;
    const u = new SpeechSynthesisUtterance(stripMd(turn.text));
    const v = pickVoice(turn.speaker, voices);
    if (v) u.voice = v;
    const { pitch, rate } = pickProsody(turn.speaker);
    u.pitch = pitch;
    u.rate = Math.min(10, Math.max(0.1, rate * speedRef.current));
    u.onend = () => onEnd?.();
    u.onerror = () => onEnd?.();
    window.speechSynthesis.speak(u);
  }

  // LIVE listen-in: as new turns appear, queue them.
  useEffect(() => {
    if (!supported || !live || !listenLive) return;
    // Only queue turns that are "complete" — i.e. not the last one mid-stream.
    // When the stream ends (`ended`), queue everything that's left.
    const lastSafe = ended ? turns.length - 1 : turns.length - 2;
    for (let i = spokenIdxRef.current + 1; i <= lastSafe; i++) {
      const idx = i;
      speakTurn(turns[idx], () => {
        setCurrentIdx((c) => (c === idx ? null : c));
      });
      spokenIdxRef.current = idx;
      setCurrentIdx(idx);
    }
  }, [transcript, live, listenLive, ended, turns, supported]);

  function startReplay(from = 0) {
    if (!supported) return;
    window.speechSynthesis.cancel();
    replayIdxRef.current = from;
    setMode("playing");
    const step = () => {
      const i = replayIdxRef.current;
      if (i >= turns.length) {
        setMode("idle");
        setCurrentIdx(null);
        return;
      }
      setCurrentIdx(i);
      speakTurn(turns[i], () => {
        replayIdxRef.current = i + 1;
        // If user paused/stopped, don't auto-advance.
        if (window.speechSynthesis.paused) return;
        if (replayIdxRef.current === 0) return;
        step();
      });
    };
    step();
  }

  function pause() {
    if (!supported) return;
    window.speechSynthesis.pause();
    setMode("paused");
  }
  function resume() {
    if (!supported) return;
    window.speechSynthesis.resume();
    setMode("playing");
  }
  function stop() {
    if (!supported) return;
    window.speechSynthesis.cancel();
    replayIdxRef.current = 0;
    setMode("idle");
    setCurrentIdx(null);
  }

  function toggleListen() {
    if (!supported) return;
    if (listenLive) {
      window.speechSynthesis.cancel();
      setListenLive(false);
      setCurrentIdx(null);
    } else {
      // Start from the most recent completed turn so we don't dump
      // the whole backlog at once.
      spokenIdxRef.current = Math.max(-1, turns.length - 2);
      setListenLive(true);
    }
  }

  // -------- Export (tab-audio capture + MediaRecorder) --------
  const [exportingFor, setExportingFor] = useState<string | null>(null); // "__all__" | speaker | null
  const [exportError, setExportError] = useState<string | null>(null);
  const speakers = useMemo(
    () => Array.from(new Set(turns.map((t) => t.speaker))),
    [turns],
  );
  const canExport =
    supported &&
    typeof navigator !== "undefined" &&
    !!navigator.mediaDevices?.getDisplayMedia &&
    typeof MediaRecorder !== "undefined";

  function speakTurnPromise(turn: Turn): Promise<void> {
    return new Promise((resolve) => {
      const u = new SpeechSynthesisUtterance(stripMd(turn.text));
      const v = pickVoice(turn.speaker, voices);
      if (v) u.voice = v;
      const { pitch, rate } = pickProsody(turn.speaker);
      u.pitch = pitch;
      u.rate = Math.min(10, Math.max(0.1, rate)); // export at 1× base
      u.onend = () => resolve();
      u.onerror = () => resolve();
      window.speechSynthesis.speak(u);
    });
  }

  async function exportAudio(filterSpeaker: string | null) {
    if (!canExport) return;
    const key = filterSpeaker ?? "__all__";
    setExportError(null);
    setExportingFor(key);
    let stream: MediaStream | null = null;
    let recorder: MediaRecorder | null = null;
    try {
      stream = await navigator.mediaDevices.getDisplayMedia({
        video: true,
        audio: true,
      });
      const audioTracks = stream.getAudioTracks();
      if (!audioTracks.length) {
        throw new Error(
          "No tab audio shared. When the share dialog appears, pick the current tab and enable “Share tab audio”.",
        );
      }
      const audioStream = new MediaStream(audioTracks);
      const mime =
        MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
          ? "audio/webm;codecs=opus"
          : "audio/webm";
      recorder = new MediaRecorder(audioStream, { mimeType: mime });
      const chunks: BlobPart[] = [];
      recorder.ondataavailable = (e) => {
        if (e.data && e.data.size) chunks.push(e.data);
      };
      const stopped = new Promise<void>((res) => {
        recorder!.onstop = () => res();
      });
      recorder.start();

      // Stop any current playback before exporting.
      window.speechSynthesis.cancel();
      const toSpeak = filterSpeaker
        ? turns.filter((t) => t.speaker === filterSpeaker)
        : turns;
      for (const turn of toSpeak) {
        await speakTurnPromise(turn);
      }
      // Brief tail so the recorder captures the final utterance fully.
      await new Promise((r) => setTimeout(r, 350));
      recorder.stop();
      await stopped;

      const blob = new Blob(chunks, { type: mime });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      const stamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
      const label = filterSpeaker
        ? filterSpeaker.toLowerCase().replace(/\s+/g, "-")
        : "full-session";
      a.href = url;
      a.download = `focus-group-${label}-${stamp}.webm`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 4000);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Export failed.";
      setExportError(msg);
    } finally {
      stream?.getTracks().forEach((t) => t.stop());
      setExportingFor(null);
    }
  }


  if (!supported) {
    return (
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <VolumeX className="h-3.5 w-3.5" />
        Audio playback isn't supported in this browser.
      </div>
    );
  }

  const currentSpeaker =
    currentIdx != null && turns[currentIdx] ? turns[currentIdx].speaker : null;

  return (
    <div className="flex flex-col gap-2">
    <div className="flex flex-wrap items-center gap-2">
      {live && (
        <button
          type="button"
          onClick={toggleListen}
          className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition ${
            listenLive
              ? "border-ember/60 bg-ember/10 text-ember"
              : "border-border bg-background/60 text-muted-foreground hover:text-foreground"
          }`}
          title="Hear personas speak as the session streams in"
        >
          <Headphones className="h-3.5 w-3.5" />
          {listenLive ? "Listening in…" : "Listen in"}
        </button>
      )}

      {!live && turns.length > 0 && (
        <>
          {mode === "idle" && (
            <button
              type="button"
              onClick={() => startReplay(0)}
              className="inline-flex items-center gap-1.5 rounded-full border border-border bg-background/60 px-3 py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground transition"
            >
              <Play className="h-3.5 w-3.5" /> Replay session
            </button>
          )}
          {mode === "playing" && (
            <button
              type="button"
              onClick={pause}
              className="inline-flex items-center gap-1.5 rounded-full border border-ember/60 bg-ember/10 px-3 py-1.5 text-xs font-medium text-ember"
            >
              <Pause className="h-3.5 w-3.5" /> Pause
            </button>
          )}
          {mode === "paused" && (
            <button
              type="button"
              onClick={resume}
              className="inline-flex items-center gap-1.5 rounded-full border border-ember/60 bg-ember/10 px-3 py-1.5 text-xs font-medium text-ember"
            >
              <Play className="h-3.5 w-3.5" /> Resume
            </button>
          )}
          {mode !== "idle" && (
            <button
              type="button"
              onClick={stop}
              className="inline-flex items-center gap-1.5 rounded-full border border-border bg-background/60 px-3 py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground transition"
            >
              <Square className="h-3.5 w-3.5" /> Stop
            </button>
          )}
          <div
            className="inline-flex items-center gap-0.5 rounded-full border border-border bg-background/60 p-0.5"
            role="group"
            aria-label="Playback speed"
          >
            {[0.75, 1, 1.25, 1.5].map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => {
                  setSpeed(s);
                  speedRef.current = s;
                  // If currently playing, restart from current turn at new speed.
                  if (mode === "playing" && currentIdx != null) {
                    window.speechSynthesis.cancel();
                    startReplay(currentIdx);
                  }
                }}
                className={`rounded-full px-2 py-0.5 text-[11px] font-medium transition ${
                  speed === s
                    ? "bg-ember/15 text-ember"
                    : "text-muted-foreground hover:text-foreground"
                }`}
                title={`Playback speed ${s}×`}
              >
                {s}×
              </button>
            ))}
          </div>
        </>
      )}

      {currentSpeaker && (
        <span className="text-xs text-muted-foreground">
          <span className="text-ember">●</span> {currentSpeaker}
        </span>
      )}
    </div>

    {!live && turns.length > 0 && (
      <Waveform
        turns={turns}
        currentIdx={currentIdx}
        mode={mode}
        onSeek={(i) => {
          window.speechSynthesis.cancel();
          startReplay(i);
        }}
      />
    )}
    </div>
  );
}

function Waveform({
  turns,
  currentIdx,
  mode,
  onSeek,
}: {
  turns: Turn[];
  currentIdx: number | null;
  mode: Mode;
  onSeek: (idx: number) => void;
}) {
  // Bar height derived from word count; deterministic color per speaker.
  const bars = useMemo(() => {
    const counts = turns.map((t) => Math.max(1, t.text.split(/\s+/).length));
    const max = Math.max(...counts, 1);
    return turns.map((t, i) => {
      const h = 18 + Math.round((Math.sqrt(counts[i] / max)) * 30); // 18..48px
      const hue = hashStr(t.speaker.toLowerCase()) % 360;
      return { h, hue, speaker: t.speaker, words: counts[i] };
    });
  }, [turns]);

  return (
    <div className="rounded-lg border border-border bg-background/40 p-2">
      <div
        className="flex items-end gap-[2px] h-14 overflow-x-auto"
        role="slider"
        aria-label="Scrub session by turn"
        aria-valuemin={0}
        aria-valuemax={turns.length - 1}
        aria-valuenow={currentIdx ?? 0}
      >
        {bars.map((b, i) => {
          const isCurrent = currentIdx === i;
          const isPast = currentIdx != null && i < currentIdx;
          const playing = mode !== "idle";
          return (
            <button
              key={i}
              type="button"
              onClick={() => onSeek(i)}
              title={`Turn ${i + 1} · ${b.speaker} · ${b.words} words`}
              className={`flex-1 min-w-[3px] rounded-sm transition-all ${
                isCurrent
                  ? "opacity-100 ring-1 ring-ember/70"
                  : isPast && playing
                    ? "opacity-90"
                    : "opacity-50 hover:opacity-90"
              }`}
              style={{
                height: `${b.h}px`,
                background: `hsl(${b.hue} 70% ${isCurrent ? 60 : isPast && playing ? 55 : 45}%)`,
              }}
            />
          );
        })}
      </div>
      <div className="mt-1 flex justify-between text-[10px] text-muted-foreground">
        <span>Turn 1</span>
        <span>
          {currentIdx != null ? `${currentIdx + 1} / ${turns.length}` : `${turns.length} turns`}
        </span>
        <span>Turn {turns.length}</span>
      </div>
    </div>
  );
}
