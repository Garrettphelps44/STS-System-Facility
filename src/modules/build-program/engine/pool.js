// Ported as-is from reference/52weekprogram.html (lines 180-339, 677-679) —
// the exercise pools, equipment taxonomy, and sport-conditioning offset.

export const EQUIPMENT = [
  ['racks', 'Racks'], ['barbells', 'Barbells'], ['trapBars', 'Trap Bars'], ['dumbbells', 'Dumbbells'],
  ['kb', 'Kettlebells'], ['cables', 'Cable Machines'], ['landmine', 'Landmine'], ['benches', 'Benches'],
  ['adjBenches', 'Adjustable Benches'], ['pullUpBar', 'Pull-Up Bar'], ['plyoBoxes', 'Plyo Boxes'], ['ghd', 'GHD'],
  ['bands', 'Bands'], ['foamRoller', 'Foam Roller'], ['medBalls', 'Med Balls'], ['sleds', 'Sleds'],
  ['drags', 'Drags'], ['field', 'Field'], ['turf', 'Turf'],
]

// Quick equipment categories — one tap turns on everything inside
export const EQCATS = [
  { id: 'rack', l: 'Racks & Barbells', s: 'racks · barbells', keys: ['racks', 'barbells'] },
  { id: 'db', l: 'Dumbbells & KBs', s: 'dumbbells · kettlebells', keys: ['dumbbells', 'kb'] },
  { id: 'bench', l: 'Benches', s: 'flat · adjustable', keys: ['benches', 'adjBenches'] },
  { id: 'cable', l: 'Cables & Landmine', s: 'cable stacks · landmine', keys: ['cables', 'landmine'] },
  { id: 'bar', l: 'Pull-Up Bar', s: 'chin / pull-up', keys: ['pullUpBar'] },
  { id: 'box', l: 'Plyo Boxes', s: 'jump boxes', keys: ['plyoBoxes'] },
  { id: 'mb', l: 'Med Balls', s: 'throws · slams', keys: ['medBalls'] },
  { id: 'band', l: 'Bands & Roller', s: 'bands · foam roller', keys: ['bands', 'foamRoller'] },
  { id: 'sled', l: 'Sleds & Drags', s: 'push · drag', keys: ['sleds', 'drags'] },
  { id: 'field', l: 'Field / Turf', s: 'run space', keys: ['field', 'turf'] },
  { id: 'spec', l: 'Specialty', s: 'trap bar · GHD', keys: ['trapBars', 'ghd'] },
]

export const PRESETS = [
  { l: 'Full weight room', cats: EQCATS.map((c) => c.id) },
  { l: 'Barbell room only', cats: ['rack', 'bench', 'bar', 'spec'] },
  { l: 'Dumbbells + field', cats: ['db', 'bench', 'mb', 'field', 'band'] },
  { l: 'Bodyweight only', cats: [] },
]

export const POOL = {
  mainStrength: [
    { n: 'Back Squat', s: ['4x2 1000'], req: ['racks', 'barbells'] },
    { n: 'Front Squat', s: ['4x2 1000'], req: ['racks', 'barbells'] },
    { n: 'Trap Bar Deadlift', s: ['4x2 1000'], req: ['trapBars'] },
    { n: 'Conventional Deadlift', s: ['4x2 1000'], req: ['barbells'] },
    { n: 'BB RDL', s: ['6x3 1000'], req: ['barbells'] },
    { n: 'DB RDL', s: ['4x6 2000'], req: ['dumbbells'] },
  ],
  main2Strength: [
    { n: 'DB Bench Press', s: ['3x6 2000'], req: ['dumbbells'] },
    { n: 'Floor Press', s: ['3x6 1120'], req: ['dumbbells'] },
    { n: 'Seated DB Overhead Press', s: ['3x5 1221'], req: ['dumbbells'] },
    { n: 'Half Kneeling Cable Row', s: ['3x8 1121'], req: ['cables'] },
    { n: 'Pull Up', s: ['3x5 2010'], req: ['pullUpBar'] },
    { n: 'Landmine Press', s: ['3x6 2010'], req: ['landmine'] },
  ],
  power: [
    { n: 'Vertical Jump', s: ['3x3 1000'], req: [] },
    { n: 'Box Jumps Double Jump', s: ['3x3 1000'], req: ['plyoBoxes'] },
    { n: 'Broad Jump Hard Landing', s: ['3x3 1000'], req: [] },
    { n: 'SL Bounds', s: ['3x3 1000'], req: [] },
    { n: 'High Hip Hang Power Clean', s: ['3x2'], req: ['barbells'] },
  ],
  accStrength: [
    { n: 'Long Gate Contralateral Stationary Lunge', s: ['4x6 2010'], req: [] },
    { n: 'Short Gate Contralateral FFESS', s: ['4x8 2002'], req: [] },
    { n: 'Short Gate Contralateral RFESS', s: ['4x8 2100'], req: [] },
    { n: 'Single Leg DB RDL', s: ['4x8 2100'], req: ['dumbbells'] },
    { n: 'Standing B Stance Cable SA Row', s: ['3x6 1121'], req: ['cables'] },
    { n: 'Cable Tricep Extensions', s: ['3x10 1020'], req: ['cables'] },
  ],
  throws: [
    { n: 'Facing Bilateral MB Toss', s: ['3x3 1000'], req: ['medBalls'] },
    { n: 'Side B Stance MB Toss', s: ['3x3 1000'], req: ['medBalls'] },
    { n: 'Med Ball Slams', s: ['3x3 1000'], req: ['medBalls'] },
    { n: 'Step Through Med Ball Shot Put', s: ['3x3 1000'], req: ['medBalls'] },
    { n: 'Half Kneeling OH MB Toss', s: ['3x3 1000'], req: ['medBalls'] },
  ],
  durability: [
    { n: 'Single Arm OH Carries', s: ['3x45 1000'], req: ['dumbbells', 'kb'] },
    { n: 'Standing Pallof Press Holds', s: ['3x20 1000'], req: ['cables'] },
    { n: 'GHD Hold', s: ['3x20 1000'], req: ['ghd'] },
  ],
  mobility: [
    { n: 'Thread the Needle', s: ['3x6 1200'], req: [] },
    { n: 'Open Books', s: ['3x6 1200'], req: [] },
    { n: 'Foam Roller Extension', s: ['3x10 1000'], req: ['foamRoller'] },
    { n: 'Cat / Cows', s: ['3x6 3232'], req: [] },
    { n: 'Pigeon Pose', s: ['3x15 1000'], req: [] },
    { n: 'Downward Dog', s: ['3x5 1200'], req: [] },
  ],
  arms: [
    { n: 'Cable Incline Bicep Curl', s: ['2x10 2010'], req: ['cables'] },
    { n: 'B Stance High Cable Bicep Curl', s: ['3x10 2121'], req: ['cables'] },
    { n: 'Cable Tricep Extensions', s: ['3x10 1020'], req: ['cables'] },
    { n: 'Single Arm OH Tricep Extension', s: ['2x10 1020'], req: ['dumbbells'] },
    { n: 'Supported Preacher Bicep Curl', s: ['3x5 1020'], req: ['dumbbells'] },
    { n: 'Rolling Triceps', s: ['3x8 2000'], req: ['dumbbells'] },
    { n: 'Diamond Push-Ups', s: ['3x6 2010'], req: [] },
    { n: 'Banded Triceps Pushdown', s: ['3x12 2010'], req: ['bands'] },
    { n: 'Bench Dips', s: ['3x8 2000'], req: ['benches'] },
  ],
  core: [
    { n: 'Dead Bugs', s: ['2x10 3131'], req: [] },
    { n: 'Bird Dogs', s: ['2x15 3131'], req: [] },
    { n: 'Hollow Holds', s: ['3x15 1000'], req: [] },
    { n: 'Standing Pallof Press Holds', s: ['3x20 1000'], req: ['cables'] },
  ],
  mainBW: [
    { n: 'Tempo Bodyweight Squat', s: ['4x6 3030'], req: [] },
    { n: 'Single-Leg Squat to Box', s: ['3x6 2010'], req: ['plyoBoxes'] },
    { n: 'Nordic Hamstring Curl', s: ['3x4 4000'], req: [] },
    { n: 'Reverse Lunge', s: ['4x8 2010'], req: [] },
    { n: 'Feet-Elevated Push Ups', s: ['3x6 2100'], req: [] },
  ],
  coordination: [
    { n: 'Facing Bilateral Two Hand Catch', s: ['2x5'], req: [] },
    { n: 'Facing B Stance Right Hand Catch', s: ['2x5'], req: [] },
    { n: 'Facing Single Leg Two Hand Catch', s: ['2x5'], req: [] },
    { n: 'Partner Pass Side to Side Tennis Ball', s: ['2x5'], req: [] },
  ],
}

export const CORE4 = [
  { anchor: 'Walking Hip Airplane', sub: ['Adductor Rolling', '90/90 Over Back Knee', 'Figure 4 Stretch', 'Pigeon Pose', 'Cobra Pose', 'Half Kneeling Lateral Lunge'] },
  { anchor: 'Lat Pullover', sub: ['Side Lying Banded ER', '90/90 Banded ER', 'Downward Dog', 'KB Waiter Carries', 'Cat/Cow', 'Foam Roller Extensions'] },
  { anchor: 'Dips', sub: ['Banded Shoulder IR', '90/90 Shoulder IR', 'Knee Bent Dips', 'Crab Pose', 'Straight Leg Raise Ups'] },
  { anchor: 'Standing Windmill', sub: ['Thread the Needle', 'Open Books', '90/90 Thoracic Rotation', 'Frog Pose with Rotation', 'MB Rotation'] },
]

export const CONDITIONING = [
  { n: 'Build Up Sprints', req: ['field', 'turf'] }, { n: 'Sled Pushes', req: ['sleds'] }, { n: 'Sled Drags', req: ['drags'] },
  { n: 'Banded Resisted Sprints', req: ['bands'] }, { n: 'A-Skips', req: [] }, { n: '5-10-5 Relays', req: [] },
  { n: 'MB Sprints', req: ['medBalls'] }, { n: '200m Repeats', req: ['field', 'turf'] },
]

export const T1 = { main: 'mainStrength', acc: ['power', 'throws', 'mobility'], label: 'Training 1' }
export const T2 = { main: 'main2Strength', acc: ['accStrength', 'durability', 'mobility'], label: 'Training 2' }
export const ACC_LABEL = { power: 'Power', throws: 'Throws', mobility: 'Mobility', accStrength: 'Strength', durability: 'Durability' }
export const LIGHT_POOLS = ['arms', 'core', 'mobility']
export const LIGHT_LABEL = { arms: 'Arms', core: 'Core', mobility: 'Stretch' }

// sport shifts which conditioning option comes up first — everything else
// is constraint-driven
export const SPORT_OFFSET = {
  Football: 0, Basketball: 1, Soccer: 2, Volleyball: 3, Wrestling: 4, 'Track & Field': 5,
  'Cross Country': 6, Lacrosse: 7, Tennis: 1, Swimming: 2, Golf: 3, 'General Athlete': 0,
}

// Derives the granular 19-item boolean equipment map from a set of
// selected EQCATS ids. A category's presence just sets each of its keys
// to 1 — no per-item counts here (that's the "exact" granular list kept
// available separately for facilities that want it).
export function equipmentFromCats(cats) {
  const equipment = Object.fromEntries(EQUIPMENT.map((e) => [e[0], 0]))
  cats.forEach((id) => {
    const c = EQCATS.find((x) => x.id === id)
    if (c) c.keys.forEach((k) => (equipment[k] = 1))
  })
  return equipment
}

// The reverse direction, for the UI: the granular 19-item equipment map
// is the single persisted source of truth (so toggling one exact item
// doesn't fight with which category buttons are "on"). A category shows
// as selected only when every one of its keys is currently true — this
// derives that for display, it isn't itself stored.
export function catsFromEquipment(equipment) {
  return EQCATS.filter((c) => c.keys.every((k) => equipment[k] > 0)).map((c) => c.id)
}
