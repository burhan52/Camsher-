import React, { useEffect, useRef, useState } from 'react';
import {
  Video,
  Volume2,
  VolumeX,
  Maximize2,
  Minimize2,
  Download,
  CircleDot,
  FlipHorizontal,
  Zap,
  ZapOff,
  Radio,
  Wifi,
  WifiOff,
  RefreshCw,
  Sun,
  Moon,
  ZoomIn,
  ZoomOut,
  Camera,
  PictureInPicture2,
  ChevronLeft,
  Sparkles,
  Shrink,
  Expand,
  Sliders,
} from 'lucide-react';
import { CameraFacing } from '../types';
import { ViewerPeerManager } from '../utils/webrtc';

interface ViewerStreamProps {
  roomId: string;
  onBackToHome: () => void;
}

export const ViewerStream: React.FC<ViewerStreamProps> = ({ roomId, onBackToHome }) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  const [hasBroadcaster, setHasBroadcaster] = useState<boolean>(false);
  const [cameraFacing, setCameraFacing] = useState<CameraFacing>('environment');
  const [isTorchOn, setIsTorchOn] = useState<boolean>(false);
  const [isLowLight, setIsLowLight] = useState<boolean>(false);
  const [isMuted, setIsMuted] = useState<boolean>(true);
  const [volume, setVolume] = useState<number>(1);

  // Screen sizing mode: standard, fullscreen, or small screen (compact mini-player)
  const [viewMode, setViewMode] = useState<'standard' | 'fullscreen' | 'small'>('standard');
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);

  // Zoom and filter
  const [zoomLevel, setZoomLevel] = useState<number>(1);
  const [videoFilter, setVideoFilter] = useState<'normal' | 'night' | 'bw' | 'vivid'>('normal');

  // Stream stats
  const [fps, setFps] = useState<number>(0);
  const [latencyMs, setLatencyMs] = useState<number>(15);
  const [connectionStatus, setConnectionStatus] = useState<'connecting' | 'connected' | 'disconnected'>('connecting');
  const [usingFallbackStream, setUsingFallbackStream] = useState<boolean>(false);

  // Recording
  const [isRecording, setIsRecording] = useState<boolean>(false);
  const [recordingSeconds, setRecordingSeconds] = useState<number>(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordedChunksRef = useRef<Blob[]>([]);

  // Remote stream & socket refs
  const wsRef = useRef<WebSocket | null>(null);
  const peerManagerRef = useRef<ViewerPeerManager | null>(null);
  const remoteStreamRef = useRef<MediaStream | null>(null);
  const frameCountRef = useRef<number>(0);
  const lastFpsCalcRef = useRef<number>(performance.now());

  // Listen to fullscreenchange event
  useEffect(() => {
    const handleFullscreenChange = () => {
      const isNowFullscreen = !!document.fullscreenElement;
      setIsFullscreen(isNowFullscreen);
      if (!isNowFullscreen && viewMode === 'fullscreen') {
        setViewMode('standard');
      }
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
    };
  }, [viewMode]);

  // Initialize Viewer connection
  useEffect(() => {
    setConnectionStatus('connecting');
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}`;
    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    const peerManager = new ViewerPeerManager(
      (stream) => {
        remoteStreamRef.current = stream;
        setUsingFallbackStream(false);
        setHasBroadcaster(true);
        setConnectionStatus('connected');

        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.play().catch(() => {});
        }
      },
      (signalData) => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(
            JSON.stringify({
              type: 'signal',
              roomId,
              targetId: 'broadcaster',
              signalData,
            })
          );
        }
      }
    );
    peerManagerRef.current = peerManager;

    ws.onopen = () => {
      ws.send(
        JSON.stringify({
          type: 'join-viewer',
          roomId,
        })
      );
    };

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);

        if (msg.type === 'viewer-joined-ack') {
          setHasBroadcaster(msg.hasBroadcaster);
          if (msg.cameraFacing) setCameraFacing(msg.cameraFacing);
          if (typeof msg.isTorchOn === 'boolean') setIsTorchOn(msg.isTorchOn);
          if (typeof msg.isLowLight === 'boolean') setIsLowLight(msg.isLowLight);
          setConnectionStatus(msg.hasBroadcaster ? 'connected' : 'connecting');
        } else if (msg.type === 'broadcaster-joined') {
          setHasBroadcaster(true);
          setConnectionStatus('connected');
          if (msg.cameraFacing) setCameraFacing(msg.cameraFacing);
        } else if (msg.type === 'broadcaster-disconnected') {
          setHasBroadcaster(false);
          setConnectionStatus('disconnected');
          if (videoRef.current) {
            videoRef.current.srcObject = null;
          }
        } else if (msg.type === 'signal') {
          peerManager.handleSignal(msg.signalData);
        } else if (msg.type === 'video-frame') {
          // If native WebRTC video isn't active, render fallback frame
          if (!remoteStreamRef.current || videoRef.current?.paused) {
            setUsingFallbackStream(true);
            setHasBroadcaster(true);
            setConnectionStatus('connected');
            if (msg.facing) setCameraFacing(msg.facing);
            if (typeof msg.isLowLight === 'boolean') setIsLowLight(msg.isLowLight);

            const canvas = canvasRef.current;
            if (canvas && msg.frame) {
              const ctx = canvas.getContext('2d');
              const img = new Image();
              img.onload = () => {
                canvas.width = img.width;
                canvas.height = img.height;
                ctx?.drawImage(img, 0, 0);
              };
              img.src = msg.frame;
            }
          }

          if (msg.timestamp) {
            const currentLatency = Math.max(8, Date.now() - msg.timestamp);
            setLatencyMs(currentLatency);
          }
          frameCountRef.current++;
          const now = performance.now();
          if (now - lastFpsCalcRef.current >= 1000) {
            setFps(frameCountRef.current);
            frameCountRef.current = 0;
            lastFpsCalcRef.current = now;
          }
        } else if (msg.type === 'camera-state-update') {
          if (msg.cameraFacing) setCameraFacing(msg.cameraFacing);
          if (typeof msg.isTorchOn === 'boolean') setIsTorchOn(msg.isTorchOn);
          if (typeof msg.isLowLight === 'boolean') setIsLowLight(msg.isLowLight);
        }
      } catch (err) {
        console.error('Failed to parse viewer WS message', err);
      }
    };

    ws.onclose = () => {
      setConnectionStatus('disconnected');
    };

    return () => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.close();
      }
      peerManager.close();
    };
  }, [roomId]);

  // Request broadcaster to toggle camera (Front <-> Back)
  const requestCameraSwitch = () => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(
        JSON.stringify({
          type: 'viewer-command',
          roomId,
          command: 'switch-camera',
        })
      );
    }
  };

  // Request broadcaster to toggle Low Light mode
  const requestLowLightToggle = () => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(
        JSON.stringify({
          type: 'viewer-command',
          roomId,
          command: 'toggle-low-light',
        })
      );
    }
  };

  // Request broadcaster to toggle torch
  const requestTorchToggle = () => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(
        JSON.stringify({
          type: 'viewer-command',
          roomId,
          command: 'toggle-torch',
        })
      );
    }
  };

  // Full Screen Toggle
  const toggleFullScreen = () => {
    if (!containerRef.current) return;
    if (!document.fullscreenElement) {
      containerRef.current.requestFullscreen().catch(() => {});
      setIsFullscreen(true);
      setViewMode('fullscreen');
    } else {
      document.exitFullscreen().catch(() => {});
      setIsFullscreen(false);
      setViewMode('standard');
    }
  };

  // Small Screen Toggle (Switch between Small Screen mode and Standard mode)
  const toggleSmallScreen = () => {
    if (document.fullscreenElement) {
      document.exitFullscreen().catch(() => {});
      setIsFullscreen(false);
    }
    setViewMode((prev) => (prev === 'small' ? 'standard' : 'small'));
  };

  // Audio unmute / mute
  const toggleMute = () => {
    if (!videoRef.current) return;
    const nextMuted = !isMuted;
    videoRef.current.muted = nextMuted;
    setIsMuted(nextMuted);
    if (!nextMuted) {
      videoRef.current.volume = volume;
      videoRef.current.play().catch(() => {});
    }
  };

  // Snapshot Capture from Viewer
  const takeSnapshot = () => {
    const snapCanvas = document.createElement('canvas');
    if (usingFallbackStream && canvasRef.current) {
      snapCanvas.width = canvasRef.current.width || 1280;
      snapCanvas.height = canvasRef.current.height || 720;
      const ctx = snapCanvas.getContext('2d');
      ctx?.drawImage(canvasRef.current, 0, 0);
    } else if (videoRef.current) {
      const v = videoRef.current;
      snapCanvas.width = v.videoWidth || 1280;
      snapCanvas.height = v.videoHeight || 720;
      const ctx = snapCanvas.getContext('2d');
      if (cameraFacing === 'user') {
        ctx?.translate(snapCanvas.width, 0);
        ctx?.scale(-1, 1);
      }
      ctx?.drawImage(v, 0, 0, snapCanvas.width, snapCanvas.height);
    }

    const link = document.createElement('a');
    link.download = `wifi-viewer-snapshot-${Date.now()}.jpg`;
    link.href = snapCanvas.toDataURL('image/jpeg', 0.95);
    link.click();
  };

  // Record Stream on Viewer side
  const toggleRecording = () => {
    if (isRecording) {
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
        mediaRecorderRef.current.stop();
      }
      setIsRecording(false);
    } else {
      if (!remoteStreamRef.current) return;
      recordedChunksRef.current = [];
      try {
        const recorder = new MediaRecorder(remoteStreamRef.current, {
          mimeType: 'video/webm;codecs=vp8,opus',
        });
        recorder.ondataavailable = (e) => {
          if (e.data.size > 0) recordedChunksRef.current.push(e.data);
        };
        recorder.onstop = () => {
          const blob = new Blob(recordedChunksRef.current, { type: 'video/webm' });
          const url = URL.createObjectURL(blob);
          const link = document.createElement('a');
          link.href = url;
          link.download = `wifi-viewer-recording-${Date.now()}.webm`;
          link.click();
          URL.revokeObjectURL(url);
          setRecordingSeconds(0);
        };
        recorder.start(1000);
        mediaRecorderRef.current = recorder;
        setIsRecording(true);
      } catch (err) {
        console.error('Failed to record on viewer:', err);
      }
    }
  };

  useEffect(() => {
    let timer: any;
    if (isRecording) {
      timer = setInterval(() => setRecordingSeconds((s) => s + 1), 1000);
    }
    return () => {
      if (timer) clearInterval(timer);
    };
  }, [isRecording]);

  // Picture in Picture
  const togglePiP = async () => {
    if (!videoRef.current) return;
    try {
      if (document.pictureInPictureElement) {
        await document.exitPictureInPicture();
      } else {
        await videoRef.current.requestPictureInPicture();
      }
    } catch (e) {
      console.warn('PiP not available', e);
    }
  };

  // Zoom controls
  const handleZoom = (direction: 'in' | 'out') => {
    setZoomLevel((prev) => {
      if (direction === 'in') return Math.min(prev + 0.5, 3.0);
      return Math.max(prev - 0.5, 1.0);
    });
  };

  // Filter styles
  const getFilterClass = () => {
    switch (videoFilter) {
      case 'night':
        return 'brightness-135 contrast-125 saturate-150';
      case 'bw':
        return 'grayscale contrast-125';
      case 'vivid':
        return 'saturate-150 contrast-110';
      default:
        return '';
    }
  };

  return (
    <div
      ref={containerRef}
      className={`relative w-full mx-auto flex flex-col bg-slate-950 text-slate-100 transition-all duration-300 ${
        isFullscreen
          ? 'h-screen p-0 max-w-none'
          : viewMode === 'small'
          ? 'max-w-md p-3 space-y-3'
          : 'max-w-6xl p-3 md:p-6 space-y-4'
      }`}
    >
      {/* Top Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-900/90 border border-slate-800 p-3.5 rounded-2xl shadow-lg backdrop-blur-md">
        <div className="flex items-center gap-2.5">
          <button
            onClick={onBackToHome}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-300 transition cursor-pointer"
          >
            <ChevronLeft className="w-4 h-4" />
            Home
          </button>

          <div className="h-4 w-px bg-slate-800 hidden sm:block" />

          <div className="flex items-center gap-2">
            <span
              className={`flex h-2.5 w-2.5 rounded-full ${
                hasBroadcaster ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400 animate-ping'
              }`}
            />
            <span className="text-xs font-bold text-slate-200">
              {hasBroadcaster ? 'LIVE CAMERA FEED' : 'CONNECTING TO CAMERA...'}
            </span>
          </div>

          <span className="text-xs font-mono px-2 py-0.5 rounded-md bg-slate-800 text-cyan-300 border border-slate-700">
            Room: {roomId}
          </span>
        </div>

        {/* View Size Mode Pills (Small Screen / Standard / Full Screen) */}
        <div className="flex items-center gap-2">
          {/* Low Light Badge */}
          {isLowLight && (
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-amber-500/20 border border-amber-500/40 text-amber-300 text-xs font-semibold animate-pulse">
              <Moon className="w-3.5 h-3.5 text-amber-400" />
              <span className="hidden sm:inline">Low Light Mode</span>
            </div>
          )}

          {/* Quick Screen Sizing Controls */}
          <div className="flex items-center bg-slate-800/90 p-1 rounded-xl border border-slate-700">
            <button
              onClick={toggleSmallScreen}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold transition cursor-pointer ${
                viewMode === 'small'
                  ? 'bg-cyan-500 text-white shadow'
                  : 'text-slate-300 hover:text-white'
              }`}
              title="Small Screen / Compact Mini View"
            >
              <Shrink className="w-3.5 h-3.5" />
              <span>Small Screen</span>
            </button>

            <button
              onClick={toggleFullScreen}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold transition cursor-pointer ${
                isFullscreen
                  ? 'bg-cyan-500 text-white shadow'
                  : 'text-slate-300 hover:text-white'
              }`}
              title="Full Screen Video"
            >
              <Expand className="w-3.5 h-3.5" />
              <span>Full Screen</span>
            </button>
          </div>
        </div>
      </div>

      {/* Main Video Receiver Screen */}
      <div
        className={`relative w-full aspect-video bg-black rounded-3xl overflow-hidden border border-slate-800 shadow-2xl flex items-center justify-center transition-all ${
          viewMode === 'small' ? 'max-h-64' : ''
        }`}
      >
        {/* Native WebRTC Video Element */}
        <video
          ref={videoRef}
          playsInline
          autoPlay
          muted={isMuted}
          className={`w-full h-full object-contain transition-transform duration-200 ${
            cameraFacing === 'user' ? 'scale-x-[-1]' : ''
          } ${getFilterClass()} ${usingFallbackStream ? 'hidden' : 'block'}`}
          style={{ transform: `scale(${zoomLevel})` }}
        />

        {/* Fallback Canvas Element (if WebRTC is blocked/connecting) */}
        <canvas
          ref={canvasRef}
          className={`w-full h-full object-contain transition-transform duration-200 ${
            cameraFacing === 'user' ? 'scale-x-[-1]' : ''
          } ${getFilterClass()} ${usingFallbackStream ? 'block' : 'hidden'}`}
          style={{ transform: `scale(${zoomLevel})` }}
        />

        {/* Waiting / Disconnected State */}
        {!hasBroadcaster && (
          <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center bg-slate-950/90 backdrop-blur-sm z-30">
            <div className="w-16 h-16 rounded-2xl bg-slate-900 border border-slate-800 flex items-center justify-center text-cyan-400 mb-4 animate-bounce">
              <Camera className="w-8 h-8" />
            </div>
            <h3 className="text-lg font-bold text-white">Waiting for Camera Stream...</h3>
            <p className="text-xs text-slate-400 max-w-md mt-1.5 leading-relaxed">
              Open the front or back camera on the broadcasting device in Room{' '}
              <span className="font-mono text-cyan-300 font-bold">{roomId}</span>. This feed will
              instantly stream once connected over WiFi.
            </p>
            <div className="flex items-center gap-2 mt-5">
              <button
                onClick={() => window.location.reload()}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-semibold shadow-md transition"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                Refresh Feed
              </button>
            </div>
          </div>
        )}

        {/* Unmute Overlay Prompt (if muted) */}
        {hasBroadcaster && isMuted && (
          <div className="absolute top-4 left-4 z-20">
            <button
              onClick={toggleMute}
              className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-black/75 hover:bg-black/90 text-white text-xs font-semibold backdrop-blur-md border border-white/20 transition cursor-pointer"
            >
              <VolumeX className="w-4 h-4 text-amber-400" />
              <span>Tap to Unmute Audio</span>
            </button>
          </div>
        )}

        {/* Recording Indicator */}
        {isRecording && (
          <div className="absolute top-4 left-4 z-20 flex items-center gap-2 px-3 py-1.5 rounded-full bg-red-600/90 text-white text-xs font-bold shadow-lg animate-pulse backdrop-blur-sm">
            <CircleDot className="w-3.5 h-3.5" />
            <span>
              REC {Math.floor(recordingSeconds / 60)}:
              {(recordingSeconds % 60).toString().padStart(2, '0')}
            </span>
          </div>
        )}

        {/* HUD Top Right Info */}
        <div className="absolute top-4 right-4 z-20 flex items-center gap-2">
          {zoomLevel > 1 && (
            <div className="px-2.5 py-1 rounded-lg bg-black/60 backdrop-blur-md border border-white/10 text-[11px] font-mono text-amber-300">
              {zoomLevel}x Zoom
            </div>
          )}
          <div className="px-2.5 py-1 rounded-lg bg-black/60 backdrop-blur-md border border-white/10 text-[11px] font-mono text-slate-300">
            {fps > 0 ? `${fps} FPS` : 'LIVE'}
          </div>
        </div>

        {/* Viewer Control Bar */}
        <div className="absolute bottom-4 inset-x-4 z-20 flex items-center justify-between gap-2 p-2.5 bg-slate-950/85 backdrop-blur-lg border border-slate-800/80 rounded-2xl">
          {/* Left: Remote Camera Switch, Low Light & Torch */}
          <div className="flex items-center gap-1.5 sm:gap-2">
            <button
              onClick={requestCameraSwitch}
              title="Request Broadcaster to Switch Camera (Front/Back)"
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold border border-slate-700 transition cursor-pointer"
            >
              <FlipHorizontal className="w-4 h-4 text-cyan-400" />
              <span className="hidden md:inline">Flip Camera</span>
            </button>

            {/* Remote Low Light Mode Toggle */}
            <button
              onClick={requestLowLightToggle}
              title={
                isLowLight
                  ? 'Request Broadcaster Disable Low Light'
                  : 'Request Broadcaster Enable Low Light (Boost EV & ISO)'
              }
              className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold border transition cursor-pointer ${
                isLowLight
                  ? 'bg-amber-500/25 text-amber-300 border-amber-500/50 shadow'
                  : 'bg-slate-800 hover:bg-slate-700 text-slate-300 border-slate-700'
              }`}
            >
              <Moon className="w-4 h-4 text-amber-400" />
              <span className="hidden md:inline">Low Light</span>
            </button>

            <button
              onClick={requestTorchToggle}
              title="Request Broadcaster Torch"
              className={`p-2 rounded-xl text-xs border transition cursor-pointer ${
                isTorchOn
                  ? 'bg-amber-500 text-black border-amber-400'
                  : 'bg-slate-800 hover:bg-slate-700 text-slate-300 border-slate-700'
              }`}
            >
              {isTorchOn ? <Zap className="w-4 h-4" /> : <ZapOff className="w-4 h-4" />}
            </button>

            <button
              onClick={toggleMute}
              title={isMuted ? 'Unmute' : 'Mute'}
              className={`p-2 rounded-xl text-xs border transition cursor-pointer ${
                !isMuted
                  ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                  : 'bg-slate-800 hover:bg-slate-700 text-slate-400 border-slate-700'
              }`}
            >
              {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
            </button>
          </div>

          {/* Center: Snapshot & Record */}
          <div className="flex items-center gap-2">
            <button
              onClick={takeSnapshot}
              title="Save Photo Snapshot"
              className="p-2.5 rounded-full bg-slate-800 hover:bg-slate-700 text-white border border-slate-700 shadow-md transition transform active:scale-95 cursor-pointer"
            >
              <Download className="w-4 h-4 text-cyan-400" />
            </button>

            <button
              onClick={toggleRecording}
              title={isRecording ? 'Stop Recording' : 'Record Stream'}
              className={`flex items-center gap-1.5 px-3.5 py-2 rounded-full text-xs font-bold transition transform active:scale-95 cursor-pointer ${
                isRecording
                  ? 'bg-red-600 hover:bg-red-500 text-white shadow-lg animate-pulse'
                  : 'bg-slate-800 hover:bg-slate-700 text-red-400 border border-slate-700'
              }`}
            >
              <CircleDot className="w-4 h-4 text-red-500" />
              <span className="hidden sm:inline">
                {isRecording ? 'Stop Recording' : 'Record Clip'}
              </span>
            </button>
          </div>

          {/* Right: Small Screen Toggle, Zoom, PiP, Fullscreen */}
          <div className="flex items-center gap-1.5">
            <div className="hidden md:flex items-center bg-slate-800 rounded-xl border border-slate-700 p-0.5">
              <button
                onClick={() => handleZoom('out')}
                className="p-1.5 text-slate-300 hover:text-white"
                title="Zoom Out"
              >
                <ZoomOut className="w-3.5 h-3.5" />
              </button>
              <span className="text-[11px] font-mono px-1.5 text-slate-300">{zoomLevel}x</span>
              <button
                onClick={() => handleZoom('in')}
                className="p-1.5 text-slate-300 hover:text-white"
                title="Zoom In"
              >
                <ZoomIn className="w-3.5 h-3.5" />
              </button>
            </div>

            <button
              onClick={() => {
                const filters: Array<'normal' | 'night' | 'bw' | 'vivid'> = [
                  'normal',
                  'night',
                  'bw',
                  'vivid',
                ];
                const nextIdx = (filters.indexOf(videoFilter) + 1) % filters.length;
                setVideoFilter(filters[nextIdx]);
              }}
              className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition cursor-pointer"
              title={`Color Filter: ${videoFilter.toUpperCase()}`}
            >
              {videoFilter === 'night' ? (
                <Moon className="w-4 h-4 text-amber-400" />
              ) : (
                <Sun className="w-4 h-4" />
              )}
            </button>

            <button
              onClick={togglePiP}
              className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition cursor-pointer hidden sm:block"
              title="Picture in Picture Floating Window"
            >
              <PictureInPicture2 className="w-4 h-4" />
            </button>

            <button
              onClick={toggleSmallScreen}
              className={`p-2 rounded-xl border transition cursor-pointer ${
                viewMode === 'small'
                  ? 'bg-cyan-500 text-white border-cyan-400'
                  : 'bg-slate-800 hover:bg-slate-700 text-slate-300 border-slate-700'
              }`}
              title={viewMode === 'small' ? 'Standard Screen' : 'Small Screen / Compact View'}
            >
              <Shrink className="w-4 h-4" />
            </button>

            <button
              onClick={toggleFullScreen}
              className={`p-2 rounded-xl border transition cursor-pointer ${
                isFullscreen
                  ? 'bg-cyan-500 text-white border-cyan-400'
                  : 'bg-slate-800 hover:bg-slate-700 text-slate-300 border-slate-700'
              }`}
              title={isFullscreen ? 'Exit Full Screen' : 'Full Screen'}
            >
              {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
            </button>
          </div>
        </div>
      </div>

      {/* Helpful WiFi Stream Information */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
        <div className="p-3.5 rounded-2xl bg-slate-900/60 border border-slate-800 flex items-center gap-3">
          <Wifi className="w-5 h-5 text-emerald-400 shrink-0" />
          <div>
            <div className="font-semibold text-white">Direct WiFi Stream</div>
            <div className="text-slate-400 text-[11px]">Real-time video & audio streaming ({latencyMs}ms)</div>
          </div>
        </div>

        <div className="p-3.5 rounded-2xl bg-slate-900/60 border border-slate-800 flex items-center gap-3">
          <Moon className="w-5 h-5 text-amber-400 shrink-0" />
          <div>
            <div className="font-semibold text-white">Low Light Vision</div>
            <div className="text-slate-400 text-[11px]">Auto exposure & ISO boost for dark rooms</div>
          </div>
        </div>

        <div className="p-3.5 rounded-2xl bg-slate-900/60 border border-slate-800 flex items-center gap-3">
          <Download className="w-5 h-5 text-cyan-400 shrink-0" />
          <div>
            <div className="font-semibold text-white">Local Snapshot & Clips</div>
            <div className="text-slate-400 text-[11px]">Capture photos or record video anytime</div>
          </div>
        </div>
      </div>
    </div>
  );
};
