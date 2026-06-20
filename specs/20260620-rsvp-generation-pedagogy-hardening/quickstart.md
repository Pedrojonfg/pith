# Quickstart: RSVP Pedagogy Hardening QA

## Automated

```bash
node --import ./cursor-tests/register.mjs cursor-tests/20260620_rsvp-pedagogy-hardening.mjs
node --import ./cursor-tests/register.mjs cursor-tests/20260606_validate-sw-update-flow.mjs
node --import ./cursor-tests/register.mjs cursor-tests/20260613_source-fidelity.mjs
```

## Manual

1. **R3**: Use devtools to stub short question response; confirm one retry log and `question_count_status` on block.
2. **R2**: Settings → Strict → reload → generate block → strict claim extraction runs.
3. **R1**: Complete pre-packing assessment with mixed mastery → inspect `_config` on blocks before study.
4. **R5**: Generate development block → verify bold headers from pool; Key terms block unchanged.
5. **R5.6**: Multi-block session → connection question references prior content, not header phrase.
