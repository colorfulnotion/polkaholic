# Contributing

## Rules

There are a few basic ground-rules for contributors (including the maintainer(s) of the project):

- **Non-main branches**, should have a informative name (e.g. `xcmrecentmessages`) must be used for ongoing work.
- **All modifications** must be made in a **pull-request** to solicit feedback from other contributors.  
- When submitting
- Use `make beauty` to make your JS

### Merging pull requests once CI is successful

- A pull request that does not alter any logic (e.g. comments, dependencies, docs) may be tagged `insubstantial` and merged by its author.
- A pull request with no large change to logic that is an urgent fix (indexing fix, data presentation bug) may be merged after a non-author contributor has reviewed it well.
- All other PRs should sit for 48 hours with the `pleasereview` tag in order to garner feedback.
- No PR should be merged until all reviews' comments are addressed.

### Reviewing pull requests

When reviewing a pull request, the end-goal is to suggest useful changes to the author. Reviews should finish with approval unless there are issues that would result in:

- Buggy behavior.
- Undue maintenance burden.
- Breaking with house coding style.
- Pessimization (i.e. reduction of speed as measured in the projects benchmarks).
- Feature reduction (i.e. it removes some aspect of functionality that a significant minority of users rely on).
- Uselessness (i.e. it does not strictly add a feature or fix a known issue).

### Reviews may not be used as an effective veto for a PR because

- There exists a somewhat cleaner/better/faster way of accomplishing the same feature/fix.
- It does not fit well with some other contributors' longer-term vision for the project.

## Releases

Declaring formal releases remains the prerogative of the project maintainer(s).

## Heritage

These contributing guidelines are modified from the Polkadot project guidelines

