interface AristocratPuzzle {
  cipherText: string;
  solution: Record<string, string>;
  plainText?: string;
  description?: string;
}

// as of now plaintext is unused

export const samplePuzzles: AristocratPuzzle[] = [
  {
    cipherText: "MXGGB YBKGW LMZD ZD N DNJFGX FQEEGX",
    solution: {
      M: "H",
      X: "E",
      G: "L",
      B: "O",
      Y: "W",
      K: "R",
      W: "D",
      L: "T",
      Z: "I",
      D: "S",
      N: "A",
      J: "M",
      F: "P",
      Q: "U",
      E: "Z",
    },
    plainText: "HELLO WORLD THIS IS A SAMPLE PUZZLE",
    description: "A simple example puzzle",
  },
  {
    cipherText: "LMX HQZST YKBVP UBR CQJFD BIXK LMX GNEA WBO",
    solution: {
      L: "T",
      M: "H",
      X: "E",
      H: "Q",
      Q: "U",
      Z: "I",
      S: "C",
      T: "K",
      Y: "B",
      K: "R",
      B: "O",
      V: "W",
      P: "N",
      U: "F",
      R: "X",
      C: "J",
      J: "M",
      F: "P",
      D: "S",
      I: "V",
      G: "L",
      N: "A",
      E: "Z",
      A: "Y",
      W: "D",
      O: "G",
    },
    plainText: "THE QUICK BROWN FOX JUMPS OVER THE LAZY DOG",
    description: "Classic pangram",
  },
];
