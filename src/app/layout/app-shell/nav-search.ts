export type NavSearchCapability = 'add' | 'edit';

export interface NavSearchPageMeta {
  aliases: string[];
  capabilities: NavSearchCapability[];
  addRoute?: string;
}

export interface NavSearchPage {
  route: string;
  label: string;
  hint: string;
  meta: NavSearchPageMeta;
}

const ADD_SYNONYMS = new Set([
  'اضافه',
  'اضف',
  'جديد',
  'انشاء',
  'انشئ',
  'add',
  'new',
  'create',
]);

const EDIT_SYNONYMS = new Set([
  'تعديل',
  'عدل',
  'تحرير',
  'edit',
  'update',
  'modify',
]);

export const NAV_SEARCH_PAGE_META: Record<string, NavSearchPageMeta> = {
  '/Dashboard': {
    aliases: ['home', 'overview', 'dashboard', 'لوحة', 'تحكم', 'رئيسية'],
    capabilities: [],
  },
  '/Reservations': {
    aliases: ['booking', 'bookings', 'reservation', 'حجز', 'حجوزات', 'ضيف'],
    capabilities: ['add', 'edit'],
    addRoute: '/Reservations/New',
  },
  '/RoomStatus': {
    aliases: ['occupancy', 'rooms', 'status', 'غرف', 'حالة', 'اشغال'],
    capabilities: [],
  },
  '/Holidays': {
    aliases: ['holiday', 'holidays', 'عطله', 'عطل', 'اجازه'],
    capabilities: ['add', 'edit'],
  },
  '/Property': {
    aliases: [
      'property',
      'building',
      'compound',
      'facility',
      'room',
      'عقار',
      'عقارات',
      'مبنى',
      'مباني',
      'مجمع',
      'غرفه',
      'مرفق',
    ],
    capabilities: ['add', 'edit'],
  },
  '/Locks': {
    aliases: ['lock', 'locks', 'قفل', 'اقفال'],
    capabilities: ['add', 'edit'],
  },
  '/Reports': {
    aliases: ['report', 'reports', 'تقرير', 'تقارير'],
    capabilities: [],
  },
  '/Education/Subjects': {
    aliases: ['subject', 'subjects', 'course', 'ماده', 'مواد', 'مقرر'],
    capabilities: ['add', 'edit'],
  },
  '/Education/Sections': {
    aliases: ['section', 'sections', 'شعبه', 'شعب', 'شعب دراسيه', 'سكشن'],
    capabilities: ['add', 'edit'],
  },
  '/Education/Schedule': {
    aliases: ['schedule', 'timetable', 'جدول', 'مواعيد', 'موعد'],
    capabilities: [],
  },
  '/Education/Enrollments': {
    aliases: ['enrollment', 'enroll', 'registration', 'تسجيل', 'تسجيلات', 'قيد'],
    capabilities: ['add', 'edit'],
  },
  '/Education/Terms': {
    aliases: ['term', 'semester', 'فصل', 'فصول', 'ترم'],
    capabilities: ['add', 'edit'],
  },
  '/Education/EnrollmentHistory': {
    aliases: ['history', 'archive', 'سجل', 'ارشيف'],
    capabilities: [],
  },
  '/Education/CompoundAccess': {
    aliases: ['compound', 'access', 'كمباوند', 'مجمع', 'صلاحية', 'اقفال'],
    capabilities: ['add', 'edit'],
  },
  '/Education/Reports': {
    aliases: ['education reports', 'تقارير التعليم'],
    capabilities: [],
  },
  '/Users': {
    aliases: ['user', 'users', 'student', 'people', 'مستخدم', 'مستخدمين', 'طالب', 'طلاب'],
    capabilities: ['add', 'edit'],
  },
  '/Admins': {
    aliases: ['admin', 'admins', 'مشرف', 'مشرفون', 'ادمن'],
    capabilities: ['add', 'edit'],
  },
  '/Roles': {
    aliases: ['role', 'roles', 'permission', 'دور', 'ادوار', 'صلاحيات'],
    capabilities: ['add', 'edit'],
  },
  '/Settings': {
    aliases: ['settings', 'preferences', 'اعدادات'],
    capabilities: [],
  },
};

export function normalizeNavQuery(value: string): string {
  return value
    .normalize('NFKD')
    .toLowerCase()
    .replace(/[\u064B-\u065F\u0670\u0640]/g, '')
    .replace(/[إأآٱ]/g, 'ا')
    .replace(/ى/g, 'ي')
    .replace(/ؤ/g, 'و')
    .replace(/ئ/g, 'ي')
    .replace(/ة/g, 'ه')
    .replace(/[^\p{L}\p{N}\s]+/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function tokenizeNavQuery(value: string): string[] {
  return normalizeNavQuery(value)
    .split(' ')
    .map((token) => token.replace(/^ال/, ''))
    .filter((token) => token.length >= 2);
}

export function classifyNavQuery(raw: string): {
  rest: string[];
  add: boolean;
  edit: boolean;
} {
  const tokens = tokenizeNavQuery(raw);
  return {
    add: tokens.some((token) => ADD_SYNONYMS.has(token)),
    edit: tokens.some((token) => EDIT_SYNONYMS.has(token)),
    rest: tokens.filter((token) => !ADD_SYNONYMS.has(token) && !EDIT_SYNONYMS.has(token)),
  };
}

function tokenMatches(queryToken: string, hayToken: string): boolean {
  if (queryToken === hayToken) {
    return true;
  }
  if (queryToken.length >= 2 && hayToken.includes(queryToken)) {
    return true;
  }
  return hayToken.length >= 3 && queryToken.includes(hayToken);
}

function corpusTokens(page: NavSearchPage): string[] {
  const routeBits = page.route
    .split('/')
    .filter(Boolean)
    .map((part) => part.replace(/([a-z])([A-Z])/g, '$1 $2'));
  return tokenizeNavQuery(
    [page.label, page.hint, ...routeBits, ...page.meta.aliases].join(' '),
  );
}

export function pageMatchesNavQuery(page: NavSearchPage, raw: string): boolean {
  const query = classifyNavQuery(raw);
  if (!query.add && !query.edit && !query.rest.length) {
    return false;
  }

  const wantsAdd = query.add;
  const wantsEdit = query.edit;
  if (wantsAdd && wantsEdit) {
    if (
      !page.meta.capabilities.includes('add') &&
      !page.meta.capabilities.includes('edit')
    ) {
      return false;
    }
  } else if (wantsAdd && !page.meta.capabilities.includes('add')) {
    return false;
  } else if (wantsEdit && !page.meta.capabilities.includes('edit')) {
    return false;
  }

  if (!query.rest.length) {
    return wantsAdd || wantsEdit;
  }

  const hay = corpusTokens(page);
  return query.rest.every((token) => hay.some((part) => tokenMatches(token, part)));
}

export function isNavIntentQuery(raw: string): boolean {
  const query = classifyNavQuery(raw);
  return query.add || query.edit;
}
