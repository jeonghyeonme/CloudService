const { HEADERS } = require("../utils/response");
const { createUploadUrl } = require("./uploadPolicy");

exports.handler = async (event) => {
  try {
    const { fileName, fileType } = event.queryStringParameters || {};
    const result = await createUploadUrl({ fileName, fileType, keyPrefix: "uploads" });

    if (result.error) {
      return {
        statusCode: result.error.statusCode,
        headers: HEADERS,
        body: JSON.stringify(result.error.payload),
      };
    }

    return {
      statusCode: 200,
      headers: HEADERS,
      body: JSON.stringify({
        message: "Upload URL issued successfully.",
        uploadUrl: result.uploadUrl,
        fileUrl: result.fileUrl,
        s3ObjectKey: result.s3ObjectKey,
      }),
    };
  } catch (error) {
    console.error("S3 URL issue error:", error);
    return {
      statusCode: 500,
      headers: HEADERS,
      body: JSON.stringify({ message: "Failed to issue upload URL.", error: error.message }),
    };
  }
};
