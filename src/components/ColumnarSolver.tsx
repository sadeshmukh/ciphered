import { useState, useEffect } from "react";
import React from "react";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import type { DragEndEvent } from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  horizontalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useLocalStorage } from "../data/utils";

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
  currentDimensionIndex: number;
  columnOrder: number[];
};

function SortableColumn({
  id,
  children,
  className,
  highlightClass,
}: {
  id: number;
  children: React.ReactNode;
  className?: string;
  highlightClass?: string;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <td
      ref={setNodeRef}
      style={style}
      className={`px-1 py-2 text-sm font-mono border dark:border-gray-700 text-gray-900 dark:text-gray-100 ${
        highlightClass || ""
      } ${className || ""}`}
    >
      {children}
    </td>
  );
}

function SortableHeader({ id }: { id: number }) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
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
  const [state, setState] = useState<ColumnarState>({
    dimensions: [0, 0],
    currentDimensionIndex: -1,
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

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  // I did not realize just how useful memo is
  const possibleDimensions = React.useMemo(() => {
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

  // reset column order when dimensions change
  useEffect(() => {
    if (state.dimensions[1] > 0) {
      // ALWAYS create a fresh column order when dimensions change
      setState((prev) => ({
        ...prev,
        columnOrder: Array.from({ length: state.dimensions[1] }, (_, i) => i),
      }));
    }
  }, [state.dimensions]);

  // create table data based on dimensions
  const tableData = React.useMemo(() => {
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

  useEffect(() => {
    if (state.dimensions[0] === 0 || state.dimensions[1] === 0) {
      setState((prev) => ({ ...prev, currentDimensionIndex: -1 }));
      return;
    }

    const index = possibleDimensions.findIndex(
      ([r, c]) => r === state.dimensions[0] && c === state.dimensions[1]
    );
    setState((prev) => ({ ...prev, currentDimensionIndex: index }));
  }, [state.dimensions, possibleDimensions]);

  const navigateDimensions = (direction: "prev" | "next") => {
    if (possibleDimensions.length === 0) return;

    let newIndex = state.currentDimensionIndex;
    if (direction === "next") {
      newIndex = (state.currentDimensionIndex + 1) % possibleDimensions.length;
    } else {
      newIndex =
        (state.currentDimensionIndex - 1 + possibleDimensions.length) %
        possibleDimensions.length;
    }

    setState((prev) => ({
      ...prev,
      currentDimensionIndex: newIndex,
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

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

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

  const reorderedTableData = React.useMemo(() => {
    if (!tableData.length || !state.columnOrder.length) return tableData;

    return tableData.map((row) =>
      state.columnOrder.map((colIndex) => row[colIndex])
    );
  }, [tableData, state.columnOrder]);

  // get transposed text
  const transposedText = React.useMemo(() => {
    if (!reorderedTableData.length) return "";

    return reorderedTableData.map((row) => row.join("")).join("");
  }, [reorderedTableData]);

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
    if (hoveredCharIndex !== null && content === wordInput[hoveredCharIndex]) {
      return "bg-blue-500 dark:bg-blue-500";
    }
    return null;
  };

  const highlightAnyChar = (
    row: number,
    col: number,
    content: string,
    data: string[][]
  ) => {
    if (isBoxHovered && Array.from(wordInput).includes(content)) {
      return "bg-green-500 dark:bg-green-500";
    }
    return null;
  };

  const highlightFunctions: HighlightFn[] = [
    highlightBottomRowX,
    highlightChar,
    highlightAnyChar,
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
          <div className="text-sm text-gray-600 dark:text-gray-400 mb-2">
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
              <span
                className="text-gray-600 dark:text-gray-400"
                aria-hidden="true"
              >
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
                          {state.columnOrder.map((colIndex, index) => (
                            <SortableHeader key={index} id={colIndex} />
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {reorderedTableData.map((row, rowIndex) => (
                          <tr key={rowIndex}>
                            {row.map((cell, colIndex) => (
                              <SortableColumn
                                key={colIndex}
                                id={state.columnOrder[colIndex]}
                                highlightClass={getCellHighlightClass(
                                  rowIndex,
                                  colIndex,
                                  cell
                                )}
                              >
                                {cell}
                              </SortableColumn>
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
              {transposedText.split("").map((char, index) => {
                let highlightClass = "";
                if (
                  hoveredCharIndex !== null &&
                  char === wordInput[hoveredCharIndex]
                ) {
                  highlightClass = "bg-blue-500 dark:bg-blue-500";
                } else if (isBoxHovered && wordInput.includes(char)) {
                  highlightClass = "bg-green-500 dark:bg-green-500";
                }
                return (
                  <span key={index} className={highlightClass}>
                    {char}
                  </span>
                );
              })}
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
      </div>
    </div>
  );
}
