import React, { useState, useEffect, useMemo } from 'react';
import QRCode from 'qrcode';
import {
  Copy,
  Check,
  Download,
  QrCode as QrIcon,
  Smartphone,
  ExternalLink,
  ShieldCheck,
  Maximize2,
  X,
  Sparkles,
  Store,
  Zap
} from 'lucide-react';

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
  size = 230,
  showDetails = true,
  showDownload = true,
  note = 'Suno Sakhi Wallet Deposit',
  className = ''
}) => {
  const [dynamicQrUrl, setDynamicQrUrl] = useState<string>('');
  const [staticMerchantQrUrl, setStaticMerchantQrUrl] = useState<string>('');
  const [copied, setCopied] = useState<boolean>(false);
  // Default to merchant QR if custom image is available, otherwise dynamic
  const [activeTab, setActiveTab] = useState<'merchant' | 'dynamic'>(customQrUrl ? 'merchant' : 'dynamic');
  const [isZoomOpen, setIsZoomOpen] = useState<boolean>(false);

  const cleanUpi = (upiId || 'sunosakhi@okaxis').trim();
  const cleanName = (name || 'Suno Sakhi Official').trim();
  const cleanNote = note.trim();

  // Dynamic URI with exact amount
  const dynamicUpiUri = useMemo(() => {
    let uri = `upi://pay?pa=${cleanUpi}&pn=${encodeURIComponent(cleanName)}&cu=INR&tn=${encodeURIComponent(cleanNote)}`;
    if (amount && amount > 0) {
      uri += `&am=${amount}`;
    }
    return uri;
  }, [cleanUpi, cleanName, amount, cleanNote]);

  // Static Merchant URI (without hardcoded amount, universally scannable by all merchant scanners)
  const staticMerchantUri = useMemo(() => {
    return `upi://pay?pa=${cleanUpi}&pn=${encodeURIComponent(cleanName)}&cu=INR&mode=02&purpose=00`;
  }, [cleanUpi, cleanName]);

  // Generate Dynamic QR code
  useEffect(() => {
    let isMounted = true;
    QRCode.toDataURL(
      dynamicUpiUri,
      {
        width: 480,
        margin: 2,
        color: {
          dark: '#000000',
          light: '#ffffff'
        },
        errorCorrectionLevel: 'H'
      },
      (err, url) => {
        if (!err && url && isMounted) {
          setDynamicQrUrl(url);
        }
      }
    );
    return () => {
      isMounted = false;
    };
  }, [dynamicUpiUri]);

  // Generate Static Merchant QR code (fallback if custom image not provided)
  useEffect(() => {
    let isMounted = true;
    QRCode.toDataURL(
      staticMerchantUri,
      {
        width: 480,
        margin: 2,
        color: {
          dark: '#000000',
          light: '#ffffff'
        },
        errorCorrectionLevel: 'H'
      },
      (err, url) => {
        if (!err && url && isMounted) {
          setStaticMerchantQrUrl(url);
        }
      }
    );
    return () => {
      isMounted = false;
    };
  }, [staticMerchantUri]);

  const handleCopyUpi = () => {
    try {
      navigator.clipboard.writeText(cleanUpi);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    }
  };

  // Active QR image source
  const currentQrImage = activeTab === 'merchant'
    ? (customQrUrl || staticMerchantQrUrl || dynamicQrUrl)
    : (dynamicQrUrl || customQrUrl || staticMerchantQrUrl);

  const activeIntentLink = activeTab === 'merchant' ? staticMerchantUri : dynamicUpiUri;

  return (
    <div
      className={`p-4 sm:p-5 rounded-3xl bg-gradient-to-b from-[#1b0a2c] via-[#120520] to-[#090312] border border-pink-500/40 shadow-2xl text-center space-y-3.5 relative overflow-hidden ${className}`}
    >
      {/* Background ambient lighting */}
      <div className="absolute -top-12 -right-12 w-36 h-36 bg-pink-600/20 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-12 -left-12 w-36 h-36 bg-purple-600/20 rounded-full blur-3xl pointer-events-none" />

      {/* QR Type Selector Tabs (Both Merchant QR and Dynamic QR) */}
      <div className="flex p-1 rounded-2xl bg-black/70 border border-white/10 gap-1 text-xs">
        <button
          type="button"
          onClick={() => setActiveTab('merchant')}
          className={`flex-1 py-2 px-2.5 rounded-xl font-black transition-all flex items-center justify-center gap-1.5 ${
            activeTab === 'merchant'
              ? 'bg-gradient-to-r from-pink-600 to-rose-600 text-white shadow-lg shadow-pink-900/40 ring-1 ring-pink-400'
              : 'text-gray-300 hover:text-white'
          }`}
        >
          <Store className="w-3.5 h-3.5 text-pink-300" />
          <span>🏪 Merchant QR (Shop)</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('dynamic')}
          className={`flex-1 py-2 px-2.5 rounded-xl font-black transition-all flex items-center justify-center gap-1.5 ${
            activeTab === 'dynamic'
              ? 'bg-gradient-to-r from-emerald-600 to-teal-600 text-white shadow-lg shadow-emerald-950/40 ring-1 ring-emerald-400'
              : 'text-gray-300 hover:text-white'
          }`}
        >
          <Zap className="w-3.5 h-3.5 text-emerald-300" />
          <span>⚡ Dynamic QR {amount ? `(₹${amount})` : ''}</span>
        </button>
      </div>

      {/* QR Info Banner */}
      <div className="flex items-center justify-between text-[11px] px-1">
        <span className="text-gray-300 font-semibold flex items-center gap-1">
          {activeTab === 'merchant' ? (
            <>
              <span className="w-2 h-2 rounded-full bg-pink-400 animate-pulse" />
              <span>Official Merchant Scanner (All Apps)</span>
            </>
          ) : (
            <>
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span>Auto-filled Amount: <strong className="text-emerald-300">₹{amount || 50}</strong></span>
            </>
          )}
        </span>

        <button
          type="button"
          onClick={() => setIsZoomOpen(true)}
          className="text-pink-300 hover:text-pink-200 font-bold flex items-center gap-1 text-[10px] bg-pink-500/10 px-2 py-0.5 rounded-lg border border-pink-500/20"
        >
          <Maximize2 className="w-3 h-3" />
          <span>Bada Karein / Zoom</span>
        </button>
      </div>

      {/* QR Code Container with High-Contrast White Quiet Zone (NO center overlay) */}
      <div className="relative inline-block mx-auto p-4 sm:p-5 rounded-3xl bg-white shadow-2xl border-4 border-pink-500/50 ring-4 ring-pink-500/10 transition-all hover:scale-[1.01]">
        {/* Scanner Corner Guides */}
        <div className="absolute -top-1 -left-1 w-5 h-5 border-t-4 border-l-4 border-pink-500 rounded-tl-lg pointer-events-none" />
        <div className="absolute -top-1 -right-1 w-5 h-5 border-t-4 border-r-4 border-pink-500 rounded-tr-lg pointer-events-none" />
        <div className="absolute -bottom-1 -left-1 w-5 h-5 border-b-4 border-l-4 border-pink-500 rounded-bl-lg pointer-events-none" />
        <div className="absolute -bottom-1 -right-1 w-5 h-5 border-b-4 border-r-4 border-pink-500 rounded-br-lg pointer-events-none" />

        {currentQrImage ? (
          <img
            src={currentQrImage}
            alt="UPI Payment QR Code"
            style={{ width: `${size}px`, height: `${size}px` }}
            className="rounded-xl object-contain mx-auto select-none"
            loading="eager"
          />
        ) : (
          <div
            style={{ width: `${size}px`, height: `${size}px` }}
            className="flex flex-col items-center justify-center text-gray-500 text-xs gap-2"
          >
            <div className="w-8 h-8 border-3 border-pink-500 border-t-transparent rounded-full animate-spin" />
            <span>QR Scanner Loading...</span>
          </div>
        )}
      </div>

      {/* Helpful Hint */}
      <p className="text-[11px] text-gray-300 font-medium flex items-center justify-center gap-1.5">
        <Smartphone className="w-3.5 h-3.5 text-pink-400 flex-shrink-0" />
        <span>Google Pay • PhonePe • Paytm • BHIM • Cred se Scan Karein</span>
      </p>

      {/* Details Box */}
      {showDetails && (
        <div className="space-y-2 pt-1 text-left">
          <div className="p-3 rounded-2xl bg-black/60 border border-white/10 space-y-1.5">
            <div className="flex items-center justify-between text-xs">
              <span className="text-gray-400">Merchant UPI Name:</span>
              <span className="text-pink-300 font-bold truncate max-w-[150px]">{cleanName}</span>
            </div>

            <div className="flex items-center justify-between gap-2 p-2 rounded-xl bg-[#1a082a] border border-pink-500/30">
              <span className="font-mono text-xs sm:text-sm font-black text-pink-300 select-all truncate">
                {cleanUpi}
              </span>
              <button
                type="button"
                onClick={handleCopyUpi}
                className={`px-3 py-1.5 rounded-lg text-[11px] font-black flex items-center gap-1 transition-all flex-shrink-0 ${
                  copied
                    ? 'bg-emerald-600 text-white'
                    : 'bg-pink-600 hover:bg-pink-500 text-white shadow'
                }`}
              >
                {copied ? (
                  <>
                    <Check className="w-3.5 h-3.5" />
                    <span>Copied!</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5" />
                    <span>Copy UPI</span>
                  </>
                )}
              </button>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2 pt-0.5">
            {/* Direct App Link */}
            <a
              href={activeIntentLink}
              className="py-2.5 px-3 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 text-white text-[11px] font-black flex items-center justify-center gap-1.5 shadow"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              <span>⚡ Open UPI App</span>
            </a>

            {/* Download QR */}
            {showDownload && currentQrImage && (
              <a
                href={currentQrImage}
                download={`SunoSakhi-Deposit-QR-${cleanUpi.replace(/[^a-zA-Z0-9]/g, '_')}.png`}
                className="py-2.5 px-3 rounded-xl bg-white/10 hover:bg-white/15 text-white text-[11px] font-bold flex items-center justify-center gap-1.5 transition-all"
              >
                <Download className="w-3.5 h-3.5 text-pink-300" />
                <span>Save Scanner</span>
              </a>
            )}
          </div>
        </div>
      )}

      {/* Safety Assurance */}
      <div className="flex items-center justify-center gap-1 text-[10px] text-emerald-400 font-semibold pt-0.5">
        <ShieldCheck className="w-3.5 h-3.5" />
        <span>100% Direct Official Admin Account Verification</span>
      </div>

      {/* Fullscreen / Zoom QR Modal */}
      {isZoomOpen && (
        <div
          onClick={() => setIsZoomOpen(false)}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/90 backdrop-blur-md animate-in fade-in duration-150"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="relative p-6 rounded-3xl bg-[#140822] border-2 border-pink-500/60 shadow-2xl max-w-sm w-full text-center space-y-4 text-white"
          >
            <button
              onClick={() => setIsZoomOpen(false)}
              className="absolute top-4 right-4 p-1.5 rounded-full bg-white/10 hover:bg-white/20 text-gray-300 hover:text-white"
            >
              <X className="w-5 h-5" />
            </button>

            <h3 className="text-base font-black text-white">
              {activeTab === 'merchant' ? '🏪 Official Merchant QR' : `⚡ Dynamic QR (₹${amount || 50})`}
            </h3>

            {/* Extra Large Pure White QR Container */}
            <div className="p-5 bg-white rounded-3xl shadow-2xl inline-block mx-auto">
              <img
                src={currentQrImage}
                alt="Enlarged QR Code"
                className="w-64 h-64 sm:w-72 sm:h-72 object-contain mx-auto"
              />
            </div>

            <p className="font-mono text-xs font-bold text-pink-300">{cleanUpi}</p>
            <p className="text-[11px] text-gray-300">
              Kisi bhi phone camera ya UPI app se aasaani se scan karein.
            </p>

            <button
              onClick={() => setIsZoomOpen(false)}
              className="w-full py-2.5 rounded-xl bg-pink-600 hover:bg-pink-500 text-white font-bold text-xs"
            >
              Close Zoom
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
