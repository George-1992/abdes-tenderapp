"use client";
import React, { useRef, useState, useEffect } from 'react';
import cn from 'clsx';
import { LoaderCircleIcon, XIcon } from 'lucide-react';
import { uploadFile } from '@/actions/file';

export default function FileUploader({
    name,
    accept,
    multiple = false,
    disabled = false,
    required = false,
    showFiles = true,
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
    const [uploadingFileKeys, setUploadingFileKeys] = useState([]);

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

    const getFileLocalKey = (file) => {
        if (!file || typeof file === 'string') return String(file || '');
        return `${file.name}-${file.size}-${file.lastModified}`;
    };

    const isFileUploading = (file) => {
        if (!file || typeof file === 'string') return false;
        return uploadingFileKeys.includes(getFileLocalKey(file));
    };

    const uploadFilesToS3 = async (filesToUpload) => {
        try {
            setIsUploading(true);
            setUploadingFileKeys(filesToUpload.map(getFileLocalKey));

            const uploadResults = [];
            for (const file of filesToUpload) {
                const fileKey = getFileLocalKey(file);
                try {
                    const formData = new FormData();
                    formData.append('file', file);
                    const result = await uploadFile(formData);
                    uploadResults.push(result);
                } finally {
                    setUploadingFileKeys((prev) => prev.filter((k) => k !== fileKey));
                }
            }

            const failed = uploadResults.find((r) => !r?.success);
            if (failed) {
                return {
                    success: false,
                    message: failed.message || 'Failed uploading one or more files to S3',
                    keys: []
                };
            }

            return {
                success: true,
                message: 'Done',
                keys: uploadResults.map((r) => r?.data?.key).filter(Boolean)
            };
        } catch (error) {
            return {
                success: false,
                message: error?.message || 'Failed uploading files to S3',
                keys: []
            };
        } finally {
            setIsUploading(false);
            setUploadingFileKeys([]);
        }
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
                    const result = await uploadFilesToS3(accepted);
                    if (!result.success) {
                        const uploadErr = result.message;
                        setErrorMessage(uploadErr);
                        try { onError(uploadErr); } catch (err) { }
                        try { onFiles(multiple ? [] : null); } catch (err) { }
                        return;
                    }
                    try { onFiles(multiple ? result.keys : (result.keys[0] || null)); } catch (err) { }
                    return;
                }

                try { onFiles(multiple ? accepted : (accepted[0] || null)); } catch (err) { }
                return;
            }
        }

        setErrorMessage('');
        setSelected(files);

        if (uploadToS3 && files.length > 0) {
            const result = await uploadFilesToS3(files);
            if (!result.success) {
                const uploadErr = result.message;
                setErrorMessage(uploadErr);
                try { onError(uploadErr); } catch (err) { }
                try { onFiles(multiple ? [] : null); } catch (err) { }
                return;
            }
            try { onFiles(multiple ? result.keys : (result.keys[0] || null)); } catch (err) { }
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
            {showFiles && selected && selected.length > 0 && (
                <div className="my-2 text-sm text-gray-600 space-y-2">
                    {selected.map((f, i) => (
                        <div key={i} className="flex items-center justify-between bg-neutral-700/10 p-2 rounded border border-neutral-100">
                            <div className="truncate mr-3">
                                <div className="font-medium">{typeof f === 'string' ? f : f.name}</div>
                                <div className="text-xs text-gray-500 flex items-center gap-2">
                                    <span>{typeof f === 'string' ? '' : humanFileSize(f.size)}</span>
                                    {isFileUploading(f) && (
                                        <span className="inline-flex items-center gap-1 text-[var(--primary)]">
                                            <LoaderCircleIcon className="size-3 animate-spin" />
                                            Uploading...
                                        </span>
                                    )}
                                </div>
                            </div>
                            <div>
                                <button type="button" disabled={isUploading} onClick={() => removeFile(i)} className="text-xs text-red-400 hover:text-red-300 disabled:opacity-40 disabled:cursor-not-allowed">
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
                onClick={() => !disabled && !isUploading && inputRef.current && inputRef.current.click()}
                onKeyDown={(e) => { if ((e.key === 'Enter' || e.key === ' ') && !isUploading && inputRef.current) inputRef.current.click(); }}
                className={cn(
                    'relative w-full h-32 flex flex-col items-center justify-center rounded-lg border-dashed border-2 px-4',
                    disabled ? 'opacity-55' : 'bg-gray-100 border-gray-300 hover:border-[var(--primary)] hover:text-[var(--primary)] duration-200',
                    'cursor-pointer select-none',
                )}
            >
                {isUploading && (
                    <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-2 rounded-lg bg-white/70 backdrop-blur-[1px]">
                        <LoaderCircleIcon className="size-5 animate-spin text-[var(--primary)]" />
                        <span className="text-xs text-gray-600">Uploading...</span>
                    </div>
                )}
                <div className="text-sm text-gray-400">Click to choose files or press Enter</div>
                <div className="text-xs text-gray-400 mt-1">{multiple ? 'Multiple allowed' : 'Single file'}</div>
                <button
                    type="button"
                    disabled={isUploading}
                    onClick={(e) => { e.stopPropagation(); if (!isUploading && inputRef.current) inputRef.current.click(); }}
                    className="btn btn-secondary mt-3 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    Choose file
                </button>
            </div>

            {errorMessage && (
                <div className="mt-3 text-sm text-red-400">{errorMessage}</div>
            )}

        </div>
    );
}