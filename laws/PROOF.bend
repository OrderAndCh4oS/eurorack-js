import Base
import ./Rack.bend as Rack
import ./LAWS.bend as Laws

def bounded(+requested: Nat, +last: Nat, fits: Bool,
  compared: {Nat.is_ge(last, requested) == fits : Bool})
  -> {Nat.is_ge(last, Bool.pick(Nat, fits, requested, last)) == True{} : Bool}:
  match fits:
    case True{}:
      compared
    case False{}:
      Nat.ge_refl(last)

def Laws.stepped_control(requested, last):
  fits = Nat.is_ge(last, requested)
  (bounded(requested, last, fits, {==}),
   legal => Equal.cong(Bool, Nat, ok => Bool.pick(Nat, ok, requested, last), fits, True{}, legal))

def Laws.input_normal(above_min, below_max):
  match above_min:
    case True{}:
      {==}
    case False{}:
      {==}

def upper_pass(chord: +List<Nat>) -> {Rack.transpose(chord, 12n) == Laws.one_volt_higher(chord) : +List<Nat>}:
  match chord:
    case Nil{}:
      {==}
    case n <> rest:
      Equal.cong(+List<Nat>, +List<Nat>, tail => Nat.add(n, 12n) <> tail,
        Rack.transpose(rest, 12n), Laws.one_volt_higher(rest), upper_pass(rest))

def Laws.ascending_octaves(chord):
  ({==}, Equal.cong(+List<Nat>, +List<Nat>, upper => List.append(&2, Nat, chord, upper),
    Rack.transpose(chord, 12n), Laws.one_volt_higher(chord), upper_pass(chord)))
