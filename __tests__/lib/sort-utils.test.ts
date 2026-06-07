import { getSortTitle, compareTitles, getMongoSortTitlePipeline } from '@/app/lib/sort-utils';

describe('sort-utils', () => {
    describe('getSortTitle', () => {
        it('removes leading "The " from titles for sorting purposes', () => {
            expect(getSortTitle('The Dark Knight')).toBe('Dark Knight');
            expect(getSortTitle('The Matrix')).toBe('Matrix');
            expect(getSortTitle('the avengers')).toBe('avengers');
        });

        it('does not remove "The" if it is part of another word', () => {
            expect(getSortTitle('There Will Be Blood')).toBe('There Will Be Blood');
            expect(getSortTitle('Then Came You')).toBe('Then Came You');
        });

        it('does not remove "The" if it is not at the beginning', () => {
            expect(getSortTitle('Guardians of the Galaxy')).toBe('Guardians of the Galaxy');
        });

        it('handles titles with multiple spaces correctly', () => {
            expect(getSortTitle('The  Matrix')).toBe('Matrix');
            expect(getSortTitle('The   Godfather')).toBe('Godfather');
        });

        it('does not remove "The" if it has no trailing space', () => {
            expect(getSortTitle('The')).toBe('The');
            expect(getSortTitle('Them')).toBe('Them');
        });

        it('removes "A" and "An" prefixes', () => {
            expect(getSortTitle('A Clockwork Orange')).toBe('Clockwork Orange');
            expect(getSortTitle('An Inconvenient Truth')).toBe('Inconvenient Truth');
        });

        it('handles empty or falsy values gracefully', () => {
            expect(getSortTitle('')).toBe('');
            expect(getSortTitle(undefined as any)).toBe('');
            expect(getSortTitle(null as any)).toBe('');
        });
    });

    describe('compareTitles', () => {
        it('sorts a list of movie titles ignoring the leading "The "', () => {
            // We include "The Dark Knight" and "Inception". 
            // "The Dark Knight" should sort as "Dark Knight", which comes before "Inception".
            // "Atonement" comes before "Dark Knight".
            // "The Matrix" sorts as "Matrix", which comes after "Inception".
            const movies = [
                { title: 'The Matrix' },
                { title: 'Atonement' },
                { title: 'The Dark Knight' },
                { title: 'Inception' }
            ];

            const sorted = [...movies].sort((a, b) => compareTitles(a.title, b.title));

            expect(sorted.map(m => m.title)).toEqual([
                'Atonement',
                'The Dark Knight',
                'Inception',
                'The Matrix'
            ]);
        });

        it('sorts correctly in descending order', () => {
            const movies = [
                { title: 'The Matrix' },
                { title: 'Atonement' },
                { title: 'The Dark Knight' }
            ];

            const sorted = [...movies].sort((a, b) => compareTitles(a.title, b.title, -1));

            expect(sorted.map(m => m.title)).toEqual([
                'The Matrix',
                'The Dark Knight',
                'Atonement'
            ]);
        });

        it('returns 0 for identical sort titles', () => {
            expect(compareTitles('The Matrix', 'Matrix')).toBe(0);
            expect(compareTitles('Inception', 'Inception')).toBe(0);
        });
    });

    describe('getMongoSortTitlePipeline', () => {
        it('returns the correct MongoDB $addFields pipeline stage', () => {
            const pipeline = getMongoSortTitlePipeline('$movieDetails.title', 'sortTitle');
            
            expect(pipeline).toEqual({
                $addFields: {
                    sortTitle: {
                        $cond: {
                            if: { $regexMatch: { input: '$movieDetails.title', regex: /^the\s+/i } },
                            then: { $trim: { input: { $substrCP: ['$movieDetails.title', 4, { $subtract: [{ $strLenCP: '$movieDetails.title' }, 4] }] } } },
                            else: {
                                $cond: {
                                    if: { $regexMatch: { input: '$movieDetails.title', regex: /^an\s+/i } },
                                    then: { $trim: { input: { $substrCP: ['$movieDetails.title', 3, { $subtract: [{ $strLenCP: '$movieDetails.title' }, 3] }] } } },
                                    else: {
                                        $cond: {
                                            if: { $regexMatch: { input: '$movieDetails.title', regex: /^a\s+/i } },
                                            then: { $trim: { input: { $substrCP: ['$movieDetails.title', 2, { $subtract: [{ $strLenCP: '$movieDetails.title' }, 2] }] } } },
                                            else: '$movieDetails.title'
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            });
        });
    });
});
