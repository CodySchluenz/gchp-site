import { describe, it, expect, afterEach, vi } from 'vitest';
import { sendEmail } from '../src/lib/email/send';

const env = { RESEND_API_KEY: 'k', EMAIL_FROM: 'f@x.co', EMAIL_REPLY_TO: 'r@x.co' };
const email = { subject: 's', html: '<p>h</p>', text: 't' };

afterEach(() => vi.unstubAllGlobals());

describe('sendEmail', () => {
  it('returns sent:true on 200', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('{"id":"1"}', { status: 200 })));
    expect(await sendEmail(env, 'to@x.co', email)).toEqual({ sent: true });
  });

  it('includes the Resend error body detail on failure', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response('{"message":"Domain not verified"}', { status: 403 })),
    );
    const r = await sendEmail(env, 'to@x.co', email);
    expect(r.sent).toBe(false);
    if (!r.sent) {
      expect(r.error).toContain('403');
      expect(r.error).toContain('Domain not verified');
    }
  });

  it('omits the detail suffix when the body is empty', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('', { status: 500 })));
    const r = await sendEmail(env, 'to@x.co', email);
    if (!r.sent) expect(r.error).toBe('Resend responded 500');
  });

  it('never throws on network failure', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => { throw new Error('boom'); }));
    const r = await sendEmail(env, 'to@x.co', email);
    expect(r).toEqual({ sent: false, error: 'boom' });
  });
});
