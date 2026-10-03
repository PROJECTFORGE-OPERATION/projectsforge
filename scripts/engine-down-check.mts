/**
 * Verifies the zero-fallback guarantee: when the AI engine is unreachable the
 * client gets a precise 503 AiError — never a silent canned result.
 */
process.env.OLLAMA_HOST = "http://127.0.0.1:9"; // deliberately dead port

const { chatStructured, AiError } = await import("../src/lib/ollama");
const { z } = await import("zod");

try {
  const result = await chatStructured(
    [{ role: "user", content: "Say OK" }],
    z.object({ ok: z.string() }),
  );
  console.log("UNEXPECTED SUCCESS — fallback detected:", JSON.stringify(result));
  process.exit(1);
} catch (error) {
  if (error instanceof AiError) {
    console.log(`PASS -> AiError status=${error.status}`);
    console.log(`message: ${error.message}`);
    process.exit(error.status === 503 ? 0 : 1);
  }
  console.log("FAIL -> wrong error type:", error);
  process.exit(1);
}
