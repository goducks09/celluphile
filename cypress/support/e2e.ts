// ***********************************************************
// This support file is loaded automatically before each E2E test.
// See: https://on.cypress.io/configuration
// ***********************************************************

// DB reset is handled per-spec in each spec file's before() hook
// to provide spec-level isolation.

Cypress.on('uncaught:exception', (err, runnable) => {
  // Ignore Next.js Turbopack dev server performance measurement errors
  const msg = typeof err === 'string' ? err : err.message;
  if (
    msg && (msg.includes('negative time stamp') || msg.includes('Failed to execute \'measure\''))
  ) {
    return false;
  }
  // Let other errors fail the test
  return true;
});

// Safety-net intercept: catch any requests that bypass the mock TMDB route
// (e.g. if TMDB_API_BASE_URL is accidentally unset)
beforeEach(() => {
  cy.intercept({ url: /https:\/\/api\.themoviedb\.org\/3\/.*/ }, (req) => {
    if (req.url.includes('/search/movie')) {
      req.reply({ fixture: 'tmdb-search.json' });
    } else if (req.url.includes('/movie/')) {
      req.reply({ fixture: 'tmdb-details.json' });
    } else {
      req.reply({ statusCode: 200, body: {} });
    }
  }).as('tmdbApi');
});

Cypress.Commands.add('registerUser', (email: string, password: string) => {
  cy.request({
    method: 'POST',
    url: '/api/register',
    body: { email, password },
    failOnStatusCode: false,
  });
});

Cypress.Commands.add('loginUser', (email: string, password: string) => {
  cy.session(
    email,
    () => {
      cy.visit('/login');
      cy.get('#email').type(email);
      cy.get('#password').type(password, { log: false });
      cy.get('button[type="submit"]').click();
      cy.url().should('include', '/dashboard');
    },
    {
      cacheAcrossSpecs: true,
    }
  );
  // Important: cy.session doesn't change the current URL.
  // Since prior tests expect loginUser to leave the browser at /dashboard, we must visit it out here.
  cy.visit('/dashboard');
});

Cypress.Commands.add('logoutUser', () => {
  cy.contains('button', 'Sign Out').click();
});

// Type declarations for custom commands
declare global {
  namespace Cypress {
    interface Chainable {
      registerUser(email: string, password: string): Chainable<Cypress.Response<any>>;
      loginUser(email: string, password: string): Chainable<void>;
      logoutUser(): Chainable<void>;
    }
  }
}

export { };
