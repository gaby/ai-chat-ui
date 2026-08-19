# Add the ability to delete past chats

## Feature Description

The side panel lists previous chats. Each chat's menu includes a Delete action. The action opens a confirmation dialog with Cancel and Delete controls. Confirming removes the chat and its messages; cancelling closes the dialog without changing the chat.

## Implementation Details

- Store conversations and messages in IndexedDB through `src/lib/chat-db.ts`.
- Delete the conversation and messages in one transaction.
- Prevent concurrent saves in other tabs from recreating deleted messages.
- Use shadcn/lucide for the UI. The button should be visible only on hover.
