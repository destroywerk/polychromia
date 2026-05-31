export const NOTES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

export const CHORD_TYPES = {
  'Root':       [0],
  '5':          [0, 7],
  'maj':        [0, 4, 7],
  'min':        [0, 3, 7],
  'maj7':       [0, 4, 7, 11],
  'min7':       [0, 3, 7, 10],
  '7':          [0, 4, 7, 10],
  'sus2':       [0, 2, 7],
  'sus4':       [0, 5, 7],
  'add9':       [0, 4, 7, 14],
  'maj9':       [0, 4, 7, 11, 14],
  'min9':       [0, 3, 7, 10, 14],
  'm11':        [0, 3, 7, 10, 14, 17],
  'dim':        [0, 3, 6],
  'aug':        [0, 4, 8],
  'quartal':    [0, 5, 10, 15],
  'mystic':     [0, 6, 10, 16, 21],
};

export function getChordNotes(rootNote, octave, chordType) {
  const intervals = CHORD_TYPES[chordType] || [0];
  const rootIdx = NOTES.indexOf(rootNote);
  return intervals.map((interval) => {
    const total = rootIdx + interval;
    const noteIdx = ((total % 12) + 12) % 12;
    const octaveOffset = Math.floor(total / 12);
    return `${NOTES[noteIdx]}${octave + octaveOffset}`;
  });
}

export function noteName(rootNote, octave) {
  return `${rootNote}${octave}`;
}
