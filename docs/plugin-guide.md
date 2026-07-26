# Memlace Plugin Guide

## Provider adapters

Each AI provider is a plugin that extends `BaseChatAdapter`
(`extension/src/providers/base/BaseChatAdapter.ts`) and registers
itself in `extension/src/providers/registry.ts`. Adding a new
provider requires **no core changes**.

## Minimum surface

```ts
import { BaseChatAdapter } from "@/providers/base/BaseChatAdapter";
import type { ProviderId } from "@/types";

export class MyAdapter extends BaseChatAdapter {
  id: ProviderId = "myprovider";
  hostPatterns = ["myprovider.com"];
  detectConversation(): boolean { /* … */ return true; }
  capture() { /* return CapturedConversation */ }
}
```

Then:

```ts
// providers/registry.ts
register(new MyAdapter());
```

## Contract

- **No provider code outside `providers/<id>/`**.
- Adapter never imports engines. It emits captured conversations
  through the standard save path; the Orchestrator handles the rest.
- Adapter is responsible for its own DOM selectors and observer
  lifecycle. `BaseChatAdapter` provides teardown.

## Future providers

The seven current adapters (ChatGPT, Claude, Gemini, DeepSeek,
Perplexity, Copilot, AI Studio) all use this contract. Additional
providers plug in by adding a folder + one line in the registry.
