import { describe, expect, it } from 'vitest';
import {
  NAV_SEARCH_PAGE_META,
  classifyNavQuery,
  isNavIntentQuery,
  pageMatchesNavQuery,
  type NavSearchPage,
} from './nav-search';

function page(route: string, label: string, hint = 'تعليم'): NavSearchPage {
  return {
    route,
    label,
    hint,
    meta: NAV_SEARCH_PAGE_META[route] ?? { aliases: [], capabilities: [] },
  };
}

describe('nav search', () => {
  it('treats إضافة / تعديل as create and edit intents', () => {
    expect(classifyNavQuery('إضافة').add).toBe(true);
    expect(classifyNavQuery('اضافة').add).toBe(true);
    expect(classifyNavQuery('تعديل').edit).toBe(true);
    expect(isNavIntentQuery('إضافة')).toBe(true);
    expect(isNavIntentQuery('شعبة')).toBe(false);
  });

  it('finds the sections page from شعبة / الشعب', () => {
    const sections = page('/Education/Sections', 'الشعب');
    expect(pageMatchesNavQuery(sections, 'شعبة')).toBe(true);
    expect(pageMatchesNavQuery(sections, 'الشعب')).toBe(true);
    expect(pageMatchesNavQuery(sections, 'section')).toBe(true);
    expect(pageMatchesNavQuery(page('/Education/Subjects', 'المواد'), 'شعبة')).toBe(false);
  });

  it('lists every addable page for إضافة and every editable page for تعديل', () => {
    const addable = page('/Education/Sections', 'الشعب');
    const editable = page('/Users', 'المستخدمين', 'إدارة');
    const viewOnly = page('/Dashboard', 'لوحة التحكم', 'نظرة عامة');

    expect(pageMatchesNavQuery(addable, 'إضافة')).toBe(true);
    expect(pageMatchesNavQuery(editable, 'إضافة')).toBe(true);
    expect(pageMatchesNavQuery(viewOnly, 'إضافة')).toBe(false);

    expect(pageMatchesNavQuery(addable, 'تعديل')).toBe(true);
    expect(pageMatchesNavQuery(editable, 'تعديل')).toBe(true);
    expect(pageMatchesNavQuery(viewOnly, 'تعديل')).toBe(false);
  });

  it('narrows إضافة شعبة to the sections page', () => {
    const sections = page('/Education/Sections', 'الشعب');
    const users = page('/Users', 'المستخدمين', 'إدارة');
    expect(pageMatchesNavQuery(sections, 'إضافة شعبة')).toBe(true);
    expect(pageMatchesNavQuery(users, 'إضافة شعبة')).toBe(false);
  });

  it('finds compound lock access from كمباوند', () => {
    const access = page('/CompoundAccess', 'صلاحية أقفال الكمباوند', 'عقارات');
    expect(pageMatchesNavQuery(access, 'كمباوند')).toBe(true);
    expect(pageMatchesNavQuery(access, 'صلاحية')).toBe(true);
  });
});
