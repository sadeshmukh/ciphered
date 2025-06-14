import { useState, useEffect } from "react";

export function useLocalStorage<T>(key: string, initialValue: T) {
  const [storedValue, setStoredValue] = useState<T>(initialValue);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const item = window.localStorage.getItem(key);
      if (item) {
        setStoredValue(JSON.parse(item));
      }
    } catch (error) {
      console.warn(`Error reading localStorage key \"${key}\":`, error);
    }
  }, [key]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      window.localStorage.setItem(key, JSON.stringify(storedValue));
    } catch (error) {
      console.warn(`Error setting localStorage key \"${key}\":`, error);
    }
  }, [key, storedValue]);

  const setValue = (value: T | ((val: T) => T)) => {
    setStoredValue((prev) => {
      const valueToStore = value instanceof Function ? value(prev) : value;
      return valueToStore;
    });
  };

  return [storedValue, setValue] as const;
}

export function getWordPattern(word: string): string {
  const seen = new Map<string, number>();
  let nextNum = 1;
  return Array.from(word)
    .filter((char) => /[A-Z]/.test(char))
    .map((char) => {
      if (!seen.has(char)) {
        seen.set(char, nextNum++);
      }
      return seen.get(char);
    })
    .join("");
}
