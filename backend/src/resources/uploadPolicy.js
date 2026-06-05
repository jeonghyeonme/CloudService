const { S3Client, PutObjectCommand, HeadObjectCommand, DeleteObjectCommand } = require("@aws-sdk/client-s3");
const { getSignedUrl } = require("@aws-sdk/s3-request-presigner");
const { v4: uuidv4 } = require("uuid");

const ALLOWED_TYPES = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/gif": "gif",
  "image/webp": "webp",
  "image/svg+xml": "svg",
  "image/bmp": "bmp",
  "image/tiff": "tiff",
  "application/pdf": "pdf",
  "application/msword": "doc",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "docx",
  "application/vnd.ms-excel": "xls",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": "xlsx",
  "application/vnd.ms-powerpoint": "ppt",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation": "pptx",
  "application/vnd.hancom.hwp": "hwp",
  "application/haansofthwp": "hwp",
  "application/x-hwp": "hwp",
  "text/plain": "txt",
  "text/csv": "csv",
  "text/html": "html",
  "text/markdown": "md",
  "application/json": "json",
  "application/xml": "xml",
  "text/xml": "xml",
  "application/zip": "zip",
  "application/x-zip-compressed": "zip",
  "application/gzip": "gz",
  "application/x-tar": "tar",
  "application/x-7z-compressed": "7z",
  "application/x-rar-compressed": "rar",
  "application/octet-stream": "*",
};

const ALLOWED_EXTENSIONS = [
  "jpg", "jpeg", "png", "gif", "webp", "svg", "bmp", "tiff", "ico",
  "pdf", "doc", "docx", "xls", "xlsx", "ppt", "pptx", "hwp", "hwpx",
  "txt", "csv", "html", "css", "js", "ts", "jsx", "tsx", "md",
  "json", "xml", "yml", "yaml", "py", "java", "c", "cpp", "h",
  "sql", "sh", "bat", "log", "ini", "cfg", "env",
  "zip", "gz", "tar", "7z", "rar",
];

const IMAGE_EXTENSIONS = ["jpg", "jpeg", "png", "gif", "webp", "svg", "bmp", "tiff", "ico"];
const MAX_FILE_SIZE_MB = 10;

function getRegion() {
  return process.env.REGION || process.env.AWS_REGION || "us-east-1";
}

function getBucketName() {
  return process.env.RESOURCES_BUCKET;
}

function getS3Client() {
  return new S3Client({ region: getRegion() });
}

function getFileExtension(fileName) {
  const parts = String(fileName || "").split(".");
  return parts.length > 1 ? parts.pop().toLowerCase() : "";
}

function isImageType(fileType, fileExtension) {
  return String(fileType || "").startsWith("image/") && IMAGE_EXTENSIONS.includes(fileExtension);
}

function getFileUrl(s3ObjectKey) {
  const bucketName = getBucketName();
  return `https://${bucketName}.s3.${getRegion()}.amazonaws.com/${s3ObjectKey}`;
}

function validateUploadRequest({ fileName, fileType, imageOnly = false }) {
  if (!fileName || !fileType) {
    return {
      statusCode: 400,
      payload: { message: "fileName and fileType query parameters are required." },
    };
  }

  const fileExtension = getFileExtension(fileName);
  if (!ALLOWED_EXTENSIONS.includes(fileExtension)) {
    return {
      statusCode: 400,
      payload: {
        message: `Unsupported file extension: .${fileExtension}`,
        allowedExtensions: imageOnly ? IMAGE_EXTENSIONS : ALLOWED_EXTENSIONS,
      },
    };
  }

  if (!ALLOWED_TYPES[fileType]) {
    return {
      statusCode: 400,
      payload: { message: `Unsupported file type: ${fileType}` },
    };
  }

  if (imageOnly && !isImageType(fileType, fileExtension)) {
    return {
      statusCode: 400,
      payload: {
        message: "Only image files are allowed.",
        allowedExtensions: IMAGE_EXTENSIONS,
      },
    };
  }

  return null;
}

async function createUploadUrl({ fileName, fileType, imageOnly = false, keyPrefix = "uploads" }) {
  const validationError = validateUploadRequest({ fileName, fileType, imageOnly });
  if (validationError) return { error: validationError };

  const bucketName = getBucketName();
  if (!bucketName) {
    return {
      error: {
        statusCode: 500,
        payload: { message: "RESOURCES_BUCKET is not configured." },
      },
    };
  }

  const fileExtension = getFileExtension(fileName);
  const uniqueId = uuidv4();
  const s3ObjectKey = `${keyPrefix}/${uniqueId}.${fileExtension}`;

  const command = new PutObjectCommand({
    Bucket: bucketName,
    Key: s3ObjectKey,
    ContentType: fileType,
  });

  const uploadUrl = await getSignedUrl(getS3Client(), command, { expiresIn: 300 });

  return {
    uploadUrl,
    fileUrl: getFileUrl(s3ObjectKey),
    s3ObjectKey,
  };
}

async function assertObjectExists(s3ObjectKey) {
  await getS3Client().send(new HeadObjectCommand({
    Bucket: getBucketName(),
    Key: s3ObjectKey,
  }));
}

async function deleteObjectIfExists(s3ObjectKey) {
  if (!s3ObjectKey) return;
  await getS3Client().send(new DeleteObjectCommand({
    Bucket: getBucketName(),
    Key: s3ObjectKey,
  }));
}

module.exports = {
  ALLOWED_TYPES,
  ALLOWED_EXTENSIONS,
  IMAGE_EXTENSIONS,
  MAX_FILE_SIZE_MB,
  createUploadUrl,
  assertObjectExists,
  deleteObjectIfExists,
  getFileExtension,
  getFileUrl,
  isImageType,
};
