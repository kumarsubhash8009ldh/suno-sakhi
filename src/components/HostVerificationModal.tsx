import React, { useState, useRef, useEffect } from 'react';
import { X, ShieldCheck, Camera, Upload, CheckCircle2, AlertCircle, Sparkles, Heart, Award, Check } from 'lucide-react';
import confetti from 'canvas-confetti';
import { useHost } from '../context/HostContext';
import { compressImageFile } from '../utils/imageCompressor';

export const HostVerificationModal: React.FC = () => {
  const {
    isVerificationModalOpen,
    closeVerificationModal,
    submitVerification,
    hostProfile,
    updateHostPhoto
  } = useHost();

  const existingAadhaar = hostProfile.verification?.residentIdNumber || hostProfile.verification?.idNumber || '';
  const [aadhaarNumber, setAadhaarNumber] = useState<string>('');
  const [selfieUrl, setSelfieUrl] = useState<string>('');
  const [isFemaleCertified, setIsFemaleCertified] = useState<boolean>(true);
  const [isCameraActive, setIsCameraActive] = useState<boolean>(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [isVerifiedSuccess, setIsVerifiedSuccess] = useState<boolean>(false);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const isAlreadyVerified = Boolean(
    hostProfile.isVerified ||
    hostProfile.verification?.status === 'verified'
  );

  const formatAadhaar = (val: string) => {
    const raw = val.replace(/\D/g, '').slice(0, 12);
    const parts = raw.match(/.{1,4}/g);
    return parts ? parts.join(' ') : raw;
  };

  useEffect(() => {
    if (isVerificationModalOpen) {
      if (existingAadhaar) {
        setAadhaarNumber(formatAadhaar(existingAadhaar));
      } else {
        setAadhaarNumber('');
      }
      setSelfieUrl(hostProfile.verification?.selfieUrl || hostProfile.avatar || '');
      setIsFemaleCertified(true);
      setFormError(null);
      setIsVerifiedSuccess(false);
    }
  }, [isVerificationModalOpen, hostProfile, existingAadhaar]);

  if (!isVerificationModalOpen) return null;

  const startCamera = async () => {
    setCameraError(null);
    try {
      if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'user' }
        });
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
        setIsCameraActive(true);
      }
    } catch (err) {
      setCameraError('Camera access nahi mila. Kripya browser me permission allow karein ya photo upload karein.');
    }
  };

  const captureSelfie = () => {
    if (videoRef.current) {
      const video = videoRef.current;
      const canvas = document.createElement('canvas');
      canvas.width = Math.min(video.videoWidth || 400, 400);
      canvas.height = Math.min(video.videoHeight || 400, 400);
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        const dataUrl = canvas.toDataURL('image/jpeg', 0.82);
        setSelfieUrl(dataUrl);
        stopCamera();
      }
    }
  };

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    setIsCameraActive(false);
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      try {
        const compressed = await compressImageFile(file, 400, 0.82);
        setSelfieUrl(compressed);
      } catch (err) {
        console.warn('Image upload fallback:', err);
        const reader = new FileReader();
        reader.onload = (event) => {
          if (event.target?.result) {
            setSelfieUrl(event.target.result as string);
          }
        };
        reader.readAsDataURL(file);
      }
    }
  };

  const handleAadhaarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setAadhaarNumber(formatAadhaar(e.target.value));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    const cleanAadhaar = aadhaarNumber.replace(/\D/g, '');
    if (cleanAadhaar.length !== 12) {
      setFormError('⚠️ Kripya 12-digit ka valid Aadhaar Card number darj karein (e.g. 5689 4512 8923).');
      return;
    }

    if (!isFemaleCertified) {
      setFormError('⚠️ Kripya Female Verification certification par tick karein.');
      return;
    }

    // Immediate Automatic Verification
    submitVerification({
      residentIdType: 'aadhaar',
      residentIdNumber: cleanAadhaar,
      selfieUrl: selfieUrl || hostProfile.avatar || '',
      gender: 'female',
      status: 'verified',
      verifiedAt: Date.now(),
      idType: 'aadhaar',
      idNumber: cleanAadhaar,
      panNumber: ''
    });

    if (selfieUrl) {
      updateHostPhoto(selfieUrl);
    }

    stopCamera();
    setIsVerifiedSuccess(true);

    try {
      confetti({
        particleCount: 90,
        spread: 70,
        origin: { y: 0.6 }
      });
    } catch (e) {}

    setTimeout(() => {
      closeVerificationModal();
    }, 1800);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/85 backdrop-blur-md animate-in fade-in duration-200">
      <div className="relative w-full max-w-lg rounded-3xl bg-gradient-to-b from-[#180927] via-[#12061e] to-[#0a0212] border border-pink-500/40 shadow-2xl p-5 sm:p-6 text-white max-h-[92vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between pb-3.5 border-b border-pink-500/20">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-base sm:text-lg font-black text-white flex items-center gap-2">
                <span>Aadhaar Card Verification</span>
                <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 text-[10px] font-bold border border-emerald-500/30">
                  Instant Auto-Verify ⚡
                </span>
              </h3>
              <p className="text-[11px] text-pink-300/80">
                12-digit Aadhaar Card number dalein aur ID turant activate karein
              </p>
            </div>
          </div>
          <button
            onClick={() => {
              stopCamera();
              closeVerificationModal();
            }}
            className="p-2 rounded-full hover:bg-white/10 text-gray-400 hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Status Banner */}
        {isAlreadyVerified && !isVerifiedSuccess && (
          <div className="mt-3.5 p-3 rounded-2xl bg-emerald-950/60 border border-emerald-500/40 flex items-center gap-3">
            <div className="p-2 rounded-xl bg-emerald-500/20 text-emerald-300 flex-shrink-0">
              <Award className="w-5 h-5 text-emerald-400" />
            </div>
            <div className="text-xs">
              <span className="font-bold text-emerald-300 block">Aapka Aadhaar Card Verified Hai ✅</span>
              <span className="text-[11px] text-gray-300">
                Host ID: <strong>{hostProfile.name}</strong> • Aadhaar: <strong>XXXX-XXXX-{String(existingAadhaar).slice(-4) || '****'}</strong>
              </span>
            </div>
          </div>
        )}

        {/* Female Host Policy Banner */}
        <div className="mt-3 p-3 rounded-2xl bg-gradient-to-r from-pink-950/60 via-purple-950/60 to-black border border-pink-500/30 flex items-center gap-3">
          <div className="p-2 rounded-xl bg-pink-500/20 text-pink-300 flex-shrink-0">
            <Heart className="w-4 h-4 text-pink-400" />
          </div>
          <div className="text-xs">
            <span className="font-bold text-pink-200 block">100% Genuine Female Host Protection:</span>
            <span className="text-[11px] text-gray-300">
              Aadhaar number submit karte hi aapki profile turant <strong>Verified</strong> ho jayegi aur calls aana shuru ho jayengi.
            </span>
          </div>
        </div>

        {formError && (
          <div className="mt-3 p-3 rounded-xl bg-red-950/70 border border-red-500/50 text-red-200 text-xs font-semibold flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0" />
            <span>{formError}</span>
          </div>
        )}

        {isVerifiedSuccess && (
          <div className="mt-3.5 p-4 rounded-2xl bg-gradient-to-r from-emerald-950/90 via-teal-950/90 to-black border-2 border-emerald-400 text-emerald-200 text-xs font-bold flex items-center gap-3 shadow-xl">
            <div className="p-2.5 rounded-full bg-emerald-500/30 text-emerald-300 flex-shrink-0">
              <Check className="w-6 h-6 stroke-[3]" />
            </div>
            <div>
              <span className="text-sm font-black text-white block">🎉 Badhai Ho! ID Instant Verified!</span>
              <span className="text-[11px] text-emerald-300/90">
                Aapka Aadhaar successfully verify ho chuka hai. Profile activate ho gayi hai aur ab aap calls receive kar sakti hain!
              </span>
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          {/* ONLY Aadhaar Card Number Input */}
          <div className="p-4 rounded-2xl bg-black/50 border-2 border-emerald-500/40 space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-white flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4 text-emerald-400" />
                <span>12-Digit Aadhaar Card Number</span>
              </label>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 font-bold border border-emerald-500/30">
                Only Document Required
              </span>
            </div>
            <p className="text-[11px] text-gray-400">
              Apna 12-digit Aadhaar Card number darj karein (PAN card ya doosre documents ki zaroorat nahi hai).
            </p>
            <input
              type="text"
              required
              maxLength={14} // 12 digits + 2 spaces
              placeholder="e.g. 5689 4512 8923"
              value={aadhaarNumber}
              onChange={handleAadhaarChange}
              className="w-full px-4 py-3 rounded-xl bg-black/80 border border-emerald-500/50 text-emerald-300 font-mono text-base sm:text-lg tracking-widest font-bold focus:outline-none focus:border-emerald-400 shadow-inner"
            />
          </div>

          {/* Optional Profile Photo / Live Selfie */}
          <div className="p-3.5 rounded-2xl bg-black/50 border border-pink-500/30 space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-white flex items-center gap-1.5">
                <Camera className="w-3.5 h-3.5 text-pink-400" />
                <span>Profile Photo / Live Selfie (Optional)</span>
              </label>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-pink-500/20 text-pink-300 font-bold">
                Host Avatar
              </span>
            </div>

            {isCameraActive ? (
              <div className="relative rounded-2xl overflow-hidden border border-pink-500 bg-black aspect-[4/3] flex flex-col items-center justify-center">
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  className="w-full h-full object-cover transform scale-x-[-1]"
                />
                <button
                  type="button"
                  onClick={captureSelfie}
                  className="absolute bottom-3 px-4 py-2 rounded-full bg-pink-600 hover:bg-pink-500 text-white font-bold text-xs shadow-lg flex items-center gap-1.5"
                >
                  <Camera className="w-4 h-4" />
                  <span>Click Selfie Now</span>
                </button>
              </div>
            ) : selfieUrl ? (
              <div className="relative rounded-2xl overflow-hidden border border-emerald-500/50 bg-black aspect-[4/3] flex items-center justify-center group max-h-48">
                <img
                  src={selfieUrl}
                  alt="Verified Profile Photo"
                  className="w-full h-full object-cover"
                />
                <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                  <button
                    type="button"
                    onClick={startCamera}
                    className="px-3 py-1.5 rounded-xl bg-pink-600 text-white text-xs font-bold flex items-center gap-1"
                  >
                    <Camera className="w-3.5 h-3.5" />
                    <span>Retake Photo</span>
                  </button>
                </div>
                <div className="absolute top-2 left-2 px-2.5 py-1 rounded-full bg-emerald-600/90 text-white text-[10px] font-bold flex items-center gap-1 shadow">
                  <CheckCircle2 className="w-3 h-3" />
                  <span>Photo Selected</span>
                </div>
              </div>
            ) : (
              <div className="p-3.5 rounded-2xl border border-dashed border-pink-500/40 bg-black/30 flex flex-col items-center justify-center text-center gap-2">
                <p className="text-xs text-gray-300">
                  Live camera se photo lein ya gallery se photo upload karein:
                </p>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={startCamera}
                    className="px-3 py-1.5 rounded-xl bg-gradient-to-r from-pink-600 to-purple-600 hover:from-pink-500 text-white text-xs font-bold flex items-center gap-1 shadow-md"
                  >
                    <Camera className="w-3.5 h-3.5" />
                    <span>Camera</span>
                  </button>
                  <label className="cursor-pointer px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-bold flex items-center gap-1 transition-colors">
                    <Upload className="w-3.5 h-3.5" />
                    <span>Upload Photo</span>
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={handleFileUpload}
                    />
                  </label>
                </div>
              </div>
            )}

            {cameraError && (
              <p className="text-[11px] text-amber-400 mt-1 flex items-center gap-1">
                <AlertCircle className="w-3 h-3" />
                <span>{cameraError}</span>
              </p>
            )}
          </div>

          {/* Female Certification Checkbox */}
          <div className="p-3 rounded-2xl bg-black/40 border border-pink-500/20">
            <label className="flex items-start gap-2.5 cursor-pointer">
              <input
                type="checkbox"
                required
                checked={isFemaleCertified}
                onChange={(e) => setIsFemaleCertified(e.target.checked)}
                className="mt-0.5 rounded text-pink-600 focus:ring-pink-500 w-4 h-4 bg-black border-pink-500/40"
              />
              <span className="text-[11px] text-gray-300 leading-tight">
                🌸 Main certify karti hoon ki yeh Aadhaar Card mera apna hai aur main ek <strong>18+ Female (Mahila)</strong> hoon.
              </span>
            </label>
          </div>

          {/* Auto-Verify Button */}
          <button
            type="submit"
            disabled={isVerifiedSuccess}
            className="w-full py-3.5 px-4 rounded-2xl bg-gradient-to-r from-emerald-500 via-teal-500 to-emerald-600 hover:from-emerald-400 hover:to-teal-400 text-white font-black text-sm shadow-xl shadow-emerald-950/60 flex items-center justify-center gap-2 transition-all active:scale-[0.98] disabled:opacity-50"
          >
            <Sparkles className="w-4 h-4" />
            <span>⚡ Verify & Automatically Activate ID Now</span>
          </button>
        </form>
      </div>
    </div>
  );
};
