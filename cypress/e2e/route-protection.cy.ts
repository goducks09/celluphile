describe('E2E-2: Route Protection & Authorization', () => {
  const testEmail = `test-route-${Date.now()}@example.com`;
  let testPassword = '';

  before(() => {
    // Reset DB for spec-level isolation
    cy.task('resetTestDb');
    // Register a test user for authenticated tests
    cy.env(['testPassword']).then(({ testPassword: pw }) => {
      testPassword = pw;
      cy.registerUser(testEmail, testPassword);
    });
  });

  // E2E-2.1: Unauthenticated access to /dashboard
  it('redirects unauthenticated user from /dashboard to /login', () => {
    cy.visit('/dashboard');
    cy.url().should('include', '/login');
  });

  // E2E-2.2: Unauthenticated access to /library
  it('redirects unauthenticated user from /library to /login', () => {
    cy.visit('/library');
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
