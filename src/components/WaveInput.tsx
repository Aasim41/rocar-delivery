import React from 'react';

interface WaveInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label: string;
}

export function WaveInput({ label, ...props }: WaveInputProps) {
  return (
    <div className="wave-group w-full">
      <input 
        required 
        className="input" 
        {...props} 
      />
      <span className="bar"></span>
      <label className="label">
        {label.split('').map((char, index) => (
          <span 
            key={index} 
            className="label-char" 
            style={{ '--index': index } as React.CSSProperties}
          >
            {char === ' ' ? '\u00A0' : char}
          </span>
        ))}
      </label>
    </div>
  );
}
