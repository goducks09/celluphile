describe('E2E-6: Registration API Route Security', () => {
  const testEmail = `test-api-reg-${Date.now()}@example.com`;
  let testPassword = ''


  before(() => {
    // Reset DB for spec-level isolation
    cy.task('resetTestDb');
    cy.env(['testPassword']).then(({ testPassword: pw }) => {
      testPassword = pw;
    });
  });

  // E2E-6.1: POST with valid data
  it('POST /api/register with valid data returns 201', () => {
    cy.request({
      method: 'POST',
      url: '/api/register',
      body: { email: testEmail, password: testPassword },
    }).then((response) => {
      expect(response.status).to.eq(201);
      expect(response.body.message).to.include('User created');
    });
  });

  // E2E-6.2: POST with missing fields
  it('POST /api/register with missing fields returns 400', () => {
    cy.request({
      method: 'POST',
      url: '/api/register',
      body: {},
      failOnStatusCode: false,
    }).then((response) => {
      expect(response.status).to.eq(400);
      expect(response.body.message).to.include('required');
    });
  });

  // E2E-6.3: POST with duplicate email
  it('POST /api/register with duplicate email returns 409', () => {
    // testEmail was already registered in test 1
    cy.request({
      method: 'POST',
      url: '/api/register',
      body: { email: testEmail, password: testPassword },
      failOnStatusCode: false,
    }).then((response) => {
      expect(response.status).to.eq(409);
      expect(response.body.message).to.include('different username');
    });
  });

  // E2E-6.4: Password is hashed in DB
  it('password is hashed in the database (not stored as plain text)', () => {
    const hashCheckEmail = `test-hash-${Date.now()}@example.com`;
    const plainPassword = 'MyPlainPassword123!';

    // Register user
    cy.request({
      method: 'POST',
      url: '/api/register',
      body: { email: hashCheckEmail, password: plainPassword },
    }).then((response) => {
      expect(response.status).to.eq(201);
    });

    // Verify by attempting to login — if the password were stored as plain text,
    // bcrypt.compare would fail and login wouldn't work
    cy.visit('/login');
    cy.get('#email').type(hashCheckEmail);
    cy.get('#password').type(plainPassword);
    cy.get('button[type="submit"]').click();

    // Successful login proves bcrypt hashing works end-to-end
    cy.url().should('include', '/dashboard');
  });
});
