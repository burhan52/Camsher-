/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { Camera, Wifi, Radio, QrCode, FlipHorizontal, Eye, Video, Sparkles } from 'lucide-react';
import { FirstPageHero } from './components/FirstPageHero';
import { CameraViewfinder } from './components/CameraViewfinder';
import { ViewerStream } from './components/ViewerStream';
import { QRCodeModal } from './components/QRCodeModal';
import { CameraFacing, QUALITY_PRESETS, StreamQuality } from './types';

// Generate or retrieve consistent room ID
function getInitialRoomId(): string {
  const urlParams = new URLSearchParams(window.location.search);
  const viewParam = urlParams.get('view') || urlParams.get('channel') || urlParams.get('room');
  if (viewParam) return viewParam;

  const saved = localStorage.getItem('wifi_cam_room_id');
  if (saved && saved.length >= 4) return saved;

  const generated = 'cam-' + Math.floor(1000 + Math.random() * 9000);
  try {
    localStorage.setItem('wifi_cam_room_id', generated);
  } catch {}
  return generated;
}

export default function App() {
  const [roomId] = useState<string>(getInitialRoomId);
  const [currentView, setCurrentView] = useState<'home' | 'broadcaster' | 'viewer'>('home');
  const [activeFacing, setActiveFacing] = useState<CameraFacing>('environment');
  const [selectedQuality, setSelectedQuality] = useState<StreamQuality>(QUALITY_PRESETS[1]); // 720p default
  const [enableAudio, setEnableAudio] = useState<boolean>(true);
  const [isQrModalOpen, setIsQrModalOpen] = useState<boolean>(false);

  // Compute live WiFi share URL
  const [shareUrl, setShareUrl] = useState<string>('');

  useEffect(() => {
    const origin = window.location.origin;
    const path = window.location.pathname;
    setShareUrl(`${origin}${path}?view=${roomId}`);

    // Check if initial URL asks to view
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('view') || urlParams.get('channel') || urlParams.get('room')) {
      setCurrentView('viewer');
    }
  }, [roomId]);

  // Start Broadcasting with specific camera facing
  const handleStartCamera = (facing: CameraFacing) => {
    setActiveFacing(facing);
    setCurrentView('broadcaster');
    // Clear view param from url to avoid confusion if user refreshes
    const url = new URL(window.location.href);
    url.searchParams.delete('view');
    window.history.replaceState({}, '', url.toString());
  };

  // Stop broadcasting and return home
  const handleStopCamera = () => {
    setCurrentView('home');
  };

  // Open Viewer mode
  const handleOpenViewer = () => {
    setCurrentView('viewer');
    const url = new URL(window.location.href);
    url.searchParams.set('view', roomId);
    window.history.replaceState({}, '', url.toString());
  };

  // Back to home from viewer
  const handleBackToHome = () => {
    setCurrentView('home');
    const url = new URL(window.location.href);
    url.searchParams.delete('view');
    window.history.replaceState({}, '', url.toString());
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-cyan-500 selection:text-white">
      {/* Top Universal App Bar */}
      <header className="sticky top-0 z-40 w-full border-b border-slate-800/80 bg-slate-950/80 backdrop-blur-xl">
        <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between gap-4">
          {/* Logo & Title */}
          <div
            onClick={handleStopCamera}
            className="flex items-center gap-2.5 cursor-pointer select-none group"
          >
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-cyan-500 to-emerald-400 p-0.5 shadow-lg shadow-cyan-500/20 group-hover:scale-105 transition-transform">
              <div className="w-full h-full bg-slate-950 rounded-[10px] flex items-center justify-center">
                <Wifi className="w-5 h-5 text-cyan-400" />
              </div>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-base font-black tracking-tight text-white">WiFi CamShare</span>
                <span className="px-1.5 py-0.5 text-[10px] font-bold uppercase rounded bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
                  HD
                </span>
              </div>
              <p className="text-[11px] text-slate-400 -mt-0.5 hidden sm:block">
                Wireless Front & Back Camera Sharing
              </p>
            </div>
          </div>

          {/* Quick Actions Header */}
          <div className="flex items-center gap-2 sm:gap-3">
            {currentView === 'home' && (
              <>
                <button
                  onClick={() => handleStartCamera('user')}
                  className="hidden md:flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-xs font-semibold text-slate-200 border border-slate-800 transition cursor-pointer"
                >
                  <FlipHorizontal className="w-3.5 h-3.5 text-cyan-400" />
                  Front Cam
                </button>
                <button
                  onClick={() => handleStartCamera('environment')}
                  className="hidden md:flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-xs font-semibold text-slate-200 border border-slate-800 transition cursor-pointer"
                >
                  <Camera className="w-3.5 h-3.5 text-emerald-400" />
                  Back Cam
                </button>
              </>
            )}

            <button
              onClick={() => setIsQrModalOpen(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-200 text-xs font-semibold border border-slate-800 transition cursor-pointer"
              title="Show WiFi Share Link QR Code"
            >
              <QrCode className="w-3.5 h-3.5 text-amber-400" />
              <span className="hidden sm:inline">WiFi Link</span>
            </button>

            {currentView !== 'viewer' ? (
              <button
                onClick={handleOpenViewer}
                className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-bold shadow-md shadow-cyan-600/20 transition cursor-pointer"
              >
                <Eye className="w-3.5 h-3.5" />
                <span>Viewer</span>
              </button>
            ) : (
              <button
                onClick={handleBackToHome}
                className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold border border-slate-700 transition cursor-pointer"
              >
                <span>Broadcaster</span>
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Main App Content Body */}
      <main className="flex-1 flex flex-col justify-center">
        {currentView === 'home' && (
          <FirstPageHero
            onStartCamera={handleStartCamera}
            shareUrl={shareUrl}
            roomId={roomId}
            onOpenQrModal={() => setIsQrModalOpen(true)}
            selectedQuality={selectedQuality}
            onSelectQuality={setSelectedQuality}
            enableAudio={enableAudio}
            onToggleAudio={() => setEnableAudio(!enableAudio)}
            onOpenViewer={handleOpenViewer}
          />
        )}

        {currentView === 'broadcaster' && (
          <CameraViewfinder
            initialFacing={activeFacing}
            quality={selectedQuality}
            enableAudio={enableAudio}
            roomId={roomId}
            shareUrl={shareUrl}
            onOpenQrModal={() => setIsQrModalOpen(true)}
            onStopCamera={handleStopCamera}
            onOpenViewer={handleOpenViewer}
          />
        )}

        {currentView === 'viewer' && (
          <ViewerStream roomId={roomId} onBackToHome={handleBackToHome} />
        )}
      </main>

      {/* QR Code Sharing Modal */}
      <QRCodeModal
        isOpen={isQrModalOpen}
        onClose={() => setIsQrModalOpen(false)}
        shareUrl={shareUrl}
        roomId={roomId}
      />

      {/* Footer */}
      <footer className="border-t border-slate-900 bg-slate-950 py-4 text-center text-xs text-slate-500">
        <div className="max-w-6xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="inline-block w-2 h-2 rounded-full bg-emerald-400"></span>
            <span>WiFi CamShare &bull; WebRTC Real-Time Camera Stream</span>
          </div>
          <div>Connect multiple devices on the same WiFi network</div>
        </div>
      </footer>
    </div>
  );
}
