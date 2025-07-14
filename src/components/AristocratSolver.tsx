import { useState, useEffect, useRef, useMemo } from "react";
import { samplePuzzles } from "../data/samplePuzzles";
import { useLocalStorage, getWordPattern } from "../data/utils";
import { cipherDocs } from "../data/cipherDocs";
import CipherDocsPanel from "./CipherDocsPanel";
import React from "react";

import { BarChart } from "chartist";

interface Props {
  cipherText?: string;
  patternURL?: string;
}

interface PatternWords {
  [pattern: string]: string[];
}

interface PredictWords {
  [partialWord: string]: string[];
}

interface HintSuggestion {
  type:
    | "digraph"
    | "trigraph"
    | "pattern"
    | "frequency"
    | "structure"
    | "apostrophe";
  title: string;
  description: string;
  positions: number[];
  confidence: "high" | "medium" | "low";
  details?: string;
}

const getDigraphs = () =>
  cipherDocs.find((doc) => doc.title === "Common Digraphs")?.items || []; // .find my goat
const getTrigraphs = () =>
  cipherDocs.find((doc) => doc.title === "Common Trigraphs")?.items || [];
const getCommonWords = () => {
  const commonWordsSection = cipherDocs.find(
    (doc) => doc.title === "Common Words"
  );
  return {
    twoLetter:
      commonWordsSection?.subsections?.find((sub) => sub.title === "2 letters")
        ?.items || [],
    threeLetter:
      commonWordsSection?.subsections?.find((sub) => sub.title === "3 letters")
        ?.items || [],
  };
};
const getCommonEndings = () =>
  cipherDocs.find((doc) => doc.title === "Common Endings")?.items || [];

export default function AristocratSolver(props: Props = {}) {
  const { cipherText: initialCipherText, patternURL } = props;
  const letters: (string | null)[] = Array.from("ABCDEFGHIJKLMNOPQRSTUVWXYZ");
  const EMPTY_SLOT = null;
  const containerRef = useRef<HTMLDivElement>(null);
  const [charsPerLine, setCharsPerLine] = useState(0);

  // State for SUBSTITUTION mappings (uppercase)
  const [substitutions, setSubstitutions] = useLocalStorage<
    Record<string, string>
  >("substitutions", {} as Record<string, string>);
  const [cipherText, setCipherText] = useLocalStorage<string>(
    "cipherText",
    initialCipherText || samplePuzzles[0].cipherText
  );
  const [isEditingCipherText, setIsEditingCipherText] = useState(false);
  const [isEditableSubHeader, setIsEditableSubHeader] = useState(false);
  const [isCaesarMode, setIsCaesarMode] = useState(false);
  const [caesarShift, setCaesarShift] = useState(0);
  const [showCaesarModal, setShowCaesarModal] = useState(false);
  const [showDocsPanel, setShowDocsPanel] = useState(false);
  const [letterOrder, setLetterOrder] = useLocalStorage<Array<string | null>>(
    "letterOrder",
    letters as Array<string | null>
  );
  const [timer, setTimer] = useState(0);
  const [isTimerRunning, setIsTimerRunning] = useState(false);
  const timerRef = useRef<NodeJS.Timeout | undefined>(undefined);
  const [currentSampleIndex, setCurrentSampleIndex] = useState(0);

  const [patternWords, setPatternWords] = useState<PatternWords>({});
  const [predictWords, setPredictWords] = useState<PredictWords>({});
  const [isLoadingPatterns, setIsLoadingPatterns] = useState(false);
  const [isLoadingPredictions, setIsLoadingPredictions] = useState(false);
  const patternFetchTimeoutRef = useRef<NodeJS.Timeout | undefined>(undefined);
  const predictFetchTimeoutRef = useRef<NodeJS.Timeout | undefined>(undefined);
  const [showWordModal, setShowWordModal] = useState(false);
  const [currentWordPattern, setCurrentWordPattern] = useState<{
    pattern: string;
    word: string;
  } | null>(null);
  const [showPatternWords, setShowPatternWords] = useState(true);
  const [showPredictWords, setShowPredictWords] = useState(true);
  const [isReporting, setIsReporting] = useState(false);

  // HINT SYSTEM
  const [showHintPanel, setShowHintPanel] = useState(false);
  const [hintSuggestions, setHintSuggestions] = useState<HintSuggestion[]>([]);
  const [maxHintsToShow, setMaxHintsToShow] = useState(5);

  // Memoize frequency calculation
  const frequencies = useMemo(() => {
    const freqs: Record<string, number> = {};
    Array.from(cipherText.toUpperCase()).forEach((char) => {
      if (char !== " ") {
        freqs[char] = (freqs[char] || 0) + 1;
      }
    });
    return freqs;
  }, [cipherText]);

  const chartRef = useRef<HTMLDivElement>(null);
  const chartInstanceRef = useRef<any>(null);

  useEffect(() => {
    if (!chartRef.current) return;

    // without below - serious performance issues
    if (chartInstanceRef.current) {
      chartInstanceRef.current.detach();
    }

    const filteredLetters = letterOrder.filter((letter) => letter !== null);

    const chartData = {
      labels: filteredLetters.map((letter) => letter!.toUpperCase()),
      series: [filteredLetters.map((letter) => frequencies[letter!] || 0)],
    };

    chartInstanceRef.current = new BarChart(chartRef.current, chartData, {
      axisX: {
        offset: 50,
      },
      axisY: {
        offset: 30,
        onlyInteger: true,
      },
      height: 300,
    });

    return () => {
      // cleanup
      if (chartInstanceRef.current) {
        chartInstanceRef.current.detach();
      }
    };
  }, [letterOrder, frequencies]);

  // check if all letters in the cipher pattern are already solved
  const areAllLettersFilled = (cipherPattern: string) => {
    for (const letter of cipherPattern.replace(/[^A-Z]/g, "")) {
      if (!substitutions[letter]) {
        return false;
      }
    }
    return true;
  };

  const generateHints = useMemo(() => {
    const hints: HintSuggestion[] = [];
    const cleanText = cipherText.replace(/\s+/g, " ").trim();
    const words = cleanText.split(" ");

    // digraphs
    const digraphCounts: Record<string, number[]> = {};
    for (let i = 0; i < cleanText.length - 1; i++) {
      if (cleanText[i] !== " " && cleanText[i + 1] !== " ") {
        const digraph = cleanText.slice(i, i + 2);

        // check if this is part of a longer word
        const prevChar = i > 0 ? cleanText[i - 1] : " ";
        const nextChar = i + 2 < cleanText.length ? cleanText[i + 2] : " ";
        const isPartOfLongerWord = prevChar !== " " || nextChar !== " ";

        if (isPartOfLongerWord) {
          if (!digraphCounts[digraph]) digraphCounts[digraph] = [];
          digraphCounts[digraph].push(i);
        }
      }
    }

    Object.entries(digraphCounts).forEach(([digraph, positions]) => {
      if (positions.length >= 3) {
        const commonDigraphs = getDigraphs().slice(0, 5);
        if (!areAllLettersFilled(digraph)) {
          hints.push({
            type: "digraph",
            title: `Repeated digraph: ${digraph}`,
            description: `This 2-letter combination appears ${
              positions.length
            } times within words. Common digraphs: ${commonDigraphs.join(
              ", "
            )}.`,
            positions,
            confidence: positions.length >= 4 ? "high" : "medium",
            details: `Most frequent: TH, HE, AN, IN, ER.`,
          });
        }
      }
    });

    // trigraphs - repeated 3-letter combinations (within words, not standalone 3-letter words)
    const trigraphCounts: Record<string, number[]> = {};
    for (let i = 0; i < cleanText.length - 2; i++) {
      if (
        cleanText[i] !== " " &&
        cleanText[i + 1] !== " " &&
        cleanText[i + 2] !== " "
      ) {
        const trigraph = cleanText.slice(i, i + 3);

        // check if this is part of a longer word (not a standalone 3-letter word)
        const prevChar = i > 0 ? cleanText[i - 1] : " ";
        const nextChar = i + 3 < cleanText.length ? cleanText[i + 3] : " ";
        const isPartOfLongerWord = prevChar !== " " || nextChar !== " ";

        if (isPartOfLongerWord) {
          if (!trigraphCounts[trigraph]) trigraphCounts[trigraph] = [];
          trigraphCounts[trigraph].push(i);
        }
      }
    }

    Object.entries(trigraphCounts).forEach(([trigraph, positions]) => {
      if (positions.length >= 3) {
        const commonTrigraphs = getTrigraphs().slice(0, 5);
        if (!areAllLettersFilled(trigraph)) {
          hints.push({
            type: "trigraph",
            title: `Repeated trigraph: ${trigraph}`,
            description: `This 3-letter combination appears ${
              positions.length
            } times within words. Common trigraphs: ${commonTrigraphs.join(
              ", "
            )}.`,
            positions,
            confidence: positions.length >= 4 ? "high" : "medium",
            details: `Most frequent: THE, ING, AND, ION, ENT.`,
          });
        }
      }
    });

    // double letters - consecutive identical letters
    const doubleLetterCounts: Record<string, number[]> = {};
    for (let i = 0; i < cleanText.length - 1; i++) {
      if (cleanText[i] !== " " && cleanText[i] === cleanText[i + 1]) {
        const doubleLetter = cleanText[i] + cleanText[i + 1];
        if (!doubleLetterCounts[doubleLetter])
          doubleLetterCounts[doubleLetter] = [];
        doubleLetterCounts[doubleLetter].push(i);
      }
    }

    const getDoubleLetters = () =>
      cipherDocs.find((doc) => doc.title === "Double Letters")?.items || [];

    Object.entries(doubleLetterCounts).forEach(([doubleLetter, positions]) => {
      if (positions.length >= 3) {
        const commonDoubleLetters = getDoubleLetters().slice(0, 6);
        if (!areAllLettersFilled(doubleLetter)) {
          hints.push({
            type: "structure",
            title: `Double letters: ${doubleLetter}`,
            description: `This double letter appears ${
              positions.length
            } times. Common double letters: ${commonDoubleLetters.join(", ")}.`,
            positions,
            confidence: positions.length >= 4 ? "high" : "medium",
            details: `LL, SS, EE, TT, OO.`,
          });
        }
      }
    });

    // single letter words
    words.forEach((word, wordIndex) => {
      if (word.length === 1) {
        const wordStart = cleanText.indexOf(word);
        const examples = ["A", "I"];
        if (!areAllLettersFilled(word)) {
          hints.push({
            type: "structure",
            title: `Single letter word: ${word}`,
            description: `Single letter words are almost always 'A' or 'I' in English.`,
            positions: [wordStart],
            confidence: "high",
            details: `do this now!`,
          });
        }
      }
    });

    // double letter words
    words.forEach((word, wordIndex) => {
      if (word.length === 2) {
        const wordStart = cleanText.indexOf(word);
        const commonWords = getCommonWords();
        const examples = commonWords.twoLetter.slice(0, 6); // OF, TO, IN, IT, IS, BE
        if (!areAllLettersFilled(word)) {
          hints.push({
            type: "structure",
            title: `Double letter word: ${word}`,
            description: `Common 2-letter words: ${examples.join(", ")}.`,
            positions: [wordStart],
            confidence: "high",
            details: `do this now!`,
          });
        }
      }
    });

    // word endings (up to 4 letters)
    const commonEndings = getCommonEndings();
    const endingExamples = {
      ING: ["THING", "GOING", "BEING"],
      TION: ["NATION", "ACTION", "MOTION"],
      ABLE: ["TABLE", "ABLE", "CABLE"],
      MENT: ["MOMENT", "COMMENT"],
      LY: ["ONLY", "VERY", "REALLY"],
      ED: ["USED", "MOVED", "ASKED"],
      ER: ["NEVER", "OTHER", "WATER"],
      EST: ["BEST", "REST", "TEST"],
      ANT: ["WANT", "GIANT", "PLANT"],
      ENT: ["WENT", "SENT", "RENT"],
    };

    words.forEach((word) => {
      if (word.length >= 4) {
        for (let len = 2; len <= 4; len++) {
          const ending = word.slice(-len);
          const matchingEndings = commonEndings.filter((e) =>
            e.endsWith(ending.replace("-", ""))
          );

          if (matchingEndings.length > 0) {
            const endingKey = matchingEndings[0].replace("-", "");
            const examples =
              endingExamples[endingKey as keyof typeof endingExamples] || [];

            if (!areAllLettersFilled(word)) {
              const wordStart = cleanText.indexOf(word);
              hints.push({
                type: "structure",
                title: `Word ending: ${word}`,
                description: `Ends with "${ending}" - could be ${matchingEndings.join(
                  ", "
                )}. Examples: ${examples.join(", ")}.`,
                positions: [wordStart],
                confidence: len >= 3 ? "high" : "medium",
                details: ``,
              });
              break; // only suggest one ending per word
            }
          }
        }
      }
    });

    // repeated words
    const wordCounts = words.reduce((acc, word) => {
      if (word.length >= 3) {
        acc[word] = (acc[word] || 0) + 1;
      }
      return acc;
    }, {} as Record<string, number>);

    Object.entries(wordCounts).forEach(([word, count]) => {
      if (count >= 3) {
        const commonWords = getCommonWords();
        const examples =
          word.length === 2
            ? commonWords.twoLetter.slice(0, 4)
            : word.length === 3
            ? commonWords.threeLetter.slice(0, 4)
            : ["THE", "AND", "FOR", "ARE"];

        if (!areAllLettersFilled(word)) {
          hints.push({
            type: "frequency",
            title: `Repeated word: ${word}`,
            description: `This ${
              word.length
            }-letter word appears ${count} times. Common ${
              word.length
            }-letter words: ${examples.join(", ")}.`,
            positions: [cleanText.indexOf(word)],
            confidence: count >= 4 ? "high" : "medium",
            details: `click the ciphertext to see possible pattern matches`,
          });
        }
      }
    });

    // contractions
    const apostropheMatches = cleanText.match(/\w+'\w+/g);
    if (apostropheMatches) {
      apostropheMatches.forEach((match) => {
        const examples = ["CAN'T", "DON'T", "WON'T", "IT'S", "THAT'S"];
        if (!areAllLettersFilled(match)) {
          const position = cleanText.indexOf(match);
          hints.push({
            type: "apostrophe",
            title: `Contraction: ${match}`,
            description: `Contractions: ${examples.join(", ")}.`,
            positions: [position],
            confidence: "high",
            details: `common contractions: N'T, 'S, 'RE, 'VE, 'LL, 'D.`,
          });
        }
      });
    }

    return hints.sort((a, b) => {
      const confidenceOrder = { high: 3, medium: 2, low: 1 };
      const scoreA = confidenceOrder[a.confidence] + a.positions.length * 0.1;
      const scoreB = confidenceOrder[b.confidence] + b.positions.length * 0.1;
      return scoreB - scoreA;
    });
  }, [cipherText, substitutions]);

  useEffect(() => {
    setHintSuggestions(generateHints);
  }, [generateHints]);

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
    // set letterOrder if it is empty or all null (not loaded from localStorage)
    const isUnset =
      !letterOrder ||
      letterOrder.length === 0 ||
      letterOrder.every((l) => l === null);
    if (isUnset) {
      const uniqueLetters = Array.from(
        new Set(cipherText.replace(/\s/g, "").toUpperCase())
      );
      // pad end
      const uniqueLettersWithPadding = [
        ...uniqueLetters,
        ...Array(26 - uniqueLetters.length).fill(null),
      ];
      setLetterOrder(uniqueLettersWithPadding);
    }
  }, [cipherText]);

  // Memoize text lines calculation
  const textLines = useMemo(() => {
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
  }, [cipherText, charsPerLine]);

  useEffect(() => {
    if (isTimerRunning) {
      timerRef.current = setInterval(() => {
        setTimer((prev) => prev + 1);
      }, 1000);
    } else {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = undefined;
      }
    }

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = undefined;
      }
    };
  }, [isTimerRunning]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, "0")}:${secs
      .toString()
      .padStart(2, "0")}`;
  };

  const handleTableInput = (cipherLetter: string, value: string) => {
    if (value) {
      const newSubs = { ...substitutions };
      Object.entries(newSubs).forEach(([key, val]) => {
        if (val === value.toUpperCase()) {
          delete newSubs[key];
        }
      });

      newSubs[cipherLetter] = value.toUpperCase();
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
    if (freq === 0) return "bg-red-200 dark:bg-red-800";

    const sortedFrequencies = Object.values(frequencies).sort((a, b) => b - a);
    const medianIndex = Math.floor(sortedFrequencies.length / 2);
    const threshold = sortedFrequencies[medianIndex];

    return freq >= threshold
      ? "bg-green-200 dark:bg-green-800"
      : "bg-yellow-200 dark:bg-yellow-800";
  };

  const handleCaesarShift = (newShift: number) => {
    let shift = newShift;
    if (shift > 25) shift = 0;
    if (shift < 0) shift = 25;

    if (!isCaesarMode) {
      setCaesarShift(shift);
      setShowCaesarModal(true);
      return;
    }

    setCaesarShift(shift);
    const newSubs: Record<string, string> = {};
    letters.forEach((letter) => {
      if (letter) {
        const charCode = letter.charCodeAt(0);
        const shiftedCode = ((charCode - 65 + shift) % 26) + 65;
        newSubs[letter] = String.fromCharCode(shiftedCode);
      }
    });
    setSubstitutions(newSubs);
  };

  const handleConfirmCaesar = () => {
    setIsCaesarMode(true);
    setShowCaesarModal(false);
    const newSubs: Record<string, string> = {};
    letters.forEach((letter) => {
      if (letter) {
        const charCode = letter.charCodeAt(0);
        const shiftedCode = ((charCode - 65 + caesarShift) % 26) + 65;
        newSubs[letter] = String.fromCharCode(shiftedCode);
      }
    });
    setSubstitutions(newSubs);
  };

  const handleCancelCaesar = () => {
    setShowCaesarModal(false);
  };

  const fetchPatternWords = async (pattern: string) => {
    if (patternWords[pattern]) return; // cache moment

    setIsLoadingPatterns(true);
    try {
      const baseUrl = patternURL || process.env.NEXT_PUBLIC_PATTERN_URL;
      if (!baseUrl) {
        throw new Error("Pattern URL not configured");
      }
      const response = await fetch(`${baseUrl}/pattern/${pattern}`);
      if (!response.ok) throw new Error("Failed to fetch pattern words");
      const data = await response.json();

      // I should probably implement actual errors in the server at some point
      if (typeof data.message === "string") {
        throw new Error(data.message);
      }

      setPatternWords((prev) => ({ ...prev, [pattern]: data.message }));
    } catch (error) {
      console.error("Error fetching pattern words:", error);
      setPatternWords((prev) => ({ ...prev, [pattern]: [] })); // error = nothing
    } finally {
      setIsLoadingPatterns(false);
    }
  };

  const fetchPredictWords = async (partialWord: string) => {
    if (predictWords[partialWord]) return; // cache moment

    setIsLoadingPredictions(true);
    try {
      const baseUrl = patternURL || process.env.NEXT_PUBLIC_PATTERN_URL;
      if (!baseUrl) {
        throw new Error("Pattern URL not configured");
      }
      const response = await fetch(`${baseUrl}/predict/${partialWord}`);
      if (!response.ok) throw new Error("Failed to fetch predict words");
      const data = await response.json();

      // I should probably implement actual errors in the server at some point
      if (typeof data.message === "string") {
        throw new Error(data.message);
      }

      setPredictWords((prev) => ({ ...prev, [partialWord]: data.message }));
    } catch (error) {
      console.error("Error fetching predict words:", error);
      setPredictWords((prev) => ({ ...prev, [partialWord]: [] })); // error = nothing
    } finally {
      setIsLoadingPredictions(false);
    }
  };

  const convertToPartialWord = (word: string): string => {
    return Array.from(word)
      .map((char) => substitutions[char] || "_")
      .join("");
  };

  const hasLettersInPartialWord = (partialWord: string): boolean => {
    return /[A-Z]/.test(partialWord);
  };

  const getFilteredWords = (pattern: string, word: string): string[] => {
    if (!patternWords[pattern]) return [];

    // used letters
    const usedPlainLetters = new Set<string>();
    Object.entries(substitutions).forEach(([cipherChar, plainChar]) => {
      if (plainChar) {
        usedPlainLetters.add(plainChar);
      }
    });

    return patternWords[pattern].filter((possibleWord) => {
      for (let i = 0; i < word.length; i++) {
        const cipherChar = word[i];
        const plainChar = substitutions[cipherChar];

        // check for match
        if (plainChar && plainChar !== possibleWord[i]) {
          return false;
        }

        // if no substitution, check if the letter is already used elsewhere
        if (!plainChar && usedPlainLetters.has(possibleWord[i])) {
          return false;
        }
      }
      return true;
    });
  };

  const getFilteredPredictWords = (
    partialWord: string,
    word: string
  ): string[] => {
    if (!predictWords[partialWord]) return [];

    // used letters
    const usedPlainLetters = new Set<string>();
    Object.entries(substitutions).forEach(([cipherChar, plainChar]) => {
      if (plainChar) {
        usedPlainLetters.add(plainChar);
      }
    });

    return predictWords[partialWord].filter((possibleWord) => {
      for (let i = 0; i < word.length; i++) {
        const cipherChar = word[i];
        const plainChar = substitutions[cipherChar];

        // check for match
        if (plainChar && plainChar !== possibleWord[i]) {
          return false;
        }

        // if no substitution, check if the letter is already used elsewhere
        if (!plainChar && usedPlainLetters.has(possibleWord[i])) {
          return false;
        }
      }
      return true;
    });
  };

  // Debounced pattern fetch
  const debouncedFetchPattern = (pattern: string) => {
    if (patternFetchTimeoutRef.current) {
      clearTimeout(patternFetchTimeoutRef.current);
    }
    patternFetchTimeoutRef.current = setTimeout(() => {
      fetchPatternWords(pattern);
    }, 300);
  };

  const debouncedFetchPredict = (partialWord: string) => {
    if (predictFetchTimeoutRef.current) {
      clearTimeout(predictFetchTimeoutRef.current);
    }
    predictFetchTimeoutRef.current = setTimeout(() => {
      fetchPredictWords(partialWord);
    }, 300);
  };

  const handleReportWord = async (word: string, pattern: string) => {
    if (isReporting) return;
    setIsReporting(true);
    try {
      const response = await fetch("/api/report", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          word,
          pattern,
          cipherText,
          substitutions,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to report word");
      }

      // woohoo
      alert("Word reported successfully. Thank you for your feedback!");
    } catch (error) {
      console.error("Error reporting word:", error);
      alert("Failed to report word. Please try again later.");
    } finally {
      setIsReporting(false);
    }
  };

  return (
    <div className="flex gap-4">
      <div
        className="flex-1 bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6"
        ref={containerRef}
      >
        <div className="flex justify-between items-center mb-4">
          <div className="flex items-center gap-2 relative">
            <button
              onClick={() => setIsEditingCipherText(!isEditingCipherText)}
              className="flex items-center gap-2 text-gray-600 dark:text-gray-300 hover:text-gray-800 dark:hover:text-white transition"
            >
              <svg
                className={`w-3 h-3 transition-transform ${
                  isEditingCipherText ? "rotate-90" : ""
                }`}
                fill="currentColor"
                viewBox="0 0 20 20"
              >
                <path
                  fillRule="evenodd"
                  d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z"
                  clipRule="evenodd"
                />
              </svg>
              <span>Edit Cipher Text</span>
            </button>
            <button
              onClick={() => setShowDocsPanel(!showDocsPanel)}
              className="flex items-center gap-2 text-gray-600 dark:text-gray-300 hover:text-gray-800 dark:hover:text-white transition"
            >
              <svg
                className={`w-3 h-3 transition-transform ${
                  showDocsPanel ? "rotate-90" : ""
                }`}
                fill="currentColor"
                viewBox="0 0 20 20"
              >
                <path
                  fillRule="evenodd"
                  d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z"
                  clipRule="evenodd"
                />
              </svg>
              <span>Help & Tips</span>
            </button>
          </div>
          <div className="flex items-center gap-2">
            <div className="text-lg font-mono text-gray-800 dark:text-gray-200">
              {formatTime(timer)}
            </div>
            <button
              onClick={() => setIsTimerRunning(!isTimerRunning)}
              className={`px-3 py-1 rounded transition ${
                isTimerRunning
                  ? "bg-red-500 text-white hover:bg-red-600"
                  : "bg-green-500 text-white hover:bg-green-600"
              }`}
            >
              {isTimerRunning ? "Stop" : "Start"}
            </button>
            <button
              onClick={() => setTimer(0)}
              className="px-3 py-1 rounded bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200 hover:bg-gray-300 dark:hover:bg-gray-600 transition"
            >
              Reset
            </button>
          </div>
        </div>
        {isEditingCipherText && (
          <textarea
            id="ciphertext"
            value={cipherText}
            onChange={handleCipherTextChange}
            className="w-full p-2 border dark:border-gray-600 rounded font-mono mb-4 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
            rows={2}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
              }
            }}
          />
        )}

        <div className="font-mono space-y-1 mb-8">
          {textLines.map((line, lineIndex) => (
            <div key={lineIndex * 2} className="space-y-1">
              <div className="flex">
                <span className="w-20 flex-shrink-0 text-gray-600 dark:text-gray-400">
                  cipher:
                </span>
                <div className="flex tracking-wider text-lg">
                  {line.split(" ").map((word, wordIndex) => {
                    if (!/[A-Z]/.test(word)) {
                      return (
                        <span
                          key={wordIndex}
                          className="w-[1ch] text-center mx-[1px] font-mono"
                        >
                          {word === " " ? "\u00A0" : word}
                        </span>
                      );
                    }
                    const pattern = getWordPattern(word);
                    return (
                      <React.Fragment key={wordIndex}>
                        <div className="group relative inline-block">
                          {Array.from(word).map((char, charIndex) => (
                            <span
                              key={charIndex}
                              className="w-[1ch] text-center mx-[1px] font-mono group-hover:opacity-0"
                            >
                              {char}
                            </span>
                          ))}
                          <div
                            className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                            onMouseEnter={() => {
                              debouncedFetchPattern(pattern);

                              const partialWord = convertToPartialWord(word);
                              if (hasLettersInPartialWord(partialWord)) {
                                debouncedFetchPredict(partialWord);
                              }
                            }}
                            onClick={() => {
                              setCurrentWordPattern({
                                pattern,
                                word,
                              });
                              setShowWordModal(true);
                            }}
                          >
                            <div className="bg-white dark:bg-gray-700 px-1.5 py-0.5 rounded shadow-lg cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-600 text-xs text-gray-500 dark:text-gray-400">
                              {pattern}
                            </div>
                          </div>
                        </div>
                        {wordIndex < line.split(" ").length - 1 && (
                          <span className="w-[1ch] text-center mx-[1px] font-mono">
                            {" "}
                          </span>
                        )}
                      </React.Fragment>
                    );
                  })}
                </div>
              </div>
              <div className="flex">
                <span className="w-20 flex-shrink-0 text-gray-600 dark:text-gray-400">
                  plain:
                </span>
                <div className="flex tracking-wider text-lg">
                  {line.split(" ").map((word, wordIndex) => {
                    if (!/[A-Z]/.test(word)) {
                      return (
                        <span
                          key={wordIndex}
                          className="w-[1ch] text-center mx-[1px] font-mono"
                        >
                          {word === " " ? "\u00A0" : word}
                        </span>
                      );
                    }
                    return (
                      <React.Fragment key={wordIndex}>
                        <div className="inline-block">
                          {Array.from(word).map((char, charIndex) => (
                            <span
                              key={charIndex}
                              className={`w-[1ch] text-center mx-[1px] font-mono ${
                                /[A-Z]/.test(char)
                                  ? "bg-gray-50 dark:bg-gray-700"
                                  : ""
                              }`}
                            >
                              {/[A-Z]/.test(char)
                                ? substitutions[char] || "_"
                                : char}
                            </span>
                          ))}
                        </div>
                        {wordIndex < line.split(" ").length - 1 && (
                          <span className="w-[1ch] text-center mx-[1px] font-mono">
                            {" "}
                          </span>
                        )}
                      </React.Fragment>
                    );
                  })}
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* hint system */}
        <div className="mb-6 border-t pt-6">
          <div className="flex justify-between items-center mb-4">
            <div className="flex items-center gap-4">
              <div className="text-sm text-gray-600 dark:text-gray-400">
                Hints:
              </div>
            </div>
            <button
              onClick={() => setShowHintPanel(!showHintPanel)}
              className="flex items-center gap-2 text-gray-600 dark:text-gray-300 hover:text-gray-800 dark:hover:text-white transition"
            >
              <svg
                className={`w-3 h-3 transition-transform ${
                  showHintPanel ? "rotate-90" : ""
                }`}
                fill="currentColor"
                viewBox="0 0 20 20"
              >
                <path
                  fillRule="evenodd"
                  d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z"
                  clipRule="evenodd"
                />
              </svg>
              <span>Smart Hints</span>
              <span className="bg-blue-500 text-white text-xs px-2 py-1 rounded">
                {hintSuggestions.length}
              </span>
            </button>
          </div>

          {showHintPanel && (
            <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-4 mb-4">
              <div className="flex justify-between items-center mb-3">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                  Solving Hints
                </h3>
                <div className="flex items-center gap-2">
                  <label className="text-sm text-gray-600 dark:text-gray-400">
                    Show:
                  </label>
                  <select
                    value={maxHintsToShow}
                    onChange={(e) => setMaxHintsToShow(Number(e.target.value))}
                    className="px-2 py-1 border dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 text-sm"
                  >
                    <option value={3}>Top 3</option>
                    <option value={5}>Top 5</option>
                    <option value={10}>Top 10</option>
                    <option value={99}>All</option>
                  </select>
                </div>
              </div>

              <div className="space-y-3">
                {hintSuggestions.slice(0, maxHintsToShow).map((hint, index) => (
                  <div
                    key={index}
                    className={`p-3 rounded-lg border-l-4 ${
                      hint.confidence === "high"
                        ? "bg-green-50 dark:bg-green-900/20 border-green-500"
                        : hint.confidence === "medium"
                        ? "bg-yellow-50 dark:bg-yellow-900/20 border-yellow-500"
                        : "bg-gray-50 dark:bg-gray-800 border-gray-400"
                    }`}
                  >
                    <div className="flex items-start justify-between mb-2">
                      <h4 className="font-semibold text-gray-900 dark:text-gray-100">
                        {hint.title}
                      </h4>
                      <div className="flex items-center gap-2">
                        <span
                          className={`text-xs px-2 py-1 rounded ${
                            hint.confidence === "high"
                              ? "bg-green-100 text-green-800 dark:bg-green-800 dark:text-green-100"
                              : hint.confidence === "medium"
                              ? "bg-yellow-100 text-yellow-800 dark:bg-yellow-800 dark:text-yellow-100"
                              : "bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-100"
                          }`}
                        >
                          {hint.confidence}
                        </span>
                        <span className="text-xs px-2 py-1 rounded bg-blue-100 text-blue-800 dark:bg-blue-800 dark:text-blue-100">
                          {hint.type}
                        </span>
                      </div>
                    </div>
                    <p className="text-sm text-gray-700 dark:text-gray-300 mb-2">
                      {hint.description}
                    </p>
                    {hint.details && (
                      <p className="text-xs text-gray-500 dark:text-gray-400 italic">
                        {hint.details}
                      </p>
                    )}
                  </div>
                ))}
                {hintSuggestions.length === 0 && (
                  <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                    No hints available. Try entering a cipher text to get
                    started.
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        <div className="flex gap-4 mb-8">
          <button
            className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600 transition"
            onClick={() => setSubstitutions({})}
          >
            Reset
          </button>
          <button
            className="bg-yellow-500 text-white px-4 py-2 rounded hover:bg-yellow-600 transition"
            onClick={loadNextSample}
          >
            Load Sample
          </button>
        </div>

        <div className="flex justify-between items-center mb-2">
          <div className="text-sm text-gray-600 dark:text-gray-400">
            Substitution Table
          </div>
          <div className="flex gap-2">
            {isEditableSubHeader && (
              <button
                className="text-sm px-3 py-1 rounded bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 transition"
                onClick={resetLetterOrder}
              >
                Reset to ABC
              </button>
            )}
            <button
              className={`text-sm px-3 py-1 rounded transition ${
                isEditableSubHeader
                  ? "bg-indigo-100 dark:bg-indigo-900 text-indigo-700 dark:text-indigo-300 hover:bg-indigo-200 dark:hover:bg-indigo-800"
                  : "bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600"
              }`}
              onClick={() => setIsEditableSubHeader(!isEditableSubHeader)}
            >
              {isEditableSubHeader ? "Switch to K1" : "Switch to K2/K3"}
            </button>
            <button
              className={`text-sm px-3 py-1 rounded transition ${
                isCaesarMode
                  ? "bg-indigo-100 dark:bg-indigo-900 text-indigo-700 dark:text-indigo-300 hover:bg-indigo-200 dark:hover:bg-indigo-800"
                  : "bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600"
              }`}
              onClick={() => {
                if (!isCaesarMode) {
                  handleCaesarShift(0);
                } else {
                  setIsCaesarMode(false);
                }
              }}
            >
              Caesar
            </button>
            {isCaesarMode && (
              <div className="flex items-center gap-1">
                <button
                  className="text-sm px-2 py-1 rounded bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 transition"
                  onClick={() => handleCaesarShift(caesarShift - 1)}
                >
                  -
                </button>
                <input
                  type="number"
                  className="w-12 text-center border dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                  value={caesarShift}
                  onChange={(e) =>
                    handleCaesarShift(parseInt(e.target.value) || 0)
                  }
                  min="0"
                  max="25"
                />
                <button
                  className="text-sm px-2 py-1 rounded bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 transition"
                  onClick={() => handleCaesarShift(caesarShift + 1)}
                >
                  +
                </button>
              </div>
            )}
          </div>
        </div>

        <table
          className={`w-full text-center table-fixed ${
            isEditableSubHeader
              ? "border-indigo-200 dark:border-indigo-800 border-2 rounded"
              : ""
          }`}
        >
          <thead>
            <tr>
              {letterOrder.map((letter, index) => (
                <th
                  key={index}
                  className={`w-[3.85%] px-1 py-2 text-sm font-mono ${
                    isEditableSubHeader
                      ? "bg-indigo-50 dark:bg-indigo-900/50 hover:bg-indigo-100 dark:hover:bg-indigo-900 transition cursor-pointer"
                      : "bg-gray-100 dark:bg-gray-700"
                  }`}
                >
                  {isEditableSubHeader ? (
                    <input
                      type="text"
                      maxLength={1}
                      className="w-full text-center bg-transparent font-mono outline-none text-gray-900 dark:text-gray-100"
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
                  className={`px-1 py-2 text-sm font-mono border-b dark:border-gray-700 ${getFrequencyColor(
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
                    className="w-full h-8 text-center border dark:border-gray-600 rounded font-mono bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
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
        <details className="mt-4">
          <summary className="cursor-pointer text-sm text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 transition flex items-center gap-2">
            <svg
              className="w-3 h-3 transition-transform details-arrow"
              fill="currentColor"
              viewBox="0 0 20 20"
            >
              <path
                fillRule="evenodd"
                d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z"
                clipRule="evenodd"
              />
            </svg>
            <span>Letter Frequency Chart</span>
          </summary>
          <div className="mt-3 bg-gray-50 dark:bg-gray-900 rounded-lg p-4">
            <div ref={chartRef} className="ct-chart"></div>
          </div>
        </details>
        {showCaesarModal && (
          <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-30 z-50">
            <div className="bg-white dark:bg-gray-800 p-6 rounded shadow-lg max-w-sm w-full">
              <div className="mb-4 text-lg font-semibold text-gray-900 dark:text-gray-100">
                Overwrite Substitutions?
              </div>
              <div className="mb-6 text-gray-700 dark:text-gray-300">
                Applying the Caesar shift will overwrite your current
                substitutions. Are you sure you want to continue?
              </div>
              <div className="flex justify-end gap-2">
                <button
                  className="px-4 py-2 rounded bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200 hover:bg-gray-300 dark:hover:bg-gray-600"
                  onClick={handleCancelCaesar}
                >
                  Cancel
                </button>
                <button
                  className="px-4 py-2 rounded bg-blue-500 text-white hover:bg-blue-600"
                  onClick={handleConfirmCaesar}
                >
                  Overwrite
                </button>
              </div>
            </div>
          </div>
        )}

        {showWordModal && currentWordPattern && (
          <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-30 z-50">
            <div className="bg-white dark:bg-gray-800 p-6 rounded shadow-lg max-w-2xl w-full max-h-[80vh] flex flex-col">
              <div className="flex justify-between items-center mb-4">
                <div className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                  Word Options for Pattern: {currentWordPattern.pattern}
                </div>
                <button
                  onClick={() => setShowWordModal(false)}
                  className="text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
                >
                  ✕
                </button>
              </div>

              <div className="flex gap-4 mb-4">
                <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
                  <input
                    type="checkbox"
                    checked={showPatternWords}
                    onChange={(e) => setShowPatternWords(e.target.checked)}
                    className="rounded"
                  />
                  Pattern matches (
                  {
                    getFilteredWords(
                      currentWordPattern.pattern,
                      currentWordPattern.word
                    ).length
                  }
                  )
                </label>
                <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
                  <input
                    type="checkbox"
                    checked={showPredictWords}
                    onChange={(e) => setShowPredictWords(e.target.checked)}
                    className="rounded"
                  />
                  Partial matches (
                  {
                    getFilteredPredictWords(
                      convertToPartialWord(currentWordPattern.word),
                      currentWordPattern.word
                    ).length
                  }
                  )
                </label>
              </div>

              <div className="overflow-y-auto flex-1">
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
                  {showPatternWords &&
                    getFilteredWords(
                      currentWordPattern.pattern,
                      currentWordPattern.word
                    ).map((word, idx) => (
                      <div
                        key={`pattern-${idx}`}
                        className="p-2 bg-blue-50 dark:bg-blue-900/20 rounded hover:bg-blue-100 dark:hover:bg-blue-900/30 group relative border border-blue-200 dark:border-blue-800"
                      >
                        <div className="flex justify-between items-center">
                          <span className="text-gray-900 dark:text-gray-100">
                            {word}
                          </span>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleReportWord(
                                word,
                                currentWordPattern.pattern
                              );
                            }}
                            className="text-gray-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
                            title="Report this word"
                          >
                            ⚠️
                          </button>
                        </div>
                      </div>
                    ))}
                  {showPredictWords &&
                    getFilteredPredictWords(
                      convertToPartialWord(currentWordPattern.word),
                      currentWordPattern.word
                    ).map((word, idx) => (
                      <div
                        key={`predict-${idx}`}
                        className="p-2 bg-green-50 dark:bg-green-900/20 rounded hover:bg-green-100 dark:hover:bg-green-900/30 group relative border border-green-200 dark:border-green-800"
                      >
                        <div className="flex justify-between items-center">
                          <span className="text-gray-900 dark:text-gray-100">
                            {word}
                          </span>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleReportWord(
                                word,
                                currentWordPattern.pattern
                              );
                            }}
                            className="text-gray-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
                            title="Report this word"
                          >
                            ⚠️
                          </button>
                        </div>
                      </div>
                    ))}
                </div>

                {!showPatternWords && !showPredictWords && (
                  <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                    Select at least one option to see word suggestions.
                  </div>
                )}

                {(showPatternWords || showPredictWords) &&
                  getFilteredWords(
                    currentWordPattern.pattern,
                    currentWordPattern.word
                  ).length === 0 &&
                  getFilteredPredictWords(
                    convertToPartialWord(currentWordPattern.word),
                    currentWordPattern.word
                  ).length === 0 && (
                    <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                      {isLoadingPatterns || isLoadingPredictions
                        ? "Loading..."
                        : "No matching words found."}
                    </div>
                  )}
              </div>
            </div>
          </div>
        )}
      </div>
      <CipherDocsPanel isVisible={showDocsPanel} />
    </div>
  );
}
