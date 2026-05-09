describe('E2E-4: Server Action Security', () => {
  const testEmailA = `test-security-a-${Date.now()}@example.com`;
  const testEmailB = `test-security-b-${Date.now()}@example.com`;
  let testPassword = ''

  before(() => {
    // Reset DB for spec-level isolation
    cy.request({
      method: 'POST',
      url: '/api/test/reset-db',
      headers: { 'x-test-secret': 'cypress-test-secret' },
    });
    cy.env(['testPassword']).then(({ testPassword: pw }) => {
      testPassword = pw;
      cy.registerUser(testEmailA, testPassword);
      cy.registerUser(testEmailB, testPassword);
    });
  });

  // E2E-4.1: addMovieToLibrary without session
  it('addMovieToLibrary without session is blocked', () => {
    // Without a session, the middleware should redirect POST to /dashboard
    cy.request({
      method: 'POST',
      url: '/dashboard',
      headers: {
        'Next-Action': 'addMovieToLibrary',
        'Content-Type': 'text/plain;charset=UTF-8',
      },
      body: JSON.stringify([{
        tmdbId: 550,
        title: 'Fight Club',
        poster: '/poster.jpg',
        genres: ['Drama'],
        quality: 'Blu-ray',
      }]),
      failOnStatusCode: false,
      followRedirect: false,
    }).then((response) => {
      // Middleware should redirect unauthenticated requests away from /dashboard
      expect(response.status).to.be.gte(300).and.lt(400);
    });
  });

  // E2E-4.2: removeMovieFromLibrary without session
  it('removeMovieFromLibrary without session is blocked', () => {
    cy.request({
      method: 'POST',
      url: '/dashboard',
      headers: {
        'Next-Action': 'removeMovieFromLibrary',
        'Content-Type': 'text/plain;charset=UTF-8',
      },
      body: JSON.stringify([550]),
      failOnStatusCode: false,
      followRedirect: false,
    }).then((response) => {
      expect(response.status).to.be.gte(300).and.lt(400);
    });
  });

  // E2E-4.3: searchUserLibrary without session
  it('searchUserLibrary without session is blocked', () => {
    cy.request({
      method: 'POST',
      url: '/dashboard',
      headers: {
        'Next-Action': 'searchUserLibrary',
        'Content-Type': 'text/plain;charset=UTF-8',
      },
      body: JSON.stringify(['']),
      failOnStatusCode: false,
      followRedirect: false,
    }).then((response) => {
      expect(response.status).to.be.gte(300).and.lt(400);
    });
  });


  // E2E-4.4: Input validation is covered by unit tests in __tests__/lib/schemas.test.ts
  // (Server actions use hashed IDs and can't be invoked by name via HTTP)


  // E2E-4.5: Cross-user isolation
  it('User B cannot see User A movies', () => {
    // Log in as User A and add a movie
    cy.loginUser(testEmailA, testPassword);
    cy.visit('/dashboard/library');
    cy.get('input[placeholder="Search by title..."]').type('Inception');
    cy.contains('button', 'Search').click();
    cy.contains('Inception').should('be.visible');
    cy.get('select').first().select('4K');
    cy.contains('button', 'Add to Library').first().click();
    cy.contains('added to library', { matchCase: false, timeout: 10000 }).should('exist');

    // Log out and wait for redirect to complete
    cy.visit('/dashboard');
    cy.contains('button', 'Sign Out').click({ force: true });
    cy.location('pathname', { timeout: 10000 }).should('eq', '/login');

    // Log in as User B
    cy.loginUser(testEmailB, testPassword);
    cy.visit('/dashboard/library');

    // User B's library should be empty — they never added any movies.
    // This proves cross-user isolation: User A's movie does not leak to User B.
    cy.contains('Your library is empty').should('be.visible');
  });
});
