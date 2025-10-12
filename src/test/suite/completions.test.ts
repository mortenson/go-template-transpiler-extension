import * as assert from 'assert';
import { extractFieldLabels, getBaseFields, openFixture, getCompletionsAt } from './helpers';

/**
 * Completion Provider Tests
 *
 * These tests verify that the extension's completion provider returns correct completions.
 */
suite('Completion Provider Tests', () => {

	test('Should provide all User field completions', async () => {
		const doc = await openFixture('template.gtpl');
		const completions = await getCompletionsAt(doc, 2, 11); // Line 3: <h1>{{ . - after the dot
		const fieldLabels = extractFieldLabels(completions);
		const baseFields = getBaseFields(fieldLabels);
		const expected = ['Age', 'Email', 'IsActive', 'Name', 'Posts', 'Profile'];

		assert.deepStrictEqual(baseFields, expected);
	});

	test('Should provide nested field completions if gopls returns them', async () => {
		const doc = await openFixture('template.gtpl');
		const completions = await getCompletionsAt(doc, 2, 11); // Line 3: <h1>{{ . - after the dot
		const fieldLabels = extractFieldLabels(completions);
		const nestedFields = fieldLabels.filter(f => f.startsWith('Profile.')).sort();

		// gopls non-deterministically returns nested fields, so just verify they're valid if present
		if (nestedFields.length > 0) {
			const validNestedFields = ['Profile.Avatar', 'Profile.Bio', 'Profile.Website'];
			for (const field of nestedFields) {
				assert.ok(validNestedFields.includes(field), `Unexpected nested field: ${field}`);
			}
		}
	});

	test('Should not provide field completions without gotype comment', async () => {
		const doc = await openFixture('no-gotype.gtpl');
		const completions = await getCompletionsAt(doc, 0, 7);
		const fieldLabels = extractFieldLabels(completions);

		assert.strictEqual(fieldLabels.length, 0);
	});
});
