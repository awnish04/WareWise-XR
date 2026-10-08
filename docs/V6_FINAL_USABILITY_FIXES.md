# v6 Final Usability Fixes

This build keeps the v5 signage/prompt corrections and adds the final interaction and environment pass requested during review.

## Prompt / quiz escape behaviour
- `Esc` closes any open training prompt, quiz or terminal interface.
- Opening a prompt releases pointer lock as before.
- The first click on the 3D view after closing a prompt now only recaptures the mouse; it does not also trigger the object under the crosshair.
- Once pointer lock is active, left-click and `E` work normally for interactions.

## Training Control Room
The electronic training terminals are no longer mixed into material-handling routes. Briefing, Cyber Awareness, 5 Whys and Hazard Duel are grouped in a dedicated south-east Training Control Room with solid walls, a wide access doorway and an in-world CONTROL ROOM sign. The minimap also depicts the room footprint and doorway.

## Work-at-height access
The ladder side rails now extend above the platform landing. A visible green descent point at the top provides an easy return interaction after the high-level sensor task. The objective guide switches to this descent point once the high-level task is complete.

## Carry visibility
Desktop-carried objects are held farther forward and rendered at a reduced display scale. Their actual warehouse dimensions return when placed, so the change improves first-person visibility without changing the task object itself.

## Collision coverage
Player-height collision is now applied to:
- warehouse/perimeter and Training Control Room walls;
- rack uprights, low rack beams and stored loads;
- forklift body, cab, mast, tines and wheels;
- worker bodies;
- pedestrian barriers and bollards;
- manual-handling objects and terminals;
- maintenance-platform posts and guardrails;
- physical hazard props such as the blocked exit pallet, chemical drum, damaged pallet and unstable stack.

The collision test includes vertical overlap so roof lights and high rack components do not incorrectly block a worker walking underneath open space. WebXR thumbstick locomotion uses the same solid-object check.
