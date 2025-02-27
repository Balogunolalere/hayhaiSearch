import React from 'react';
import { Button } from '@/components/ui/Button';
import { 
  TextAlignJustifyIcon, 
  MagicWandIcon, 
  ClockIcon,
  CheckCircledIcon
} from '@radix-ui/react-icons';

interface ResultToolsProps {
  content: string;
  onFormat: () => void;
  isFormatEnabled: boolean;
  onEnhanceQuery?: () => void;
  onEvaluateSources?: () => void;
  isQueryEnhanced?: boolean;
  isSourceEvaluated?: boolean;
}

const ResultTools: React.FC<ResultToolsProps> = ({ 
  content, 
  onFormat, 
  isFormatEnabled, 
  onEnhanceQuery, 
  onEvaluateSources,
  isQueryEnhanced,
  isSourceEvaluated
}) => {
  return (
    <div className="flex items-center gap-2 flex-wrap">
      <Button
        variant="outline"
        size="sm"
        onClick={onFormat}
        aria-label={isFormatEnabled ? "View plain text" : "View formatted text"}
        title={isFormatEnabled ? "View plain text" : "View formatted text"}
        className={isFormatEnabled ? "bg-brutalist-black/10" : ""}
      >
        <TextAlignJustifyIcon className="h-4 w-4 mr-1" />
        {isFormatEnabled ? "Simplified" : "Enhanced"}
      </Button>
      
      {onEnhanceQuery && (
        <Button
          variant="outline"
          size="sm"
          onClick={onEnhanceQuery}
          disabled={isQueryEnhanced}
          aria-label="Enhance query with AI"
          title="Improve search results with AI query interpretation"
          className={isQueryEnhanced ? "bg-brutalist-black/10" : ""}
        >
          <MagicWandIcon className="h-4 w-4 mr-1" />
          {isQueryEnhanced ? (
            <>
              <CheckCircledIcon className="h-3 w-3 mr-1" />
              Enhanced
            </>
          ) : (
            "Enhance Query"
          )}
        </Button>
      )}
      
      {onEvaluateSources && (
        <Button
          variant="outline"
          size="sm"
          onClick={onEvaluateSources}
          disabled={isSourceEvaluated}
          aria-label="Evaluate sources"
          title="Evaluate credibility and relevance of sources"
          className={isSourceEvaluated ? "bg-brutalist-black/10" : ""}
        >
          <ClockIcon className="h-4 w-4 mr-1" />
          {isSourceEvaluated ? (
            <>
              <CheckCircledIcon className="h-3 w-3 mr-1" />
              Evaluated
            </>
          ) : (
            "Evaluate Sources"  
          )}
        </Button>
      )}
    </div>
  );
};

export { ResultTools };