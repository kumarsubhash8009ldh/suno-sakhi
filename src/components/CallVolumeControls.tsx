import React, { useState } from 'react';
import { Volume2, Volume1, VolumeX, Plus, Minus, Sliders, Sparkles } from 'lucide-react';
import { useCall } from '../context/CallContext';

interface CallVolumeControlsProps {
  compact?: boolean;
}

export const CallVolumeControls: React.FC<CallVolumeControlsProps> = ({ compact = false }) => {
  const {
    callVolume,
    setCallVolume,
    volumeUp,
    volumeDown,
    isSpeakerOn,
    toggleSpeaker
  } = useCall();

  const [showSlider, setShowSlider] = useState(false);

  const percent = Math.round(callVolume * 100);
  const isBoost = percent > 100;

  return (
    <div className="relative z-20 flex flex-col items-center">
      {/* Main Bar */}
      <div className="flex items-center gap-1.5 sm:gap-2 px-3 py-1.5 rounded-full bg-black/60 backdrop-blur-xl border border-white/15 shadow-2xl">
        {/* Speaker ON/OFF Toggle */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            toggleSpeaker();
          }}
          className={`px-2.5 py-1 sm:py-1.5 rounded-full flex items-center gap-1.5 text-xs font-bold transition-all ${
            isSpeakerOn
              ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/50 shadow-sm shadow-emerald-500/30'
              : 'bg-amber-500/20 text-amber-300 border border-amber-500/50 shadow-sm shadow-amber-500/30'
          }`}
          title={isSpeakerOn ? 'Switch to Earpiece / Soft Mode' : 'Switch to Loud Speaker Mode'}
        >
          {isSpeakerOn ? (
            <Volume2 className="w-3.5 h-3.5 text-emerald-400" />
          ) : (
            <Volume1 className="w-3.5 h-3.5 text-amber-400" />
          )}
          <span className="text-[11px] whitespace-nowrap">
            {isSpeakerOn ? 'Speaker ON' : 'Earpiece/Soft'}
          </span>
        </button>

        <div className="h-4 w-[1px] bg-white/20 mx-0.5"></div>

        {/* Volume Down Button */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            volumeDown();
          }}
          className="p-1 sm:p-1.5 rounded-full bg-white/10 hover:bg-white/20 active:scale-90 text-white transition-all"
          title="Decrease Volume (-15%)"
        >
          <Minus className="w-3.5 h-3.5" />
        </button>

        {/* Volume Level Badge / Toggle Slider */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            setShowSlider(!showSlider);
          }}
          className={`px-2 py-0.5 rounded-md font-mono text-[11px] font-extrabold flex items-center gap-1 transition-all ${
            isBoost
              ? 'bg-gradient-to-r from-pink-600/60 to-purple-600/60 text-yellow-300 border border-yellow-400/50 shadow-sm shadow-yellow-500/30'
              : 'bg-white/10 text-white hover:bg-white/15'
          }`}
          title="Tap to adjust volume slider"
        >
          {isBoost && <Sparkles className="w-3 h-3 text-yellow-300 animate-pulse" />}
          <span>{percent}%</span>
          {isBoost && <span className="text-[9px] text-pink-300 uppercase font-black">Boost</span>}
        </button>

        {/* Volume Up Button */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            volumeUp();
          }}
          className="p-1 sm:p-1.5 rounded-full bg-white/10 hover:bg-white/20 active:scale-90 text-white transition-all"
          title="Increase Volume (+15%)"
        >
          <Plus className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Expanded Slider Popover */}
      {showSlider && (
        <div
          onClick={(e) => e.stopPropagation()}
          className="mt-2 p-3 rounded-2xl bg-[#180928]/95 backdrop-blur-2xl border border-pink-500/40 shadow-2xl text-white flex flex-col gap-2.5 w-64 animate-in fade-in zoom-in duration-150"
        >
          <div className="flex items-center justify-between text-xs">
            <span className="text-gray-300 font-medium">Volume Control</span>
            <span className={`font-bold font-mono ${isBoost ? 'text-yellow-300' : 'text-pink-300'}`}>
              {percent}% {isBoost ? '(Loud Boost)' : ''}
            </span>
          </div>

          <input
            type="range"
            min="0.10"
            max="1.50"
            step="0.05"
            value={callVolume}
            onChange={(e) => setCallVolume(parseFloat(e.target.value))}
            className="w-full accent-pink-500 cursor-pointer h-2 bg-white/20 rounded-lg"
          />

          {/* Preset Buttons */}
          <div className="flex items-center justify-between gap-1 pt-1">
            {[
              { label: '30%', val: 0.3 },
              { label: '60%', val: 0.6 },
              { label: '100%', val: 1.0 },
              { label: '140%', val: 1.4 }
            ].map((preset) => (
              <button
                key={preset.label}
                onClick={() => setCallVolume(preset.val)}
                className={`px-2 py-1 rounded text-[10px] font-bold transition-all ${
                  Math.abs(callVolume - preset.val) < 0.08
                    ? 'bg-pink-600 text-white shadow'
                    : 'bg-white/10 hover:bg-white/20 text-gray-300'
                }`}
              >
                {preset.label}
              </button>
            ))}
          </div>

          <div className="flex items-center justify-between pt-1 border-t border-white/10 text-[11px] text-gray-300">
            <span>Audio Mode:</span>
            <button
              onClick={toggleSpeaker}
              className={`font-bold underline ${isSpeakerOn ? 'text-emerald-400' : 'text-amber-400'}`}
            >
              {isSpeakerOn ? '🔊 Loud Speaker' : '🔈 Soft Earpiece'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
