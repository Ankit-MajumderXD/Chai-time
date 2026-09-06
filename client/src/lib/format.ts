/**
 * Small human-facing formatters. The whole app speaks in "2 min ago", not
 * "2026-09-05T18:04:11Z".
 */
import type { Timestamp } from 'spacetimedb';

export function toMillis(ts: Timestamp): number {
  return Number(ts.microsSinceUnixEpoch / 1000n);
}

export function timeAgo(ts: Timestamp, now = Date.now()): string {
  const seconds = Math.max(0, Math.round((now - toMillis(ts)) / 1000));
  if (seconds < 45) return 'just now';
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  if (days === 1) return 'yesterday';
  if (days < 7) return `${days}d ago`;
  return new Date(toMillis(ts)).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
  });
}

/** Clock time like "8:04 PM" — used by the room replay timeline. */
export function clockTime(ms: number): string {
  return new Date(ms).toLocaleTimeString(undefined, {
    hour: 'numeric',
    minute: '2-digit',
  });
}

export function shortTimeAgo(ts: Timestamp, now = Date.now()): string {
  const seconds = Math.max(0, Math.round((now - toMillis(ts)) / 1000));
  if (seconds < 60) return 'now';
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h`;
  return `${Math.round(hours / 24)}d`;
}

export function greeting(date = new Date()): string {
  const hour = date.getHours();
  if (hour < 5) return 'Still up';
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  if (hour < 22) return 'Good evening';
  return 'Good night';
}

export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export function firstName(name: string): string {
  return name.trim().split(/\s+/)[0] || name;
}

/** "5 members · 3 active" */
export function memberSummary(total: number, active: number): string {
  const people = `${total} member${total === 1 ? '' : 's'}`;
  return active > 0 ? `${people} · ${active} active` : people;
}

export function handleFrom(name: string): string {
  return (
    name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '')
      .slice(0, 18) || 'friend'
  );
}

/** Deterministic 0..n-1 from any string — used to pick a stable pastel. */
export function hashIndex(input: string, buckets: number): number {
  let hash = 0;
  for (let i = 0; i < input.length; i++) {
    hash = (hash * 31 + input.charCodeAt(i)) >>> 0;
  }
  return hash % buckets;
}
