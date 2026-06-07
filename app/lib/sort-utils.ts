import type { PipelineStage } from 'mongoose';

export function getSortTitle(title: string): string {
    if (!title) return '';
    return title.replace(/^(the|an?)\s+/i, '').trim();
}

export function compareTitles(a: string, b: string, order: 1 | -1 = 1): number {
    return order * getSortTitle(a).localeCompare(getSortTitle(b), 'en', { sensitivity: 'base' });
}

export function getMongoSortTitlePipeline(
    titleField: string = "$movieDetails.title", 
    asField: string = "sortTitle"
): PipelineStage.AddFields {
    return {
        $addFields: {
            [asField]: {
                $cond: {
                    if: { $regexMatch: { input: titleField, regex: /^the\s+/i } },
                    then: { $trim: { input: { $substrCP: [titleField, 4, { $subtract: [{ $strLenCP: titleField }, 4] }] } } },
                    else: {
                        $cond: {
                            if: { $regexMatch: { input: titleField, regex: /^an\s+/i } },
                            then: { $trim: { input: { $substrCP: [titleField, 3, { $subtract: [{ $strLenCP: titleField }, 3] }] } } },
                            else: {
                                $cond: {
                                    if: { $regexMatch: { input: titleField, regex: /^a\s+/i } },
                                    then: { $trim: { input: { $substrCP: [titleField, 2, { $subtract: [{ $strLenCP: titleField }, 2] }] } } },
                                    else: titleField
                                }
                            }
                        }
                    }
                }
            }
        }
    };
}
