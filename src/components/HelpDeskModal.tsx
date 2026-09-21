import React, { useState } from 'react';
import { X, Phone, MessageSquare, Headphones, ShieldCheck, Copy, Check, Clock, Sparkles } from 'lucide-react';

interface HelpDeskModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const HelpDeskModal: React.FC<HelpDeskModalProps> = ({ isOpen, onClose }) => {
  const [copied, setCopied] = useState(false);
  const supportNumber = '+91 98765 43210';
  const whatsappUrl = `https://wa.me/919876543210?text=${encodeURIComponent('Namaste SunoSakhi Help Desk, mujhe account/call related sahayata chahiye.')}`;

  if (!isOpen) return null;

  const handleCopy = () => {
    navigator.clipboard.writeText(supportNumber.replace(/\s+/g, ''));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="relative w-full max-w-md rounded-3xl bg-[#150a24] border border-pink-500/30 shadow-2xl p-6 text-white max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-pink-500/20">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-gradient-to-tr from-pink-600 to-purple-600 text-white shadow-lg shadow-pink-600/30">
              <Headphones className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white flex items-center gap-1.5">
                SunoSakhi Help Desk
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 font-bold border border-emerald-500/30">
                  24x7 LIVE
                </span>
              </h3>
              <p className="text-xs text-pink-300/80">WhatsApp & Direct Call Support</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-full hover:bg-white/10 text-gray-400 hover:text-white"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Channels Grid */}
        <div className="space-y-3.5 my-5">
          {/* WhatsApp Support */}
          <div className="p-4 rounded-2xl bg-gradient-to-r from-[#0d2a1b] to-[#123824] border border-emerald-500/40 shadow-lg">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2 text-emerald-400 font-bold text-sm">
                <span className="text-xl">💬</span>
                <span>WhatsApp Instant Support</span>
              </div>
              <span className="text-[10px] text-emerald-300 bg-emerald-950/80 px-2 py-0.5 rounded-full border border-emerald-600/40">
                Avg reply: 1 min
              </span>
            </div>
            <p className="text-xs text-emerald-100/80 mb-3 leading-relaxed">
              Recharge queries, wallet refund, ya call issues ke liye humare official WhatsApp par baat karein.
            </p>
            <a
              href={whatsappUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="w-full py-2.5 px-4 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-extrabold text-xs flex items-center justify-center gap-2 shadow-md transition-all"
            >
              <span>Chat on WhatsApp</span>
              <span className="text-sm">➔</span>
            </a>
          </div>

          {/* Direct Phone Call */}
          <div className="p-4 rounded-2xl bg-gradient-to-r from-[#2c123d] to-[#1e0a2d] border border-pink-500/40 shadow-lg">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2 text-pink-400 font-bold text-sm">
                <Phone className="w-4 h-4" />
                <span>Direct Customer Care Call</span>
              </div>
              <span className="text-[10px] text-pink-300 bg-pink-950/80 px-2 py-0.5 rounded-full border border-pink-600/40">
                Toll Free
              </span>
            </div>
            <p className="text-xs text-pink-100/80 mb-3 leading-relaxed">
              Customer care executive se phone par direct baat karke samasya ka samadhan paayein.
            </p>

            <div className="flex items-center gap-2">
              <a
                href="tel:+919876543210"
                className="flex-1 py-2.5 px-4 rounded-xl bg-gradient-to-r from-pink-600 to-rose-600 hover:from-pink-500 hover:to-rose-500 text-white font-extrabold text-xs flex items-center justify-center gap-2 shadow-md transition-all"
              >
                <Phone className="w-3.5 h-3.5" />
                <span>Call {supportNumber}</span>
              </a>

              <button
                onClick={handleCopy}
                className="py-2.5 px-3 rounded-xl bg-white/10 hover:bg-white/15 text-white text-xs font-semibold flex items-center gap-1 border border-white/10"
                title="Copy Number"
              >
                {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
              </button>
            </div>
          </div>
        </div>

        {/* Operating hours & Trust assurances */}
        <div className="p-3 rounded-2xl bg-black/40 border border-white/5 space-y-2 text-xs text-gray-300">
          <div className="flex items-center gap-2 text-pink-300">
            <Clock className="w-4 h-4 text-pink-400" />
            <span>Support Timing: <strong>24 Hours, 7 Days Available</strong></span>
          </div>
          <div className="flex items-center gap-2 text-emerald-300">
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
            <span>100% Secure & Confidential Grievance Resolution</span>
          </div>
        </div>
      </div>
    </div>
  );
};
