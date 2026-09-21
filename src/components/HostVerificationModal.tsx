import React, { useState, useRef, useEffect } from 'react';
import { X, ShieldCheck, Camera, Upload, CheckCircle2, AlertCircle, Sparkles, FileText, UserCheck, Heart } from 'lucide-react';
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

  const [panNumber, setPanNumber] = useState<string>(
    hostProfile.verification?.panNumber || ''
  );
  const [residentIdType, setResidentIdType] = useState<
    'aadhaar' | 'voter' | 'passport' | 'driving_license'
  >(hostProfile.verification?.residentIdType || 'aadhaar');
  const [residentIdNumber, setResidentIdNumber] = useState<string>(
    hostProfile.verification?.residentIdNumber || hostProfile.verification?.idNumber || ''
  );
  const [selfieUrl, setSelfieUrl] = useState<string>(
    hostProfile.verification?.selfieUrl || hostProfile.avatar || ''
  );
  const [isFemaleCertified, setIsFemaleCertified] = useState<boolean>(true);
  const [isCameraActive, setIsCameraActive] = useState<boolean>(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  useEffect(() => {
    if (isVerificationModalOpen) {
      setPanNumber(hostProfile.verification?.panNumber || '');
      setResidentIdType(hostProfile.verification?.residentIdType || 'aadhaar');
      setResidentIdNumber(
        hostProfile.verification?.residentIdNumber || hostProfile.verification?.idNumber || ''
      );
      setSelfieUrl(hostProfile.verification?.selfieUrl || hostProfile.avatar || '');
      setIsFemaleCertified(true);
      setFormError(null);
      setSuccessMessage(null);
    }
  }, [isVerificationModalOpen, hostProfile]);

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
        console.warn('Image upload failed, fallback to direct reader', err);
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

  const getResidentPlaceholder = () => {
    switch (residentIdType) {
      case 'aadhaar':
        return '12-digit Aadhaar: e.g. 5689 4512 8923';
      case 'voter':
        return 'Voter ID: e.g. ABC1234567';
      case 'passport':
        return 'Indian Passport No: e.g. Z1234567';
      case 'driving_license':
        return 'Driving License: e.g. DL-1420110012345';
      default:
        return 'Enter ID Number';
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (!isFemaleCertified) {
      setFormError('⚠️ Female Verification Policy: SunoSakhi par sirf Mahila (Female) hosts hi verify ho sakti hain. Kripya certification check karein.');
      return;
    }

    const cleanPan = panNumber.trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
    if (cleanPan.length !== 10) {
      setFormError('⚠️ Kripya valid 10-character PAN Card number dalein (e.g. ABCDE1234F).');
      return;
    }

    const cleanResidentNum = residentIdNumber.trim();
    if (!cleanResidentNum || cleanResidentNum.length < 4) {
      setFormError('⚠️ Kripya valid Resident ID Number (Aadhaar/Voter/Passport/DL) darj karein.');
      return;
    }

    if (residentIdType === 'aadhaar') {
      const cleanAadhaar = cleanResidentNum.replace(/\D/g, '');
      if (cleanAadhaar.length !== 12) {
        setFormError('⚠️ Aadhaar Card 12 digits ka hona chahiye (e.g. 1234 5678 9012).');
        return;
      }
    }

    if (!selfieUrl) {
      setFormError('⚠️ Kripya live camera se selfie capture karein ya photo upload karein.');
      return;
    }

    submitVerification({
      panNumber: cleanPan,
      residentIdType,
      residentIdNumber: cleanResidentNum,
      selfieUrl,
      gender: 'female',
      status: 'pending',
      idType: residentIdType,
      idNumber: cleanResidentNum
    });

    // Also update host avatar with verified photo
    updateHostPhoto(selfieUrl);

    stopCamera();
    setSuccessMessage('⏳ Verification Submitted! Admin dwara Live Face Selfie & ID check karne ke baad profile activate hogi.');
    setTimeout(() => {
      closeVerificationModal();
    }, 2000);
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
                <span>Host ID Verification</span>
                <span className="px-2 py-0.5 rounded-full bg-pink-500/20 text-pink-300 text-[10px] font-bold border border-pink-500/30">
                  Female Only 🌸
                </span>
              </h3>
              <p className="text-[11px] text-pink-300/80">
                PAN Card + Resident ID + Live Camera Selfie
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

        {/* Female Host Policy Banner */}
        <div className="mt-3.5 p-3 rounded-2xl bg-gradient-to-r from-pink-950/60 via-purple-950/60 to-black border border-pink-500/40 flex items-center gap-3">
          <div className="p-2 rounded-xl bg-pink-500/20 text-pink-300 flex-shrink-0">
            <Heart className="w-4 h-4 text-pink-400" />
          </div>
          <div className="text-xs">
            <span className="font-bold text-pink-200 block">Strict Female Host Policy:</span>
            <span className="text-[11px] text-gray-300">
              SunoSakhi par 100% genuine female companions hi register aur call receive karti hain.
            </span>
          </div>
        </div>

        {formError && (
          <div className="mt-3 p-3 rounded-xl bg-red-950/70 border border-red-500/50 text-red-200 text-xs font-semibold flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0" />
            <span>{formError}</span>
          </div>
        )}

        {successMessage && (
          <div className="mt-3 p-3 rounded-xl bg-emerald-950/70 border border-emerald-500/50 text-emerald-200 text-xs font-semibold flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
            <span>{successMessage}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          {/* Section 1: PAN Card (Mandatory for Identity & Payout Compliance) */}
          <div className="p-3.5 rounded-2xl bg-black/50 border border-pink-500/30 space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-white flex items-center gap-1.5">
                <FileText className="w-3.5 h-3.5 text-pink-400" />
                <span>1. PAN Card Number</span>
              </label>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-pink-500/20 text-pink-300 font-bold">
                Mandatory
              </span>
            </div>
            <p className="text-[10px] text-gray-400">
              Identity verification & instant UPI payout compliance ke liye anivarya hai.
            </p>
            <input
              type="text"
              required
              maxLength={10}
              placeholder="e.g. ABCDE1234F"
              value={panNumber}
              onChange={(e) => setPanNumber(e.target.value.toUpperCase())}
              className="w-full px-3.5 py-2.5 rounded-xl bg-black/60 border border-pink-500/40 text-white font-mono uppercase text-sm tracking-wider focus:outline-none focus:border-pink-400 shadow-inner"
            />
          </div>

          {/* Section 2: Resident ID Proof (Aadhaar / Voter ID / Passport / Driving License) */}
          <div className="p-3.5 rounded-2xl bg-black/50 border border-purple-500/30 space-y-2.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-white flex items-center gap-1.5">
                <ShieldCheck className="w-3.5 h-3.5 text-purple-400" />
                <span>2. Resident ID Proof (Nivas Praman Patra)</span>
              </label>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-300 font-bold">
                Choose Any 1
              </span>
            </div>

            {/* Selector for 4 Government Resident IDs */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
              {[
                { id: 'aadhaar', label: 'Aadhaar Card' },
                { id: 'voter', label: 'Voter ID' },
                { id: 'passport', label: 'Passport' },
                { id: 'driving_license', label: 'Driving Lic.' }
              ].map((item) => (
                <button
                  type="button"
                  key={item.id}
                  onClick={() => setResidentIdType(item.id as any)}
                  className={`py-2 px-2 text-[11px] font-bold rounded-xl border transition-all ${
                    residentIdType === item.id
                      ? 'bg-gradient-to-r from-purple-600 to-pink-600 border-purple-400 text-white shadow-md'
                      : 'bg-black/40 border-white/10 text-gray-400 hover:text-white'
                  }`}
                >
                  {item.label}
                </button>
              ))}
            </div>

            <div>
              <label className="text-[11px] font-semibold text-gray-300 block mb-1">
                {residentIdType === 'aadhaar'
                  ? 'Aadhaar Card (12 Digits)'
                  : residentIdType === 'voter'
                  ? 'Voter ID Card Number'
                  : residentIdType === 'passport'
                  ? 'Passport Number'
                  : 'Driving License Number'}
              </label>
              <input
                type="text"
                required
                placeholder={getResidentPlaceholder()}
                value={residentIdNumber}
                onChange={(e) => setResidentIdNumber(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl bg-black/60 border border-purple-500/40 text-white font-mono text-sm tracking-wider focus:outline-none focus:border-purple-400 shadow-inner"
              />
            </div>
          </div>

          {/* Section 3: Live Camera Photo / Selfie */}
          <div className="p-3.5 rounded-2xl bg-black/50 border border-pink-500/30 space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-white flex items-center gap-1.5">
                <Camera className="w-3.5 h-3.5 text-pink-400" />
                <span>3. Live Camera Photo / Selfie</span>
              </label>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 font-bold">
                Face Match
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
              <div className="relative rounded-2xl overflow-hidden border border-emerald-500/50 bg-black aspect-[4/3] flex items-center justify-center group">
                <img
                  src={selfieUrl}
                  alt="Verified Live Selfie"
                  className="w-full h-full object-cover"
                />
                <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                  <button
                    type="button"
                    onClick={startCamera}
                    className="px-3 py-1.5 rounded-xl bg-pink-600 text-white text-xs font-bold flex items-center gap-1"
                  >
                    <Camera className="w-3.5 h-3.5" />
                    <span>Retake Live Selfie</span>
                  </button>
                </div>
                <div className="absolute top-2 left-2 px-2.5 py-1 rounded-full bg-emerald-600/90 text-white text-[10px] font-bold flex items-center gap-1 shadow">
                  <CheckCircle2 className="w-3 h-3" />
                  <span>Photo Ready</span>
                </div>
              </div>
            ) : (
              <div className="p-4 rounded-2xl border border-dashed border-pink-500/40 bg-black/30 flex flex-col items-center justify-center text-center gap-2">
                <div className="p-3 rounded-full bg-pink-500/10 text-pink-400">
                  <Camera className="w-6 h-6" />
                </div>
                <p className="text-xs text-gray-300">
                  Live camera se selfie lein ya phone gallery se photo upload karein.
                </p>
                <div className="flex items-center gap-2 mt-1">
                  <button
                    type="button"
                    onClick={startCamera}
                    className="px-3.5 py-2 rounded-xl bg-gradient-to-r from-pink-600 to-purple-600 hover:from-pink-500 hover:to-purple-500 text-white text-xs font-bold flex items-center gap-1 shadow-md"
                  >
                    <Camera className="w-3.5 h-3.5" />
                    <span>Open Camera</span>
                  </button>
                  <label className="cursor-pointer px-3.5 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-bold flex items-center gap-1 transition-colors">
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

          {/* Section 4: Mandatory Female Host Certification */}
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
                🌸 Main certify karti hoon ki main ek <strong>18+ Female (Mahila)</strong> hoon aur yeh PAN Card va Resident ID meri apni hai.
              </span>
            </label>
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            className="w-full py-3.5 px-4 rounded-2xl bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-500 hover:from-emerald-500 hover:to-teal-500 text-white font-black text-xs sm:text-sm shadow-xl shadow-emerald-950/60 flex items-center justify-center gap-2 transition-all active:scale-[0.98]"
          >
            <Sparkles className="w-4 h-4" />
            <span>Verify & Activate Host Girl Profile ✅</span>
          </button>
        </form>
      </div>
    </div>
  );
};

