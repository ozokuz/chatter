import { createSignal, onMount, Show } from "solid-js";
import type { Person } from "../../../packages/shared/chat";
import { authClient, errorMessage } from "./lib";
import Auth from "./Auth";
import Chat from "./Chat";

export default function App() {
  const [me, setMe] = createSignal<Person | null>(null);
  const [loading, setLoading] = createSignal(true);
  const [error, setError] = createSignal("");
  const [notice, setNotice] = createSignal("");

  async function restoreSession() {
    setLoading(true);
    setError("");
    try {
      const result = await authClient.getSession();
      if (result.error) throw new Error(result.error.message ?? "Unable to load your session.");
      const user = result.data?.user;
      if (user && !user.username) throw new Error("Account username is missing.");
      setMe(user ? { id: user.id, name: user.name, username: user.username! } : null);
    } catch (error) { setError(errorMessage(error)); }
    finally { setLoading(false); }
  }

  onMount(() => { void restoreSession(); });

  return <Show when={!loading()} fallback={<div class="app-loading" role="status">Loading…</div>}>
    <Show when={!error()} fallback={<div class="app-loading"><p role="alert">{error()}</p><button class="primary" onClick={() => void restoreSession()}>Try again</button></div>}>
      <Show when={me()} keyed fallback={<Auth notice={notice()} onAuthenticated={(person) => { setNotice(""); setMe(person); }} />}>
        {(person) => <Chat me={person} onSignedOut={() => setMe(null)} onSessionExpired={() => { setNotice("Your session expired. Sign in again."); setMe(null); }} />}
      </Show>
    </Show>
  </Show>;
}
