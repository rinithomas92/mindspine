# Care report assets

`mindspine-logo.png` is the original 297 x 96 image extracted losslessly from the
user-supplied `mindspine_care_report_branded_sample.pdf` (15 October 2026).
It includes the complete wordmark and tagline. Preserve the original proportions
and colors; do not replace it with the app's drawn icon.

The DM Sans WOFF files are copied from the project's existing
`@fontsource/dm-sans` 5.3.0 Latin 400 and 700 normal font files. They are embedded
and subset by pdf-lib/fontkit. Their SIL Open Font License is included here.
Report titles use the print-safe Times Bold serif fallback, corresponding to
the application's Georgia/Times heading family.

The renderer reads these files with explicit paths so Next.js can include them
in the server deployment's file trace.
