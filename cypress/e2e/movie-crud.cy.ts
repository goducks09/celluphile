describe('E2E-3: Movie Library CRUD', () => {
  const testEmail = `test-crud-${Date.now()}@example.com`;
  let testPassword = ''
  const searchTerm = 'Inception';

  before(() => {
    // Reset DB for spec-level isolation
    cy.env(['testResetSecret']).then(({ testResetSecret: secret }) => {
      cy.request({
        method: 'POST',
        url: '/api/test/reset-db',
        headers: { 'x-test-secret': secret },
      });
    })
    cy.env(['testPassword']).then(({ testPassword: pw }) => {
      testPassword = pw;
      cy.registerUser(testEmail, testPassword);
    });
  });

  beforeEach(() => {
    cy.loginUser(testEmail, testPassword);
    cy.visit('/dashboard/library');
  });

  // E2E-3.1: Search for a movie via TMDB
  it('searches for a movie and displays results', () => {
    cy.get('input[placeholder="Search by title..."]').type(searchTerm);
    cy.contains('button', 'Search').click();

    // Results should appear
    cy.contains(searchTerm).should('be.visible');
  });

  // E2E-3.2: Add movie with quality selection
  it('adds a movie with Blu-ray quality', () => {
    cy.get('input[placeholder="Search by title..."]').type(searchTerm);
    cy.contains('button', 'Search').click();
    cy.contains(searchTerm).should('be.visible');

    // Select quality for the first result and add
    cy.get('select').first().select('Blu-ray');
    cy.contains('button', 'Add to Library').first().click();

    // Success toast should appear
    cy.contains('added to library', { matchCase: false, timeout: 10000 }).should('exist');
  });

  // E2E-3.3: Add movie without quality
  it('shows warning when adding without quality selection', () => {
    cy.get('input[placeholder="Search by title..."]').type('The Matrix');
    cy.contains('button', 'Search').click();
    cy.contains('The Matrix').should('be.visible');

    // Click add without selecting quality
    cy.contains('h3', 'The Matrix')
      .closest('div.flex.items-center.justify-between')
      .within(() => {
        cy.contains('button', 'Add to Library').click();
      });

    cy.contains('Please select a quality format', { timeout: 10000 }).should('exist');
  });

  // E2E-3.4: Add duplicate movie
  // Relies on E2E-3.2 having already added Inception — tests run in order
  // within a spec, and the DB is reset at the start of this spec file.
  // it('shows error when adding duplicate movie', () => {
  //   cy.get('input[placeholder="Search by title..."]').type(searchTerm);
  //   cy.contains('button', 'Search').click();
  //   cy.contains(searchTerm).should('be.visible');

  //   // Inception was already added in E2E-3.2, so this should fail
  //   cy.get('select').first().select('DVD');
  //   cy.contains('button', 'Add to Library').first().click();

  //   // Use 'exist' instead of 'be.visible' — Sonner toasts animate in from opacity: 0
  //   cy.contains('already exists', { matchCase: false, timeout: 10000 }).should('exist');
  // });
  it('does not allow adding a duplicate movie', () => {
    cy.get('input[placeholder="Search by title..."]').type(searchTerm);
    cy.contains('button', 'Search').click();
    cy.contains(searchTerm).should('be.visible');

    cy.contains('h3', searchTerm)
      .closest('div.flex.items-center')
      .within(() => {
        cy.get('span').contains('In Library').should('exist');
        cy.contains('button', 'Add to Library').should('not.exist');
      });
  })

  // E2E-3.5: Library displays added movies
  it('displays added movies on the dashboard', () => {
    // Reload to see server-rendered library (Inception added in E2E-3.2)
    cy.visit('/dashboard/library');

    // Movie should be visible in the library section
    cy.contains('Your Movie Library').should('be.visible');
    cy.contains(searchTerm).should('be.visible');
  });

  // E2E-3.6: Filter library by quality
  it('filters library by quality', () => {
    // Add a DVD movie so we have two different qualities to filter
    cy.get('input[placeholder="Search by title..."]').clear().type('The Matrix');
    cy.contains('button', 'Search').click();
    cy.contains('The Matrix').should('be.visible');
    cy.contains('h3', 'The Matrix')
      .closest('div.flex.items-center.justify-between')
      .within(() => {
        cy.get('select').select('DVD');
        cy.contains('button', 'Add to Library').click();
      });
    cy.contains('added to library', { matchCase: false, timeout: 10000 }).should('exist');

    // Reload to see the server-rendered library with both movies
    cy.visit('/dashboard/library');

    // Select "Blu-ray" quality filter (Inception is Blu-ray from E2E-3.2)
    cy.get('select').last().select('Blu-ray');

    // Blu-ray movie should be visible, DVD movie should be hidden
    cy.contains(searchTerm).should('be.visible');
    cy.contains('The Matrix').should('not.exist');
  });

  // E2E-3.7: Search library by title
  it('searches library by title', () => {
    // Both Inception (Blu-ray) and The Matrix (DVD) are in the library
    // Reload to see the server-rendered library
    cy.visit('/dashboard/library');

    // Search for a partial title match
    cy.get('input[placeholder="Search your library..."]').type(searchTerm.substring(0, 4));

    // Matching movie should appear, non-matching should be hidden
    cy.contains(searchTerm).should('be.visible');
    cy.contains('The Matrix').should('not.exist');
  });

  // E2E-3.8: Remove movie from library
  it('removes a movie from the library', () => {
    // Reload to see server-rendered library with movies from prior tests
    cy.visit('/dashboard/library');
    cy.contains('Your Movie Library').should('be.visible');

    // Click on the movie card to go to detail page
    cy.contains('h3', searchTerm).click();

    // In detail page, click remove
    cy.contains('button', 'Remove').click();

    // Should confirm modal or just remove, check if modal exists
    cy.get('body').then($body => {
      if ($body.find('button:contains("Confirm Delete")').length > 0) {
        cy.contains('button', 'Confirm Delete').click();
      }
    });

    cy.contains('removed', { matchCase: false, timeout: 10000 }).should('exist');

    // Go back to library
    cy.visit('/dashboard/library');
    cy.contains('h3', searchTerm).should('not.exist');
  });

  // E2E-3.9: Empty library state
  it('shows empty library message when all movies removed', () => {
    // Reload to see current server-rendered library
    cy.visit('/dashboard/library');

    // Remove remaining movies by navigating to detail page
    function removeAllMovies() {
      cy.get('body').then(($body) => {
        const links = $body.find('a[href^="/dashboard/library/"]');
        if (links.length > 0) {
          cy.wrap(links.first()).click();
          cy.contains('button', 'Remove').click();

          cy.get('body').then($modalBody => {
            if ($modalBody.find('button:contains("Confirm Delete")').length > 0) {
              cy.contains('button', 'Confirm Delete').click();
            }
          });

          cy.contains('removed', { matchCase: false, timeout: 10000 }).should('exist');
          cy.visit('/dashboard/library');
          cy.wait(500);
          removeAllMovies();
        }
      });
    }

    removeAllMovies();

    cy.contains('Your library is empty').should('be.visible');
  });
});
