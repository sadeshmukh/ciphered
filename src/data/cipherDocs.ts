export interface DocSection {
  title: string;
  items?: string[];
  subsections?: Array<{
    title: string;
    items: string[];
  }>;
}

export const cipherDocs: DocSection[] = [
  {
    title: "Letter Frequencies",
    items: [
      "E (12.7%)",
      "T (9.1%)",
      "A (8.2%)",
      "O (7.5%)",
      "I (7.0%)",
      "N (6.7%)",
      "S (6.3%)",
      "R (6.0%)",
    ],
  },
  {
    title: "Common Digraphs",
    items: [
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
    ],
  },
  {
    title: "Common Trigraphs",
    items: [
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
    ],
  },
  {
    title: "Common Words",
    subsections: [
      {
        title: "2 letters",
        items: [
          "OF",
          "TO",
          "IN",
          "IT",
          "IS",
          "BE",
          "AS",
          "AT",
          "SO",
          "WE",
          "HE",
          "BY",
        ],
      },
      {
        title: "3 letters",
        items: [
          "THE",
          "AND",
          "FOR",
          "ARE",
          "BUT",
          "NOT",
          "YOU",
          "ALL",
          "ANY",
          "CAN",
          "HAD",
          "HER",
        ],
      },
    ],
  },
  {
    title: "Common Endings",
    items: [
      "-ING",
      "-ED",
      "-ER",
      "-ES",
      "-LY",
      "-ION",
      "-ENT",
      "-ANT",
      "-IVE",
      "-OUS",
      "-ABLE",
      "-MENT",
    ],
  },
  {
    title: "Double Letters",
    items: [
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
    ],
  },
];
