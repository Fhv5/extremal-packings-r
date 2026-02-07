import React, { useState, useRef, useEffect } from 'react';

interface CollapsibleBoxProps {
  title: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
}

const CollapsibleBox: React.FC<CollapsibleBoxProps> = ({
  title,
  defaultOpen = true,
  children,
}) => {
  const [open, setOpen] = useState(defaultOpen);
  const contentRef = useRef<HTMLDivElement>(null);
  const [maxHeight, setMaxHeight] = useState<string>(defaultOpen ? 'none' : '0px');

  useEffect(() => {
    if (open) {
      const el = contentRef.current;
      if (el) {
        // Temporarily set to auto to measure
        el.style.maxHeight = 'none';
        const height = el.scrollHeight;
        el.style.maxHeight = '0px';
        // Force reflow
        void el.offsetHeight;
        el.style.maxHeight = height + 'px';
        // After transition, set to none so dynamic content works
        const handler = () => {
          el.style.maxHeight = 'none';
        };
        el.addEventListener('transitionend', handler, { once: true });
      }
    } else {
      const el = contentRef.current;
      if (el) {
        // Set current height explicitly, then collapse to 0
        el.style.maxHeight = el.scrollHeight + 'px';
        void el.offsetHeight;
        el.style.maxHeight = '0px';
      }
    }
  }, [open]);

  return (
    <div className="info-box">
      <div
        className="info-box-header"
        onClick={() => setOpen(!open)}
      >
        <h4>{title}</h4>
        <span className="collapse-icon">{open ? '▼' : '►'}</span>
      </div>
      <div
        ref={contentRef}
        style={{
          overflow: 'hidden',
          transition: 'max-height 0.35s ease',
          maxHeight: defaultOpen ? 'none' : '0px',
        }}
      >
        <div className="info-box-body">{children}</div>
      </div>
    </div>
  );
};

export default CollapsibleBox;
