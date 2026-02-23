'use server';

// import parseFile from "@/services/parseFile";
import { s3Upload } from "@/services/s3";
import { getRandomString } from "@/utils/other";

const N8N_WEBHOOK_URL = process.env.N8N_WEBHOOK_URL;
const APP_API_URL = process.env.APP_API_URL;

export const uploadFile = async (formData) => {
    let resObj = {
        success: false,
        message: '',
        data: null,
    }

    try {
        // Extract data from FormData
        const file = formData.get('file');
        if (!file || typeof file.arrayBuffer !== 'function') {
            resObj.success = false;
            resObj.message = 'Invalid file payload';
            return resObj;
        }


        // first upload resume to s3
        const randomStr = getRandomString(8);
        const fileName = `file-${Date.now()}-${randomStr}.${file.name.split('.').pop()}`;
        const uploadRes = await s3Upload({
            fileName: fileName,
            fileBuffer: await file.arrayBuffer(),
            mimeType: file.type,
        })
        console.log('uploadRes:', uploadRes);
        if (!uploadRes.success) {
            resObj.success = false;
            resObj.message = 'Failed to upload file to storage service';
            return resObj;
        }

        // then parse the file
        // const fileResult = await parseFile(file);
        // console.log('fileResult:', fileResult);

        // if (!fileResult.success) {
        //     resObj.success = false;
        //     resObj.message = 'Failed processing file: please try uploading a different type of file. (eg PDF) ' + fileResult.message;
        //     return resObj;
        // }

        resObj.success = true;
        resObj.message = 'File uploaded successfully';
        resObj.data = {
            key: uploadRes.key,
            fileName,
            originalName: file.name,
            mimeType: file.type,
            size: file.size,
            bucket: process.env.S3_BUCKET_NAME || 'resumes',
        };
        return resObj;

    } catch (error) {
        console.error('Error submitting form:', error);
        resObj.success = false;
        resObj.message = error.message || 'An error occurred while submitting the form';
        return resObj;
    }
}