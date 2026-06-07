const { UpdateCommand, GetCommand } = require("@aws-sdk/lib-dynamodb");
const { S3Client, DeleteObjectCommand } = require("@aws-sdk/client-s3");

const dynamoDb = require("../dynamodbClient");
const { verifyAccessToken } = require("../utils");
const { HEADERS } = require("../utils/response");
const { saveServerFileMetadata } = require("./fileMetadataStore");

const SERVERS_TABLE = process.env.SERVERS_TABLE;
const RESOURCES_BUCKET = process.env.RESOURCES_BUCKET;
const s3Client = new S3Client({ region: process.env.REGION || "us-east-1" });

exports.handler = async (event) => {
  try {
    const auth = verifyAccessToken(event.headers?.Authorization || event.headers?.authorization);
    if (auth.error) {
      return {
        statusCode: 401,
        headers: HEADERS,
        body: JSON.stringify({ message: auth.error }),
      };
    }

    const { serverId } = event.pathParameters || {};
    const body = JSON.parse(event.body || "{}");

    if (body.action === "delete") {
      const { fileId } = body;
      const getResult = await dynamoDb.send(new GetCommand({
        TableName: SERVERS_TABLE,
        Key: { serverId },
      }));

      const serverData = getResult.Item;
      if (!serverData) {
        return {
          statusCode: 404,
          headers: HEADERS,
          body: JSON.stringify({ message: "Server not found." }),
        };
      }

      const files = serverData.files || [];
      const targetFile = files.find((file) => file.fileId === fileId);
      if (!targetFile) {
        return {
          statusCode: 404,
          headers: HEADERS,
          body: JSON.stringify({ message: "File not found." }),
        };
      }

      if (targetFile.uploadedBy !== auth.userId && serverData.hostId !== auth.userId) {
        return {
          statusCode: 403,
          headers: HEADERS,
          body: JSON.stringify({ message: "Forbidden." }),
        };
      }

      if (targetFile.s3ObjectKey) {
        try {
          await s3Client.send(new DeleteObjectCommand({
            Bucket: RESOURCES_BUCKET,
            Key: targetFile.s3ObjectKey,
          }));
        } catch (error) {
          console.warn("S3 file delete failed:", error);
        }
      }

      const updatedFiles = files.filter((file) => file.fileId !== fileId);
      await dynamoDb.send(new UpdateCommand({
        TableName: SERVERS_TABLE,
        Key: { serverId },
        UpdateExpression: "SET #files = :updatedFiles",
        ExpressionAttributeNames: { "#files": "files" },
        ExpressionAttributeValues: { ":updatedFiles": updatedFiles },
      }));

      return {
        statusCode: 200,
        headers: HEADERS,
        body: JSON.stringify({ message: "File deleted.", fileId }),
      };
    }

    const { fileName, fileUrl, fileType, s3ObjectKey } = body;
    if (!serverId || !fileName || !fileUrl) {
      return {
        statusCode: 400,
        headers: HEADERS,
        body: JSON.stringify({ message: "serverId, fileName and fileUrl are required." }),
      };
    }

    const { file: fileItem } = await saveServerFileMetadata({
      serverId,
      fileName,
      fileUrl,
      fileType,
      s3ObjectKey,
      uploadedBy: auth.userId,
    });

    return {
      statusCode: 200,
      headers: HEADERS,
      body: JSON.stringify({ message: "Saved.", file: fileItem }),
    };
  } catch (error) {
    return {
      statusCode: error.statusCode || 500,
      headers: HEADERS,
      body: JSON.stringify(
        error.statusCode
          ? { message: error.message }
          : { error: error.message },
      ),
    };
  }
};
