"use client";
import React, { useRef, useState, useEffect } from 'react';
import cn from 'clsx';
import { XIcon } from 'lucide-react';
import { uploadFile } from '@/actions/file';

export default function FileUploader({
    name,
    accept,
    multiple = false,
    disabled = false,
    required = false,
    className = '',
    value = null,
    onFiles = () => { },
    maxSize /* bytes, optional */,
    onError = () => { },
    uploadToS3 = false, // if true, will upload files to s3 and return the file keys instead of File objects
}) {
    const inputRef = useRef(null);
    const [selected, setSelected] = useState(() => {
        if (!value) return [];
        return Array.isArray(value) ? value : [value];
    });
    const [errorMessage, setErrorMessage] = useState('');
    const [isUploading, setIsUploading] = useState(false);

    useEffect(() => {
        if (!value) {
            setSelected([]);
            return;
        }
        setSelected(Array.isArray(value) ? value : [value]);
    }, [value]);

    const humanFileSize = (size) => {
        if (!size && size !== 0) return '';
        const i = size === 0 ? 0 : Math.floor(Math.log(size) / Math.log(1024));
        return (size / Math.pow(1024, i)).toFixed(2) * 1 + ' ' + ['B', 'KB', 'MB', 'GB', 'TB'][i];
    };

    const handleChange = async (e) => {
        const files = e.target.files ? Array.from(e.target.files) : [];

        if (maxSize) {
            const tooLarge = files.filter((f) => f.size > maxSize);
            if (tooLarge.length > 0) {
                const msg = `One or more files exceed the max size of ${humanFileSize(maxSize)}`;
                setErrorMessage(msg);
                try { onError(msg); } catch (err) { }
                const accepted = files.filter((f) => f.size <= maxSize);
                setSelected(accepted);

                if (uploadToS3 && accepted.length > 0) {
                    try {
                        setIsUploading(true);
                        const uploadResults = [];
                        for (const file of accepted) {
                            const formData = new FormData();
                            formData.append('file', file);
                            const result = await uploadFile(formData);
                            uploadResults.push(result);
                        }

                        const failed = uploadResults.find((r) => !r?.success);
                        if (failed) {
                            const uploadErr = failed.message || 'Failed uploading one or more files to S3';
                            setErrorMessage(uploadErr);
                            try { onError(uploadErr); } catch (err) { }
                            try { onFiles(multiple ? [] : null); } catch (err) { }
                            return;
                        }

                        const keys = uploadResults.map((r) => r?.data?.key).filter(Boolean);
                        try { onFiles(multiple ? keys : (keys[0] || null)); } catch (err) { }
                    } catch (error) {
                        const uploadErr = error?.message || 'Failed uploading files to S3';
                        setErrorMessage(uploadErr);
                        try { onError(uploadErr); } catch (err) { }
                        try { onFiles(multiple ? [] : null); } catch (err) { }
                    } finally {
                        setIsUploading(false);
                    }
                    return;
                }

                try { onFiles(multiple ? accepted : (accepted[0] || null)); } catch (err) { }
                return;
            }
        }

        setErrorMessage('');
        setSelected(files);

        if (uploadToS3 && files.length > 0) {
            try {
                setIsUploading(true);
                const uploadResults = [];
                for (const file of files) {
                    const formData = new FormData();
                    formData.append('file', file);
                    const result = await uploadFile(formData);
                    uploadResults.push(result);
                }

                const failed = uploadResults.find((r) => !r?.success);
                if (failed) {
                    const uploadErr = failed.message || 'Failed uploading one or more files to S3';
                    setErrorMessage(uploadErr);
                    try { onError(uploadErr); } catch (err) { }
                    try { onFiles(multiple ? [] : null); } catch (err) { }
                    return;
                }

                const keys = uploadResults.map((r) => r?.data?.key).filter(Boolean);
                try { onFiles(multiple ? keys : (keys[0] || null)); } catch (err) { }
            } catch (error) {
                const uploadErr = error?.message || 'Failed uploading files to S3';
                setErrorMessage(uploadErr);
                try { onError(uploadErr); } catch (err) { }
                try { onFiles(multiple ? [] : null); } catch (err) { }
            } finally {
                setIsUploading(false);
            }
            return;
        }

        try { onFiles(multiple ? files : (files[0] || null)); } catch (err) { }
    };

    const removeFile = (index) => {
        const next = selected.slice();
        next.splice(index, 1);
        setSelected(next);
        try { onFiles(multiple ? next : (next[0] || null)); } catch (err) { }
    };

    return (
        <div className={cn('file-uploader', className)}>
            <input
                ref={inputRef}
                name={name}
                type="file"
                accept={accept}
                multiple={multiple}
                disabled={disabled}
                required={required}
                onChange={handleChange}
                className="sr-only"
                aria-hidden={false}
            />
            {selected && selected.length > 0 && (
                <div className="my-2 text-sm text-gray-600 space-y-2">
                    {selected.map((f, i) => (
                        <div key={i} className="flex items-center justify-between bg-neutral-700/10 p-2 rounded border border-neutral-100">
                            <div className="truncate mr-3">
                                <div className="font-medium">{typeof f === 'string' ? f : f.name}</div>
                                <div className="text-xs text-gray-500">{typeof f === 'string' ? '' : humanFileSize(f.size)}</div>
                            </div>
                            <div>
                                <button type="button" onClick={() => removeFile(i)} className="text-xs text-red-400 hover:text-red-300">
                                    <XIcon className='size-5' />
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            <div
                role="button"
                tabIndex={0}
                onClick={() => !disabled && inputRef.current && inputRef.current.click()}
                onKeyDown={(e) => { if ((e.key === 'Enter' || e.key === ' ') && inputRef.current) inputRef.current.click(); }}
                className={cn(
                    'w-full h-32 flex flex-col items-center justify-center rounded-lg border-dashed border-2 px-4',
                    disabled ? 'opacity-55' : 'bg-gray-100 border-gray-300 text-gray-700 hover:border-indigo-400 duration-200',
                    'cursor-pointer select-none',
                )}
            >
                <div className="text-sm text-gray-400">Click to choose files or press Enter</div>
                <div className="text-xs text-gray-400 mt-1">{multiple ? 'Multiple allowed' : 'Single file'}</div>
                <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); if (inputRef.current) inputRef.current.click(); }}
                    className="btn btn-secondary mt-3"
                >
                    Choose file
                </button>
            </div>

            {errorMessage && (
                <div className="mt-3 text-sm text-red-400">{errorMessage}</div>
            )}

            {isUploading && (
                <div className="mt-3 text-sm text-gray-500">Uploading to S3...</div>
            )}


        </div>
    );
}