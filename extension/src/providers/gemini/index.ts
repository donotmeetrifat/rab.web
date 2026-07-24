import { PlaceholderAdapter } from "../base/PlaceholderAdapter";
export class GeminiAdapter extends PlaceholderAdapter {
  constructor() { super("gemini", "Gemini", /(^|\.)gemini\.google\.com$/i); }
}
