export interface SolverCandidate {
  columnOrder: number[];
  decryptedText: string;
  score: number;
  dimensions: [number, number];
  scores: {
    bigrams: number;
    trigrams: number;
    doubleLetters: number;
  };
  potentialFinalText?: string;
}

const COMMON_BIGRAMS = [
  "TH",
  "HE",
  "AN",
  "IN",
  "ER",
  "RE",
  "ON",
  "AT",
  "ES",
  "OR",
  "TE",
  "OF",
  "ED",
  "IS",
  "IT",
  "AL",
  "AR",
  "ST",
  "TO",
  "NT",
];
const COMMON_TRIGRAMS = [
  "THE",
  "AND",
  "ING",
  "ENT",
  "ION",
  "FOR",
  "NDE",
  "HAS",
  "NCE",
  "EDT",
  "TIS",
  "OFT",
  "STH",
  "MEN",
];
const DOUBLE_LETTERS = [
  "LL",
  "SS",
  "EE",
  "TT",
  "OO",
  "MM",
  "FF",
  "PP",
  "DD",
  "GG",
  "CC",
  "RR",
];

function calculateBigramScore(text: string): number {
  let score = 0;
  for (let i = 0; i < text.length - 1; i++) {
    const bigram = text.slice(i, i + 2);
    if (COMMON_BIGRAMS.includes(bigram)) {
      score += 1;
    }
  }
  return score;
}

function calculateTrigramScore(text: string): number {
  let score = 0;
  for (let i = 0; i < text.length - 2; i++) {
    const trigram = text.slice(i, i + 3);
    if (COMMON_TRIGRAMS.includes(trigram)) {
      score += 2;
    }
  }
  return score;
}

function calculateDoubleLetterScore(text: string): number {
  let score = 0;
  for (const doubleLetter of DOUBLE_LETTERS) {
    const count = (text.match(new RegExp(doubleLetter, "g")) || []).length;
    score += count;
  }
  return score;
}

export function scoreDecryption(text: string): SolverCandidate["scores"] {
  return {
    bigrams: calculateBigramScore(text),
    trigrams: calculateTrigramScore(text),
    doubleLetters: calculateDoubleLetterScore(text),
  };
}

function generatePermutations(arr: number[]): number[][] {
  if (arr.length <= 1) return [arr];

  const result: number[][] = [];
  for (let i = 0; i < arr.length; i++) {
    const rest = [...arr.slice(0, i), ...arr.slice(i + 1)];
    const perms = generatePermutations(rest);
    for (const perm of perms) {
      result.push([arr[i], ...perm]);
    }
  }
  return result;
}

// Simple search for column permutations
function generateCandidateOrders(
  columns: number,
  maxCandidates: number = 100
): number[][] {
  if (columns <= 7) {
    // for small grids, try all permutations
    return generatePermutations(Array.from({ length: columns }, (_, i) => i));
  }

  // for larger grids, generate random permutations
  const candidates: number[][] = [];
  const baseOrder = Array.from({ length: columns }, (_, i) => i);

  // always include identity permutation
  candidates.push([...baseOrder]);

  // generate random permutations
  for (let i = 1; i < maxCandidates; i++) {
    const order = [...baseOrder];
    // Fisher-Yates shuffle
    for (let j = order.length - 1; j > 0; j--) {
      const k = Math.floor(Math.random() * (j + 1));
      [order[j], order[k]] = [order[k], order[j]];
    }
    candidates.push(order);
  }

  return candidates;
}

// main solver function
export async function solveColumnarCipher(
  cipherText: string,
  dimensions: [number, number],
  onProgress?: (progress: number) => void
): Promise<SolverCandidate[]> {
  const [rows, cols] = dimensions;

  // function to decrypt text with given column order
  const decryptWithOrder = (columnOrder: number[]): string => {
    const data: string[][] = Array(rows)
      .fill(null)
      .map(() => Array(cols).fill(""));

    // fill grid vertically (cipher text order)
    let charIndex = 0;
    for (let col = 0; col < cols; col++) {
      for (let row = 0; row < rows; row++) {
        if (charIndex < cipherText.length) {
          data[row][col] = cipherText[charIndex];
          charIndex++;
        }
      }
    }

    // read horizontally with reordered columns
    const reorderedData = data.map((row) =>
      columnOrder.map((colIndex) => row[colIndex])
    );

    return reorderedData.map((row) => row.join("")).join("");
  };

  const candidateOrders = generateCandidateOrders(cols);

  // score all candidates
  const candidates: SolverCandidate[] = [];

  for (let i = 0; i < candidateOrders.length; i++) {
    const columnOrder = candidateOrders[i];
    const decryptedText = decryptWithOrder(columnOrder);
    const scores = scoreDecryption(decryptedText);

    // arbitrarily weighted combination of scores
    const totalScore =
      scores.bigrams * 0.4 + scores.trigrams * 0.5 + scores.doubleLetters * 0.1;

    candidates.push({
      columnOrder,
      decryptedText,
      score: totalScore,
      dimensions,
      scores,
    });

    if (onProgress) {
      onProgress((i + 1) / candidateOrders.length);
    }
  }

  // sort by score and return top results
  candidates.sort((a, b) => b.score - a.score);
  return candidates.slice(0, 10); // top 10 candidates
}

export async function solveColumnarCipherAllDimensions(
  cipherText: string,
  onProgress?: (progress: number, currentDimension: [number, number]) => void
): Promise<SolverCandidate[]> {
  if (!cipherText) return [];

  const length = cipherText.length;
  const possibleDimensions: [number, number][] = [];

  for (let i = 2; i <= length - 1; i++) {
    if (length % i === 0) {
      possibleDimensions.push([i, length / i]);
    }
  }

  if (possibleDimensions.length === 0) return [];

  let allCandidates: SolverCandidate[] = [];

  for (let i = 0; i < possibleDimensions.length; i++) {
    const dimension = possibleDimensions[i];

    if (onProgress) {
      onProgress(i / possibleDimensions.length, dimension);
    }

    const candidates = await solveColumnarCipher(cipherText, dimension);
    allCandidates.push(...candidates);
  }

  allCandidates.sort((a, b) => b.score - a.score);

  if (allCandidates.length === 0) return [];

  console.log("Score distribution:", {
    total: allCandidates.length,
    topScore: allCandidates[0]?.score,
    top5Scores: allCandidates.slice(0, 5).map((c) => c.score),
    worstScore: allCandidates[allCandidates.length - 1]?.score,
  });

  const topScore = allCandidates[0].score;
  let finalCandidates: SolverCandidate[];

  if (topScore > -20) {
    const threshold = topScore - 10;
    const filteredCandidates = allCandidates.filter(
      (candidate) => candidate.score >= threshold
    );
    finalCandidates = filteredCandidates.slice(0, 15);
  } else {
    // all the scores are bs anyway, just show the top candidates for user to evaluate
    finalCandidates = allCandidates.slice(0, 10);
  }

  // evaluate ONLY the top 3 final candidates with AI to minimize API calls
  const topFinalCandidates = finalCandidates.slice(0, 3);
  const evaluatedCandidates = await Promise.all(
    topFinalCandidates.map(async (candidate) => {
      const aiEvaluation = await evaluateWithAI(candidate.decryptedText);
      return {
        ...candidate,
        potentialFinalText:
          aiEvaluation.spacedText !== candidate.decryptedText
            ? aiEvaluation.spacedText
            : undefined,
      };
    })
  );

  return [...evaluatedCandidates, ...finalCandidates.slice(3)];
}

// to validate AI output
function calculateCharacterSimilarity(text1: string, text2: string): number {
  // remove punctuation and spaces
  const clean1 = text1.replace(/[\s\W]/g, "").toUpperCase();
  const clean2 = text2.replace(/[\s\W]/g, "").toUpperCase();

  if (clean1.length === 0 && clean2.length === 0) return 1;
  if (clean1.length === 0 || clean2.length === 0) return 0;

  let matches = 0;
  const minLength = Math.min(clean1.length, clean2.length);

  for (let i = 0; i < minLength; i++) {
    if (clean1[i] === clean2[i]) {
      matches++;
    }
  }
  return matches / Math.max(clean1.length, clean2.length);
}

async function evaluateWithAI(decryptedText: string): Promise<{
  spacedText: string;
}> {
  const PUBLIC_COMPLETIONS_API =
    import.meta.env.PUBLIC_COMPLETIONS_API ||
    "https://ciphered.api.sahil.ink/completions";

  if (!PUBLIC_COMPLETIONS_API) {
    console.warn("PUBLIC_COMPLETIONS_API not found, skipping AI evaluation");
    return { spacedText: decryptedText };
  }

  // use a hash for long texts to avoid localStorage key issues
  const cacheKey =
    decryptedText.length > 100
      ? `ai_eval_hash_${btoa(decryptedText).substring(0, 50)}`
      : `ai_eval_${decryptedText}`;
  const cached = localStorage.getItem(cacheKey);

  if (cached) {
    try {
      const cachedResult = JSON.parse(cached);
      const cacheAge = Date.now() - cachedResult.timestamp;

      if (cacheAge < 24 * 60 * 60 * 1000) {
        return {
          spacedText: cachedResult.spacedText,
        };
      }
    } catch (e) {
      // invalid cache entry, will be overwritten
    }
  }

  const cacheAndReturn = (result: { spacedText: string }) => {
    try {
      const cacheData = {
        ...result,
        timestamp: Date.now(),
      };
      localStorage.setItem(cacheKey, JSON.stringify(cacheData));
    } catch (e) {
      console.warn("Failed to cache AI evaluation result:", e);
    }
    return result;
  };

  try {
    const response = await fetch(PUBLIC_COMPLETIONS_API, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messages: [
          {
            role: "user",
            content: `You are helping evaluate a decrypted columnar cipher. 

The decrypted text is: "${decryptedText}"

Please analyze this text and respond with a JSON object containing:
1. "spacedText": string - if valid, provide the same text but with proper spacing and punctuation added. If not valid, return the original text.

Only respond with the JSON object, no other text.`,
          },
        ],
        max_tokens: 500,
        temperature: 0.1,
      }),
    });

    if (!response.ok) {
      throw new Error(`AI API request failed: ${response.status}`);
    }

    const data = await response.json();
    const aiResponse =
      data.choices?.[0]?.message?.content ||
      data.completion ||
      data.response ||
      data.text ||
      "";

    try {
      const jsonMatch = aiResponse.match(/\{[\s\S]*?\}/);
      if (jsonMatch) {
        const jsonStr = jsonMatch[0];
        const cleanedJson = jsonStr
          .replace(/'/g, '"') // ' -> "
          .replace(/([{,]\s*)([a-zA-Z_][a-zA-Z0-9_]*)\s*:/g, '$1"$2":') // quote the keys
          .replace(/:\s*([^",{\[\]}\s][^",}\[\]]*)\s*([,}])/g, ': "$1"$2'); // quote the string values

        const parsed = JSON.parse(cleanedJson);
        const aiSuggestedText =
          parsed.spacedText ||
          parsed.spaced_text ||
          parsed.text ||
          decryptedText;

        const similarity = calculateCharacterSimilarity(
          decryptedText,
          aiSuggestedText
        );
        const useAiText = similarity >= 0.9;

        return cacheAndReturn({
          spacedText: useAiText ? aiSuggestedText : decryptedText,
        });
      }

      const parsed = JSON.parse(aiResponse);
      const aiSuggestedText =
        parsed.spacedText || parsed.spaced_text || parsed.text || decryptedText;

      const similarity = calculateCharacterSimilarity(
        decryptedText,
        aiSuggestedText
      );
      const useAiText = similarity >= 0.9;

      return cacheAndReturn({
        spacedText: useAiText ? aiSuggestedText : decryptedText,
      });
    } catch (parseError) {
      console.warn("JSON parsing failed:", parseError, "Response:", aiResponse);

      return cacheAndReturn({
        spacedText: decryptedText,
      });
    }
  } catch (error) {
    console.error("AI evaluation failed:", error);
    return { spacedText: decryptedText };
  }
}
