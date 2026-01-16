
import React, { useState, useEffect } from 'react';
import Lottie from 'lottie-react';
import { Language } from '../types';
import { TRANSLATIONS } from '../utils/i18n';

// Travel-themed Lottie animation data (airplane flying around globe)
const travelAnimation = {
  "v": "5.7.4",
  "fr": 30,
  "ip": 0,
  "op": 120,
  "w": 200,
  "h": 200,
  "nm": "Travel Loading",
  "ddd": 0,
  "assets": [],
  "layers": [
    {
      "ddd": 0,
      "ind": 1,
      "ty": 4,
      "nm": "Plane",
      "sr": 1,
      "ks": {
        "o": { "a": 0, "k": 100 },
        "r": {
          "a": 1,
          "k": [
            { "i": { "x": [0.667], "y": [1] }, "o": { "x": [0.333], "y": [0] }, "t": 0, "s": [0] },
            { "t": 120, "s": [360] }
          ]
        },
        "p": { "a": 0, "k": [100, 100, 0] },
        "a": { "a": 0, "k": [0, 0, 0] },
        "s": { "a": 0, "k": [100, 100, 100] }
      },
      "ao": 0,
      "shapes": [
        {
          "ty": "gr",
          "it": [
            {
              "ty": "el",
              "s": { "a": 0, "k": [120, 120] },
              "p": { "a": 0, "k": [0, 0] },
              "nm": "Orbit"
            },
            {
              "ty": "st",
              "c": { "a": 0, "k": [0.2, 0.4, 0.8, 1] },
              "o": { "a": 0, "k": 30 },
              "w": { "a": 0, "k": 3 },
              "lc": 2,
              "lj": 1,
              "ml": 4,
              "d": [{ "n": "d", "nm": "dash", "v": { "a": 0, "k": 8 } }, { "n": "g", "nm": "gap", "v": { "a": 0, "k": 8 } }],
              "nm": "Stroke"
            },
            {
              "ty": "tr",
              "p": { "a": 0, "k": [0, 0] },
              "a": { "a": 0, "k": [0, 0] },
              "s": { "a": 0, "k": [100, 100] },
              "r": { "a": 0, "k": 0 },
              "o": { "a": 0, "k": 100 }
            }
          ],
          "nm": "Orbit Group"
        },
        {
          "ty": "gr",
          "it": [
            {
              "ind": 0,
              "ty": "sh",
              "ks": {
                "a": 0,
                "k": {
                  "i": [[0, 0], [0, 0], [0, 0], [0, 0], [0, 0]],
                  "o": [[0, 0], [0, 0], [0, 0], [0, 0], [0, 0]],
                  "v": [[60, 0], [70, -5], [75, 0], [70, 5], [60, 0]],
                  "c": true
                }
              },
              "nm": "Plane Shape"
            },
            {
              "ty": "fl",
              "c": { "a": 0, "k": [0.2, 0.4, 0.9, 1] },
              "o": { "a": 0, "k": 100 },
              "r": 1,
              "nm": "Fill"
            },
            {
              "ty": "tr",
              "p": { "a": 0, "k": [0, 0] },
              "a": { "a": 0, "k": [0, 0] },
              "s": { "a": 0, "k": [100, 100] },
              "r": { "a": 0, "k": 0 },
              "o": { "a": 0, "k": 100 }
            }
          ],
          "nm": "Plane Group"
        }
      ],
      "ip": 0,
      "op": 120,
      "st": 0
    },
    {
      "ddd": 0,
      "ind": 2,
      "ty": 4,
      "nm": "Globe",
      "sr": 1,
      "ks": {
        "o": { "a": 0, "k": 100 },
        "r": { "a": 0, "k": 0 },
        "p": { "a": 0, "k": [100, 100, 0] },
        "a": { "a": 0, "k": [0, 0, 0] },
        "s": {
          "a": 1,
          "k": [
            { "i": { "x": [0.667, 0.667, 0.667], "y": [1, 1, 1] }, "o": { "x": [0.333, 0.333, 0.333], "y": [0, 0, 0] }, "t": 0, "s": [100, 100, 100] },
            { "i": { "x": [0.667, 0.667, 0.667], "y": [1, 1, 1] }, "o": { "x": [0.333, 0.333, 0.333], "y": [0, 0, 0] }, "t": 60, "s": [105, 105, 100] },
            { "t": 120, "s": [100, 100, 100] }
          ]
        }
      },
      "ao": 0,
      "shapes": [
        {
          "ty": "gr",
          "it": [
            {
              "ty": "el",
              "s": { "a": 0, "k": [80, 80] },
              "p": { "a": 0, "k": [0, 0] },
              "nm": "Globe Circle"
            },
            {
              "ty": "fl",
              "c": { "a": 0, "k": [0.3, 0.5, 0.9, 1] },
              "o": { "a": 0, "k": 100 },
              "r": 1,
              "nm": "Fill"
            },
            {
              "ty": "tr",
              "p": { "a": 0, "k": [0, 0] },
              "a": { "a": 0, "k": [0, 0] },
              "s": { "a": 0, "k": [100, 100] },
              "r": { "a": 0, "k": 0 },
              "o": { "a": 0, "k": 100 }
            }
          ],
          "nm": "Globe Group"
        },
        {
          "ty": "gr",
          "it": [
            {
              "ty": "el",
              "s": { "a": 0, "k": [80, 40] },
              "p": { "a": 0, "k": [0, 0] },
              "nm": "Latitude"
            },
            {
              "ty": "st",
              "c": { "a": 0, "k": [1, 1, 1, 0.3] },
              "o": { "a": 0, "k": 100 },
              "w": { "a": 0, "k": 2 },
              "lc": 2,
              "lj": 1,
              "nm": "Stroke"
            },
            {
              "ty": "tr",
              "p": { "a": 0, "k": [0, 0] },
              "a": { "a": 0, "k": [0, 0] },
              "s": { "a": 0, "k": [100, 100] },
              "r": { "a": 0, "k": 0 },
              "o": { "a": 0, "k": 100 }
            }
          ],
          "nm": "Latitude Group"
        },
        {
          "ty": "gr",
          "it": [
            {
              "ty": "el",
              "s": { "a": 0, "k": [40, 80] },
              "p": { "a": 0, "k": [0, 0] },
              "nm": "Longitude"
            },
            {
              "ty": "st",
              "c": { "a": 0, "k": [1, 1, 1, 0.3] },
              "o": { "a": 0, "k": 100 },
              "w": { "a": 0, "k": 2 },
              "lc": 2,
              "lj": 1,
              "nm": "Stroke"
            },
            {
              "ty": "tr",
              "p": { "a": 0, "k": [0, 0] },
              "a": { "a": 0, "k": [0, 0] },
              "s": { "a": 0, "k": [100, 100] },
              "r": { "a": 0, "k": 0 },
              "o": { "a": 0, "k": 100 }
            }
          ],
          "nm": "Longitude Group"
        }
      ],
      "ip": 0,
      "op": 120,
      "st": 0
    }
  ]
};

interface LoadingOverlayProps {
  language: Language;
}

const LoadingOverlay: React.FC<LoadingOverlayProps> = ({ language }) => {
  const t = TRANSLATIONS[language];
  const [tipIndex, setTipIndex] = useState(0);
  const [dots, setDots] = useState('');

  // Rotate through loading tips
  useEffect(() => {
    const tipInterval = setInterval(() => {
      setTipIndex((prev) => (prev + 1) % t.loading.tips.length);
    }, 4000);

    return () => clearInterval(tipInterval);
  }, [t.loading.tips.length]);

  // Animate dots
  useEffect(() => {
    const dotsInterval = setInterval(() => {
      setDots((prev) => (prev.length >= 3 ? '' : prev + '.'));
    }, 500);

    return () => clearInterval(dotsInterval);
  }, []);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/80 backdrop-blur-md">
      <div className="bg-white/95 backdrop-blur-xl rounded-3xl shadow-2xl p-8 md:p-12 max-w-md mx-4 text-center border border-white/20">
        {/* Lottie Animation */}
        <div className="w-40 h-40 mx-auto mb-6">
          <Lottie
            animationData={travelAnimation}
            loop={true}
            autoplay={true}
          />
        </div>

        {/* Main Loading Text */}
        <h2 className="text-2xl md:text-3xl font-bold text-slate-800 mb-3">
          {t.loading.title}
        </h2>

        {/* Subtitle with animated dots */}
        <p className="text-slate-500 mb-6 font-mono text-sm">
          {t.loading.subtitle}<span className="inline-block w-6 text-left">{dots}</span>
        </p>

        {/* Progress bar */}
        <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden mb-6">
          <div className="h-full bg-gradient-to-r from-blue-500 via-purple-500 to-pink-500 rounded-full animate-loading-bar" />
        </div>

        {/* Rotating Tips */}
        <div className="bg-blue-50/80 rounded-xl p-4 border border-blue-100">
          <p className="text-xs text-blue-400 uppercase tracking-wider font-bold mb-2">
            {t.loading.tip_label}
          </p>
          <p className="text-sm text-blue-700 leading-relaxed transition-all duration-500">
            {t.loading.tips[tipIndex]}
          </p>
        </div>

        {/* Estimated time */}
        <p className="text-xs text-slate-400 mt-6 font-mono">
          {t.loading.estimated_time}
        </p>
      </div>

      {/* CSS for loading bar animation */}
      <style>{`
        @keyframes loading-bar {
          0% {
            width: 0%;
            margin-left: 0%;
          }
          50% {
            width: 60%;
            margin-left: 20%;
          }
          100% {
            width: 0%;
            margin-left: 100%;
          }
        }
        .animate-loading-bar {
          animation: loading-bar 2s ease-in-out infinite;
        }
      `}</style>
    </div>
  );
};

export default LoadingOverlay;
