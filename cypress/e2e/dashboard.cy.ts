describe('E2E-5: Dashboard Page', () => {
  const testEmail = `test-dashboard-${Date.now()}@example.com`;
  let testPassword = ''

  before(() => {
    // Reset DB for spec-level isolation
    cy.task('resetTestDb');
    cy.env(['testPassword']).then(({ testPassword: pw }) => {
      testPassword = pw;
      cy.registerUser(testEmail, testPassword);
    });
  });

  // E2E-5.1: Displays user email in header
  it('displays the logged-in user email in the header', () => {
    cy.loginUser(testEmail, testPassword);
    cy.contains(testEmail).should('exist');
  });

  // E2E-5.2: Contains search section
  it('contains "Actions" heading and add link', () => {
    cy.loginUser(testEmail, testPassword);
    cy.contains('Actions').should('be.visible');
    cy.contains('Add a movie').should('be.visible');
  });

  // E2E-5.3: Contains library section
  it('contains library section', () => {
    // First add a movie so library section has content
    cy.loginUser(testEmail, testPassword);

    cy.visit('/dashboard/library');
    cy.get('input[placeholder="Search by title..."]').type('Inception');
    cy.contains('button', 'Search').click();
    cy.contains('Inception').should('be.visible');
    cy.get('select').first().select('Blu-ray');
    cy.contains('button', 'Add to Library').first().click();
    cy.contains('added to library', { matchCase: false, timeout: 10000 }).should('exist');

    // Return to dashboard to see the server-rendered library
    cy.visit('/dashboard');

    cy.contains('Your Library').should('be.visible');
    cy.contains('Inception').should('be.visible');
  });

  // E2E-5.4: Error boundary rendering is tested via Jest component test
  // in __tests__/ui/dashboard-error.test.tsx — not suitable for E2E since
  // server component errors can't be triggered from the browser.
});
