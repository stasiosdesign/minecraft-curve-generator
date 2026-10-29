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



## Dark theme and mobile controls

The interface uses a dark theme on all screen sizes. On phones, Adjust opens a bottom settings panel; Done, tapping the backdrop or Escape closes it. The panel contains the curve, layout, dimensions and thickness controls. Display options, single colour and accuracy values are under Display & accuracy. Reset curve is inside the mobile panel. The preview, view buttons, zoom controls, export and material counts remain on the main screen.

Mobile inputs use 16px text, touch controls are enlarged, and safe-area insets are respected. The page itself does not scroll; only an expanded settings panel can scroll on smaller screens. Both 2D and 3D retain touch dragging and zoom buttons. Coarse-pointer curve handles use 44px touch targets.

Browser checks covered 1440×900, 390×844, 320×568 and 667×375, including panel opening/closing, advanced settings, curve edits and 2D/3D rendering.

The middle handle moves in both axes. Dragging it sideways switches to Custom; Bend position controls its horizontal location (10–90% of the span). A smooth monotone parameter mapping preserves the endpoints and moves the bend without a join or loop. Arrow keys also move the focused handle.


Symmetric references are centred within their enclosing block grid without changing their mathematical shape. The solver optimises half the profile and mirrors legal elements, restricting an odd centre column to symmetric profiles. Both surfaces and stair orientations match exactly. Fractional spans receive equal margins on both ends; asymmetric edits use the full solver.


House Roof tab: a 21 × 21 outer deck, a 13 × 13 middle perimeter (coordinates 4–16), and a centred 5 × 5 platform (8–12). Pillars at positions 4, 8, 12, 16 have exact four-block spacing. There are 16 outer, 12 middle and 4 centre pillars, defaulting to heights 5, 9 and 11. Heights include their base blocks; the whole frame starts at Y=20. The deck fills the outer band through the middle perimeter. The centre has a full top platform.


The Structure and Curves × 4 sections control the frame separately. The default convex profile is shared by four independent wings, starting one block beyond the centre rim (east X=13, west X=7, south Z=13, north Z=7). This leaves the entire 5 × 5 centre footprint clear of roof pieces. Curve width defaults to 5 and is adjustable from 1 to 32 blocks. Even widths use grid-aligned half-block offsets under quarter-turn rotation. Only the profile start is anchored: no flat footing or frame-aware roof replacement is applied. The starting underside is fixed at platform height. Thickness is a hard maximum vertical column envelope; the solver may leave gaps when a steep profile cannot be accurately represented within that limit, without blocking editing. It never increases thickness to bridge those gaps.

Frame layers are meshed independently, preserving all roof geometry where it intersects pillars, the deck or another wing. CSV retains each group/wing separately; intentional design intersections are not silently reconciled into new shapes. Default group colours distinguish deck, outer pillars, middle pillars, centre and roofs. Selecting a group highlights it in a lighter neutral tone and mutes every other group; All restores the palette. Centre height moves the roof anchor; other structure changes never change roof geometry.

## Saved versions and portable blueprints

Versions → Save version stores all three workspaces in localStorage under minecraft-design-versions-v1, up to 50 named snapshots. Versions persist across refreshes in the same browser and origin; file URLs and a deployed website do not share storage. Export blueprint downloads a versioned JSON file, and Import blueprint validates it before applying any changes. All curve parameters (including the fourth point), pillar heights, curve widths, visibility, locks, display settings, current workspace and camera views are preserved. Geometry is regenerated from parameters and remains editable. Blueprints are the portable backup when storage is blocked, full, cleared, or a different browser/device is used. The CSV buttons still export build placements rather than editable configurations.

## Shared curve editing

Both editors use curve-editor.js for circular/elliptical/custom controls, sliders, type conversion, Shift/centre locking and handle manipulation. House Roof only locks the starting handle, translating the mathematical reference to its fixed anchor; no structural suitability check changes the profile. House dimensions and base Y=20 are fixed; only its three pillar-height groups are editable. Roof width and thickness remain curve parameters. Add point switches to a four-point custom curve using shape-preserving cubic Hermite interpolation, with continuous tangents through both movable interior points. Remove point returns to three-point interpolation.

## Bridge environment

Bridge contains only a deterministic block ravine and river, with no bridge-building controls. The cliffs are 50 blocks high with a 26-block opening at river level, widening to 50 at the top; the slice is 20 blocks long. Exposed unit faces are generated directly rather than creating half-block voxels for solid terrain, and are supplied to the existing camera, Canvas renderer, hit testing and interaction system. Geometry is created lazily when the tab is visible.

The UI uses neutral black/charcoal surfaces and restrained radii across all tabs and dialogs. Material distinctions use grayscale; the ravine river has a muted blue material. Automated tests cover shared curve parity, fourth-point geometry, round-trip blueprint reconstruction, validation failures, local storage, and ravine dimensions, alongside the existing numerical and geometry suites. Browser QA covers Save Version after reload, real file-input import, editing after restoration, desktop/mobile layout, and all three tabs.
