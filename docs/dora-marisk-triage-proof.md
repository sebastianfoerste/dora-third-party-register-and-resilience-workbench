# DORA And MaRisk Boundary Triage Proof

This proof module implements a deterministic first-pass routing check for German financial-sector third-party arrangements.

It distinguishes:

- ICT third-party service arrangements that should enter DORA third-party risk review;
- non-ICT outsourcing-style arrangements that should enter MaRisk AT 9 review;
- incomplete or ambiguous arrangements that must stay in manual boundary review.

## Source Basis

The current proof is deliberately narrow and source-bound:

- Regulation (EU) 2022/2554, Chapter V and Articles 28 to 30, for ICT third-party risk management and contractual provisions: https://eur-lex.europa.eu/eli/reg/2022/2554/oj/eng
- BaFin/Bundesbank consultation draft for the 9th MaRisk amendment, consultation 02/2026, AT 9 notes 1 to 2: https://www.bundesbank.de/resource/blob/992778/ae135823eca540727b21a57de2e10300/472B63F073F071307366337C94F8C870/bafin-konsultationsfassung-9-marisk-novelle-clean-data.pdf

The BaFin text is a consultation draft dated 1 April 2026. The proof must be refreshed once the final MaRisk circular is published.

## Implemented Rule

`triageDoraMariskBoundary()` routes:

| Input facts | Route | Review state |
| --- | --- | --- |
| ICT service | `DORA_ICT_THIRD_PARTY_RISK` | `ready_for_dora_review` |
| Non-ICT activity otherwise performed by the institution and not a one-off purchase | `MARISK_AT9_OUTSOURCING_REVIEW` | `ready_for_marisk_review` |
| Missing ICT or outsourcing boundary facts | `MANUAL_BOUNDARY_REVIEW` | `manual_review_required` |

The module fails closed when core facts are missing. It stores evidence references only and does not store raw contract text.

## Validation

Run:

```bash
npm run test -- src/lib/__tests__/dora-marisk-triage.test.ts
```

The tests cover DORA routing, MaRisk AT 9 routing, and fail-closed manual review.

## Limits

This is a triage proof, not a legal conclusion. Final routing still depends on the institution type, complete contract, actual service function, supervisory status, and current law.
