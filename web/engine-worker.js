// Runs the model for web/chat.html in a background thread, so the page stays
// smooth while a model downloads, loads onto the graphics chip and answers.
// The engine version must match the one chat.html asks for (see models.json).
import { WebWorkerMLCEngineHandler } from 'https://cdn.jsdelivr.net/npm/@mlc-ai/web-llm@0.2.85/+esm';

const handler = new WebWorkerMLCEngineHandler();
self.onmessage = msg => handler.onmessage(msg);
