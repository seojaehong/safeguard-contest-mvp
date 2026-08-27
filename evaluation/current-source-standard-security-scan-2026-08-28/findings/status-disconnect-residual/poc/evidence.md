# Supporting Evidence

## Wrapper-only cancellation

- Path: $(@{id=evidence-1; label=Wrapper-only cancellation; path=app/api/safety-reference/status/route.ts; startLine=14; endLine=37; language=typescript; role=entrypoint; code=waitForStatusWork(Promise.all([getSafetyReferenceStats(), loadKoshaGuideCorpus(), loadBundledExactKoshaReferences()]), request.signal); explanation=Underlying operations receive no signal.}.path):14`n- Role: $(@{id=evidence-1; label=Wrapper-only cancellation; path=app/api/safety-reference/status/route.ts; startLine=14; endLine=37; language=typescript; role=entrypoint; code=waitForStatusWork(Promise.all([getSafetyReferenceStats(), loadKoshaGuideCorpus(), loadBundledExactKoshaReferences()]), request.signal); explanation=Underlying operations receive no signal.}.role)`n
`$(@{id=evidence-1; label=Wrapper-only cancellation; path=app/api/safety-reference/status/route.ts; startLine=14; endLine=37; language=typescript; role=entrypoint; code=waitForStatusWork(Promise.all([getSafetyReferenceStats(), loadKoshaGuideCorpus(), loadBundledExactKoshaReferences()]), request.signal); explanation=Underlying operations receive no signal.}.language)
waitForStatusWork(Promise.all([getSafetyReferenceStats(), loadKoshaGuideCorpus(), loadBundledExactKoshaReferences()]), request.signal)
``n
Underlying operations receive no signal.
