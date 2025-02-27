import React from 'react';
import { cn, formatUrl, getDomain } from '@/lib/utils';
import { FileIcon, GlobeIcon, VideoIcon, ExternalLinkIcon } from '@radix-ui/react-icons';
import Link from 'next/link';

interface ResourceCardProps {
  title?: string;
  items?: string[];
  type?: 'default' | 'primary' | 'secondary' | 'accent';
  icon?: 'file' | 'globe' | 'video';
  className?: string;
  url?: string;
  index?: number;
}

const ResourceCard: React.FC<ResourceCardProps> = ({
  title,
  items,
  type = 'default',
  icon,
  className,
  url,
  index,
}) => {
  const getBgColor = () => {
    switch (type) {
      case 'primary': return 'bg-primary';
      case 'secondary': return 'bg-secondary';
      case 'accent': return 'bg-accent';
      default: return 'bg-brutalist-white';
    }
  };

  const getIcon = () => {
    switch (icon) {
      case 'file': return <FileIcon className="h-5 w-5" />;
      case 'globe': return <GlobeIcon className="h-5 w-5" />;
      case 'video': return <VideoIcon className="h-5 w-5" />;
      default: return null;
    }
  };

  if (url && index !== undefined) {
    const domain = getDomain(url);
    const formattedUrl = formatUrl(url);
    
    return (
      <div className="bg-brutalist-white border-4 border-brutalist-black shadow-brutal hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-none transition-all">
        <Link
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className="block p-4 h-full"
        >
          <div className="flex items-start justify-between">
            <div className="flex-1 min-w-0 pr-2"> {/* Added min-width and padding for spacing */}
              <p className="font-mono text-sm text-brutalist-black opacity-70 mb-1">Source {index + 1}</p>
              <h3 className="font-mono text-base font-bold text-brutalist-black break-words">{domain}</h3>
              <p className="font-mono text-sm text-brutalist-black truncate">{formattedUrl}</p>
            </div>
            <div className="flex-shrink-0 mt-1">
              <ExternalLinkIcon className="h-5 w-5 text-brutalist-black" />
            </div>
          </div>
        </Link>
      </div>
    );
  }

  return (
    <div className={cn(
      'border-brutal',
      getBgColor(),
      'p-6 h-full',
      className
    )}>
      <div className="flex items-center gap-2 mb-4">
        {icon && (
          <div className="p-2 bg-brutalist-white border-2 border-brutalist-black">
            {getIcon()}
          </div>
        )}
        <h3 className="font-mono text-lg font-bold">{title}</h3>
      </div>
      
      <ul className="space-y-2 font-mono text-sm">
        {items?.map((item, index) => (
          <li key={index} className="flex items-start">
            <span className="mr-2">•</span>
            <span>{item}</span>
          </li>
        ))}
      </ul>
    </div>
  );
};

export { ResourceCard };