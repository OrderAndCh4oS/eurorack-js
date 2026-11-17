// Panel order and native airway_set_phoneme indices are one versioned contract.
export const VOCAL_SOUNDS = Object.freeze([
    ['A', 'ɑ', 'ah vowel'], ['B', 'b', 'voiced lip closure'], ['C', 'k', 'hard C, as in cat'],
    ['D', 'd', 'voiced tongue-tip closure'], ['E', 'e', 'eh vowel'], ['F', 'f', 'unvoiced lip/teeth friction'],
    ['G', 'g', 'hard G, as in go'], ['H', 'h', 'open-glottis breath'], ['I', 'i', 'ee vowel'],
    ['J', 'dʒ', 'J, as in jam; close then release Articulate'], ['K', 'k', 'unvoiced back-tongue closure'],
    ['L', 'l', 'lateral tongue sound'], ['M', 'm', 'lip-closed nasal'], ['N', 'n', 'tongue-tip nasal'],
    ['O', 'o', 'oh vowel'], ['P', 'p', 'unvoiced lip closure'], ['Q', 'kw', 'KW; close then release Articulate'],
    ['R', 'ɹ', 'English R'], ['S', 's', 'S hiss'], ['T', 't', 'unvoiced tongue-tip closure'],
    ['U', 'u', 'oo vowel'], ['V', 'v', 'voiced lip/teeth friction'], ['W', 'w', 'rounded W'],
    ['X', 'ks', 'KS; close then release Articulate'], ['Y', 'j', 'Y, as in yes'], ['Z', 'z', 'voiced S'],
    ['SH', 'ʃ', 'SH, as in ship'], ['CH', 'tʃ', 'CH, as in chip; close then release Articulate'],
    ['TH', 'θ', 'unvoiced TH, as in thin'], ['DH', 'ð', 'voiced TH, as in this'],
    ['NG', 'ŋ', 'NG, as in sing'], ['ZH', 'ʒ', 'ZH, as in measure']
].map(([label, ipa, description], index) => Object.freeze({ label, ipa, description, index, param: `enable${label}` })));

// Use for patch authorship/UI commands, never allocate this in process().
export function vocalSoundSelection(labels) {
    const selected = new Set(labels);
    return Object.fromEntries(VOCAL_SOUNDS.map(sound => [sound.param, Number(selected.has(sound.label))]));
}
