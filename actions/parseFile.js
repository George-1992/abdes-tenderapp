'use server';
const STIRLING_URL = process.env.STIRLING_URL || 'http://localhost:8080';
const STIRLING_API_KEY = process.env.STIRLING_API_KEY || '';


export default async function parseFile(_file) {
    let resObj = {
        success: false,
        message: '',
        data: null,
    }
    try {

        let file = _file;
        if (typeof _file === 'string') {
            const inputUrl = _file.trim();
            if (!inputUrl) {
                resObj.success = false;
                resObj.message = 'No URL provided for parsing';
                return resObj;
            }

            let parsedUrl;
            try {
                parsedUrl = new URL(inputUrl);
            } catch (_error) {
                resObj.success = false;
                resObj.message = 'Invalid URL provided for parsing';
                return resObj;
            }

            const fileResponse = await fetch(parsedUrl.toString());
            if (!fileResponse.ok) {
                resObj.success = false;
                resObj.message = `Failed to fetch file from URL: ${fileResponse.statusText}`;
                return resObj;
            }

            const remoteBuffer = await fileResponse.arrayBuffer();
            const remoteType = fileResponse.headers.get('content-type') || '';
            const remotePathName = parsedUrl.pathname || '';
            const fallbackName = remotePathName.split('/').filter(Boolean).pop() || 'remote-file';

            file = {
                name: decodeURIComponent(fallbackName),
                type: remoteType,
                arrayBuffer: async () => remoteBuffer,
            };
        }

        if (!file) {
            resObj.success = false;
            resObj.message = 'No file provided for parsing';
            return resObj;
        }

        const fileType = file.type || '';


        // console.log('STIRLING_URL:', STIRLING_URL);
        // console.log('STIRLING_API_KEY:', STIRLING_API_KEY);

        // Create FormData with the file (field name must be "fileInput" per docs)
        const formData = new FormData();

        // Convert to Blob with filename
        const buffer = await file.arrayBuffer();
        const blob = new Blob([buffer], { type: file.type });
        formData.append('fileInput', blob, file.name);
        formData.append('outputFormat', 'txt');
        console.log('Parsing file of type:', fileType);

        // if its not a PDF then convert to PDF first
        if (fileType !== 'application/pdf') {
            console.log('Converting non-PDF file to PDF before parsing');
            const thisPDF = await fetch(`${STIRLING_URL}/api/v1/convert/file/pdf`, {
                method: 'POST',
                headers: {
                    'X-API-KEY': STIRLING_API_KEY,
                    // DO NOT set Content-Type - fetch will add it with boundary
                },
                body: formData,
            });
            // console.log('DOC to PDF response status:', thisPDF);
            if (!thisPDF.ok) {
                resObj.success = false;
                resObj.message = `Failed to convert DOC to PDF: ${thisPDF.statusText}`;
                return resObj;
            }

            const pdfBuffer = await thisPDF.arrayBuffer();
            // Create new FormData with PDF file
            formData.delete('fileInput');
            const pdfBlob = new Blob([pdfBuffer], { type: 'application/pdf' });
            formData.append('fileInput', pdfBlob, file.name.replace(/\.docx?$/i, '.pdf'));
            // formData.append('outputFormat', 'txt');
        }  
        // resObj.message = 'manual return';
        // return resObj;

        const endpoint = `${STIRLING_URL}/api/v1/convert/pdf/text`;
        const response = await fetch(endpoint, {
            method: 'POST',
            headers: {
                'X-API-KEY': STIRLING_API_KEY,
                // DO NOT set Content-Type - fetch will add it with boundary
            },
            body: formData,
        });

        if (!response.ok) {
            throw new Error(`Failed to parse file: ${response.statusText}`);
        }

        // Stirling returns text file, not JSON
        const text = await response.text();
        resObj.success = true;
        resObj.data = text;
        return resObj;

    } catch (error) {
        console.error('Error parsing file:', error);
        resObj.success = false;
        resObj.message = error.message || 'An error occurred while parsing the file';
        return resObj;
    }
}