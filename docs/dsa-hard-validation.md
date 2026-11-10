# DSA Hard bank validation

## Audit snapshot (main at time of review)

- Records: 100
- Distinct normalized prompt strings: 100
- Distinct normalized explanation texts: 25
- Repeated explanation groups: 25
- Group sizes: 25 groups of 4 records each

This deterministic pattern indicates templated repetition. Matching explanation text is a useful review signal, but it is not proof that every grouped question is semantically identical. A subject-matter review must verify concepts and author technically correct, syllabus-aligned replacements.

## Run

```bash
node scripts/validate-dsa-hard.js
```

Exit codes:
- 0: mandatory checks pass and no warnings remain.
- 1: mandatory structural checks fail.
- 2: mandatory checks pass, but human-review warnings remain.

The current embedded schema has no question IDs. The validator requires persistent unique string IDs and intentionally fails until they are added. Do not generate IDs from array position.

The script checks exact count, stable ID presence/uniqueness, four distinct non-empty options, answer index, explanation, Hard label, normalized exact prompt duplicates, and repeated explanation groups. It does not claim to prove semantic uniqueness and never deletes content.
