import { PlaceholderAdapter } from "../base/PlaceholderAdapter";
export class PerplexityAdapter extends PlaceholderAdapter {
  constructor() { super("perplexity", "Perplexity", /(^|\.)perplexity\.ai$/i); }
}
