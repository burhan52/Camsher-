import React, { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import { QrCode, Copy, Check, ExternalLink, X, Wifi, Smartphone, Laptop, Sparkles } from 'lucide-react';

interface QRCodeModalProps {
  isOpen: boolean;
  onClose: () => void;
  shareUrl: string;
  roomId: string;
}

export const QRCodeModal: React.FC<QRCodeModalProps> = ({
  isOpen,
  onClose,
  shareUrl,
  roomId,
}) => {
  const [qrDataUrl, setQrDataUrl] = useState<string>('');
  const [copied, setCopied] = useState<boolean>(false);

  useEffect(() => {
    if (!shareUrl) return;
    QRCode.toDataURL(shareUrl, {
      width: 320,
      margin: 2,
      color: {
        dark: '#0f172a',
        light: '#ffffff',
      },
    })
      .then((url) => setQrDataUrl(url))
      .catch((err) => console.error('Failed to generate QR code', err));
  }, [shareUrl]);

  if (!isOpen) return null;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      // Fallback
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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-lg bg-slate-900 border border-slate-700/80 rounded-2xl shadow-2xl overflow-hidden text-slate-100 p-6 md:p-8">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
              <QrCode className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                WiFi Camera Share Link
                <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
                  Room: {roomId}
                </span>
              </h3>
              <p className="text-xs text-slate-400">Scan or share with any phone, tablet, or PC</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* QR Code Graphic */}
        <div className="my-6 flex flex-col items-center">
          <div className="p-3.5 bg-white rounded-2xl shadow-inner border-4 border-cyan-500/30">
            {qrDataUrl ? (
              <img
                src={qrDataUrl}
                alt="WiFi Camera Share QR Code"
                className="w-56 h-56 md:w-64 md:h-64 rounded-lg object-contain"
              />
            ) : (
              <div className="w-56 h-56 flex items-center justify-center text-slate-400">
                Generating QR code...
              </div>
            )}
          </div>
          <div className="flex items-center gap-2 mt-3 text-xs text-slate-400">
            <Wifi className="w-3.5 h-3.5 text-emerald-400 animate-pulse" />
            <span>Connect to same WiFi network for instant streaming</span>
          </div>
        </div>

        {/* Share Link Copy Bar */}
        <div className="space-y-3">
          <label className="text-xs font-semibold uppercase tracking-wider text-slate-400 block">
            Direct Share URL
          </label>
          <div className="flex items-center gap-2 p-1.5 pl-3.5 bg-slate-950/80 rounded-xl border border-slate-800 focus-within:border-cyan-500 transition">
            <input
              type="text"
              readOnly
              value={shareUrl}
              className="bg-transparent text-sm text-slate-200 outline-none w-full truncate font-mono select-all"
            />
            <button
              onClick={handleCopy}
              className={`flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-semibold transition shrink-0 ${
                copied
                  ? 'bg-emerald-600 text-white'
                  : 'bg-cyan-600 hover:bg-cyan-500 text-white shadow-sm'
              }`}
            >
              {copied ? (
                <>
                  <Check className="w-3.5 h-3.5" />
                  Copied!
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5" />
                  Copy Link
                </>
              )}
            </button>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="grid grid-cols-2 gap-3 mt-5">
          <a
            href={shareUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium border border-slate-700 transition"
          >
            <ExternalLink className="w-4 h-4 text-cyan-400" />
            Open Viewer In New Tab
          </a>
          <button
            onClick={onClose}
            className="py-2.5 px-3 rounded-xl bg-slate-800/80 hover:bg-slate-700/80 text-slate-300 text-xs font-medium border border-slate-700/60 transition"
          >
            Done
          </button>
        </div>

        {/* Quick Instructions Footer */}
        <div className="mt-5 pt-4 border-t border-slate-800/80 grid grid-cols-2 gap-3 text-[11px] text-slate-400">
          <div className="flex items-start gap-2">
            <Smartphone className="w-4 h-4 text-cyan-400 shrink-0 mt-0.5" />
            <span>Open your phone's camera app to scan and watch live</span>
          </div>
          <div className="flex items-start gap-2">
            <Laptop className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
            <span>Works across phones, iPads, laptops, and smart TVs</span>
          </div>
        </div>
      </div>
    </div>
  );
};
