import type { DocSection } from "../data/cipherDocs";
import { cipherDocs } from "../data/cipherDocs";

interface Props {
  isVisible: boolean;
}

export default function CipherDocsPanel({ isVisible }: Props) {
  if (!isVisible) return null;

  const renderSection = (section: DocSection) => (
    <div key={section.title} className="mb-3">
      <h3 className="font-medium text-sm mb-1 text-gray-900 dark:text-gray-100">
        {section.title}
      </h3>
      {section.items && (
        <div className="grid grid-cols-4 gap-0.5 text-xs">
          {section.items.map((item) => (
            <div
              key={item}
              className="text-center text-gray-700 dark:text-gray-300"
            >
              {item}
            </div>
          ))}
        </div>
      )}
      {section.subsections?.map((subsection) => (
        <div key={subsection.title} className="mt-1">
          <div className="grid grid-cols-4 gap-0.5 text-xs">
            {subsection.items.map((item) => (
              <div
                key={item}
                className="text-center text-gray-700 dark:text-gray-300"
              >
                {item}
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );

  return (
    <div className="w-72 bg-white dark:bg-gray-800 rounded-lg shadow-lg p-4 overflow-y-auto max-h-[calc(100vh-2rem)]">
      <h2 className="text-base font-semibold mb-2 text-gray-900 dark:text-gray-100">
        Solving Tips
      </h2>
      {cipherDocs.map(renderSection)}
    </div>
  );
}
