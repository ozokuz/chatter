import { createSignal, For, onCleanup, onMount, Show } from "solid-js";
import { io, type Socket } from "socket.io-client";
import type { ChatMessage, ClientEvents, MessagePage, Person, SendMessage, SendResult, ServerEvents } from "../../../packages/shared/chat";
import { api, ApiError, authClient, errorMessage, mergeMessages } from "./lib";
import Composer from "./Composer";

const dateLabel = (value: string) => new Intl.DateTimeFormat(undefined, { month: "long", day: "numeric", year: "numeric" }).format(new Date(value));
const timeLabel = (value: string) => new Intl.DateTimeFormat(undefined, { hour: "2-digit", minute: "2-digit" }).format(new Date(value));

export default function Chat(props: { me: Person; onSignedOut: () => void; onSessionExpired: () => void }) {
  const [people, setPeople] = createSignal<Person[]>([]);
  const [online, setOnline] = createSignal<string[]>([]);
  const [messages, setMessages] = createSignal<ChatMessage[]>([]);
  const [cursor, setCursor] = createSignal<string | null>(null);
  const [loading, setLoading] = createSignal(true);
  const [olderLoading, setOlderLoading] = createSignal(false);
  const [connected, setConnected] = createSignal(false);
  const [connectionError, setConnectionError] = createSignal("");
  const [error, setError] = createSignal("");
  const [peopleError, setPeopleError] = createSignal("");
  const [membersOpen, setMembersOpen] = createSignal(false);
  const [signingOut, setSigningOut] = createSignal(false);
  const [newBelow, setNewBelow] = createSignal(false);
  let socket: Socket<ServerEvents, ClientEvents>;
  let feed!: HTMLDivElement;
  let disposed = false;

  function handleError(value: unknown) {
    if (value instanceof ApiError && value.status === 401) props.onSessionExpired();
    else setError(errorMessage(value));
  }
  async function loadPeople() {
    try {
      const data = await api<{ users: Person[] }>("/users");
      if (!disposed) { setPeople(data.users); setPeopleError(""); }
    } catch (error) {
      if (disposed) return;
      if (error instanceof ApiError && error.status === 401) props.onSessionExpired();
      else setPeopleError(errorMessage(error));
    }
  }
  function bottom() {
    requestAnimationFrame(() => { if (feed) feed.scrollTop = feed.scrollHeight; });
    setNewBelow(false);
  }
  async function loadHistory(reset: boolean) {
    const params = new URLSearchParams();
    if (!reset && cursor()) params.set("before", cursor()!);
    const oldHeight = feed?.scrollHeight ?? 0;
    if (reset) setLoading(true); else setOlderLoading(true);
    setError("");
    try {
      const page = await api<MessagePage>(`/messages?${params}`);
      if (disposed) return;
      // Reconnects refresh the latest page without losing the older-page cursor.
      const first = messages()[0];
      const pageFirst = page.messages[0];
      const keepsEarlierMessages = first && pageFirst && (
        first.createdAt < pageFirst.createdAt || (first.createdAt === pageFirst.createdAt && first.id < pageFirst.id)
      );
      if (!reset || !keepsEarlierMessages) setCursor(page.nextCursor);
      setMessages((current) => mergeMessages(page.messages, current));
      if (reset) bottom();
      else requestAnimationFrame(() => { if (feed) feed.scrollTop += feed.scrollHeight - oldHeight; });
    } catch (error) { if (!disposed) handleError(error); }
    finally { if (!disposed) { setLoading(false); setOlderLoading(false); } }
  }

  onMount(() => {
    void loadHistory(true);
    socket = io({ autoConnect: false, withCredentials: true });
    socket.on("connect", () => {
      setConnected(true); setConnectionError("");
      void loadHistory(true); void loadPeople();
    });
    socket.on("disconnect", (reason) => {
      setConnected(false); setOnline([]);
      if (reason === "io server disconnect" && !disposed) props.onSessionExpired();
    });
    socket.on("connect_error", () => {
      setConnected(false); setConnectionError("Connection interrupted. Reconnecting…");
      void authClient.getSession().then((result) => { if (!disposed && !result.error && !result.data) props.onSessionExpired(); }).catch(() => {});
    });
    socket.on("presence:update", (ids) => { setOnline(ids); void loadPeople(); });
    socket.on("message:new", (message) => {
      const nearBottom = feed && feed.scrollHeight - feed.scrollTop - feed.clientHeight < 120;
      setMessages((old) => mergeMessages(old, [message]));
      if (nearBottom || message.sender.id === props.me.id) bottom(); else setNewBelow(true);
    });
    socket.connect();
  });
  onCleanup(() => { disposed = true; socket?.disconnect(); });

  async function send(payload: SendMessage) {
    if (!socket?.connected) throw new Error("Wait for the connection to return before sending.");
    let result: SendResult;
    try { result = await socket.timeout(8000).emitWithAck("message:send", payload); }
    catch { throw new Error("Delivery wasn't confirmed. Retry to safely check and send your message."); }
    if (!result.ok) throw new Error(result.error);
    setMessages((old) => mergeMessages(old, [result.message]));
    bottom();
  }
  async function signOut() {
    setSigningOut(true); setError("");
    try {
      const result = await authClient.signOut();
      if (result.error) throw new Error(result.error.message);
      props.onSignedOut();
    } catch (error) { setError(errorMessage(error)); setSigningOut(false); }
  }

  return <main class="chat-app" onKeyDown={(event) => { if (event.key === "Escape") setMembersOpen(false); }}>
    <header class="chat-header">
      <h1>Global chat</h1>
      <span class="current-user">{props.me.username}</span>
      <button aria-controls="members" aria-expanded={membersOpen()} onClick={() => setMembersOpen(!membersOpen())}>Members ({people().length})</button>
      <button onClick={() => void signOut()} disabled={signingOut()}>Sign out</button>
    </header>
    <Show when={!connected()}><div class="connection-banner" role="status">{connectionError() || "Connecting…"}</div></Show>
    <div class="chat-body">
      <section class="conversation-column" aria-label="Global chat">
        <div class="conversation-feed" ref={feed} role="log" aria-label="Global chat messages" aria-live="polite" aria-busy={loading()} onScroll={() => { if (feed.scrollHeight - feed.scrollTop - feed.clientHeight < 50) setNewBelow(false); }}>
          <Show when={error()}><div class="error" role="alert">{error()} <button onClick={() => void loadHistory(true)}>Try again</button></div></Show>
          <Show when={loading()}><p class="feed-status">Loading messages…</p></Show>
          <Show when={cursor()}><button class="older-button" disabled={olderLoading()} onClick={() => void loadHistory(false)}>{olderLoading() ? "Loading…" : "Load earlier messages"}</button></Show>
          <Show when={!loading() && !messages().length && !error()}><p class="feed-status">No messages yet.</p></Show>
          <For each={messages()}>{(message, index) => <>
            <Show when={index() === 0 || dateLabel(messages()[index() - 1]!.createdAt) !== dateLabel(message.createdAt)}><div class="date-divider">{dateLabel(message.createdAt)}</div></Show>
            <article class="message">
              <div class="message-meta"><strong>{message.sender.username}</strong><time dateTime={message.createdAt} title={new Date(message.createdAt).toLocaleString()}>{timeLabel(message.createdAt)}</time></div>
              <div class="message-content">{message.content}</div>
            </article>
          </>}</For>
        </div>
        <Show when={newBelow()}><button class="new-messages" onClick={bottom}>New messages ↓</button></Show>
        <Composer connected={connected()} onSend={send}/>
      </section>
      <Show when={membersOpen()}><aside class="members-panel" id="members" aria-label="Members">
        <div class="members-heading"><h2>Members</h2><button aria-label="Close member list" onClick={() => setMembersOpen(false)}>Close</button></div>
        <Show when={peopleError()}><div class="error" role="alert">{peopleError()} <button onClick={() => void loadPeople()}>Retry</button></div></Show>
        <ul><For each={people()}>{(person) => <li><span>{person.username}</span><span class="member-status">{online().includes(person.id) ? "Online" : "Offline"}</span></li>}</For></ul>
      </aside></Show>
    </div>
  </main>;
}
