import {
    S3Client, PutObjectCommand, PutObjectCommandInput,
    ListBucketsCommand, ListObjectsV2Command,
    ListObjectsCommand, GetObjectCommand, DeleteObjectsCommand,
    UploadPartCommand,
    CreateMultipartUploadCommand,
    CompleteMultipartUploadCommand,
    HeadBucketCommand,
    ListMultipartUploadsCommand,
    AbortMultipartUploadCommand
} from '@aws-sdk/client-s3';

const S3_ACCESS_KEY_ID = process.env.S3_ACCESS_KEY_ID || '';
const S3_SECRET_ACCESS_KEY = process.env.S3_SECRET_ACCESS_KEY || '';
const S3_ENDPOINT = process.env.S3_ENDPOINT || '';
const S3_BUCKET_NAME = process.env.S3_BUCKET_NAME || 'resumes';

const S3 = new S3Client({
    region: 'auto',
    endpoint: S3_ENDPOINT,
    credentials: {
        accessKeyId: S3_ACCESS_KEY_ID,
        secretAccessKey: S3_SECRET_ACCESS_KEY,
    },
    // requestChecksumCalculation: "WHEN_REQUIRED",
    // responseChecksumValidation: "WHEN_REQUIRED",
    forcePathStyle: true,
    // tls: true,
    // disableHostPrefix: true,
});


export const s3Upload = async ({
    fileName, fileBuffer, mimeType
}) => {
    let resObj = {
        success: false,
        message: '',
        data: null,
    }
    try {
        const params = {
            Bucket: S3_BUCKET_NAME,
            Key: fileName,
            Body: fileBuffer,
            ContentType: mimeType,
        };
        const command = new PutObjectCommand(params);
        const response = await S3.send(command);
        resObj.success = true;
        resObj.message = 'File uploaded successfully';
        resObj.key = fileName;
        resObj.data = response;
        return resObj;
    } catch (error) {
        console.error('Error uploading to S3:', error);
        resObj.success = false;
        resObj.message = error.message || 'An error occurred while uploading to S3';
        return resObj;
    }
};