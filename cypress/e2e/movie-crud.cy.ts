describe('E2E-3: Movie Library CRUD', () => {
  const testEmail = `test-crud-${Date.now()}@example.com`;
  const testPassword = '<REDACTED>';
  const searchTerm = 'Inception';

  before(() => {
    // Reset DB for spec-level isolation
    cy.request({
      method: 'POST',
      url: '/api/test/reset-db',
      headers: { 'x-test-secret': 'cypress-test-secret' },
    });
    cy.registerUser(testEmail, testPassword);
  });

  beforeEach(() => {
    cy.loginUser(testEmail, testPassword);
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
    cy.contains('added to library', { matchCase: false }).should('be.visible');
  });

  // E2E-3.3: Add movie without quality
  it('shows warning when adding without quality selection', () => {
    cy.get('input[placeholder="Search by title..."]').type('The Matrix');
    cy.contains('button', 'Search').click();
    cy.contains('The Matrix').should('be.visible');

    // Click add without selecting quality
    cy.contains('button', 'Add to Library').first().click();

    cy.contains('Please select a quality format').should('be.visible');
  });

  // E2E-3.4: Add duplicate movie
  // Relies on E2E-3.2 having already added Inception — tests run in order
  // within a spec, and the DB is reset at the start of this spec file.
  it('shows error when adding duplicate movie', () => {
    cy.get('input[placeholder="Search by title..."]').type(searchTerm);
    cy.contains('button', 'Search').click();
    cy.contains(searchTerm).should('be.visible');

    // Inception was already added in E2E-3.2, so this should fail
    cy.get('select').first().select('DVD');
    cy.contains('button', 'Add to Library').first().click();

    // Use 'exist' instead of 'be.visible' — Sonner toasts animate in from opacity: 0
    cy.contains('already exists', { matchCase: false, timeout: 10000 }).should('exist');
  });

  // E2E-3.5: Library displays added movies
  it('displays added movies on the dashboard', () => {
    // Reload to see server-rendered library (Inception added in E2E-3.2)
    cy.reload();

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
    cy.get('select').first().select('DVD');
    cy.contains('button', 'Add to Library').first().click();
    cy.contains('added to library', { matchCase: false }).should('be.visible');

    // Reload to see the server-rendered library with both movies
    cy.reload();

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
    cy.reload();

    // Search for a partial title match
    cy.get('input[placeholder="Search your library..."]').type(searchTerm.substring(0, 4));

    // Matching movie should appear, non-matching should be hidden
    cy.contains(searchTerm).should('be.visible');
    cy.contains('The Matrix').should('not.exist');
  });

  // E2E-3.8: Remove movie from library
  it('removes a movie from the library', () => {
    // Reload to see server-rendered library with movies from prior tests
    cy.reload();
    cy.contains('Your Movie Library').should('be.visible');

    // Count movies before removal
    cy.get('button[title="Remove from library"]').then(($btns) => {
      const initialCount = $btns.length;

      // Click the delete/remove button on the first movie card
      cy.get('button[title="Remove from library"]').first().click();

      // Verify the movie was actually removed (one fewer remove button)
      if (initialCount > 1) {
        cy.get('button[title="Remove from library"]').should('have.length', initialCount - 1);
      } else {
        cy.get('button[title="Remove from library"]').should('not.exist');
      }
    });
  });

  // E2E-3.9: Empty library state
  it('shows empty library message when all movies removed', () => {
    // Reload to see current server-rendered library
    cy.reload();

    // Remove remaining movies using a recursive approach
    // to handle React re-rendering the list after each deletion
    function removeAllMovies() {
      cy.get('body').then(($body) => {
        if ($body.find('button[title="Remove from library"]').length > 0) {
          cy.get('button[title="Remove from library"]').first().click();
          cy.contains('removed', { matchCase: false, timeout: 10000 }).should('exist');
          cy.contains('removed', { matchCase: false }).should('not.exist');
          removeAllMovies();
        }
      });
    }

    removeAllMovies();

    // Reload to get the server-rendered empty state
    cy.reload();
    cy.contains('Your library is empty').should('be.visible');
  });
});
