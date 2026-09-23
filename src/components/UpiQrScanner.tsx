import React, { useState, useEffect } from 'react';
import QRCode from 'qrcode';
import { Copy, Check, Download, QrCode as QrIcon, Smartphone, ExternalLink, ShieldCheck } from 'lucide-react';

interface UpiQrScannerProps {
  upiId: string;
  name: string;
  amount?: number;
  customQrUrl?: string;
  size?: number;
  showDetails?: boolean;
  showDownload?: boolean;
  note?: string;
  className?: string;
}

export const UpiQrScanner: React.FC<UpiQrScannerProps> = ({
  upiId,
  name,
  amount,
  customQrUrl,
  size = 220,
  showDetails = true,
  showDownload = true,
  note = 'Suno Sakhi Wallet Deposit',
  className = ''
}) => {
  const [generatedQr, setGeneratedQr] = useState<string>('');
  const [copied, setCopied] = useState<boolean>(false);
  const [viewMode, setViewMode] = useState<'qr' | 'custom'>(customQrUrl ? 'custom' : 'qr');

  // Build standard UPI Payment Intent URI
  // Example: upi://pay?pa=sunosakhi@okaxis&pn=Suno%20Sakhi&am=100&cu=INR&tn=Deposit
  const upiIntentUri = React.useMemo(() => {
    const cleanUpi = (upiId || 'sunosakhi@okaxis').trim();
    const cleanName = encodeURIComponent((name || 'Suno Sakhi Official').trim());
    const cleanNote = encodeURIComponent(note);
    let uri = `upi://pay?pa=${cleanUpi}&pn=${cleanName}&cu=INR&tn=${cleanNote}`;
    if (amount && amount > 0) {
      uri += `&am=${amount}`;
    }
    return uri;
  }, [upiId, name, amount, note]);

  // Generate QR code Data URL whenever URI or size changes
  useEffect(() => {
    let isMounted = true;
    QRCode.toDataURL(
      upiIntentUri,
      {
        width: size * 2,
        margin: 1.5,
        color: {
          dark: '#0e0419',
          light: '#ffffff'
        },
        errorCorrectionLevel: 'M'
      },
      (err, url) => {
        if (!err && url && isMounted) {
          setGeneratedQr(url);
        }
      }
    );
    return () => {
      isMounted = false;
    };
  }, [upiIntentUri, size]);

  const handleCopyUpi = () => {
    try {
      navigator.clipboard.writeText(upiId);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      // fallback
    }
  };

  const activeQrSrc = viewMode === 'custom' && customQrUrl ? customQrUrl : generatedQr;

  return (
    <div className={`p-4 rounded-3xl bg-gradient-to-b from-[#1c0a2e] to-[#0f051b] border border-pink-500/40 shadow-2xl text-center space-y-3.5 relative overflow-hidden ${className}`}>
      {/* Background ambient glow */}
      <div className="absolute -top-10 -right-10 w-32 h-32 bg-pink-600/20 rounded-full blur-2xl pointer-events-none" />
      <div className="absolute -bottom-10 -left-10 w-32 h-32 bg-purple-600/20 rounded-full blur-2xl pointer-events-none" />

      {/* Header Badge */}
      <div className="flex items-center justify-between gap-2">
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-pink-500/20 border border-pink-500/40 text-pink-300 text-xs font-black">
          <QrIcon className="w-3.5 h-3.5 text-pink-400" />
          <span>Official Deposit Scanner</span>
        </span>

        {customQrUrl && (
          <div className="flex p-0.5 rounded-lg bg-black/60 border border-white/10 text-[10px]">
            <button
              type="button"
              onClick={() => setViewMode('custom')}
              className={`px-2 py-0.5 rounded font-bold transition-all ${
                viewMode === 'custom' ? 'bg-pink-600 text-white' : 'text-gray-400 hover:text-white'
              }`}
            >
              Merchant QR
            </button>
            <button
              type="button"
              onClick={() => setViewMode('qr')}
              className={`px-2 py-0.5 rounded font-bold transition-all ${
                viewMode === 'qr' ? 'bg-pink-600 text-white' : 'text-gray-400 hover:text-white'
              }`}
            >
              Dynamic UPI
            </button>
          </div>
        )}
      </div>

      {/* Amount Display if applicable */}
      {amount && amount > 0 && (
        <div className="inline-block px-4 py-1 rounded-xl bg-emerald-500/10 border border-emerald-500/30">
          <span className="text-xs text-gray-300">Scan & Pay Exact: </span>
          <span className="text-base font-black text-emerald-300">₹{amount}</span>
        </div>
      )}

      {/* QR Code Container with Scanner Frame */}
      <div className="relative inline-block mx-auto p-3.5 rounded-2xl bg-white shadow-2xl border-4 border-pink-500/60 ring-4 ring-pink-500/20 group">
        {/* Scanner Corner Guides */}
        <div className="absolute -top-1.5 -left-1.5 w-4 h-4 border-t-2 border-l-2 border-pink-500 pointer-events-none" />
        <div className="absolute -top-1.5 -right-1.5 w-4 h-4 border-t-2 border-r-2 border-pink-500 pointer-events-none" />
        <div className="absolute -bottom-1.5 -left-1.5 w-4 h-4 border-b-2 border-l-2 border-pink-500 pointer-events-none" />
        <div className="absolute -bottom-1.5 -right-1.5 w-4 h-4 border-b-2 border-r-2 border-pink-500 pointer-events-none" />

        {activeQrSrc ? (
          <img
            src={activeQrSrc}
            alt="UPI Deposit QR Scanner"
            style={{ width: `${size}px`, height: `${size}px` }}
            className="rounded-xl object-contain mx-auto transition-transform duration-200 group-hover:scale-[1.02]"
          />
        ) : (
          <div
            style={{ width: `${size}px`, height: `${size}px` }}
            className="flex flex-col items-center justify-center text-gray-400 text-xs gap-2"
          >
            <div className="w-8 h-8 border-2 border-pink-500 border-t-transparent rounded-full animate-spin" />
            <span>QR Scanner Loading...</span>
          </div>
        )}

        {/* Center Logo / Shield Badge */}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="px-2 py-0.5 rounded-full bg-white/95 border border-pink-500/40 shadow-md flex items-center gap-1">
            <span className="text-[10px] font-black text-pink-600">SunoSakhi</span>
          </div>
        </div>
      </div>

      <p className="text-[11px] text-gray-300 font-medium flex items-center justify-center gap-1">
        <Smartphone className="w-3.5 h-3.5 text-pink-400" />
        <span>Scan with PhonePe, Google Pay, Paytm or any UPI App</span>
      </p>

      {/* Details Box */}
      {showDetails && (
        <div className="space-y-2 pt-1 text-left">
          <div className="p-3 rounded-2xl bg-black/60 border border-white/10 space-y-1.5">
            <div className="flex items-center justify-between text-xs">
              <span className="text-gray-400">Official UPI ID:</span>
              <span className="text-pink-300 font-mono text-[11px] truncate max-w-[140px]">{name}</span>
            </div>

            <div className="flex items-center justify-between gap-2 p-2 rounded-xl bg-[#1b0a2c] border border-pink-500/30">
              <span className="font-mono text-xs sm:text-sm font-black text-pink-300 select-all truncate">
                {upiId}
              </span>
              <button
                type="button"
                onClick={handleCopyUpi}
                className={`px-3 py-1 rounded-lg text-[11px] font-bold flex items-center gap-1 transition-all flex-shrink-0 ${
                  copied
                    ? 'bg-emerald-600 text-white'
                    : 'bg-pink-600 hover:bg-pink-500 text-white shadow'
                }`}
              >
                {copied ? (
                  <>
                    <Check className="w-3 h-3" />
                    <span>Copied!</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3 h-3" />
                    <span>Copy UPI</span>
                  </>
                )}
              </button>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2 pt-1">
            {/* Direct App Link */}
            <a
              href={upiIntentUri}
              className="py-2 px-3 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 text-white text-[11px] font-bold flex items-center justify-center gap-1.5 shadow"
            >
              <ExternalLink className="w-3 h-3" />
              <span>⚡ Open UPI App</span>
            </a>

            {/* Download QR */}
            {showDownload && generatedQr && (
              <a
                href={activeQrSrc}
                download={`SunoSakhi-Deposit-QR-${upiId.replace(/[^a-zA-Z0-9]/g, '_')}.png`}
                className="py-2 px-3 rounded-xl bg-white/10 hover:bg-white/15 text-white text-[11px] font-bold flex items-center justify-center gap-1.5 transition-all"
              >
                <Download className="w-3 h-3 text-pink-300" />
                <span>Save Scanner</span>
              </a>
            )}
          </div>
        </div>
      )}

      {/* Safety Assurance */}
      <div className="flex items-center justify-center gap-1 text-[10px] text-emerald-400 font-semibold pt-0.5">
        <ShieldCheck className="w-3 h-3" />
        <span>100% Direct Official Admin Account Verification</span>
      </div>
    </div>
  );
};
