import React, { useState, useRef, useEffect } from 'react';
import {
  X,
  ShieldCheck,
  Camera,
  Upload,
  CheckCircle2,
  AlertCircle,
  Sparkles,
  Heart,
  Award,
  Clock,
  FileText,
  CreditCard,
  UserCheck,
  Check
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { useHost } from '../context/HostContext';
import { compressImageFile } from '../utils/imageCompressor';
import { getApiBaseUrl } from '../services/apiConfig';
import { HostVerificationData } from '../types';
import { setVideoScreenSecurity } from '../utils/screenSecurity';

export const HostVerificationModal: React.FC = () => {
  const {
    isVerificationModalOpen,
    closeVerificationModal,
    submitVerification,
    hostProfile,
    updateHostPhoto
  } = useHost();

  const currentVer = hostProfile.verification;

  // Form states
  const [selfieUrl, setSelfieUrl] = useState<string>('');
  const [panNumber, setPanNumber] = useState<string>('');
  const [panDocUrl, setPanDocUrl] = useState<string>('');
  const [secondaryType, setSecondaryType] = useState<'aadhaar' | 'voter' | 'driving_license'>('aadhaar');
  const [secondaryNumber, setSecondaryNumber] = useState<string>('');
  const [secondaryDocUrl, setSecondaryDocUrl] = useState<string>('');
  const [isFemaleCertified, setIsFemaleCertified] = useState<boolean>(true);

  // Camera states
  const [isCameraActive, setIsCameraActive] = useState<boolean>(false);
  const [cameraError, setCameraError] = useState<string | null>(null);

  // UI state
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [submitSuccess, setSubmitSuccess] = useState<boolean>(false);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const isVerified = Boolean(
    hostProfile.isVerified && currentVer?.status === 'verified'
  );
  const isPending = Boolean(!isVerified && currentVer?.status === 'pending');
  const isRejected = Boolean(currentVer?.status === 'rejected');

  const formatAadhaar = (val: string) => {
    const raw = val.replace(/\D/g, '').slice(0, 12);
    const parts = raw.match(/.{1,4}/g);
    return parts ? parts.join(' ') : raw;
  };

  useEffect(() => {
    if (isVerificationModalOpen) {
      setSelfieUrl(currentVer?.selfieUrl || hostProfile.avatar || '');
      setPanNumber(currentVer?.panNumber || '');
      setPanDocUrl(currentVer?.panDocUrl || '');
      
      const secType = currentVer?.secondaryIdType || currentVer?.residentIdType || 'aadhaar';
      setSecondaryType(secType === 'passport' ? 'aadhaar' : secType);
      
      const secNum = currentVer?.secondaryIdNumber || currentVer?.residentIdNumber || currentVer?.idNumber || '';
      setSecondaryNumber(secType === 'aadhaar' ? formatAadhaar(secNum) : secNum);
      setSecondaryDocUrl(currentVer?.secondaryDocUrl || currentVer?.residentDocUrl || '');
      
      setIsFemaleCertified(true);
      setFormError(null);
      setSubmitSuccess(false);
      setIsSubmitting(false);
    }
  }, [isVerificationModalOpen, hostProfile, currentVer]);

  if (!isVerificationModalOpen) return null;

  // Camera handling for Live Selfie
  const startCamera = async () => {
    setCameraError(null);
    try {
      if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 640 } }
        });
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
        setIsCameraActive(true);
        setVideoScreenSecurity(true);
      }
    } catch (err) {
      setCameraError('Camera access nahi mila. Kripya browser me permission allow karein ya photo upload karein.');
    }
  };

  const captureSelfie = () => {
    if (videoRef.current) {
      const video = videoRef.current;
      const canvas = document.createElement('canvas');
      canvas.width = Math.min(video.videoWidth || 480, 480);
      canvas.height = Math.min(video.videoHeight || 480, 480);
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
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
    if (isCameraActive) {
      setVideoScreenSecurity(false);
    }
    setIsCameraActive(false);
  };

  // Image Upload helper
  const handleDocUpload = async (
    e: React.ChangeEvent<HTMLInputElement>,
    setter: (url: string) => void
  ) => {
    const file = e.target.files?.[0];
    if (file) {
      try {
        const compressed = await compressImageFile(file, 800, 0.85);
        setter(compressed);
      } catch (err) {
        const reader = new FileReader();
        reader.onload = (event) => {
          if (event.target?.result) {
            setter(event.target.result as string);
          }
        };
        reader.readAsDataURL(file);
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    // 1. Live photo validation
    if (!selfieUrl) {
      setFormError('⚠️ Kripya apni Live Selfie camera se capture karein ya photo upload karein.');
      return;
    }

    // 2. PAN Card validation (10 alphanumeric characters)
    const cleanPan = panNumber.trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
    if (cleanPan.length !== 10) {
      setFormError('⚠️ Kripya 10-digit ka valid PAN Card number darj karein (e.g. ABCDE1234F).');
      return;
    }
    if (!panDocUrl) {
      setFormError('⚠️ Kripya PAN Card ki photo/document upload karein.');
      return;
    }

    // 3. Secondary ID validation (Aadhaar / Voter / Licence)
    const cleanSecNum = secondaryType === 'aadhaar'
      ? secondaryNumber.replace(/\D/g, '')
      : secondaryNumber.trim().toUpperCase();

    if (secondaryType === 'aadhaar' && cleanSecNum.length !== 12) {
      setFormError('⚠️ Kripya 12-digit ka valid Aadhaar Card number darj karein.');
      return;
    }
    if ((secondaryType === 'voter' || secondaryType === 'driving_license') && cleanSecNum.length < 5) {
      setFormError(`⚠️ Kripya valid ${secondaryType === 'voter' ? 'Voter ID' : 'Driving Licence'} number darj karein.`);
      return;
    }
    if (!secondaryDocUrl) {
      setFormError(`⚠️ Kripya ${secondaryType === 'aadhaar' ? 'Aadhaar Card' : secondaryType === 'voter' ? 'Voter ID' : 'Driving Licence'} ki photo upload karein.`);
      return;
    }

    if (!isFemaleCertified) {
      setFormError('⚠️ Kripya Female Certification par tick karein.');
      return;
    }

    setIsSubmitting(true);

    const verificationPayload: HostVerificationData = {
      panNumber: cleanPan,
      panDocUrl: panDocUrl,
      secondaryIdType: secondaryType,
      secondaryIdNumber: cleanSecNum,
      secondaryDocUrl: secondaryDocUrl,
      selfieUrl: selfieUrl,
      gender: 'female',
      status: 'pending', // Pending Admin approval!
      submittedAt: Date.now(),
      // Backward compatibility
      residentIdType: secondaryType,
      residentIdNumber: cleanSecNum,
      residentDocUrl: secondaryDocUrl,
      idType: secondaryType,
      idNumber: cleanSecNum
    };

    // 1. Submit to HostContext
    submitVerification(verificationPayload);

    if (selfieUrl) {
      updateHostPhoto(selfieUrl);
    }

    // 2. Submit to Server Backend
    try {
      const baseUrl = getApiBaseUrl();
      await fetch(`${baseUrl}/api/hosts/verification`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...verificationPayload,
          hostId: hostProfile.id,
          phone: hostProfile.phone
        })
      });
    } catch (err) {
      console.warn('Backend verification call note:', err);
    }

    stopCamera();
    setIsSubmitting(false);
    setSubmitSuccess(true);

    try {
      confetti({
        particleCount: 80,
        spread: 70,
        origin: { y: 0.6 }
      });
    } catch (e) {}

    setTimeout(() => {
      closeVerificationModal();
    }, 2800);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/85 backdrop-blur-md animate-in fade-in duration-200">
      <div className="relative w-full max-w-xl rounded-3xl bg-gradient-to-b from-[#180927] via-[#12061e] to-[#0a0212] border border-pink-500/40 shadow-2xl p-5 sm:p-6 text-white max-h-[92vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between pb-3.5 border-b border-pink-500/20">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-gradient-to-tr from-pink-600 to-purple-600 text-white shadow-lg shadow-pink-900/40">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-base sm:text-lg font-black text-white flex items-center gap-2">
                <span>Host ID Verification (KYC)</span>
                <span className="px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 text-[10px] font-bold border border-amber-500/30">
                  Admin Approval Required 🔒
                </span>
              </h3>
              <p className="text-[11px] text-pink-300/80">
                Live Photo + PAN Card + (Aadhaar / Voter / Licence) verification
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

        {/* Status Banners */}
        {isVerified && !submitSuccess && (
          <div className="mt-3.5 p-3 rounded-2xl bg-emerald-950/60 border border-emerald-500/40 flex items-center gap-3">
            <Award className="w-6 h-6 text-emerald-400 flex-shrink-0" />
            <div className="text-xs">
              <span className="font-bold text-emerald-300 block">Host ID Approved & Verified! ✅</span>
              <span className="text-[11px] text-gray-300">
                Aapki Host ID Super Admin dwaara verify ki ja chuki hai. Calls aana active hai.
              </span>
            </div>
          </div>
        )}

        {isPending && !submitSuccess && (
          <div className="mt-3.5 p-3 rounded-2xl bg-amber-950/60 border border-amber-500/40 flex items-center gap-3 animate-pulse">
            <Clock className="w-6 h-6 text-amber-400 flex-shrink-0" />
            <div className="text-xs">
              <span className="font-bold text-amber-300 block">KYC Under Admin Review ⏳</span>
              <span className="text-[11px] text-gray-300">
                Aapke documents jama ho chuke hain. Super Admin review karke approve karega tab aapki ID activate hogi.
              </span>
            </div>
          </div>
        )}

        {isRejected && !submitSuccess && (
          <div className="mt-3.5 p-3 rounded-2xl bg-red-950/70 border border-red-500/60 flex items-center gap-3">
            <AlertCircle className="w-6 h-6 text-red-400 flex-shrink-0" />
            <div className="text-xs">
              <span className="font-bold text-red-300 block">KYC Rejected by Admin ❌</span>
              <span className="text-[11px] text-red-200">
                Reason: {currentVer?.adminNote || (currentVer as any)?.rejectReason || 'Documents clear nahi the'}. Kripya dobara sahi documents upload karein.
              </span>
            </div>
          </div>
        )}

        {/* Policy Notice */}
        <div className="mt-3 p-3 rounded-2xl bg-gradient-to-r from-pink-950/60 via-purple-950/60 to-black border border-pink-500/30 flex items-center gap-3">
          <Heart className="w-4 h-4 text-pink-400 flex-shrink-0" />
          <div className="text-xs">
            <span className="font-bold text-pink-200 block">Genuine Female Host Verification Policy:</span>
            <span className="text-[11px] text-gray-300">
              Host activation ke liye <strong>(1) Live Photo</strong>, <strong>(2) PAN Card</strong> aur <strong>(3) Aadhaar / Voter / Licence me se koi 1 ID</strong> mandatory hai.
            </span>
          </div>
        </div>

        {formError && (
          <div className="mt-3 p-3 rounded-xl bg-red-950/70 border border-red-500/50 text-red-200 text-xs font-semibold flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0" />
            <span>{formError}</span>
          </div>
        )}

        {submitSuccess && (
          <div className="mt-3.5 p-4 rounded-2xl bg-gradient-to-r from-emerald-950/90 via-teal-950/90 to-black border-2 border-emerald-400 text-emerald-200 text-xs font-bold flex items-center gap-3 shadow-xl">
            <Check className="w-7 h-7 text-emerald-300 flex-shrink-0" />
            <div>
              <span className="text-sm font-black text-white block">✅ Documents Successfully Submitted!</span>
              <span className="text-[11px] text-emerald-300/90">
                Aapke KYC documents Super Admin ke review ke liye submit ho gaye hain. Admin approval milte hi aapki Host ID online activate ho jayegi!
              </span>
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          {/* 1. MANDATORY LIVE PHOTO / SELFIE */}
          <div className="p-4 rounded-2xl bg-black/50 border border-pink-500/30 space-y-2.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-white flex items-center gap-1.5">
                <Camera className="w-4 h-4 text-pink-400" />
                <span>1. Live Photo / Face Verification</span>
                <span className="text-rose-400 font-black">*</span>
              </label>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-pink-500/20 text-pink-300 font-bold border border-pink-500/30">
                Mandatory Live Selfie
              </span>
            </div>

            {isCameraActive ? (
              <div className="relative rounded-2xl overflow-hidden border-2 border-pink-500 bg-black aspect-[4/3] flex flex-col items-center justify-center">
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  className="w-full h-full object-cover transform scale-x-[-1]"
                />
                <button
                  type="button"
                  onClick={captureSelfie}
                  className="absolute bottom-3 px-5 py-2.5 rounded-full bg-pink-600 hover:bg-pink-500 text-white font-extrabold text-xs shadow-xl flex items-center gap-2 active:scale-95 transition-all"
                >
                  <Camera className="w-4 h-4" />
                  <span>Click Live Selfie Now</span>
                </button>
              </div>
            ) : selfieUrl ? (
              <div className="relative rounded-2xl overflow-hidden border border-emerald-500/50 bg-black aspect-[4/3] flex items-center justify-center group max-h-48">
                <img
                  src={selfieUrl}
                  alt="Live Selfie"
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
                  <span>Live Photo Captured</span>
                </div>
              </div>
            ) : (
              <div className="p-3.5 rounded-2xl border border-dashed border-pink-500/40 bg-black/30 flex flex-col items-center justify-center text-center gap-2">
                <p className="text-xs text-gray-300">
                  Real-time face verification ke liye camera se live selfie lein:
                </p>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={startCamera}
                    className="px-3.5 py-2 rounded-xl bg-gradient-to-r from-pink-600 to-purple-600 hover:from-pink-500 text-white text-xs font-bold flex items-center gap-1.5 shadow-md active:scale-95"
                  >
                    <Camera className="w-4 h-4" />
                    <span>Open Live Camera</span>
                  </button>
                  <label className="cursor-pointer px-3.5 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-bold flex items-center gap-1.5 transition-colors">
                    <Upload className="w-4 h-4" />
                    <span>Upload Selfie</span>
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => handleDocUpload(e, setSelfieUrl)}
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

          {/* 2. MANDATORY PAN CARD */}
          <div className="p-4 rounded-2xl bg-black/50 border border-purple-500/30 space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-white flex items-center gap-1.5">
                <CreditCard className="w-4 h-4 text-purple-400" />
                <span>2. PAN Card Verification</span>
                <span className="text-rose-400 font-black">*</span>
              </label>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-300 font-bold border border-purple-500/30">
                Mandatory ID
              </span>
            </div>

            <div>
              <span className="text-[11px] text-gray-300 font-medium block mb-1">
                10-Digit PAN Number (e.g. ABCDE1234F):
              </span>
              <input
                type="text"
                required
                maxLength={10}
                placeholder="ABCDE1234F"
                value={panNumber}
                onChange={(e) => setPanNumber(e.target.value.toUpperCase())}
                className="w-full px-3.5 py-2.5 rounded-xl bg-black/80 border border-purple-500/40 text-purple-300 font-mono text-sm tracking-wider uppercase font-bold focus:outline-none focus:border-purple-400"
              />
            </div>

            {/* PAN Document Photo Upload */}
            <div>
              <span className="text-[11px] text-gray-300 font-medium block mb-1">
                PAN Card Photo Upload:
              </span>
              {panDocUrl ? (
                <div className="relative rounded-xl overflow-hidden border border-purple-500/50 max-h-36 flex items-center justify-center bg-black/60 group">
                  <img src={panDocUrl} alt="PAN Document" className="w-full h-full object-cover max-h-36" />
                  <label className="absolute inset-0 bg-black/70 opacity-0 group-hover:opacity-100 flex items-center justify-center text-xs font-bold text-white cursor-pointer transition-opacity">
                    Change PAN Photo
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => handleDocUpload(e, setPanDocUrl)}
                    />
                  </label>
                  <div className="absolute top-2 left-2 px-2 py-0.5 rounded-full bg-emerald-600/90 text-white text-[9px] font-bold">
                    ✓ PAN Uploaded
                  </div>
                </div>
              ) : (
                <label className="cursor-pointer flex items-center justify-center gap-2 p-3 rounded-xl border border-dashed border-purple-500/40 bg-purple-950/10 hover:bg-purple-950/20 text-xs font-bold text-purple-300 transition-colors">
                  <Upload className="w-4 h-4" />
                  <span>Upload PAN Card Photo / Document</span>
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => handleDocUpload(e, setPanDocUrl)}
                  />
                </label>
              )}
            </div>
          </div>

          {/* 3. SECONDARY ID: SELECT 1 OF 3 (AADHAAR / VOTER / LICENCE) */}
          <div className="p-4 rounded-2xl bg-black/50 border border-emerald-500/30 space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-white flex items-center gap-1.5">
                <FileText className="w-4 h-4 text-emerald-400" />
                <span>3. Secondary ID (Choose 1 of 3)</span>
                <span className="text-rose-400 font-black">*</span>
              </label>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 font-bold border border-emerald-500/30">
                1 ID Must Hai
              </span>
            </div>

            {/* 3-Way Selector Pills */}
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => {
                  setSecondaryType('aadhaar');
                  setSecondaryNumber('');
                  setSecondaryDocUrl('');
                }}
                className={`py-2 px-2 rounded-xl text-xs font-bold transition-all border ${
                  secondaryType === 'aadhaar'
                    ? 'bg-emerald-600 text-white border-emerald-400 shadow-md'
                    : 'bg-white/5 text-gray-300 border-white/10 hover:bg-white/10'
                }`}
              >
                Aadhaar Card
              </button>
              <button
                type="button"
                onClick={() => {
                  setSecondaryType('voter');
                  setSecondaryNumber('');
                  setSecondaryDocUrl('');
                }}
                className={`py-2 px-2 rounded-xl text-xs font-bold transition-all border ${
                  secondaryType === 'voter'
                    ? 'bg-emerald-600 text-white border-emerald-400 shadow-md'
                    : 'bg-white/5 text-gray-300 border-white/10 hover:bg-white/10'
                }`}
              >
                Voter ID
              </button>
              <button
                type="button"
                onClick={() => {
                  setSecondaryType('driving_license');
                  setSecondaryNumber('');
                  setSecondaryDocUrl('');
                }}
                className={`py-2 px-2 rounded-xl text-xs font-bold transition-all border ${
                  secondaryType === 'driving_license'
                    ? 'bg-emerald-600 text-white border-emerald-400 shadow-md'
                    : 'bg-white/5 text-gray-300 border-white/10 hover:bg-white/10'
                }`}
              >
                Driving Licence
              </button>
            </div>

            {/* ID Number Input */}
            <div>
              <span className="text-[11px] text-gray-300 font-medium block mb-1">
                {secondaryType === 'aadhaar'
                  ? '12-Digit Aadhaar Card Number:'
                  : secondaryType === 'voter'
                  ? 'Voter ID (EPIC) Number:'
                  : 'Driving Licence Number:'}
              </span>
              <input
                type="text"
                required
                maxLength={secondaryType === 'aadhaar' ? 14 : 20}
                placeholder={
                  secondaryType === 'aadhaar'
                    ? '5689 4512 8923'
                    : secondaryType === 'voter'
                    ? 'ABC1234567'
                    : 'DL-0120110012345'
                }
                value={secondaryNumber}
                onChange={(e) => {
                  if (secondaryType === 'aadhaar') {
                    setSecondaryNumber(formatAadhaar(e.target.value));
                  } else {
                    setSecondaryNumber(e.target.value.toUpperCase());
                  }
                }}
                className="w-full px-3.5 py-2.5 rounded-xl bg-black/80 border border-emerald-500/40 text-emerald-300 font-mono text-sm tracking-wider font-bold focus:outline-none focus:border-emerald-400"
              />
            </div>

            {/* Secondary Document Photo Upload */}
            <div>
              <span className="text-[11px] text-gray-300 font-medium block mb-1">
                {secondaryType === 'aadhaar' ? 'Aadhaar' : secondaryType === 'voter' ? 'Voter ID' : 'Licence'} Photo Upload:
              </span>
              {secondaryDocUrl ? (
                <div className="relative rounded-xl overflow-hidden border border-emerald-500/50 max-h-36 flex items-center justify-center bg-black/60 group">
                  <img src={secondaryDocUrl} alt="Secondary Document" className="w-full h-full object-cover max-h-36" />
                  <label className="absolute inset-0 bg-black/70 opacity-0 group-hover:opacity-100 flex items-center justify-center text-xs font-bold text-white cursor-pointer transition-opacity">
                    Change Document Photo
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => handleDocUpload(e, setSecondaryDocUrl)}
                    />
                  </label>
                  <div className="absolute top-2 left-2 px-2 py-0.5 rounded-full bg-emerald-600/90 text-white text-[9px] font-bold">
                    ✓ Document Uploaded
                  </div>
                </div>
              ) : (
                <label className="cursor-pointer flex items-center justify-center gap-2 p-3 rounded-xl border border-dashed border-emerald-500/40 bg-emerald-950/10 hover:bg-emerald-950/20 text-xs font-bold text-emerald-300 transition-colors">
                  <Upload className="w-4 h-4" />
                  <span>Upload {secondaryType === 'aadhaar' ? 'Aadhaar Card' : secondaryType === 'voter' ? 'Voter ID' : 'Driving Licence'} Photo</span>
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => handleDocUpload(e, setSecondaryDocUrl)}
                  />
                </label>
              )}
            </div>
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
                🌸 Main certify karti hoon ki yeh documents mere apne hain aur main ek <strong>18+ Female (Mahila)</strong> hoon. Main Super Admin review ke liye agree karti hoon.
              </span>
            </label>
          </div>

          {/* Submit for Admin Approval Button */}
          <button
            type="submit"
            disabled={isSubmitting || submitSuccess}
            className="w-full py-3.5 px-4 rounded-2xl bg-gradient-to-r from-pink-600 via-rose-600 to-purple-600 hover:from-pink-500 hover:to-purple-500 text-white font-black text-sm shadow-xl shadow-pink-900/60 flex items-center justify-center gap-2 transition-all active:scale-[0.98] disabled:opacity-50"
          >
            {isSubmitting ? (
              <span>Submitting KYC to Super Admin...</span>
            ) : submitSuccess ? (
              <span>Submitted for Admin Review ✅</span>
            ) : (
              <>
                <ShieldCheck className="w-4 h-4" />
                <span>Submit KYC for Super Admin Approval 🔒</span>
              </>
            )}
          </button>
        </form>
      </div>
    </div>
  );
};
