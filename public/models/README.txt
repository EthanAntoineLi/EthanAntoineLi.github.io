Ethan Antoine Li — 3D models
============================

Three glTF 2.0 binary (.glb) models, plus the arm split into printable parts.
All files are meshopt-compressed (GLB), metres, +Y up, arm runs along +X.
Open with any glTF viewer (Blender, three.js, https://gltf-viewer.donmccurdy.com/).
Meshopt decoding may be required in some viewers.

arm-opt.glb            1.6 MB   290k tris
  The EPQ 5-DOF arm, articulated. Joint nodes are named J1…J5; an EEF node sits
  at the end of J5. Same geometry as the HAVK visualiser.

printer-a1-mini.glb    2.6 MB   286k tris
  Bambu Lab A1 mini, the printer that made the arm's parts.

arm-parts/
  arm-parts.glb        1.6 MB   302k tris
    The same arm, split into 9 parts, one node each, in the assembled pose.
    Node names = part ids below.
  parts/               9 separate GLBs, each centred on its own bounding box
    motor-J1.glb       57HS5417-14-500 stepper + FLF57-L2 planetary  (J1 base yaw)
    motor-J2.glb       42HSC4409-24J-300 stepper + NMRV25-50 worm   (J2 shoulder pitch)
    motor-J3.glb       42-series gearmotor + UMIR42 driver          (J3 upper-arm roll)
    motor-J4.glb       42-series gearmotor + UMIR42 driver          (J4 elbow pitch)
    motor-J5.glb       42-series gearmotor + UMIR42 driver          (J5 wrist roll)
    link-J1-J2.glb     printed shoulder yoke, incl. 3 pins          (J1 → J2)
    link-J2-J3.glb     printed upper-arm sleeve + 2 side plates     (J2 → J3)
    link-J3-J4.glb     printed elbow mount / cover                  (J3 → J4)
    link-J4-J5.glb     printed forearm                              (J4 → J5)
  manifest.json         part list, sizes, joint pivots and explode offsets

Source: EPQ 3.1 CAD (Shapr3D, STEP) → meshed/optimised GLBs; printer model from
the Bambu Lab A1 mini asset used on the portfolio.
