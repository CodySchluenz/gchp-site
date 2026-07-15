import { describe, it, expect } from 'vitest';
import { transformDonors } from './transform-donors.mjs';

describe('transformDonors', () => {
  it('maps donor fields and keeps every row', () => {
    const rows = [
      { donID: 1, donName: 'Allegiant Oil', donContact: 'Jane', address: '190 N 2nd', city: 'Platteville', state: 'WI', zip: '53818', phone: '555', email: 'j@x.co' },
      { donID: 2, donName: 'Acme', donContact: null, address: null, city: null, state: null, zip: null, phone: '5551', email: null },
    ];
    const { donors } = transformDonors(rows);
    expect(donors.length).toBe(2);
    expect(donors[0]).toEqual({ name: 'Allegiant Oil', contact_person: 'Jane', address: '190 N 2nd', city: 'Platteville', state: 'WI', zip: '53818', phone: '555', email: 'j@x.co' });
    expect(donors[1]).toEqual({ name: 'Acme', contact_person: '', address: '', city: '', state: '', zip: '', phone: '5551', email: '' });
  });

  it('flags likely-junk rows (too short, no letters, or no contact info) but keeps them', () => {
    const rows = [
      { donName: 'buspar', donContact: '', address: '', city: '', state: '', zip: '', phone: '', email: '' }, // no contact info
      { donName: 'gh', donContact: '', address: '', city: '', state: '', zip: '', phone: '', email: '' },      // too short + no contact
      { donName: '1234', donContact: 'x', address: '', city: '', state: '', zip: '', phone: '', email: '' },   // no letters
      { donName: 'Real Donor', donContact: 'Bob', address: '1 St', city: 'Lancaster', state: 'WI', zip: '53813', phone: '555', email: '' },
    ];
    const { donors, flagged } = transformDonors(rows);
    expect(donors.length).toBe(4);
    expect(flagged).toContain('buspar');
    expect(flagged).toContain('gh');
    expect(flagged).toContain('1234');
    expect(flagged).not.toContain('Real Donor');
  });
});
