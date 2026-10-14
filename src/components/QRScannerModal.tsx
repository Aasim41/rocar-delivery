import { useEffect, useRef, useState } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import { X, Camera, Zap, CheckCircle2, AlertTriangle, KeyRound } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { playUnlockChime } from '../lib/audioChimes';

interface QRScannerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onScanSuccess: (decodedText: string) => void;
  title?: string;
  subtitle?: string;
}

export function QRScannerModal({
  isOpen,
  onClose,
  onScanSuccess,
  title = 'Scan Cart QR Code',
  subtitle = 'Point camera at the QR code on the AutoDrop lid',
}: QRScannerModalProps) {
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [manualCode, setManualCode] = useState('');
  const [showManualInput, setShowManualInput] = useState(false);
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const readerElementId = 'autodrop-html5-qr-reader';

  useEffect(() => {
    if (!isOpen) return;

    setCameraError(null);
    setIsScanning(false);
    let isCancelled = false;

    // Small delay to allow DOM element to mount
    const timer = setTimeout(() => {
      if (isCancelled) return;

      try {
        const html5QrCode = new Html5Qrcode(readerElementId);
        scannerRef.current = html5QrCode;

        const config = {
          fps: 12,
          qrbox: { width: 220, height: 220 },
          aspectRatio: 1.0,
        };

        html5QrCode
          .start(
            { facingMode: 'environment' },
            config,
            (decodedText) => {
              // Successfully read QR code
              playUnlockChime();
              if (html5QrCode.isScanning) {
                html5QrCode.stop().catch(() => {}).finally(() => {
                  onScanSuccess(decodedText);
                  onClose();
                });
              } else {
                onScanSuccess(decodedText);
                onClose();
              }
            },
            () => {
              // Ignore standard frame decoding errors
            }
          )
          .then(() => {
            if (!isCancelled) setIsScanning(true);
          })
          .catch((err) => {
            console.warn('Camera start error:', err);
            if (!isCancelled) {
              setCameraError(
                err?.message?.includes('Permission')
                  ? 'Camera permission denied. Please allow camera access in browser settings, or enter the code manually.'
                  : 'Unable to start camera. You can enter the cart code manually below.'
              );
            }
          });
      } catch (err: any) {
        setCameraError('Camera initialization failed.');
      }
    }, 250);

    return () => {
      isCancelled = true;
      clearTimeout(timer);
      if (scannerRef.current) {
        try {
          if (scannerRef.current.isScanning) {
            scannerRef.current.stop().catch(() => {}).finally(() => {
              try { scannerRef.current?.clear(); } catch (_) {}
            });
          } else {
            scannerRef.current.clear();
          }
        } catch (_) {}
        scannerRef.current = null;
      }
    };
  }, [isOpen]);

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualCode.trim()) return;
    playUnlockChime();
    onScanSuccess(manualCode.trim());
    onClose();
  };

  const handleBypassUnlock = () => {
    playUnlockChime();
    onScanSuccess('cart_01');
    onClose();
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 10 }}
          className="relative w-full max-w-sm rounded-3xl bg-zinc-950 border border-zinc-800/80 shadow-2xl overflow-hidden flex flex-col"
        >
          {/* Header */}
          <div className="flex items-center justify-between px-5 pt-5 pb-3">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400">
                <Camera size={18} />
              </div>
              <div>
                <h3 className="text-sm font-bold text-white tracking-tight">{title}</h3>
                <p className="text-[11px] text-zinc-400">{subtitle}</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-1.5 rounded-full hover:bg-zinc-800 text-zinc-400 hover:text-white transition-colors"
            >
              <X size={18} />
            </button>
          </div>

          {/* Scanner Viewport */}
          <div className="px-5 py-2 flex flex-col items-center">
            <div className="relative w-64 h-64 bg-zinc-900 rounded-2xl overflow-hidden border border-zinc-800 flex items-center justify-center">
              {/* HTML5 QR Code Mount */}
              <div
                id={readerElementId}
                className="w-full h-full object-cover [&>video]:w-full [&>video]:h-full [&>video]:object-cover"
              />

              {/* Target Corner Reticles */}
              <div className="pointer-events-none absolute inset-6 border-2 border-dashed border-blue-500/40 rounded-xl" />
              <div className="pointer-events-none absolute top-4 left-4 w-5 h-5 border-t-2 border-l-2 border-blue-400 rounded-tl-sm" />
              <div className="pointer-events-none absolute top-4 right-4 w-5 h-5 border-t-2 border-r-2 border-blue-400 rounded-tr-sm" />
              <div className="pointer-events-none absolute bottom-4 left-4 w-5 h-5 border-b-2 border-l-2 border-blue-400 rounded-bl-sm" />
              <div className="pointer-events-none absolute bottom-4 right-4 w-5 h-5 border-b-2 border-r-2 border-blue-400 rounded-br-sm" />

              {/* Animated Laser Scanning Line */}
              {isScanning && (
                <motion.div
                  className="pointer-events-none absolute left-6 right-6 h-0.5 bg-gradient-to-r from-transparent via-blue-400 to-transparent shadow-[0_0_12px_#38bdf8]"
                  animate={{ y: [0, 180, 0] }}
                  transition={{ duration: 2.2, repeat: Infinity, ease: 'easeInOut' }}
                />
              )}

              {/* Error state overlay */}
              {cameraError && (
                <div className="absolute inset-0 bg-zinc-950/95 flex flex-col items-center justify-center p-4 text-center">
                  <AlertTriangle size={28} className="text-amber-400 mb-2" />
                  <p className="text-xs text-zinc-300 font-medium mb-3">{cameraError}</p>
                  <button
                    onClick={() => setShowManualInput(true)}
                    className="text-xs bg-zinc-800 hover:bg-zinc-700 text-white font-semibold px-3 py-1.5 rounded-lg transition-colors"
                  >
                    Enter Code Manually
                  </button>
                </div>
              )}
            </div>

            <p className="text-[11px] text-zinc-500 text-center mt-3 flex items-center gap-1.5">
              <Zap size={12} className="text-blue-400 animate-pulse" />
              Align cart lid QR sticker inside the frame
            </p>
          </div>

          {/* Footer Controls / Fallbacks */}
          <div className="p-5 pt-3 border-t border-zinc-800/80 mt-2 space-y-2.5">
            {showManualInput ? (
              <form onSubmit={handleManualSubmit} className="space-y-2">
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={manualCode}
                    onChange={(e) => setManualCode(e.target.value)}
                    placeholder="Enter Cart ID (e.g. cart_01)"
                    className="flex-1 bg-zinc-900 border border-zinc-700 rounded-xl px-3 py-2 text-xs text-white font-mono focus:outline-none focus:border-blue-500"
                    autoFocus
                  />
                  <button
                    type="submit"
                    className="bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold px-4 py-2 rounded-xl transition-colors"
                  >
                    Unlock
                  </button>
                </div>
                <button
                  type="button"
                  onClick={() => setShowManualInput(false)}
                  className="text-[11px] text-zinc-500 hover:text-zinc-400 w-full text-center"
                >
                  ← Return to Camera Scanner
                </button>
              </form>
            ) : (
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setShowManualInput(true)}
                  className="flex-1 py-2.5 px-3 bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 rounded-xl text-xs font-medium text-zinc-300 flex items-center justify-center gap-1.5 transition-colors"
                >
                  <KeyRound size={14} className="text-zinc-400" />
                  Manual Code
                </button>
                <button
                  onClick={handleBypassUnlock}
                  className="flex-1 py-2.5 px-3 bg-blue-600/15 hover:bg-blue-600/25 border border-blue-500/30 rounded-xl text-xs font-semibold text-blue-400 flex items-center justify-center gap-1.5 transition-colors"
                >
                  <CheckCircle2 size={14} className="text-blue-400" />
                  Demo Bypass
                </button>
              </div>
            )}
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
