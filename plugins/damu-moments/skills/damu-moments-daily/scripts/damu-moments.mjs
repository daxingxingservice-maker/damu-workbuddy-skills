#!/usr/bin/env node

import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

const API_URL = (process.env.DAMU_MOMENTS_API_URL ||
  'https://pro137agent.cn/api/workbuddy/knowledge').replace(/\/+$/, '');
const API_TOKEN = process.env.DAMU_MOMENTS_API_TOKEN || '';
const DATA_DIR = process.env.DAMU_MOMENTS_DATA_DIR || path.join(os.homedir(), '.damu-moments');
const HISTORY_PATH = path.join(DATA_DIR, 'history.json');
const CACHE_DIR = path.join(DATA_DIR, 'cache');

function parseArgs(values) {
  const result = { _: [] };
  for (let index = 0; index < values.length; index += 1) {
    const value = values[index];
    if (!value.startsWith('--')) {
      result._.push(value);
      continue;
    }
    const [rawKey, inline] = value.slice(2).split(/=(.*)/s);
    if (inline !== undefined) {
      result[rawKey] = inline;
      continue;
    }
    const next = values[index + 1];
    if (next && !next.startsWith('--')) {
      result[rawKey] = next;
      index += 1;
    } else {
      result[rawKey] = true;
    }
  }
  return result;
}

function output(value) {
  process.stdout.write(`${JSON.stringify(value, null, 2)}\n`);
}

function required(args, key) {
  const value = typeof args[key] === 'string' ? args[key].trim() : '';
  if (!value) throw new Error(`缺少 --${key}`);
  return value;
}

function sourceIds(value) {
  return [...new Set(String(value || '').split(',').map(item => item.trim()).filter(Boolean))];
}

function cacheKey(query, source, limit) {
  return createHash('sha256').update(`${query}\u0000${source}\u0000${limit}`).digest('hex');
}

async function readJson(filePath, fallback) {
  try {
    return JSON.parse(await readFile(filePath, 'utf8'));
  } catch (error) {
    if (error?.code === 'ENOENT') return fallback;
    throw error;
  }
}

async function writeJson(filePath, value) {
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

async function requestJson(pathname) {
  const headers = { Accept: 'application/json' };
  if (API_TOKEN) headers.Authorization = `Bearer ${API_TOKEN}`;
  const response = await fetch(`${API_URL}${pathname}`, {
    headers,
    signal: AbortSignal.timeout(20_000),
  });
  const payload = await response.json().catch(() => null);
  if (!response.ok || !payload || payload.code !== 0) {
    throw new Error(payload?.message || `达目社知识接口返回 ${response.status}`);
  }
  return payload.data;
}

function normalizedText(value) {
  return value.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, '');
}

function bigrams(value) {
  const normalized = normalizedText(value);
  const grams = new Set();
  if (normalized.length < 2) {
    if (normalized) grams.add(normalized);
    return grams;
  }
  for (let index = 0; index < normalized.length - 1; index += 1) {
    grams.add(normalized.slice(index, index + 2));
  }
  return grams;
}

function similarity(left, right) {
  const a = bigrams(left);
  const b = bigrams(right);
  if (a.size === 0 || b.size === 0) return 0;
  let intersection = 0;
  for (const value of a) if (b.has(value)) intersection += 1;
  return intersection / (a.size + b.size - intersection);
}

async function status() {
  output({ apiUrl: API_URL, ...(await requestJson('/status')) });
}

async function search(args) {
  const query = required(args, 'query');
  const limit = Math.max(1, Math.min(Number(args.limit) || 8, 12));
  const source = ['all', 'wiki', 'daily-topic'].includes(args.source) ? args.source : 'all';
  const key = cacheKey(query, source, limit);
  const filePath = path.join(CACHE_DIR, `${key}.json`);
  try {
    const data = await requestJson(
      `/search?q=${encodeURIComponent(query)}&limit=${limit}&source=${encodeURIComponent(source)}`
    );
    const stored = { cachedAt: new Date().toISOString(), data };
    await writeJson(filePath, stored);
    output({ cache: 'fresh', ...data });
  } catch (error) {
    const cached = await readJson(filePath, null);
    const ageMs = cached ? Date.now() - new Date(cached.cachedAt).getTime() : Number.POSITIVE_INFINITY;
    if (cached && ageMs <= 24 * 60 * 60 * 1000) {
      output({ cache: 'fallback', cacheAgeMinutes: Math.round(ageMs / 60_000), ...cached.data });
      return;
    }
    throw error;
  }
}

async function readHistory() {
  const history = await readJson(HISTORY_PATH, { version: 1, entries: [] });
  if (!Array.isArray(history.entries)) return { version: 1, entries: [] };
  return history;
}

async function check(args) {
  const text = required(args, 'text');
  const angle = required(args, 'angle');
  const sources = sourceIds(required(args, 'source-ids'));
  const history = await readHistory();
  const now = Date.now();
  const ranked = history.entries
    .map(entry => ({
      id: entry.id,
      createdAt: entry.createdAt,
      angle: entry.angle,
      preview: entry.text.slice(0, 60),
      textSimilarity: similarity(text, entry.text),
      openingSimilarity: similarity(text.slice(0, 36), entry.text.slice(0, 36)),
    }))
    .sort((a, b) => b.textSimilarity - a.textSimilarity);
  const sourceRepeat = history.entries.find(entry => {
    const age = now - new Date(entry.createdAt).getTime();
    return age <= 7 * 24 * 60 * 60 * 1000 && entry.sourceIds.some(id => sources.includes(id));
  });
  const angleRepeat = history.entries.find(entry => {
    const age = now - new Date(entry.createdAt).getTime();
    return age <= 30 * 24 * 60 * 60 * 1000 && normalizedText(entry.angle) === normalizedText(angle);
  });
  const closest = ranked[0] || null;
  const reasons = [];
  if (sourceRepeat) reasons.push('同一来源在 7 天内已使用');
  if (angleRepeat) reasons.push('同一角度在 30 天内已使用');
  if (closest?.textSimilarity >= 0.72) reasons.push('正文相似度达到 0.72');
  if (closest?.openingSimilarity >= 0.78) reasons.push('开头与历史内容高度相似');
  output({
    pass: reasons.length === 0,
    reasons,
    sourceRepeat: sourceRepeat?.id || null,
    angleRepeat: angleRepeat?.id || null,
    closest,
    historyCount: history.entries.length,
  });
}

async function record(args) {
  if (args.confirmed !== true) throw new Error('只有用户确认已发布后才能添加 --confirmed');
  const text = required(args, 'text');
  const angle = required(args, 'angle');
  const sources = sourceIds(required(args, 'source-ids'));
  const history = await readHistory();
  const id = createHash('sha256')
    .update(`${new Date().toISOString()}\u0000${text}`)
    .digest('hex')
    .slice(0, 16);
  history.entries.push({
    id,
    createdAt: new Date().toISOString(),
    sourceIds: sources,
    angle,
    text,
    textHash: createHash('sha256').update(text).digest('hex'),
  });
  await writeJson(HISTORY_PATH, history);
  output({ recorded: true, id, historyCount: history.entries.length });
}

async function listHistory(args) {
  const limit = Math.max(1, Math.min(Number(args.limit) || 20, 100));
  const history = await readHistory();
  output({
    historyCount: history.entries.length,
    entries: history.entries
      .slice(-limit)
      .reverse()
      .map(entry => ({
        id: entry.id,
        createdAt: entry.createdAt,
        sourceIds: entry.sourceIds,
        angle: entry.angle,
        preview: entry.text.slice(0, 80),
      })),
  });
}

async function main() {
  const [command = '', ...rest] = process.argv.slice(2);
  const args = parseArgs(rest);
  if (command === 'status') return status();
  if (command === 'search') return search(args);
  if (command === 'check') return check(args);
  if (command === 'record') return record(args);
  if (command === 'history') return listHistory(args);
  throw new Error('用法：damu-moments.mjs <status|search|check|record|history> [参数]');
}

main().catch(error => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
});
