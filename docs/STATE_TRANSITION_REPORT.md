# Memlace Watch-State Transition Audit

## Scope

Trace audited:

`MutationObserver` → `ProviderManager.snapshot()` → `onConversationChanged()` → `saveConversation()` → verification read → `dispatchConversationSaved()` → return to `ProviderManager` → `indexing` → `synced` → `injectIndicator()` → `memlace:watch-state` → DOM pill.

## State ownership

- **Single state owner:** `ProviderManager.watchState`.
- **Single state writer:** `ProviderManager.setWatchState()`.
- **Single event producer:** `ProviderManager.setWatchState()` dispatches `memlace:watch-state` on `window` with a `WatchState` string in `event.detail`.
- **Single renderer listener per active adapter:** `BaseChatAdapter.injectIndicator()` listens on `window` and removes that exact callback in its disposer and `cleanup()`.
- No duplicate indicator state system was found.

## Async exit audit

Once `ProviderManager.snapshot()` enters `saving`, every normal failure path reaches `setWatchState("error")`:

- `onConversationChanged()` rejection or failure outcome is caught by `ProviderManager.snapshot()`.
- The eight-second `Promise.race()` timeout returns a failure outcome, which is thrown and caught.
- `saveConversation()` transaction failures rethrow to `content.onConversationChanged()`, which returns a typed failure outcome.
- Caller verification failures are caught by `content.onConversationChanged()` and become a failure outcome.
- A missing verification row returns success with `verified: false`, which explicitly sets `error`.
- `finally` always releases `savingInFlight`.
- The background notification remains fire-and-forget and is not on the state-critical path.

No async control-flow path was found that can leave the **owner state** at `saving` indefinitely.

## Proven rendering stop

The state owner can reach `synced` while a previously existing pill remains visually at `saving`.

Exact path reproduced with the real `BaseChatAdapter` module:

1. `injectIndicator()` finds an element with the provider's indicator ID already in the host DOM.
2. `BaseChatAdapter.mountIndicator()` exits early at the existing-element guard without assigning that element to `this.indicatorEl`.
3. The `memlace:watch-state` listener is installed and receives `synced` with the correct payload.
4. `BaseChatAdapter.applyIndicatorState()` exits early because `this.indicatorEl` is `null`.
5. The existing DOM pill remains `text="Saving"`, `class="memlace-indicator"`, and `data-state="saving"`.

This proves the conflict is **rendering ownership**, not persistence or state-machine logic. It occurs when a stale/existing indicator node survives while the active adapter instance does not own a reference to it.

## Minimal correction

After proving the failure, `BaseChatAdapter.mountIndicator()` was changed to adopt the one existing indicator node, assign it to `this.indicatorEl`, and immediately apply the owner's current state. It does not add another state owner, event, listener, or DOM pill.

The same reproduction now must finish with `text="Synced"` and `data-state="synced"`.

## State transition report

### Expected

`Watching` → `Extracting` → `Saving` → `Indexing` → `Synced`

### Actual owner state

`Watching` → `Extracting` → `Saving` → `Indexing` → `Synced`

### Actual rendered pill before correction

`Saving` → receives `Indexing` event → renderer exits early → receives `Synced` event → renderer exits early → remains `Saving`

### Actual rendered pill after correction

`Saving` → existing pill adopted → receives `Indexing` → renders `Indexing` → receives `Synced` → renders `Synced`

## Diagnostic output

The instrumentation records each stage to both the console and `window.__memlaceStateTrace`, including:

- stage and function name;
- conversation ID and provider;
- ISO timestamp;
- previous and current watch states;
- exact early-exit, catch, or throw point;
- event target/name/payload;
- current DOM text, expected text, CSS class, and `dataset.state` after rendering.

The reproduced terminal entries are:

1. `memlace:watch-state listener received` with payload `synced`.
2. `EARLY EXIT: indicatorEl is null` in `BaseChatAdapter.applyIndicatorState()`.
3. DOM evidence: expected `Synced`; actual text `Saving`; actual `data-state="saving"`.