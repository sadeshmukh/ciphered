import React, { useState, useEffect, useMemo, useRef } from "react";
import { useLocalStorage } from "../data/utils";

interface Props {
  cipherText?: string;
}

const MORSE_SYMBOLS = ["x", "o", "-"];

const MORSE_TRIPLETS: string[] = (() => {
  const out: string[] = [];
  for (const a of MORSE_SYMBOLS) {
    for (const b of MORSE_SYMBOLS) {
      for (const c of MORSE_SYMBOLS) {
        const t = `${a}${b}${c}`;
        if (t !== "xxx") out.push(t);
      }
    }
  }
  return out.sort();
})();

const MORSE_CODE: Record<string, string> = {
  A: "o-",
  B: "-ooo",
  C: "-o-o",
  D: "-oo",
  E: "o",
  F: "oo-o",
  G: "--o",
  H: "oooo",
  I: "oo",
  J: "o---",
  K: "-o-",
  L: "o-oo",
  M: "--",
  N: "-o",
  O: "---",
  P: "o--o",
  Q: "--o-",
  R: "o-o",
  S: "ooo",
  T: "-",
  U: "oo-",
  V: "ooo-",
  W: "o--",
  X: "-oo-",
  Y: "-o--",
  Z: "--oo",
  "0": "-----",
  "1": "o----",
  "2": "oo---",
  "3": "ooo--",
  "4": "oooo-",
  "5": "ooooo",
  "6": "-oooo",
  "7": "--ooo",
  "8": "---oo",
  "9": "----o",
};

const SAMPLE_CIPHER = "MGDKG FTVBM KLNOI BQXZA WCHRS PLYME";

// helper
function decodeMorseLetter(pattern: string): string {
  if (!pattern) return "";
  const entry = Object.entries(MORSE_CODE).find(
    ([, morse]) => morse === pattern
  );
  return entry ? entry[0] : "_";
}

// actual component here
export default function FractionatedSolver({
  cipherText: initialCipherText,
}: Props = {}) {
  const [cipherText, setCipherText] = useLocalStorage<string>(
    "fractionatedCipherText",
    (initialCipherText ?? SAMPLE_CIPHER).replace(/[^A-Za-z]/g, "").toUpperCase()
  );

  // cipherLetter -> triplet mapping
  const [subTable, setSubTable] = useLocalStorage<Record<string, string>>(
    "fractionatedSubTable",
    {}
  );

  const morseText = useMemo(() => {
    let out = "";
    for (const ch of cipherText) {
      if (ch === " ") {
        out += "x";
        continue;
      }
      out += subTable[ch] ?? "___"; // 3 underscores when unknown
    }
    return out;
  }, [cipherText, subTable]);

  const plainText = useMemo(() => {
    let buffer = "";
    let xStreak = 0;
    let out = "";

    const flush = () => {
      if (buffer) {
        out += buffer.includes("_") ? "_" : decodeMorseLetter(buffer);
        buffer = "";
      }
    };

    for (let i = 0; i < morseText.length; i++) {
      const ch = morseText[i];
      if (ch === "x") {
        xStreak++;
        if (xStreak === 1) {
          flush();
        } else if (xStreak === 2) {
          flush();
          out += " ";
          xStreak = 0;
        }
      } else {
        xStreak = 0;
        buffer += ch;
      }
    }
    flush();
    return out;
  }, [morseText]);

  const containerRef = useRef<HTMLDivElement>(null);
  const [charsPerLine, setCharsPerLine] = useState(0);

  useEffect(() => {
    const recalc = () => {
      if (!containerRef.current) return;
      const width = containerRef.current.clientWidth;
      const labelWidth = 80;
      const cellWidthPx = 36;
      setCharsPerLine(Math.floor((width - labelWidth) / cellWidthPx));
    };
    recalc();
    window.addEventListener("resize", recalc);
    return () => window.removeEventListener("resize", recalc);
  }, []);

  const cipherLines = useMemo(() => {
    if (!charsPerLine) return [cipherText];
    const lines: string[] = [];
    let current = "";
    for (const ch of cipherText) {
      if (current.length >= charsPerLine) {
        lines.push(current);
        current = "";
      }
      current += ch;
    }
    if (current) lines.push(current);
    return lines;
  }, [cipherText, charsPerLine]);

  const handleCipherChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const cleaned = e.target.value.replace(/[^A-Za-z]/g, "").toUpperCase();
    setCipherText(cleaned);
  };

  const handleTableInput = (triplet: string, value: string) => {
    const upper = value.toUpperCase();
    if (upper && !/^[A-Z]$/.test(upper)) return;

    setSubTable((prev) => {
      const next = { ...prev };

      Object.keys(next).forEach((k) => {
        if (next[k] === triplet) delete next[k];
      });

      if (upper) {
        Object.keys(next).forEach((k) => {
          if (k === upper) delete next[k];
        });
        next[upper] = triplet;
      }
      return next;
    });
  };

  // thanks to chatgpt for this wonderful tailwind
  return (
    <div className="flex gap-4">
      <div
        className="flex-1 bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6 overflow-x-auto"
        ref={containerRef}
      >
        <textarea
          value={cipherText}
          onChange={handleCipherChange}
          className="w-full p-2 mb-6 border dark:border-gray-600 rounded font-mono bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
          rows={2}
        />

        {/* lines */}
        <div className="font-mono space-y-1 mb-8">
          {cipherLines.map((line, idx) => {
            const morseSeg = morseText.slice(
              idx * charsPerLine * 3,
              idx * charsPerLine * 3 + line.length * 3
            );
            const plainSeg = plainText.slice(
              idx * charsPerLine,
              idx * charsPerLine + line.length
            );
            return (
              <div key={idx} className="space-y-1">
                {/* cipher */}
                <div className="flex">
                  <span className="w-20 flex-shrink-0 text-gray-600 dark:text-gray-400">
                    cipher:
                  </span>
                  <div className="flex">
                    {Array.from(line).map((c, i) => (
                      <span key={i} className="w-[3ch] mx-[1px] text-center">
                        {c}
                      </span>
                    ))}
                  </div>
                </div>
                {/* morse */}
                <div className="flex">
                  <span className="w-20 flex-shrink-0 text-gray-600 dark:text-gray-400">
                    morse:
                  </span>
                  <div className="flex">
                    {Array.from(line).map((_, i) => (
                      <span
                        key={i}
                        className="w-[3ch] mx-[1px] text-center uppercase text-blue-700 dark:text-blue-300"
                      >
                        {morseSeg.slice(i * 3, i * 3 + 3) || "___"}
                      </span>
                    ))}
                  </div>
                </div>
                {/* plain */}
                <div className="flex">
                  <span className="w-20 flex-shrink-0 text-gray-600 dark:text-gray-400">
                    plain:
                  </span>
                  <div className="flex">
                    {Array.from(line).map((_, i) => (
                      <span key={i} className="w-[3ch] mx-[1px] text-center">
                        {plainSeg[i] ?? "_"}
                      </span>
                    ))}
                  </div>
                </div>
                <div className="h-1 bg-gray-200 dark:bg-gray-700" />
              </div>
            );
          })}
        </div>

        <div className="mb-2 text-sm text-gray-600 dark:text-gray-400">
          Substitution Table
        </div>
        <table className="w-full text-center table-fixed border dark:border-gray-700">
          <thead>
            <tr>
              {MORSE_TRIPLETS.map((triplet) => (
                <th key={triplet} className="px-1 py-2">
                  <input
                    type="text"
                    maxLength={1}
                    className="w-8 h-8 text-center border dark:border-gray-600 rounded font-mono bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                    value={
                      Object.keys(subTable).find(
                        (ltr) => subTable[ltr] === triplet
                      ) || ""
                    }
                    onChange={(e) => handleTableInput(triplet, e.target.value)}
                  />
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            <tr>
              {MORSE_TRIPLETS.map((triplet) => (
                <td key={triplet} className="px-1 py-2 text-xs">
                  <div className="flex flex-col items-center leading-[0.8rem] select-none">
                    {triplet.split("").map((c, i) => (
                      <span key={i}>{c}</span>
                    ))}
                  </div>
                </td>
              ))}
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}
