# Website Development Roadmap — Phase 1 Foundation

## Phase 0 — Define the Product

- [ ] Clearly define what the website does.
- [ ] Define the target users.
- [ ] Define the core problem the website solves.
- [ ] Write down the **MVP features only**.
- [ ] Decide what is explicitly **out of scope** for Phase 1.
- [ ] Define the main user journey:
  - Visitor → Landing Page → Sign Up/Login → Authenticated Dashboard → Use Application → Logout.
- [ ] Decide the initial technology stack.
- [ ] Create a basic project structure and README.
- [ ] Tell the AI to build only what has been agreed for the current phase.

---

# Phase 1 — Landing Page

## 1.1 Project Setup

- [ ] Create the frontend application.
- [ ] Set up the backend/API if required.
- [ ] Set up environment configuration.
- [ ] Set up Git repository.
- [ ] Create development, test and production configuration.
- [ ] Add linting and formatting.
- [ ] Add basic error handling.
- [ ] Create a clean folder/package structure.

## 1.2 Landing Page

Build a professional public-facing landing page.

- [ ] Header/navigation.
- [ ] Logo/product name.
- [ ] Hero section.
- [ ] Clear explanation of the product.
- [ ] Primary CTA — **Sign Up / Get Started**.
- [ ] Secondary CTA — **Login**.
- [ ] Features section.
- [ ] How it works section.
- [ ] Benefits/value proposition.
- [ ] Footer.
- [ ] Responsive design for desktop/tablet/mobile.
- [ ] Basic SEO metadata.
- [ ] Loading/error states where required.

### Phase 1 milestone

**A visitor can open the website and understand the product, then click Sign Up or Login.**

---

# Phase 2 — User Authentication

## 2.1 User Registration

- [ ] Create Sign Up page.
- [ ] Email validation.
- [ ] Password validation.
- [ ] Secure password storage.
- [ ] Duplicate-account handling.
- [ ] Registration API.
- [ ] User creation in database.
- [ ] Return appropriate success/error responses.

## 2.2 Login

- [ ] Create Login page.
- [ ] Authenticate user credentials.
- [ ] Handle incorrect credentials.
- [ ] Implement secure authentication.
- [ ] Create authentication session/token.
- [ ] Redirect authenticated users to dashboard.
- [ ] Prevent unauthenticated users from accessing protected pages.

## 2.3 Logout

- [ ] Logout button.
- [ ] Destroy/invalidate session or authentication token.
- [ ] Redirect user to landing/login page.
- [ ] Ensure protected APIs cannot be accessed after logout.

## 2.4 Authentication Security

- [ ] Password hashing.
- [ ] Secure session/token handling.
- [ ] HTTPS in production.
- [ ] Protection against common authentication vulnerabilities.
- [ ] Rate limiting where appropriate.
- [ ] Secure cookies if cookie-based authentication is used.
- [ ] Never store passwords in plain text.

### Phase 2 milestone

**A new user can register, log in, stay authenticated, access protected pages and log out.**

---

# Phase 3 — Database & Proper Schema

## 3.1 Database Setup

- [ ] Select database.
- [ ] Create development database.
- [ ] Create production database.
- [ ] Configure database connection securely.
- [ ] Add database migrations.
- [ ] Never manually modify production schema.

## 3.2 Initial Schema

Start with the minimum required entities.

Example:

### User

- [ ] `id`
- [ ] `email`
- [ ] `password_hash`
- [ ] `first_name`
- [ ] `last_name`
- [ ] `created_at`
- [ ] `updated_at`
- [ ] `last_login_at`
- [ ] `status`

### Session / Authentication

Depending on authentication architecture:

- [ ] `id`
- [ ] `user_id`
- [ ] `created_at`
- [ ] `expires_at`
- [ ] `revoked_at`

### Future entities

Do **not** create dozens of tables just because they might be needed later.

- [ ] Add entities only when a real feature requires them.
- [ ] Define primary keys.
- [ ] Define foreign keys.
- [ ] Define indexes.
- [ ] Define unique constraints.
- [ ] Define appropriate relationships.
- [ ] Define data retention requirements.

## 3.3 Database Architecture

- [ ] Define database naming conventions.
- [ ] Define ID strategy.
- [ ] Define timestamps.
- [ ] Define migration strategy.
- [ ] Define transaction boundaries.
- [ ] Define indexing strategy.
- [ ] Define backup/recovery strategy.

### Phase 3 milestone

**Users and application data are stored reliably in a properly structured database.**

---

# Phase 4 — User State & Personalisation

The important principle here is:

> **Every user should see and interact with their own data.**

- [ ] Identify the currently authenticated user.
- [ ] Maintain authentication state on the frontend.
- [ ] Load user information after login.
- [ ] Create protected API endpoints.
- [ ] Ensure every user-specific database query is scoped to the authenticated user.
- [ ] Prevent User A from accessing User B's data.
- [ ] Add user profile page.
- [ ] Add basic account settings.
- [ ] Persist relevant application state.
- [ ] Handle session expiry.
- [ ] Handle refresh/re-login correctly.
- [ ] Handle multiple browser sessions if required.

### Critical security test

Create:

**User A**

- User A creates data.

**User B**

- User B logs in.

Verify:

- [ ] User B cannot see User A's data.
- [ ] User B cannot modify User A's data.
- [ ] User B cannot delete User A's data.
- [ ] APIs enforce authorization server-side.

### Phase 4 milestone

**The application behaves as a multi-user system rather than a static website.**

---

# Phase 5 — Core Application / Dashboard

Now start building the actual product.

- [ ] Create authenticated dashboard.
- [ ] Define dashboard layout.
- [ ] Display user-specific information.
- [ ] Build the first core feature.
- [ ] Connect frontend to backend API.
- [ ] Store the feature's data in the database.
- [ ] Add create/read/update/delete operations where appropriate.
- [ ] Add validation.
- [ ] Add loading states.
- [ ] Add empty states.
- [ ] Add error states.
- [ ] Add success feedback.

### Phase 5 milestone

**A logged-in user can actually use the core product.**

---

# Phase 6 — Backend/API Architecture

As the product grows, make the backend maintainable.

- [ ] Define REST/GraphQL API conventions.
- [ ] Separate controllers/routes from business logic.
- [ ] Create service layer.
- [ ] Create repository/data-access layer.
- [ ] Define DTOs/request/response models.
- [ ] Centralise error handling.
- [ ] Add API validation.
- [ ] Add authentication middleware.
- [ ] Add authorization.
- [ ] Add API versioning if appropriate.
- [ ] Document APIs.
- [ ] Avoid putting business logic directly into controllers.

---

# Phase 7 — Testing

Don't wait until the end.

## Unit Tests

- [ ] Test business logic.
- [ ] Test authentication logic.
- [ ] Test validation.
- [ ] Test important edge cases.

## Integration Tests

- [ ] Test API + database.
- [ ] Test authentication flow.
- [ ] Test authorization.
- [ ] Test user isolation.

## Frontend Tests

- [ ] Test important components.
- [ ] Test login/signup.
- [ ] Test protected routes.
- [ ] Test important user journeys.

## End-to-End Tests

- [ ] Visitor opens website.
- [ ] User registers.
- [ ] User logs in.
- [ ] User uses application.
- [ ] User logs out.

### Phase 7 milestone

**The important user journeys are automatically tested.**

---

# Phase 8 — Production Infrastructure

Prepare the application for real users.

- [ ] Choose hosting platform.
- [ ] Configure production frontend.
- [ ] Configure production backend.
- [ ] Configure production database.
- [ ] Configure domain.
- [ ] Configure DNS.
- [ ] Enable HTTPS.
- [ ] Configure environment variables/secrets.
- [ ] Configure database migrations.
- [ ] Configure logging.
- [ ] Configure monitoring.
- [ ] Configure error tracking.
- [ ] Configure backups.
- [ ] Configure CORS/security policies.
- [ ] Configure rate limiting where required.

---

# Phase 9 — CI/CD

Every code change should eventually be deployable automatically.

- [ ] Git repository.
- [ ] Pull request workflow.
- [ ] Automated build.
- [ ] Automated unit tests.
- [ ] Automated integration tests.
- [ ] Security/dependency checks.
- [ ] Build production artifacts.
- [ ] Deploy automatically to staging.
- [ ] Validate staging.
- [ ] Deploy to production.
- [ ] Create rollback strategy.

### Target workflow

**Developer → Git → CI → Tests → Build → Staging → Production**

---

# Phase 10 — Production Release

Before making the website public:

- [ ] Test registration.
- [ ] Test login.
- [ ] Test logout.
- [ ] Test session expiry.
- [ ] Test password/security behaviour.
- [ ] Test mobile layout.
- [ ] Test major browsers.
- [ ] Test database failures.
- [ ] Test API failures.
- [ ] Test unauthorized access.
- [ ] Test User A vs User B data isolation.
- [ ] Verify backups.
- [ ] Verify monitoring.
- [ ] Verify HTTPS.
- [ ] Verify production environment variables.
- [ ] Verify domain.
- [ ] Perform final security review.

### Phase 10 milestone

**The website is live and can safely accept real users.**

---

# Phase 11 — Improve the Product Iteratively

Once Phase 1 is live, don't rebuild everything.

Use:

**Build → Test → Measure → Improve → Repeat**

For every new feature:

- [ ] Define the problem.
- [ ] Define the user story.
- [ ] Define acceptance criteria.
- [ ] Design the database changes.
- [ ] Design API changes.
- [ ] Design frontend changes.
- [ ] Implement backend.
- [ ] Implement frontend.
- [ ] Add tests.
- [ ] Test locally.
- [ ] Deploy to staging.
- [ ] Test staging.
- [ ] Deploy production.
- [ ] Monitor.
- [ ] Collect feedback.
- [ ] Improve.

---

# Recommended Overall Architecture

Keep the architecture simple initially:

**Frontend**
→ Landing Page  
→ Login / Signup  
→ Dashboard  
→ User Interface

**Backend**
→ Authentication  
→ API  
→ Business Logic  
→ Database

**Infrastructure**
→ Git  
→ CI/CD  
→ Cloud Hosting  
→ Database  
→ Monitoring  
→ Domain + HTTPS

---

# How to Build This With AI

Use AI as your **development copilot**, not as one giant "build my website" command.

For each phase, give the AI:

1. **Current architecture**
2. **Technology stack**
3. **What has already been built**
4. **What you want to build now**
5. **Acceptance criteria**
6. **Constraints**
7. **Files/components it is allowed to modify**

For example:

> "We have completed Phase 1. The landing page is working. Do not modify the existing landing-page design unless necessary. Now implement Phase 2 authentication. First inspect the existing project structure and explain the changes required. Then implement registration, login, logout and protected routes. Use the existing architecture and do not introduce unnecessary dependencies."

This prevents AI from continuously rewriting your application.

## The development sequence I recommend

**Phase 0:** Product definition  
↓  
**Phase 1:** Landing page  
↓  
**Phase 2:** Authentication  
↓  
**Phase 3:** Database/schema  
↓  
**Phase 4:** User sessions/state/authorization  
↓  
**Phase 5:** Core application  
↓  
**Phase 6:** Backend/API architecture  
↓  
**Phase 7:** Testing  
↓  
**Phase 8:** Production infrastructure  
↓  
**Phase 9:** CI/CD  
↓  
**Phase 10:** Launch  
↓  
**Phase 11:** Continuous improvements

                    ┌─────────────────┐
                    │     User        │
                    └────────┬────────┘
                             │
                             ▼
                    ┌─────────────────┐
                    │    Next.js      │
                    │   Web App       │
                    └───────┬─────────┘
                            │
             ┌──────────────┴──────────────┐
             │                             │
             ▼                             ▼
      ┌──────────────┐             ┌─────────────────┐
      │  PostgreSQL  │             │ Python Agent    │
      │              │◄────────────│ Service         │
      └──────────────┘             └────────┬────────┘
                                            │
                                            ▼
                                     ┌──────────────┐
                                     │ LLM / AI     │
                                     └──────────────┘

### Most important rule

**Don't let AI build Phase 5 while you're still designing Phase 1.**

Build one vertical slice at a time, keep it working, commit it to Git, and only then move to the next phase. This makes the project much easier to debug, extend, and eventually hand over to another developer.
