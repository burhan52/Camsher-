import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
  Camera,
  FlipHorizontal,
  Zap,
  ZapOff,
  Mic,
  MicOff,
  Maximize2,
  Minimize2,
  Download,
  Video,
  CircleDot,
  Radio,
  Wifi,
  Users,
  QrCode,
  Copy,
  Check,
  ChevronLeft,
  Activity,
  AlertCircle,
  Eye,
  Settings,
} from 'lucide-react';
import { CameraFacing, StreamQuality, QUALITY_PRESETS } from '../types';
import { BroadcasterPeerManager } from '../utils/webrtc';
import { wakeLock } from '../utils/wakeLock';

interface CameraViewfinderProps {
  initialFacing: CameraFacing;
  quality: StreamQuality;
  enableAudio: boolean;
  roomId: string;
  shareUrl: string;
  onOpenQrModal: () => void;
  onStopCamera: () => void;
  onOpenViewer: () => void;
}

export const CameraViewfinder: React.FC<CameraViewfinderProps> = ({
  initialFacing,
  quality,
  enableAudio,
  roomId,
  shareUrl,
  onOpenQrModal,
  onStopCamera,
  onOpenViewer,
}) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  const [facing, setFacing] = useState<CameraFacing>(initialFacing);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [isTorchSupported, setIsTorchSupported] = useState<boolean>(false);
  const [isTorchOn, setIsTorchOn] = useState<boolean>(false);
  const [isMuted, setIsMuted] = useState<boolean>(!enableAudio);
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);
  const [selectedQuality, setSelectedQuality] = useState<StreamQuality>(quality);

  // Stats & Network State
  const [viewersCount, setViewersCount] = useState<number>(0);
  const [isBroadcasting, setIsBroadcasting] = useState<boolean>(false);
  const [wsConnected, setWsConnected] = useState<boolean>(false);
  const [fps, setFps] = useState<number>(30);
  const [uptime, setUptime] = useState<number>(0);
  const [motionDetected, setMotionDetected] = useState<boolean>(false);
  const [isMotionAlertActive, setIsMotionAlertActive] = useState<boolean>(false);
  const [copied, setCopied] = useState<boolean>(false);

  // Recording State
  const [isRecording, setIsRecording] = useState<boolean>(false);
  const [recordingSeconds, setRecordingSeconds] = useState<number>(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordedChunksRef = useRef<Blob[]>([]);

  // WebRTC & WebSocket references
  const wsRef = useRef<WebSocket | null>(null);
  const peerManagerRef = useRef<BroadcasterPeerManager | null>(null);
  const frameIntervalRef = useRef<any>(null);
  const prevFrameDataRef = useRef<Uint8ClampedArray | null>(null);

  // Uptime timer
  useEffect(() => {
    const timer = setInterval(() => {
      setUptime((prev) => prev + 1);
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Request WakeLock to keep screen from turning off while streaming
  useEffect(() => {
    wakeLock.request();
    return () => {
      wakeLock.release();
    };
  }, []);

  // Initialize camera stream
  const startCameraStream = useCallback(
    async (cameraFacing: CameraFacing, streamQuality: StreamQuality, micEnabled: boolean) => {
      try {
        if (stream) {
          stream.getTracks().forEach((track) => track.stop());
        }

        const constraints: MediaStreamConstraints = {
          video: {
            facingMode: cameraFacing === 'environment' ? { ideal: 'environment' } : 'user',
            width: { ideal: streamQuality.width },
            height: { ideal: streamQuality.height },
            frameRate: { ideal: streamQuality.frameRate },
          },
          audio: micEnabled ? { echoCancellation: true, noiseSuppression: true } : false,
        };

        const newStream = await navigator.mediaDevices.getUserMedia(constraints);
        setStream(newStream);

        if (videoRef.current) {
          videoRef.current.srcObject = newStream;
          videoRef.current.play().catch(() => {});
        }

        // Check if torch/flashlight is supported
        const videoTrack = newStream.getVideoTracks()[0];
        if (videoTrack) {
          const capabilities = (videoTrack.getCapabilities && videoTrack.getCapabilities()) as any;
          setIsTorchSupported(!!capabilities?.torch);
          setIsTorchOn(false);
        }

        // Update WebRTC peer manager
        if (peerManagerRef.current) {
          peerManagerRef.current.setStream(newStream);
        }

        // Notify server of camera state update
        if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
          wsRef.current.send(
            JSON.stringify({
              type: 'camera-state-update',
              roomId,
              cameraFacing,
              isTorchOn: false,
            })
          );
        }
      } catch (err) {
        console.error('Failed to get media stream:', err);
        // Fallback without exact constraints
        try {
          const fallbackConstraints: MediaStreamConstraints = {
            video: true,
            audio: micEnabled,
          };
          const fallbackStream = await navigator.mediaDevices.getUserMedia(fallbackConstraints);
          setStream(fallbackStream);
          if (videoRef.current) {
            videoRef.current.srcObject = fallbackStream;
            videoRef.current.play().catch(() => {});
          }
          if (peerManagerRef.current) {
            peerManagerRef.current.setStream(fallbackStream);
          }
        } catch (fallbackErr) {
          console.error('All camera attempts failed:', fallbackErr);
        }
      }
    },
    [roomId, stream]
  );

  // Initialize WebSocket & WebRTC
  useEffect(() => {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}`;
    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    const peerManager = new BroadcasterPeerManager((targetId, signalData) => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(
          JSON.stringify({
            type: 'signal',
            roomId,
            targetId,
            signalData,
          })
        );
      }
    });
    peerManagerRef.current = peerManager;

    ws.onopen = () => {
      setWsConnected(true);
      setIsBroadcasting(true);
      ws.send(
        JSON.stringify({
          type: 'register-broadcaster',
          roomId,
          cameraFacing: facing,
        })
      );
    };

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        if (msg.type === 'broadcaster-registered') {
          setViewersCount(msg.viewersCount || 0);
        } else if (msg.type === 'viewer-joined') {
          setViewersCount(msg.totalViewers || 1);
          peerManager.handleViewerJoined(msg.viewerId);
        } else if (msg.type === 'viewer-left') {
          setViewersCount(msg.totalViewers || 0);
          peerManager.closePeer(msg.viewerId);
        } else if (msg.type === 'signal') {
          peerManager.handleSignal(msg.fromId, msg.signalData);
        } else if (msg.type === 'viewer-command') {
          // Viewer requested a camera switch or torch toggle remotely
          if (msg.command === 'switch-camera') {
            toggleCameraFacing();
          } else if (msg.command === 'toggle-torch') {
            toggleTorch();
          }
        }
      } catch (e) {
        console.error('Failed to parse WS msg:', e);
      }
    };

    ws.onclose = () => {
      setWsConnected(false);
      setIsBroadcasting(false);
    };

    return () => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.close();
      }
      peerManager.destroy();
    };
  }, [roomId]);

  // Start camera on mount
  useEffect(() => {
    startCameraStream(facing, selectedQuality, !isMuted);
    return () => {
      if (stream) {
        stream.getTracks().forEach((track) => track.stop());
      }
    };
  }, []);

  // Frame streaming relay & motion detection loop (dual-layer fallback for WebRTC)
  useEffect(() => {
    let lastTime = performance.now();
    let frameCount = 0;

    const sendFrame = () => {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      if (!video || !canvas || video.readyState < 2) return;

      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      if (!ctx) return;

      // Draw downscaled frame for lightweight network relay
      const targetWidth = 480;
      const targetHeight = Math.round((video.videoHeight / (video.videoWidth || 1)) * targetWidth) || 270;
      canvas.width = targetWidth;
      canvas.height = targetHeight;

      ctx.drawImage(video, 0, 0, targetWidth, targetHeight);

      // Frame Rate measurement
      frameCount++;
      const now = performance.now();
      if (now - lastTime >= 1000) {
        setFps(frameCount);
        frameCount = 0;
        lastTime = now;
      }

      // Motion Detection check if enabled
      if (isMotionAlertActive) {
        try {
          const imgData = ctx.getImageData(0, 0, targetWidth, targetHeight).data;
          if (prevFrameDataRef.current) {
            let diffCount = 0;
            const step = 16; // Sample pixels for speed
            for (let i = 0; i < imgData.length; i += 4 * step) {
              const diffR = Math.abs(imgData[i] - prevFrameDataRef.current[i]);
              const diffG = Math.abs(imgData[i + 1] - prevFrameDataRef.current[i + 1]);
              const diffB = Math.abs(imgData[i + 2] - prevFrameDataRef.current[i + 2]);
              if (diffR + diffG + diffB > 90) {
                diffCount++;
              }
            }
            if (diffCount > 35) {
              setMotionDetected(true);
            } else {
              setMotionDetected(false);
            }
          }
          prevFrameDataRef.current = new Uint8ClampedArray(imgData);
        } catch {}
      }

      // Send fallback frame via WebSocket to viewers
      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN && viewersCount > 0) {
        const frameData = canvas.toDataURL('image/jpeg', 0.55);
        wsRef.current.send(
          JSON.stringify({
            type: 'video-frame',
            roomId,
            frame: frameData,
            timestamp: Date.now(),
          })
        );
      }
    };

    frameIntervalRef.current = setInterval(sendFrame, 100); // 10 FPS fallback stream

    return () => {
      if (frameIntervalRef.current) clearInterval(frameIntervalRef.current);
    };
  }, [isMotionAlertActive, roomId, viewersCount]);

  // Switch between front and back camera
  const toggleCameraFacing = async () => {
    const nextFacing: CameraFacing = facing === 'user' ? 'environment' : 'user';
    setFacing(nextFacing);
    await startCameraStream(nextFacing, selectedQuality, !isMuted);
  };

  // Toggle Torch/Flashlight
  const toggleTorch = async () => {
    if (!stream) return;
    const track = stream.getVideoTracks()[0];
    if (!track) return;

    try {
      const nextTorch = !isTorchOn;
      await (track as any).applyConstraints({
        advanced: [{ torch: nextTorch }],
      });
      setIsTorchOn(nextTorch);

      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        wsRef.current.send(
          JSON.stringify({
            type: 'camera-state-update',
            roomId,
            cameraFacing: facing,
            isTorchOn: nextTorch,
          })
        );
      }
    } catch (err) {
      console.warn('Torch toggle not supported on this track', err);
    }
  };

  // Toggle Audio Mute
  const toggleAudio = () => {
    if (!stream) return;
    const audioTrack = stream.getAudioTracks()[0];
    if (audioTrack) {
      audioTrack.enabled = !audioTrack.enabled;
      setIsMuted(!audioTrack.enabled);
    } else {
      // Re-initialize with mic
      const nextMuted = !isMuted;
      setIsMuted(nextMuted);
      startCameraStream(facing, selectedQuality, !nextMuted);
    }
  };

  // Switch Quality
  const handleQualityChange = (newQuality: StreamQuality) => {
    setSelectedQuality(newQuality);
    startCameraStream(facing, newQuality, !isMuted);
  };

  // Fullscreen
  const toggleFullscreen = () => {
    if (!containerRef.current) return;
    if (!document.fullscreenElement) {
      containerRef.current.requestFullscreen().catch(() => {});
      setIsFullscreen(true);
    } else {
      document.exitFullscreen().catch(() => {});
      setIsFullscreen(false);
    }
  };

  // Take high resolution snapshot
  const takeSnapshot = () => {
    const video = videoRef.current;
    if (!video) return;

    const snapCanvas = document.createElement('canvas');
    snapCanvas.width = video.videoWidth || 1280;
    snapCanvas.height = video.videoHeight || 720;
    const ctx = snapCanvas.getContext('2d');
    if (!ctx) return;

    if (facing === 'user') {
      ctx.translate(snapCanvas.width, 0);
      ctx.scale(-1, 1);
    }
    ctx.drawImage(video, 0, 0, snapCanvas.width, snapCanvas.height);

    const link = document.createElement('a');
    link.download = `wifi-cam-snapshot-${Date.now()}.jpg`;
    link.href = snapCanvas.toDataURL('image/jpeg', 0.95);
    link.click();
  };

  // Video recording
  const toggleRecording = () => {
    if (isRecording) {
      // Stop recording
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
        mediaRecorderRef.current.stop();
      }
      setIsRecording(false);
    } else {
      // Start recording
      if (!stream) return;
      recordedChunksRef.current = [];
      try {
        const recorder = new MediaRecorder(stream, { mimeType: 'video/webm;codecs=vp8,opus' });
        recorder.ondataavailable = (e) => {
          if (e.data.size > 0) {
            recordedChunksRef.current.push(e.data);
          }
        };
        recorder.onstop = () => {
          const blob = new Blob(recordedChunksRef.current, { type: 'video/webm' });
          const url = URL.createObjectURL(blob);
          const link = document.createElement('a');
          link.href = url;
          link.download = `wifi-cam-recording-${Date.now()}.webm`;
          link.click();
          URL.revokeObjectURL(url);
          setRecordingSeconds(0);
        };
        recorder.start(1000);
        mediaRecorderRef.current = recorder;
        setIsRecording(true);
      } catch (err) {
        console.error('Failed to start MediaRecorder:', err);
      }
    }
  };

  // Recording timer
  useEffect(() => {
    let recTimer: any;
    if (isRecording) {
      recTimer = setInterval(() => {
        setRecordingSeconds((prev) => prev + 1);
      }, 1000);
    }
    return () => {
      if (recTimer) clearInterval(recTimer);
    };
  }, [isRecording]);

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    }
  };

  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  return (
    <div
      ref={containerRef}
      className={`relative w-full max-w-6xl mx-auto flex flex-col bg-slate-950 text-slate-100 ${
        isFullscreen ? 'h-screen p-0' : 'p-3 md:p-6 space-y-4'
      }`}
    >
      {/* Top Bar Navigation & Broadcaster Status */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-900/90 border border-slate-800 p-3.5 rounded-2xl shadow-lg backdrop-blur-md">
        <div className="flex items-center gap-2.5">
          <button
            onClick={onStopCamera}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-300 transition cursor-pointer"
          >
            <ChevronLeft className="w-4 h-4" />
            Home
          </button>

          <div className="h-4 w-px bg-slate-800 hidden sm:block" />

          <div className="flex items-center gap-2">
            <span className="flex h-3 w-3 relative">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500"></span>
            </span>
            <span className="text-xs font-bold text-red-400 uppercase tracking-wider">
              LIVE BROADCAST
            </span>
          </div>

          <span className="text-xs font-mono text-slate-400 hidden sm:inline">
            Uptime: {formatTime(uptime)}
          </span>
        </div>

        {/* Viewers & WiFi Status */}
        <div className="flex items-center gap-2.5">
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800/80 border border-slate-700 text-xs text-slate-200">
            <Users className="w-3.5 h-3.5 text-cyan-400" />
            <span className="font-semibold">{viewersCount}</span>
            <span className="text-slate-400 hidden md:inline">
              {viewersCount === 1 ? 'Viewer' : 'Viewers'}
            </span>
          </div>

          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-xs text-emerald-300 font-medium">
            <Wifi className="w-3.5 h-3.5 text-emerald-400" />
            <span className="hidden sm:inline">WiFi Online</span>
          </div>

          <button
            onClick={onOpenQrModal}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-semibold shadow-sm transition cursor-pointer"
          >
            <QrCode className="w-3.5 h-3.5" />
            Share Link
          </button>
        </div>
      </div>

      {/* Main Viewfinder Screen */}
      <div className="relative w-full aspect-video bg-black rounded-3xl overflow-hidden border border-slate-800 shadow-2xl flex items-center justify-center">
        {/* Hidden Canvas for Frame Processing */}
        <canvas ref={canvasRef} className="hidden" />

        {/* Video Element */}
        <video
          ref={videoRef}
          playsInline
          autoPlay
          muted
          className={`w-full h-full object-contain ${facing === 'user' ? 'scale-x-[-1]' : ''}`}
        />

        {/* Motion Alert Flash Overlay */}
        {motionDetected && isMotionAlertActive && (
          <div className="absolute inset-0 border-4 border-amber-500/80 bg-amber-500/10 pointer-events-none animate-pulse flex items-top justify-center p-4">
            <div className="px-3 py-1 bg-amber-500 text-black text-xs font-bold rounded-full shadow-lg flex items-center gap-1.5">
              <Activity className="w-3.5 h-3.5" />
              Motion Detected in Camera Field
            </div>
          </div>
        )}

        {/* Recording Indicator */}
        {isRecording && (
          <div className="absolute top-4 left-4 z-20 flex items-center gap-2 px-3 py-1.5 rounded-full bg-red-600/90 text-white text-xs font-bold shadow-lg animate-pulse backdrop-blur-sm">
            <CircleDot className="w-3.5 h-3.5" />
            <span>REC {formatTime(recordingSeconds)}</span>
          </div>
        )}

        {/* HUD Top Left Stats */}
        <div className="absolute top-4 right-4 z-20 flex items-center gap-2">
          <div className="px-2.5 py-1 rounded-lg bg-black/60 backdrop-blur-md border border-white/10 text-[11px] font-mono text-slate-300">
            {fps} FPS
          </div>
          <div className="px-2.5 py-1 rounded-lg bg-black/60 backdrop-blur-md border border-white/10 text-[11px] font-mono text-cyan-300 uppercase">
            {facing === 'user' ? 'Front' : 'Back'} Cam
          </div>
        </div>

        {/* Quick Lens Switcher Pill Floating in Viewfinder */}
        <div className="absolute top-4 left-4 z-10 hidden sm:flex items-center gap-1.5 p-1 bg-slate-900/80 backdrop-blur-md border border-slate-700/80 rounded-2xl">
          <button
            onClick={() => {
              if (facing !== 'user') toggleCameraFacing();
            }}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition ${
              facing === 'user'
                ? 'bg-cyan-500 text-white shadow-md'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <FlipHorizontal className="w-3.5 h-3.5" />
            Front
          </button>
          <button
            onClick={() => {
              if (facing !== 'environment') toggleCameraFacing();
            }}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition ${
              facing === 'environment'
                ? 'bg-emerald-500 text-white shadow-md'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Camera className="w-3.5 h-3.5" />
            Back
          </button>
        </div>

        {/* Viewfinder Bottom Controls Bar */}
        <div className="absolute bottom-4 inset-x-4 z-20 flex items-center justify-between gap-3 p-2.5 bg-slate-950/80 backdrop-blur-lg border border-slate-800/80 rounded-2xl">
          {/* Left Actions: Switch Camera & Torch */}
          <div className="flex items-center gap-2">
            <button
              onClick={toggleCameraFacing}
              title={`Switch to ${facing === 'user' ? 'Back' : 'Front'} Camera`}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold border border-slate-700 transition cursor-pointer"
            >
              <FlipHorizontal className="w-4 h-4 text-cyan-400" />
              <span className="hidden sm:inline">
                {facing === 'user' ? 'Switch to Back' : 'Switch to Front'}
              </span>
            </button>

            {isTorchSupported && (
              <button
                onClick={toggleTorch}
                title="Toggle Torch/Flash"
                className={`p-2 rounded-xl text-xs border transition cursor-pointer ${
                  isTorchOn
                    ? 'bg-amber-500 text-black border-amber-400 shadow-amber-500/30'
                    : 'bg-slate-800 hover:bg-slate-700 text-slate-300 border-slate-700'
                }`}
              >
                {isTorchOn ? <Zap className="w-4 h-4" /> : <ZapOff className="w-4 h-4" />}
              </button>
            )}

            <button
              onClick={toggleAudio}
              title={isMuted ? 'Unmute microphone' : 'Mute microphone'}
              className={`p-2 rounded-xl text-xs border transition cursor-pointer ${
                !isMuted
                  ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                  : 'bg-slate-800 hover:bg-slate-700 text-slate-400 border-slate-700'
              }`}
            >
              {isMuted ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
            </button>
          </div>

          {/* Center Actions: Snapshot & Record */}
          <div className="flex items-center gap-2.5">
            <button
              onClick={takeSnapshot}
              title="Capture High-Res Photo"
              className="p-2.5 rounded-full bg-slate-800 hover:bg-slate-700 text-white border border-slate-700 shadow-md transition transform active:scale-95 cursor-pointer"
            >
              <Download className="w-4 h-4 text-cyan-400" />
            </button>

            <button
              onClick={toggleRecording}
              title={isRecording ? 'Stop Recording' : 'Start Video Recording'}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-full text-xs font-bold transition transform active:scale-95 cursor-pointer ${
                isRecording
                  ? 'bg-red-600 hover:bg-red-500 text-white shadow-lg shadow-red-500/40 animate-pulse'
                  : 'bg-slate-800 hover:bg-slate-700 text-red-400 border border-slate-700'
              }`}
            >
              <CircleDot className="w-4 h-4 text-red-500" />
              <span>{isRecording ? 'Stop Recording' : 'Record Clip'}</span>
            </button>
          </div>

          {/* Right Actions: Quality & Fullscreen */}
          <div className="flex items-center gap-2">
            <select
              value={selectedQuality.id}
              onChange={(e) => {
                const q = QUALITY_PRESETS.find((p) => p.id === e.target.value);
                if (q) handleQualityChange(q);
              }}
              className="bg-slate-800 text-slate-300 text-xs rounded-xl px-2.5 py-2 border border-slate-700 outline-none cursor-pointer hidden md:block"
            >
              {QUALITY_PRESETS.map((p) => (
                <option key={p.id} value={p.id} className="bg-slate-900 text-white">
                  {p.id.toUpperCase()}
                </option>
              ))}
            </select>

            <button
              onClick={toggleFullscreen}
              className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition cursor-pointer"
            >
              {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
            </button>
          </div>
        </div>
      </div>

      {/* WiFi Share Bar Beneath Viewfinder */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-900/90 to-cyan-950/30 border border-slate-800 p-4 md:p-5 rounded-2xl shadow-xl flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-3 w-full md:w-auto">
          <div className="p-2.5 rounded-xl bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 shrink-0">
            <Wifi className="w-5 h-5 animate-pulse" />
          </div>
          <div className="overflow-hidden">
            <div className="flex items-center gap-2">
              <span className="text-sm font-bold text-white">WiFi Share Link</span>
              <span className="text-[11px] font-mono px-2 py-0.5 rounded-md bg-slate-800 text-cyan-300 border border-slate-700">
                PIN: {roomId}
              </span>
            </div>
            <p className="text-xs text-slate-400 truncate mt-0.5 max-w-sm md:max-w-md">
              {shareUrl}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 w-full md:w-auto shrink-0">
          <button
            onClick={handleCopyLink}
            className={`flex-1 md:flex-none flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl text-xs font-bold transition cursor-pointer ${
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
            className="flex-1 md:flex-none flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl text-xs font-bold bg-cyan-600 hover:bg-cyan-500 text-white shadow-md transition cursor-pointer"
          >
            <QrCode className="w-3.5 h-3.5" />
            Show QR Code
          </button>

          <button
            onClick={onOpenViewer}
            className="p-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 transition cursor-pointer"
            title="Open Viewer In New Tab"
          >
            <Eye className="w-4 h-4 text-cyan-400" />
          </button>
        </div>
      </div>
    </div>
  );
};
