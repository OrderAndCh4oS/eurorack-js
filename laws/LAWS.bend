import Base
import ./Rack.bend as Rack

# Positions are numbered from zero. Every requested legal position is preserved.
law stepped_control:
  for +requested: Nat
  for +last: Nat
  {Nat.is_ge(last, Rack.position(requested, last)) == True{} : Bool}
  & ({Nat.is_ge(last, requested) == True{} : Bool} ->
     {Rack.position(requested, last) == requested : Nat})

# The host supplies both exact, inclusive comparisons of finite JS voltages.
law input_normal:
  for +above_min: Bool
  for +below_max: Bool
  {Rack.in_range(above_min, below_max) == Bool.and(above_min, below_max) : Bool}

# Pitches are integral semitones. Twelve semitones correspond to one volt.
def one_volt_higher(chord: +List<Nat>) -> +List<Nat>:
  match chord:
    case Nil{}:
      Nil{}
    case n <> rest:
      Nat.add(n, 12n) <> one_volt_higher(rest)

law ascending_octaves:
  for +chord: +List<Nat>
  {Rack.ascending(chord, False{}) == chord : +List<Nat>}
  & {Rack.ascending(chord, True{}) ==
     List.append(&2, Nat, chord, one_volt_higher(chord)) : +List<Nat>}
