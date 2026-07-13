export type ContactInput = { name?: string; email?: string; message?: string; website?: string };

export type ContactValues = { name: string; email: string; message: string };

export type ContactResult =
  | { ok: true; spam: false; values: ContactValues }
  | { ok: true; spam: true }
  | { ok: false; errors: Record<string, string>; values: ContactValues };

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function validateContact(input: ContactInput): ContactResult {
  // "website" is a honeypot field hidden from humans; only bots fill it.
  if ((input.website ?? '').trim() !== '') return { ok: true, spam: true };

  const values: ContactValues = {
    name: (input.name ?? '').trim(),
    email: (input.email ?? '').trim(),
    message: (input.message ?? '').trim(),
  };

  const errors: Record<string, string> = {};
  if (values.email === '') {
    errors.email = 'Please enter your email address so we can reply to you.';
  } else if (!EMAIL_RE.test(values.email)) {
    errors.email = "That email address doesn't look quite right — please check it.";
  }
  if (values.message === '') {
    errors.message = 'Please write a message so we know how we can help.';
  } else if (values.message.length > 5000) {
    errors.message = 'Your message is a little too long — please shorten it.';
  }

  if (Object.keys(errors).length > 0) return { ok: false, errors, values };
  return { ok: true, spam: false, values };
}
