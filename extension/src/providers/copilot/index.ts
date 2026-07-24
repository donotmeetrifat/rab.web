import { PlaceholderAdapter } from "../base/PlaceholderAdapter";
export class CopilotAdapter extends PlaceholderAdapter {
  constructor() { super("copilot", "Copilot", /(^|\.)copilot\.microsoft\.com$/i); }
}
