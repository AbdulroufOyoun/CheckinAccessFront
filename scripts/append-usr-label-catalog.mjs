#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const catalogPath = path.join(__dirname, 'tenant-label-catalog.json');
const enPath = path.join(__dirname, '../src/assets/i18n/en.json');

const catalog = JSON.parse(fs.readFileSync(catalogPath, 'utf8'));
const en = JSON.parse(fs.readFileSync(enPath, 'utf8'));
const existing = new Set(catalog.entries.map((e) => e.key));

const usrKeys = Object.keys(en)
  .filter((k) => k.startsWith('USR_') && !existing.has(k))
  .sort();

for (const key of usrKeys) {
  catalog.entries.push({
    key,
    module: 'admin',
    page: 'users',
    kind: 'label',
    phase: 1,
  });
}

let usersGroup = catalog.groups.find((g) => g.id === 'users_pages');
if (!usersGroup) {
  usersGroup = {
    id: 'users_pages',
    titleKey: 'SET_TENANT_LABELS_GROUP_USERS',
    hintKey: 'SET_TENANT_LABELS_GROUP_USERS_HINT',
    module: 'admin',
    keys: [],
  };
  catalog.groups.push(usersGroup);
}

for (const key of usrKeys) {
  if (!usersGroup.keys.includes(key)) {
    usersGroup.keys.push(key);
  }
}

fs.writeFileSync(catalogPath, `${JSON.stringify(catalog, null, 2)}\n`);
console.log(`Added ${usrKeys.length} USR_ keys to catalog.`);
