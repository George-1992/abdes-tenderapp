import { useState } from 'react';
import { ChevronDown } from 'lucide-react';

export default function Collapse({
    title = 'Details',
    defaultOpen = false,
    children,
    className = '',
    headerClassName = '',
    contentClassName = '',
    iconClassName = '',
    onToggle = () => { },
}) {
    const [isOpen, setIsOpen] = useState(defaultOpen);

    const handleToggle = () => {
        const next = !isOpen;
        setIsOpen(next);
        onToggle(next);
    };

    return (
        <div className={`border border-gray-200 rounded-md ${className}`}>
            <button
                type="button"
                onClick={handleToggle}
                className={`w-full flex items-center justify-between px-4 py-3 text-left hover:bg-gray-50 transition-colors ${headerClassName}`}
                aria-expanded={isOpen}
            >
                <span className="text-sm font-medium text-gray-800">{title}</span>
                <ChevronDown
                    className={`w-4 h-4 text-gray-500 transition-transform ${isOpen ? 'rotate-180' : ''} ${iconClassName}`}
                />
            </button>

            {isOpen && (
                <div className={`px-4 pb-4 text-sm text-gray-700 ${contentClassName}`}>
                    {children}
                </div>
            )}
        </div>
    );
}