describe('E2E-2: Route Protection & Authorization', () => {
  const testEmail = `test-route-${Date.now()}@example.com`;
  const testPassword = '<REDACTED>';

  before(() => {
    // Reset DB for spec-level isolation
    cy.request({
      method: 'POST',
      url: '/api/test/reset-db',
      headers: { 'x-test-secret': 'cypress-test-secret' },
    });
    // Register a test user for authenticated tests
    cy.registerUser(testEmail, testPassword);
  });

  // E2E-2.1: Unauthenticated access to /dashboard
  it('redirects unauthenticated user from /dashboard to /login', () => {
    cy.visit('/dashboard');
    cy.url().should('include', '/login');
  });

  // E2E-2.2: Unauthenticated access to /dashboard/library
  it('redirects unauthenticated user from /dashboard/library to /login', () => {
    cy.visit('/dashboard/library');
    cy.url().should('include', '/login');
  });

  // E2E-2.3: Authenticated redirect from /login
  it('redirects authenticated user from /login to /dashboard', () => {
    cy.loginUser(testEmail, testPassword);
    cy.visit('/login');
    cy.url().should('include', '/dashboard');
  });

  // E2E-2.4: Authenticated redirect from /register
  it('redirects authenticated user from /register to /dashboard', () => {
    cy.loginUser(testEmail, testPassword);
    cy.visit('/register');
    cy.url().should('include', '/dashboard');
  });

  // E2E-2.5: Public pages accessible without auth
  it('allows access to public pages without auth', () => {
    cy.visit('/');
    cy.url().should('not.include', '/login');

    cy.visit('/offline');
    cy.contains('You are currently offline').should('be.visible');
  });

  // E2E-2.6: API auth routes remain accessible
  it('NextAuth API endpoints respond', () => {
    cy.request({
      url: '/api/auth/providers',
      failOnStatusCode: false,
    }).then((response) => {
      expect(response.status).to.eq(200);
    });
  });
});
