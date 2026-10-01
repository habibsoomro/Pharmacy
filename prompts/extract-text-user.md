This time there is no photo. A person has typed the prescription's text below, copying it from the paper line by line (it may mix English and Urdu, and use the usual shorthand). A "?" marks something they could not read.

Read this text exactly as you would read the photo, and return the JSON record exactly as instructed:
- Use only what is in the text. Never add a medicine, dose or detail that is not there.
- Anything marked "?" or missing: value null, add it to "unreadable_fields", confidence "low".
- Judge "overall_legibility" from the typed text: "good" if it is complete and clear, "fair" if some parts are marked "?", "poor" if much is missing.
- If the text is clearly not a prescription, return { "is_prescription": false }.

<typed_prescription>
{{TEXT}}
</typed_prescription>
