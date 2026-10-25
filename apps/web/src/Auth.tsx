import { createSignal, Show } from "solid-js";
import type { Person } from "../../../packages/shared/chat";
import { authClient, errorMessage } from "./lib";

export default function Auth(props: { notice: string; onAuthenticated: (person: Person) => void }) {
  const [signup, setSignup] = createSignal(false);
  const [username, setUsername] = createSignal("");
  const [email, setEmail] = createSignal("");
  const [password, setPassword] = createSignal("");
  const [busy, setBusy] = createSignal(false);
  const [error, setError] = createSignal("");

  async function submit(event: SubmitEvent) {
    event.preventDefault();
    if (busy()) return;
    setBusy(true);
    setError("");
    try {
      const result = signup()
        ? await authClient.signUp.email({ name: username().trim(), username: username().trim(), email: email().trim(), password: password() })
        : await authClient.signIn.email({ email: email().trim(), password: password() });
      if (result.error) throw new Error(result.error.message ?? "Couldn't sign you in.");
      const session = await authClient.getSession();
      if (!session.data) throw new Error("Couldn't load your session. Please try signing in.");
      const user = session.data.user;
      if (!user.username) throw new Error("Account username is missing.");
      props.onAuthenticated({ id: user.id, name: user.name, username: user.username });
    } catch (error) { setError(errorMessage(error)); }
    finally { setBusy(false); }
  }

  return <main class="auth-page">
    <section class="auth-form-content">
      <a class="brand" href="/">Chatter</a>
      <h1>{signup() ? "Create account" : "Sign in"}</h1>
      <Show when={props.notice}><div class="notice" role="status">{props.notice}</div></Show>
      <form onSubmit={(event) => void submit(event)} class="auth-form">
        <Show when={signup()}><label>Username<input value={username()} onInput={(e) => setUsername(e.currentTarget.value)} autocomplete="username" aria-label="Username" aria-describedby="username-hint" required minLength={3} maxLength={24} pattern="[a-zA-Z0-9_]+" placeholder="e.g. alex_green" disabled={busy()}/><span class="field-hint" id="username-hint">3–24 letters, numbers, or underscores.</span></label></Show>
        <label>Email address<input type="email" value={email()} onInput={(e) => setEmail(e.currentTarget.value)} autocomplete="email" required placeholder="you@example.com" disabled={busy()}/></label>
        <label>Password<input type="password" value={password()} onInput={(e) => setPassword(e.currentTarget.value)} autocomplete={signup() ? "new-password" : "current-password"} required minLength={8} maxLength={128} placeholder={signup() ? "At least 8 characters" : "Your password"} disabled={busy()}/></label>
        <Show when={error()}><div class="error" role="alert">{error()}</div></Show>
        <button class="primary" type="submit" disabled={busy()}>{busy() ? "Please wait…" : signup() ? "Create account" : "Sign in"}</button>
      </form>
      <p class="auth-switch"><button onClick={() => { setSignup(!signup()); setError(""); }} disabled={busy()}>{signup() ? "Sign in" : "Create account"}</button></p>
    </section>
  </main>;
}
