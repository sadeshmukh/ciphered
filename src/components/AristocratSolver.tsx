import { useState, useEffect, useRef } from "react";
import { samplePuzzles } from "../data/samplePuzzles";

interface Props {
  cipherText: string;
}

export default function AristocratSolver() {
  const letters = Array.from("ABCDEFGHIJKLMNOPQRSTUVWXYZ");
  const EMPTY_SLOT = null;
  const containerRef = useRef<HTMLDivElement>(null);
  const [charsPerLine, setCharsPerLine] = useState(0);

  // State for SUBSTITUTION mappings (uppercase)
  const [substitutions, setSubstitutions] = useState<Record<string, string>>(
    {}
  );
  const [cipherText, setCipherText] = useState(samplePuzzles[0].cipherText);
  const [isEditing, setIsEditing] = useState(false);
  const [isEditable, setIsEditable] = useState(false);
  const [isCaesarMode, setIsCaesarMode] = useState(false);
  const [caesarShift, setCaesarShift] = useState(0);
  const [letterOrder, setLetterOrder] = useState<(string | null)[]>(letters);
  const [frequencies, setFrequencies] = useState<Record<string, number>>({});
  const [currentSampleIndex, setCurrentSampleIndex] = useState(0);

  useEffect(() => {
    const updateCharsPerLine = () => {
      if (containerRef.current) {
        const containerWidth = containerRef.current.clientWidth;
        const labelWidth = 80; // w-20 = 5rem = 80px
        const availableWidth = (containerWidth - labelWidth) * 0.75; // 75% of remaining width
        const charWidth = 14; // Approximate width of monospace char + spacing
        // lwk all this is just a guess
        setCharsPerLine(Math.floor(availableWidth / charWidth));
      }
    };

    updateCharsPerLine();
    window.addEventListener("resize", updateCharsPerLine);
    return () => window.removeEventListener("resize", updateCharsPerLine);
  }, []);

  // pad with nulls
  useEffect(() => {
    const uniqueLetters = Array.from(
      new Set(cipherText.replace(/\s/g, "").toUpperCase())
    );
    // pad end
    const uniqueLettersWithPadding = [
      ...uniqueLetters,
      ...Array(26 - uniqueLetters.length).fill(null),
    ];

    setLetterOrder(uniqueLettersWithPadding);
  }, [cipherText]);

  // init freqs
  useEffect(() => {
    const freqs: Record<string, number> = {};
    Array.from(cipherText.toUpperCase()).forEach((char) => {
      if (char !== " ") {
        freqs[char] = (freqs[char] || 0) + 1;
      }
    });
    setFrequencies(freqs);
  }, [cipherText]);

  const handleTableInput = (cipherLetter: string, value: string) => {
    if (value) {
      const upperValue = value.toUpperCase();

      const newSubs = { ...substitutions };
      Object.entries(newSubs).forEach(([key, val]) => {
        if (val === upperValue) {
          delete newSubs[key];
        }
      });

      newSubs[cipherLetter] = upperValue;
      setSubstitutions(newSubs);
    } else {
      setSubstitutions((prev) => {
        const next = { ...prev };
        delete next[cipherLetter];
        return next;
      });
    }
  };

  const loadNextSample = () => {
    const sample = samplePuzzles[currentSampleIndex];
    setSubstitutions(sample.solution);
    setCipherText(sample.cipherText);
    setCurrentSampleIndex((prev) => (prev + 1) % samplePuzzles.length);
  };

  const handleCipherTextChange = (
    e: React.ChangeEvent<HTMLTextAreaElement>
  ) => {
    const newText = e.target.value.replace(/[\n\r]/g, "").toUpperCase();
    setCipherText(newText);
    setSubstitutions({});
  };

  const handleLetterOrderInput = (index: number, value: string) => {
    const upperValue = value.toUpperCase();
    if (
      (!upperValue && value !== "") ||
      (upperValue && !letters.includes(upperValue))
    )
      return;

    const newOrder = [...letterOrder];
    if (value === "") {
      newOrder[index] = EMPTY_SLOT;
    } else {
      const oldIndex = newOrder.indexOf(upperValue);
      if (oldIndex !== -1) {
        newOrder[oldIndex] = newOrder[index];
      }
      newOrder[index] = upperValue;

      const inputs = Array.from(document.querySelectorAll("input"));
      const currentIndex = inputs.indexOf(
        document.activeElement as HTMLInputElement
      );
      if (currentIndex < inputs.length - 1) {
        inputs[currentIndex + 1].focus();
      }
    }

    setLetterOrder(newOrder);
  };

  const resetLetterOrder = () => {
    setLetterOrder([...letters]);
  };

  const getFrequencyColor = (letter: string | null): string => {
    const freq = frequencies[letter ?? ""] ?? 0;
    if (freq === 0) return "bg-red-200";

    const sortedFrequencies = Object.values(frequencies).sort((a, b) => b - a);
    const medianIndex = Math.floor(sortedFrequencies.length / 2);
    const threshold = sortedFrequencies[medianIndex];

    return freq >= threshold ? "bg-green-200" : "bg-yellow-200";
  };

  const getTextLines = () => {
    if (!charsPerLine) return [cipherText];

    const lines: string[] = [];
    let currentLine = "";
    const words = cipherText.split(" ");

    for (const word of words) {
      if (currentLine.length + word.length + 1 <= charsPerLine) {
        currentLine += (currentLine.length ? " " : "") + word;
      } else {
        lines.push(currentLine);
        currentLine = word;
      }
    }
    if (currentLine) {
      lines.push(currentLine);
    }
    return lines;
  };

  const handleCaesarShift = (newShift: number) => {
    let shift = newShift;
    if (shift > 25) shift = 0;
    if (shift < 0) shift = 25;
    setCaesarShift(shift);

    const newSubs: Record<string, string> = {};
    letters.forEach((letter) => {
      const charCode = letter.charCodeAt(0);
      const shiftedCode = ((charCode - 65 + shift) % 26) + 65;
      newSubs[letter] = String.fromCharCode(shiftedCode);
    });
    setSubstitutions(newSubs);
  };

  return (
    <div className="bg-white rounded-lg shadow-lg p-6" ref={containerRef}>
      <div className="mb-4">
        <button
          onClick={() => setIsEditing(!isEditing)}
          className="flex items-center gap-2 text-gray-600 hover:text-gray-800 transition mb-2"
        >
          <span>{isEditing ? "▼" : "▶"} Edit Cipher Text</span>
        </button>
        {isEditing && (
          <textarea
            id="ciphertext"
            value={cipherText}
            onChange={handleCipherTextChange}
            className="w-full p-2 border rounded font-mono"
            rows={2}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
              }
            }}
          />
        )}
      </div>

      <div className="font-mono space-y-1 mb-8">
        {getTextLines().map((line, lineIndex) => (
          <div key={lineIndex * 2} className="space-y-1">
            <div className="flex">
              <span className="w-20 flex-shrink-0 text-gray-600">cipher:</span>
              <div className="flex tracking-wider text-lg">
                {Array.from(line).map((char, index) =>
                  char === " " ? (
                    <span key={index} className="w-[1ch]">
                      &nbsp;
                    </span>
                  ) : (
                    <span
                      key={index}
                      className="w-[1ch] text-center mx-[1px] font-mono"
                    >
                      {char}
                    </span>
                  )
                )}
              </div>
            </div>
            <div className="flex">
              <span className="w-20 flex-shrink-0 text-gray-600">plain:</span>
              <div className="flex tracking-wider text-lg">
                {Array.from(line).map((char, index) =>
                  char === " " ? (
                    <span key={index} className="w-[1ch]">
                      &nbsp;
                    </span>
                  ) : (
                    <span
                      key={index}
                      className="w-[1ch] text-center mx-[1px] font-mono bg-gray-50"
                    >
                      {substitutions[char] || "_"}
                    </span>
                  )
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="flex gap-4 mb-8">
        <button
          className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600 transition"
          onClick={() => setSubstitutions({})}
        >
          Reset
        </button>
        <button className="bg-green-500 text-white px-4 py-2 rounded hover:bg-green-600 transition">
          Check
        </button>
        <button className="bg-purple-500 text-white px-4 py-2 rounded hover:bg-purple-600 transition">
          Hint
        </button>
        <button
          className="bg-yellow-500 text-white px-4 py-2 rounded hover:bg-yellow-600 transition"
          onClick={loadNextSample}
        >
          Load Sample
        </button>
      </div>

      <div className="flex justify-between items-center mb-2">
        <div className="text-sm text-gray-600">Substitution Table</div>
        <div className="flex gap-2">
          {isEditable && (
            <button
              className="text-sm px-3 py-1 rounded bg-gray-100 hover:bg-gray-200 transition"
              onClick={resetLetterOrder}
            >
              Reset Order
            </button>
          )}
          <button
            className={`text-sm px-3 py-1 rounded transition ${
              isEditable
                ? "bg-indigo-100 text-indigo-700 hover:bg-indigo-200"
                : "bg-gray-100 hover:bg-gray-200"
            }`}
            onClick={() => setIsEditable(!isEditable)}
          >
            {isEditable ? "Lock" : "Unlock"}
          </button>
          <button
            className={`text-sm px-3 py-1 rounded transition ${
              isCaesarMode
                ? "bg-indigo-100 text-indigo-700 hover:bg-indigo-200"
                : "bg-gray-100 hover:bg-gray-200"
            }`}
            onClick={() => {
              setIsCaesarMode(!isCaesarMode);
              if (!isCaesarMode) {
                handleCaesarShift(0);
              }
            }}
          >
            Caesar
          </button>
          {isCaesarMode && (
            <div className="flex items-center gap-1">
              <button
                className="text-sm px-2 py-1 rounded bg-gray-100 hover:bg-gray-200 transition"
                onClick={() => handleCaesarShift(caesarShift - 1)}
              >
                -
              </button>
              <input
                type="number"
                className="w-12 text-center border rounded"
                value={caesarShift}
                onChange={(e) =>
                  handleCaesarShift(parseInt(e.target.value) || 0)
                }
                min="0"
                max="25"
              />
              <button
                className="text-sm px-2 py-1 rounded bg-gray-100 hover:bg-gray-200 transition"
                onClick={() => handleCaesarShift(caesarShift + 1)}
              >
                +
              </button>
            </div>
          )}
        </div>
      </div>

      {/* debatably dynamic tabular interface */}
      <table
        className={`w-full text-center table-fixed ${
          isEditable ? "border-indigo-200 border-2 rounded" : ""
        }`}
      >
        <thead>
          <tr>
            {letterOrder.map((letter, index) => (
              <th
                key={index}
                className={`w-[3.85%] px-1 py-2 text-sm font-mono ${
                  isEditable
                    ? "bg-indigo-50 hover:bg-indigo-100 transition cursor-pointer"
                    : "bg-gray-100"
                }`}
              >
                {isEditable ? (
                  <input
                    type="text"
                    maxLength={1}
                    className="w-full text-center bg-transparent font-mono outline-none"
                    value={letter ?? ""}
                    onChange={(e) =>
                      handleLetterOrderInput(index, e.target.value)
                    }
                    onKeyDown={(e) => {
                      if (e.key === "Backspace" && !e.currentTarget.value) {
                        const inputs = Array.from(
                          document.querySelectorAll("input")
                        );
                        const currentIndex = inputs.indexOf(e.currentTarget);
                        if (currentIndex > 0) {
                          inputs[currentIndex - 1].focus();
                        }
                      }
                    }}
                  />
                ) : (
                  letter ?? ""
                )}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          <tr>
            {letterOrder.map((letter, index) => (
              <td
                key={index}
                className={`px-1 py-2 text-sm font-mono border-b ${getFrequencyColor(
                  letter
                )}`}
              >
                {letter ? frequencies[letter] || 0 : 0}
              </td>
            ))}
          </tr>

          <tr>
            {letterOrder.map((letter, index) => (
              <td key={index} className="px-1 py-2">
                <input
                  type="text"
                  maxLength={1}
                  className="w-full h-8 text-center border rounded font-mono"
                  placeholder="_"
                  value={letter ? substitutions[letter] || "" : ""}
                  onChange={(e) =>
                    letter && handleTableInput(letter, e.target.value)
                  }
                  onKeyDown={(e) => {
                    if (e.key === "Backspace" && !e.currentTarget.value) {
                      const inputs = Array.from(
                        document.querySelectorAll("input")
                      );
                      const currentIndex = inputs.indexOf(e.currentTarget);
                      if (currentIndex > 0) {
                        inputs[currentIndex - 1].focus();
                      }
                    }
                  }}
                />
              </td>
            ))}
          </tr>
        </tbody>
      </table>
    </div>
  );
}
