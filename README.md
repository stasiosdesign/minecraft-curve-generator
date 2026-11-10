# Minecraft Curve Generator

Open `dist/index.html` directly in a browser, or use the standalone `index.html` at the repository root. No server, installation or network connection is required. Refresh an already-open tab after replacing the file.

## Controls

- Choose a circle, ellipse or custom curve. Sliders and numerical inputs update the roof.
- Drag the centre handle vertically to change the rise. Drag an end horizontally to change the span. Moving either end vertically switches to a custom curve, permitting asymmetric roofs. Focus a handle and use arrow keys for half-block adjustments; Shift changes the increment to one block.
- Roof thickness is the **vertical separation** between the two mathematical reference curves, not a constant normal offset. The actual thickness varies with valid Minecraft shapes and connectivity constraints.
- Reference curves show the outside in coral and the underside in dashed blue. Both are optimised together with equal geometric weight.
- Single colour renders all pieces alike and hides material colour swatches. Counts, inspection and exports remain available.
- Drag the background to pan, scroll or use +/- to zoom, and Fit to recenter. Click a block for its coordinates and placement.
- Export CSV records one-block-deep elevation coordinates with z=0, including upright/inverted stairs and lower/upper slabs. Left/right are relative to the elevation, not compass directions.

## Roof optimisation

The continuous outer curve is evaluated first. Circular arcs support 10–180 degrees; ellipses use independent width and rise. Custom curves are quadratic Beziers with linear horizontal parameter, passing through the left endpoint, midpoint and right endpoint. Their middle control ordinate is derived from those three points. The inner target is a vertical translation by the requested roof thickness. Each reference is sampled into 512 segments.

Each column proposes both upper and lower profiles from the valid half-block grid. Occupancy is reconstructed and checked against exactly seven allowed masks: full block, top/bottom slab, and two upright/two inverted straight stair profiles. Impossible quarter blocks, overlapping pieces, and disconnected column shapes are rejected. Adjacent columns must share a positive-length face of at least half a block.

The cost measures both outside and inside horizontal surfaces and their vertical risers against their respective reference polylines. Both surfaces have equal weight, with small thickness, tangent and transition penalties. A bounding-volume tree accelerates distance queries. Dynamic programming selects a connected sequence from up to 72 locally promising states per column plus a spanning connectivity state. This bounded candidate search is efficient but does not guarantee the optimum across every possible Minecraft arrangement.

The displayed outside/inside RMS values sample horizontal surfaces separately, in blocks. They do not include vertical risers, although those are included in optimisation. No filled support columns remain below the roof. Fractional-width endpoints extend to the next whole block column. Very steep/thin sections may need a wider local profile for connectivity. Counts include every piece shown, with no artificial visual smoothing.

## Source

- `dist/curves.js`: mathematical reference curves and editable points.
- `dist/geometry.js`: exact block polygons.
- `dist/optimizer.js`: valid roof profiles and two-boundary sequence optimisation.
- `dist/worker.js`: background calculation.
- `dist/app.js`: controls, dragging, rendering, inspection and CSV export.
- `template.html`, `dist/style.css`: viewport-sized interface.
- `frame-template.html`, `dist/frame.js`, `dist/frame-app.js`: House Roof framework, panel and both roof variations; `dist/angle-roof.js`: Angle Roof beams (straight beam primitive, column pairing, limits and angles).
- `bridge1-template.html`, `dist/bridge1.js`, `dist/bridge1-app.js`: Bridge 1 (curve placement, upper-curve mirroring and side beams; the panel reuses curve-editor.js, the Curves worker and the solver).
- `dist/ravine.js`: Bridge terrain on a typed voxel grid with greedy meshing; `dist/terrain-view.js`: WebGL terrain view with the Canvas renderer as fallback.
- `build.mjs`: assembles the modules into self-contained HTML and embeds the worker source. Run `node build.mjs` after edits.

Run `node tests.mjs` for numerical verification. Twelve cases cover small/large circles, shallow/steep/flat sections, asymmetric/rising/falling/concave custom roofs and thin/thick shells. Tests verify exact legal polygon area, unique grid cells, positive-face connectivity, rendered occupancy matching both boundary profiles, curve equations and dual-surface errors. Mixed shapes improved combined horizontal-surface RMS in ten of twelve cases; the shallow case tied and the extreme steep ellipse had a trade-off with the full-block result. The algorithm optimises the combined boundary cost, not that displayed horizontal-only metric alone.

Browser checks verified direct-file loading, a blocked-worker fallback, all three pointer handles, switching to custom curves, thickness changes, full-block comparison, single-colour rendering and hidden swatches. No page scrolling or clipping of the canvas was found at 1440×900, 1024×600, 390×844 and 667×375. The canvas remains zoomable at small viewport sizes.

## 3D view

Use the 2D / 3D buttons above the canvas. The 3D view extrudes the current cross-section into a roof of 1–32 blocks in depth. Drag to orbit, Shift-drag or right-drag to pan, and scroll or use +/- to zoom. Outside and Inside restore useful camera angles. Arrow keys rotate a focused 3D canvas. Click a surface to inspect its block coordinates and depth layer. Return to 2D to edit curve handles; numerical curve controls work in either view.

Material counts and CSV exports reflect the active view: one elevation layer in 2D, all depth layers in 3D. Single-colour mode and grid visibility also work in 3D. The reference-line and handle switches apply only to 2D.

`dist/view3d.js` builds exterior-only, axis-aligned faces from exact occupied half-grid cells, merges coplanar faces within each Minecraft block and renders an orthographic orbit view with Canvas 2D. There are no external libraries or GPU requirements. This is a repeated roof cross-section, not a dome or a curve varying along its depth. Run `node tests-3d.mjs` to verify mesh volume, exposed area, inverted shapes, extrusion and shared-face removal.

## Layouts: straight, 45° diagonal, corner/hip

Choose Layout in the sidebar. New layout choices switch to 3D automatically. Outside, Inside and Top show the exterior, underside and actual grid footprint. In diagonal/hip modes, counts and CSV exports always describe the complete footprint, including when using the 2D profile editor.

### 45° diagonal

This mode recalculates the reference fit on diagonal grid bands. The real along-curve coordinate is `u=(X+Z)/sqrt(2)`; adjacent bands therefore advance by `1/sqrt(2)` block, not one whole block. The solver evaluates each candidate's horizontal surfaces over both local X and Z, includes risers on both grid directions, and requires positive-area connections along X and Z. The footprint includes parity-valid integer cells in a band of the requested transverse depth. Boundary staggering and whole-grid rounding mean the exact footprint differs slightly from the ideal dimensions. Negative X coordinates are intentional and may be translated together when building.

Every block remains aligned with world axes. Straight stairs use their +X or -X full-height halves consistently, avoiding perpendicular stair adjacency. Shapes are never rotated 45 degrees. This limits the orientation search but produces an ordinary, buildable stepped diagonal structure. The 2D view is a mathematical profile editor in this mode: it deliberately does not pretend these staggered world placements are a conventional side elevation. Use 3D or Top to see the construction.

### Corner / hip

This creates a square quarter-roof joining two perpendicular curved slopes along the diagonal `X=Z`. The target surface is `height=f(min(X,Z))`; its underside uses the same vertical thickness offset. It uses the complete editable curve on both joined wings, from the left endpoint through the centre to the right endpoint, with both runs rounded up to whole block cells. Depth is determined by that run rather than by the extrusion-depth control.

Off the seam, the shared two-sided profile is placed along X or Z as appropriate. Stair cells exactly on the seam become full blocks, preserving connectivity and avoiding adjacent perpendicular straight stairs. This is a deliberately conservative full-block hip ridge, not a simulation of Minecraft inner/outer corner-stair states. It can be chunkier than the neighbouring surfaces. Both displayed errors are recomputed from actual placed surfaces, including the seam. A fully general corner-stair optimizer and independently shaped wings are not implemented.

Minecraft stairs can form corners with other stairs; the conservative seam avoids relying on corner states not represented by this tool. See the official [Minecraft Beta & Preview 1.21.130.24 notes](https://feedback.minecraft.net/hc/en-us/articles/40708241210765-Minecraft-Beta-Preview-1-21-130-24) concerning cornerable stairs.

### Placement and verification

`dist/layout.js` creates integer world placements and half-block occupancy. The 3D mesh is generated from those same placements, removing shared internal faces. CSV now includes `full_half_direction` as +X, -X, +Z or -Z for stairs; slab placement is top/bottom. Coordinates, material counts, inspection and the rendered mesh all refer to the same placed model. Scene error values sample actual exposed horizontal surfaces in world space; reference profiles retain the horizontal-only metric described above.

Run `node tests-layouts.mjs` for diagonal and hip tests covering small circles, typical roofs, steep ellipses and asymmetric curves; diagonal depths 1, 3 and 12; grid validity; non-overlap; half-voxel face connectivity; legal orientation; seam buffering; and mesh volume. Browser checks cover layout switches, Top/Inside, the profile editor, exported coordinates and counts, straight-mode regression, and no-scroll layouts at 390×844, 667×375 and 1024×600.

### Full-profile corner correction

The corner generator previously truncated the profile at its centre even though the 2D editor showed the complete curve. Both joined wings now use the full profile and full span. This creates a mitered corner joining complete curved roof sections; an arch-shaped input produces a curved ridge that follows the corner and descends again toward the other endpoint. The seam retains its conservative full-block caps.

`node tests-hip-profile.mjs` checks that every source column, including the right half and endpoint, appears in both wings. Coverage includes circular, elliptical and asymmetric curves with different right endpoint heights. Browser checks verify the full footprint, inside/top views, counts, exports and viewport layout.



## Header and settings layout

The header is a single 50-pixel bar holding the portrait, the title, the Curves / House Roof / Bridge tabs, the Curves actions and Versions (previously 80 pixels plus a 48-pixel tab row). On phones it wraps to two rows: title and actions, then tabs and Versions. Settings panels use short group titles, compact field grids and collapsible groups. On desktop screens down to 1366 × 768 they fit without a scrollbar: the House Roof curve editor and the Angle Roof diagram take whatever height is left (with minimums of 140 and 110 pixels). Longer explanations are tooltips on the fields.

## Dark theme and mobile controls

The interface uses a dark theme on all screen sizes. On phones, Adjust opens a bottom settings panel; Done, tapping the backdrop or Escape closes it. The panel contains the curve, layout, dimensions and thickness controls. Display options, Full blocks only, single colour and the accuracy values are in the Display menu of the canvas toolbar (it closes on an outside click or Escape). Reset curve is inside the mobile panel. The preview, view buttons, zoom controls, export and material counts remain on the main screen.

Mobile inputs use 16px text, touch controls are enlarged, and safe-area insets are respected. The page itself does not scroll; only an expanded settings panel can scroll on smaller screens. Both 2D and 3D retain touch dragging and zoom buttons. Coarse-pointer curve handles use 44px touch targets.

Browser checks covered 1440×900, 390×844, 320×568 and 667×375, including panel opening/closing, advanced settings, curve edits and 2D/3D rendering.

The middle handle moves in both axes. Dragging it sideways switches to Custom; Bend position controls its horizontal location (10–90% of the span). A smooth monotone parameter mapping preserves the endpoints and moves the bend without a join or loop. Arrow keys also move the focused handle.


Symmetric references are centred within their enclosing block grid without changing their mathematical shape. The solver optimises half the profile and mirrors legal elements, restricting an odd centre column to symmetric profiles. Both surfaces and stair orientations match exactly. Fractional spans receive equal margins on both ends; asymmetric edits use the full solver.


House Roof tab: two independent roof variations on one shared framework, chosen at the top left: Curved Roof (the original design, unchanged apart from its name) and Angle Roof. Each keeps its own column heights, lift and beam level, so editing one never changes the other; Reset only resets the variation on screen. The framework is three concentric column shells on a 25 × 25 square. Outer columns sit at 0, 6, 10, 14, 18 and 24 along every side (20 columns). The 13 × 13 middle square (6–18) has columns at 6, 10, 14, 18 (12 columns). The centred 5 × 5 square (10–14) has one column per corner (4 columns). Heights default to 8, 12 and 18 and include their base blocks. Outer and middle columns start at Y=20; the centre columns start 3 blocks higher (adjustable) and float over the hollow middle. A horizontal beam wraps the outer perimeter on the 5th block (adjustable).

A solid pathway at Y=20 fills the 7 outermost rings (blocks 1–7 from the edge). The 8th ring is one stair wide, all the way round: upright stairs with the tall half against the pathway and the step facing the centre, with inner-corner stairs at the four corners (CSV: `stair`, `upright inner corner`, e.g. `+X+Z`). Everything inside the stair ring is hollow. The pathway and stair ring are fixed; only the column heights, centre lift and beam level are editable.

Corner gables: every corner gets a sweeping trim, like a gable verge, along both outer faces. It peaks over the corner column and lands on the outer column a set reach along each side (default 6, the next column). It stands on top of the outer columns, so it follows their height. Each arm is fitted with the same stair-roof ribbon as the roof: steep at the peak, flaring at the foot, with half-step detail and no gaps. A post fills down from the peak onto the corner column. Settings: height above the columns (default 7), reach (6), flare (60%), thickness across the curve (1.5), depth into the wall (2) and overhang past the wall (1); the Gables layer can be shown, hidden or turned off. Where the two arms of a corner meet in one cell with different pieces, that cell becomes a full block. Older saved designs open with the default gables.

Viewing: each layer chip highlights its group, and its eye button hides or shows it. "Show up to" hides everything above a chosen Y level so you can look inside. Views are 3D, Top, Front and Section. Section is a flat orthographic cut (default: straight through the middle, Z 12, facing north; switchable to facing east, and the cut can slide across the whole design). Cut blocks are drawn in full colour with a heavy outline; blocks beyond the cut are drawn muted, still outlined block by block. Hover a block for its coordinates; drag to pan and scroll to zoom.

Angle Roof: the same columns, outer perimeter beam, pathway and stair ring, with no curved roof, connecting curves or gables. Two sets of straight beams rise outward between the column rings. Inner → Outer (12 beams): one from each inner side column straight across to the outer column it faces, plus one from each inner corner column diagonally to the outer corner column; by default from block 4 of the inner column to block 7 of the outer column. Innermost → Inner (8 beams): side beams only, from the innermost columns straight across to the inner side columns (the inner square has no corner beams); by default from block 6 of the innermost column (which starts 3 higher) to block 11 of the inner column. Both default to 26.6°.

Each set has Start (block of its first column), Angle (0–80°, slider or typed), End (the block reached on the second column; typing it sets the angle), Thickness (measured across the beam, 0.5–3 blocks) and Extend in / out (blocks past the first and second columns, 0–12). The angle is not limited by the columns: a beam may end above its second column. Only the start must be a block of the first column. Editing the angle pivots the beam about its start. The beam groups open one at a time so the panel fits without scrolling. The cross-section diagram (Z 10) draws the real pieces; drag the start handle (whole blocks) or the end handle (sets the angle), or focus one and use the arrow keys (Shift for 5° steps on the end).

How beams are built: each beam is an ideal straight band, with its centre line from the middle of the start block at the set angle and a constant thickness across it. Extensions lengthen this line before fitting, so an overhang continues the same beam rather than adding a piece. Side beams are fitted with the House Roof stair-roof fitter, weighting the top and underside equally. It uses blocks, top and bottom slabs, and upright and upside-down stairs facing either way, keeps the thickness constant and the faces parallel, and leaves no gaps. The fitter also tries the line up to half a block higher or lower and keeps the cleanest result. For example, a 45° beam becomes one unbroken run of alternating upright and inverted stairs instead of stacked blocks and slabs, while a 2:1 beam becomes an even slab/block rhythm. Corner beams run at 45° in plan and are built like the hip of a stair roof: a one-block-wide stepped diagonal in which every cell shares a face with the next. Only pieces symmetric about the diagonal are used (blocks, slabs, inner- and outer-corner stairs, upright or upside down), chosen by a small dynamic programme that follows both edges of the same band. Corner stairs carry a small penalty so they appear only where they clearly improve the line. Corner beams reach the same end blocks as the side beams over their longer diagonal run, like a hip rafter. Two other corner forms were compared in the rendered roof and rejected: a diagonal-only chain reads as separate cubes, and a band filling both sides is too heavy. All four corners mirror each other. Where two beams claim one cell with different pieces, that cell becomes a full block. Beams never replace column, beam or pathway blocks. Beam shapes are cached by fractional height, so changing a start block or lift is instant; a new angle refits in tens of milliseconds, at most once per frame. CSV exports list beams as `outer-beams` / `inner-beams` with their side (`north`, `north-west`, …), including outer-corner stairs (`upright outer corner`, with the raised quarter's direction).

Saving: Save ↓ downloads a House Roof design (.json) holding only editable settings; Open loads such a file (or a full workspace blueprint) and rebuilds the geometry from it. The current House Roof design also autosaves in this browser and comes back after a reload; Reset returns to the defaults.


The Structure and Curves × 4 sections control the frame separately. The default convex profile is shared by four independent wings, starting one block beyond the centre columns (east X=15, west X=9, south Z=15, north Z=9). This leaves the entire 5 × 5 centre footprint clear of roof pieces. Curve width is set as blocks on each side of the centre line (default 2, giving 5 blocks; range 0–15), so every step adds one block to both the left and the right. The curve editor panel widens when open to give the profile more room. The roof is fitted to the drawn line, which is its top surface, as a constant-thickness ribbon modelled on hand-built stair roofs. Thickness is measured across the curve (perpendicular to it), from 0.5 (thinnest) to 6 blocks; the default 1.5 gives classic proportions. The fit is an exact search over every legal Minecraft profile (blocks, top and bottom slabs, upright and upside-down stairs; a block can only step half a block within itself). It scores the top surface against the drawn line and the underside against the line's perpendicular offset (the top counts double), keeps the thickness constant from one half-column to the next, and makes the top and underside repeat the same half-step inside each block. Steep runs therefore keep equal row widths and shallow runs equal column heights. On a straight 2:1 slope, for example, every column is an upside-down stair, a block and a stair, 2.5 tall and 2 lower than the last. Every column shares at least half a block of face with the next, so roofs never have gaps. The ends are cut vertically at the first and last column. The first column always holds the anchor just above the centre columns, and the profile is lifted so its underside starts there.

Frame layers are meshed independently, preserving all roof geometry where it intersects columns, the beam or another wing. CSV retains each group/wing separately; intentional design intersections are not silently reconciled into new shapes. Default group colours distinguish the beam, outer columns, middle columns, centre columns and roofs. Selecting a group highlights it in a lighter neutral tone and mutes every other group; All restores the palette. Centre height moves the roof anchor; other structure changes never change roof geometry.

## Bridge 1

Bridge 1 is an arch bridge elevation made of three parts, chosen with Lower / Beams / Upper at the top of its settings panel. Dragging a handle or tapping a block opens that part's settings.

Lower curve: the Curves tab's curve generator. It uses the same curve maths, worker and block solver, the same controls (curve type, sliders, Add point, Lock centre, thickness, Full blocks only) and the same handle editing (Shift centres the bend; arrow keys move a focused handle by half a block, or one with Shift). With the same settings it produces exactly the same blocks as the Curves tab. Both curves sit centred on the bridge's centre line, so dragging an end widens the curve on both sides and the dragged end follows the pointer.

Upper curve: the same generator again. It starts as a copy of the lower curve's settings turned upside down, mirroring every lower block (stairs and slabs flipped) across a line 6 blocks above the lower curve's crown. After that it is independent: editing the lower curve never changes it. Height sets the level of its ends, Mirrored switches between upside down and upright, and Mirror lower replaces it with a fresh mirror image of the current lower curve. Its handles are drawn where the curve is, so on the upside-down curve dragging the bend down deepens the sag.

Beams: always four, two parallel beams on each side. Each pair stands on the lowest point of the lower curve's underside and leans towards the centre. Settings: Height, Thickness, Tilt (degrees from vertical, 0–45), Spacing (the gap between the two beams of a pair) and Position (the pair's centre measured from the end of the lower curve; positive moves inwards). With Same on both sides, one set of settings mirrors both pairs; turn it off to set Left and Right separately. Both beams of a pair share one stepped outline, so they are exactly parallel; a one-block-thick beam keeps face contact at each sideways step.

2D shows the elevation; 3D extrudes it through Depth blocks, as in the Curves tab, so the beams become tilted walls. CSV ↓ lists every block with its part (`lower`, `upper`, `left-outer-beam`, …). Bridge 1 autosaves in the browser, and saved versions and blueprints include it; older blueprints load without changing it.

## Saved versions and portable blueprints

Versions → Save version stores all four workspaces in localStorage under minecraft-design-versions-v1, up to 50 named snapshots. Versions persist across refreshes in the same browser and origin; file URLs and a deployed website do not share storage. Export blueprint downloads a versioned JSON file, and Import blueprint validates it before applying any changes. All curve parameters (including the fourth point), pillar heights, curve widths, visibility, locks, display settings, current workspace and camera views are preserved. Geometry is regenerated from parameters and remains editable. Blueprints are the portable backup when storage is blocked, full, cleared, or a different browser/device is used. The CSV buttons still export build placements rather than editable configurations.

## Shared curve editing

Both editors use curve-editor.js for circular/elliptical/custom controls, sliders, type conversion, Shift/centre locking and handle manipulation. House Roof only locks the starting handle, translating the mathematical reference to its fixed anchor; no structural suitability check changes the profile. House dimensions, the pathway, the stair ring and base Y=20 are fixed; the three column heights, the centre lift and the beam level are editable. Roof width and thickness remain curve parameters. Add point switches to a four-point custom curve using shape-preserving cubic Hermite interpolation, with continuous tangents through both movable interior points. Remove point returns to three-point interpolation.

## Bridge environment

Bridge contains only a deterministic block ravine and river, with no bridge-building controls. The cliffs have a nominal 50-block rim with summits up to Y 57. The opening is exactly 37 blocks at river level and 78 at the rim; the flanks reach about 66–71 blocks from the centre at the river and about 51–53 at the summits; the slice is 36 blocks long. The terrain is deliberately coarse: cliffs step in 4-block terraces, relief changes every 6 blocks along the river, and materials follow bands (dark wet rock at the base, strata stripes, grass and soil or gravel on upper ledges, light rock on the summits). Summit heights per 6-block stretch match the earlier detailed terrain exactly.

Performance: the earlier version stored about 118,000 solid blocks as objects with text keys (about 400 ms to build) and gave every block a random material, so none of its 31,000 faces could merge. Its Canvas renderer then sorted and drew about 15,000 faces one by one on every frame (45–70 ms per frame). Now the terrain is a typed voxel grid; greedy meshing merges equal faces into about 1,900 rectangles (about 90 ms to build); and terrain-view.js draws them with WebGL in one call with a depth buffer (well under 1 ms of main-thread time per frame). Block outlines and a slight per-block tint come from the shader, so merged faces still read as blocks. Without WebGL, the existing Canvas renderer draws the same terrain from small faces (about 12 ms per frame). Geometry is created lazily when the tab is visible.

The UI uses neutral black/charcoal surfaces and restrained radii across all tabs and dialogs. Material distinctions use grayscale; the ravine uses muted natural rock, soil, grass and water materials. Automated tests cover shared curve parity, fourth-point geometry, round-trip blueprint reconstruction (both roof variations), validation failures, local storage, ravine dimensions, summit heights and merged faces, and Angle Roof beams (tests-angle.mjs: framework, 12 outer and 8 inner beams, uncapped angles, how closely stair/slab profiles follow the ideal band across angles, thicknesses and extensions, connected corner beams, symmetry and stability), Bridge 1 (tests-bridge1.mjs: Curves-tab parity of the lower curve, the mirrored then independent upper curve, four parallel inward-leaning beams and saved state), alongside the existing numerical and geometry suites. Browser QA covers Save Version after reload, real file-input import, editing after restoration, desktop/mobile layout, and all four tabs.
