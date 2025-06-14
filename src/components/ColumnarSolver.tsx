import { useState, useEffect, useMemo, useRef } from "react";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import type { DragEndEvent, DragStartEvent } from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  horizontalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useLocalStorage } from "../data/utils";
import {
  solveColumnarCipherAllDimensions,
  type SolverCandidate,
} from "../utils/columnarSolverLogic";

interface Props {
  cipherText?: string;
}

type HighlightFn = (
  row: number,
  col: number,
  content: string,
  data: string[][]
) => string | null;

type ColumnarState = {
  dimensions: [number, number];
  columnOrder: number[];
};

function TableCell({
  children,
  className,
  highlightClass,
  isDragging,
  transform,
}: {
  children: React.ReactNode;
  className?: string;
  highlightClass?: string;
  isDragging?: boolean;
  transform?: string;
}) {
  return (
    <td
      className={`px-1 py-2 text-sm font-mono border dark:border-gray-700 text-gray-900 dark:text-gray-100 ${
        highlightClass || ""
      } ${className || ""}`}
      style={{
        opacity: isDragging ? 0.5 : 1,
        transform: transform || undefined,
      }}
    >
      {children}
    </td>
  );
}

function SortableHeader({
  id,
  onDragTransformChange,
}: {
  id: number;
  onDragTransformChange?: (id: number, transform: string | undefined) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } =
    useSortable({ id });

  useEffect(() => {
    const transformString = transform
      ? CSS.Transform.toString(transform)
      : undefined;
    onDragTransformChange?.(id, transformString);
  }, [transform, id, onDragTransformChange]);

  const style = {
    transform: CSS.Transform.toString(transform),
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <th
      ref={setNodeRef}
      style={style}
      className="px-1 py-2 border-b dark:border-gray-700"
    >
      <div className="flex flex-col items-center gap-1">
        <div className="text-xs text-gray-500 dark:text-gray-400">{id + 1}</div>
        <div
          {...attributes}
          {...listeners}
          className="flex justify-center items-center cursor-move"
        >
          <div className="flex gap-1">
            <div className="w-1 h-1 rounded-full bg-gray-400 dark:bg-gray-500"></div>
            <div className="w-1 h-1 rounded-full bg-gray-400 dark:bg-gray-500"></div>
            <div className="w-1 h-1 rounded-full bg-gray-400 dark:bg-gray-500"></div>
          </div>
        </div>
      </div>
    </th>
  );
}

export default function ColumnarSolver({
  cipherText: initialCipherText = "",
}: Props) {
  // just moved up here instead of dealing with the whole css mess
  const TEXT_MUTED = "text-gray-600 dark:text-gray-400";
  const TEXT_SMALL_MUTED = "text-sm text-gray-600 dark:text-gray-400";
  const INPUT_CLASSES =
    "border dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100";
  const BUTTON_DISABLED =
    "bg-gray-100 dark:bg-gray-700 text-gray-400 dark:text-gray-500 cursor-not-allowed";
  const BUTTON_ENABLED =
    "bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200 hover:bg-gray-300 dark:hover:bg-gray-600";

  const [state, setState] = useState<ColumnarState>({
    dimensions: [0, 0],
    columnOrder: [],
  });
  const [cipherText, setCipherText] = useLocalStorage(
    "columnarCipherText",
    initialCipherText
  );
  const [isEditingCipherText, setIsEditingCipherText] = useState(false);
  const [wordInput, setWordInput] = useState("");
  const [hoveredCharIndex, setHoveredCharIndex] = useState<number | null>(null);
  const [isBoxHovered, setIsBoxHovered] = useState(false);
  const [draggingColumnId, setDraggingColumnId] = useState<number | null>(null);
  const [columnTransforms, setColumnTransforms] = useState<
    Record<number, string | undefined>
  >({});

  // Solver state
  const [solverResults, setSolverResults] = useState<SolverCandidate[]>([]);
  const [isSolving, setIsSolving] = useState(false);
  const [showSolverResults, setShowSolverResults] = useState(false);
  const [currentSolvingDimension, setCurrentSolvingDimension] = useState<
    [number, number] | null
  >(null);

  // Track when we're applying a solver result to prevent useEffect from overriding
  const isApplyingSolverResult = useRef(false);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  // I did not realize just how useful memo is
  const possibleDimensions = useMemo(() => {
    if (!cipherText) return [];
    const length = cipherText.length;
    const dimensions: [number, number][] = [];

    for (let i = 2; i <= length - 1; i++) {
      if (length % i === 0) {
        dimensions.push([i, length / i]);
      }
    }

    return dimensions;
  }, [cipherText]);

  const currentDimensionIndex = useMemo(() => {
    if (state.dimensions[0] === 0 || state.dimensions[1] === 0) {
      return -1;
    }
    return possibleDimensions.findIndex(
      ([r, c]) => r === state.dimensions[0] && c === state.dimensions[1]
    );
  }, [state.dimensions, possibleDimensions]);

  // reset column order when dimensions change (but only if needed and not applying solver result)
  useEffect(() => {
    if (
      !isApplyingSolverResult.current &&
      state.dimensions[1] > 0 &&
      state.columnOrder.length !== state.dimensions[1]
    ) {
      setState((prev) => ({
        ...prev,
        columnOrder: Array.from({ length: state.dimensions[1] }, (_, i) => i),
      }));
    }
    // Reset the flag after the effect runs
    isApplyingSolverResult.current = false;
  }, [state.dimensions]);

  // create table data based on dimensions
  const tableData = useMemo(() => {
    if (!cipherText || state.dimensions[0] === 0 || state.dimensions[1] === 0)
      return [];

    const [rows, cols] = state.dimensions;
    const data: string[][] = Array(rows)
      .fill(null)
      .map(() => Array(cols).fill(""));

    // vertical fill
    let charIndex = 0;
    for (let col = 0; col < cols; col++) {
      for (let row = 0; row < rows; row++) {
        if (charIndex < cipherText.length) {
          data[row][col] = cipherText[charIndex];
          charIndex++;
        }
      }
    }

    return data;
  }, [cipherText, state.dimensions]);

  const navigateDimensions = (direction: "prev" | "next") => {
    if (possibleDimensions.length === 0) return;

    let newIndex = currentDimensionIndex;
    if (direction === "next") {
      newIndex = (currentDimensionIndex + 1) % possibleDimensions.length;
    } else {
      newIndex =
        (currentDimensionIndex - 1 + possibleDimensions.length) %
        possibleDimensions.length;
    }

    setState((prev) => ({
      ...prev,
      dimensions: possibleDimensions[newIndex],
    }));
  };

  const handleCipherTextChange = (
    e: React.ChangeEvent<HTMLTextAreaElement>
  ) => {
    const newText = e.target.value.replace(/[\n\r]/g, "").toUpperCase();
    setCipherText(newText);
  };

  const handleDimensionChange = (index: 0 | 1, value: string) => {
    const num = parseInt(value) || 0;
    const newDimensions: [number, number] = [...state.dimensions];
    newDimensions[index] = num;

    if (num > 0 && cipherText.length > 0) {
      const otherIndex = index === 0 ? 1 : 0;
      const otherValue = Math.floor(cipherText.length / num);
      if (otherValue * num === cipherText.length) {
        newDimensions[otherIndex] = otherValue;
      }
    }

    setState((prev) => ({ ...prev, dimensions: newDimensions }));
  };

  const handleDragStart = (event: DragStartEvent) => {
    setDraggingColumnId(Number(event.active.id));
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    setDraggingColumnId(null);
    setColumnTransforms({});

    if (over && active.id !== over.id) {
      setState((prev) => {
        const oldIndex = prev.columnOrder.indexOf(Number(active.id));
        const newIndex = prev.columnOrder.indexOf(Number(over.id));
        return {
          ...prev,
          columnOrder: arrayMove(prev.columnOrder, oldIndex, newIndex),
        };
      });
    }
  };

  const reorderedTableData = useMemo(() => {
    if (!tableData.length || !state.columnOrder.length) return tableData;

    return tableData.map((row) =>
      state.columnOrder.map((colIndex) => row[colIndex])
    );
  }, [tableData, state.columnOrder]);

  // helper highlight function
  const getCharHighlightClass = (char: string): string => {
    if (hoveredCharIndex !== null && char === wordInput[hoveredCharIndex]) {
      return "bg-blue-500 dark:bg-blue-500";
    } else if (isBoxHovered && wordInput.includes(char)) {
      return "bg-green-500 dark:bg-green-500";
    }
    return "";
  };

  const transposedText = useMemo(() => {
    if (!reorderedTableData.length) return "";

    return reorderedTableData.map((row) => row.join("")).join("");
  }, [reorderedTableData]);

  const runAutomaticSolver = async () => {
    if (!cipherText) {
      return;
    }

    setIsSolving(true);
    setSolverResults([]);
    setShowSolverResults(true);
    setCurrentSolvingDimension(null);

    try {
      const results = await solveColumnarCipherAllDimensions(
        cipherText,
        (progress, dimension) => {
          setCurrentSolvingDimension(dimension);
        }
      );
      setSolverResults(results);
    } catch (error) {
      console.error("Error running solver:", error);
    } finally {
      setIsSolving(false);
      setCurrentSolvingDimension(null);
    }
  };

  const applySolverResult = (candidate: SolverCandidate) => {
    isApplyingSolverResult.current = true;
    setState((prev) => ({
      ...prev,
      dimensions: candidate.dimensions,
      columnOrder: candidate.columnOrder,
    }));
    setShowSolverResults(false);
  };

  const highlightBottomRowX: HighlightFn = (row, col, content, data) => {
    if (row === data.length - 1 && content === "X") {
      return "bg-red-500 dark:bg-red-500";
    }
    return null;
  };

  const highlightChar = (
    row: number,
    col: number,
    content: string,
    data: string[][]
  ) => {
    const highlight = getCharHighlightClass(content);
    return highlight || null;
  };

  const highlightFunctions: HighlightFn[] = [
    highlightBottomRowX,
    highlightChar,
  ];

  // get the first non-null highlight
  const getCellHighlightClass = (
    rowIndex: number,
    colIndex: number,
    content: string
  ): string | undefined => {
    for (const highlightFn of highlightFunctions) {
      const result = highlightFn(
        rowIndex,
        colIndex,
        content,
        reorderedTableData
      );
      if (result) return result;
    }
    return undefined;
  };

  return (
    <div
      className="flex gap-4"
      role="region"
      aria-label="Columnar Cipher Solver"
    >
      <div className="flex-1 bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
        <div className="flex justify-between items-center mb-4">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsEditingCipherText(!isEditingCipherText)}
              className="flex items-center gap-2 text-gray-600 dark:text-gray-300 hover:text-gray-800 dark:hover:text-white transition"
              aria-expanded={isEditingCipherText}
              aria-controls="cipher-text-input"
            >
              <span>{isEditingCipherText ? "▼" : "▶"} Edit Cipher Text</span>
            </button>
          </div>
        </div>

        {isEditingCipherText && (
          <textarea
            id="cipher-text-input"
            value={cipherText}
            onChange={handleCipherTextChange}
            className="w-full p-2 border dark:border-gray-600 rounded font-mono mb-4 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
            rows={2}
            aria-label="Cipher text input"
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
              }
            }}
          />
        )}

        <div className="mb-4">
          <div className={`${TEXT_SMALL_MUTED} mb-2`}>
            Dimensions (rows × columns)
          </div>
          <div className="flex gap-4 items-center">
            <div
              className="flex items-center gap-2"
              role="group"
              aria-label="Dimension controls"
            >
              <button
                onClick={() => navigateDimensions("prev")}
                disabled={possibleDimensions.length === 0}
                className={`px-2 py-1 rounded transition ${
                  possibleDimensions.length === 0
                    ? "bg-gray-100 dark:bg-gray-700 text-gray-400 dark:text-gray-500 cursor-not-allowed"
                    : "bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200 hover:bg-gray-300 dark:hover:bg-gray-600"
                }`}
                aria-label="Previous dimension"
              >
                ←
              </button>
              <input
                type="number"
                min="1"
                value={state.dimensions[0] || ""}
                onChange={(e) => handleDimensionChange(0, e.target.value)}
                className="w-20 text-center border dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                placeholder="rows"
                aria-label="Number of rows"
              />
              <span className={TEXT_MUTED} aria-hidden="true">
                ×
              </span>
              <input
                type="number"
                min="1"
                value={state.dimensions[1] || ""}
                onChange={(e) => handleDimensionChange(1, e.target.value)}
                className="w-20 text-center border dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                placeholder="columns"
                aria-label="Number of columns"
              />
              <button
                onClick={() => navigateDimensions("next")}
                disabled={possibleDimensions.length === 0}
                className={`px-2 py-1 rounded transition ${
                  possibleDimensions.length === 0
                    ? "bg-gray-100 dark:bg-gray-700 text-gray-400 dark:text-gray-500 cursor-not-allowed"
                    : "bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200 hover:bg-gray-300 dark:hover:bg-gray-600"
                }`}
                aria-label="Next dimension"
              >
                →
              </button>
            </div>
            {cipherText && possibleDimensions.length === 0 && (
              <span className="text-red-500 dark:text-red-400">
                input length is prime
              </span>
            )}
          </div>
        </div>

        {cipherText && possibleDimensions.length > 0 && (
          <div className="text-sm text-gray-600 dark:text-gray-400">
            Possible dimensions for {cipherText.length} chars:{" "}
            {possibleDimensions.map(([r, c]) => `${r}×${c}`).join(", ")}
          </div>
        )}

        {tableData.length > 0 && (
          <div className="mt-4">
            <div className="text-sm text-gray-600 dark:text-gray-400 mb-2">
              Transposition Table
            </div>
            <div className="w-full flex justify-center">
              <div className="max-w-3xl w-full">
                <DndContext
                  sensors={sensors}
                  collisionDetection={closestCenter}
                  onDragStart={handleDragStart}
                  onDragEnd={handleDragEnd}
                >
                  <SortableContext
                    items={state.columnOrder}
                    strategy={horizontalListSortingStrategy}
                  >
                    <table className="w-full text-center table-fixed border dark:border-gray-700">
                      <colgroup>
                        {state.columnOrder.map((_, index) => (
                          <col
                            key={index}
                            style={{
                              width: `${100 / state.columnOrder.length}%`,
                            }}
                          />
                        ))}
                      </colgroup>
                      <thead>
                        <tr>
                          {state.columnOrder.map((colIndex) => (
                            <SortableHeader
                              key={colIndex}
                              id={colIndex}
                              onDragTransformChange={(id, transform) => {
                                setColumnTransforms((prev) => ({
                                  ...prev,
                                  [id]: transform,
                                }));
                              }}
                            />
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {reorderedTableData.map((row, rowIndex) => (
                          <tr key={rowIndex}>
                            {row.map((cell, colIndex) => (
                              <TableCell
                                key={colIndex}
                                highlightClass={getCellHighlightClass(
                                  rowIndex,
                                  colIndex,
                                  cell
                                )}
                                isDragging={
                                  draggingColumnId ===
                                  state.columnOrder[colIndex]
                                }
                                transform={
                                  columnTransforms[state.columnOrder[colIndex]]
                                }
                              >
                                {cell}
                              </TableCell>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </SortableContext>
                </DndContext>
              </div>
            </div>
          </div>
        )}

        {transposedText && (
          <div className="mt-4">
            <div className="text-sm text-gray-600 dark:text-gray-400 mb-2">
              Transposed Text
            </div>
            <div className="font-mono text-lg p-4 bg-gray-50 dark:bg-gray-800 rounded-lg break-all">
              {transposedText.split("").map((char, index) => (
                <span key={index} className={getCharHighlightClass(char)}>
                  {char}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>
      <div className="w-64 bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
        {/* essentially - searches for chars in transposed text and table + highlights chars on hover, with preference to individual char over any */}
        <div className="text-sm text-gray-600 dark:text-gray-400 mb-2">
          Search Word
        </div>
        <div
          className="flex flex-wrap gap-1 p-2 border dark:border-gray-600 rounded font-mono bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 min-h-[2.5rem]"
          onMouseEnter={() => setIsBoxHovered(true)}
          onMouseLeave={() => setIsBoxHovered(false)}
        >
          {wordInput.split("").map((char, index) => (
            <span
              key={index}
              className={`px-1 cursor-pointer ${
                hoveredCharIndex === index ? "bg-blue-200 dark:bg-blue-800" : ""
              }`}
              onMouseEnter={() => setHoveredCharIndex(index)}
              onMouseLeave={() => setHoveredCharIndex(null)}
            >
              {char}
            </span>
          ))}
          <input
            type="text"
            value={wordInput}
            onChange={(e) => setWordInput(e.target.value.toUpperCase())}
            className="flex-1 min-w-[2rem] bg-transparent outline-none text-transparent caret-transparent"
            placeholder="Enter a word..."
            aria-label="Word input"
          />
        </div>

        {/* autosolve */}
        <div className="mt-6 pt-6 border-t dark:border-gray-600">
          <div className="flex gap-2 items-center mb-2">
            <button
              onClick={runAutomaticSolver}
              disabled={
                isSolving || !cipherText || possibleDimensions.length === 0
              }
              className={`px-4 py-2 rounded transition font-medium text-sm ${
                isSolving || !cipherText || possibleDimensions.length === 0
                  ? BUTTON_DISABLED
                  : "bg-blue-500 hover:bg-blue-600 text-white"
              }`}
            >
              {isSolving ? "Solving..." : "🔍 Auto Solve All"}
            </button>
          </div>
          <div className="text-xs text-gray-500 dark:text-gray-400 mb-2">
            Tests all dimensions automatically
          </div>
          {isSolving && currentSolvingDimension && (
            <div className="text-xs text-blue-600 dark:text-blue-400">
              Checking {currentSolvingDimension[0]}×{currentSolvingDimension[1]}
              ...
            </div>
          )}
          {showSolverResults && (
            <button
              onClick={() => setShowSolverResults(false)}
              className={`px-3 py-1 text-xs rounded transition ${BUTTON_ENABLED} mt-2`}
            >
              Hide Results
            </button>
          )}
        </div>
      </div>

      {/* autosolve overlay */}
      {showSolverResults && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg max-w-4xl w-full max-h-[80vh] overflow-hidden">
            <div className="flex justify-between items-center p-4 border-b dark:border-gray-600">
              <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100">
                Auto Solver Results
              </h3>
              <div className="flex items-center gap-3">
                <span className="text-sm text-gray-500 dark:text-gray-400">
                  {solverResults.length} high-scoring candidates found
                </span>
                <button
                  onClick={() => setShowSolverResults(false)}
                  className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
                >
                  ✕
                </button>
              </div>
            </div>

            {isSolving ? (
              <div className="text-center py-12">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
                <div className="text-gray-600 dark:text-gray-400 mb-2">
                  Analyzing all possible dimensions...
                </div>
                {currentSolvingDimension && (
                  <div className="text-sm text-blue-600 dark:text-blue-400">
                    Currently checking {currentSolvingDimension[0]}×
                    {currentSolvingDimension[1]}
                  </div>
                )}
              </div>
            ) : (
              <div className="p-4 overflow-y-auto max-h-[60vh]">
                {solverResults.length === 0 ? (
                  <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                    No high-scoring solutions found. The text may not be a
                    columnar cipher, or it may require manual adjustment.
                  </div>
                ) : (
                  <div className="space-y-3">
                    {solverResults.map((candidate, index) => (
                      <div
                        key={index}
                        className={`rounded-lg p-4 border ${
                          index === 0
                            ? "bg-yellow-50 dark:bg-yellow-900/20 border-yellow-300 dark:border-yellow-600 ring-2 ring-yellow-200 dark:ring-yellow-700"
                            : "bg-gray-50 dark:bg-gray-700 border-gray-300 dark:border-gray-600"
                        }`}
                      >
                        <div className="mb-3">
                          <div className="flex items-center gap-2">
                            <div className="text-sm font-medium text-gray-900 dark:text-gray-100">
                              #{index + 1} - Score: {candidate.score.toFixed(2)}
                            </div>
                            {index === 0 && (
                              <div className="px-2 py-1 bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300 text-xs rounded-full font-medium">
                                ⭐ Top Solution
                              </div>
                            )}
                          </div>
                          <div className="text-xs text-gray-600 dark:text-gray-400">
                            Dimensions: {candidate.dimensions[0]}×
                            {candidate.dimensions[1]} | Column order: [
                            {candidate.columnOrder.map((c) => c + 1).join(", ")}
                            ]
                          </div>
                        </div>

                        {candidate.potentialFinalText ? (
                          <div className="space-y-2 mb-3">
                            <div className="text-xs font-medium text-blue-700 dark:text-blue-300">
                              AI Formatted Text:
                            </div>
                            <div className="font-mono text-sm bg-blue-50 dark:bg-blue-900/20 p-3 rounded border border-blue-200 dark:border-blue-700 break-all max-h-20 overflow-y-auto">
                              {candidate.potentialFinalText}
                            </div>
                            <div className="text-xs font-medium text-gray-600 dark:text-gray-400">
                              Raw Decrypted Text:
                            </div>
                            <div className="font-mono text-sm bg-white dark:bg-gray-600 p-3 rounded break-all max-h-20 overflow-y-auto">
                              {candidate.decryptedText}
                            </div>
                          </div>
                        ) : (
                          <div className="font-mono text-sm bg-white dark:bg-gray-600 p-3 rounded mb-3 break-all max-h-20 overflow-y-auto">
                            {candidate.decryptedText}
                          </div>
                        )}

                        <div className="flex justify-between items-end">
                          <div className="grid grid-cols-3 gap-4 text-xs">
                            <div>
                              <span className="font-medium">Bigrams:</span>{" "}
                              {candidate.scores.bigrams}
                            </div>
                            <div>
                              <span className="font-medium">Trigrams:</span>{" "}
                              {candidate.scores.trigrams}
                            </div>
                            <div>
                              <span className="font-medium">
                                Double Letters:
                              </span>{" "}
                              {candidate.scores.doubleLetters}
                            </div>
                          </div>
                          <button
                            onClick={() => applySolverResult(candidate)}
                            className="px-3 py-1 bg-blue-500 hover:bg-blue-600 text-white text-xs rounded font-medium transition"
                          >
                            Apply
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
