/**
 * @jest-environment jsdom
 */
import urlBase64ToUint8Array from '@/app/lib/helpers';

describe('urlBase64ToUint8Array', () => {
  // A known VAPID public key (base64url-encoded) and its expected decoded bytes
  const knownBase64Url =
    'BEl62iUYgUivxIkv69yViXuGAREzBVMSR8dDpA6cPDOJmWSMRE1a2nwsKJsl7LNzMv9M3PC0IVKZ1REKJRK0KYo';

  it('converts a known VAPID key to Uint8Array', () => {
    const result = urlBase64ToUint8Array(knownBase64Url);
    expect(result).toBeInstanceOf(Uint8Array);
    expect(result.length).toBe(65); // VAPID public keys are 65 bytes uncompressed
    // First byte of an uncompressed EC P-256 key is always 0x04
    expect(result[0]).toBe(0x04);
  });

  it('handles strings that need padding', () => {
    // "ab" in base64 is "YWI" (3 chars, needs 1 pad character)
    const result = urlBase64ToUint8Array('YWI');
    expect(result.length).toBe(2);
    expect(result[0]).toBe('a'.charCodeAt(0));
    expect(result[1]).toBe('b'.charCodeAt(0));
  });

  it('handles empty string input', () => {
    const result = urlBase64ToUint8Array('');
    expect(result).toBeInstanceOf(Uint8Array);
    expect(result.length).toBe(0);
  });
});
