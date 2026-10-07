import React from 'react';
import noResultsImg from '../../assets/noResultsFound.png';

export interface NoResultsProps {
  title?: string;
  description?: string;
  action?: {
    label: string;
    onClick: () => void;
    icon?: React.ReactNode;
  };
  imageClassName?: string;
  className?: string;
}

export const NoResults: React.FC<NoResultsProps> = ({
  imageClassName = 'w-48 sm:w-56 h-auto',
  className = 'py-10',
}) => {
  return (
    <div className={`flex flex-col items-center justify-center text-center px-4 ${className}`}>
      <img
        src={noResultsImg}
        alt="No Results Found"
        className={`object-contain select-none max-h-56 ${imageClassName}`}
      />
    </div>
  );
};
