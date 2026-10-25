import { createSignal, Show } from "solid-js";
import type { SendMessage } from "../../../packages/shared/chat";
import { errorMessage } from "./lib";

export default function Composer(props: { connected: boolean; onSend: (payload: SendMessage) => Promise<void> }) {
  const [content, setContent] = createSignal("");
  const [busy, setBusy] = createSignal(false);
  const [error, setError] = createSignal("");
  let textarea!: HTMLTextAreaElement;
  let retryId: string | undefined;

  async function submit(event?: SubmitEvent) {
    event?.preventDefault();
    if (busy() || !props.connected || !content().trim()) return;
    setBusy(true); setError("");
    try {
      retryId ??= crypto.randomUUID();
      await props.onSend({ clientId: retryId, content: content().trim() });
      setContent(""); retryId = undefined;
    } catch (error) { setError(errorMessage(error)); }
    finally { setBusy(false); textarea.focus(); }
  }

  return <div class="composer-wrap">
    <Show when={error()}><div class="error" role="alert">{error()}</div></Show>
    <form class="composer" onSubmit={(event) => void submit(event)}>
      <textarea ref={textarea} value={content()} onInput={(e) => { setContent(e.currentTarget.value); retryId = undefined; }} onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey && !e.isComposing) { e.preventDefault(); void submit(); } }} placeholder="Message" aria-label="Message" aria-describedby="message-hint" maxLength={4000} rows={2} disabled={busy()}/>
      <button class="primary" type="submit" disabled={busy() || !props.connected || !content().trim()}>{busy() ? "Sending…" : "Send"}</button>
    </form>
    <div class="composer-hint" id="message-hint">Enter to send · Shift + Enter for a new line<Show when={content().length > 3500}> · {content().length}/4000</Show></div>
  </div>;
}
