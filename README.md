# Ciphered

A modern web application providing interactive tools for solving cryptograms. Built with Astro, React, and TailwindCSS.

![Built by @sadeshmukh](https://img.shields.io/badge/built%20with%20%E2%9D%A4%EF%B8%8F%20by-@sadeshmukh-blue)

Try the demo [here](https://ciphered.sahil.ink)!

## What does it do?

- Aristocrats
  A suite of nice-to-have tools for solving monoalphabetic substitution ciphers.

  - Frequency analysis
  - Pattern matching (see ciphered-pattern-api) at https://github.com/sadeshmukh/ciphered-pattern-api
  - Caesar cipher mode
  - Smart hints

  ![Aristocrat Solver](https://raw.githubusercontent.com/sadeshmukh/ciphered/main/public/demo/aristocrat.png)

  ![Aristocrat Pattern Matching](https://raw.githubusercontent.com/sadeshmukh/ciphered/main/public/demo/aristocrat2.png)

- Columnar Transposition
  A simple tool for solving columnar transposition ciphers.

  - Automatic dimension analysis
  - Highlights to quickly search for given patterns

  ![Columnar Transposition](https://raw.githubusercontent.com/sadeshmukh/ciphered/main/public/demo/columnar1.png)

  ![Columnar Transposition Highlights](https://raw.githubusercontent.com/sadeshmukh/ciphered/main/public/demo/columnar2.png)

- Fractionated Morse
  A tool for solving fractionated Morse ciphers.

  - Interactive Morse code triplet mapping
  - Real-time decoding

  ![Fractionated Morse](https://raw.githubusercontent.com/sadeshmukh/ciphered/main/public/demo/fractionated.png)

## Development

### Prerequisites

- Node.js (v20 or later recommended)
- npm

### Installation

1. Clone the repository:

```bash
git clone https://github.com/sadeshmukh/ciphered.git
cd ciphered
```

2. Install dependencies:

```bash
npm install
```

3. Start the development server:

```bash
npm run dev
```

4. Build for production:

```bash
npm run build
```

5. Serve build:

```bash
node dist/server/entry.mjs
```

## Tech Stack

- [Astro](https://astro.build/) - Web framework
- [React](https://reactjs.org/) - UI components
- [TailwindCSS](https://tailwindcss.com/) - Styling
- [@dnd-kit](https://dndkit.com/) - Drag and drop functionality
- [chartist](https://gionkunz.github.io/chartist-js/) - Charting

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.
