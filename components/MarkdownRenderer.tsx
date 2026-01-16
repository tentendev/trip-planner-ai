
import React from 'react';

interface MarkdownRendererProps {
  content: string;
}

// A simple markdown renderer that handles headers, lists, and tables specifically for the Trip OS output format.
const MarkdownRenderer: React.FC<MarkdownRendererProps> = ({ content }) => {
  const lines = content.split('\n');
  const renderedElements: React.ReactNode[] = [];
  
  let inTable = false;
  let tableHeader: string[] = [];
  let tableRows: string[][] = [];
  let tableAlignments: string[] = [];

  // Helper to process text formatting (bold, code, custom brackets, line breaks)
  const formatText = (text: string) => {
    return text
      .replace(/<br\s*\/?>/gi, '<br />') // Handle explicit HTML break tags
      // Handle Bold (** or __) - Improved regex to be safer
      .replace(/(\*\*|__)(.*?)\1/g, '<strong class="font-bold text-slate-900">$2</strong>')
      // Handle Italic (* or _) - preventing interference with bold
      .replace(/(\*|_)(.*?)\1/g, '<em class="italic text-slate-800">$2</em>')
      // Code
      .replace(/`([^`]+)`/g, '<code class="bg-slate-100 px-1 py-0.5 rounded text-sm text-pink-600 font-mono">$1</code>')
      // Trip OS Brackets [Context]
      .replace(/\[(.*?)\]/g, '<span class="text-amber-600 font-medium tracking-tight">[$1]</span>');
  };

  const renderTable = (header: string[], rows: string[][], key: string) => {
    return (
      <div key={key} className="overflow-x-auto my-6 border border-slate-200 rounded-xl shadow-sm bg-white">
        <table className="w-full text-sm text-left text-slate-700">
          <thead className="text-xs text-slate-500 uppercase bg-slate-50 border-b border-slate-200">
            <tr>
              {header.map((h, i) => (
                <th key={i} className="px-5 py-4 font-bold tracking-wider whitespace-nowrap">
                  <span dangerouslySetInnerHTML={{ __html: formatText(h.trim()) }} />
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.map((row, rI) => (
              <tr key={rI} className="hover:bg-slate-50/80 transition-colors">
                {row.map((cell, cI) => (
                  <td key={cI} className="px-5 py-4 align-top leading-relaxed">
                    <span dangerouslySetInnerHTML={{ __html: formatText(cell.trim()) }} />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  };

  const processTableLine = (line: string) => {
    // Remove leading/trailing pipes and split by pipe
    // We filter out empty strings that might result from leading/trailing pipes
    const parts = line.split('|');
    // If the line starts/ends with pipe, the split will create empty strings at start/end
    if (line.trim().startsWith('|')) parts.shift();
    if (line.trim().endsWith('|')) parts.pop();
    return parts;
  };

  lines.forEach((line, index) => {
    const trimmed = line.trim();

    // Table Detection
    if (trimmed.startsWith('|')) {
      if (!inTable) {
        inTable = true;
        tableHeader = processTableLine(trimmed);
        tableRows = [];
      } else if (trimmed.includes('---')) {
        // Separator line
        tableAlignments = processTableLine(trimmed);
      } else {
        tableRows.push(processTableLine(trimmed));
      }
      // Check if table ends (next line is empty or not a pipe)
      const nextLine = lines[index + 1]?.trim();
      if (!nextLine || !nextLine.startsWith('|')) {
        renderedElements.push(renderTable(tableHeader, tableRows, `table-${index}`));
        inTable = false;
      }
      return;
    }

    // Headers
    if (trimmed.startsWith('## ')) {
      renderedElements.push(
        <h2 key={index} className="text-2xl font-bold text-slate-900 mt-10 mb-5 pb-3 border-b border-slate-200 flex items-center gap-2">
           <span dangerouslySetInnerHTML={{ __html: formatText(trimmed.replace('## ', '')) }} />
        </h2>
      );
    } else if (trimmed.startsWith('### ')) {
      renderedElements.push(
        <h3 key={index} className="text-xl font-bold text-blue-700 mt-8 mb-4">
           <span dangerouslySetInnerHTML={{ __html: formatText(trimmed.replace('### ', '')) }} />
        </h3>
      );
    } else if (trimmed.startsWith('#### ')) {
      renderedElements.push(
        <h4 key={index} className="text-lg font-bold text-slate-800 mt-6 mb-3">
           <span dangerouslySetInnerHTML={{ __html: formatText(trimmed.replace('#### ', '')) }} />
        </h4>
      );
    }
    // Lists
    else if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
      const content = trimmed.substring(2);
      // Check for Checkboxes [ ] or [x]
      if (content.startsWith('[ ]') || content.startsWith('[x]')) {
         const isChecked = content.startsWith('[x]');
         const text = content.substring(3).trim();
         renderedElements.push(
           <div key={index} className="flex items-start gap-3 my-2 ml-2">
              <div className={`w-5 h-5 rounded border flex items-center justify-center flex-shrink-0 mt-0.5 ${isChecked ? 'bg-blue-600 border-blue-600 text-white' : 'border-slate-300 bg-white'}`}>
                {isChecked && <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>}
              </div>
              <span className={`text-slate-700 ${isChecked ? 'line-through text-slate-400' : ''}`} dangerouslySetInnerHTML={{ __html: formatText(text) }} />
           </div>
         )
      } else {
        renderedElements.push(
          <li key={index} className="ml-5 list-disc pl-2 text-slate-700 mb-2 leading-relaxed marker:text-slate-400">
             <span dangerouslySetInnerHTML={{ 
                __html: formatText(content)
              }} />
          </li>
        );
      }
    } else if (trimmed.match(/^\d+\./)) {
       renderedElements.push(
        <div key={index} className="ml-4 flex gap-3 mb-3 text-slate-700 leading-relaxed">
          <span className="font-bold text-slate-400 font-mono mt-0.5">{trimmed.split('.')[0]}.</span>
          <span dangerouslySetInnerHTML={{ 
              __html: formatText(trimmed.substring(trimmed.indexOf('.') + 1).trim())
            }} />
        </div>
       );
    }
    // Blockquotes
    else if (trimmed.startsWith('> ')) {
       renderedElements.push(
         <blockquote key={index} className="border-l-4 border-blue-500 bg-blue-50 p-4 rounded-r-lg text-slate-700 italic my-4">
            <span dangerouslySetInnerHTML={{ __html: formatText(trimmed.substring(2)) }} />
         </blockquote>
       )
    }
    // Standard Paragraphs (ignore empty lines)
    else if (trimmed.length > 0) {
      renderedElements.push(
        <p key={index} className="text-slate-600 mb-4 leading-relaxed">
           <span dangerouslySetInnerHTML={{ 
              __html: formatText(trimmed)
            }} />
        </p>
      );
    }
  });

  return <div className="markdown-container font-sans">{renderedElements}</div>;
};

export default MarkdownRenderer;
