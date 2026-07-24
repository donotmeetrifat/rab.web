import { PlaceholderAdapter } from "../base/PlaceholderAdapter";
export class AIStudioAdapter extends PlaceholderAdapter {
  constructor() { super("aistudio", "AI Studio", /(^|\.)aistudio\.google\.com$/i); }
}
