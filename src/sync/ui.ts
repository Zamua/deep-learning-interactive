// The account on screen: whether progress is backed up, the code that carries it to another device, and linking this
// device to a code from another one. Also a file copy of Atlas progress, kept outside any account.
import '../styles/account.css';
import { CODE_LENGTH, SyncError, codeSymbols, formatCode, parseCode, type CodeError, type SyncStatus } from 'hearthsync';
import { icon } from '../core/controls';
import { h, onDispose } from '../core/dom';
import { exportSnapshot, importSnapshot } from '../mastery/store';
import { progressStore, syncEngine } from './cloud';
import { concepts, conceptsIn } from './model';
import { statusLine } from './status';
import { routes } from '../routes';

const CODE_ERROR: Record<CodeError, string> = {
  symbol: 'That has a character no code uses.',
  length: `A code is ${CODE_LENGTH} letters and digits long.`,
  check: 'Something is mistyped. Check each group against your other device.',
  format: 'That code is from a newer version of this site. Reload this page, then try again.',
};

function failText(e: unknown): string {
  if (!(e instanceof SyncError)) return 'Something went wrong. Try again.';
  switch (e.kind) {
    case 'offline': return 'You are offline. Connect, then try again.';
    case 'code': return e.detail ? CODE_ERROR[e.detail] : CODE_ERROR.check;
    case 'notfound': return 'No account has that code. Check it against your other device.';
    case 'notaccount': return 'That code holds no progress.';
    case 'same': return 'That is this device\'s own code.';
    case 'rate': return 'The server is busy. Try again in a few minutes.';
    case 'full': return 'The server is full right now. Try again later.';
    default: return 'Something went wrong. Try again.';
  }
}

/** Live help under the code field. Never corrects what was typed: a correction could turn a swap into another code. */
function codeHint(text: string): { tone: '' | 'ok' | 'bad'; text: string } {
  const n = codeSymbols(text).length;
  if (!n) return { tone: '', text: '' };
  const r = parseCode(text);
  if (!('error' in r)) return { tone: 'ok', text: 'Looks right.' };
  if (r.error === 'length') return n < CODE_LENGTH ? { tone: '', text: `${n} of ${CODE_LENGTH}` } : { tone: 'bad', text: `${n - CODE_LENGTH} too many. A code is ${CODE_LENGTH} long.` };
  return { tone: 'bad', text: CODE_ERROR[r.error] };
}

const linkFor = (code: string): string => `${location.origin}${location.pathname}${routes.link(formatCode(code))}`;

const dayText = (t: number): string => new Date(t).toLocaleDateString([], { month: 'short', day: 'numeric' });

function mastered(records: Parameters<typeof conceptsIn>[0]): { n: number; last: number } {
  const all = Object.values(conceptsIn(records));
  return { n: all.filter((r) => r.mastered).length, last: Math.max(0, ...all.map((r) => r.last)) };
}

/** A button whose label says what it just did for a moment. */
function flash(b: HTMLButtonElement, done: string): void {
  const was = b.innerHTML;
  b.textContent = done;
  window.setTimeout(() => (b.innerHTML = was), 1600);
}

/** The account page; `typed` is a code from a link, offered for linking at once. */
export function renderAccount(main: HTMLElement, typed?: string): void {
  const sync = syncEngine();
  const root = h('div', { class: 'home home-b ac', 'data-page': 'account' });
  main.append(root);
  root.append(
    h('div', { class: 'home-kicker' }, 'Your progress'),
    h('h1', { class: 'home-title', html: 'Sync across <em>devices</em>.' }),
    h('p', { class: 'ac-lede' }, 'Progress is saved on this device first and backed up to your account in the background. Your code opens the same account on another device. There is no sign-up: the code is the account.'));

  const status = h('div', { class: 'ac-status' });
  const codeBody = h('div', { class: 'ac-codebody' });
  root.append(status, h('h2', { class: 'ac-h2' }, 'Your code'), codeBody);

  let shown = '';
  const draw = (st: SyncStatus) => {
    const line = statusLine(st);
    status.className = `ac-status ${line.tone}`;
    status.innerHTML = '';
    status.append(h('span', { class: 'ac-status-i', html: icon(line.icon) }), h('span', {}, h('b', {}, line.title), line.text ? h('span', {}, line.text) : ''));
    const key = `${st.code}|${st.problem === 'lost'}`;
    if (key === shown) return;
    shown = key;
    codeBody.innerHTML = '';
    if (st.problem === 'lost') {
      const remake = h('button', { type: 'button', class: 'btn btn-primary' }, 'Make a new code');
      const msg = h('p', { class: 'ac-note' });
      remake.addEventListener('click', () => {
        remake.disabled = true;
        sync?.remakeAccount().catch((e: unknown) => (msg.textContent = failText(e))).finally(() => (remake.disabled = false));
      });
      codeBody.append(h('p', { class: 'ac-note' }, 'The server no longer has your account. Everything is still on this device: a new code backs it up again, and your other devices link to it.'), h('div', { class: 'ac-actions' }, remake), msg);
      return;
    }
    if (!st.code) {
      codeBody.append(h('p', { class: 'ac-note' }, 'Your code comes once there is progress to back up and a connection. On a device that already has a code, you can use it below instead.'));
      return;
    }
    const code = st.code;
    const share = h('button', { type: 'button', class: 'btn btn-primary', html: `${icon('share-network')} Share link` });
    const copy = h('button', { type: 'button', class: 'btn', html: `${icon('copy')} Copy code` });
    share.addEventListener('click', async () => {
      const url = linkFor(code);
      if (navigator.share) {
        try {
          await navigator.share({ title: 'Sync my progress', url });
        } catch {
          /* dismissed */
        }
        return;
      }
      try {
        await navigator.clipboard.writeText(url);
        flash(share, 'Link copied');
      } catch {
        flash(share, 'Copy failed');
      }
    });
    copy.addEventListener('click', () => void navigator.clipboard.writeText(formatCode(code)).then(() => flash(copy, 'Copied'), () => flash(copy, 'Copy failed')));
    codeBody.append(
      codeBox(code),
      h('div', { class: 'ac-actions' }, share, copy),
      keeper(code, st.tag),
      h('p', { class: 'ac-note' }, 'Open the link on your other device, or fill the code there from your password manager. Anyone with it can see and change your progress, so keep it to yourself.'));
  };
  if (sync) {
    draw(sync.status);
    onDispose(sync.on('status', draw));
    // "Last synced 2 min ago" ages while the page stays open.
    const tick = window.setInterval(() => draw(sync.status), 30_000);
    onDispose(() => window.clearInterval(tick));
  } else {
    status.append(h('span', {}, h('b', {}, 'Sync is off'), h('span', {}, 'This copy of the site has no account server. Progress stays on this device.')));
  }

  root.append(h('h2', { class: 'ac-h2' }, 'Use a code from another device'), linker(typed));
  root.append(h('h2', { class: 'ac-h2' }, 'A copy in a file'), fileCopy());
}

/** The code, hidden until asked for so it is not read over a shoulder, and hidden again with the same button. */
function codeBox(code: string): HTMLElement {
  const groups = formatCode(code).split(' ');
  const text = h('div', { class: 'ac-code-t' });
  const eye = h('button', { type: 'button', class: 'ac-eye ac-code-eye' });
  const box = h('div', { class: 'ac-code masked' }, text, eye);
  const draw = (shown: boolean) => {
    box.classList.toggle('masked', !shown);
    text.innerHTML = '';
    text.append(...groups.map((g) => h('span', {}, shown ? g : '•'.repeat(g.length))));
    text.setAttribute('aria-label', shown ? formatCode(code) : 'Code hidden');
    eye.innerHTML = icon(shown ? 'eye-slash' : 'eye');
    eye.setAttribute('aria-label', shown ? 'Hide the code' : 'Show the code');
    eye.setAttribute('aria-pressed', String(shown));
  };
  eye.addEventListener('click', () => draw(box.classList.contains('masked')));
  draw(false);
  return box;
}

/** The account as a password manager sees it: a login whose password is the code. */
const loginName = (tag: string | null): string => `Deep learning sync${tag ? ` #${tag}` : ''}`;
const loginCode = (code: string): string => formatCode(code).replace(/ /g, '-');

/**
 * The code as a login for this site, in a form that really submits (into a hidden frame, so the page stays): the
 * browser's own password manager and extensions such as 1Password offer to save a login when its form is submitted.
 * The fields are on screen and editable because managers skip hidden and read-only ones; a code changed by hand is
 * put back before anything is saved. `current-password`, not `new-password`, so no manager offers to replace the code
 * with a generated password.
 */
function keeper(code: string, tag: string | null): HTMLElement {
  const pass = loginCode(code);
  const frame = `pm-${Math.random().toString(36).slice(2)}`;
  const name = h('input', { id: 'sync-save-name', class: 'ac-input ac-kname', type: 'text', name: 'username', autocomplete: 'username', value: loginName(tag) }) as HTMLInputElement;
  const secret = h('input', { id: 'sync-save-code', class: 'ac-input', type: 'password', name: 'password', autocomplete: 'current-password', value: pass }) as HTMLInputElement;
  const save = h('button', { type: 'submit', class: 'btn', html: `${icon('key')} Save` });
  const note = h('p', { class: 'ac-note' }, 'Save the code as a login for this site, and your other devices can fill it in.');
  const form = h('form', { id: 'sync-save', method: 'post', action: 'about:blank', target: frame },
    h('label', { class: 'ac-sr', for: 'sync-save-name' }, 'Name to save it under'),
    h('label', { class: 'ac-sr', for: 'sync-save-code' }, 'Your code'),
    h('div', { class: 'ac-krow' }, name, secret, save), note);
  const sink = h('iframe', { name: frame, title: 'Password manager', hidden: true, tabindex: '-1' });
  form.addEventListener('submit', (e) => {
    if (codeSymbols(secret.value) !== codeSymbols(pass)) {
      e.preventDefault();
      secret.value = pass;
      note.className = 'ac-note bad';
      note.textContent = 'That field holds your code, so it is put back as it was. Change the name above if you like, then Save.';
      return;
    }
    note.className = 'ac-note ok';
    note.textContent = 'If your password manager offered to save it, it is ready to fill on your other devices. If it did not: in 1Password, right-click its toolbar icon and choose Save, then Login, while these fields are filled.';
  });
  return h('div', { class: 'ac-pm' }, h('div', { class: 'ac-pm-k', html: `${icon('key')} Your password manager` }), form, sink);
}

/** The code field, what that code holds, and the link itself. */
function linker(typed?: string): HTMLElement {
  const sync = syncEngine();
  // A login form too, so a password manager fills the code it saved on the other device.
  const user = h('input', { id: 'sync-link-name', class: 'ac-sr', type: 'text', name: 'username', autocomplete: 'username', tabindex: '-1', 'aria-hidden': 'true' });
  const input = h('input', {
    id: 'sync-link-code', class: 'ac-input', type: 'password', name: 'password', autocomplete: 'current-password', autocapitalize: 'characters', spellcheck: 'false',
    placeholder: 'XXXX-XXXX-XXXX-XXXX-XXXX-XXXX-XXX',
  }) as HTMLInputElement;
  const eye = h('button', { type: 'button', class: 'ac-eye', 'aria-label': 'Show the code', 'aria-pressed': 'false', html: icon('eye') });
  eye.addEventListener('click', () => {
    const show = input.type === 'password';
    input.type = show ? 'text' : 'password';
    eye.setAttribute('aria-pressed', String(show));
    eye.setAttribute('aria-label', show ? 'Hide the code' : 'Show the code');
    eye.innerHTML = icon(show ? 'eye-slash' : 'eye');
  });
  const go = h('button', { type: 'submit', class: 'btn btn-primary' }, 'Continue') as HTMLButtonElement;
  const hint = h('p', { class: 'ac-hint' });
  const peek = h('div', { class: 'ac-peek', hidden: true });
  const form = h('form', { id: 'sync-link', class: 'ac-form', method: 'post', action: '' }, user,
    h('label', { class: 'ac-sr', for: 'sync-link-code' }, 'Code from another device'),
    h('div', { class: 'ac-row' }, h('div', { class: 'ac-field' }, input, eye), go), hint, peek);
  const say = (tone: '' | 'ok' | 'bad', text: string) => {
    hint.className = `ac-hint ${tone}`;
    hint.textContent = text;
  };
  input.addEventListener('input', () => {
    peek.hidden = true;
    const r = codeHint(input.value);
    say(r.tone, r.text);
  });
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    if (!sync) return say('bad', 'This copy of the site has no account server.');
    const text = input.value;
    go.disabled = true;
    say('', 'Looking up that code…');
    sync.peekCode(text).then((p) => {
      if (p.same) return say('ok', 'That is this device\'s own code: it is already linked.');
      say('', '');
      const { n, last } = mastered(p.records);
      const mine = mastered(progressStore().store.records).n;
      const link = h('button', { type: 'button', class: 'btn btn-primary', html: `${icon('devices')} Link this device` }) as HTMLButtonElement;
      const cancel = h('button', { type: 'button', class: 'btn' }, 'Cancel');
      peek.innerHTML = '';
      peek.append(
        h('p', {}, `That account has ${n === 1 ? '1 concept' : `${n} concepts`} mastered${last ? `, last practiced ${dayText(last)}` : ''}. `,
          mine ? `This device's progress (${mine === 1 ? '1 concept' : `${mine} concepts`} mastered) joins it, and from then on the two stay in step.` : 'Linking brings it here, and from then on the two stay in step.'),
        h('div', { class: 'ac-actions' }, link, cancel));
      peek.hidden = false;
      // On a phone the question lands below the fold; a link from another device opens straight onto it.
      peek.scrollIntoView({ behavior: 'smooth', block: 'center' });
      cancel.addEventListener('click', () => (peek.hidden = true));
      link.addEventListener('click', () => {
        link.disabled = true;
        sync.linkCode(text).then((r) => {
          peek.hidden = true;
          input.value = '';
          const now = Object.values(concepts(progressStore().store)).filter((x) => x.mastered).length;
          say('ok', `Linked. ${now === 1 ? '1 concept' : `${now} concepts`} mastered here now.${r.pending ? ' Some of it is still uploading.' : ''}`);
        }, (err: unknown) => say('bad', failText(err))).finally(() => (link.disabled = false));
      });
    }, (err: unknown) => say('bad', failText(err))).finally(() => (go.disabled = false));
  });
  if (typed) {
    input.value = loginCode(codeSymbols(typed));
    queueMicrotask(() => form.requestSubmit());
  }
  return form;
}

/** Atlas progress saved to a file, or added from one. */
function fileCopy(): HTMLElement {
  const save = h('button', { type: 'button', class: 'btn' }, 'Save progress to a file');
  save.addEventListener('click', () => {
    const url = URL.createObjectURL(new Blob([JSON.stringify(exportSnapshot())], { type: 'application/json' }));
    const a = h('a', { href: url, download: `atlas-progress-${new Date().toISOString().slice(0, 10)}.json` });
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  });
  const input = h('input', { type: 'file', accept: 'application/json,.json', hidden: true }) as HTMLInputElement;
  const load = h('button', { type: 'button', class: 'btn' }, 'Load progress from a file');
  const msg = h('p', { class: 'ac-hint' });
  load.addEventListener('click', () => input.click());
  input.addEventListener('change', async () => {
    const f = input.files?.[0];
    if (!f) return;
    try {
      importSnapshot(await f.text());
      msg.className = 'ac-hint ok';
      msg.textContent = 'Loaded. Its concepts are now this account\'s latest progress.';
    } catch (e) {
      msg.className = 'ac-hint bad';
      msg.textContent = (e as Error).message;
    }
  });
  return h('div', {},
    h('p', { class: 'ac-note' }, 'A file holds your Atlas records and answer log, for keeping a copy outside your account. Loading one writes its concepts over what is here.'),
    h('div', { class: 'ac-actions' }, save, load, input), msg);
}
