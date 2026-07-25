# Column renames go through Prisma `@map`, never a physical rename

This repo has no migration files: schema changes reach every database, production included, through `prisma db push`. `db push` has no rename operation — asked to rename a column it drops the old one and creates an empty new one, taking every row's value with it. So when a column's name needs to change, the Prisma field is renamed and pointed at the existing column with `@map`, leaving the physical column alone. The code speaks the current vocabulary; the column keeps whatever name it was born with.

The first instance is `Field.title`, mapped to the column `name`.

## Considered options

A real rename would need a hand-written `ALTER TABLE ... RENAME COLUMN`, applied to every environment before the code that reads the new name ships. Nothing in this repo runs such a step, so it would have to be remembered, by a person, once per environment. Forgetting it on production does not fail loudly: the next `db push` reconciles the difference by dropping the old column and adding the new one empty. This repo has already taken one production outage from schema drift, which is the same failure wearing a different hat.

Adopting migrations instead would remove the constraint properly, and is the right answer eventually. It is a change to how every deploy works, so it is not something to decide in passing while renaming one column.

## Consequences

Column names in the database drift from the field names in the code, and the gap widens with each rename. Anyone reading the database directly — a psql session, a dashboard, a backup — sees the old vocabulary and needs the schema file to translate. Each mapping therefore carries a comment saying what it maps and why.

`db push` stays a no-op for these renames, in every environment, which is the property being bought.

This does not apply to genuinely new columns, which `db push` adds without incident, nor to dropping an index, which it does non-destructively. It applies to renaming a column that already holds data.
