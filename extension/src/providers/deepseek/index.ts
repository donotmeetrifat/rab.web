import { PlaceholderAdapter } from "../base/PlaceholderAdapter";
export class DeepSeekAdapter extends PlaceholderAdapter {
  constructor() { super("deepseek", "DeepSeek", /(^|\.)chat\.deepseek\.com$/i); }
}
