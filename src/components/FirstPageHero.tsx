import React, { useState } from 'react';
import {
  Camera,
  FlipHorizontal,
  Wifi,
  QrCode,
  Copy,
  Check,
  ExternalLink,
  ShieldCheck,
  Zap,
  Mic,
  MicOff,
  Video,
  Radio,
  Eye,
  Smartphone,
  Layers,
  Sparkles,
  Settings2,
} from 'lucide-react';
import { CameraFacing, QUALITY_PRESETS, StreamQuality } from '../types';

interface FirstPageHeroProps {
  onStartCamera: (facing: CameraFacing) => void;
  shareUrl: string;
  roomId: string;
  onOpenQrModal: () => void;
  selectedQuality: StreamQuality;
  onSelectQuality: (q: StreamQuality) => void;
  enableAudio: boolean;
  onToggleAudio: () => void;
  onOpenViewer: () => void;
}

export const FirstPageHero: React.FC<FirstPageHeroProps> = ({
  onStartCamera,
  shareUrl,
  roomId,
  onOpenQrModal,
  selectedQuality,
  onSelectQuality,
  enableAudio,
  onToggleAudio,
  onOpenViewer,
}) => {
  const [copied, setCopied] = useState<boolean>(false);

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      const input = document.createElement('input');
      input.value = shareUrl;
      document.body.appendChild(input);
      input.select();
      document.execCommand('copy');
      document.body.removeChild(input);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    }
  };

  return (
    <div className="w-full max-w-6xl mx-auto px-4 py-6 md:py-10 space-y-8 animate-in fade-in duration-300">
      {/* Brand Hero Banner */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-slate-900 via-slate-900/90 to-cyan-950/40 border border-slate-800 p-6 md:p-10 shadow-2xl">
        <div className="absolute top-0 right-0 -mr-16 -mt-16 w-80 h-80 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-1/3 -mb-20 w-80 h-80 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          <div className="space-y-3 max-w-2xl">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-cyan-500/10 border border-cyan-500/30 text-cyan-300 text-xs font-semibold">
              <Radio className="w-3.5 h-3.5 text-cyan-400 animate-pulse" />
              <span>WiFi Wireless Camera Sharing</span>
              <span className="w-1.5 h-1.5 rounded-full bg-cyan-400"></span>
              <span className="text-slate-400">Zero App Install</span>
            </div>
            <h1 className="text-3xl md:text-5xl font-extrabold tracking-tight text-white leading-tight">
              Turn any device into a{' '}
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 via-teal-300 to-emerald-400">
                WiFi Live Camera
              </span>
            </h1>
            <p className="text-slate-300 text-sm md:text-base leading-relaxed">
              Open your front or back camera and stream high-definition live video to any phone,
              computer, or tablet connected to your WiFi or network via an instant share link.
            </p>
          </div>

          {/* Quick Stats / WiFi Status Pill */}
          <div className="flex md:flex-col items-center md:items-end gap-3 w-full md:w-auto shrink-0">
            <div className="flex items-center gap-2.5 px-4 py-2.5 rounded-2xl bg-slate-800/90 border border-slate-700/80 shadow-lg">
              <div className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-ping" />
              <div className="text-left">
                <div className="text-xs font-bold text-slate-200 flex items-center gap-1.5">
                  <Wifi className="w-3.5 h-3.5 text-emerald-400" />
                  WiFi Stream Ready
                </div>
                <div className="text-[11px] text-slate-400 font-mono">Room: {roomId}</div>
              </div>
            </div>
            <button
              onClick={onOpenViewer}
              className="flex items-center gap-1.5 px-4 py-2.5 rounded-2xl bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-300 text-xs font-semibold border border-cyan-500/30 transition shadow-sm"
            >
              <Eye className="w-4 h-4 text-cyan-400" />
              Open Live Viewer
            </button>
          </div>
        </div>
      </div>

      {/* Main Options Grid (Front Camera, Back Camera, WiFi Share Link) */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* OPTION 1: OPEN FRONT CAMERA */}
        <div className="group relative rounded-3xl bg-slate-900/90 border border-slate-800 hover:border-cyan-500/50 transition-all duration-300 p-6 md:p-7 flex flex-col justify-between shadow-xl hover:shadow-cyan-500/10">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-cyan-500/20 to-blue-600/20 border border-cyan-500/30 flex items-center justify-center text-cyan-400 group-hover:scale-105 transition-transform">
                <FlipHorizontal className="w-7 h-7" />
              </div>
              <span className="text-[11px] font-semibold uppercase tracking-wider px-2.5 py-1 rounded-full bg-slate-800 text-cyan-300 border border-slate-700">
                Selfie / Face
              </span>
            </div>

            <div>
              <h2 className="text-xl font-bold text-white group-hover:text-cyan-300 transition-colors">
                Open Front Camera
              </h2>
              <p className="text-xs text-slate-400 mt-1.5 leading-relaxed">
                Stream the front-facing camera or built-in webcam. Perfect for baby monitoring,
                desk webcam, conference sharing, or selfie view.
              </p>
            </div>

            <div className="space-y-1.5 pt-2">
              <div className="flex items-center gap-2 text-xs text-slate-300">
                <Check className="w-3.5 h-3.5 text-cyan-400" />
                <span>Mirrored preview display</span>
              </div>
              <div className="flex items-center gap-2 text-xs text-slate-300">
                <Check className="w-3.5 h-3.5 text-cyan-400" />
                <span>Auto face exposure & focus</span>
              </div>
              <div className="flex items-center gap-2 text-xs text-slate-300">
                <Check className="w-3.5 h-3.5 text-cyan-400" />
                <span>Instant audio pass-through</span>
              </div>
            </div>
          </div>

          <div className="pt-6 mt-4 border-t border-slate-800/80">
            <button
              onClick={() => onStartCamera('user')}
              className="w-full py-3.5 px-4 rounded-xl font-bold text-sm bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white shadow-lg shadow-cyan-500/25 flex items-center justify-center gap-2 transition transform active:scale-98 cursor-pointer"
            >
              <Camera className="w-4 h-4" />
              Start Front Camera
            </button>
          </div>
        </div>

        {/* OPTION 2: OPEN BACK CAMERA */}
        <div className="group relative rounded-3xl bg-slate-900/90 border border-slate-800 hover:border-emerald-500/50 transition-all duration-300 p-6 md:p-7 flex flex-col justify-between shadow-xl hover:shadow-emerald-500/10">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-emerald-500/20 to-teal-600/20 border border-emerald-500/30 flex items-center justify-center text-emerald-400 group-hover:scale-105 transition-transform">
                <Camera className="w-7 h-7" />
              </div>
              <span className="text-[11px] font-semibold uppercase tracking-wider px-2.5 py-1 rounded-full bg-slate-800 text-emerald-300 border border-slate-700">
                Rear / Room
              </span>
            </div>

            <div>
              <h2 className="text-xl font-bold text-white group-hover:text-emerald-300 transition-colors">
                Open Back Camera
              </h2>
              <p className="text-xs text-slate-400 mt-1.5 leading-relaxed">
                Stream the rear high-resolution camera. Ideal for security monitoring, pets,
                document scanning, workshops, or room surveillance.
              </p>
            </div>

            <div className="space-y-1.5 pt-2">
              <div className="flex items-center gap-2 text-xs text-slate-300">
                <Check className="w-3.5 h-3.5 text-emerald-400" />
                <span>Full optical sensor resolution</span>
              </div>
              <div className="flex items-center gap-2 text-xs text-slate-300">
                <Check className="w-3.5 h-3.5 text-emerald-400" />
                <span>Torch & flashlight control</span>
              </div>
              <div className="flex items-center gap-2 text-xs text-slate-300">
                <Check className="w-3.5 h-3.5 text-emerald-400" />
                <span>True environment orientation</span>
              </div>
            </div>
          </div>

          <div className="pt-6 mt-4 border-t border-slate-800/80">
            <button
              onClick={() => onStartCamera('environment')}
              className="w-full py-3.5 px-4 rounded-xl font-bold text-sm bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-white shadow-lg shadow-emerald-500/25 flex items-center justify-center gap-2 transition transform active:scale-98 cursor-pointer"
            >
              <Video className="w-4 h-4" />
              Start Back Camera
            </button>
          </div>
        </div>

        {/* OPTION 3: WIFI SHARE LINK & QR CODE */}
        <div className="group relative rounded-3xl bg-slate-900/90 border border-slate-800 hover:border-amber-500/50 transition-all duration-300 p-6 md:p-7 flex flex-col justify-between shadow-xl hover:shadow-amber-500/10">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-amber-500/20 to-orange-600/20 border border-amber-500/30 flex items-center justify-center text-amber-400 group-hover:scale-105 transition-transform">
                <Wifi className="w-7 h-7" />
              </div>
              <span className="text-[11px] font-semibold uppercase tracking-wider px-2.5 py-1 rounded-full bg-slate-800 text-amber-300 border border-slate-700">
                Wireless Sync
              </span>
            </div>

            <div>
              <h2 className="text-xl font-bold text-white group-hover:text-amber-300 transition-colors">
                WiFi Share Link
              </h2>
              <p className="text-xs text-slate-400 mt-1.5 leading-relaxed">
                Connect receiver devices over WiFi. Share this link or scan the QR code to watch
                your camera feed in real-time from any browser.
              </p>
            </div>

            {/* Quick URL Box */}
            <div className="p-2.5 bg-slate-950/90 rounded-2xl border border-slate-800 space-y-2">
              <div className="flex items-center justify-between text-[11px] text-slate-400">
                <span>Receiver Link:</span>
                <span className="text-amber-400 font-mono text-[10px]">PIN: {roomId}</span>
              </div>
              <div className="text-xs font-mono text-slate-300 truncate bg-slate-900/90 px-2 py-1.5 rounded-lg border border-slate-800/80">
                {shareUrl}
              </div>
            </div>
          </div>

          <div className="space-y-2.5 pt-4 mt-2 border-t border-slate-800/80">
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={handleCopyLink}
                className={`py-2.5 px-3 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition cursor-pointer ${
                  copied
                    ? 'bg-emerald-600 text-white'
                    : 'bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700'
                }`}
              >
                {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                {copied ? 'Copied Link' : 'Copy WiFi Link'}
              </button>

              <button
                onClick={onOpenQrModal}
                className="py-2.5 px-3 rounded-xl text-xs font-semibold bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 border border-amber-500/30 flex items-center justify-center gap-1.5 transition cursor-pointer"
              >
                <QrCode className="w-3.5 h-3.5" />
                Show QR Code
              </button>
            </div>

            <button
              onClick={onOpenViewer}
              className="w-full py-2.5 px-4 rounded-xl text-xs font-semibold bg-slate-800/90 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700/80 flex items-center justify-center gap-1.5 transition cursor-pointer"
            >
              <ExternalLink className="w-3.5 h-3.5 text-cyan-400" />
              Test Viewer In This Browser
            </button>
          </div>
        </div>
      </div>

      {/* Broadcast Stream Settings Bar */}
      <div className="rounded-2xl bg-slate-900/60 border border-slate-800 p-5 backdrop-blur-sm">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-slate-800 text-slate-300 border border-slate-700">
              <Settings2 className="w-4 h-4 text-cyan-400" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-white">Stream Configuration</h3>
              <p className="text-xs text-slate-400">
                Adjust resolution and audio before opening camera
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
            {/* Audio Toggle */}
            <button
              onClick={onToggleAudio}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-medium border transition cursor-pointer ${
                enableAudio
                  ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
                  : 'bg-slate-800 border-slate-700 text-slate-400'
              }`}
            >
              {enableAudio ? (
                <>
                  <Mic className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Microphone: Streaming</span>
                </>
              ) : (
                <>
                  <MicOff className="w-3.5 h-3.5 text-slate-400" />
                  <span>Microphone: Muted</span>
                </>
              )}
            </button>

            {/* Quality Preset Select */}
            <div className="flex items-center gap-2 bg-slate-800/80 px-3 py-1.5 rounded-xl border border-slate-700">
              <span className="text-xs text-slate-400">Quality:</span>
              <select
                value={selectedQuality.id}
                onChange={(e) => {
                  const q = QUALITY_PRESETS.find((item) => item.id === e.target.value);
                  if (q) onSelectQuality(q);
                }}
                className="bg-transparent text-xs text-white outline-none cursor-pointer font-medium"
              >
                {QUALITY_PRESETS.map((q) => (
                  <option key={q.id} value={q.id} className="bg-slate-900 text-white">
                    {q.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* Feature & Security Badges */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
        <div className="p-4 rounded-2xl bg-slate-900/40 border border-slate-800/80 flex flex-col items-center gap-1.5">
          <Zap className="w-5 h-5 text-amber-400" />
          <span className="text-xs font-semibold text-slate-200">Ultra-Low Latency</span>
          <span className="text-[11px] text-slate-400">Direct WebRTC & WebSocket relay</span>
        </div>
        <div className="p-4 rounded-2xl bg-slate-900/40 border border-slate-800/80 flex flex-col items-center gap-1.5">
          <ShieldCheck className="w-5 h-5 text-emerald-400" />
          <span className="text-xs font-semibold text-slate-200">Private & Local</span>
          <span className="text-[11px] text-slate-400">Encrypted in-transit over WiFi</span>
        </div>
        <div className="p-4 rounded-2xl bg-slate-900/40 border border-slate-800/80 flex flex-col items-center gap-1.5">
          <Smartphone className="w-5 h-5 text-cyan-400" />
          <span className="text-xs font-semibold text-slate-200">Front & Back Switch</span>
          <span className="text-[11px] text-slate-400">Toggle lens anytime smoothly</span>
        </div>
        <div className="p-4 rounded-2xl bg-slate-900/40 border border-slate-800/80 flex flex-col items-center gap-1.5">
          <Layers className="w-5 h-5 text-purple-400" />
          <span className="text-xs font-semibold text-slate-200">Cross-Platform</span>
          <span className="text-[11px] text-slate-400">iOS, Android, Mac, Windows, Linux</span>
        </div>
      </div>
    </div>
  );
};
