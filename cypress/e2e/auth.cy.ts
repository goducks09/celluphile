describe('E2E-1: Authentication Flow', () => {
  const testEmail = `test-auth-${Date.now()}@example.com`;
  let testPassword = ''

  // Register the test user once before all tests so they don't
  // depend on test-1.1 having run first.
  before(() => {
    // Reset DB for spec-level isolation
    cy.task('resetTestDb');
    cy.env(['testPassword']).then(({ testPassword: pw }) => {
      testPassword = pw;
      cy.registerUser(testEmail, testPassword);
    });
  });

  // E2E-1.1: Registration — happy path
  it('registers a new user and redirects to /dashboard with success toast', () => {
    const freshEmail = `test-auth-fresh-${Date.now()}@example.com`;
    cy.visit('/register');
    cy.get('#email').type(freshEmail);
    cy.get('#password').type(testPassword);
    cy.get('button[type="submit"]').click();

    cy.url({ timeout: 10000 }).should('include', '/dashboard');
    cy.contains('Account created!').should('be.visible');
  });

  // E2E-1.2: Registration — duplicate email
  it('shows error when registering with duplicate email', () => {
    cy.visit('/register');
    cy.get('#email').type(testEmail);
    cy.get('#password').type(testPassword);
    cy.get('button[type="submit"]').click();

    cy.contains('Please choose a different username.').should('be.visible');
  });

  // E2E-1.3: Registration — empty fields
  it('blocks submission with empty fields via HTML5 validation', () => {
    cy.visit('/register');
    cy.get('button[type="submit"]').click();

    // The form should not navigate away — inputs have `required`
    cy.url().should('include', '/register');

    // Verify the required inputs are actually flagged as invalid by the browser
    cy.get('#email').then(($input) => {
      expect(($input[0] as HTMLInputElement).validity.valueMissing).to.be.true;
    });
    cy.get('#password').then(($input) => {
      expect(($input[0] as HTMLInputElement).validity.valueMissing).to.be.true;
    });
  });

  // E2E-1.4: Login — happy path
  it('logs in with valid credentials and redirects to /dashboard', () => {
    cy.visit('/login');
    cy.get('#email').type(testEmail);
    cy.get('#password').type(testPassword);
    cy.get('button[type="submit"]').click();

    cy.url({ timeout: 6000 }).should('include', '/dashboard');
  });

  // E2E-1.5: Login — invalid credentials
  it('shows error with invalid credentials', () => {
    cy.visit('/login');
    cy.get('#email').type(testEmail);
    cy.get('#password').type('wrongpassword');
    cy.get('button[type="submit"]').click();

    cy.contains('Invalid email or password').should('be.visible');
  });

  // E2E-1.6: Logout
  it('logs out and redirects to login page', () => {
    // First log in
    cy.loginUser(testEmail, testPassword);

    // Open the navigation drawer first
    cy.get('button[aria-label="Open Menu"]').click();
    cy.contains('button', 'Sign Out').click();

    // signOut() redirects to the login page
    cy.location('pathname', { timeout: 10000 }).should('eq', '/login');
  });
});
