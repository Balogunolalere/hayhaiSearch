import React, { useState } from 'react';
import { cn } from '@/lib/utils';
import { ResourceCard } from './ResourceCard';
import { ResultTools } from './ResultTools';
import { CopyIcon, InfoCircledIcon, StarIcon } from '@radix-ui/react-icons';

interface SearchResultsProps {
  result: {
    answer: string;
    sources: string[];
    search_type: string;
    ai_interpretation?: {
      interpreted_query: string;
      related_terms?: string[];
      query_intent?: string;
    };
    source_evaluation?: {
      sources: {
        url: string;
        credibility_score: number;
        reasons?: string[];
      }[];
    };
  } | null;
  isLoading: boolean;
  className?: string;
}

// Define types for formatted content items
interface CodeBlockItem { type: 'code-block'; content: string; language: string; }
interface TableItem { type: 'table'; headers: string[]; rows: string[][]; }
interface HeadingItem { type: 'heading'; content: string; level: number; }
interface ListItem { type: 'list'; items: string[]; ordered: boolean; }
interface CitationItem { type: 'citation'; content: string; }
interface ParagraphItem { type: 'paragraph'; content: string; }

type ContentItem = CodeBlockItem | TableItem | HeadingItem | ListItem | CitationItem | ParagraphItem;

interface Placeholder { placeholder: string; codeBlock: string; }

export function SearchResults({ result, isLoading, className }: SearchResultsProps) {
  const [enhancedFormatting, setEnhancedFormatting] = useState(true);
  const [showQueryInterpretation, setShowQueryInterpretation] = useState(true);
  const [showSourceDetails, setShowSourceDetails] = useState(false);
  
  // Display skeleton loader during loading state
  if (isLoading) {
    return (
      <div className={cn("space-y-8", className)}>
        <div className="animate-pulse space-y-4">
          <div className="w-3/4 h-6 bg-gray-200 rounded"></div>
          <div className="w-full h-4 bg-gray-200 rounded"></div>
          <div className="w-5/6 h-4 bg-gray-200 rounded"></div>
          <div className="w-full h-4 bg-gray-200 rounded"></div>
          <div className="w-4/6 h-4 bg-gray-200 rounded"></div>
        </div>
        
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="border-4 border-brutalist-black p-4 shadow-brutal bg-gray-100 animate-pulse">
              <div className="h-4 bg-gray-200 rounded mb-2 w-1/4"></div>
              <div className="h-5 bg-gray-200 rounded mb-2 w-3/4"></div>
              <div className="h-4 bg-gray-200 rounded w-full"></div>
            </div>
          ))}
        </div>
      </div>
    );
  }
  if (!result) return null;
  
  // Improved detection for code blocks
  // This pattern checks for triple backtick code blocks that may appear in the raw text
  const detectCodeBlocks = (content: string) => {
    const codeBlockRegex = /```([a-zA-Z]*)\n([\s\S]*?)```/g;
    let modifiedContent = content;
    let match;
    
    while ((match = codeBlockRegex.exec(content)) !== null) {
      const language = match[1] || '';
      const code = match[2];
      
      // Replace the matched code block with a better formatted version
      // We'll preserve the backticks but ensure proper spacing
      const replacement = `\n\n\`\`\`${language}\n${code}\`\`\`\n\n`;
      modifiedContent = modifiedContent.replace(match[0], replacement);
    }
    
    return modifiedContent;
  };
  
  // Split and format paragraphs with improved heading and source citation detection
  const formatContent = (content: string): ContentItem[] => {
    // First, preprocess to improve code block detection
    content = detectCodeBlocks(content);
    
    // Check for common patterns that indicate a raw unformatted output
    const hasMarkdownHeadings = content.match(/\n#+\s/) !== null;
    const hasCodeBlocks = content.match(/```[\s\S]*?```/) !== null;
    const hasListItems = content.match(/\n\d+\.\s/) !== null || content.match(/\n[•\-]\s/) !== null;
    
    // If it's potentially a raw output without formatting, try to structure it
    if (!hasMarkdownHeadings && !hasCodeBlocks && !hasListItems) {
      // Apply automatic formatting for un-structured content
      content = autoFormatContent(content);
    }
    
    const lines = content.split('\n');
    const formatted: ContentItem[] = [];
    let currentParagraph = '';
    let inCodeBlock = false;
    let codeBlockContent = '';
    let codeLanguage = '';
    let inTable = false;
    let tableHeaders: string[] = [];
    let tableRows: string[][] = [];
    let inList = false;
    let listType = '';
    let listItems: string[] = [];
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const trimmedLine = line.trim();
      
      // Handle code blocks
      if (trimmedLine.startsWith('```')) {
        if (inCodeBlock) {
          formatted.push({
            type: 'code-block',
            content: codeBlockContent.trim(),
            language: codeLanguage
          });
          inCodeBlock = false;
          codeBlockContent = '';
          codeLanguage = '';
          continue;
        } else {
          if (currentParagraph) {
            formatted.push({ type: 'paragraph', content: currentParagraph });
            currentParagraph = '';
          }
          inCodeBlock = true;
          codeLanguage = trimmedLine.slice(3);
          continue;
        }
      }
      
      if (inCodeBlock) {
        codeBlockContent += line + '\n';
        continue;
      }
      
      // Handle tables
      if (trimmedLine.includes('|')) {
        if (!inTable) {
          if (currentParagraph) {
            formatted.push({ type: 'paragraph', content: currentParagraph });
            currentParagraph = '';
          }
          inTable = true;
          // Parse headers
          tableHeaders = trimmedLine.split('|')
            .map(cell => cell.trim())
            .filter(cell => cell.length > 0);
          continue;
        }
        // Skip separator line
        if (trimmedLine.includes('-+-') || trimmedLine.replace(/[\s\-\|]/g, '').length === 0) {
          continue;
        }
        // Parse table row
        const cells = trimmedLine.split('|')
          .map(cell => cell.trim())
          .filter(cell => cell.length > 0);
        if (cells.length > 0) {
          tableRows.push(cells);
        }
        // If next line doesn't contain |, end table
        const nextLine = lines[i + 1]?.trim() || '';
        if (!nextLine.includes('|')) {
          formatted.push({
            type: 'table',
            headers: tableHeaders,
            rows: tableRows
          });
          inTable = false;
          tableHeaders = [];
          tableRows = [];
        }
        continue;
      }
      
      // Handle headings
      if (trimmedLine.startsWith('## ')) {
        if (currentParagraph) {
          formatted.push({ type: 'paragraph', content: currentParagraph });
          currentParagraph = '';
        }
        formatted.push({
          type: 'heading',
          content: trimmedLine.replace(/^## /, ''),
          level: 2
        });
        continue;
      } else if (trimmedLine.startsWith('# ')) {
        if (currentParagraph) {
          formatted.push({ type: 'paragraph', content: currentParagraph });
          currentParagraph = '';
        }
        formatted.push({
          type: 'heading',
          content: trimmedLine.replace(/^# /, ''),
          level: 1
        });
        continue;
      }
      
      // Handle lists - improved detection
      const orderedListMatch = trimmedLine.match(/^(\d+)\.\s(.*)/);
      const unorderedListMatch = trimmedLine.match(/^([•\-])\s(.*)/);
      
      if (orderedListMatch || unorderedListMatch) {
        // If we were building a paragraph, save it
        if (currentParagraph) {
          formatted.push({ type: 'paragraph', content: currentParagraph });
          currentParagraph = '';
        }
        
        // Determine list type
        const newListType = orderedListMatch ? 'ordered' : 'unordered';
        const listContent = (orderedListMatch || unorderedListMatch)?.[2] || '';
        
        // Check if this is a new list or continuation
        if (!inList || listType !== newListType) {
          // If we were in a different type of list, push the previous list
          if (inList && listItems.length > 0) {
            formatted.push({
              type: 'list',
              items: listItems,
              ordered: listType === 'ordered'
            });
            listItems = [];
          }
          
          // Start new list
          inList = true;
          listType = newListType;
        }
        
        // Add item to current list
        listItems.push(listContent);
        
        // If next line isn't a list item, end the list
        const nextLine = lines[i + 1]?.trim() || '';
        const isNextLineList = nextLine.match(/^\d+\.\s/) || nextLine.match(/^[•\-]\s/);
        
        if (!isNextLineList && listItems.length > 0) {
          formatted.push({
            type: 'list',
            items: listItems,
            ordered: listType === 'ordered'
          });
          inList = false;
          listItems = [];
        }
        continue;
      }
      
      // Handle source citations
      if (trimmedLine.match(/\[Source \d+\]/) || trimmedLine.match(/\[Source \d+,\s*\d+\]/)) {
        if (currentParagraph) {
          formatted.push({ type: 'paragraph', content: currentParagraph });
          currentParagraph = '';
        }
        formatted.push({ type: 'citation', content: trimmedLine });
        continue;
      }
      
      // Special case for empty lines
      if (!trimmedLine) {
        if (currentParagraph) {
          formatted.push({ type: 'paragraph', content: currentParagraph });
          currentParagraph = '';
        }
        continue;
      }
      
      // Accumulate regular paragraphs
      if (currentParagraph) {
        currentParagraph += ' ' + trimmedLine;
      } else {
        currentParagraph = trimmedLine;
      }
    }
    
    // Add any remaining paragraph
    if (currentParagraph) {
      formatted.push({ type: 'paragraph', content: currentParagraph });
    }
    
    // Add any remaining list
    if (inList && listItems.length > 0) {
      formatted.push({
        type: 'list',
        items: listItems,
        ordered: listType === 'ordered'
      });
    }
    
    return formatted;
  };
  
  // Auto-format unstructured content by applying basic formatting rules
  const autoFormatContent = (content: string) => {
    // Special handling for code embedded within text
    const codeBlockMatches = content.match(/```[\s\S]*?```/g);
    
    if (codeBlockMatches) {
      // Extract and preserve code blocks
      let modifiedContent = content;
      const placeholders: Placeholder[] = [];
      
      codeBlockMatches.forEach((codeBlock, index) => {
        const placeholder = `__CODE_BLOCK_${index}__`;
        placeholders.push({ placeholder, codeBlock });
        modifiedContent = modifiedContent.replace(codeBlock, placeholder);
      });
      
      // Format the non-code parts
      let formatted = '';
      
      // Extract headings (e.g., "The following Python code demonstrates...")
      const possibleSections = modifiedContent.split(/\.\s+(?=[A-Z])/);
      
      possibleSections.forEach((section, index) => {
        if (index === 0) {
          formatted += section.trim() + '.\n\n';
        } else if (section.includes(':') && section.length < 100) {
          // Potential heading
          formatted += '\n## ' + section.trim() + '\n\n';
        } else {
          formatted += section.trim() + '.\n\n';
        }
      });
      
      // Restore code blocks
      placeholders.forEach(({ placeholder, codeBlock }) => {
        formatted = formatted.replace(placeholder, '\n\n' + codeBlock + '\n\n');
      });
      
      return formatted;
    }
    
    // Detect paragraphs with heuristics (fall back if no code blocks)
    const paragraphs = content
      .split(/(?:\.|\?|\!)\s+(?=[A-Z])/)
      .filter(p => p.trim().length > 0)
      .map(p => p.trim() + '.');
    
    // If paragraphs detected, try to structure the content
    if (paragraphs.length > 1) {
      // Simple formatting - add headings and paragraphs
      let formatted = '';
      paragraphs.forEach((p, index) => {
        if (index === 0) {
          formatted += p + '\n\n';
        } else if (p.length < 100 && (p.endsWith(':') || p.endsWith('?'))) {
          // Potential heading
          formatted += '\n## ' + p + '\n\n';
        } else {
          formatted += p + '\n\n';
        }
      });
      
      // Detect lists (common patterns like "1. ", "• ", "- ")
      formatted = formatted.replace(/(\d+\.\s+[^\n]+)/g, '\n$1\n');
      formatted = formatted.replace(/([•\-]\s+[^\n]+)/g, '\n$1\n');
      
      // Clean up any excessive newlines
      return formatted.replace(/\n{3,}/g, '\n\n').trim();
    }
    
    return content;
  };
  
  const processInlineCode = (text: string) => {
    return text.replace(/`([^`]+)`/g, '<code class="bg-brutalist-black/10 px-1 py-0.5 rounded font-mono text-sm">$1</code>');
  };
  
  const toggleFormatting = () => {
    setEnhancedFormatting(!enhancedFormatting);
  };

  // Render star rating based on credibility score
  const renderCredibilityStars = (score: number) => {
    const maxStars = 5;
    const filledStars = Math.round(score * maxStars);
    
    return (
      <div className="flex items-center">
        {[...Array(maxStars)].map((_, i) => (
          i < filledStars ? 
            <StarIcon key={i} className="h-4 w-4 text-accent fill-current" /> : 
            <StarIcon key={i} className="h-4 w-4 text-brutalist-black/30" />
        ))}
      </div>
    );
  };
  
  // Get source evaluation data for a specific URL
  const getSourceEvaluation = (url: string) => {
    if (!result.source_evaluation) return null;
    return result.source_evaluation.sources.find(source => source.url === url);
  };
  
  return (
    <div className={cn("space-y-6", className)}>
      {isLoading ? (
        <div className="animate-pulse space-y-6">
          <div className="border-brutal bg-brutalist-white p-6 space-y-4 relative overflow-hidden">
            <div className="w-3/4 h-6 bg-gray-100 rounded-sm"></div>
            <div className="w-full h-4 bg-gray-100 rounded-sm"></div>
            <div className="w-5/6 h-4 bg-gray-100 rounded-sm"></div>
            <div className="w-full h-4 bg-gray-100 rounded-sm"></div>
            <div className="w-4/6 h-4 bg-gray-100 rounded-sm"></div>
            <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-accent via-primary to-accent animate-gradient"></div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="border-4 border-brutalist-black p-5 shadow-brutal bg-gray-50 animate-pulse relative">
                <div className="flex items-center mb-3">
                  <div className="w-8 h-8 rounded-full bg-gray-100 mr-3"></div>
                  <div className="h-4 bg-gray-100 rounded-sm w-1/2"></div>
                </div>
                <div className="h-4 bg-gray-100 rounded-sm mb-2 w-3/4"></div>
                <div className="h-3.5 bg-gray-100 rounded-sm mb-2 w-full"></div>
                <div className="h-3.5 bg-gray-100 rounded-sm w-2/3"></div>
              </div>
            ))}
          </div>
        </div>
      ) : null}
      
      {!isLoading && result && result.ai_interpretation && (
        <div className="border-brutal bg-accent/5 p-0 transition-all duration-300 overflow-hidden">
          <div 
            className="flex items-center justify-between cursor-pointer p-4 hover:bg-accent/10 transition-colors"
            onClick={() => setShowQueryInterpretation(!showQueryInterpretation)}
          >
            <div className="flex items-center gap-2">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="text-accent">
                <path d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z" 
                      stroke="currentColor" fill="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              <h3 className="font-mono font-bold text-brutalist-black">AI Query Understanding</h3>
            </div>
            <button className="p-2 rounded-full hover:bg-accent/15 transition-colors" aria-label={showQueryInterpretation ? "Hide AI interpretation" : "Show AI interpretation"}>
              {showQueryInterpretation ? 
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="transition-transform">
                  <path d="m18 15-6-6-6 6"/>
                </svg> : 
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="transition-transform">
                  <path d="m6 9 6 6 6-6"/>
                </svg>
              }
            </button>
          </div>
          
          <div className={cn(
            "overflow-hidden transition-all duration-300 ease-in-out",
            showQueryInterpretation ? "max-h-screen opacity-100 p-4" : "max-h-0 opacity-0 p-0"
          )}>
            <div className="mt-1 space-y-5 text-brutalist-black">
              <div className="font-mono bg-white p-4 border-2 border-brutalist-black/10 rounded-sm shadow-sm">
                <span className="text-sm text-brutalist-black/70 block mb-1.5">Interpreted Query:</span>
                <p className="text-md font-medium bg-accent/5 p-2.5 border border-brutalist-black/10 rounded-sm">
                  {result.ai_interpretation.interpreted_query}
                </p>
              </div>
              
              {result.ai_interpretation.query_intent && (
                <div className="font-mono bg-white p-4 border-2 border-brutalist-black/10 rounded-sm shadow-sm">
                  <span className="text-sm text-brutalist-black/70 block mb-1.5">Query Intent:</span>
                  <p className="text-md">{result.ai_interpretation.query_intent}</p>
                </div>
              )}
              
              {result.ai_interpretation.related_terms && result.ai_interpretation.related_terms.length > 0 && (
                <div className="font-mono bg-white p-4 border-2 border-brutalist-black/10 rounded-sm shadow-sm">
                  <span className="text-sm text-brutalist-black/70 block mb-1.5">Related Terms:</span>
                  <div className="flex flex-wrap gap-2 mt-1">
                    {result.ai_interpretation.related_terms.map((term, idx) => (
                      <div key={idx} className="bg-accent/5 px-3 py-1.5 border border-brutalist-black/10 text-sm rounded-sm hover:bg-accent/10 cursor-default transition-colors">
                        {term}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
      
      <div className="border-brutal bg-brutalist-white p-6 mb-8 shadow-brutal-sm">
        <div className="flex items-start justify-between mb-6">
          <h2 className="font-mono text-xl font-bold text-brutalist-black relative pl-3 before:absolute before:left-0 before:top-0 before:bottom-0 before:w-1.5 before:bg-accent before:rounded-sm">Results</h2>
          <ResultTools 
            content={result.answer} 
            onFormat={toggleFormatting}
            isFormatEnabled={enhancedFormatting}
          />
        </div>
        
        {enhancedFormatting ? (
          <div className="prose prose-brutalist max-w-none text-brutalist-black">
            {formatContent(result.answer).map((item, index) => {
              switch (item.type) {
                case 'code-block':
                  return (
                    <div key={index} className="relative group my-6">
                      <div className="absolute right-2 top-2 opacity-0 group-hover:opacity-100 transition-opacity z-10">
                        <button
                          onClick={() => navigator.clipboard.writeText(item.content)}
                          className="p-1.5 bg-brutalist-white hover:bg-brutalist-white/80 border border-brutalist-black rounded-sm transition-all duration-150 hover:shadow-sm"
                          title="Copy code"
                        >
                          <CopyIcon className="h-4 w-4" />
                        </button>
                      </div>
                      <pre className="bg-brutalist-black/5 p-5 my-4 overflow-x-auto border-2 border-brutalist-black font-mono text-sm relative group rounded-sm">
                        <div className="flex items-center justify-between mb-2 text-xs text-brutalist-black">
                          <span className="bg-brutalist-black text-white px-2.5 py-1 rounded-sm">
                            {item.language || 'code'}
                          </span>
                        </div>
                        <code className="text-brutalist-black block">
                          {item.content}
                        </code>
                      </pre>
                    </div>
                  );
                case 'table':
                  return (
                    <div key={index} className="my-6 overflow-x-auto rounded-sm border-2 border-brutalist-black">
                      <table className="min-w-full">
                        <thead className="bg-brutalist-black/10">
                          <tr>
                            {item.headers.map((header, i) => (
                              <th key={i} className="border border-brutalist-black/50 px-4 py-3 text-left font-mono text-sm text-brutalist-black font-bold">
                                {header}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {item.rows.map((row, rowIndex) => (
                            <tr key={rowIndex} className={rowIndex % 2 === 0 ? 'bg-white' : 'bg-brutalist-black/5'}>
                              {row.map((cell, cellIndex) => (
                                <td key={cellIndex} className="border border-brutalist-black/20 px-4 py-3 font-mono text-sm text-brutalist-black">
                                  <div dangerouslySetInnerHTML={{ 
                                    __html: processInlineCode(cell)
                                  }} />
                                </td>
                              ))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  );
                case 'heading':
                  return (
                    <h3 
                      key={index} 
                      className={cn(
                        "font-mono font-bold text-brutalist-black border-b-2 border-brutalist-black/10 pb-2",
                        item.level === 1 ? "text-2xl mt-8 mb-4" : "text-xl mt-6 mb-3"
                      )}
                    >
                      {item.content}
                    </h3>
                  );
                case 'list':
                  return (
                    <div key={index} className="my-4 pl-2">
                      {item.items.map((listItem, i) => (
                        <div key={i} className="flex items-start gap-2 my-2 font-mono text-base text-brutalist-black">
                          <span className="flex-shrink-0 w-6 text-right text-brutalist-black">
                            {item.ordered ? `${i + 1}.` : '•'}
                          </span>
                          <span 
                            className="flex-1 text-brutalist-black"
                            dangerouslySetInnerHTML={{ 
                              __html: processInlineCode(listItem)
                            }} 
                          />
                        </div>
                      ))}
                    </div>
                  );
                case 'citation':
                  return (
                    <div key={index} className="inline-flex items-center px-2 py-1 my-1 text-sm text-brutalist-black/70 bg-brutalist-black/5 border border-brutalist-black/20 rounded-sm">
                      {item.content}
                    </div>
                  );
                default:
                  return (
                    <p 
                      key={index} 
                      className="font-mono text-base my-4 text-brutalist-black leading-relaxed"
                      dangerouslySetInnerHTML={{ 
                        __html: processInlineCode(item.content)
                      }}
                    />
                  );
              }
            })}
          </div>
        ) : (
          <pre className="font-mono text-base whitespace-pre-wrap p-4 text-brutalist-black border-2 border-brutalist-black/10 rounded bg-brutalist-white/50">
            {result.answer}
          </pre>
        )}
      </div>
      
      {result.sources && result.sources.length > 0 && (
        <div className="space-y-5">
          <div className="flex items-center justify-between">
            <h3 className="font-mono text-lg font-bold text-brutalist-black relative pl-3 before:absolute before:left-0 before:top-0 before:bottom-0 before:w-1.5 before:bg-primary before:rounded-sm">Sources</h3>
            
            {result.source_evaluation && (
              <button 
                className="flex items-center gap-2 text-sm font-mono border-2 border-brutalist-black px-3 py-1.5 hover:bg-brutalist-black/5 transition-colors rounded-sm"
                onClick={() => setShowSourceDetails(!showSourceDetails)}
                title="Toggle source credibility details"
              >
                <InfoCircledIcon className="h-4 w-4" />
                {showSourceDetails ? 'Hide Credibility' : 'Show Credibility'}
              </button>
            )}
          </div>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {result.sources.map((url, index) => {
              const sourceEval = getSourceEvaluation(url);
              
              return (
                <div key={index} className={cn(
                  "relative transition-all duration-200 transform hover:-translate-y-0.5 hover:shadow-brutal-sm",
                  sourceEval && sourceEval.credibility_score >= 0.8 ? "ring-2 ring-green-500 shadow-sm shadow-green-100" : "",
                  sourceEval && sourceEval.credibility_score <= 0.3 ? "ring-2 ring-red-500 shadow-sm shadow-red-100" : ""
                )}>
                  <ResourceCard url={url} index={index} />
                  
                  {sourceEval && showSourceDetails && (
                    <div className="mt-0 p-4 border-2 border-t-0 border-brutalist-black bg-white/95 backdrop-blur-sm font-mono text-sm space-y-3 rounded-b-sm">
                      <div className="flex items-center justify-between">
                        <span className="text-brutalist-black/80">Credibility:</span>
                        {renderCredibilityStars(sourceEval.credibility_score)}
                      </div>
                      
                      {sourceEval.reasons && sourceEval.reasons.length > 0 && (
                        <div className="mt-1 bg-brutalist-black/5 p-2.5 rounded-sm border border-brutalist-black/10">
                          <span className="text-xs text-brutalist-black/70 block mb-1.5 font-semibold">Evidence:</span>
                          <ul className="list-disc list-inside space-y-1.5 text-xs">
                            {sourceEval.reasons.map((reason, idx) => (
                              <li key={idx} className="text-brutalist-black leading-relaxed">{reason}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}