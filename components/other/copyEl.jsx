'use client';

import { CheckIcon, CopyIcon } from 'lucide-react';
import { useRef, useState } from 'react';

export default function CopyEl({
    contents = '',
    title = 'Copy',
    className = '',
}) {
    const [_copied, _setCopied] = useState(false);
    const timeoutRef = useRef(null);

    const handleCopy = () => {
        if (!contents) return;

        navigator.clipboard.writeText(String(contents)).then(() => {
            _setCopied(true);
            if (timeoutRef.current) {
                clearTimeout(timeoutRef.current);
            }
            timeoutRef.current = setTimeout(() => {
                _setCopied(false);
            }, 1000);
        }).catch(() => {
            _setCopied(false);
        });
    };

    return (
        <button
            type="button"
            onClick={handleCopy}
            title={_copied ? `${title} (copied)` : title}
            disabled={!contents}
            className={`p-2 rounded-md border border-gray-200 bg-gray-100 hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed ${className}`}
        >
            {_copied ? <CheckIcon className="size-4 text-green-600" /> : <CopyIcon className="size-4 text-gray-600" />}
        </button>
    );
}
