Monthloom source assets

The logos directory contains the editable SVG sources for the mark and horizontal/stacked
lockups. Runtime-ready icons and logos live in apps/web/public. Generated size variants are not
kept here; regenerate them from the SVG sources when the public assets need to change.

Preview.png is the application screenshot displayed by the repository README.

Profile images
--------------
The profile-images directory contains twelve generated monochrome carpet-pattern PNGs with
transparent backgrounds. The web app uses their alpha channels as CSS masks, applying the
user's selected color at render time rather than storing separate colored variants.

The masks are runtime application dependencies and must remain available to the web build.
