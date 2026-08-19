import type { ConversationEntry } from '@/types'
import type { UIMessage } from 'ai'
import { toast } from 'sonner'

const DB_NAME = 'chat-storage'
const DB_VERSION = 1
const CONVERSATIONS_STORE = 'conversations'
const MESSAGES_STORE = 'messages'

let dbPromise: Promise<IDBDatabase> | null = null
let migrationPromise: Promise<boolean> | null = null

/**
 * Notify every reader that the conversation store changed.
 *
 * Emitted from the store's own writes rather than left to callers: the sidebar,
 * the header title and the tab title all refresh off this event, and a writer
 * that forgot to dispatch left them stale until reload.
 */
function notifyConversationsChanged(): void {
  window.dispatchEvent(new Event('conversations-changed'))
}

function openDatabase(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise

  const opening = new Promise<IDBDatabase>((resolve, reject) => {
    // `indexedDB.open` throws rather than rejecting when the connection cannot
    // be requested at all (storage disabled, a browser-closed connection), and
    // the throw lands here as a rejection.
    const request = window.indexedDB.open(DB_NAME, DB_VERSION)

    request.onerror = () => {
      reject(new Error(request.error?.message ?? 'Failed to open database'))
    }
    request.onsuccess = () => {
      const db = request.result
      db.onclose = () => {
        dbPromise = null
      }
      resolve(db)
    }

    request.onupgradeneeded = () => {
      const db = request.result

      if (!db.objectStoreNames.contains(CONVERSATIONS_STORE)) {
        db.createObjectStore(CONVERSATIONS_STORE, { keyPath: 'id' })
      }

      if (!db.objectStoreNames.contains(MESSAGES_STORE)) {
        db.createObjectStore(MESSAGES_STORE, { keyPath: 'id' })
      }
    }
  })

  dbPromise = opening
  // A failure is never cached, or every later caller — including the retry the
  // reader just asked for — is handed the same rejection for the life of the
  // tab. It has to be cleared from out here: the executor runs before the
  // assignment above, so anything it clears is put straight back. The identity
  // check leaves a newer connection alone.
  void opening.catch(() => {
    if (dbPromise === opening) dbPromise = null
  })

  return opening
}

/**
 * A promise for the transaction's outcome.
 *
 * Settled on the transaction, never on its requests. A commit that fails —
 * quota exceeded, disk error, a connection closed under it — aborts *after*
 * every request has already reported success, so a request-level `onsuccess`
 * reports a write that is not in the store. An abort also frequently carries no
 * error event at all, which would leave a promise waiting on `onerror` alone
 * unsettled for the life of the tab.
 */
function transactionDone(tx: IDBTransaction, failureMessage: string): Promise<void> {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => {
      resolve()
    }
    tx.onerror = () => {
      reject(new Error(tx.error?.message ?? failureMessage))
    }
    tx.onabort = () => {
      reject(new Error(tx.error?.message ?? failureMessage))
    }
  })
}

export async function getConversations(): Promise<ConversationEntry[]> {
  const db = await openDatabase()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(CONVERSATIONS_STORE, 'readonly')
    const store = tx.objectStore(CONVERSATIONS_STORE)
    const request = store.getAll()

    request.onerror = () => {
      reject(new Error(request.error?.message ?? 'Failed to get conversations'))
    }
    request.onsuccess = () => {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment -- IDB getAll() returns untyped data
      const conversations: ConversationEntry[] = request.result
      // Pinned first, then newest first. Sorting here keeps every reader
      // (sidebar, header lookup) on the same order.
      conversations.sort((a, b) => Number(b.pinned ?? false) - Number(a.pinned ?? false) || b.timestamp - a.timestamp)
      resolve(conversations)
    }
  })
}

interface SaveConversationOptions {
  /**
   * Whether to tell readers the store changed. Off for entries written inside a
   * batch, which notifies once at the end instead — every event costs each
   * subscriber a full `getAll()`, so a migration of N conversations otherwise
   * ran N growing reads.
   */
  notify?: boolean
}

export async function saveConversation(
  conversation: ConversationEntry,
  { notify = true }: SaveConversationOptions = {},
): Promise<void> {
  if (deletedConversations.has(conversation.id)) return

  try {
    const db = await openDatabase()
    const tx = db.transaction(CONVERSATIONS_STORE, 'readwrite')
    tx.objectStore(CONVERSATIONS_STORE).put(conversation)
    await transactionDone(tx, 'Failed to save conversation')

    lastKnownActivity.set(conversation.id, conversation.timestamp)
    if (notify) notifyConversationsChanged()
  } catch (error) {
    toast.error('Failed to save conversation. Your browser storage may be full or unavailable.')
    throw error
  }
}

/**
 * Read a conversation, decide what it should become, and write it back — all in
 * one `readwrite` transaction.
 *
 * The transaction is the point. Reading and writing separately let a rename or a
 * pin land in between, so it was read before the change and written back after
 * it, silently reverting what the user had just done — and a run stamps activity
 * every 30s, so the window was not hypothetical.
 *
 * `decide` returns the entry to store, or null to leave the record alone.
 * Readers are notified only when something was actually written.
 */
async function updateConversation(
  conversationId: string,
  decide: (existing: ConversationEntry | undefined) => ConversationEntry | null,
  {
    failureMessage,
    toastOnFailure = true,
    notify = true,
  }: { failureMessage: string; toastOnFailure?: boolean } & SaveConversationOptions,
): Promise<boolean> {
  if (deletedConversations.has(conversationId)) return false

  try {
    const db = await openDatabase()
    const tx = db.transaction(CONVERSATIONS_STORE, 'readwrite')
    const store = tx.objectStore(CONVERSATIONS_STORE)
    const read = store.get(conversationId)
    // Set from the callback below, read once the transaction has settled.
    const write = { happened: false }

    read.onsuccess = () => {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment -- IDB get() returns untyped data
      const existing: ConversationEntry | undefined = read.result
      const next = decide(existing)
      if (next === null) return
      store.put(next)
      write.happened = true
    }
    await transactionDone(tx, failureMessage)

    if (write.happened && notify) notifyConversationsChanged()
    return write.happened
  } catch (error) {
    if (toastOnFailure) {
      toast.error('Failed to save conversation. Your browser storage may be full or unavailable.')
    }
    throw error
  }
}

/**
 * Apply a partial change to a stored conversation.
 *
 * The change lands on whatever is in the store rather than on a snapshot the
 * caller read earlier — the sidebar holds a list that is a render behind, and
 * writing its whole entry back restored the old `timestamp` when a rename or a
 * pin raced the activity stamp of a run.
 */
export async function patchConversation(
  conversationId: string,
  patch: Partial<Omit<ConversationEntry, 'id'>>,
): Promise<void> {
  // A patch may carry a `timestamp`, so the cached stamp is no longer known to
  // be right; dropping it costs one read next time and cannot go stale.
  lastKnownActivity.delete(conversationId)
  await updateConversation(conversationId, (existing) => (existing ? { ...existing, ...patch } : null), {
    failureMessage: 'Failed to update conversation',
  })
}

/**
 * Write a conversation entry only if the id does not have one yet.
 *
 * A URL with no conversation behind it — a bookmark to a chat cleared from this
 * browser, or a mistyped id — used to open as an empty chat that accepted
 * messages, and those messages were then stored under an id the sidebar had
 * never heard of: the conversation vanished the moment it was navigated away
 * from. Sending there now gives it an entry.
 *
 * Insert-only, so it cannot overwrite the title, pin or activity stamp of a
 * conversation that does exist. Resolves to whether it inserted anything.
 */
export async function ensureConversationEntry(
  conversation: ConversationEntry,
  { notify = true }: SaveConversationOptions = {},
): Promise<boolean> {
  const inserted = await updateConversation(conversation.id, (existing) => (existing ? null : conversation), {
    failureMessage: 'Failed to create conversation',
    notify,
  })
  if (inserted) lastKnownActivity.set(conversation.id, conversation.timestamp)
  return inserted
}

// Below this, a rewrite would not change what any reader displays, so the churn
// (an IDB write plus a re-read in every subscriber) is not worth it.
const ACTIVITY_RESOLUTION_MS = 30_000

/**
 * The activity stamp each conversation was last seen to carry.
 *
 * `saveMessages` runs twice a second while a reply streams, and each call used
 * to open a second transaction just to discover the stamp was too fresh to
 * rewrite — roughly 120 transactions a minute, ~118 of which wrote nothing.
 * This answers that question without touching storage. Nothing depends on it
 * being complete: a miss just does the read it would have done anyway.
 */
const lastKnownActivity = new Map<string, number>()

/**
 * Record that a conversation was just used.
 *
 * `timestamp` is what the sidebar sorts and buckets by, and it was only ever
 * written at creation — so a thread started weeks ago and messaged a minute ago
 * still read "20d ago" and sorted below untouched newer ones.
 */
async function touchConversation(conversationId: string, at: number): Promise<void> {
  const known = lastKnownActivity.get(conversationId)
  if (known !== undefined && at - known < ACTIVITY_RESOLUTION_MS) return

  await updateConversation(
    conversationId,
    (existing) => {
      if (!existing) return null
      lastKnownActivity.set(conversationId, existing.timestamp)
      if (at - existing.timestamp < ACTIVITY_RESOLUTION_MS) return null
      lastKnownActivity.set(conversationId, at)
      // Freeze the creation time before moving `timestamp` off it. Entries
      // written before `createdAt` existed have only this one moment left where
      // the original is still readable, and fork ordering depends on it.
      return { ...existing, createdAt: existing.createdAt ?? existing.timestamp, timestamp: at }
    },
    {
      failureMessage: 'Failed to record conversation activity',
      // The history is already committed by the time this runs, so a failure to
      // stamp activity is a stale sidebar timestamp, not lost messages —
      // `saveMessages` logs it rather than alarming anyone.
      toastOnFailure: false,
    },
  )
}

/**
 * Conversations deleted in this session.
 *
 * A delete has to beat writes that were already in flight when it landed.
 * Leaving the conversation flushes whatever was on screen, and deleting the one
 * you are looking at navigates away — so the flush ran *after* the delete and
 * put the messages back. The sidebar entry stayed gone, but the URL still
 * loaded the full history, which is not what "cannot be undone" promised.
 *
 * Ids are nanoids and never reused, so suppressing them for the life of the tab
 * cannot block a later legitimate write.
 */
const deletedConversations = new Set<string>()

/** Whether this id was deleted in this session; see `deletedConversations`. */
export function isConversationDeleted(conversationId: string): boolean {
  return deletedConversations.has(conversationId)
}

export async function deleteConversation(conversationId: string): Promise<void> {
  // Marked before the transaction opens, not after it commits: a throttled save
  // that starts in between would pass the guard and queue behind the delete,
  // writing the history back once it completed. Rolled back below if the delete
  // itself fails, so a conversation that is still there stays writable.
  deletedConversations.add(conversationId)
  lastKnownActivity.delete(conversationId)

  try {
    const db = await openDatabase()
    const tx = db.transaction([CONVERSATIONS_STORE, MESSAGES_STORE], 'readwrite')
    tx.objectStore(CONVERSATIONS_STORE).delete(conversationId)
    tx.objectStore(MESSAGES_STORE).delete(conversationId)
    await transactionDone(tx, 'Failed to delete conversation')

    notifyConversationsChanged()
  } catch (error) {
    // Every way this can fail rolls the suppression back from one place,
    // including a `db.transaction()` that throws synchronously — on a
    // browser-closed connection it does, before any handler of ours exists.
    // A conversation that is still there has to stay writable, or its own saves
    // silently return for the rest of the session.
    deletedConversations.delete(conversationId)
    throw error
  }
}

export async function getMessages(conversationId: string): Promise<UIMessage[] | null> {
  const db = await openDatabase()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(MESSAGES_STORE, 'readonly')
    const store = tx.objectStore(MESSAGES_STORE)
    const request = store.get(conversationId)

    request.onerror = () => {
      reject(new Error(request.error?.message ?? 'Failed to get messages'))
    }
    request.onsuccess = () => {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment -- IDB get() returns untyped data
      const result: { id: string; messages: UIMessage[] } | undefined = request.result
      resolve(result?.messages ?? null)
    }
  })
}

interface SaveMessagesOptions {
  /**
   * Whether this write counts as activity on the conversation. Off for bulk
   * writes that replay history (the localStorage migration), which would
   * otherwise stamp every restored conversation with the migration time and
   * collapse the whole sidebar into "Just now".
   */
  touch?: boolean
  /**
   * Whether to leave a history that is already stored alone. On for restores
   * (the localStorage migration), where the stored copy is by definition the
   * newer one — it is what the conversation has been used for since.
   */
  insertOnly?: boolean
}

export async function saveMessages(
  conversationId: string,
  messages: UIMessage[],
  { touch = true, insertOnly = false }: SaveMessagesOptions = {},
): Promise<void> {
  if (deletedConversations.has(conversationId)) return

  const write = { happened: false }
  try {
    const db = await openDatabase()
    // Include the conversation store so this write and a deletion in another
    // tab cannot pass each other. If this transaction runs first, the delete
    // waits and removes both records afterwards. If the delete runs first, the
    // missing conversation suppresses this write instead of restoring history
    // the user deleted.
    const tx = db.transaction([CONVERSATIONS_STORE, MESSAGES_STORE], 'readwrite')
    const conversations = tx.objectStore(CONVERSATIONS_STORE)
    const storedMessages = tx.objectStore(MESSAGES_STORE)
    const conversation = conversations.get(conversationId)

    conversation.onsuccess = () => {
      if (conversation.result === undefined) return

      if (insertOnly) {
        // Read and write in the one transaction, so nothing can store a history
        // between the two and have it overwritten here.
        const existingMessages = storedMessages.get(conversationId)
        existingMessages.onsuccess = () => {
          if (existingMessages.result !== undefined) return
          storedMessages.put({ id: conversationId, messages })
          write.happened = true
        }
      } else {
        storedMessages.put({ id: conversationId, messages })
        write.happened = true
      }
    }
    await transactionDone(tx, 'Failed to save messages')
  } catch (error) {
    toast.error('Failed to save messages. Your browser storage may be full or unavailable.')
    throw error
  }

  // Outside the try on purpose: the history is already committed by here, so a
  // failure to stamp the activity is a stale sidebar timestamp, not lost
  // messages. Reporting it as "your browser storage may be full" and rejecting
  // the save would be wrong on both counts.
  if (write.happened && touch) {
    await touchConversation(conversationId, Date.now()).catch((error: unknown) => {
      console.error('Failed to record conversation activity:', error)
    })
  }
}

export function migrateFromLocalStorage(): Promise<boolean> {
  if (migrationPromise) return migrationPromise

  const migration = runMigration()
  migrationPromise = migration
  const clear = () => {
    if (migrationPromise === migration) migrationPromise = null
  }
  // React Strict Mode starts effects twice in development. Share one migration
  // while it is running, then permit an explicit retry after either outcome.
  void migration.then(clear, clear)
  return migration
}

async function runMigration(): Promise<boolean> {
  const migrationKey = 'indexeddb-migration-complete'
  if (localStorage.getItem(migrationKey)) {
    return false
  }

  const conversationsJson = localStorage.getItem('conversationIds')
  if (!conversationsJson) {
    localStorage.setItem(migrationKey, 'true')
    return false
  }

  // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment -- JSON.parse returns untyped data
  const conversations: ConversationEntry[] = JSON.parse(conversationsJson)
  let wrote = false

  try {
    for (const [index, conv] of conversations.entries()) {
      // Insert-only, both here and for the history below. A batch that fails
      // partway leaves the completion flag unset, so the next load runs this
      // again — and by then the user has had a whole session to rename, pin,
      // and add messages to what did land. Overwriting is how a migration that
      // half-worked turns into one that undoes the day's work every reload.
      // The single refresh at the end of the batch is unrelated: it is there so
      // N conversations do not cost N growing re-reads.
      if (await ensureConversationEntry(conv, { notify: false })) wrote = true

      const messagesJson = localStorage.getItem(conv.id)
      if (messagesJson) {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment -- JSON.parse returns untyped data
        const messages: UIMessage[] = JSON.parse(messagesJson)
        // Restoring history is not activity: keep each conversation's own timestamp.
        await saveMessages(conv.id, messages, { touch: false, insertOnly: true })
      }

      // Struck off the legacy list the moment it is safely in IndexedDB, so a
      // later run is only ever offered what has not made it across yet.
      // Insert-only writes keep an edit safe; only forgetting the entry keeps a
      // *deletion* safe, since nothing in storage distinguishes "deleted after
      // it was migrated" from "not migrated yet".
      localStorage.removeItem(conv.id)
      localStorage.setItem('conversationIds', JSON.stringify(conversations.slice(index + 1)))
    }

    localStorage.removeItem('conversationIds')
    localStorage.setItem(migrationKey, 'true')
  } finally {
    // Also on the way out of a failed migration. The sidebar is mounted by the
    // time this runs and has already read an empty store, so whatever did land
    // before the failure stayed invisible until some other write happened to
    // notify — on a batch that aborts early, that could be the rest of the
    // session. Suppressing the per-entry events is a batching decision; it must
    // not turn into no event at all.
    if (wrote) notifyConversationsChanged()
  }

  return true
}
