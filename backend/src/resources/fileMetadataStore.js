const { GetCommand, UpdateCommand } = require("@aws-sdk/lib-dynamodb");
const { S3Client, HeadObjectCommand } = require("@aws-sdk/client-s3");
const { v4: uuidv4 } = require("uuid");

const dynamoDb = require("../dynamodbClient");

const SERVERS_TABLE = process.env.SERVERS_TABLE;
const RESOURCES_BUCKET = process.env.RESOURCES_BUCKET;
const s3Client = new S3Client({ region: process.env.REGION || "us-east-1" });

function createStatusError(statusCode, message) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

async function assertS3ObjectExists(s3ObjectKey) {
  if (!s3ObjectKey) return;

  try {
    await s3Client.send(new HeadObjectCommand({
      Bucket: RESOURCES_BUCKET,
      Key: s3ObjectKey,
    }));
  } catch (error) {
    throw createStatusError(
      400,
      "S3 object does not exist or the upload has not completed.",
    );
  }
}

function findExistingFile(files, { fileId, s3ObjectKey, fileUrl }) {
  if (fileId) {
    const byFileId = files.find((file) => file.fileId === fileId);
    if (byFileId) return byFileId;
  }

  if (s3ObjectKey) {
    const byObjectKey = files.find((file) => file.s3ObjectKey === s3ObjectKey);
    if (byObjectKey) return byObjectKey;
  }

  if (fileUrl) {
    return files.find((file) => file.fileUrl === fileUrl);
  }

  return null;
}

async function saveServerFileMetadata({
  serverId,
  fileId,
  fileName,
  fileUrl,
  fileType,
  s3ObjectKey,
  uploadedBy,
  uploadedAt,
}) {
  if (!serverId || !fileName || !fileUrl) {
    throw createStatusError(400, "serverId, fileName and fileUrl are required.");
  }

  const serverResult = await dynamoDb.send(new GetCommand({
    TableName: SERVERS_TABLE,
    Key: { serverId },
  }));

  const serverData = serverResult.Item;
  if (!serverData) {
    throw createStatusError(404, "Server not found.");
  }

  const files = Array.isArray(serverData.files) ? serverData.files : [];
  const existingFile = findExistingFile(files, { fileId, s3ObjectKey, fileUrl });
  if (existingFile) {
    return { file: existingFile, created: false };
  }

  await assertS3ObjectExists(s3ObjectKey);

  const fileItem = {
    fileId: fileId || uuidv4(),
    fileName,
    fileUrl,
    fileType: fileType || "unknown",
    s3ObjectKey: s3ObjectKey || "",
    uploadedBy: uploadedBy || "unknown",
    uploadedAt: uploadedAt || new Date().toISOString(),
  };

  await dynamoDb.send(new UpdateCommand({
    TableName: SERVERS_TABLE,
    Key: { serverId },
    UpdateExpression: "SET #files = list_append(if_not_exists(#files, :empty), :newFile)",
    ExpressionAttributeNames: { "#files": "files" },
    ExpressionAttributeValues: { ":newFile": [fileItem], ":empty": [] },
  }));

  return { file: fileItem, created: true };
}

module.exports = {
  saveServerFileMetadata,
};
