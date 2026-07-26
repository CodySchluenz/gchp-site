import { describe, it, expect } from 'vitest';
import { duplicateKey, findDuplicateIds } from '../src/lib/duplicates';

describe('duplicateKey', () => {
  it('normalizes case and whitespace', () => {
    expect(duplicateKey(' Smith ', '123  Oak   St')).toBe('smith|123 oak st');
    expect(duplicateKey('SMITH', '123 Oak St')).toBe('smith|123 oak st');
  });
  it('blank name or address never keys', () => {
    expect(duplicateKey('', '123 Oak St')).toBeNull();
    expect(duplicateKey('Smith', '   ')).toBeNull();
  });
});

describe('findDuplicateIds', () => {
  const r = (id: number, last_name: string, address: string) => ({ id, last_name, address });
  it('flags every member of a matching group, including three-way', () => {
    const ids = findDuplicateIds([
      r(1, 'Smith', '123 Oak St'), r(2, 'smith ', ' 123  oak st'), r(3, 'Smith', '123 Oak St'),
      r(4, 'Jones', '5 Elm'), r(5, 'Jones', '9 Pine'),
    ]);
    expect([...ids].sort()).toEqual([1, 2, 3]);
  });
  it('blank rows never match each other', () => {
    expect(findDuplicateIds([r(1, 'TEST', ''), r(2, 'TEST', '')]).size).toBe(0);
  });
});
