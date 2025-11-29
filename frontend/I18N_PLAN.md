# Chaski Internationalization Plan

This document outlines the complete plan to internationalize the Chaski application for English, French, and Spanish.

## ✅ Phase 0: Infrastructure (COMPLETED)

- [x] Install `next-intl` package
- [x] Set up locale routing with middleware
- [x] Create translation file structure (`/messages/*.json`)
- [x] Configure Next.js with i18n plugin
- [x] Create LanguageSwitcher component
- [x] Restructure app for locale-based routing
- [x] Create initial translation keys (common, nav, auth, errors, etc.)

**Status:** ✅ Complete - Infrastructure is ready!

---

## 📋 Phase 1: Translation Keys Organization (1-2 days)

### 1.1 Expand Translation Files

Create comprehensive translation key structure in `/messages/*.json`:

**File Structure:**
```
messages/
├── en.json
├── fr.json
└── es.json
```

**Key Categories to Add:**

```json
{
  "common": { ... },           // ✅ Already exists
  "nav": { ... },              // ✅ Already exists
  "auth": { ... },             // ✅ Already exists
  "errors": { ... },           // ✅ Already exists
  "validation": { ... },       // ✅ Already exists
  "packages": { ... },         // ✅ Already exists
  "status": { ... },           // ✅ Already exists
  "language": { ... },         // ✅ Already exists

  // NEW - To be added:
  "home": {
    "hero": { ... },
    "features": { ... },
    "howItWorks": { ... },
    "cta": { ... }
  },
  "dashboard": {
    "welcome": "...",
    "stats": { ... },
    "quickActions": { ... }
  },
  "courier": {
    "routes": { ... },
    "matches": { ... },
    "earnings": { ... },
    "proof": { ... }
  },
  "sender": {
    "createPackage": { ... },
    "myPackages": { ... },
    "tracking": { ... }
  },
  "admin": {
    "users": { ... },
    "packages": { ... },
    "analytics": { ... },
    "audit": { ... }
  },
  "messaging": {
    "conversation": { ... },
    "compose": { ... }
  },
  "notifications": {
    "types": { ... },
    "preferences": { ... }
  },
  "bids": {
    "create": { ... },
    "accept": { ... },
    "reject": { ... }
  },
  "payments": {
    "checkout": { ... },
    "confirmation": { ... }
  },
  "forms": {
    "labels": { ... },
    "placeholders": { ... },
    "helpers": { ... }
  }
}
```

### 1.2 Create Translation Helper

Create `/lib/i18n-helpers.ts`:
```typescript
// Helper functions for common translation patterns
export function getCurrencyFormat(locale: string) { ... }
export function getDateFormat(locale: string) { ... }
export function getNumberFormat(locale: string) { ... }
```

**Estimated Time:** 1-2 days
**Complexity:** Low-Medium

---

## 🎨 Phase 2: Frontend Translation (3-4 weeks)

### 2.1 Authentication Flow (3-4 days)

**Pages to Translate:**
- `/app/[locale]/login/page.tsx`
- `/app/[locale]/register/page.tsx`
- `/app/[locale]/verify-email/page.tsx`
- `/app/[locale]/forgot-password/page.tsx`
- `/app/[locale]/reset-password/page.tsx`
- `/app/[locale]/resend-verification/page.tsx`
- `/app/[locale]/register-success/page.tsx`
- `/app/[locale]/auth/callback/page.tsx`

**Process:**
1. Import `useTranslations` hook
2. Replace all hardcoded strings with `t('key')`
3. Add keys to all 3 language files
4. Test form validation messages in each language
5. Test OAuth callback flows

**Example:**
```typescript
// Before
<h1>Login to Chaski</h1>

// After
const t = useTranslations('auth');
<h1>{t('loginTitle')}</h1>
```

**Translation Keys Needed:**
- Form labels (email, password, name, etc.)
- Button text (login, register, submit, etc.)
- Success/error messages
- Helper text
- Validation messages

---

### 2.2 Homepage & Marketing (2-3 days)

**Pages:**
- `/app/[locale]/page.tsx` (Homepage)

**Content:**
- Hero section headline & subheadline
- Feature descriptions (3-4 features)
- How it works steps
- Call-to-action buttons
- Footer content

**Translation Considerations:**
- Marketing copy should be culturally adapted, not literal translation
- Keep CTAs short and action-oriented
- Consider using professional translation service for marketing content

---

### 2.3 Sender Dashboard & Packages (4-5 days)

**Pages:**
- `/app/[locale]/sender/page.tsx`
- `/app/[locale]/sender/analytics/page.tsx`
- `/app/[locale]/packages/create/page.tsx`
- `/app/[locale]/packages/[id]/page.tsx`

**Components:**
- Package creation wizard (multi-step form)
- Package list/grid
- Package details cards
- Status badges
- Filter/sort controls
- Analytics charts & labels

**Complex Elements:**
- Multi-step wizard text
- Dynamic status messages
- Date/time formatting
- Currency formatting
- Address input labels

---

### 2.4 Courier Dashboard & Routes (4-5 days)

**Pages:**
- `/app/[locale]/courier/page.tsx`
- `/app/[locale]/courier/routes/create/page.tsx`
- `/app/[locale]/courier/routes/[id]/matches/page.tsx`
- `/app/[locale]/courier/analytics/page.tsx`
- `/app/[locale]/courier/proof/page.tsx`

**Components:**
- Route creation form
- Route map interface
- Package matching interface
- Bid submission forms
- Delivery proof upload
- Earnings tracking

**Complex Elements:**
- Map labels and tooltips
- Distance/location formatting
- Signature pad labels
- Camera/upload interface

---

### 2.5 Admin Dashboard (3-4 days)

**Pages:**
- `/app/[locale]/admin/page.tsx`
- `/app/[locale]/admin/users/[id]/page.tsx`

**Features:**
- User management table
- Package management
- Analytics dashboard
- Audit log viewer
- Platform statistics

**Translation Needs:**
- Table headers
- Action buttons
- Status indicators
- Chart labels
- Filter controls
- Audit action descriptions

---

### 2.6 Shared Components (3-4 days)

**Components to Translate:**

1. **Navigation (`/components/Navbar.tsx`)** - ✅ Already has LanguageSwitcher
   - Menu items
   - User dropdown
   - Mobile menu

2. **Notifications (`/components/NotificationDropdown.tsx`)**
   - Notification types
   - Empty states
   - Action buttons

3. **Modals & Dialogs**
   - Confirmation dialogs
   - Rating modal
   - Bid modal
   - Delete confirmations

4. **Forms**
   - Address autocomplete
   - Location input
   - Size selector
   - Date pickers

5. **UI Components**
   - Alert messages
   - Toast notifications
   - Loading states
   - Empty states
   - Error boundaries

6. **Cards & Display**
   - Package cards
   - Route cards
   - User cards
   - Delivery proof cards

---

### 2.7 Messaging & Notifications (2-3 days)

**Pages:**
- `/app/[locale]/messages/page.tsx`
- `/app/[locale]/notifications/page.tsx`

**Features:**
- Message composer
- Conversation list
- Message threads
- Notification list
- Notification preferences

---

### 2.8 Profile & Settings (1-2 days)

**Pages:**
- `/app/[locale]/profile/reviews/page.tsx`
- `/app/[locale]/users/[id]/page.tsx`

**Features:**
- Review display
- Rating system
- User profiles
- Settings forms

---

## 🔧 Phase 3: Backend Translation (1-2 weeks)

### 3.1 API Error Messages (2-3 days)

**Approach:**
1. Create error message translation files in backend
2. Accept `Accept-Language` header from frontend
3. Return translated error messages

**Files to Update:**
- `backend/app/routes/*.py` (all route files)
- Create `backend/app/i18n/messages.py` for translations

**Example:**
```python
# backend/app/i18n/messages.py
ERRORS = {
    'en': {
        'user_not_found': 'User not found',
        'invalid_credentials': 'Invalid email or password'
    },
    'fr': {
        'user_not_found': 'Utilisateur non trouvé',
        'invalid_credentials': 'Email ou mot de passe invalide'
    },
    'es': {
        'user_not_found': 'Usuario no encontrado',
        'invalid_credentials': 'Email o contraseña inválidos'
    }
}
```

**API Endpoints to Update:**
- Authentication errors
- Validation errors
- Business logic errors
- Not found errors

---

### 3.2 Email Templates (3-4 days)

**Email Templates in `backend/app/utils/email.py`:**

1. **Verification Email**
   - Subject line
   - Body content
   - CTA button text

2. **Welcome Email**
   - Subject
   - Greeting
   - Getting started content

3. **Password Reset Email**
   - Subject
   - Instructions
   - Reset link button

4. **Notification Emails**
   - Package matched
   - Bid received
   - Delivery confirmed
   - Payment received

**Implementation:**
```python
# Create template per language
templates = {
    'en': 'verification_en.html',
    'fr': 'verification_fr.html',
    'es': 'verification_es.html'
}

# Select based on user's preferred language
template = templates.get(user.preferred_language, 'en')
```

**Email Considerations:**
- Professional translation recommended
- Test email rendering in multiple clients
- Keep subject lines under 50 characters
- Use responsive HTML templates

---

## 🧪 Phase 4: Testing & QA (1-2 weeks)

### 4.1 Functional Testing

**Test Plan:**

1. **Language Switching**
   - Switch languages mid-session
   - Verify URL updates correctly
   - Verify state persists across navigation
   - Test browser back/forward buttons

2. **Page-by-Page Testing**
   - Load each page in all 3 languages
   - Verify all text is translated
   - Check for layout breaks (text overflow)
   - Verify forms work in all languages

3. **User Flows**
   - Complete registration in each language
   - Create package in each language
   - Accept bid in each language
   - Send message in each language

4. **Edge Cases**
   - Very long translations (German words)
   - RTL languages (future: Arabic)
   - Special characters (accents, ñ, etc.)
   - Pluralization rules

### 4.2 Visual Testing

**Checklist:**
- [ ] Text fits in buttons (no overflow)
- [ ] Labels don't wrap unexpectedly
- [ ] Modal dialogs resize properly
- [ ] Mobile responsive in all languages
- [ ] Forms maintain alignment
- [ ] Navigation doesn't break

### 4.3 Automated Testing

**Add to existing test suites:**

```typescript
// frontend/app/__tests__/i18n.test.tsx
describe('Internationalization', () => {
  it('switches language when dropdown changed', () => { ... });
  it('persists language preference', () => { ... });
  it('translates page content', () => { ... });
});
```

---

## 📝 Phase 5: Documentation (2-3 days)

### 5.1 Developer Documentation

**Create `/docs/i18n-guide.md`:**

```markdown
# Internationalization Guide

## Adding New Translations

1. Add keys to all language files
2. Use `useTranslations()` hook
3. Test in all languages

## Translation Key Naming

- Use dot notation: `auth.login.title`
- Be specific: `packages.create.step1.title`
- Group related keys

## Common Patterns

### Client Components
\`\`\`typescript
'use client';
import { useTranslations } from 'next-intl';

export default function Component() {
  const t = useTranslations('namespace');
  return <h1>{t('key')}</h1>;
}
\`\`\`

### Server Components
\`\`\`typescript
import { getTranslations } from 'next-intl/server';

export default async function Page() {
  const t = await getTranslations('namespace');
  return <h1>{t('key')}</h1>;
}
\`\`\`
```

### 5.2 Translation Guidelines

**Create `/messages/TRANSLATION_GUIDE.md`:**

- Tone and voice guidelines
- Terminology glossary
- Formatting standards
- Cultural considerations

### 5.3 Update README

Add i18n section to main README:
- Supported languages
- How to add new language
- Translation contribution process

---

## 📊 Estimated Timeline Summary

| Phase | Description | Duration | Complexity |
|-------|-------------|----------|------------|
| **Phase 0** | Infrastructure | ✅ Done | Medium |
| **Phase 1** | Translation Keys | 1-2 days | Low |
| **Phase 2** | Frontend Translation | 3-4 weeks | Medium-High |
| **Phase 3** | Backend Translation | 1-2 weeks | Medium |
| **Phase 4** | Testing & QA | 1-2 weeks | Medium |
| **Phase 5** | Documentation | 2-3 days | Low |
| **Total** | | **6-9 weeks** | |

---

## 🎯 Quick Start: Next Steps

### Option A: Incremental Approach (Recommended)

Start with high-traffic pages:

1. **Week 1-2:** Homepage + Authentication
2. **Week 3-4:** Sender Dashboard + Package Creation
3. **Week 5-6:** Courier Dashboard
4. **Week 7-8:** Admin + Remaining Pages
5. **Week 9:** Testing + Polish

### Option B: Module-by-Module

Complete one user journey at a time:

1. **Auth Flow:** Login → Register → Verify
2. **Sender Journey:** Dashboard → Create Package → Track
3. **Courier Journey:** Routes → Matches → Delivery
4. **Admin:** User Management → Analytics

---

## 🔑 Key Considerations

### Translation Quality

- **DIY Translations:** Fast but may have errors
- **Machine Translation:** Quick first pass, needs review
- **Professional Service:** Best quality, costs $0.10-0.20/word
- **Community Contributions:** Crowdsource from users

**Recommended:** Use machine translation for initial pass, then hire native speakers to review and refine.

### Maintenance

- Keep translation keys organized
- Document all new keys
- Use TypeScript for type safety
- Set up translation validation CI checks

### Performance

- next-intl loads only needed locale
- Messages are cached
- No impact on bundle size per-locale

---

## 📚 Resources

- [next-intl Documentation](https://next-intl-docs.vercel.app/)
- [Next.js i18n Routing](https://nextjs.org/docs/app/building-your-application/routing/internationalization)
- [Google Translation API](https://cloud.google.com/translate)
- [DeepL API](https://www.deepl.com/pro-api) (Higher quality)
- [Phrase](https://phrase.com/) (Translation management)

---

## ✅ Success Metrics

- [ ] All user-facing text translated
- [ ] No hardcoded English strings
- [ ] Language switcher works on all pages
- [ ] Forms work in all languages
- [ ] Emails sent in user's language
- [ ] API errors returned in request language
- [ ] Tests pass for all locales
- [ ] Documentation complete

---

**Ready to start?** Begin with Phase 1 or pick a specific page to translate as a pilot!
