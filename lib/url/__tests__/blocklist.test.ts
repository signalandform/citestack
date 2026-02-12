import { describe, expect, it } from 'vitest';
import { isBlockedUrl } from '../blocklist';

describe('isBlockedUrl', () => {
  it('blocks localhost', () => {
    expect(isBlockedUrl('http://localhost/')).toBe(true);
    expect(isBlockedUrl('https://localhost:3000/path')).toBe(true);
    expect(isBlockedUrl('http://localhost')).toBe(true);
  });

  it('blocks 127.0.0.0/8', () => {
    expect(isBlockedUrl('http://127.0.0.1/')).toBe(true);
    expect(isBlockedUrl('https://127.0.0.1:8080')).toBe(true);
    expect(isBlockedUrl('http://127.255.255.255')).toBe(true);
  });

  it('blocks 0.0.0.0', () => {
    expect(isBlockedUrl('http://0.0.0.0/')).toBe(true);
  });

  it('blocks 10.0.0.0/8 (private)', () => {
    expect(isBlockedUrl('http://10.0.0.1/')).toBe(true);
    expect(isBlockedUrl('https://10.255.255.255')).toBe(true);
  });

  it('blocks 172.16.0.0/12 (private)', () => {
    expect(isBlockedUrl('http://172.16.0.1/')).toBe(true);
    expect(isBlockedUrl('http://172.31.255.255/')).toBe(true);
  });

  it('allows 172.15.x.x and 172.32.x.x', () => {
    expect(isBlockedUrl('http://172.15.0.1/')).toBe(false);
    expect(isBlockedUrl('http://172.32.0.1/')).toBe(false);
  });

  it('blocks 192.168.0.0/16 (private)', () => {
    expect(isBlockedUrl('http://192.168.0.1/')).toBe(true);
    expect(isBlockedUrl('https://192.168.1.1')).toBe(true);
  });

  it('blocks 169.254.0.0/16 (link-local/metadata)', () => {
    expect(isBlockedUrl('http://169.254.169.254/latest/meta-data/')).toBe(true);
    expect(isBlockedUrl('http://169.254.0.1')).toBe(true);
  });

  it('blocks ::1 (IPv6 loopback)', () => {
    expect(isBlockedUrl('http://[::1]/')).toBe(true);
    expect(isBlockedUrl('http://::1/')).toBe(true);
  });

  it('allows valid public URLs', () => {
    expect(isBlockedUrl('https://example.com/')).toBe(false);
    expect(isBlockedUrl('https://www.google.com/search')).toBe(false);
    expect(isBlockedUrl('http://8.8.8.8/')).toBe(false);
    expect(isBlockedUrl('https://api.github.com')).toBe(false);
  });

  it('blocks empty or invalid URLs', () => {
    expect(isBlockedUrl('')).toBe(true);
    expect(isBlockedUrl('   ')).toBe(true);
    expect(isBlockedUrl('not-a-url')).toBe(true);
  });
});
