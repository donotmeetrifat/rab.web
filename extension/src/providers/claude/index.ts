import { PlaceholderAdapter } from "../base/PlaceholderAdapter";
export class ClaudeAdapter extends PlaceholderAdapter {
  constructor() { super("claude", "Claude", /(^|\.)claude\.ai$/i); }
}
