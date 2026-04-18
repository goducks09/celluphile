describe('Random Movie Page', () => {
    const testEmail = `test-random-${Date.now()}@example.com`;
    let testPassword = '';

    before(() => {
        // Run DB setup, register a new user once
        cy.request({
            method: 'POST',
            url: '/api/test/reset-db',
            headers: { 'x-test-secret': 'cypress-test-secret' },
        });
        cy.env(['testPassword']).then(({ testPassword: pw }) => {
            testPassword = pw;
            cy.registerUser(testEmail, testPassword);
        });
    });

    beforeEach(() => {
        cy.loginUser(testEmail, testPassword);
    });

    it('Scenario 16: /dashboard/random with an empty library shows an empty-state message', () => {
        cy.visit('/dashboard/random');
        cy.contains('It looks like there are no movies available to pick from.');
        cy.get('a').contains('Go to Library').should('have.attr', 'href', '/dashboard/library');
    });

    it('Setup: Add a movie to test non-empty states', () => {
        cy.visit('/dashboard/library');
        // Type into search box to find a movie to add
        cy.get('input[placeholder="Search by title..."]').type('The Matrix');
        
        // Wait for results
        cy.contains('button', 'Search').click();
        cy.contains('The Matrix').should('be.visible');
        
        // Select quality
        cy.get('select').first().select('4K');
        
        // Add to library
        cy.contains('button', 'Add to Library').first().click();
        
        // Verify success
        cy.contains('added to library', { matchCase: false, timeout: 10000 }).should('exist');
    });

    it('Scenario 17: /dashboard/random with movies in library displays a movie title and poster', () => {
        cy.visit('/dashboard/random');
        cy.contains('The Matrix').should('be.visible');
        cy.contains('4K').should('be.visible');
        cy.get('img[alt="The Matrix poster"]').should('exist');
    });

    it('Scenario 18: Clicking the movie card navigates to the ItemDetail page', () => {
        cy.visit('/dashboard/random');
        // Click the movie card (it's a Link wrapping the content)
        cy.contains('h3', 'The Matrix').click();
        
        cy.url().should('include', '/dashboard/library/');
        // The tmdbId for The Matrix in TMDB is 603
        cy.url().should('include', '603');
    });

    it('Scenario 19 & 20: "Pick Another" button is visually disabled/loading during the request and displays a movie', () => {
        cy.visit('/dashboard/random');
        
        cy.contains('The Matrix').should('be.visible');
        
        // Intercept action if needed, or just test visual state
        // Click Pick Another
        cy.contains('button', 'Pick Another').click();
        
        // Verifies the loading state
        cy.contains('button', 'Picking...').should('be.disabled');
        
        // Because there's only 1 movie, it should theoretically render The Matrix again.
        cy.contains('The Matrix').should('be.visible');
        cy.contains('button', 'Pick Another').should('not.be.disabled');
    });
});
