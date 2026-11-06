import "dotenv/config";
// Unit tests never touch real providers or the network.
process.env.OPENAI_API_KEY = "";
process.env.GEMINI_API_KEY = "";
process.env.BLOB_READ_WRITE_TOKEN = "";
process.env.BETTER_AUTH_SECRET ??= "test-secret-test-secret-test-secret";
process.env.IMAGEFORGE_STORAGE_DIR = ".data/test-blobs";
if (process.env.TEST_DATABASE_URL) process.env.DATABASE_URL = process.env.TEST_DATABASE_URL;
