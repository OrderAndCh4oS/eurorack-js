import Base

def position(+requested: Nat, +last: Nat) -> Nat:
  Bool.pick(Nat, Nat.is_ge(last, requested), requested, last)

def in_range(above_min: Bool, below_max: Bool) -> Bool:
  match above_min:
    case True{}:
      below_max
    case False{}:
      False{}

def transpose(chord: +List<Nat>, +semitones: Nat) -> +List<Nat>:
  match chord:
    case Nil{}:
      Nil{}
    case head <> tail:
      Nat.add(head, semitones) <> transpose(tail, semitones)

def ascending(+chord: +List<Nat>, two_octaves: Bool) -> +List<Nat>:
  match two_octaves:
    case False{}:
      chord
    case True{}:
      List.append(&2, Nat, chord, transpose(chord, 12n))
