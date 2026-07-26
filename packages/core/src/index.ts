/**
 * @memlace/core — public surface (Phase 14).
 *
 * Pure TypeScript. Zero browser, zero chrome.*, zero Node built-ins.
 * Every engine listed here is imported by the Chrome extension today
 * and will be imported unchanged by future Desktop / VS Code / Mobile
 * clients through a platform adapter (see ./adapters).
 *
 * The concrete engine implementations live in the extension while the
 * extraction proceeds; this package publishes the *contracts* that
 * every client must honour and the platform-agnostic utilities that
 * do not depend on storage.
 */

export * as adapters from "./adapters";
export * as providerSDK from "./provider-sdk";
export * as portable from "./portable";
export * as plugins from "./plugins";
export * as localApi from "./local-api";

export const CORE_VERSION = "0.1.0";
