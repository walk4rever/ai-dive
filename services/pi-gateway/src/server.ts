import express from "express";
import { requireSecret } from "./auth.js";
import { getSession, getExistingSession } from "./session-manager.js";
import { streamPrompt } from "./stream.js";
import { validateImageAttachments } from "./image-attachment.js";
import { validateHistory } from "./history.js";

const PORT = Number(process.env.PORT ?? 3458);
const app = express();
app.use(express.json({ limit: "10mb" }));

app.get("/health", (_req, res) => {
  res.json({ ok: true });
});

app.post("/chat", requireSecret, async (req, res) => {
  const { message, userId, articleSlug, images: rawImages, history: rawHistory } = req.body as {
    message?: string;
    userId?: string;
    articleSlug?: string;
    images?: unknown;
    history?: unknown;
  };

  if (!message || typeof message !== "string" || message.trim() === "") {
    res.status(400).json({ error: "message is required" });
    return;
  }

  let images;
  try {
    images = validateImageAttachments(rawImages);
  } catch (err) {
    res.status(400).json({ error: err instanceof Error ? err.message : "invalid images" });
    return;
  }

  let history;
  try {
    history = validateHistory(rawHistory);
  } catch (err) {
    res.status(400).json({ error: err instanceof Error ? err.message : "invalid history" });
    return;
  }

  let session;
  try {
    session = await getSession(
      userId,
      typeof articleSlug === "string" && articleSlug ? articleSlug : undefined,
      history,
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: `Failed to create session: ${msg}` });
    return;
  }

  if (session.isStreaming) {
    res.status(409).json({ error: "Session is busy" });
    return;
  }

  // `req`'s close event tracks the request body's readable side, which Express's
  // json() middleware already drains before this handler runs — it never fires
  // again just because the client walks away mid-response. `res`'s close event is
  // what actually reflects the underlying socket being torn down (client abort),
  // so it's the one that needs to trigger cancelling the in-flight generation.
  res.on("close", () => {
    if (session.isStreaming) session.abort();
  });

  await streamPrompt(session, message.trim(), res, images);
});

// Explicit cancel, independent of connection-close detection: on platforms where the
// Next.js route forwarding /chat runs as a serverless function (Vercel's Node.js
// runtime), a client disconnect never reaches this process at all — the function just
// keeps running the request to completion in the background regardless of `res`'s
// close event above. The client hits this endpoint directly instead of relying on that.
// Awaits the abort rather than firing it off: abort() only resolves once the
// generation has actually unwound and isStreaming is back to false. Responding
// before that lets a client that immediately sends its next message reach /chat
// while the session still looks busy, which is exactly the 409 this endpoint exists
// to prevent.
app.post("/cancel", requireSecret, async (req, res) => {
  const { userId, articleSlug } = req.body as { userId?: string; articleSlug?: string };
  const session = getExistingSession(userId, typeof articleSlug === "string" && articleSlug ? articleSlug : undefined);
  if (session?.isStreaming) await session.abort();
  res.json({ ok: true, streaming: session?.isStreaming ?? false });
});

app.listen(PORT, () => {
  console.log(`pi-gateway-ai-dive listening on :${PORT}`);
});
