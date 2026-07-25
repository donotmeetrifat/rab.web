# Permissions Explained

Memlace requests only what it needs. Every permission is listed here with a plain-language reason.

| Permission | Why Memlace needs it |
|---|---|
| `storage` | Store your memories, conversations, projects, and settings locally. |
| `tabs` | Read the URL and title of the active tab so a captured note knows where it came from, and open a new tab when you use "Continue in another AI". |
| `activeTab` | Read the current page's selection when you press **Alt+Shift+S**. |
| `scripting` | Inject the "Save to Memlace" button into supported AI chat pages. |
| `contextMenus` | Add the right-click "Save selection to Memlace" menu item. |
| `sidePanel` | Open the Memlace workspace in Chrome's side panel. |
| `notifications` | Show a system notification after a successful save (opt-out in Settings). |
| `clipboardWrite` | Copy the optimized context to your clipboard when you use "Continue in another AI". |

## Host permissions
Memlace only runs on the AI chat sites it explicitly supports:
`chat.openai.com`, `chatgpt.com`, `claude.ai`, `gemini.google.com`, `aistudio.google.com`, `perplexity.ai`, `www.perplexity.ai`, `copilot.microsoft.com`, `chat.deepseek.com`.

Memlace **does not** request `<all_urls>` and does not run on any other website.
